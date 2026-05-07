import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ request, params, platform, cookies }) => {
	const rooms = platform?.env?.ROOMS;
	if (!rooms) throw error(503, 'Spectrum rooms require Durable Objects.');
	const db = platform?.env?.DB;
	const user = db ? await getSessionUser(db, cookies) : null;
	const headers = new Headers(request.headers);
	if (user?.uid) headers.set('x-spectrum-user-id', user.uid);
	const authenticatedRequest = new Request(request, { headers });

	const id = rooms.idFromName(params.code.toUpperCase());
	const room = rooms.get(id);
	return room.fetch(authenticatedRequest);
};
