import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

import { auth, firebaseUser, db } from './firebase';
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { setAccent } from './accent';
import { getUserGroup, setUserGroup } from './user-groups';

export interface ImageResult {
	url: string;
	title: string;
	thumbnailLink: string;
	image?: string;
	link?: string;
	snippet?: string;
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
	if (browser && $firebaseUser) {
		getDoc(doc(db, 'users', $firebaseUser.uid)).then((userDoc) => {
			set(userDoc.exists() ? { ...userDoc.data(), id: $firebaseUser.uid } : null);
		});
	} else {
		set(null);
	}
});

// Listen for auth state changes (only in browser)
if (browser) {
	onAuthStateChanged(auth, async (user) => {
		currentUser.set(user);
		if (user) {
			userGroup.set('user');
			// Load user preferences (accent/theme)
			try {
				const snap = await getDoc(doc(db, 'users', user.uid));
				if (snap.exists()) {
					const prefs = (snap.data() as any)?.preferences;
					if (prefs?.accent) setAccent(prefs.accent);
					// If the user has per-theme accents stored in preferences, copy them
					// into localStorage so the theme system picks them up on the client.
					if (prefs?.themeAccents) {
						try {
							localStorage.setItem('standpoint_theme_accents', JSON.stringify(prefs.themeAccents));
						} catch (e) {
							console.warn('Failed to sync theme accents to localStorage', e);
						}
					}
				}
			} catch (e) {
				console.warn('Failed loading user prefs', e);
			}
		} else {
			userGroup.set(null);
		}
	});
}

// Helper to persist theme mode (light/dark)
export async function persistThemeMode(mode: 'light' | 'dark') {
	if (!browser) return;
	const user = auth.currentUser;
	if (!user) return;
	try {
		await setDoc(doc(db, 'users', user.uid), { preferences: { theme: mode } }, { merge: true });
	} catch (e) {
		console.warn('Failed to persist theme mode', e);
	}
}

// Sign in with Google
export async function signInWithGoogle() {
	if (!browser) return;
	const provider = new GoogleAuthProvider();
	await signInWithPopup(auth, provider);
}

// Sign out
export async function signOutUser() {
	if (!browser) return;
	await signOut(auth);
}
