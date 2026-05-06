import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomId } from '$lib/server/cloudflare-data';

export const GET: RequestHandler = async ({ url, platform, cookies }) => {
	const env = platform?.env;
	if (!env?.GOOGLE_CLIENT_ID) throw redirect(302, '/login?error=google-auth-not-configured');

	const state = randomId('state');
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

	if (env.DB) {
		await env.DB.prepare(
			'INSERT INTO oauth_states (state, verifier, redirect_to, expires_at, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
		)
			.bind(state, '', redirectTo, expiresAt)
			.run();
	} else {
		cookies.set('spectrum_oauth_state', state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 600
		});
	}

	const callback = `${url.origin}/api/auth/google/callback`;
	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
	authUrl.searchParams.set('redirect_uri', callback);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', 'openid email profile');
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('prompt', 'select_account');

	throw redirect(302, authUrl.toString());
};
