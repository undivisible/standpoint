import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform, cookies }) => {
	const sessionId = cookies.get('spectrum_session');
	if (sessionId && platform?.env?.DB) {
		await platform.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
	}
	cookies.delete('spectrum_session', { path: '/' });
	return json({ ok: true });
};
