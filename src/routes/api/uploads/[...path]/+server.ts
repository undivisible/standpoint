import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

export const POST: RequestHandler = async ({ request, platform }) => {
	const form = await request.formData();
	const file = form.get('file');
	const folder = String(form.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
	if (!(file instanceof File)) throw error(400, 'Missing file');
	const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
	const objectKey = `${folder}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
	await bucket(platform).put(objectKey, file, {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream'
		}
	});
	return Response.json({ url: `/api/uploads/${objectKey}`, key: objectKey }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	await bucket(platform).delete(key(params));
	return Response.json({ ok: true });
};
