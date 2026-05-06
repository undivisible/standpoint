import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, params }) => {
	const url = new URL(request.url);
	url.pathname = `/api/spectrum/rooms/${encodeURIComponent(params.code)}/ws`;
	throw redirect(308, url);
};
