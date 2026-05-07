import type {
	Phase,
	Player,
	PublicRoomState,
	RoomVisibility,
	ScoreEntry,
	SpectrumCard
} from '$lib/live/types';

type Env = {
	DB: D1Database;
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
	guessValue: number | null;
	guessPlayerId?: string;
	lockedGuess: number | null;
	scores: Map<string, number>;
	lastRoundPoints: ScoreEntry[];
	lastDistance: number | null;
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
	| { type: 'leave_room' };

type RateBucket = {
	windowStart: number;
	count: number;
};

const SCORE_BANDS = [
	{ distance: 4, points: 4 },
	{ distance: 8, points: 3 },
	{ distance: 14, points: 2 },
	{ distance: 22, points: 1 }
];

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
	private scoringTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env
	) {}

	async fetch(request: Request) {
		const url = new URL(request.url);
		const code = url.pathname.split('/').filter(Boolean).at(-2)?.toUpperCase() ?? '';
		await this.ensureRoom(code);

		if (url.pathname.endsWith('/ws')) {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
			this.handleWebSocket(server, request.headers.get('x-spectrum-user-id') ?? undefined);
			return new Response(null, { status: 101, webSocket: client });
		}

		return Response.json(this.publicSnapshot());
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

		const players = (playersResult.results ?? []).map((player) => ({
			id: player.id,
			userId: player.user_id,
			displayName: player.display_name,
			joinOrder: player.join_order,
			connected: false,
			isHost: player.user_id === room.host_user_id
		}));
		const activePhase =
			room.status === 'psychic_clue' ||
			room.status === 'guessing' ||
			room.status === 'reveal' ||
			room.status === 'scoring';
		const restoredPhase = activePhase && !round ? 'lobby' : room.status;
		const psychicIndex = round
			? Math.max(
					0,
					players.findIndex((player) => player.id === round.psychic_id)
				)
			: 0;

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
			guessValue: round?.guess_value ?? null,
			lockedGuess: null,
			scores: new Map((scoresResult.results ?? []).map((score) => [score.player_id, score.points])),
			lastRoundPoints: [],
			lastDistance:
				round?.guess_value !== null && round?.guess_value !== undefined
					? Math.abs(round.target_value - round.guess_value)
					: null,
			currentRoundId: round?.id,
			createdAt: room.created_at,
			updatedAt: room.updated_at
		};
		if (activePhase && !round) await this.persistRoomStatus();
		if (
			(restoredPhase === 'reveal' || restoredPhase === 'scoring') &&
			this.room.guessValue !== null
		) {
			this.room.lockedGuess = this.room.guessValue;
		}
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
			case 'leave_room':
				await this.disconnect(ws);
				ws.close();
				break;
			default:
				this.send(ws, { type: 'error', message: 'Unknown live room action.' });
		}
	}

	private async joinRoom(ws: WebSocket, playerName: string, userId?: string) {
		const room = this.requireRoom();
		const cleanName = sanitize(playerName, 'Player', 40);
		const authenticatedUserId = this.socketUserIds.get(ws);
		const claimedUserId = userId ? sanitize(userId, '', 120) : undefined;
		const cleanUserId =
			authenticatedUserId ?? (claimedUserId?.startsWith('user_') ? undefined : claimedUserId);
		const existingSocket = this.playerSockets.get(ws);
		if (existingSocket) {
			const existingPlayer = room.players.find((candidate) => candidate.id === existingSocket);
			if (existingPlayer) {
				this.send(ws, { type: 'room_snapshot', data: this.publicSnapshot(existingPlayer.id) });
				return;
			}
		}
		let player = cleanUserId
			? room.players.find((candidate) => candidate.userId === cleanUserId)
			: undefined;

		if (!player) {
			player = {
				id: randomId('player'),
				userId: cleanUserId,
				displayName: cleanName,
				joinOrder: room.players.length,
				connected: true,
				isHost: cleanUserId === room.hostUserId
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
		if (room.players.filter((player) => player.connected).length < 2) {
			throw new Error('At least two connected players are required.');
		}
		room.phase = 'starting';
		await this.persistRoomStatus();
		this.broadcastSnapshots();
		await this.beginRound(true);
	}

	private async beginRound(incrementRound: boolean) {
		const room = this.requireRoom();
		const activePlayers = room.players.filter((player) => player.connected);
		if (activePlayers.length < 2) {
			room.phase = 'lobby';
			this.broadcastSnapshots();
			return;
		}

		if (incrementRound) room.roundNumber += 1;
		const psychic = this.nextPsychic(activePlayers);
		const card = await this.randomCard();
		room.psychicIndex = activePlayers.findIndex((player) => player.id === psychic.id);
		room.psychicHistory = [
			...room.psychicHistory.filter((id) => activePlayers.some((player) => player.id === id)),
			psychic.id
		];
		if (room.psychicHistory.length >= activePlayers.length) room.psychicHistory = [psychic.id];
		room.spectrum = card;
		room.targetValue = Math.round(Math.random() * 100);
		room.clue = null;
		room.guessValue = null;
		room.guessPlayerId = undefined;
		room.lockedGuess = null;
		room.lastRoundPoints = [];
		room.lastDistance = null;
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

	private nextPsychic(activePlayers: Player[]) {
		const room = this.requireRoom();
		return (
			activePlayers.find((player) => !room.psychicHistory.includes(player.id)) ?? activePlayers[0]
		);
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

	private async submitClue(ws: WebSocket, clue: string) {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const psychic = this.currentPsychic();
		if (room.phase !== 'psychic_clue' || playerId !== psychic?.id)
			throw new Error('Only the psychic can submit a clue now.');
		if (!this.allow(this.clueLimits, playerId, 5))
			throw new Error('Too many clue submissions. Slow down.');

		const cleanClue = sanitize(clue, '', 200);
		if (!cleanClue || /^\d+(\.\d+)?$/.test(cleanClue)) {
			throw new Error('Clue must be non-empty and not purely numeric.');
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
		if (room.phase !== 'guessing') throw new Error('Guessing is not open.');
		if (playerId === psychic?.id) throw new Error('Psychic cannot guess.');
		if (!this.allow(this.guessLimits, playerId, 240))
			throw new Error('Too many guess updates. Slow down.');
		if (!Number.isFinite(value) || value < 0 || value > 100)
			throw new Error('Guess must be between 0 and 100.');

		room.guessValue = Math.round(value);
		room.guessPlayerId = playerId;
		room.updatedAt = new Date().toISOString();
		this.broadcast({ type: 'guess_updated', playerId, value: room.guessValue });
		this.broadcastSnapshots();
	}

	private async lockGuess(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		if (room.phase !== 'guessing') throw new Error('There is no active guess to lock.');
		if (room.guessValue === null || !room.guessPlayerId)
			throw new Error('A non-psychic player must submit a guess first.');
		if (room.targetValue === null) throw new Error('Round target is missing.');

		const distance = Math.abs(room.targetValue - room.guessValue);
		const points = scoreForDistance(distance);
		const psychic = this.currentPsychic();
		const scoringPlayers = room.players.filter(
			(player) => player.connected && player.id !== psychic?.id
		);
		room.lockedGuess = room.guessValue;
		room.phase = 'reveal';
		room.lastDistance = distance;
		room.lastRoundPoints = scoringPlayers.map((player) => ({ playerId: player.id, points }));

		for (const entry of room.lastRoundPoints) {
			room.scores.set(entry.playerId, (room.scores.get(entry.playerId) ?? 0) + entry.points);
			await this.env.DB.prepare(
				'INSERT OR REPLACE INTO standpoint_room_scores (room_id, player_id, points, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
			)
				.bind(room.id, entry.playerId, room.scores.get(entry.playerId) ?? 0)
				.run();
		}

		await this.env.DB.prepare(
			'UPDATE standpoint_rounds SET guess_value = ?, score = ?, revealed_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(room.guessValue, points, 'revealed', room.currentRoundId ?? null)
			.run();
		await this.persistRoomStatus();
		this.broadcast({ type: 'guess_locked', playerId: room.guessPlayerId, value: room.guessValue });
		this.broadcast({ type: 'reveal_started', targetValue: room.targetValue });
		this.broadcast({
			type: 'score_updated',
			scores: [...room.scores.entries()].map(([playerId, points]) => ({ playerId, points }))
		});
		this.broadcastSnapshots();
		this.scheduleScoring();
	}

	private async nextRound(ws: WebSocket) {
		this.assertHost(ws);
		if (this.scoringTimer) clearTimeout(this.scoringTimer);
		this.scoringTimer = null;
		await this.beginRound(true);
	}

	private scheduleScoring() {
		if (this.scoringTimer) clearTimeout(this.scoringTimer);
		this.broadcast({ type: 'round_ended', nextRoundInMs: 3000 });
		this.scoringTimer = setTimeout(() => {
			void (async () => {
				const room = this.requireRoom();
				room.phase = 'scoring';
				await this.persistRoomStatus();
				this.broadcastSnapshots();
				this.scoringTimer = setTimeout(() => {
					void this.beginRound(true);
				}, 3000);
			})();
		}, 3000);
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
		const controllingHostId = this.controllingHostId();
		const revealVisible =
			room.phase === 'reveal' || room.phase === 'scoring' || room.phase === 'ended';
		const psychicVisible =
			viewerId === psychic?.id && (room.phase === 'psychic_clue' || room.phase === 'guessing');

		return {
			id: room.id,
			code: room.code,
			hostUserId: room.hostUserId,
			hostPlayerId: room.hostPlayerId,
			visibility: room.visibility,
			phase: room.phase,
			status: room.phase,
			players: room.players.map((player) => ({
				...player,
				isHost:
					player.id === room.hostPlayerId ||
					player.userId === room.hostUserId ||
					player.id === controllingHostId,
				psychicIndex: player.id === psychic?.id ? room.psychicIndex : undefined
			})),
			psychicHistory: room.psychicHistory,
			psychicIndex: room.psychicIndex,
			psychicId: psychic?.id ?? null,
			spectrum: room.spectrum,
			roundNumber: room.roundNumber,
			targetValue: revealVisible || psychicVisible ? room.targetValue : null,
			clue: room.clue,
			guessValue: room.guessValue,
			guessPlayerId: room.guessPlayerId,
			lockedGuess: room.lockedGuess,
			scores: [...room.scores.entries()].map(([playerId, points]) => ({ playerId, points })),
			lastRoundPoints: room.lastRoundPoints,
			lastDistance: room.lastDistance,
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

	private assertHost(ws: WebSocket) {
		const playerId = this.requirePlayer(ws);
		const room = this.requireRoom();
		const player = room.players.find((candidate) => candidate.id === playerId);
		if (
			!player ||
			(player.id !== room.hostPlayerId &&
				player.userId !== room.hostUserId &&
				player.id !== this.controllingHostId())
		) {
			throw new Error('Only the host can do that.');
		}
	}

	private controllingHostId() {
		const room = this.requireRoom();
		const stableHost = room.players.find(
			(player) => player.id === room.hostPlayerId || player.userId === room.hostUserId
		);
		if (!stableHost || stableHost.connected) return stableHost?.id;
		return room.players.find((player) => player.connected)?.id;
	}

	private currentPsychic() {
		const room = this.requireRoom();
		return room.players.find((player) => player.id === room.psychicHistory.at(-1));
	}
}
