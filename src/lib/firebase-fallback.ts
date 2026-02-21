import { db } from './firebase';
import {
	collection,
	doc,
	addDoc,
	getDoc,
	getDocs,
	updateDoc,
	deleteDoc,
	query,
	orderBy,
	limit,
	where,
	increment,
	serverTimestamp
} from 'firebase/firestore';
import type {
	PollCreate,
	PollResponse,
	VoteCreate,
	TierListCreate,
	TierListResponse,
	TierListUpdate,
	ItemPlacement
} from './types';

// Fallback implementation for when the Python backend is unavailable
export class FirebaseFallbackClient {
	// Health check
	async healthCheck() {
		return { status: 'ok', backend: 'firebase' };
	}

	// Polls API with Firebase
	async getPolls(): Promise<PollResponse[]> {
		try {
			const pollsCollection = collection(db, 'polls');
			const pollsQuery = query(pollsCollection, orderBy('created_at', 'desc'), limit(50));
			const snapshot = await getDocs(pollsQuery);

			return snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					title: data.title,
					description: data.description,
					response_type: data.response_type || 1,
					options: data.options || [],
					stats: {
						average: data.stats?.average || 0,
						std_dev: data.stats?.std_dev || 0,
						total_votes: data.stats?.total_votes || 0,
						vote_positions: data.stats?.vote_positions || [],
						vote_positions_2d: data.stats?.vote_positions_2d || [],
						average_2d: data.stats?.average_2d
					},
					user_vote: data.user_vote,
					created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
					owner: data.owner || 'anonymous',
					gradients: data.gradients
				} as PollResponse;
			});
		} catch (error) {
			console.error('Firebase polls fetch failed:', error);
			return [];
		}
	}

	async getPoll(id: string): Promise<PollResponse> {
		try {
			const pollDoc = await getDoc(doc(db, 'polls', id));

			if (!pollDoc.exists()) {
				throw new Error('Poll not found');
			}

			const data = pollDoc.data();

			return {
				id: pollDoc.id,
				title: data.title,
				description: data.description,
				response_type: data.response_type || 1,
				options: data.options || [],
				stats: {
					average: data.stats?.average || 0,
					std_dev: data.stats?.std_dev || 0,
					total_votes: data.stats?.total_votes || 0,
					vote_positions: data.stats?.vote_positions || [],
					vote_positions_2d: data.stats?.vote_positions_2d || [],
					average_2d: data.stats?.average_2d
				},
				user_vote: data.user_vote,
				created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				owner: data.owner || 'anonymous',
				gradients: data.gradients
			} as PollResponse;
		} catch (error) {
			console.error('Firebase poll fetch failed:', error);
			throw error;
		}
	}

	async createPoll(poll: PollCreate): Promise<PollResponse> {
		try {
			const pollData = {
				...poll,
				stats: {
					average: 0,
					std_dev: 0,
					total_votes: 0,
					vote_positions: [],
					vote_positions_2d: []
				},
				created_at: serverTimestamp()
			};

			const docRef = await addDoc(collection(db, 'polls'), pollData);

			return {
				id: docRef.id,
				title: poll.title,
				description: poll.description,
				response_type: poll.response_type,
				options: poll.options,
				stats: {
					average: 0,
					std_dev: 0,
					total_votes: 0,
					vote_positions: [],
					vote_positions_2d: []
				},
				created_at: new Date().toISOString(),
				owner: 'anonymous'
			} as PollResponse;
		} catch (error) {
			console.error('Firebase poll creation failed:', error);
			throw error;
		}
	}

	async vote(pollId: string, position: number, additionalData?: any): Promise<PollResponse> {
		try {
			const pollRef = doc(db, 'polls', pollId);
			const pollDoc = await getDoc(pollRef);

			if (!pollDoc.exists()) {
				throw new Error('Poll not found');
			}

			const pollData = pollDoc.data();
			const currentVotes = pollData.stats?.vote_positions || [];
			const newVotes = [...currentVotes, position];
			const currentVotes2D = (pollData.stats?.vote_positions_2d || []) as {
				x: number;
				y: number;
			}[];
			const userVote2D = (additionalData?.position_2d as { x: number; y: number } | null) || null;
			const newVotes2D = userVote2D ? [...currentVotes2D, userVote2D] : currentVotes2D;

			const totalVotes = newVotes.length;
			const average = newVotes.reduce((sum, vote) => sum + vote, 0) / totalVotes;
			const variance =
				newVotes.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) / totalVotes;
			const stdDev = Math.sqrt(variance);
			let average2D = pollData.stats?.average_2d || null;
			if (newVotes2D.length > 0) {
				const avgX =
					newVotes2D.reduce((sum: number, pos: { x: number; y: number }) => sum + pos.x, 0) /
					newVotes2D.length;
				const avgY =
					newVotes2D.reduce((sum: number, pos: { x: number; y: number }) => sum + pos.y, 0) /
					newVotes2D.length;
				average2D = [avgX, avgY];
			}

			const newStats = {
				average,
				std_dev: stdDev,
				total_votes: totalVotes,
				vote_positions: newVotes,
				vote_positions_2d: newVotes2D,
				average_2d: average2D
			};

			await updateDoc(pollRef, {
				stats: newStats
			});

			return {
				id: pollId,
				title: pollData.title,
				description: pollData.description,
				response_type: pollData.response_type || 1,
				options: pollData.options || [],
				stats: newStats,
				user_vote: position,
				user_vote_2d: userVote2D,
				created_at: pollData.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				owner: pollData.owner || 'anonymous',
				gradients: pollData.gradients
			} as PollResponse;
		} catch (error) {
			console.error('Firebase vote failed:', error);
			throw error;
		}
	}

	async deletePoll(pollId: string): Promise<void> {
		try {
			const pollRef = doc(db, 'polls', pollId);
			await deleteDoc(pollRef);
		} catch (error) {
			console.error('Firebase poll deletion failed:', error);
			throw error;
		}
	}

	// Tier Lists API with Firebase
	async getTierLists(): Promise<TierListResponse[]> {
		try {
			const tierListsCollection = collection(db, 'tierlists');
			const tierListsQuery = query(tierListsCollection, orderBy('created_at', 'desc'), limit(50));
			const snapshot = await getDocs(tierListsQuery);

			return snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					title: data.title,
					description: data.description,
					list_type: data.list_type || 'classic',
					tiers: data.tiers || [],
					items: data.items || [],
					created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
					updated_at: data.updated_at?.toDate?.()?.toISOString() || new Date().toISOString(),
					owner: data.owner || 'anonymous',
					redirectUids: data.redirectUids || [],
					item_placements: data.item_placements || [],
					likes: data.likes || 0,
					comments: data.comments || 0,
					forks: data.forks || 0,
					banner_image: data.banner_image || null,
					isForked: data.isForked || false,
					originalId: data.originalId || null,
					author: data.author || data.owner_displayName
				} as TierListResponse;
			});
		} catch (error) {
			console.error('Firebase tier lists fetch failed:', error);
			return [];
		}
	}

	async getTierList(id: string): Promise<TierListResponse> {
		try {
			const tierListDoc = await getDoc(doc(db, 'tierlists', id));

			if (!tierListDoc.exists()) {
				throw new Error('Tier list not found');
			}

			const data = tierListDoc.data();

			let owner_displayName: string | undefined = undefined;
			if (data.owner) {
				try {
					const userDoc = await getDoc(doc(db, 'users', data.owner));
					if (userDoc.exists()) {
						const userData = userDoc.data();
						owner_displayName = userData.displayName || undefined;
					}
				} catch (e) {
					console.warn('Could not fetch owner displayName:', e);
				}
			}

			// Ensure items preserve their position data
			const items = (data.items || []).map((item: any) => ({
				...item,
				position: item.position || null,
				size: item.size || null
			}));

			const result = {
				id: tierListDoc.id,
				title: data.title || '',
				description: data.description || '',
				list_type: data.list_type || 'classic',
				tiers: data.tiers || [],
				items,
				created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				updated_at: data.updated_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				owner: data.owner || 'anonymous',
				owner_displayName,
				redirectUids: data.redirectUids || [],
				item_placements: data.item_placements || [],
				likes: data.likes || 0,
				comments: data.comments || 0,
				forks: data.forks || 0,
				banner_image: data.banner_image || null,
				isForked: data.isForked || false,
				originalId: data.originalId || null,
				author: data.author || owner_displayName
			} as TierListResponse;

			return result;
		} catch (error) {
			console.error('Firebase getTierList error:', error);
			throw error;
		}
	}

	async createTierList(tierList: TierListCreate): Promise<TierListResponse> {
		try {
			const tierListData = {
				...tierList,
				created_at: serverTimestamp(),
				updated_at: serverTimestamp(),
				likes: 0,
				comments: 0,
				forks: 0
			};

			const docRef = await addDoc(collection(db, 'tierlists'), tierListData);

			return {
				id: docRef.id,
				title: tierList.title,
				description: tierList.description,
				list_type: tierList.list_type,
				tiers: tierList.tiers,
				items: tierList.items || [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				owner: 'anonymous',
				item_placements: [],
				likes: 0,
				comments: 0,
				forks: 0
			} as TierListResponse;
		} catch (error) {
			console.error('Firebase tier list creation failed:', error);
			throw error;
		}
	}

	async updateTierList(id: string, tierList: TierListUpdate): Promise<TierListResponse> {
		try {
			const tierListRef = doc(db, 'tierlists', id);

			// Ensure items preserve their position data during updates
			const updateData: any = {
				...tierList,
				updated_at: serverTimestamp()
			};

			// Only include items if they exist in the update
			if ('items' in tierList && tierList.items) {
				updateData.items = tierList.items.map((item: any) => ({
					...item,
					position: item.position || null,
					size: item.size || null
				}));
			}

			await updateDoc(tierListRef, updateData);

			const updatedDoc = await getDoc(tierListRef);
			const data = updatedDoc.data();

			if (!data) {
				throw new Error('Failed to fetch updated tier list');
			}

			// Ensure items preserve their position data in response
			const items = (data.items || []).map((item: any) => ({
				...item,
				position: item.position || null,
				size: item.size || null
			}));

			return {
				id: updatedDoc.id,
				title: data.title,
				description: data.description,
				list_type: data.list_type,
				tiers: data.tiers,
				items,
				created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				updated_at: data.updated_at?.toDate?.()?.toISOString() || new Date().toISOString(),
				owner: data.owner || 'anonymous',
				item_placements: data.item_placements || [],
				likes: data.likes || 0,
				comments: data.comments || 0,
				forks: data.forks || 0
			} as TierListResponse;
		} catch (error) {
			console.error('Firebase tier list update failed:', error);
			throw error;
		}
	}

	async deleteTierList(id: string): Promise<void> {
		try {
			const tierListRef = doc(db, 'tierlists', id);
			await deleteDoc(tierListRef);
		} catch (error) {
			console.error('Firebase tier list deletion failed:', error);
			throw error;
		}
	}
}

export const firebaseFallbackClient = new FirebaseFallbackClient();
