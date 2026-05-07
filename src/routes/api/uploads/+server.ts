import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const bucket = platform?.env?.UPLOADS;
	const db = platform?.env?.DB;
	if (!bucket) throw error(503, 'R2 is not configured');
	if (!db) throw error(503, 'D1 is not configured');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const form = await request.formData();
	const file = form.get('file');
	const folder = String(form.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
	if (!(file instanceof File)) throw error(400, 'Missing file');
	if (file.size > MAX_UPLOAD_BYTES) throw error(413, 'File is too large');
	if (!ALLOWED_TYPES.has(file.type)) throw error(415, 'Unsupported file type');
	const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
	const objectKey = `uploads/${user.uid}/${folder}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
	await bucket.put(objectKey, file, {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream'
		}
	});
	return Response.json({ url: `/api/uploads/${objectKey}`, key: objectKey }, { status: 201 });
};
