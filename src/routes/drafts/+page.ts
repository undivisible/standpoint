import { getUserDrafts, type TierlistData } from '../../lib/firestore-polls-tierlists';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { currentUser } from '../../lib/stores';
import type { User } from '../../lib/firebase';

export async function load() {
	const user: User | null = get(currentUser);
	if (!user) {
		throw redirect(302, '/login?redirectTo=/drafts');
	}

	try {
		const drafts = await getUserDrafts(user.uid);
		return {
			drafts
		};
	} catch (error) {
		console.error('Error loading user drafts:', error);
		return {
			drafts: [] as TierlistData[]
		};
	}
}
