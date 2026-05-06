import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser, jsonParse } from '$lib/server/cloudflare-data';

export const PATCH: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required.');
	const body = await request.json().catch(() => ({}));
	const row = await db
		.prepare('SELECT data FROM preferences WHERE user_id = ?')
		.bind(user.uid)
		.first<{ data?: string }>();
	const existing = jsonParse(row?.data, {});
	const preferences = { ...existing, ...body };
	if (body.themeAccents && typeof body.themeAccents === 'object') {
		preferences.themeAccents = {
			...(existing as any).themeAccents,
			...body.themeAccents
		};
	}
	await db
		.prepare(
			'INSERT OR REPLACE INTO preferences (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
		)
		.bind(user.uid, JSON.stringify(preferences))
		.run();
	await db
		.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE uid = ?')
		.bind(user.uid)
		.run();
	return json({ preferences });
};
