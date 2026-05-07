import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'spectrum_session';

export function sessionCookieSetOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: 30 * 24 * 60 * 60,
		...(url.hostname === 'standpoint.undivisible.dev' ||
		url.hostname.endsWith('.standpoint.undivisible.dev')
			? { domain: 'standpoint.undivisible.dev' }
			: {})
	};
}

export function sessionCookieDeleteOptions(url: URL) {
	return {
		path: '/',
		...(url.hostname === 'standpoint.undivisible.dev' ||
		url.hostname.endsWith('.standpoint.undivisible.dev')
			? { domain: 'standpoint.undivisible.dev' }
			: {})
	};
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
	cookies.delete(SESSION_COOKIE, sessionCookieDeleteOptions(url));
	if (url.hostname.endsWith('.undivisible.dev') && url.hostname !== 'standpoint.undivisible.dev') {
		cookies.delete(SESSION_COOKIE, { path: '/', domain: '.undivisible.dev' });
	}
}
