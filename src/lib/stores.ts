import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

import { auth, firebaseUser, type User } from './firebase';
import { apiPatch, getSessionUser } from './cloudflare-api';
import { setAccent } from './accent';

export interface ImageResult {
	url: string;
	title: string;
	thumbnailLink: string;
	image?: string;
	link?: string;
	snippet?: string;
	creator?: string;
	license?: string;
	licenseUrl?: string;
}

// Store for holding image search results
export const resultImages = writable<ImageResult[]>([]);
// Loading state for image searches
export const imageSearchLoading = writable<boolean>(false);

// Store for current user
export const currentUser = firebaseUser;

// Store for user group — always 'user' (no paid plan)
export const userGroup = writable<string | null>(null);
export const hasProAccessStore = writable(true);

// Derived store for current user profile
export const currentUserProfile = derived(firebaseUser, ($firebaseUser, set) => {
	set($firebaseUser);
});

async function loadSession() {
	if (!browser) return;
	try {
		const user = await getSessionUser();
		currentUser.set(user);
		auth.currentUser = user;
		userGroup.set(user?.userGroup ?? (user ? 'user' : null));
		const prefs = user?.preferences;
		if (prefs?.accent) setAccent(String(prefs.accent));
		// If the user has per-theme accents stored in preferences, copy them
		// into localStorage so the theme system picks them up on the client.
		if (prefs?.themeAccents) {
			try {
				localStorage.setItem('standpoint_theme_accents', JSON.stringify(prefs.themeAccents));
			} catch (e) {
				console.warn('Failed to sync theme accents to localStorage', e);
			}
		}
	} catch (e) {
		console.warn('Failed loading user prefs', e);
		currentUser.set(null);
		userGroup.set(null);
	}
}

export async function refreshSession() {
	await loadSession();
	return auth.currentUser;
}

// Listen for auth state changes (only in browser)
if (browser) {
	loadSession();
}

// Helper to persist theme mode (light/dark)
export async function persistThemeMode(mode: 'light' | 'dark') {
	if (!browser) return;
	const user = auth.currentUser;
	if (!user) return;
	try {
		await apiPatch(`users/${encodeURIComponent(user.uid)}`, { preferences: { theme: mode } });
	} catch (e) {
		console.warn('Failed to persist theme mode', e);
	}
}

// Sign in with Google
export async function signInWithGoogle() {
	if (!browser) return;
	const redirectTo = encodeURIComponent(location.pathname + location.search);
	location.href = `/api/auth/google/start?redirectTo=${redirectTo}`;
}

// Sign out
export async function signOutUser() {
	if (!browser) return;
	await fetch('/api/auth/session', { method: 'DELETE' });
	currentUser.set(null);
	auth.currentUser = null;
	userGroup.set(null);
}

export type { User };
