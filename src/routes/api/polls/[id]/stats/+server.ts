import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const result = await db
		.prepare('SELECT position, position_2d FROM poll_votes WHERE poll_id = ?')
		.bind(params.id)
		.all<{ position: number; position_2d?: string }>();
	const positions = (result.results ?? []).map((vote) => Number(vote.position));
	const average = positions.length
		? positions.reduce((sum, value) => sum + value, 0) / positions.length
		: 0;
	const variance = positions.length
		? positions.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / positions.length
		: 0;
	const stats = {
		vote_positions: positions,
		total_votes: positions.length,
		average,
		std_dev: Math.sqrt(variance)
	};
	await db
		.prepare(
			'UPDATE polls SET stats_json = ?, total_votes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
		.bind(JSON.stringify(stats), positions.length, params.id)
		.run();
	return json({ stats });
};
