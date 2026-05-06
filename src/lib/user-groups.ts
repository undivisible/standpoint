// All users are regular users now - no paid plan.
// These functions remain as no-ops for backward compatibility with existing code.

export async function getUserGroup(_uid: string): Promise<string | null> {
	return 'user';
}

export async function setUserGroup(_uid: string, _group: string) {
	// no-op — all users are free
}
