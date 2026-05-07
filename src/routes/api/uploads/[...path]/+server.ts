import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function bucket(platform: App.Platform | undefined) {
	if (!platform?.env?.UPLOADS) throw error(503, 'R2 is not configured');
	return platform.env.UPLOADS;
}

function key(params: { path?: string }) {
	const value = params.path || '';
	if (!value || value.includes('..')) throw error(400, 'Invalid upload key');
	return value;
}

export const GET: RequestHandler = async ({ params, platform }) => {
	const object = await bucket(platform).get(key(params));
	if (!object) throw error(404, 'Upload not found');
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	return new Response(object.body, { headers });
};

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
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
	await bucket(platform).put(objectKey, file, {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream'
		}
	});
	return Response.json({ url: `/api/uploads/${objectKey}`, key: objectKey }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, platform, cookies }) => {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'D1 is not configured');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const objectKey = key(params);
	if (
		!objectKey.startsWith(`uploads/${user.uid}/`) &&
		!objectKey.startsWith(`profile-images/${user.uid}/`) &&
		!objectKey.startsWith(`tierlist-images/${user.uid}/`)
	) {
		throw error(403, 'Not allowed');
	}
	await bucket(platform).delete(objectKey);
	return Response.json({ ok: true });
};
