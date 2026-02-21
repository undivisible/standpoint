import { resultImages, imageSearchLoading, currentUser, type ImageResult } from './stores';
import { get } from 'svelte/store';
import { loadResultFromStorage, saveResultToStorage } from './storage';

// Search for images related to the query using server-side API proxy
export async function searchForImages(query: string): Promise<ImageResult[]> {
	try {
		// Require authenticated user
		const user = get(currentUser);
		if (!user) {
			resultImages.set([]);
			return [];
		}
		imageSearchLoading.set(true);

		// Check network status first (only in browser environment)
		if (typeof window !== 'undefined' && !navigator.onLine) {
			const cachedResult = await loadResultFromStorage(query);
			if (cachedResult && cachedResult.images) {
				resultImages.set(cachedResult.images);
				imageSearchLoading.set(false);
				return cachedResult.images;
			}
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}

		// Use server-side proxy (API key stays on server)
		const response = await fetch(
			`/api/search-images?q=${encodeURIComponent(query)}`,
			{ headers: { Accept: 'application/json' } }
		);

		if (!response.ok) {
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}

		const data = await response.json();

		let images: ImageResult[] = [];
		if (data.items && data.items.length > 0) {
			images = data.items;
			resultImages.set(images);
			await saveResultToStorage(query, images);
		} else {
			resultImages.set([]);
		}
		imageSearchLoading.set(false);
		return images;
	} catch {
		// Try to load from cache as fallback
		try {
			const cachedResult = await loadResultFromStorage(query);
			if (cachedResult && cachedResult.images) {
				resultImages.set(cachedResult.images);
				imageSearchLoading.set(false);
				return cachedResult.images;
			}
		} catch {
			// Cache also failed
		}
		const fallbackImages = generateFallbackImages(query);
		resultImages.set(fallbackImages);
		imageSearchLoading.set(false);
		return fallbackImages;
	} finally {
		imageSearchLoading.set(false);
	}
}

// Generate fallback images when Google Search API is not available
function generateFallbackImages(query: string): ImageResult[] {
	const fallbackImages: ImageResult[] = [];

	const imageServices = [
		{
			name: 'Unsplash',
			getUrl: (q: string, size: string) =>
				`https://source.unsplash.com/${size}/?${encodeURIComponent(q)}&sig=${Math.floor(Math.random() * 1000)}`
		},
		{
			name: 'Picsum',
			getUrl: (_q: string, size: string) => {
				const [width, height] = size.split('x');
				const id = Math.floor(Math.random() * 1000) + 1;
				return `https://picsum.photos/id/${id}/${width}/${height}`;
			}
		},
		{
			name: 'Lorem Picsum',
			getUrl: (q: string, size: string) => {
				const [width, height] = size.split('x');
				const seed = encodeURIComponent(q) + Math.floor(Math.random() * 100);
				return `https://picsum.photos/seed/${seed}/${width}/${height}`;
			}
		}
	];

	// Create diverse queries for better image variety
	const imageQueries = [query, `${query} concept`, `${query} abstract`];

	imageQueries.forEach((searchQuery, index) => {
		const service = imageServices[index % imageServices.length];
		const imageUrl = service.getUrl(searchQuery, '800x600');
		const thumbnailUrl = service.getUrl(searchQuery, '400x300');

		fallbackImages.push({
			url: imageUrl,
			title: `${query} - ${service.name} Image ${index + 1}`,
			thumbnailLink: thumbnailUrl
		});
	});

	return fallbackImages;
}
