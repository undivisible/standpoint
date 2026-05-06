import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, mapPoll } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const row = await db
		.prepare('SELECT * FROM polls WHERE id = ?')
		.bind(params.id)
		.first<Record<string, unknown>>();
	return json({ poll: row ? mapPoll(row) : null });
};

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const body = await request.json().catch(() => ({}));
	const row = await db
		.prepare('SELECT data FROM polls WHERE id = ?')
		.bind(params.id)
		.first<{ data?: string }>();
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

export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	await db.prepare('DELETE FROM polls WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
