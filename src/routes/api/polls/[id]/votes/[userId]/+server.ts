import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const row = await db
		.prepare('SELECT position, position_2d FROM poll_votes WHERE poll_id = ? AND user_id = ?')
		.bind(params.id, params.userId)
		.first<{ position: number; position_2d?: string }>();
	return json({
		vote: row
			? {
					position: row.position,
					position_2d: row.position_2d ? JSON.parse(row.position_2d) : undefined
				}
			: null
	});
};
