import { browser } from '$app/environment';
import type { User } from 'firebase/auth';

export async function load() {
	// Return empty data during SSR, auth will be handled client-side
	if (!browser) {
		return {
			user: null as User | null
		};
	}

	// In browser, wait for auth to initialize
	const { auth, hasFirebaseConfig } = await import('../lib/firebase');
	if (!hasFirebaseConfig) {
		return {
			user: null as User | null
		};
	}
	const { onAuthStateChanged } = await import('firebase/auth');

	const user = await new Promise<User | null>((resolve) => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			unsubscribe();
			resolve(user);
		});
	});

	return {
		user
	};
}
