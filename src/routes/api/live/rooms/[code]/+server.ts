import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function spectrumUrl(request: Request, code: string) {
	const url = new URL(request.url);
	url.pathname = `/api/spectrum/rooms/${encodeURIComponent(code)}`;
	return url;
}

export const GET: RequestHandler = ({ request, params }) => {
	throw redirect(308, spectrumUrl(request, params.code));
};

export const POST: RequestHandler = ({ request, params }) => {
	throw redirect(308, spectrumUrl(request, params.code));
};
