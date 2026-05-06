import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function spectrumUrl(request: Request) {
	const url = new URL(request.url);
	url.pathname = '/api/spectrum/rooms';
	return url;
}

export const GET: RequestHandler = ({ request }) => {
	throw redirect(308, spectrumUrl(request));
};

export const POST: RequestHandler = ({ request }) => {
	throw redirect(308, spectrumUrl(request));
};
