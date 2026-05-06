import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mapTierlist } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const result = await db
		.prepare(
			"SELECT * FROM tierlists WHERE owner = ? AND status = 'draft' ORDER BY updated_at DESC"
		)
		.bind(params.id)
		.all();
	return json({ drafts: ((result.results ?? []) as Record<string, unknown>[]).map(mapTierlist) });
};
