import type { PageLoad } from './$types';
import { getUserProfile, createUserProfile, type UserProfile } from '../../lib/user-profile';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { User } from '../../lib/firebase';

export const load: PageLoad = async ({ parent }) => {
	const { user }: { user: User | null } = await parent();

	// Skip auth check during SSR
	if (!browser) {
		return {
			userProfile: null
		};
	}

	if (!user) {
		throw redirect(302, '/login?redirectTo=/settings');
	}

	let userProfile: UserProfile | null = null;
	try {
		userProfile = await getUserProfile(user.uid);
	} catch (error) {
		console.error('Error loading user profile:', error);
	}

	if (!userProfile) {
		try {
			await createUserProfile({
				uid: user.uid,
				displayName: user.displayName || '',
				email: user.email || '',
				photoURL: user.photoURL || ''
			});
			userProfile = await getUserProfile(user.uid);
		} catch (error) {
			console.error('Error creating user profile:', error);
			// Fallback profile
			userProfile = {
				uid: user.uid,
				displayName: user.displayName || '',
				email: user.email || '',
				photoURL: user.photoURL || '',
				createdAt: Date.now(),
				aura: 0,
				pro: false,
				totalLikes: 0,
				totalComments: 0,
				totalForks: 0,
				tierlistsCreated: 0,
				pollsCreated: 0
			};
		}
	}

	return {
		userProfile
	};
};
