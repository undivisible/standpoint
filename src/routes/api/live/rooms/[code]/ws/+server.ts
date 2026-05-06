import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	const rooms = platform?.env?.ROOMS;
	if (!rooms) throw error(503, 'Live rooms require Durable Objects.');

	const id = rooms.idFromName(params.code.toUpperCase());
	const room = rooms.get(id);
	return room.fetch(request);
};
