import { searchTierlists, searchPolls, searchUsers } from '$lib/search';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const type = url.searchParams.get('type') || 'all';

	if (!query.trim()) {
		return {
			query: '',
			type,
			tierlists: [],
			polls: [],
			users: []
		};
	}

	try {
		// Perform searches based on type filter
		const results = await Promise.all([
			type === 'all' || type === 'tierlists' ? searchTierlists(query.trim()) : Promise.resolve([]),
			type === 'all' || type === 'polls' ? searchPolls(query.trim()) : Promise.resolve([]),
			type === 'all' || type === 'users' ? searchUsers(query.trim()) : Promise.resolve([])
		]);

		return {
			query: query.trim(),
			type,
			tierlists: results[0],
			polls: results[1],
			users: results[2]
		};
	} catch (error) {
		console.error('Search error:', error);
		return {
			query: query.trim(),
			type,
			tierlists: [],
			polls: [],
			users: []
		};
	}
};
