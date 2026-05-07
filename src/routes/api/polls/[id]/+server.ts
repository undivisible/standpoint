import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, getSessionUser, mapPoll } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const row = await db
		.prepare('SELECT * FROM polls WHERE id = ?')
		.bind(params.id)
		.first<Record<string, unknown>>();
	return json({ poll: row ? mapPoll(row) : null });
};

export const PATCH: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const body = await request.json().catch(() => ({}));
	const row = await db
		.prepare('SELECT owner, data FROM polls WHERE id = ?')
		.bind(params.id)
		.first<{ owner?: string; data?: string }>();
	if (!row) throw error(404, 'Poll not found');
	if (row.owner !== user.uid) throw error(403, 'Not allowed');
	const data = JSON.stringify({ ...(row?.data ? JSON.parse(row.data) : {}), ...body });
	await db
		.prepare(
			'UPDATE polls SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), visibility = COALESCE(?, visibility), options_json = COALESCE(?, options_json), stats_json = COALESCE(?, stats_json), data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
		.bind(
			body.title ? clean(body.title, '', 180) : null,
			body.description ? clean(body.description, '', 500) : null,
			body.status || null,
			body.visibility || null,
			body.options ? JSON.stringify(body.options) : null,
			body.stats ? JSON.stringify(body.stats) : null,
			data,
			params.id
		)
		.run();
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const row = await db
		.prepare('SELECT owner FROM polls WHERE id = ?')
		.bind(params.id)
		.first<{ owner?: string }>();
	if (!row) throw error(404, 'Poll not found');
	if (row.owner !== user.uid) throw error(403, 'Not allowed');
	await db.prepare('DELETE FROM polls WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
