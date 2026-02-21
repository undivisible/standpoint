import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getUserGroup(uid: string): Promise<string | null> {
	if (!uid) {
		return null;
	}
	const userDoc = await getDoc(doc(db, 'users', uid));
	if (userDoc.exists()) {
		return userDoc.data().group || null;
	}
	return null;
}

export async function setUserGroup(uid: string, group: string) {
	await setDoc(doc(db, 'users', uid), { group }, { merge: true });
}

export async function setUserAsDeveloper(uid: string) {
	await setUserGroup(uid, 'dev');
}

export async function setUserAsPro(uid: string) {
	await setUserGroup(uid, 'pro');
}

export async function setUserAsRegular(uid: string) {
	await setUserGroup(uid, 'user');
}

// Check if user has pro privileges (either pro or developer)
export async function hasProPrivileges(uid: string): Promise<boolean> {
	const group = await getUserGroup(uid);
	return group === 'pro' || group === 'dev';
}
