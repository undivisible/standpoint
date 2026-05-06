import { browser } from '$app/environment';
import type { User } from '$lib/firebase';

export async function load() {
	// Return empty data during SSR, auth will be handled client-side
	if (!browser) {
		return {
			user: null as User | null
		};
	}

	const { refreshSession } = await import('../lib/stores');
	const user = (await refreshSession()) as User | null;

	return {
		user
	};
}
