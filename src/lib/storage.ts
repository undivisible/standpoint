import type { ImageResult } from './stores';

interface CachedResult {
	images: ImageResult[];
	timestamp: number;
}

const CACHE_KEY_PREFIX = 'image_search_';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

/**
 * Loads a cached result from localStorage for the given query.
 * @param query
 * @returns
 */
export async function loadResultFromStorage(query: string): Promise<CachedResult | null> {
	try {
		const cacheKey = CACHE_KEY_PREFIX + encodeURIComponent(query);
		const cached = localStorage.getItem(cacheKey);

		if (!cached) {
			return null;
		}

		const result: CachedResult = JSON.parse(cached);

		if (Date.now() - result.timestamp > CACHE_DURATION) {
			localStorage.removeItem(cacheKey);
			return null;
		}

		return result;
	} catch (error) {
		console.warn('Failed to load cached results:', error);
		return null;
	}
}

export async function saveResultToStorage(query: string, images: ImageResult[]): Promise<void> {
	try {
		const cacheKey = CACHE_KEY_PREFIX + encodeURIComponent(query);
		const result: CachedResult = {
			images,
			timestamp: Date.now()
		};

		localStorage.setItem(cacheKey, JSON.stringify(result));
	} catch (error) {
		console.warn('Failed to save results to cache:', error);
	}
}

async function uploadFile(
	endpoint: string,
	file: File,
	onProgress?: (progress: number) => void
): Promise<string> {
	const form = new FormData();
	form.set('file', file);
	if (onProgress) onProgress(5);
	const response = await fetch(endpoint, { method: 'POST', body: form });
	if (!response.ok) throw new Error(await response.text());
	if (onProgress) onProgress(100);
	const data = await response.json();
	return data.url;
}

export async function uploadProfileImage(
	file: File,
	userId: string,
	type: 'avatar' | 'banner' = 'avatar',
	onProgress?: (progress: number) => void
): Promise<string> {
	return uploadFile(
		`/api/uploads/profile?userId=${encodeURIComponent(userId)}&type=${type}`,
		file,
		onProgress
	);
}

export async function deleteProfileImage(imageUrl: string): Promise<void> {
	await fetch(imageUrl, { method: 'DELETE' }).catch(() => {});
}

export async function uploadTierlistImage(
	file: File,
	tierlistId: string,
	type: 'banner' | 'item' = 'item',
	onProgress?: (progress: number) => void
): Promise<string> {
	return uploadFile(
		`/api/uploads/tierlists?tierlistId=${encodeURIComponent(tierlistId)}&type=${type}`,
		file,
		onProgress
	);
}
