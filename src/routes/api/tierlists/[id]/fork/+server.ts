import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, mapTierlist, randomId } from '$lib/server/cloudflare-data';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const body = await request.json().catch(() => ({}));
	const source = await db
		.prepare('SELECT * FROM tierlists WHERE id = ?')
		.bind(params.id)
		.first<Record<string, unknown>>();
	if (!source) throw error(404, 'Tierlist not found.');
	const tierlist = mapTierlist(source);
	const id = randomId('tierlist');
	await db
		.prepare(
			'INSERT INTO tierlists (id, title, description, owner, status, visibility, list_type, tiers_json, items_json, placements_json, banner_image, is_forked, original_id, is_guest, data, created_at, updated_at, last_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
		)
		.bind(
			id,
			String(tierlist.title || 'Untitled tierlist') + ' (Fork)',
			typeof tierlist.description === 'string' ? tierlist.description : null,
			clean(body.userId, 'anonymous', 160),
			'published',
			'public',
			(tierlist as any).list_type || 'classic',
			JSON.stringify(tierlist.tiers || []),
			JSON.stringify(tierlist.items || []),
			JSON.stringify((tierlist as any).item_placements || []),
			tierlist.banner_image || null,
			params.id,
			JSON.stringify({ ...tierlist, originalId: params.id, isForked: true })
		)
		.run();
	return json({ id });
};
