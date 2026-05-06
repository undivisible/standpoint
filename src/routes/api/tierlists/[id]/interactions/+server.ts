import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const likes = await db
		.prepare(
			"SELECT COUNT(*) AS count FROM likes WHERE content_type = 'tierlist' AND content_id = ?"
		)
		.bind(params.id)
		.first<{ count: number }>();
	const comments = await db
		.prepare(
			"SELECT COUNT(*) AS count FROM comments WHERE content_type = 'tierlist' AND content_id = ?"
		)
		.bind(params.id)
		.first<{ count: number }>();
	const forks = await db
		.prepare('SELECT COUNT(*) AS count FROM tierlists WHERE original_id = ?')
		.bind(params.id)
		.first<{ count: number }>();
	return json({
		likes: likes?.count ?? 0,
		comments: comments?.count ?? 0,
		forks: forks?.count ?? 0
	});
};
