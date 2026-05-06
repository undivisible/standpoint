import { writable } from 'svelte/store';
import type { AppUser } from './cloudflare-api';

export type User = AppUser;

export const hasFirebaseConfig = true;
export const firebaseUser = writable<User | null>(null);
export const auth = {
	currentUser: null as User | null
};
export const db = {};
export const storage = {};
export const app = {};

firebaseUser.subscribe((user) => {
	auth.currentUser = user;
});
