import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || typeof query !== 'string' || query.length > 200) {
		return new Response(JSON.stringify({ error: 'Invalid query' }), { status: 400 });
	}

	const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
	const cx = process.env.GOOGLE_SEARCH_CX;

	if (!apiKey || !cx) {
		return new Response(JSON.stringify({ items: [] }), { status: 200 });
	}

	try {
		const params = new URLSearchParams({
			key: apiKey,
			cx,
			q: query,
			searchType: 'image',
			num: '6'
		});

		const response = await fetch(
			`https://www.googleapis.com/customsearch/v1?${params.toString()}`,
			{ headers: { Accept: 'application/json' } }
		);

		if (!response.ok) {
			return new Response(JSON.stringify({ items: [] }), { status: 200 });
		}

		const data = await response.json();
		const items = (data.items || []).map((item: Record<string, unknown>) => ({
			url: item.link,
			title: item.title,
			thumbnailLink:
				(item.image && (item.image as { thumbnailLink?: string }).thumbnailLink) || item.link
		}));

		return new Response(JSON.stringify({ items }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ items: [] }), { status: 200 });
	}
};
