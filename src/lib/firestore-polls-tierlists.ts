import { db } from './firebase.js';
import { resolveUid } from './user-profile';
import {
	collection,
	addDoc,
	getDocs,
	getDoc,
	doc,
	updateDoc,
	deleteDoc,
	setDoc,
	where,
	query,
	orderBy,
	serverTimestamp,
	limit,
	increment
} from 'firebase/firestore';
import { cleanUndefinedValues } from './utils';

// Types for tierlist and poll data
export interface TierlistData {
	id: string;
	title: string;
	description?: string;
	thumbnail?: string;
	banner_image?: string;
	owner: string;
	ownerDisplayName?: string;
	created_at: any;
	updated_at?: any;
	last_edited?: any;
	likes?: number;
	comments?: number;
	forks?: number;
	visibility?: 'public' | 'unlisted' | 'private';
	status?: 'draft' | 'published';
	items?: any[];
	tiers?: any[];
	originalId?: string;
	isForked?: boolean;
	isGuest?: boolean;
}

export interface PollData {
	id: string;
	title: string;
	description?: string;
	owner: string;
	created_at: any; // Firebase Timestamp
	updated_at?: any; // Firebase Timestamp
	likes?: number;
	comments?: number;
	totalVotes?: number;
	options?: any[];
	visibility?: 'public' | 'unlisted' | 'private';
	status?: 'draft' | 'published';
}

// Polls
export interface Poll {
	question: string;
	options: string[];
	createdAt?: Date;
	id?: string;
	[key: string]: unknown;
}

export async function savePollToFirestore(poll: Poll): Promise<string> {
	const cleanedPoll = cleanUndefinedValues({
		...poll,
		status: 'published',
		created_at: serverTimestamp()
	});
	const docRef = await addDoc(collection(db, 'polls'), cleanedPoll);
	return docRef.id;
}

export async function getPollsFromFirestore() {
	const snap = await getDocs(collection(db, 'polls'));
	const allPolls = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PollData[];

	return allPolls.filter((poll) => !poll.status || poll.status === 'published');
}

// Tierlists
export async function saveTierlistToFirestore(tierlist: Record<string, unknown>) {
	if (typeof tierlist.owner === 'string' && tierlist.owner) {
		tierlist.owner = await resolveUid(tierlist.owner);
	}

	const isGuest = tierlist.owner === 'anonymous' || !tierlist.owner;

	const isForked = tierlist.isForked || false;
	const originalId = tierlist.originalId || null;

	const cleanedTierlist = cleanUndefinedValues({
		...tierlist,
		status: 'published',
		created_at: serverTimestamp(),
		isGuest: isGuest,
		isForked: isForked,
		originalId: originalId,
		banner_image: tierlist.bannerImage || null
	});
	const docRef = await addDoc(collection(db, 'tierlists'), cleanedTierlist);
	return docRef.id;
}

export async function saveTierlistUnlisted(tierlist: Record<string, unknown>, asDraft = false) {
	if (typeof tierlist.owner === 'string' && tierlist.owner) {
		tierlist.owner = await resolveUid(tierlist.owner);
	}
	const isGuest = tierlist.owner === 'anonymous' || !tierlist.owner;
	const cleanedTierlist = cleanUndefinedValues({
		...tierlist,
		status: asDraft ? 'draft' : 'published',
		visibility: 'unlisted',
		created_at: serverTimestamp(),
		isGuest: isGuest,
		banner_image: tierlist.bannerImage || null
	});
	const docRef = await addDoc(collection(db, 'tierlists'), cleanedTierlist);
	return docRef.id;
}

export async function getTierlistsFromFirestore(limitCount = 20) {
	const q = query(collection(db, 'tierlists'), orderBy('created_at', 'desc'), limit(limitCount));
	const snap = await getDocs(q);
	const tierlists = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];
	const publishedTierlists = tierlists.filter(
		(tierlist) =>
			(!tierlist.status || tierlist.status === 'published') &&
			!tierlist.isGuest &&
			tierlist.visibility !== 'unlisted'
	);

	const ownerIds = [...new Set(publishedTierlists.map((tierlist) => tierlist.owner))].filter(
		Boolean
	);
	const ownerProfiles: Record<string, any> = {};

	for (const ownerId of ownerIds) {
		try {
			const userDoc = await getDoc(doc(db, 'users', ownerId));
			if (userDoc.exists()) {
				ownerProfiles[ownerId] = userDoc.data();
			}
		} catch (error) {
			console.error(`Error fetching user ${ownerId}:`, error);
		}
	}

	return publishedTierlists.map((tierlist) => ({
		...tierlist,
		ownerDisplayName:
			(tierlist.owner && ownerProfiles[tierlist.owner]?.displayName) || 'Anonymous User'
	}));
}

// Get a single tierlist by ID
export async function getTierlist(tierlistId: string): Promise<TierlistData | null> {
	try {
		const docRef = doc(db, 'tierlists', tierlistId);
		const docSnap = await getDoc(docRef);

		if (docSnap.exists()) {
			const tierlist = { id: docSnap.id, ...docSnap.data() } as TierlistData;

			if (tierlist.owner) {
				try {
					const userDoc = await getDoc(doc(db, 'users', tierlist.owner));
					if (userDoc.exists()) {
						tierlist.ownerDisplayName = userDoc.data().displayName || 'Anonymous User';
					}
				} catch (error) {
					console.error(`Error fetching owner ${tierlist.owner}:`, error);
				}
			}

			return tierlist;
		} else {
			return null;
		}
	} catch (error) {
		console.error('Error fetching tierlist:', error);
		throw error;
	}
}

// Get user's tierlists (published + without status)
export async function getUserTierlists(userId: string): Promise<TierlistData[]> {
	const q = query(
		collection(db, 'tierlists'),
		where('owner', '==', userId),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	const allTierlists = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];

	return allTierlists.filter(
		(tierlist) => (!tierlist.status || tierlist.status === 'published') && !tierlist.isGuest
	);
}

// Get user's polls (published + without status)
export async function getUserPolls(userId: string): Promise<PollData[]> {
	try {
		const q = query(collection(db, 'polls'), where('owner', '==', userId));
		const snap = await getDocs(q);
		const allPolls = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PollData[];

		return allPolls
			.filter((poll) => !poll.status || poll.status === 'published')
			.sort((a, b) => {
				const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
				const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
				return bDate - aDate;
			});
	} catch (error) {
		console.error('Error fetching user polls:', error);
		return [];
	}
}

// Draft Management Functions

// Save tierlist as draft
export async function saveTierlistDraft(tierlist: Record<string, unknown>): Promise<string> {
	const isGuest = tierlist.owner === 'anonymous' || !tierlist.owner;

	const cleanedTierlist = cleanUndefinedValues({
		...tierlist,
		status: 'draft',
		created_at: serverTimestamp(),
		updated_at: serverTimestamp(),
		isGuest: isGuest
	});
	const docRef = await addDoc(collection(db, 'tierlists'), cleanedTierlist);
	return docRef.id;
}

// Publish tierlist (change status from draft to published)
export async function publishTierlist(tierlistId: string): Promise<void> {
	const tierlistRef = doc(db, 'tierlists', tierlistId);
	await updateDoc(tierlistRef, {
		status: 'published',
		updated_at: serverTimestamp()
	});
}

// Update existing tierlist/draft
export async function updateTierlist(
	tierlistId: string,
	updates: Record<string, unknown>
): Promise<void> {
	const tierlistRef = doc(db, 'tierlists', tierlistId);
	// Normalize owner if a display name/email was passed
	if (typeof (updates as any).owner === 'string' && (updates as any).owner) {
		try {
			(updates as any).owner = await resolveUid((updates as any).owner as string);
		} catch (e) {
			// If resolve fails, keep provided owner as-is
		}
	}
	const cleanedUpdates = cleanUndefinedValues({
		...updates,
		updated_at: serverTimestamp(),
		// Explicit last_edited field to preserve original created_at and track edits separately
		last_edited: serverTimestamp()
	});
	await updateDoc(tierlistRef, cleanedUpdates);
}

// Get user's drafts only
export async function getUserDrafts(userId: string): Promise<TierlistData[]> {
	const q = query(
		collection(db, 'tierlists'),
		where('owner', '==', userId),
		where('status', '==', 'draft'),
		orderBy('updated_at', 'desc')
	);
	const snap = await getDocs(q);
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];
}

// Get user's published tierlists only
export async function getUserPublishedTierlists(userId: string): Promise<TierlistData[]> {
	const q = query(
		collection(db, 'tierlists'),
		where('owner', '==', userId),
		where('status', '==', 'published'),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	const tierlists = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];

	// Filter out guest tierlists
	return tierlists.filter((tierlist) => !tierlist.isGuest);
}

// Save poll as draft
export async function savePollDraft(poll: Poll): Promise<string> {
	const cleanedPoll = cleanUndefinedValues({
		...poll,
		status: 'draft',
		created_at: serverTimestamp(),
		updated_at: serverTimestamp()
	});
	const docRef = await addDoc(collection(db, 'polls'), cleanedPoll);
	return docRef.id;
}

// Publish poll
export async function publishPoll(pollId: string): Promise<void> {
	const pollRef = doc(db, 'polls', pollId);
	await updateDoc(pollRef, {
		status: 'published',
		updated_at: serverTimestamp()
	});
}

// Update existing poll/draft
export async function updatePoll(pollId: string, updates: Record<string, unknown>): Promise<void> {
	const pollRef = doc(db, 'polls', pollId);
	const cleanedUpdates = cleanUndefinedValues({
		...updates,
		updated_at: serverTimestamp()
	});
	await updateDoc(pollRef, cleanedUpdates);
}

// Forking Functions

// Fork a tierlist
export async function forkTierlist(
	originalTierlistId: string,
	newOwnerId: string,
	customTitle?: string
): Promise<string> {
	try {
		// Get the original tierlist
		const originalRef = doc(db, 'tierlists', originalTierlistId);
		const originalSnap = await getDoc(originalRef);

		if (!originalSnap.exists()) {
			throw new Error('Original tierlist not found');
		}

		const originalData = originalSnap.data() as TierlistData;

		// Create forked version
		const forkedTierlist = cleanUndefinedValues({
			...originalData,
			title: customTitle || originalData.title,
			owner: newOwnerId,
			originalId: originalTierlistId,
			isForked: true,
			status: 'draft',
			created_at: serverTimestamp(),
			updated_at: serverTimestamp(),
			likes: 0,
			comments: 0,
			forks: 0
		});

		delete forkedTierlist.id;

		const docRef = await addDoc(collection(db, 'tierlists'), forkedTierlist);

		await updateDoc(originalRef, {
			forks: (originalData.forks || 0) + 1,
			updated_at: serverTimestamp()
		});

		return docRef.id;
	} catch (error) {
		console.error('Error forking tierlist:', error);
		throw error;
	}
}

// Get forks of a tierlist
export async function getTierlistForks(originalTierlistId: string): Promise<TierlistData[]> {
	const q = query(
		collection(db, 'tierlists'),
		where('originalId', '==', originalTierlistId),
		where('status', '==', 'published'),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];
}

// Get user's forked tierlists
export async function getUserForkedTierlists(userId: string): Promise<TierlistData[]> {
	const q = query(
		collection(db, 'tierlists'),
		where('owner', '==', userId),
		where('isForked', '==', true),
		orderBy('created_at', 'desc')
	);
	const snap = await getDocs(q);
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TierlistData[];
}

// Like/Unlike functionality for tierlists
// Add or update like count for a tierlist
export async function hasUserLikedTierlist(tierlistId: string, userId: string): Promise<boolean> {
	try {
		const userLikeRef = doc(db, 'tierlists', tierlistId, 'likes', userId);
		const likeDoc = await getDoc(doc(db, 'tierlist_likes', `${tierlistId}_${userId}`));
		return likeDoc.exists();
	} catch (error) {
		console.error('Error checking tierlist like status:', error);
		return false;
	}
}

// Get interaction counts for a tierlist and update the document if needed
export async function getTierlistInteractions(
	tierlistId: string
): Promise<{ likes: number; comments: number; forks: number }> {
	try {
		const [likesSnap, commentsSnap, forksSnap] = await Promise.all([
			getDocs(collection(db, 'tierlists', tierlistId, 'likes')),
			getDocs(collection(db, 'tierlists', tierlistId, 'comments')),
			getDocs(query(collection(db, 'tierlists'), where('originalId', '==', tierlistId)))
		]);

		const likes = likesSnap.size;
		const comments = commentsSnap.size;
		const forks = forksSnap.size;

		const tierlistDoc = await getDoc(doc(db, 'tierlists', tierlistId));
		if (tierlistDoc.exists()) {
			const data = tierlistDoc.data();
			const updates: Record<string, number> = {};

			if ((data.likes || 0) !== likes) updates.likes = likes;
			if ((data.comments || 0) !== comments) updates.comments = comments;
			if ((data.forks || 0) !== forks) updates.forks = forks;

			if (Object.keys(updates).length > 0) {
				await updateDoc(doc(db, 'tierlists', tierlistId), updates);
			}
		}

		return { likes, comments, forks };
	} catch (error) {
		console.error('Error getting tierlist interactions:', error);
		return { likes: 0, comments: 0, forks: 0 };
	}
}

export async function likeTierlist(tierlistId: string, userId: string): Promise<void> {
	try {
		const tierlistDoc = await getDoc(doc(db, 'tierlists', tierlistId));
		if (!tierlistDoc.exists()) {
			throw new Error('Tierlist not found');
		}

		await setDoc(doc(db, 'tierlists', tierlistId, 'likes', userId), {
			created_at: serverTimestamp()
		});

		await updateDoc(doc(db, 'tierlists', tierlistId), {
			likes: increment(1)
		});

		const tierlistData = tierlistDoc.data();
		if (tierlistData.owner && tierlistData.owner !== userId) {
			try {
				const userDoc = await getDoc(doc(db, 'users', tierlistData.owner));
				if (userDoc.exists()) {
					const userData = userDoc.data();
					const newAura = (userData.aura || 0) + 1;
					const newTotalLikes = (userData.totalLikes || 0) + 1;

					await updateDoc(doc(db, 'users', tierlistData.owner), {
						aura: newAura,
						totalLikes: newTotalLikes
					});

					// Get liker's display name
					const likerDoc = await getDoc(doc(db, 'users', userId));
					const likerName = likerDoc.exists()
						? likerDoc.data().displayName || 'Someone'
						: 'Someone';

					// Create bundled notification
					const { createBundledNotification } = await import('./notification-bundler');
					await createBundledNotification(tierlistData.owner, {
						type: 'like',
						contentType: 'tierlist',
						contentId: tierlistId,
						contentTitle: tierlistData.title || 'Untitled Tierlist',
						fromUserId: userId,
						fromUserName: likerName
					});
				}
			} catch (error) {
				console.error('Error updating user aura:', error);
			}
		}
	} catch (error) {
		console.error('Error liking tierlist:', error);
		throw error;
	}
}

export async function unlikeTierlist(tierlistId: string, userId: string): Promise<void> {
	try {
		const tierlistRef = doc(db, 'tierlists', tierlistId);
		const userLikeRef = doc(db, 'tierlists', tierlistId, 'likes', userId);

		const likeDoc = await getDoc(userLikeRef);
		if (!likeDoc.exists()) {
			throw new Error('You have not liked this tierlist');
		}

		const tierlistSnap = await getDoc(tierlistRef);
		if (!tierlistSnap.exists()) {
			throw new Error('Tierlist not found');
		}

		const tierlistData = tierlistSnap.data();
		const ownerId = tierlistData.owner;

		await deleteDoc(userLikeRef);

		const currentLikes = tierlistData.likes || 0;
		await updateDoc(tierlistRef, {
			likes: Math.max(0, currentLikes - 1),
			updated_at: serverTimestamp()
		});

		if (ownerId) {
			const ownerRef = doc(db, 'users', ownerId);
			const ownerSnap = await getDoc(ownerRef);
			if (ownerSnap.exists()) {
				const ownerData = ownerSnap.data();
				await updateDoc(ownerRef, {
					aura: Math.max(0, (ownerData.aura || 0) - 1),
					totalLikes: Math.max(0, (ownerData.totalLikes || 0) - 1)
				});
			}
		}
	} catch (error) {
		console.error('Error unliking tierlist:', error);
		throw error;
	}
}

// Like/Unlike functionality for polls
export async function likePoll(pollId: string, userId: string): Promise<void> {
	try {
		const pollRef = doc(db, 'polls', pollId);
		const userLikeRef = doc(db, 'polls', pollId, 'likes', userId);

		const likeDoc = await getDoc(userLikeRef);
		if (likeDoc.exists()) {
			throw new Error('You have already liked this poll');
		}

		const pollSnap = await getDoc(pollRef);
		if (!pollSnap.exists()) {
			throw new Error('Poll not found');
		}

		const pollData = pollSnap.data();
		const ownerId = pollData.owner;

		await setDoc(userLikeRef, {
			likedAt: serverTimestamp(),
			userId: userId
		});

		const currentLikes = pollData.likes || 0;
		await updateDoc(pollRef, {
			likes: currentLikes + 1,
			updated_at: serverTimestamp()
		});

		if (ownerId && ownerId !== userId) {
			const ownerRef = doc(db, 'users', ownerId);
			const ownerSnap = await getDoc(ownerRef);
			if (ownerSnap.exists()) {
				const ownerData = ownerSnap.data();
				await updateDoc(ownerRef, {
					aura: (ownerData.aura || 0) + 1,
					totalLikes: (ownerData.totalLikes || 0) + 1
				});

				// Get liker's display name
				const likerDoc = await getDoc(doc(db, 'users', userId));
				const likerName = likerDoc.exists() ? likerDoc.data().displayName || 'Someone' : 'Someone';

				// Create bundled notification
				const { createBundledNotification } = await import('./notification-bundler');
				await createBundledNotification(ownerId, {
					type: 'like',
					contentType: 'poll',
					contentId: pollId,
					contentTitle: pollData.title || 'Untitled Poll',
					fromUserId: userId,
					fromUserName: likerName
				});
			}
		}
	} catch (error) {
		console.error('Error liking poll:', error);
		throw error;
	}
}

export async function unlikePoll(pollId: string, userId: string): Promise<void> {
	try {
		const pollRef = doc(db, 'polls', pollId);
		const userLikeRef = doc(db, 'polls', pollId, 'likes', userId);

		const likeDoc = await getDoc(userLikeRef);
		if (!likeDoc.exists()) {
			throw new Error('You have not liked this poll');
		}

		const pollSnap = await getDoc(pollRef);
		if (!pollSnap.exists()) {
			throw new Error('Poll not found');
		}

		const pollData = pollSnap.data();
		const ownerId = pollData.owner;

		await deleteDoc(userLikeRef);

		const currentLikes = pollData.likes || 0;
		await updateDoc(pollRef, {
			likes: Math.max(0, currentLikes - 1),
			updated_at: serverTimestamp()
		});

		if (ownerId) {
			const ownerRef = doc(db, 'users', ownerId);
			const ownerSnap = await getDoc(ownerRef);
			if (ownerSnap.exists()) {
				const ownerData = ownerSnap.data();
				await updateDoc(ownerRef, {
					aura: Math.max(0, (ownerData.aura || 0) - 1),
					totalLikes: Math.max(0, (ownerData.totalLikes || 0) - 1)
				});
			}
		}
	} catch (error) {
		console.error('Error unliking poll:', error);
		throw error;
	}
}

export async function hasUserLikedPoll(pollId: string, userId: string): Promise<boolean> {
	try {
		const userLikeRef = doc(db, 'polls', pollId, 'likes', userId);
		const likeDoc = await getDoc(userLikeRef);
		return likeDoc.exists();
	} catch (error) {
		console.error('Error checking if user liked poll:', error);
		return false;
	}
}

// User vote persistence functions
export async function saveUserVote(
	pollId: string,
	userId: string,
	position: number,
	position2D?: { x: number; y: number }
): Promise<void> {
	try {
		const userVoteRef = doc(db, 'polls', pollId, 'votes', userId);
		const voteData: any = {
			position,
			userId,
			votedAt: serverTimestamp()
		};

		if (position2D) {
			voteData.position_2d = position2D;
		}

		await setDoc(userVoteRef, voteData);
	} catch (error) {
		console.error('Error saving user vote:', error);
		throw error;
	}
}

export async function getUserVote(
	pollId: string,
	userId: string
): Promise<{ position: number; position_2d?: { x: number; y: number } } | null> {
	try {
		const userVoteRef = doc(db, 'polls', pollId, 'votes', userId);
		const voteDoc = await getDoc(userVoteRef);

		if (voteDoc.exists()) {
			const data = voteDoc.data();
			return {
				position: data.position,
				position_2d: data.position_2d || null
			};
		}

		return null;
	} catch (error) {
		console.error('Error getting user vote:', error);
		return null;
	}
}

export async function getAllVotesForPoll(pollId: string): Promise<{
	vote_positions: number[];
	vote_positions_2d: { x: number; y: number }[];
	total_votes: number;
}> {
	try {
		const votesCollection = collection(db, 'polls', pollId, 'votes');
		const votesSnapshot = await getDocs(votesCollection);

		const vote_positions: number[] = [];
		const vote_positions_2d: { x: number; y: number }[] = [];

		votesSnapshot.forEach((doc) => {
			const data = doc.data();
			if (typeof data.position === 'number') {
				vote_positions.push(data.position);
			}
			if (
				data.position_2d &&
				typeof data.position_2d.x === 'number' &&
				typeof data.position_2d.y === 'number'
			) {
				vote_positions_2d.push(data.position_2d);
			}
		});

		return {
			vote_positions,
			vote_positions_2d,
			total_votes: votesSnapshot.size
		};
	} catch (error) {
		console.error('Error getting all votes for poll:', error);
		return {
			vote_positions: [],
			vote_positions_2d: [],
			total_votes: 0
		};
	}
}

export async function updatePollStatistics(pollId: string): Promise<void> {
	try {
		const votesData = await getAllVotesForPoll(pollId);
		const { vote_positions, vote_positions_2d } = votesData;

		// Fetch poll for response_type/options to compute option proximity
		const pollRef = doc(db, 'polls', pollId);
		const pollSnap = await getDoc(pollRef);
		const pollData = pollSnap.exists() ? (pollSnap.data() as any) : null;
		const response_type: number = pollData?.response_type || pollData?.responseType || 2;
		const options: string[] = Array.isArray(pollData?.options) ? pollData.options : [];

		// Calculate statistics
		let average = 0;
		let average_2d: [number, number] | null = null;
		let std_dev = 0;

		// For 2D positions
		let median_x = 0;
		let median_y = 0;
		let mode_x = 0;
		let mode_y = 0;
		let range_x = 0;
		let range_y = 0;

		if (vote_positions.length > 0) {
			// Calculate 1D average
			average = vote_positions.reduce((sum, pos) => sum + pos, 0) / vote_positions.length;

			// Calculate standard deviation
			const variance =
				vote_positions.reduce((sum, pos) => sum + Math.pow(pos - average, 2), 0) /
				vote_positions.length;
			std_dev = Math.sqrt(variance);
		}

		if (vote_positions_2d.length > 0) {
			// Extract x and y coordinates
			const x_values = vote_positions_2d.map((pos) => pos.x);
			const y_values = vote_positions_2d.map((pos) => pos.y);

			// Calculate 2D average
			const avgX = x_values.reduce((sum, x) => sum + x, 0) / x_values.length;
			const avgY = y_values.reduce((sum, y) => sum + y, 0) / y_values.length;
			average_2d = [avgX, avgY];

			// Calculate median
			const sorted_x = [...x_values].sort((a, b) => a - b);
			const sorted_y = [...y_values].sort((a, b) => a - b);

			const mid = Math.floor(sorted_x.length / 2);
			if (sorted_x.length % 2 === 0) {
				median_x = (sorted_x[mid - 1] + sorted_x[mid]) / 2;
				median_y = (sorted_y[mid - 1] + sorted_y[mid]) / 2;
			} else {
				median_x = sorted_x[mid];
				median_y = sorted_y[mid];
			}

			// Calculate mode
			const x_frequency: Record<number, number> = {};
			const y_frequency: Record<number, number> = {};

			x_values.forEach((x) => {
				x_frequency[x] = (x_frequency[x] || 0) + 1;
			});

			y_values.forEach((y) => {
				y_frequency[y] = (y_frequency[y] || 0) + 1;
			});

			let max_x_freq = 0;
			let max_y_freq = 0;

			for (const [x, freq] of Object.entries(x_frequency)) {
				if (freq > max_x_freq) {
					max_x_freq = freq;
					mode_x = parseFloat(x);
				}
			}

			for (const [y, freq] of Object.entries(y_frequency)) {
				if (freq > max_y_freq) {
					max_y_freq = freq;
					mode_y = parseFloat(y);
				}
			}

			range_x = Math.max(...x_values) - Math.min(...x_values);
			range_y = Math.max(...y_values) - Math.min(...y_values);
		}

		// Compute option proximity percentages (normalized weights per option)
		let option_proximity: number[] | undefined = undefined;
		if (response_type === 2) {
			if (vote_positions && vote_positions.length > 0) {
				let sumLeft = 0;
				let sumRight = 0;
				for (const v of vote_positions) {
					if (typeof v === 'number') {
						sumRight += v; // closeness to right endpoint
						sumLeft += 1 - v; // closeness to left endpoint
					}
				}
				const total = sumLeft + sumRight || 1;
				const prox = [sumLeft / total, sumRight / total];
				// Map to options length if options provided
				if (options.length === 2) option_proximity = prox;
				else if (options.length > 0) {
					option_proximity = options.map((_, i) => prox[i % prox.length]);
				} else option_proximity = prox;
			}
		} else if (response_type >= 3 && vote_positions_2d && vote_positions_2d.length > 0) {
			// Build polygon points similar to the client
			let shape: Array<{ x: number; y: number }> = [];
			if (response_type === 3) {
				shape = [
					{ x: 0.5, y: 0.1 },
					{ x: 0.1, y: 0.9 },
					{ x: 0.9, y: 0.9 }
				];
			} else if (response_type === 4) {
				shape = [
					{ x: 0.1, y: 0.1 },
					{ x: 0.9, y: 0.1 },
					{ x: 0.9, y: 0.9 },
					{ x: 0.1, y: 0.9 }
				];
			} else if (response_type === 5) {
				const cx = 0.5,
					cy = 0.5,
					r = 0.45;
				shape = Array.from({ length: 5 }, (_, i) => {
					const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
					return { x: cx + r * Math.cos(a), y: cy * 1 + r * Math.sin(a) };
				});
			}
			const anchors = shape.map((p, i) => {
				const n = shape[(i + 1) % shape.length];
				return { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 };
			});
			if (anchors.length > 0) {
				const sums = new Array(anchors.length).fill(0);
				const EPS = 1e-4;
				for (const p of vote_positions_2d) {
					let totalW = 0;
					const weights: number[] = [];
					for (let idx = 0; idx < anchors.length; idx++) {
						const a = anchors[idx];
						const dx = a.x - p.x;
						const dy = a.y - p.y;
						const d = Math.sqrt(dx * dx + dy * dy);
						const w = 1 / (d + EPS);
						weights[idx] = w;
						totalW += w;
					}
					if (totalW) {
						for (let idx = 0; idx < anchors.length; idx++) {
							sums[idx] += weights[idx] / totalW;
						}
					}
				}
				const voteCount = vote_positions_2d.length || 1;
				let proximities = sums.map((s) => s / voteCount);
				// Map to options length if mismatch
				if (options.length && options.length !== proximities.length) {
					option_proximity = options.map((_, i) => {
						const from = (i / options.length) * proximities.length;
						const i0 = Math.floor(from) % proximities.length;
						return proximities[i0];
					});
				} else {
					option_proximity = proximities;
				}
			}
		}

		const statsUpdate: any = {
			stats: {
				vote_positions,
				vote_positions_2d,
				average,
				std_dev,
				total_votes: votesData.total_votes,
				...(option_proximity && { option_proximity }),
				...(average_2d && {
					average_2d,
					median_x,
					median_y,
					mode_x,
					mode_y,
					range_x,
					range_y
				})
			},
			updated_at: serverTimestamp()
		};

		await updateDoc(pollRef, statsUpdate);
	} catch (error) {
		console.error('Error updating poll statistics:', error);
		throw error;
	}
}

// Update interaction counts for a tierlist based on subcollections
export async function updateTierlistInteractionCounts(tierlistId: string): Promise<void> {
	try {
		const [likesSnap, commentsSnap, forksSnap] = await Promise.all([
			getDocs(collection(db, 'tierlists', tierlistId, 'likes')),
			getDocs(collection(db, 'tierlists', tierlistId, 'comments')),
			getDocs(query(collection(db, 'tierlists'), where('originalId', '==', tierlistId)))
		]);

		await updateDoc(doc(db, 'tierlists', tierlistId), {
			likes: likesSnap.size,
			comments: commentsSnap.size,
			forks: forksSnap.size,
			updated_at: serverTimestamp()
		});
	} catch (error) {
		console.error('Error updating tierlist interaction counts:', error);
		throw error;
	}
}
