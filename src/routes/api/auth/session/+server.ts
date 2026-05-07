import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';
import { SESSION_COOKIE, clearSessionCookie } from '$lib/server/session-cookie';

export const GET: RequestHandler = async ({ platform, cookies }) => {
	const db = platform?.env?.DB;
	const user = db ? await getSessionUser(db, cookies) : null;
	return json({ user });
};

export const DELETE: RequestHandler = async ({ url, platform, cookies }) => {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId && platform?.env?.DB) {
		await platform.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
	}
	clearSessionCookie(cookies, url);
	return json({ ok: true });
};
