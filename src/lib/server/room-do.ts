import type {
	Phase,
	Player,
	PublicRoomState,
	RoomSettings,
	RoomSettingsInput,
	RoomVisibility,
	RoundResult,
	SpectrumCard,
	TeamScores
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
	guessValue: number | null;
	guessPlayerId?: string;
	leftRightGuess: 'left' | 'right' | null;
	leftRightTeam: 0 | 1 | null;
	lockedGuess: number | null;
	teamScores: TeamScores;
	activeTeam: 0 | 1 | null;
	winningTeam: 0 | 1 | null;
	lastRoundResult: RoundResult | null;
	lastDistance: number | null;
	settings: RoomSettings;
	currentRoundId?: string;
	/** Exactly two connected players: psychic alternates each round, the other always guesses. */
	twoPlayerDuel: boolean;
	createdAt: string;
	updatedAt: string;
};

type ClientMessage =
	| { type: 'join_room'; playerName: string; userId?: string }
	| { type: 'start_game' }
	| { type: 'submit_clue'; clue: string }
	| { type: 'update_guess'; value: number }
	| { type: 'lock_guess' }
	| { type: 'submit_left_right'; direction: 'left' | 'right' }
	| { type: 'next_round' }
	| { type: 'reset_game' }
	| { type: 'update_settings'; settings: RoomSettingsInput }
	| { type: 'leave_room' };

type RateBucket = {
	windowStart: number;
	count: number;
};

const SCORE_BANDS = [
	{ distance: 2, points: 4 },
	{ distance: 8, points: 3 },
	{ distance: 16, points: 2 }
];

const WIN_THRESHOLD = 10;
const TEAM_SCORES_KEY = 'team_scores';

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
	private scoringTimer: ReturnType<typeof setTimeout> | null = null;

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

	private async scheduleIdleCleanup() {
		await this.state.storage.setAlarm(Date.now() + this.idleCleanupMs());
	}

	private async cancelIdleCleanup() {
		await this.state.storage.deleteAlarm().catch(() => {});
	}

	async alarm() {
		if (this.wsSet.size > 0) return;
		const room = this.room;
		if (!room) return;
		const id = room.id;
		if (this.scoringTimer) {
			clearTimeout(this.scoringTimer);
			this.scoringTimer = null;
		}
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

		const players: Player[] = (playersResult.results ?? []).map((player) => {
			const isHost = player.user_id === room.host_user_id;
			return {
				id: player.id,
				userId: player.user_id,
				displayName: player.display_name,
				joinOrder: player.join_order,
				connected: false,
				team: (player.join_order % 2) as 0 | 1,
				isHost
			};
		});
		const activePhase =
			room.status === 'psychic_clue' ||
			room.status === 'guessing' ||
			room.status === 'left_right' ||
			room.status === 'reveal' ||
			room.status === 'scoring';
		const restoredPhase = activePhase && !round ? 'lobby' : room.status;
		const psychicIndex = round
			? Math.max(
					0,
					players.findIndex((player) => player.id === round.psychic_id)
				)
			: 0;

		const storedScores = await this.state.storage
			.get<TeamScores>(TEAM_SCORES_KEY)
			.catch(() => undefined);
		const teamScores: TeamScores = storedScores
			? { 0: Number(storedScores[0] ?? 0), 1: Number(storedScores[1] ?? 0) }
			: { 0: 0, 1: 0 };
		const roundNumber = round?.round_number ?? 0;
		const activeTeam = roundNumber > 0 ? (((roundNumber - 1) % 2) as 0 | 1) : null;

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
			roundNumber,
			targetValue: round?.target_value ?? null,
			clue: round?.clue ?? null,
			guessValue: round?.guess_value ?? null,
			leftRightGuess: null,
			leftRightTeam: null,
			lockedGuess: null,
			teamScores,
			activeTeam,
			winningTeam:
				teamScores[0] >= WIN_THRESHOLD
					? 0
					: teamScores[1] >= WIN_THRESHOLD
						? 1
						: null,
			lastRoundResult: null,
			lastDistance:
				round?.guess_value !== null && round?.guess_value !== undefined
					? Math.abs(round.target_value - round.guess_value)
					: null,
			settings: {
				customLeftLabel: null,
				customRightLabel: null,
				customPrompt: null
			},
			currentRoundId: round?.id,
			createdAt: room.created_at,
			updatedAt: room.updated_at,
			twoPlayerDuel: false
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
			case 'submit_left_right':
				await this.submitLeftRight(ws, message.direction);
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
			authenticatedUserId ??
			(claimedUserId && room.players.some((candidate) => candidate.userId === claimedUserId)
				? undefined
				: claimedUserId);
		const existingSocket = this.playerSockets.get(ws);
		if (existingSocket) {
			const existingPlayer = room.players.find((candidate) => candidate.id === existingSocket);
			if (existingPlayer) {
				await this.cancelIdleCleanup();
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
				team: (room.players.length % 2) as 0 | 1,
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
		await this.cancelIdleCleanup();
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
		const connected = room.players.filter((player) => player.connected);
		if (connected.length < 2) {
			throw new Error('At least two connected players are required.');
		}
		const teamA = room.players.filter((player) => player.connected && player.team === 0);
		const teamB = room.players.filter((player) => player.connected && player.team === 1);
		const duel = connected.length === 2;
		if (!duel && (teamA.length < 1 || teamB.length < 1)) {
			throw new Error('Each team needs at least one connected player (or play with exactly two people).');
		}
		room.teamScores = { 0: 0, 1: 0 };
		room.winningTeam = null;
		room.lastRoundResult = null;
		room.psychicHistory = [];
		room.roundNumber = 0;
		await this.persistTeamScores();
		room.phase = 'starting';
		await this.persistRoomStatus();
		this.broadcastSnapshots();
		await this.beginRound(true);
	}

	private async persistTeamScores() {
		const room = this.requireRoom();
		await this.state.storage.put(TEAM_SCORES_KEY, room.teamScores).catch(() => {});
	}

	private async beginRound(incrementRound: boolean) {
		const room = this.requireRoom();
		const connected = room.players
			.filter((player) => player.connected)
			.sort((a, b) => a.joinOrder - b.joinOrder);
		if (connected.length < 2) {
			room.phase = 'lobby';
			room.twoPlayerDuel = false;
			this.broadcastSnapshots();
			return;
		}

		if (incrementRound) room.roundNumber += 1;

		const duel = connected.length === 2;
		room.twoPlayerDuel = duel;

		let psychic: Player;
		if (duel) {
			psychic = connected[(room.roundNumber - 1) % 2]!;
			room.activeTeam = (psychic.team ?? 0) as 0 | 1;
			room.psychicIndex = connected.findIndex((player) => player.id === psychic.id);
			room.psychicHistory = [
				...room.psychicHistory.filter((id) =>
					room.players.some((player) => player.id === id && player.connected)
				),
				psychic.id
			];
		} else {
			const teamA = room.players.filter((player) => player.connected && player.team === 0);
			const teamB = room.players.filter((player) => player.connected && player.team === 1);
			if (teamA.length < 1 || teamB.length < 1) {
				room.phase = 'lobby';
				room.twoPlayerDuel = false;
				this.broadcastSnapshots();
				return;
			}
			const activeTeam: 0 | 1 = (((room.roundNumber - 1) % 2) as 0 | 1);
			room.activeTeam = activeTeam;
			const eligiblePsychics = activeTeam === 0 ? teamA : teamB;
			if (eligiblePsychics.length === 0) {
				room.phase = 'lobby';
				room.twoPlayerDuel = false;
				this.broadcastSnapshots();
				return;
			}
			psychic = this.nextPsychic(eligiblePsychics);
			room.psychicIndex = eligiblePsychics.findIndex((player) => player.id === psychic.id);
			room.psychicHistory = [
				...room.psychicHistory.filter((id) =>
					room.players.some((player) => player.id === id && player.connected)
				),
				psychic.id
			];
		}

		const baseCard = await this.randomCard();
		const card = this.applySettingsToCard(baseCard);
		room.spectrum = card;
		room.targetValue = Math.round(Math.random() * 100);
		room.clue = null;
		room.guessValue = null;
		room.guessPlayerId = undefined;
		room.leftRightGuess = null;
		room.leftRightTeam = null;
		room.lockedGuess = null;
		room.lastRoundResult = null;
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

	private nextPsychic(eligible: Player[]) {
		const room = this.requireRoom();
		return eligible.find((player) => !room.psychicHistory.includes(player.id)) ?? eligible[0];
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
		const connected = room.players.filter((p) => p.connected);
		const duel = connected.length === 2;
		if (room.phase !== 'guessing') throw new Error('Guessing is not open.');
		if (playerId === psychic?.id) throw new Error('Psychic cannot guess.');
		if (duel) {
			const others = connected.filter((p) => p.id !== psychic?.id);
			if (others.length !== 1 || others[0]!.id !== playerId) {
				throw new Error('Only the other player can place the guess.');
			}
		} else if (player?.team !== psychic?.team) {
			throw new Error('Only the psychic team can guess.');
		}
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
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const player = room.players.find((candidate) => candidate.id === playerId);
		const psychic = this.currentPsychic();
		const connected = room.players.filter((p) => p.connected);
		const duel = connected.length === 2;
		if (playerId === psychic?.id) throw new Error('Psychic cannot lock the guess.');
		if (duel) {
			const others = connected.filter((p) => p.id !== psychic?.id);
			if (others.length !== 1 || others[0]!.id !== playerId) {
				throw new Error('Only the other player can lock the guess.');
			}
		} else if (player?.team !== psychic?.team) {
			throw new Error('Only the psychic team can lock the guess.');
		}
		if (room.phase !== 'guessing') throw new Error('There is no active guess to lock.');
		if (room.guessValue === null || !room.guessPlayerId)
			throw new Error('A non-psychic player must submit a guess first.');
		if (room.targetValue === null) throw new Error('Round target is missing.');
		room.lockedGuess = room.guessValue;
		const otherTeamHasPlayer = room.players.some(
			(p) => p.connected && p.team !== null && p.team !== undefined && p.team !== psychic?.team
		);
		room.phase = otherTeamHasPlayer ? 'left_right' : 'reveal';
		await this.env.DB.prepare(
			'UPDATE standpoint_rounds SET guess_value = ?, score = ?, revealed_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(
				room.guessValue,
				0,
				room.phase === 'reveal' ? 'revealed' : 'left_right',
				room.currentRoundId ?? null
			)
			.run();
		await this.persistRoomStatus();
		this.broadcast({ type: 'guess_locked', playerId: room.guessPlayerId, value: room.guessValue });
		if (room.phase === 'reveal') await this.revealRound();
		this.broadcastSnapshots();
	}

	private async submitLeftRight(ws: WebSocket, direction: 'left' | 'right') {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const player = room.players.find((candidate) => candidate.id === playerId);
		const psychic = this.currentPsychic();
		if (room.phase !== 'left_right') throw new Error('Left/right guess is not open.');
		if (!player || player.team === undefined || player.team === null)
			throw new Error('Only a player on the other team can guess left or right.');
		if (player.team === psychic?.team)
			throw new Error('Only the other team can guess left or right.');
		if (direction !== 'left' && direction !== 'right') throw new Error('Choose left or right.');
		room.leftRightGuess = direction;
		room.leftRightTeam = player.team;
		await this.revealRound();
		this.broadcastSnapshots();
	}

	private async revealRound() {
		const room = this.requireRoom();
		if (room.targetValue === null || room.guessValue === null) throw new Error('Round is missing.');
		const psychic = this.currentPsychic();
		const activeTeam: 0 | 1 = ((psychic?.team ?? room.activeTeam ?? 0) as 0 | 1);
		const otherTeam: 0 | 1 = activeTeam === 0 ? 1 : 0;
		const distance = Math.abs(room.targetValue - room.guessValue);
		const points = scoreForDistance(distance);
		const leftRightCorrect =
			room.leftRightGuess !== null &&
			(room.targetValue < room.guessValue ? 'left' : 'right') === room.leftRightGuess;
		const leftRightPoints = leftRightCorrect ? 1 : 0;

		room.phase = 'reveal';
		room.lastDistance = distance;
		room.teamScores[activeTeam] = (room.teamScores[activeTeam] ?? 0) + points;
		if (leftRightPoints > 0) {
			room.teamScores[otherTeam] = (room.teamScores[otherTeam] ?? 0) + leftRightPoints;
		}
		room.lastRoundResult = {
			activeTeam,
			activePoints: points,
			leftRightTeam: room.leftRightTeam,
			leftRightPoints,
			distance
		};
		if (room.teamScores[0] >= WIN_THRESHOLD || room.teamScores[1] >= WIN_THRESHOLD) {
			room.winningTeam =
				room.teamScores[0] === room.teamScores[1]
					? activeTeam
					: room.teamScores[0] > room.teamScores[1]
						? 0
						: 1;
		}

		await this.persistTeamScores();
		await this.env.DB.prepare(
			'UPDATE standpoint_rounds SET score = ?, revealed_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
			.bind(points, 'revealed', room.currentRoundId ?? null)
			.run();
		await this.persistRoomStatus();
		this.broadcast({ type: 'reveal_started', targetValue: room.targetValue });
		this.broadcast({ type: 'score_updated', teamScores: room.teamScores });
		this.scheduleScoring();
	}

	private async nextRound(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		if (room.winningTeam !== null) {
			throw new Error('Game ended. Start a new game to continue.');
		}
		if (this.scoringTimer) clearTimeout(this.scoringTimer);
		this.scoringTimer = null;
		await this.beginRound(true);
	}

	private async resetGame(ws: WebSocket) {
		this.assertHost(ws);
		const room = this.requireRoom();
		if (this.scoringTimer) clearTimeout(this.scoringTimer);
		this.scoringTimer = null;
		room.teamScores = { 0: 0, 1: 0 };
		room.winningTeam = null;
		room.lastRoundResult = null;
		room.psychicHistory = [];
		room.roundNumber = 0;
		room.activeTeam = null;
		room.lockedGuess = null;
		room.guessValue = null;
		room.guessPlayerId = undefined;
		room.leftRightGuess = null;
		room.leftRightTeam = null;
		room.lastDistance = null;
		room.spectrum = null;
		room.targetValue = null;
		room.clue = null;
		room.phase = 'lobby';
		room.twoPlayerDuel = false;
		await this.persistTeamScores();
		await this.persistRoomStatus();
		this.broadcastSnapshots();
	}

	private async updateSettings(ws: WebSocket, input: RoomSettingsInput) {
		const room = this.requireRoom();
		const playerId = this.requirePlayer(ws);
		const psychic = this.currentPsychic();
		const host = this.isHost(ws);
		const psychicAxes =
			room.phase === 'psychic_clue' &&
			psychic?.id === playerId &&
			!room.clue;

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

	private scheduleScoring() {
		if (this.scoringTimer) clearTimeout(this.scoringTimer);
		this.broadcast({ type: 'round_ended', nextRoundInMs: 3000 });
		this.scoringTimer = setTimeout(() => {
			void (async () => {
				const room = this.requireRoom();
				if (room.winningTeam !== null) {
					room.phase = 'ended';
					await this.persistRoomStatus();
					this.broadcastSnapshots();
					return;
				}
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
		const revealVisible =
			room.phase === 'reveal' || room.phase === 'scoring' || room.phase === 'ended';
		const psychicVisible =
			viewerId === psychic?.id && (room.phase === 'psychic_clue' || room.phase === 'guessing');

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
					team: (player.team ?? (player.joinOrder % 2)) as 0 | 1,
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
			guessValue: room.guessValue,
			guessPlayerId: room.guessPlayerId,
			leftRightGuess: revealVisible ? room.leftRightGuess : null,
			leftRightTeam: room.leftRightTeam,
			lockedGuess: room.lockedGuess,
			teamScores: { 0: room.teamScores[0] ?? 0, 1: room.teamScores[1] ?? 0 },
			activeTeam: room.activeTeam,
			winningTeam: room.winningTeam,
			lastRoundResult: room.lastRoundResult,
			lastDistance: room.lastDistance,
			settings: room.settings,
			twoPlayerDuel: room.twoPlayerDuel,
			winThreshold: WIN_THRESHOLD,
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
