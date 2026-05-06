import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CreateRoomResponse, PublicRoomListResponse, RoomVisibility } from '$lib/live/types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomId(prefix: string) {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function roomCode() {
	let code = '';
	for (let i = 0; i < 6; i += 1) {
		code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
	}
	return code;
}

function clean(value: unknown, fallback: string, max = 80) {
	return String(value || fallback)
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s._-]/gu, '')
		.trim()
		.slice(0, max);
}

function cleanVisibility(value: unknown): RoomVisibility {
	return value === 'public' ? 'public' : 'private';
}

export const GET: RequestHandler = async ({ platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Spectrum rooms require Cloudflare D1.');

	const result = await db
		.prepare(
			"SELECT r.id, r.code, r.host_user_id, r.visibility, r.status, r.created_at, r.updated_at, COUNT(p.id) AS player_count FROM standpoint_rooms r LEFT JOIN standpoint_room_players p ON p.room_id = r.id AND p.connected = 1 WHERE r.visibility = 'public' AND r.status = 'lobby' GROUP BY r.id ORDER BY r.updated_at DESC LIMIT 50"
		)
		.all<{
			id: string;
			code: string;
			host_user_id: string;
			visibility: RoomVisibility;
			status: PublicRoomListResponse['rooms'][number]['status'];
			created_at: string;
			updated_at: string;
			player_count: number;
		}>();

	const response: PublicRoomListResponse = {
		rooms: (result.results ?? []).map((room) => ({
			id: room.id,
			code: room.code,
			hostUserId: room.host_user_id,
			visibility: room.visibility,
			status: room.status,
			playerCount: room.player_count,
			createdAt: room.created_at,
			updatedAt: room.updated_at
		}))
	};

	return json(response);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Spectrum rooms require Cloudflare D1.');

	const body = await request.json().catch(() => ({}));
	const roomId = randomId('room');
	const hostUserId = clean(body.userId, `host_${roomId}`, 120);
	const hostName = clean(body.playerName, 'Host', 40);
	const visibility = cleanVisibility(body.visibility);
	let code = roomCode();

	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			await db
				.prepare(
					'INSERT INTO standpoint_rooms (id, code, host_user_id, visibility, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
				)
				.bind(roomId, code, hostUserId, visibility, 'lobby')
				.run();
			break;
		} catch (err) {
			if (attempt === 4) throw err;
			code = roomCode();
		}
	}

	const playerId = randomId('player');
	await db
		.prepare(
			'INSERT INTO standpoint_room_players (id, room_id, user_id, display_name, join_order, connected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
		)
		.bind(playerId, roomId, hostUserId, hostName, 0)
		.run();

	await db
		.prepare(
			'INSERT OR REPLACE INTO standpoint_room_scores (room_id, player_id, points, updated_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)'
		)
		.bind(roomId, playerId)
		.run();

	const response: CreateRoomResponse = {
		room: {
			id: roomId,
			code,
			host: hostUserId,
			visibility,
			status: 'lobby',
			players: [
				{
					id: playerId,
					userId: hostUserId,
					displayName: hostName,
					joinOrder: 0,
					connected: true,
					isHost: true
				}
			]
		}
	};

	return json(response);
};
