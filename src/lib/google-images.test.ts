import { describe, expect, it } from 'vitest';
import { buildOpenverseImageSearchUrl, mapOpenverseImageResults } from './google-images';

describe('openverse image search', () => {
	it('builds an anonymous Openverse image search URL', () => {
		expect(buildOpenverseImageSearchUrl('best cats').toString()).toBe(
			'https://api.openverse.engineering/v1/images/?q=best+cats&page_size=6&license_type=commercial%2Cmodification'
		);
	});

	it('maps Openverse image results with attribution data', () => {
		expect(
			mapOpenverseImageResults({
				results: [
					{
						title: 'Cat',
						url: 'https://example.com/cat.jpg',
						thumbnail: 'https://example.com/thumb.jpg',
						foreign_landing_url: 'https://example.com/cat',
						creator: 'Photographer',
						license: 'by',
						license_url: 'https://creativecommons.org/licenses/by/4.0/'
					}
				]
			})
		).toEqual([
			{
				url: 'https://example.com/cat.jpg',
				title: 'Cat',
				thumbnailLink: 'https://example.com/thumb.jpg',
				link: 'https://example.com/cat',
				snippet: 'Photographer · by',
				creator: 'Photographer',
				license: 'by',
				licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
			}
		]);
	});
});
