import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, getSessionUser, mapTierlist, randomId } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ platform, url }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
	const result = await db
		.prepare(
			"SELECT * FROM tierlists WHERE status = 'published' AND visibility = 'public' AND is_guest = 0 ORDER BY created_at DESC LIMIT ?"
		)
		.bind(limit)
		.all();
	return json({
		tierlists: ((result.results ?? []) as Record<string, unknown>[]).map(mapTierlist)
	});
};

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const body = await request.json().catch(() => ({}));
	const id = randomId('tierlist');
	const owner = user.uid;
	const title = clean(body.title, 'Untitled tierlist', 180);
	const isGuest = false;
	await db
		.prepare(
			'INSERT INTO tierlists (id, title, description, owner, status, visibility, list_type, tiers_json, items_json, placements_json, banner_image, is_forked, original_id, is_guest, data, created_at, updated_at, last_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
		)
		.bind(
			id,
			title,
			clean(body.description, '', 500) || null,
			owner,
			body.status === 'draft' ? 'draft' : 'published',
			body.visibility === 'private' || body.visibility === 'unlisted' ? body.visibility : 'public',
			body.list_type || body.type || 'classic',
			JSON.stringify(body.tiers || []),
			JSON.stringify(body.items || []),
			JSON.stringify(body.item_placements || body.placements || []),
			body.banner_image || body.bannerImage || null,
			body.isForked ? 1 : 0,
			body.originalId || null,
			isGuest ? 1 : 0,
			JSON.stringify(body)
		)
		.run();
	return json({ id }, { status: 201 });
};
