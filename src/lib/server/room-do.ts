import type {
	GuessRoundEntry,
	Phase,
	Player,
	PublicRoomState,
	RoomSettings,
	RoomSettingsInput,
	RoomVisibility,
	ScoreEntry,
	SpectrumCard
} from '$lib/live/types';

type Env = {
	DB: D1Database;
	ROOM_IDLE_HOURS?: string;
};

type RoomState = {
	id: string;
	code: string;
	hostUserId: string;
	hostPlayerId?: string;
	visibility: RoomVisibility;
	phase: Phase;
	players: Player[];
	psychicHistory: string[];
	psychicIndex: number;
	spectrum: SpectrumCard | null;
	roundNumber: number;
	targetValue: number | null;
	clue: string | null;
	guesses: Map<string, number>;
	scores: Map<string, number>;
	lastRoundResults: GuessRoundEntry[];
	settings: RoomSettings;
	currentRoundId?: string;
	createdAt: string;
	updatedAt: string;
};

type ClientMessage =
	| { type: 'join_room'; playerName: string; userId?: string }
	| { type: 'start_game' }
	| { type: 'submit_clue'; clue: string }
	| { type: 'update_guess'; value: number }
	| { type: 'lock_guess' }
	| { type: 'next_round' }
	| { type: 'reset_game' }
	| { type: 'update_settings'; settings: RoomSettingsInput }
	| { type: 'leave_room' }
	| { type: 'kick_player'; playerId: string };

type RateBucket = {
	windowStart: number;
	count: number;
};

type PendingAlarm =
	| { kind: 'idle_cleanup'; fireAt: number }
	| { kind: 'round_advance'; fireAt: number; step: 'to_scoring' | 'to_next_round' };

const ALARM_STORAGE_KEY = 'standpoint_alarm';

const SCORE_BANDS = [
	{ distance: 2, points: 4 },
	{ distance: 8, points: 3 },
	{ distance: 16, points: 2 }
];

const ROUND_GAP_MS = 2500;

function randomId(prefix: string) {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function sanitize(value: unknown, fallback = '', max = 120) {
	return String(value || fallback)
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s.,!?'"()/_-]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

function normalizeSetting(value: unknown, max: number): string | null {
	if (value === null || value === undefined) return null;
	const cleaned = sanitize(value, '', max);
	return cleaned ? cleaned : null;
}

function scoreForDistance(distance: number) {
	return SCORE_BANDS.find((band) => distance <= band.distance)?.points ?? 0;
}

export class RoomDO {
	private room: RoomState | null = null;
	private wsSet = new Set<WebSocket>();
	private playerSockets = new Map<WebSocket, string>();
	private socketUserIds = new Map<WebSocket, string>();
	private clueLimits = new Map<string, RateBucket>();
	private guessLimits = new Map<string, RateBucket>();

	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env
	) {}

	async fetch(request: Request) {
		const url = new URL(request.url);
		const code = url.pathname.split('/').filter(Boolean).at(-2)?.toUpperCase() ?? '';
		try {
			await this.ensureRoom(code);
		} catch (err) {
			if (err instanceof Response) return err;
			throw err;
		}

		if (url.pathname.endsWith('/ws')) {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
			this.handleWebSocket(server, request.headers.get('x-spectrum-user-id') ?? undefined);
			return new Response(null, { status: 101, webSocket: client });
		}

		return Response.json(this.publicSnapshot());
	}

	private idleCleanupMs() {
		const raw = this.env.ROOM_IDLE_HOURS;
		const h = Number(raw);
		const hours = Number.isFinite(h) && h > 0 ? h : 24;
		return Math.floor(hours * 3600000);
	}

	private async clearScheduledAlarm() {
		await this.state.storage.delete(ALARM_STORAGE_KEY).catch(() => {});
		await this.state.storage.deleteAlarm().catch(() => {});
	}

	private async scheduleIdleCleanup() {
		const fireAt = Date.now() + this.idleCleanupMs();
		const payload: PendingAlarm = { kind: 'idle_cleanup', fireAt };
		await this.state.storage.put(ALARM_STORAGE_KEY, payload);
		await this.state.storage.setAlarm(fireAt);
	}

	private async cancelIdleCleanupIfPending() {
		const pending = await this.state.storage.get<PendingAlarm>(ALARM_STORAGE_KEY);
		if (pending?.kind === 'idle_cleanup') await this.clearScheduledAlarm();
	}

	private async scheduleRoundAdvance(step: 'to_scoring' | 'to_next_round') {
		const fireAt = Date.now() + ROUND_GAP_MS;
		const payload: PendingAlarm = { kind: 'round_advance', fireAt, step };
		await this.state.storage.put(ALARM_STORAGE_KEY, payload);
		await this.state.storage.setAlarm(fireAt);
	}

	async alarm() {
		const pending = await this.state.storage.get<PendingAlarm>(ALARM_STORAGE_KEY);
		await this.clearScheduledAlarm();

		if (!pending) return;

		if (pending.kind === 'idle_cleanup') {
			if (this.wsSet.size > 0) return;
			const room = this.room;
			if (!room) return;
			const id = room.id;
			try {
				await this.env.DB.prepare('DELETE FROM standpoint_rounds WHERE room_id = ?').bind(id).run();
				await this.env.DB.prepare('DELETE FROM standpoint_room_scores WHERE room_id = ?').bind(id).run();
				await this.env.DB.prepare('DELETE FROM standpoint_room_players WHERE room_id = ?').bind(id).run();
				await this.env.DB.prepare('DELETE FROM standpoint_rooms WHERE id = ?').bind(id).run();
			} catch {
				/* best-effort */
			}
			await this.state.storage.deleteAll().catch(() => {});
			this.room = null;
			this.clueLimits.clear();
			this.guessLimits.clear();
			return;
		}

		if (pending.kind === 'round_advance') {
			const room = this.room;
			if (!room) return;

			if (pending.step === 'to_scoring') {
				if (room.phase !== 'reveal') return;
				room.phase = 'scoring';
				await this.persistRoomStatus();
				this.broadcastSnapshots();
				await this.scheduleRoundAdvance('to_next_round');
			} else {
				if (room.phase !== 'scoring') return;
				await this.beginRound(true);
			}
		}
	}

	private async ensureRoom(code: string) {
		if (this.room) return;
		const room = await this.env.DB.prepare(
			'SELECT id, code, host_user_id, visibility, status, created_at, updated_at FROM standpoint_rooms WHERE code = ?'
		)
			.bind(code)
			.first<{
				id: string;
				code: string;
				host_user_id: string;
				visibility?: RoomVisibility;
				status: Phase;
				created_at: string;
				updated_at: string;
			}>();

		if (!room) throw new Response('Room not found', { status: 404 });

		const playersResult = await this.env.DB.prepare(
			'SELECT id, user_id, display_name, join_order, connected FROM standpoint_room_players WHERE room_id = ? ORDER BY join_order ASC'
		)
			.bind(room.id)
			.all<{
				id: string;
				user_id?: string;
				display_name: string;
				join_order: number;
				connected: number;
			}>();

		const scoresResult = await this.env.DB.prepare(
			'SELECT player_id, points FROM standpoint_room_scores WHERE room_id = ?'
		)
			.bind(room.id)
			.all<{ player_id: string; points: number }>();

		const round = await this.env.DB.prepare(
			'SELECT rounds.id, rounds.round_number, rounds.psychic_id, rounds.spectrum_card_id, rounds.target_value, rounds.clue, rounds.guess_value, rounds.status, cards.left_label, cards.right_label FROM standpoint_rounds rounds LEFT JOIN standpoint_spectrum_cards cards ON cards.id = rounds.spectrum_card_id WHERE rounds.room_id = ? ORDER BY rounds.round_number DESC LIMIT 1'
		)
			.bind(room.id)
			.first<{
				id: string;
				round_number: number;
				psychic_id: string;
				spectrum_card_id: string;
				target_value: number;
				clue?: string | null;
				guess_value?: number | null;
				status: string;
				left_label?: string | null;
				right_label?: string | null;
			}>();

		const players: Player[] = (playersResult.results ?? []).map((player) => ({
			id: player.id,
			userId: player.user_id,
			displayName: player.display_name,
			joinOrder: player.join_order,
			connected: false,
			isHost: player.user_id === room.host_user_id
		}));

		const psychicIndex = round
			? Math.max(0, players.findIndex((player) => player.id === round.psychic_id))
			: 0;

		const activePhase =
			room.status === 'psychic_clue' ||
			room.status === 'guessing' ||
			room.status === 'reveal' ||
			room.status === 'scoring';
		const restoredPhase =
			activePhase && !round ? 'lobby' : room.status === 'ended' ? 'lobby' : room.status;

		this.room = {
			id: room.id,
			code: room.code,
			hostUserId: room.host_user_id,
			hostPlayerId: players.find((player) => player.userId === room.host_user_id)?.id,
			visibility: room.visibility ?? 'private',
			phase: restoredPhase,
			players,
			psychicHistory: round ? [round.psychic_id] : [],
			psychicIndex,
			spectrum: round
				? {
						cardId: round.spectrum_card_id,
						left: round.left_label || 'left',
						right: round.right_label || 'right'
					}
				: null,
			roundNumber: round?.round_number ?? 0,
			targetValue: round?.target_value ?? null,
			clue: round?.clue ?? null,
			guesses: new Map(),
			scores: new Map((scoresResult.results ?? []).map((s) => [s.player_id, s.points])),
			lastRoundResults: [],
			settings: {
				customLeftLabel: null,
				customRightLabel: null,
				customPrompt: null
			},
			currentRoundId: round?.id,
			createdAt: room.created_at,
			updatedAt: room.updated_at
		};
		if (activePhase && !round) await this.persistRoomStatus();
	}

	private handleWebSocket(ws: WebSocket, userId?: string) {
		this.wsSet.add(ws);
		if (userId) this.socketUserIds.set(ws, userId);
		ws.accept();

		ws.addEventListener('message', (event) => {
			void this.handleMessage(ws, event.data).catch((err) => {
				this.send(ws, {
					type: 'error',
					message: err instanceof Error ? err.message : 'Live room error.'
				});
			});
		});

		ws.addEventListener('close', () => {
			void this.disconnect(ws);
		});
	}

	private async handleMessage(ws: WebSocket, raw: unknown) {
		const message = JSON.parse(String(raw)) as ClientMessage;
		switch (message.type) {
			case 'join_room':
				await this.joinRoom(ws, message.playerName, message.userId);
				break;
			case 'start_game':
				await this.startGame(ws);
				break;
			case 'submit_clue':
				await this.submitClue(ws, message.clue);
				break;
			case 'update_guess':
				await this.updateGuess(ws, message.value);
				break;
			case 'lock_guess':
				await this.lockGuess(ws);
				break;
			case 'next_round':
				await this.nextRound(ws);
				break;
			case 'reset_game':
				await this.resetGame(ws);
				break;
			case 'update_settings':
				await this.updateSettings(ws, message.settings);
				break;
			case 'kick_player':
				await this.kickPlayer(ws, message.playerId);
				break;
			case 'leave_room':
				await this.disconnect(ws);
				ws.close();
				break;
			default:
				this.send(ws, { type: 'error', message: 'Unknown live room action.' });
		}
	}

	private connectedPlayers() {
		const room = this.requireRoom();
		return room.players.filter((p) => p.connected).sort((a, b) => a.joinOrder - b.joinOrder);
	}

	private async joinRoom(ws: WebSocket, playerName: string, userId?: string) {
		const room = this.requireRoom();
		const cleanName = sanitize(playerName, 'Player', 40);
		const authenticatedUserId = this.socketUserIds.get(ws);
		const claimedUserId = userId ? sanitize(userId, '', 120) : undefined;
		const cleanUserId =
			authenticatedUserId ??
			(claimedUserId && room.players.some((candidate) => candidate.userId === claimedUserId)
				? undefined
				: claimedUserId);
		const existingSocket = this.playerSockets.get(ws);
		if (existingSocket) {
			const existingPlayer = room.players.find((candidate) => candidate.id === existingSocket);
			if (existingPlayer) {
				await this.cancelIdleCleanupIfPending();
				this.send(ws, { type: 'room_snapshot', data: this.publicSnapshot(existingPlayer.id) });
				return;
			}
		}
		let player = cleanUserId
			? room.players.find((candidate) => candidate.userId === cleanUserId)
			: undefined;

		if (!player) {
			const isHost = cleanUserId === room.hostUserId;
			player = {
				id: randomId('player'),
				userId: cleanUserId,
				displayName: cleanName,
				joinOrder: room.players.length,
				connected: true,
				isHost
			};
			room.players.push(player);
			await this.env.DB.prepare(
				'INSERT INTO standpoint_room_players (id, room_id, user_id, display_name, join_order, connected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
				.bind(player.id, room.id, player.userId ?? null, player.displayName, player.joinOrder)
				.run();
		} else {
			player.displayName = cleanName;
			player.connected = true;
			await this.env.DB.prepare(
				'UPDATE standpoint_room_players SET display_name = ?, connected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			)
				.bind(player.displayName, player.id)
				.run();
		}

		if (!room.hostPlayerId && player.userId === room.hostUserId) room.hostPlayerId = player.id;
		this.playerSockets.set(ws, player.id);
		await this.cancelIdleCleanupIfPending();
		this.send(ws, { type: 'room_snapshot', data: this.publicSnapshot(player.id) });
		this.broadcast({
			type: 'player_joined',
			player: { id: player.id, displayName: player.displayName, isHost: Boolean(player.isHost) }
		});
		this.broadcastSnapshots();
	}

	private async startGame(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		const connected = this.connectedPlayers();
		if (connected.length < 2) {
			throw new Error('At least two connected players are required to start.');
		}
		await this.clearScheduledAlarm();
		room.lastRoundResults = [];
		room.psychicHistory = [];
		room.roundNumber = 0;
		room.guesses = new Map();
		room.phase = 'starting';
		await this.persistRoomStatus();
		this.broadcastSnapshots();
		await this.beginRound(true);
	}

	private async beginRound(incrementRound: boolean) {
		const room = this.requireRoom();
		const connected = this.connectedPlayers();
		if (connected.length < 2) {
			room.phase = 'lobby';
			await this.clearScheduledAlarm();
			await this.persistRoomStatus();
			this.broadcastSnapshots();
			return;
		}

		if (incrementRound) room.roundNumber += 1;

		const psychic = connected[(room.roundNumber - 1) % connected.length]!;
		room.psychicIndex = connected.findIndex((p) => p.id === psychic.id);
		room.psychicHistory = [
			...room.psychicHistory.filter((id) =>
				room.players.some((player) => player.id === id && player.connected)
			),
			psychic.id
		];

		const baseCard = await this.randomCard();
		const card = this.applySettingsToCard(baseCard);
		room.spectrum = card;
		room.targetValue = Math.round(Math.random() * 100);
		room.clue = null;
		room.guesses = new Map();
		room.phase = 'psychic_clue';
		room.currentRoundId = randomId('round');
		room.updatedAt = new Date().toISOString();

		await this.env.DB.prepare(
			'INSERT INTO standpoint_rounds (id, room_id, round_number, psychic_id, spectrum_card_id, target_value, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
		)
			.bind(
				room.currentRoundId,
				room.id,
				room.roundNumber,
				psychic.id,
				card.cardId,
				room.targetValue,
				'clue'
			)
			.run();
		await this.persistRoomStatus();

		this.broadcast({ type: 'round_started', psychicId: psychic.id, spectrum: card });
		this.wsSet.forEach((socket) => {
			if (this.playerSockets.get(socket) === psychic.id) {
				this.send(socket, {
					type: 'psychic_assigned',
					psychicId: psychic.id,
					targetValue: room.targetValue
				});
			}
		});
		this.broadcastSnapshots();
	}

	private async randomCard(): Promise<SpectrumCard> {
		const card = await this.env.DB.prepare(
			'SELECT id, left_label, right_label FROM standpoint_spectrum_cards ORDER BY RANDOM() LIMIT 1'
		).first<{ id: string; left_label: string; right_label: string }>();

		if (!card) {
			return { cardId: 'cold-take-hot-take', left: 'cold take', right: 'hot take' };
		}

		return { cardId: card.id, left: card.left_label, right: card.right_label };
	}

	private applySettingsToCard(card: SpectrumCard): SpectrumCard {
		const room = this.requireRoom();
		const { customLeftLabel, customRightLabel } = room.settings;
		if (!customLeftLabel && !customRightLabel) return card;
		const left = customLeftLabel ?? card.left;
		const right = customRightLabel ?? card.right;
		const cardId = customLeftLabel && customRightLabel ? `custom-${room.id}` : card.cardId;
		return { cardId, left, right };
	}

	private async submitClue(ws: WebSocket, clue: string) {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const psychic = this.currentPsychic();
		if (room.phase !== 'psychic_clue' || playerId !== psychic?.id)
			throw new Error('Only the psychic can submit a clue now.');
		if (!this.allow(this.clueLimits, playerId, 5))
			throw new Error('Too many clue submissions. Slow down.');

		const cleanClue = sanitize(clue, '', 200);
		if (!cleanClue || /\d|%|percent/i.test(cleanClue)) {
			throw new Error('Clue must be non-empty and cannot include numbers.');
		}

		room.clue = cleanClue;
		room.phase = 'guessing';
		room.updatedAt = new Date().toISOString();
		await this.env.DB.prepare(
			'UPDATE standpoint_rounds SET clue = ?, clue_submitted_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(cleanClue, 'guessing', room.currentRoundId ?? null)
			.run();
		await this.persistRoomStatus();
		this.broadcast({ type: 'clue_submitted', clue: cleanClue });
		this.broadcastSnapshots();
	}

	private async updateGuess(ws: WebSocket, value: number) {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const psychic = this.currentPsychic();
		const player = room.players.find((candidate) => candidate.id === playerId);
		if (room.phase !== 'guessing') throw new Error('Guessing is not open.');
		if (!player?.connected) throw new Error('You must be connected to guess.');
		if (playerId === psychic?.id) throw new Error('Psychic cannot guess.');
		if (!this.allow(this.guessLimits, playerId, 240))
			throw new Error('Too many guess updates. Slow down.');
		if (!Number.isFinite(value) || value < 0 || value > 100)
			throw new Error('Guess must be between 0 and 100.');

		room.guesses.set(playerId, Math.round(value));
		room.updatedAt = new Date().toISOString();
		this.broadcast({ type: 'guess_updated', playerId, value: room.guesses.get(playerId)! });
		this.broadcastSnapshots();
	}

	/** Host ends guessing: everyone who placed a dial is scored individually, then reveal. */
	private async lockGuess(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		if (room.phase !== 'guessing') throw new Error('Guessing is not open.');
		if (room.targetValue === null) throw new Error('Round target is missing.');
		const psychic = this.currentPsychic();
		const target = room.targetValue;
		const results: GuessRoundEntry[] = [];
		let aggregateGuess = 0;
		let guessers = 0;

		for (const [pid, val] of room.guesses) {
			if (pid === psychic?.id) continue;
			const p = room.players.find((x) => x.id === pid);
			if (!p?.connected) continue;
			const distance = Math.abs(target - val);
			const points = scoreForDistance(distance);
			results.push({
				playerId: pid,
				displayName: p.displayName,
				value: val,
				points,
				distance
			});
			room.scores.set(pid, (room.scores.get(pid) ?? 0) + points);
			aggregateGuess += val;
			guessers += 1;
			await this.env.DB.prepare(
				'INSERT OR REPLACE INTO standpoint_room_scores (room_id, player_id, points, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
			)
				.bind(room.id, pid, room.scores.get(pid) ?? 0)
				.run();
		}

		room.lastRoundResults = results;
		const avgGuess = guessers > 0 ? Math.round(aggregateGuess / guessers) : null;
		room.phase = 'reveal';
		room.updatedAt = new Date().toISOString();

		await this.env.DB.prepare(
			'UPDATE standpoint_rounds SET guess_value = ?, score = ?, revealed_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(avgGuess, 0, 'revealed', room.currentRoundId ?? null)
			.run();
		await this.persistRoomStatus();
		this.broadcast({ type: 'reveal_started', targetValue: room.targetValue });
		this.broadcast({
			type: 'score_updated',
			scores: [...room.scores.entries()].map(([playerId, points]) => ({ playerId, points }))
		});
		this.broadcast({ type: 'round_ended', nextRoundInMs: ROUND_GAP_MS });
		await this.scheduleRoundAdvance('to_scoring');
		this.broadcastSnapshots();
	}

	private async nextRound(ws: WebSocket) {
		this.assertHost(ws);
		await this.clearScheduledAlarm();
		await this.beginRound(true);
	}

	private async resetGame(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		await this.clearScheduledAlarm();
		room.lastRoundResults = [];
		room.psychicHistory = [];
		room.roundNumber = 0;
		room.guesses = new Map();
		room.scores = new Map();
		for (const p of room.players) {
			room.scores.set(p.id, 0);
			await this.env.DB.prepare(
				'INSERT OR REPLACE INTO standpoint_room_scores (room_id, player_id, points, updated_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)'
			)
				.bind(room.id, p.id)
				.run();
		}
		room.spectrum = null;
		room.targetValue = null;
		room.clue = null;
		room.phase = 'lobby';
		await this.persistRoomStatus();
		this.broadcastSnapshots();
	}

	private async kickPlayer(ws: WebSocket, targetId: string) {
		this.assertHost(ws);
		const room = this.requireRoom();
		const hostId = this.requirePlayer(ws);
		const cleanId = sanitize(targetId, '', 120);
		if (!cleanId || cleanId === hostId) throw new Error('Cannot kick that player.');
		const target = room.players.find((p) => p.id === cleanId);
		if (!target) throw new Error('Player not found.');
		if (target.userId === room.hostUserId || target.isHost)
			throw new Error('Cannot remove the host.');

		for (const s of this.wsSet) {
			if (this.playerSockets.get(s) === cleanId) {
				this.playerSockets.delete(s);
				this.socketUserIds.delete(s);
				this.wsSet.delete(s);
				try {
					s.close(4000, 'kicked');
				} catch {
					/* ignore */
				}
				break;
			}
		}

		room.players = room.players.filter((p) => p.id !== cleanId);
		room.guesses.delete(cleanId);
		room.scores.delete(cleanId);
		await this.env.DB.prepare('DELETE FROM standpoint_room_scores WHERE room_id = ? AND player_id = ?')
			.bind(room.id, cleanId)
			.run();
		await this.env.DB.prepare('DELETE FROM standpoint_room_players WHERE id = ?').bind(cleanId).run();

		const psychic = this.currentPsychic();
		if (psychic?.id === cleanId && (room.phase === 'psychic_clue' || room.phase === 'guessing')) {
			await this.beginRound(false);
		}

		this.broadcast({ type: 'player_kicked', playerId: cleanId });
		this.broadcastSnapshots();

		if (this.wsSet.size === 0) void this.scheduleIdleCleanup().catch(() => {});
	}

	private async updateSettings(ws: WebSocket, input: RoomSettingsInput) {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const psychic = this.currentPsychic();
		const host = this.isHost(ws);
		const psychicAxes =
			room.phase === 'psychic_clue' && psychic?.id === playerId && !room.clue;

		if (!host && !psychicAxes) {
			throw new Error('Only the host can change game settings.');
		}

		const next = { ...room.settings };
		if (input.customLeftLabel !== undefined)
			next.customLeftLabel = normalizeSetting(input.customLeftLabel, 40);
		if (input.customRightLabel !== undefined)
			next.customRightLabel = normalizeSetting(input.customRightLabel, 40);
		if (host && input.customPrompt !== undefined)
			next.customPrompt = normalizeSetting(input.customPrompt, 200);

		room.settings = next;
		room.updatedAt = new Date().toISOString();

		if (room.spectrum) {
			room.spectrum = {
				...room.spectrum,
				...(next.customLeftLabel != null ? { left: next.customLeftLabel } : {}),
				...(next.customRightLabel != null ? { right: next.customRightLabel } : {})
			};
		}

		this.broadcast({ type: 'settings_updated', settings: room.settings });
		this.broadcastSnapshots();
	}

	private async disconnect(ws: WebSocket) {
		const room = this.room;
		const playerId = this.playerSockets.get(ws);
		this.wsSet.delete(ws);
		this.playerSockets.delete(ws);
		this.socketUserIds.delete(ws);
		if (!room || !playerId) return;

		const player = room.players.find((candidate) => candidate.id === playerId);
		if (!player) return;

		player.connected = false;
		await this.env.DB.prepare(
			'UPDATE standpoint_room_players SET connected = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(playerId)
			.run();
		this.broadcast({ type: 'player_left', playerId });

		const psychic = this.currentPsychic();
		if (psychic?.id === playerId && (room.phase === 'psychic_clue' || room.phase === 'guessing')) {
			room.psychicHistory = room.psychicHistory.filter((id) => id !== playerId);
			await this.beginRound(false);
		} else {
			this.broadcastSnapshots();
		}

		if (this.room && this.wsSet.size === 0) {
			void this.scheduleIdleCleanup().catch(() => {});
		}
	}

	private allow(map: Map<string, RateBucket>, playerId: string, max: number) {
		const now = Date.now();
		const bucket = map.get(playerId);
		if (!bucket || now - bucket.windowStart >= 60000) {
			map.set(playerId, { windowStart: now, count: 1 });
			return true;
		}
		bucket.count += 1;
		return bucket.count <= max;
	}

	private async persistRoomStatus() {
		const room = this.requireRoom();
		room.updatedAt = new Date().toISOString();
		await this.env.DB.prepare(
			'UPDATE standpoint_rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(room.phase, room.id)
			.run();
	}

	private publicSnapshot(viewerId?: string): PublicRoomState {
		const room = this.requireRoom();
		const psychic = this.currentPsychic();
		const revealVisible = room.phase === 'reveal' || room.phase === 'scoring';
		const psychicVisible =
			viewerId === psychic?.id && (room.phase === 'psychic_clue' || room.phase === 'guessing');

		const guessesObj: Record<string, number> = {};
		for (const [k, v] of room.guesses) guessesObj[k] = v;

		return {
			id: room.id,
			code: room.code,
			hostUserId: viewerId === room.hostPlayerId ? room.hostUserId : '',
			hostPlayerId: room.hostPlayerId,
			visibility: room.visibility,
			phase: room.phase,
			status: room.phase,
			players: room.players.map((player) => {
				const isHost = player.id === room.hostPlayerId || player.userId === room.hostUserId;
				return {
					...player,
					isHost,
					psychicIndex: player.id === psychic?.id ? room.psychicIndex : undefined
				};
			}),
			psychicHistory: room.psychicHistory,
			psychicIndex: room.psychicIndex,
			psychicId: psychic?.id ?? null,
			spectrum: room.spectrum,
			roundNumber: room.roundNumber,
			targetValue: revealVisible || psychicVisible ? room.targetValue : null,
			clue: room.clue,
			guesses: guessesObj,
			scores: [...room.scores.entries()].map(([playerId, points]) => ({ playerId, points })),
			lastRoundResults: room.lastRoundResults,
			settings: room.settings,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt
		};
	}

	private broadcastSnapshots() {
		this.wsSet.forEach((ws) => {
			this.send(ws, {
				type: 'room_snapshot',
				data: this.publicSnapshot(this.playerSockets.get(ws))
			});
		});
	}

	private broadcast(message: unknown) {
		this.wsSet.forEach((ws) => this.send(ws, message));
	}

	private send(ws: WebSocket, msg: unknown) {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
	}

	private requireRoom() {
		if (!this.room) throw new Error('Room is not loaded.');
		return this.room;
	}

	private requirePlayer(ws: WebSocket) {
		const playerId = this.playerSockets.get(ws);
		if (!playerId) throw new Error('Join the room first.');
		return playerId;
	}

	private isHost(ws: WebSocket) {
		const playerId = this.playerSockets.get(ws);
		if (!playerId) return false;
		const room = this.requireRoom();
		const player = room.players.find((candidate) => candidate.id === playerId);
		return Boolean(
			player && (player.id === room.hostPlayerId || player.userId === room.hostUserId)
		);
	}

	private assertHost(ws: WebSocket) {
		this.requirePlayer(ws);
		if (!this.isHost(ws)) throw new Error('Only the host can do that.');
	}

	private currentPsychic() {
		const room = this.requireRoom();
		return room.players.find((player) => player.id === room.psychicHistory.at(-1));
	}
}
