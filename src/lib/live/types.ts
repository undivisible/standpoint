export type LiveClientMessage =
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

export type LiveServerMessage =
	| { type: 'room_snapshot'; data: PublicRoomState }
	| { type: 'player_joined'; player: { id: string; displayName: string; isHost: boolean } }
	| { type: 'player_left'; playerId: string }
	| { type: 'round_started'; psychicId: string; spectrum: SpectrumCard }
	| { type: 'psychic_assigned'; psychicId: string; targetValue: number }
	| { type: 'clue_submitted'; clue: string }
	| { type: 'guess_updated'; playerId: string; value: number }
	| { type: 'guess_locked'; playerId: string; value: number }
	| { type: 'reveal_started'; targetValue: number }
	| { type: 'score_updated'; teamScores: TeamScores }
	| { type: 'round_ended'; nextRoundInMs: number }
	| { type: 'settings_updated'; settings: RoomSettings }
	| { type: 'error'; message: string };

export type LiveMessageType = LiveServerMessage['type'];

export type Phase =
	| 'lobby'
	| 'starting'
	| 'psychic_clue'
	| 'guessing'
	| 'left_right'
	| 'reveal'
	| 'scoring'
	| 'ended';

export type RoomVisibility = 'private' | 'public';

export type Player = {
	id: string;
	userId?: string;
	displayName: string;
	joinOrder: number;
	connected: boolean;
	team?: 0 | 1 | null;
	psychicIndex?: number;
	isHost?: boolean;
};

export type TeamScores = { 0: number; 1: number };

export type RoundResult = {
	activeTeam: 0 | 1;
	activePoints: number;
	leftRightTeam: 0 | 1 | null;
	leftRightPoints: number;
	distance: number;
};

export type SpectrumCard = {
	left: string;
	right: string;
	cardId: string;
};

export type RoomSettings = {
	customLeftLabel: string | null;
	customRightLabel: string | null;
	customPrompt: string | null;
};

export type RoomSettingsInput = {
	customLeftLabel?: string | null;
	customRightLabel?: string | null;
	customPrompt?: string | null;
};

export type ScoreEntry = {
	playerId: string;
	points: number;
};

export type PublicRoomState = {
	id: string;
	code: string;
	hostUserId: string;
	hostPlayerId?: string;
	visibility: RoomVisibility;
	phase: Phase;
	status: Phase;
	players: Player[];
	psychicHistory: string[];
	psychicIndex: number;
	psychicId: string | null;
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
	/** True when exactly two players are connected: psychic alternates, the other guesses. */
	twoPlayerDuel?: boolean;
	winThreshold: number;
	createdAt: string;
	updatedAt: string;
};

export type CreateRoomResponse = {
	room: {
		id: string;
		code: string;
		host: string;
		visibility: RoomVisibility;
		status: Phase;
		players: Player[];
	};
};

export type PublicRoomListEntry = {
	id: string;
	code: string;
	hostUserId: string;
	visibility: RoomVisibility;
	status: Phase;
	playerCount: number;
	createdAt: string;
	updatedAt: string;
};

export type PublicRoomListResponse = {
	rooms: PublicRoomListEntry[];
};
