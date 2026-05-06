import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Firebase config from environment variables
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only in browser
let app = undefined as unknown as FirebaseApp;
let db = undefined as unknown as Firestore;
let auth = undefined as unknown as Auth;
let storage = undefined as unknown as FirebaseStorage;

export const hasFirebaseConfig = Boolean(
	firebaseConfig.apiKey &&
		firebaseConfig.apiKey !== 'undefined' &&
		firebaseConfig.authDomain &&
		firebaseConfig.authDomain !== 'undefined' &&
		firebaseConfig.projectId &&
		firebaseConfig.projectId !== 'undefined' &&
		firebaseConfig.storageBucket &&
		firebaseConfig.storageBucket !== 'undefined' &&
		firebaseConfig.messagingSenderId &&
		firebaseConfig.messagingSenderId !== 'undefined' &&
		firebaseConfig.appId
);

if (browser && hasFirebaseConfig) {
	app = initializeApp(firebaseConfig);
	db = getFirestore(app);
	auth = getAuth(app);
	storage = getStorage(app);

	// Set up auth state listener
	onAuthStateChanged(auth, (user) => {
		firebaseUser.set(user);
	});
}

export { app, db, auth, storage };

// Svelte store for the current Firebase user
export const firebaseUser = writable<User | null>(null);
