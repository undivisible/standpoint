import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	const user = db ? await getSessionUser(db, cookies) : null;
	return json({ user });
};

export const DELETE: RequestHandler = async ({ platform, cookies }) => {
	const sessionId = cookies.get('spectrum_session');
	if (sessionId && platform?.env?.DB) {
		await platform.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
	}
	cookies.delete('spectrum_session', { path: '/' });
	return json({ ok: true });
};
