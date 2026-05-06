export type AppUser = {
	id: string;
	uid: string;
	email?: string | null;
	displayName?: string | null;
	photoURL?: string | null;
	bannerURL?: string | null;
	preferences?: Record<string, any>;
};

async function parse(response: Response) {
	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || response.statusText);
	}
	if (response.status === 204) return null;
	return response.json();
}

export async function apiGet<T>(path: string): Promise<T> {
	return parse(await fetch(`/api/cloudflare/${path}`)) as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
	return parse(
		await fetch(`/api/cloudflare/${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	) as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
	return parse(
		await fetch(`/api/cloudflare/${path}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	) as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
	return parse(await fetch(`/api/cloudflare/${path}`, { method: 'DELETE' })) as Promise<T>;
}

export async function uploadFile(
	file: Blob,
	folder: string,
	name?: string,
	onProgress?: (progress: number) => void
): Promise<string> {
	const form = new FormData();
	form.set('folder', folder);
	form.set('file', file, name || (file instanceof File ? file.name : 'upload.bin'));
	const result = await parse(
		await fetch('/api/uploads', {
			method: 'POST',
			body: form
		})
	);
	if (onProgress) onProgress(100);
	return (result as { url: string }).url;
}

export async function getSessionUser(): Promise<AppUser | null> {
	const response = await parse(await fetch('/api/auth/session'));
	return (response as { user: AppUser | null }).user;
}
