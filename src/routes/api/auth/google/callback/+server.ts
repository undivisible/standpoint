import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, randomId } from '$lib/server/cloudflare-data';

type GoogleProfile = {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
};

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	const env = platform?.env;
	const db = env?.DB;
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!db || !env?.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !code || !state) {
		throw redirect(302, '/login?error=google-auth-failed');
	}

	const savedState = await db
		.prepare(
			'SELECT redirect_to FROM oauth_states WHERE state = ? AND expires_at > CURRENT_TIMESTAMP'
		)
		.bind(state)
		.first<{ redirect_to?: string }>();
	if (!savedState) throw redirect(302, '/login?error=google-auth-expired');

	await db.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

	const redirectUri = `${url.origin}/api/auth/google/callback`;
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			code,
			grant_type: 'authorization_code',
			redirect_uri: redirectUri
		})
	});
	if (!tokenResponse.ok) throw redirect(302, '/login?error=google-token-failed');
	const token = (await tokenResponse.json()) as { access_token?: string };
	if (!token.access_token) throw redirect(302, '/login?error=google-token-missing');

	const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
		headers: { authorization: `Bearer ${token.access_token}` }
	});
	if (!profileResponse.ok) throw redirect(302, '/login?error=google-profile-failed');
	const profile = (await profileResponse.json()) as GoogleProfile;
	if (!profile.sub) throw redirect(302, '/login?error=google-profile-invalid');

	const existing = await db
		.prepare(
			"SELECT uid FROM users WHERE json_extract(data, '$.provider') = ? AND json_extract(data, '$.providerSub') = ?"
		)
		.bind('google', profile.sub)
		.first<{ uid: string }>();
	const userId = existing?.uid ?? randomId('user');
	const userData = JSON.stringify({
		displayName: clean(profile.name, 'Spectrum user', 120),
		photoURL: profile.picture || '',
		provider: 'google',
		providerSub: profile.sub
	});
	if (existing) {
		await db
			.prepare(
				'UPDATE users SET email = ?, display_name = ?, photo_url = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE uid = ?'
			)
			.bind(
				clean(profile.email, '', 240) || null,
				clean(profile.name, 'Spectrum user', 120),
				profile.picture || null,
				userData,
				userId
			)
			.run();
	} else {
		await db
			.prepare(
				'INSERT INTO users (uid, email, display_name, photo_url, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				userId,
				clean(profile.email, '', 240) || null,
				clean(profile.name, 'Spectrum user', 120),
				profile.picture || null,
				userData
			)
			.run();
	}

	const sessionId = randomId('session');
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
	await db
		.prepare(
			'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
		)
		.bind(sessionId, userId, expiresAt)
		.run();
	cookies.set('spectrum_session', sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 30 * 24 * 60 * 60
	});

	throw redirect(302, savedState.redirect_to || '/');
};
