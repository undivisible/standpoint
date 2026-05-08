import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PublicRoomState, RoomVisibility } from '$lib/live/types';
import { getSessionUser } from '$lib/server/cloudflare-data';

function clean(value: unknown, fallback: string, max = 80) {
	return String(value || fallback)
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s._-]/gu, '')
		.trim()
		.slice(0, max);
}

function randomId(prefix: string) {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function roomSnapshot(db: D1Database, code: string): Promise<PublicRoomState> {
	const room = await db
		.prepare(
			'SELECT id, code, host_user_id, visibility, status, created_at, updated_at FROM standpoint_rooms WHERE code = ?'
		)
		.bind(code.toUpperCase())
		.first<{
			id: string;
			code: string;
			host_user_id: string;
			visibility?: RoomVisibility;
			status: PublicRoomState['phase'];
			created_at: string;
			updated_at: string;
		}>();

	if (!room) throw error(404, 'Room not found.');

	const playersResult = await db
		.prepare(
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

	const players = (playersResult.results ?? []).map((player) => {
		const isHost = player.user_id === room.host_user_id;
		return {
			id: player.id,
			userId: player.user_id,
			displayName: player.display_name,
			joinOrder: player.join_order,
			connected: Boolean(player.connected),
			team: (player.join_order % 2) as 0 | 1,
			isHost
		};
	});
	const hostPlayerId = players.find((player) => player.userId === room.host_user_id)?.id;
	return {
		id: room.id,
		code: room.code,
		hostUserId: '',
		hostPlayerId,
		visibility: room.visibility ?? 'private',
		phase: room.status,
		status: room.status,
		players,
		psychicHistory: [],
		psychicIndex: 0,
		psychicId: null,
		spectrum: null,
		roundNumber: 0,
		targetValue: null,
		clue: null,
		guessValue: null,
		leftRightGuess: null,
		leftRightTeam: null,
		lockedGuess: null,
		teamScores: { 0: 0, 1: 0 },
		activeTeam: null,
		winningTeam: null,
		lastRoundResult: null,
		lastDistance: null,
		settings: {
			customLeftLabel: null,
			customRightLabel: null,
			customPrompt: null
		},
		winThreshold: 10,
		createdAt: room.created_at,
		updatedAt: room.updated_at
	};
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Spectrum rooms require Cloudflare D1.');
	return json(await roomSnapshot(db, params.code));
};

export const POST: RequestHandler = async ({ request, params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Spectrum rooms require Cloudflare D1.');
	const user = await getSessionUser(db, cookies);

	const body = await request.json().catch(() => ({}));
	const room = await db
		.prepare('SELECT id FROM standpoint_rooms WHERE code = ?')
		.bind(params.code.toUpperCase())
		.first<{ id: string }>();

	if (!room) throw error(404, 'Room not found.');

	const playerName = clean(body.playerName, 'Player', 40);
	const claimedUserId = body.userId ? clean(body.userId, '', 120) : undefined;
	const matchingClaimedPlayer = claimedUserId
		? await db
				.prepare('SELECT id FROM standpoint_room_players WHERE room_id = ? AND user_id = ?')
				.bind(room.id, claimedUserId)
				.first<{ id: string }>()
		: null;
	const userId =
		user?.uid ??
		(matchingClaimedPlayer || claimedUserId?.startsWith('user_') ? undefined : claimedUserId);
	const existing = userId
		? await db
				.prepare('SELECT id FROM standpoint_room_players WHERE room_id = ? AND user_id = ?')
				.bind(room.id, userId)
				.first<{ id: string }>()
		: null;

	if (existing) {
		await db
			.prepare(
				'UPDATE standpoint_room_players SET display_name = ?, connected = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			)
			.bind(playerName, existing.id)
			.run();
	} else {
		const order = await db
			.prepare(
				'SELECT COALESCE(MAX(join_order), -1) + 1 AS next_order FROM standpoint_room_players WHERE room_id = ?'
			)
			.bind(room.id)
			.first<{ next_order: number }>();

		await db
			.prepare(
				'INSERT INTO standpoint_room_players (id, room_id, user_id, display_name, join_order, connected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(randomId('player'), room.id, userId ?? null, playerName, order?.next_order ?? 0)
			.run();
	}

	return json(await roomSnapshot(db, params.code));
};
