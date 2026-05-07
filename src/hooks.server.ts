import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	if (event.request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
		return response;
	}

	// Add security headers
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.google.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: blob: https: http:",
			"connect-src 'self' wss: https://*.googleapis.com https://*.google.com https://accounts.google.com https://oauth2.googleapis.com https://openidconnect.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
			"frame-src 'self' https://www.google.com",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'",
			'upgrade-insecure-requests'
		].join('; ')
	);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), interest-cohort=()'
	);
	response.headers.set('X-XSS-Protection', '1; mode=block');

	return response;
};
