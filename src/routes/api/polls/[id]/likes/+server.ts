import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean } from '$lib/server/cloudflare-data';

async function count(db: D1Database, pollId: string) {
	const row = await db
		.prepare("SELECT COUNT(*) AS count FROM likes WHERE content_type = 'poll' AND content_id = ?")
		.bind(pollId)
		.first<{ count: number }>();
	await db
		.prepare('UPDATE polls SET likes = ? WHERE id = ?')
		.bind(row?.count ?? 0, pollId)
		.run();
	return row?.count ?? 0;
}

export const GET: RequestHandler = async ({ params, url, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const userId = url.searchParams.get('userId') || '';
	const row = userId
		? await db
				.prepare(
					"SELECT 1 FROM likes WHERE content_type = 'poll' AND content_id = ? AND user_id = ?"
				)
				.bind(params.id, userId)
				.first()
		: null;
	return json({ liked: Boolean(row), likes: await count(db, params.id) });
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const body = await request.json().catch(() => ({}));
	const userId = clean(body.userId, 'anonymous', 160);
	await db
		.prepare(
			"INSERT OR IGNORE INTO likes (content_type, content_id, user_id) VALUES ('poll', ?, ?)"
		)
		.bind(params.id, userId)
		.run();
	return json({ liked: true, likes: await count(db, params.id) });
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const body = await request.json().catch(() => ({}));
	await db
		.prepare("DELETE FROM likes WHERE content_type = 'poll' AND content_id = ? AND user_id = ?")
		.bind(params.id, clean(body.userId, 'anonymous', 160))
		.run();
	return json({ liked: false, likes: await count(db, params.id) });
};
