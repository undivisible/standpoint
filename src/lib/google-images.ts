// please change your provider already ts pmo
import { resultImages, imageSearchLoading, currentUser, type ImageResult } from './stores';
import { get } from 'svelte/store';
import { loadResultFromStorage, saveResultToStorage } from './storage';

// API Keys
const GOOGLE_SEARCH_API_KEY = import.meta.env?.VITE_GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = import.meta.env?.VITE_GOOGLE_SEARCH_CX;
const OPENVERSE_IMAGE_SEARCH_URL = 'https://api.openverse.engineering/v1/images/';

type OpenverseImage = {
	title?: string;
	url?: string;
	thumbnail?: string;
	foreign_landing_url?: string;
	creator?: string;
	license?: string;
	license_url?: string;
};

type OpenverseImageResponse = {
	results?: OpenverseImage[];
};

export function buildOpenverseImageSearchUrl(query: string) {
	const url = new URL(OPENVERSE_IMAGE_SEARCH_URL);
	url.searchParams.set('q', query);
	url.searchParams.set('page_size', '6');
	url.searchParams.set('license_type', 'commercial,modification');
	return url;
}

export function mapOpenverseImageResults(data: OpenverseImageResponse): ImageResult[] {
	return (data.results || [])
		.filter((item) => item.url)
		.map((item) => ({
			url: String(item.url),
			title: item.title || 'Openverse image',
			thumbnailLink: item.thumbnail || String(item.url),
			link: item.foreign_landing_url,
			snippet: [item.creator, item.license].filter(Boolean).join(' · '),
			creator: item.creator,
			license: item.license,
			licenseUrl: item.license_url
		}));
}

// Search for images related to the query using Google Custom Search API
export async function searchForImages(query: string): Promise<ImageResult[]> {
	try {
		// Require authenticated user
		const user = get(currentUser);
		if (!user) {
			console.warn('Image search blocked: user not signed in');
			resultImages.set([]);
			return [];
		}
		imageSearchLoading.set(true);

		// Check network status first (only in browser environment)
		if (typeof window !== 'undefined') {
			try {
				if (!navigator.onLine) {
					const cachedResult = await loadResultFromStorage(query);
					if (cachedResult && cachedResult.images) {
						resultImages.set(cachedResult.images);
						imageSearchLoading.set(false);
						return cachedResult.images;
					}
					throw new Error('No internet connection');
				}
			} catch (error) {
				console.warn('Network status check failed, proceeding with search:', error);
				// Continue with search even if network check fails
			}
		}

		const response = await fetch(buildOpenverseImageSearchUrl(query), {
			headers: { Accept: 'application/json' }
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Openverse image search error ${response.status}:`, errorText);

			// Try to parse error details
			try {
				const errorJson = JSON.parse(errorText);
				if (errorJson.error) {
					console.error('API Error details:', errorJson.error);
				}
			} catch {
				console.warn('Could not parse error response as JSON');
			}

			console.warn(`Image search API error: ${response.status} - using fallback images`);
			// Use fallback images when API fails
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}

		const data = await response.json();

		const images = mapOpenverseImageResults(data);
		if (images.length > 0) {
			resultImages.set(images);
			await saveResultToStorage(query, images);
		} else {
			resultImages.set([]);
		}
		imageSearchLoading.set(false);
		return images;
	} catch (error) {
		console.warn('Error searching for images:', error);

		// Try to load from cache as fallback
		try {
			const cachedResult = await loadResultFromStorage(query);
			if (cachedResult && cachedResult.images) {
				resultImages.set(cachedResult.images);
				imageSearchLoading.set(false);
				return cachedResult.images;
			} else {
				console.warn('No cached images found, generating fallback images.');
				const fallbackImages = generateFallbackImages(query);
				resultImages.set(fallbackImages);
				imageSearchLoading.set(false);
				return fallbackImages;
			}
		} catch (cacheError) {
			console.warn('Failed to load images from cache:', cacheError);
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}
	} finally {
		imageSearchLoading.set(false);
	}
}

// Generate fallback images when Google Search API is not available
function generateFallbackImages(query: string): ImageResult[] {
	const fallbackImages: ImageResult[] = [];

	const imageServices = [
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
