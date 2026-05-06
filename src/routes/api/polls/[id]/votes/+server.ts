import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean } from '$lib/server/cloudflare-data';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const body = await request.json().catch(() => ({}));
	const userId = clean(body.userId, 'anonymous', 160);
	const position = Number(body.position);
	if (!Number.isFinite(position)) throw error(400, 'Invalid vote.');
	await db
		.prepare(
			'INSERT OR REPLACE INTO poll_votes (poll_id, user_id, position, position_2d, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
		)
		.bind(params.id, userId, position, body.position2D ? JSON.stringify(body.position2D) : null)
		.run();
	return json({ ok: true });
};
