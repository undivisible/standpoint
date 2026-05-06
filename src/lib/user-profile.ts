import { apiDelete, apiGet, apiPatch, apiPost } from './cloudflare-api';
import { getUserPolls, getUserTierlists } from './firestore-polls-tierlists';

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
	return Boolean(await getUserProfile(uid));
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

	// Check if new UID already exists
	const existingUser = await getUserProfile(newUid);
	if (existingUser) {
		throw new Error('This UID is already taken');
	}

	try {
		// Get current user data
		const currentUser = await getUserProfile(currentUid);

		if (!currentUser) {
			throw new Error('Current user not found');
		}

		// Create new user document with updated UID
		await createUserProfile({
			...currentUser,
			uid: newUid
		});

		// Create a redirect document to handle old UID references
		await updateUserProfile(currentUid, {
			redirectsTo: newUid,
			isRedirect: true,
			updatedAt: Date.now()
		} as any);

		// Update all collections that reference this user

		// Keep the old user document but mark it as redirected
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
	await apiPatch(`users/${encodeURIComponent(uid)}`, {
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
	const newLikes = stats.totalLikes ?? 0;
	const newComments = stats.totalComments ?? 0;
	const newForks = stats.totalForks ?? 0;

	const newAura = calculateAura(newLikes, newComments, newForks);

	await updateUserProfile(uid, {
		...stats,
		aura: newAura,
		updatedAt: Date.now()
	} as any);
}

// Follow a user
export async function followUser(currentUid: string, targetUid: string) {
	await apiPost(`users/${encodeURIComponent(currentUid)}/following`, { targetUid });
}

// Unfollow a user
export async function unfollowUser(currentUid: string, targetUid: string) {
	await apiDelete(
		`users/${encodeURIComponent(currentUid)}/following?target=${encodeURIComponent(targetUid)}`
	);
}

// Check if current user follows target
export async function isFollowing(currentUid: string, targetUid: string): Promise<boolean> {
	const data = await apiGet<{ following: boolean }>(
		`users/${encodeURIComponent(currentUid)}/following?target=${encodeURIComponent(targetUid)}`
	);
	return data.following;
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
	const data = await apiGet<{ count: number }>(`users/${encodeURIComponent(uid)}/followers`);
	return data.count;
}

export async function getFollowingCount(uid: string): Promise<number> {
	const data = await apiGet<{ count: number }>(`users/${encodeURIComponent(uid)}/following`);
	return data.count;
}

// Copy profile data from original UID to new UID
async function copyProfileData(originalUid: string, newUid: string): Promise<void> {
	if (originalUid === newUid) return;
	const originalProfile = await getUserProfile(originalUid);
	if (originalProfile) {
		await updateUserProfile(newUid, originalProfile);
	}
}

// Resolve UID redirects
export async function resolveUid(uid: string): Promise<string> {
	try {
		const user = await getUserProfile(uid);
		if (user && (user as any).isRedirect && (user as any).redirectsTo) {
			if ((user as any).copyProfileData) {
				await copyProfileData(uid, (user as any).redirectsTo);
			}
			return (user as any).redirectsTo;
		}

		return uid;
	} catch (error) {
		console.error('Error resolving UID:', error);
		return uid;
	}
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
	try {
		const userData = await apiGet<any>(`users/${encodeURIComponent(uid)}`);

		if (!userData) {
			return null;
		}

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
			const [tierlists, polls] = await Promise.all([getUserTierlists(uid), getUserPolls(uid)]);

			tierlists.forEach((data) => {
				totalLikes += data.likes || 0;
				totalComments += data.comments || 0;
				totalForks += data.forks || 0;
			});

			polls.forEach((data) => {
				totalLikes += data.likes || 0;
				totalComments += data.comments || 0;
			});

			tierlistsCreated = tierlists.length;
			pollsCreated = polls.length;
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
				await updateUserStats(uid, {
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
			uid,
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
	await apiPost('users', {
		uid: user.uid,
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
