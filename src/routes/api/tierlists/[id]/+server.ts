import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, getSessionUser, mapTierlist } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const row = await db
		.prepare('SELECT * FROM tierlists WHERE id = ?')
		.bind(params.id)
		.first<Record<string, unknown>>();
	return json({ tierlist: row ? mapTierlist(row) : null });
};

export const PATCH: RequestHandler = async ({ params, request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const body = await request.json().catch(() => ({}));
	const row = await db
		.prepare('SELECT owner, data FROM tierlists WHERE id = ?')
		.bind(params.id)
		.first<{ owner?: string; data?: string }>();
	if (!row) throw error(404, 'Tierlist not found');
	if (row.owner !== user.uid) throw error(403, 'Not allowed');
	const data = JSON.stringify({ ...(row?.data ? JSON.parse(row.data) : {}), ...body });
	await db
		.prepare(
			'UPDATE tierlists SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), visibility = COALESCE(?, visibility), tiers_json = COALESCE(?, tiers_json), items_json = COALESCE(?, items_json), placements_json = COALESCE(?, placements_json), banner_image = COALESCE(?, banner_image), data = ?, updated_at = CURRENT_TIMESTAMP, last_edited = CURRENT_TIMESTAMP WHERE id = ?'
		)
		.bind(
			body.title ? clean(body.title, '', 180) : null,
			body.description ? clean(body.description, '', 500) : null,
			body.status || null,
			body.visibility || null,
			body.tiers ? JSON.stringify(body.tiers) : null,
			body.items ? JSON.stringify(body.items) : null,
			body.item_placements || body.placements
				? JSON.stringify(body.item_placements || body.placements)
				: null,
			body.banner_image || body.bannerImage || null,
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
		.prepare('SELECT owner FROM tierlists WHERE id = ?')
		.bind(params.id)
		.first<{ owner?: string }>();
	if (!row) throw error(404, 'Tierlist not found');
	if (row.owner !== user.uid) throw error(403, 'Not allowed');
	await db.prepare('DELETE FROM tierlists WHERE id = ?').bind(params.id).run();
	return json({ ok: true });
};
