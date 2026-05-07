import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, getSessionUser, mapPoll, randomId } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const limit = Math.min(Number(url.searchParams.get('limit') || 100), 100);
	const result = await db
		.prepare(
			"SELECT * FROM polls WHERE status = 'published' AND visibility = 'public' ORDER BY created_at DESC LIMIT ?"
		)
		.bind(limit)
		.all();
	return json({ polls: ((result.results ?? []) as Record<string, unknown>[]).map(mapPoll) });
};

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	const body = await request.json().catch(() => ({}));
	const id = randomId('poll');
	const owner = user?.uid ?? null;
	const title = clean(body.title || body.question, 'Untitled poll', 180);
	const options = body.options || body.customOptions || [];
	const stats = body.stats || { average: 0, std_dev: 0, total_votes: 0, vote_positions: [] };
	await db
		.prepare(
			'INSERT INTO polls (id, title, description, owner, response_type, options_json, stats_json, visibility, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
		)
		.bind(
			id,
			title,
			clean(body.description, '', 500) || null,
			owner,
			Number(body.response_type || body.responseType || 2),
			JSON.stringify(options),
			JSON.stringify(stats),
			body.visibility === 'private' || body.visibility === 'unlisted' ? body.visibility : 'public',
			body.status === 'draft' ? 'draft' : 'published',
			JSON.stringify(body)
		)
		.run();
	return json({ id }, { status: 201 });
};
