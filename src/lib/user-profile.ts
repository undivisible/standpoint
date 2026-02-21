import { db } from './firebase';
import {
	doc,
	updateDoc,
	getDoc,
	collection,
	deleteDoc,
	getDocs,
	setDoc,
	query,
	where,
	orderBy,
	limit,
	writeBatch
} from 'firebase/firestore';

export interface UserProfile {
	uid: string;
	displayName: string;
	email?: string;
	photoURL?: string;
	bannerURL?: string;
	bio?: string;
	location?: string;
	website?: string;
	twitter?: string;
	instagram?: string;
	createdAt: number;
	aura: number;
	pro: boolean;
	group?: string; // User group (dev, pro, user)
	totalLikes: number;
	totalComments: number;
	totalForks: number;
	tierlistsCreated: number;
	pollsCreated: number;
	// Notification settings
	emailNotifications?: boolean;
	pushNotifications?: boolean;
	commentNotifications?: boolean;
	likeNotifications?: boolean;
	followNotifications?: boolean;
	// Privacy settings
	profileVisibility?: string;
	tierlistVisibility?: string;
	pollVisibility?: string;
	showEmail?: boolean;
	showLocation?: boolean;
	// Theme settings
	theme?: string;
	colorScheme?: string;
	fontSize?: string;
	// AI settings
	enableAI?: boolean;
	aiSuggestions?: boolean;
	aiImageGeneration?: boolean;
}

// Calculate aura based on engagement: likes (1 point) + comments (2 points) + forks (5 points)
export function calculateAura(likes: number, comments: number, forks: number): number {
	return likes + comments * 2 + forks * 5;
}

// Check if UID exists in the database
export async function checkUidExists(uid: string): Promise<boolean> {
	const userDoc = await getDoc(doc(db, 'users', uid));
	return userDoc.exists();
}

// Change user UID
export async function changeUserUid(currentUid: string, newUid: string): Promise<void> {
	if (!currentUid || !newUid) {
		throw new Error('Both current and new UID are required');
	}

	if (currentUid === newUid) {
		throw new Error('New UID must be different from current UID');
	}

	// Validate new UID format
	const uidRegex = /^[a-zA-Z0-9_-]{3,30}$/;
	if (!uidRegex.test(newUid)) {
		throw new Error(
			'UID must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores'
		);
	}

	// Block reserved UIDs
	const reserved = [
		'admin', 'root', 'system', 'moderator', 'bot', 'support',
		'official', 'standpoint', 'null', 'undefined', 'anonymous'
	];
	if (reserved.includes(newUid.toLowerCase())) {
		throw new Error('This UID is reserved and cannot be used');
	}

	// Check if new UID already exists
	const existingUser = await getUserProfile(newUid);
	if (existingUser) {
		throw new Error('This UID is already taken');
	}

	const batch = writeBatch(db);

	try {
		// Get current user data
		const currentUserRef = doc(db, 'users', currentUid);
		const currentUserDoc = await getDoc(currentUserRef);

		if (!currentUserDoc.exists()) {
			throw new Error('Current user not found');
		}

		const userData = currentUserDoc.data();

		// Create new user document with updated UID
		const newUserRef = doc(db, 'users', newUid);
		batch.set(newUserRef, {
			...userData,
			uid: newUid,
			updatedAt: Date.now()
		});

		// Create a redirect document to handle old UID references
		const redirectRef = doc(db, 'uid-redirects', currentUid);
		batch.set(redirectRef, {
			redirectsTo: newUid,
			originalUid: currentUid,
			createdAt: Date.now()
		});

		// Update all collections that reference this user
		const collections = ['polls', 'tierlists', 'comments', 'votes', 'followers', 'following'];

		for (const collectionName of collections) {
			const q = query(collection(db, collectionName), where('userId', '==', currentUid));
			const querySnapshot = await getDocs(q);

			querySnapshot.forEach((doc) => {
				const docRef = doc.ref;
				batch.update(docRef, { userId: newUid });
			});
		}

		// Keep the old user document but mark it as redirected
		batch.update(currentUserRef, {
			redirectsTo: newUid,
			isRedirect: true,
			updatedAt: Date.now()
		});

		await batch.commit();
	} catch (error) {
		console.error('Error changing UID:', error);
		throw error;
	}
}

// Update user profile fields
export async function updateUserProfile(
	uid: string,
	data: Partial<{
		uid: string;
		displayName: string;
		photoURL: string;
		bannerURL: string;
		bio: string;
		location: string;
		website: string;
		twitter: string;
		instagram: string;
		emailNotifications: boolean;
		pushNotifications: boolean;
		commentNotifications: boolean;
		likeNotifications: boolean;
		followNotifications: boolean;
		profileVisibility: string;
		tierlistVisibility: string;
		pollVisibility: string;
		showEmail: boolean;
		showLocation: boolean;
		allowMessages: boolean;
		theme: string;
		colorScheme: string;
		fontSize: string;
		enableAI: boolean;
		aiSuggestions: boolean;
		aiImageGeneration: boolean;
	}>
) {
	await updateDoc(doc(db, 'users', uid), {
		...data,
		updatedAt: Date.now()
	});
}

// Update user stats and recalculate aura
export async function updateUserStats(
	uid: string,
	stats: Partial<{
		totalLikes: number;
		totalComments: number;
		totalForks: number;
		tierlistsCreated: number;
		pollsCreated: number;
	}>
) {
	const userDoc = await getDoc(doc(db, 'users', uid));
	if (userDoc.exists()) {
		const userData = userDoc.data();
		const newLikes = stats.totalLikes ?? userData.totalLikes ?? 0;
		const newComments = stats.totalComments ?? userData.totalComments ?? 0;
		const newForks = stats.totalForks ?? userData.totalForks ?? 0;

		const newAura = calculateAura(newLikes, newComments, newForks);

		await updateDoc(doc(db, 'users', uid), {
			...stats,
			aura: newAura,
			updatedAt: Date.now()
		});
	}
}

// Follow a user
export async function followUser(currentUid: string, targetUid: string) {
	await setDoc(doc(db, 'users', targetUid, 'followers', currentUid), { followedAt: Date.now() });
	await setDoc(doc(db, 'users', currentUid, 'following', targetUid), { followedAt: Date.now() });
}

// Unfollow a user
export async function unfollowUser(currentUid: string, targetUid: string) {
	await deleteDoc(doc(db, 'users', targetUid, 'followers', currentUid));
	await deleteDoc(doc(db, 'users', currentUid, 'following', targetUid));
}

// Check if current user follows target
export async function isFollowing(currentUid: string, targetUid: string): Promise<boolean> {
	const docSnap = await getDoc(doc(db, 'users', targetUid, 'followers', currentUid));
	return docSnap.exists();
}

// Check if two users are friends (mutual following)
export async function isFriend(currentUid: string, targetUid: string): Promise<boolean> {
	const [a, b] = await Promise.all([
		isFollowing(currentUid, targetUid),
		isFollowing(targetUid, currentUid)
	]);
	return a && b;
}

// Get follower/following counts
export async function getFollowerCount(uid: string): Promise<number> {
	const snap = await getDocs(collection(db, 'users', uid, 'followers'));
	return snap.size;
}

export async function getFollowingCount(uid: string): Promise<number> {
	const snap = await getDocs(collection(db, 'users', uid, 'following'));
	return snap.size;
}

// Copy profile data from original UID to new UID
async function copyProfileData(originalUid: string, newUid: string): Promise<void> {
	if (originalUid === newUid) return;
	const originalProfileRef = doc(db, 'users', originalUid);
	const newProfileRef = doc(db, 'users', newUid);
	const originalProfileDoc = await getDoc(originalProfileRef);
	if (originalProfileDoc.exists()) {
		const profileData = originalProfileDoc.data();
		await setDoc(newProfileRef, profileData, { merge: true });
	}
}

// Resolve UID redirects
export async function resolveUid(uid: string): Promise<string> {
	try {
		const redirectRef = doc(db, 'uid-redirects', uid);
		const redirectDoc = await getDoc(redirectRef);
		if (redirectDoc.exists()) {
			const redirectData = redirectDoc.data();
			const targetUid = redirectData.redirectsTo;
			if (redirectData.copyProfileData) {
				await copyProfileData(uid, targetUid);
			}
			return targetUid;
		}

		const userRef = doc(db, 'users', uid);
		const userDoc = await getDoc(userRef);

		if (userDoc.exists()) {
			const userData = userDoc.data();
			if (userData.isRedirect && userData.redirectsTo) {
				return userData.redirectsTo;
			}
		}

		return uid;
	} catch (error) {
		console.error('Error resolving UID:', error);
		return uid;
	}
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
	try {
		const resolvedUid = await resolveUid(uid);

		const userRef = doc(db, 'users', resolvedUid);
		const userDoc = await getDoc(userRef);

		if (!userDoc.exists()) {
			return null;
		}

		const userData = userDoc.data();

		if (userData.isRedirect) {
			return null;
		}

		// Get real stats from tierlists and polls with fallback for missing indexes
		let totalLikes = 0;
		let totalComments = 0;
		let totalForks = 0;
		let tierlistsCreated = 0;
		let pollsCreated = 0;

		try {
			const [tierlistsSnap, pollsSnap] = await Promise.all([
				getDocs(query(collection(db, 'tierlists'), where('owner', '==', resolvedUid))),
				getDocs(query(collection(db, 'polls'), where('owner', '==', resolvedUid)))
			]);

			tierlistsSnap.docs.forEach((doc) => {
				const data = doc.data();
				totalLikes += data.likes || 0;
				totalComments += data.comments || 0;
				totalForks += data.forks || 0;
			});

			pollsSnap.docs.forEach((doc) => {
				const data = doc.data();
				totalLikes += data.likes || 0;
				totalComments += data.comments || 0;
			});

			tierlistsCreated = tierlistsSnap.size;
			pollsCreated = pollsSnap.size;
		} catch (error) {
			console.warn('Index not available for user content queries, using stored stats:', error);
			// Fall back to stored stats in user document
			totalLikes = userData.totalLikes || 0;
			totalComments = userData.totalComments || 0;
			totalForks = userData.totalForks || 0;
			tierlistsCreated = userData.tierlistsCreated || 0;
			pollsCreated = userData.pollsCreated || 0;
		}

		const aura = calculateAura(totalLikes, totalComments, totalForks);

		// Update user stats if they've changed
		try {
			if (
				userData.aura !== aura ||
				userData.totalLikes !== totalLikes ||
				userData.totalComments !== totalComments ||
				userData.totalForks !== totalForks ||
				userData.tierlistsCreated !== tierlistsCreated ||
				userData.pollsCreated !== pollsCreated
			) {
				await updateUserStats(resolvedUid, {
					totalLikes,
					totalComments,
					totalForks,
					tierlistsCreated,
					pollsCreated
				});
			}
		} catch (error) {
			console.warn('Could not update user stats:', error);
		}

		return {
			uid: resolvedUid,
			displayName: userData.displayName || 'Anonymous User',
			email: userData.email || '',
			photoURL: userData.photoURL || '',
			bannerURL: userData.bannerURL || '',
			bio: userData.bio || '',
			location: userData.location || '',
			website: userData.website || '',
			twitter: userData.twitter || '',
			instagram: userData.instagram || '',
			createdAt: userData.createdAt || Date.now(),
			aura,
			pro: userData.pro || false,
			group: userData.group || 'user',
			totalLikes,
			totalComments,
			totalForks,
			tierlistsCreated,
			pollsCreated,
			// Notification settings
			emailNotifications: userData.emailNotifications ?? true,
			pushNotifications: userData.pushNotifications ?? true,
			commentNotifications: userData.commentNotifications ?? true,
			likeNotifications: userData.likeNotifications ?? true,
			followNotifications: userData.followNotifications ?? true,
			// Privacy settings
			profileVisibility: userData.profileVisibility || 'public',
			tierlistVisibility: userData.tierlistVisibility || 'public',
			pollVisibility: userData.pollVisibility || 'public',
			showEmail: userData.showEmail ?? false,
			showLocation: userData.showLocation ?? false,
			// Theme settings
			theme: userData.theme || 'dark',
			colorScheme: userData.colorScheme || 'orange',
			fontSize: userData.fontSize || 'medium',
			// AI settings
			enableAI: userData.enableAI ?? false,
			aiSuggestions: userData.aiSuggestions ?? false,
			aiImageGeneration: userData.aiImageGeneration ?? false
		};
	} catch (error) {
		console.error('Error getting user profile:', error);
		return null;
	}
}

// Create user profile document on sign-up
export async function createUserProfile(user: {
	uid: string;
	displayName?: string;
	email?: string;
	photoURL?: string;
}) {
	await setDoc(doc(db, 'users', user.uid), {
		displayName: user.displayName || 'Anonymous User',
		email: user.email || '',
		photoURL: user.photoURL || '',
		bannerURL: '',
		bio: '',
		createdAt: Date.now(),
		aura: 0,
		pro: false,
		totalLikes: 0,
		totalComments: 0,
		totalForks: 0,
		tierlistsCreated: 0,
		pollsCreated: 0
	});
}

/**
 * Call this after user login to ensure profile data is copied if the user logged in with an old UID.
 * Pass the logged-in user's UID. Returns the resolved UID (may be different from the input).
 */
export async function handleLoginProfileRedirect(loggedInUid: string): Promise<string> {
	const resolvedUid = await resolveUid(loggedInUid);
	return resolvedUid;
}
