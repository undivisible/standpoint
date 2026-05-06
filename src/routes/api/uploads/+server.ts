import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const bucket = platform?.env?.UPLOADS;
	if (!bucket) throw error(503, 'R2 is not configured');
	const form = await request.formData();
	const file = form.get('file');
	const folder = String(form.get('folder') || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
	if (!(file instanceof File)) throw error(400, 'Missing file');
	const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
	const objectKey = `${folder}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
	await bucket.put(objectKey, file, {
		httpMetadata: {
			contentType: file.type || 'application/octet-stream'
		}
	});
	return Response.json({ url: `/api/uploads/${objectKey}`, key: objectKey }, { status: 201 });
};
