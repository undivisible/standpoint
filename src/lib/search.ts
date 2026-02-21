import { db } from './firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { TierlistData, PollData } from './firestore-polls-tierlists.js';

// Search limit
const SEARCH_LIMIT = 20;

// Search Polls
export async function searchTierlists(searchQuery: string): Promise<TierlistData[]> {
	try {
		const searchTerm = searchQuery.toLowerCase().slice(0, 200);

		const q = query(collection(db, 'tierlists'), orderBy('created_at', 'desc'), limit(30));

		const snapshot = await getDocs(q);
		const allTierlists = snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data()
		})) as TierlistData[];

		// Client-side filtering for title and description
		return allTierlists
			.filter((tierlist) => {
				const isPublished = !tierlist.status || tierlist.status === 'published';
				if (!isPublished) return false;

				const title = (tierlist.title || '').toLowerCase();
				const description = (tierlist.description || '').toLowerCase();
				return title.includes(searchTerm) || description.includes(searchTerm);
			})
			.slice(0, SEARCH_LIMIT);
	} catch (error) {
		console.error('Error searching tierlists:', error);
		return [];
	}
}

// Search Polls
export async function searchPolls(searchQuery: string): Promise<PollData[]> {
	try {
		const searchTerm = searchQuery.toLowerCase().slice(0, 200);

		const q = query(collection(db, 'polls'), orderBy('created_at', 'desc'), limit(30));

		const snapshot = await getDocs(q);
		const allPolls = snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data()
		})) as PollData[];

		return allPolls
			.filter((poll) => {
				const isPublished = !poll.status || poll.status === 'published';
				if (!isPublished) return false;

				const title = (poll.title || '').toLowerCase();
				const description = (poll.description || '').toLowerCase();
				return title.includes(searchTerm) || description.includes(searchTerm);
			})
			.slice(0, SEARCH_LIMIT);
	} catch (error) {
		console.error('Error searching polls:', error);
		return [];
	}
}

// Search users
export async function searchUsers(searchQuery: string): Promise<any[]> {
	try {
		const searchTerm = searchQuery.toLowerCase().slice(0, 200);

		const q = query(collection(db, 'users'), orderBy('displayName'), limit(30));

		const snapshot = await getDocs(q);
		const allUsers = snapshot.docs.map((doc) => ({
			uid: doc.id,
			...doc.data()
		})) as any[];

		return allUsers
			.filter((user: any) => {
				const displayName = (user.displayName || '').toLowerCase();
				const bio = (user.bio || '').toLowerCase();
				return displayName.includes(searchTerm) || bio.includes(searchTerm);
			})
			.slice(0, SEARCH_LIMIT);
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
