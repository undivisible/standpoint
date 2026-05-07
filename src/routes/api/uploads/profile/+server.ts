import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser, randomId } from '$lib/server/cloudflare-data';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const POST: RequestHandler = async ({ request, url, platform, cookies }) => {
	const bucket = platform?.env?.UPLOADS;
	const db = platform?.env?.DB;
	if (!bucket) throw error(503, 'Cloudflare R2 is required.');
	if (!db) throw error(503, 'Cloudflare D1 is required.');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'File is required.');
	if (file.size > MAX_UPLOAD_BYTES) throw error(413, 'File is too large');
	if (!ALLOWED_TYPES.has(file.type)) throw error(415, 'Unsupported file type');
	const type = url.searchParams.get('type') === 'banner' ? 'banner' : 'avatar';
	const ext = file.name.split('.').pop() || 'bin';
	const key = `profile-images/${user.uid}/${type}_${randomId('upload')}.${ext}`;
	await bucket.put(key, file, {
		httpMetadata: { contentType: file.type || 'application/octet-stream' }
	});
	return json({ url: `/api/uploads/${key}` });
};
