import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clean, randomId } from '$lib/server/cloudflare-data';

export const POST: RequestHandler = async ({ request, url, platform }) => {
	const bucket = platform?.env?.UPLOADS;
	if (!bucket) throw error(503, 'Cloudflare R2 is required.');
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'File is required.');
	const tierlistId = clean(url.searchParams.get('tierlistId'), 'draft', 160);
	const type = url.searchParams.get('type') === 'banner' ? 'banner' : 'item';
	const ext = file.name.split('.').pop() || 'bin';
	const key = `tierlist-images/${type}_${tierlistId}_${randomId('upload')}.${ext}`;
	await bucket.put(key, file, {
		httpMetadata: { contentType: file.type || 'application/octet-stream' }
	});
	return json({ url: `/api/uploads/${key}` });
};
