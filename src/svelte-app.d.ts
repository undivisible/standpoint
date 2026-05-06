// Manual type declarations for SvelteKit modules
declare module '$app/stores' {
	import type { Readable } from 'svelte/store';
	import type { Page } from '@sveltejs/kit';
	export const page: Readable<Page>;
	export const navigating: Readable<any>;
	export const updated: Readable<boolean>;
}

declare module '$app/navigation' {
	export function goto(
		url: string | URL,
		opts?: {
			replaceState?: boolean;
			noScroll?: boolean;
			keepFocus?: boolean;
			invalidateAll?: boolean;
			state?: any;
		}
	): Promise<void>;
	export function invalidate(dependency?: string | URL | ((url: URL) => boolean)): Promise<void>;
	export function invalidateAll(): Promise<void>;
	export function preloadData(href: string): Promise<void>;
	export function preloadCode(...hrefs: string[]): Promise<void>;
	export function beforeNavigate(callback: (navigation: any) => void): void;
	export function afterNavigate(callback: (navigation: any) => void): void;
	export function pushState(url: string | URL, state: any): void;
	export function replaceState(url: string | URL, state: any): void;
}

// Type declarations for SvelteKit generated types
declare module './$types' {
	export interface PageLoad {
		(params: { url: URL; parent: () => Promise<any> }): Promise<any> | any;
	}
	export interface LayoutLoad {
		(params: { url: URL }): Promise<any> | any;
	}
}

// Type declarations for $lib modules
declare module '$lib/stores' {
	import type { Writable } from 'svelte/store';
	import type { User } from '$lib/firebase';
	export const currentUser: Writable<User | null>;
	export const userGroup: Writable<string | null>;
	export interface ImageResult {
		url: string;
		title: string;
		thumbnailLink: string;
		image?: string;
		link?: string;
		snippet?: string;
	}
	export const resultImages: Writable<ImageResult[]>;
	export function signInWithGoogle(): Promise<void>;
	export function signOutUser(): Promise<void>;
}

declare module '$lib/search' {
	export function searchTierlists(searchQuery: string): Promise<any[]>;
	export function searchPolls(searchQuery: string): Promise<any[]>;
	export function searchUsers(searchQuery: string): Promise<any[]>;
	export function getSearchSuggestions(): string[];
	export function searchAll(searchQuery: string): Promise<{
		tierlists: any[];
		polls: any[];
		users: any[];
	}>;
}

declare module '$lib/user-profile' {
	export interface UserProfile {
		uid: string;
		displayName: string;
		email: string;
		photoURL: string;
		createdAt: number;
		updatedAt: number;
		[key: string]: any;
	}
	export function getUserProfile(uid: string): Promise<UserProfile | null>;
	export function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void>;
}

declare module '$lib/firestore-polls-tierlists' {
	export function getUserDrafts(uid: string): Promise<any[]>;
	export function savePollToFirestore(pollData: any): Promise<any>;
	export function getPollsFromFirestore(): Promise<any[]>;
	export function getTierlistsFromFirestore(): Promise<any[]>;
	export function saveTierlistToFirestore(tierlistData: any): Promise<any>;
	export function updatePollInFirestore(pollId: string, updates: any): Promise<void>;
	export function deletePollFromFirestore(pollId: string): Promise<void>;
	export function getPollById(pollId: string): Promise<any>;
	export function getTierlistById(tierlistId: string): Promise<any>;
}
