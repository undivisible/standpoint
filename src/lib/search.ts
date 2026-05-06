import { apiGet } from './cloudflare-api';
import type { TierlistData, PollData } from './firestore-polls-tierlists.js';

// Search limit
const SEARCH_LIMIT = 20;

// Search Polls
export async function searchTierlists(searchQuery: string): Promise<TierlistData[]> {
	try {
		const data = await apiGet<{ tierlists: TierlistData[] }>(
			`search?type=tierlists&q=${encodeURIComponent(searchQuery)}`
		);
		return data.tierlists.slice(0, SEARCH_LIMIT);
	} catch (error) {
		console.error('Error searching tierlists:', error);
		return [];
	}
}

// Search Polls
export async function searchPolls(searchQuery: string): Promise<PollData[]> {
	try {
		const data = await apiGet<{ polls: PollData[] }>(
			`search?type=polls&q=${encodeURIComponent(searchQuery)}`
		);
		return data.polls.slice(0, SEARCH_LIMIT);
	} catch (error) {
		console.error('Error searching polls:', error);
		return [];
	}
}

// Search users
export async function searchUsers(searchQuery: string): Promise<any[]> {
	try {
		const data = await apiGet<{ users: any[] }>(
			`search?type=users&q=${encodeURIComponent(searchQuery)}`
		);
		return data.users.slice(0, SEARCH_LIMIT);
	} catch (error) {
		console.error('Error searching users:', error);
		return [];
	}
}

/**
 * Get trending/popular search suggestions
 */
export function getSearchSuggestions(): string[] {
	return [
		'movies',
		'anime',
		'games',
		'music',
		'food',
		'sports',
		'best',
		'worst',
		'tier list',
		'ranking',
		'poll',
		'Marvel',
		'Disney',
		'Pokemon',
		'Netflix',
		'TV shows'
	];
}

/**
 * Search across all content types
 */
export async function searchAll(searchQuery: string) {
	const [tierlists, polls, users] = await Promise.all([
		searchTierlists(searchQuery),
		searchPolls(searchQuery),
		searchUsers(searchQuery)
	]);

	return {
		tierlists,
		polls,
		users,
		total: tierlists.length + polls.length + users.length
	};
}
