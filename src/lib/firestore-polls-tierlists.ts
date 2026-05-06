export interface TierlistData {
	id: string;
	title: string;
	description?: string;
	thumbnail?: string;
	banner_image?: string;
	bannerImage?: string;
	owner: string;
	ownerDisplayName?: string;
	created_at: any;
	updated_at?: any;
	last_edited?: any;
	likes?: number;
	comments?: number;
	forks?: number;
	visibility?: 'public' | 'unlisted' | 'private';
	status?: 'draft' | 'published';
	items?: any[];
	tiers?: any[];
	placements?: any[];
	originalId?: string;
	original_id?: string;
	isForked?: boolean;
	isGuest?: boolean;
}

export interface PollData {
	id: string;
	title: string;
	description?: string;
	owner: string;
	created_at: any;
	updated_at?: any;
	likes?: number;
	comments?: number;
	totalVotes?: number;
	stats?: any;
	options?: any[];
	response_type?: number;
	visibility?: 'public' | 'unlisted' | 'private';
	status?: 'draft' | 'published';
	user_vote?: number;
	user_vote_2d?: { x: number; y: number };
}

export interface Poll {
	question?: string;
	title?: string;
	options?: string[];
	createdAt?: Date;
	id?: string;
	[key: string]: unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		...init,
		headers: {
			...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
			...(init?.headers || {})
		}
	});
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as T;
}

export async function savePollToFirestore(poll: Poll): Promise<string> {
	const data = await request<{ id: string }>('/api/cloudflare/polls', {
		method: 'POST',
		body: JSON.stringify(poll)
	});
	return data.id;
}

export async function getPollsFromFirestore() {
	const data = await request<{ items: PollData[] }>('/api/cloudflare/polls?status=published');
	return data.items;
}

export async function saveTierlistToFirestore(tierlist: Record<string, unknown>) {
	const data = await request<{ id: string }>('/api/cloudflare/tierlists', {
		method: 'POST',
		body: JSON.stringify({ ...tierlist, status: 'published' })
	});
	return data.id;
}

export async function saveTierlistUnlisted(tierlist: Record<string, unknown>, asDraft = false) {
	const data = await request<{ id: string }>('/api/cloudflare/tierlists', {
		method: 'POST',
		body: JSON.stringify({
			...tierlist,
			status: asDraft ? 'draft' : 'published',
			visibility: 'unlisted'
		})
	});
	return data.id;
}

export async function getTierlistsFromFirestore(limitCount = 20) {
	const data = await request<{ items: TierlistData[] }>(
		`/api/cloudflare/tierlists?status=published&limit=${limitCount}`
	);
	return data.items.filter((tierlist) => !tierlist.isGuest && tierlist.visibility !== 'unlisted');
}

export async function getTierlist(tierlistId: string): Promise<TierlistData | null> {
	return request<TierlistData | null>(`/api/cloudflare/tierlists/${tierlistId}`);
}

export async function getUserTierlists(userId: string): Promise<TierlistData[]> {
	const data = await request<{ items: TierlistData[] }>(
		`/api/cloudflare/tierlists?owner=${encodeURIComponent(userId)}`
	);
	return data.items.filter(
		(tierlist) => (!tierlist.status || tierlist.status === 'published') && !tierlist.isGuest
	);
}

export async function getUserPolls(userId: string): Promise<PollData[]> {
	const data = await request<{ items: PollData[] }>(
		`/api/cloudflare/polls?owner=${encodeURIComponent(userId)}`
	);
	return data.items.filter((poll) => !poll.status || poll.status === 'published');
}

export async function saveTierlistDraft(tierlist: Record<string, unknown>): Promise<string> {
	const data = await request<{ id: string }>('/api/cloudflare/tierlists', {
		method: 'POST',
		body: JSON.stringify({ ...tierlist, status: 'draft' })
	});
	return data.id;
}

export async function publishTierlist(tierlistId: string): Promise<void> {
	await request(`/api/cloudflare/tierlists/${tierlistId}`, {
		method: 'PATCH',
		body: JSON.stringify({ status: 'published' })
	});
}

export async function updateTierlist(
	tierlistId: string,
	updates: Record<string, unknown>
): Promise<void> {
	await request(`/api/cloudflare/tierlists/${tierlistId}`, {
		method: 'PATCH',
		body: JSON.stringify(updates)
	});
}

export async function getUserDrafts(userId: string): Promise<TierlistData[]> {
	const data = await request<{ items: TierlistData[] }>(
		`/api/cloudflare/tierlists?owner=${encodeURIComponent(userId)}`
	);
	return data.items.filter((tierlist) => tierlist.status === 'draft');
}

export async function getUserPublishedTierlists(userId: string): Promise<TierlistData[]> {
	return getUserTierlists(userId);
}

export async function savePollDraft(poll: Poll): Promise<string> {
	const data = await request<{ id: string }>('/api/cloudflare/polls', {
		method: 'POST',
		body: JSON.stringify({ ...poll, status: 'draft' })
	});
	return data.id;
}

export async function publishPoll(pollId: string): Promise<void> {
	await updatePollInFirestore(pollId, { status: 'published' });
}

export async function updatePoll(pollId: string, updates: Record<string, unknown>): Promise<void> {
	await updatePollInFirestore(pollId, updates);
}

export async function updatePollInFirestore(pollId: string, updates: any): Promise<void> {
	await request(`/api/cloudflare/polls/${pollId}`, {
		method: 'PATCH',
		body: JSON.stringify(updates)
	});
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
	await request(`/api/cloudflare/polls/${pollId}`, { method: 'DELETE' });
}

export async function deleteTierlistFromFirestore(tierlistId: string): Promise<void> {
	await request(`/api/cloudflare/tierlists/${tierlistId}`, { method: 'DELETE' });
}

export async function forkTierlist(originalTierlistId: string, userId: string): Promise<string> {
	const data = await request<{ id: string }>(
		`/api/cloudflare/tierlists/${originalTierlistId}/forks`,
		{
			method: 'POST',
			body: JSON.stringify({ userUid: userId })
		}
	);
	return data.id;
}

export async function getTierlistForks(originalTierlistId: string): Promise<TierlistData[]> {
	const data = await request<{ items: TierlistData[] }>(
		`/api/cloudflare/tierlists?originalId=${encodeURIComponent(originalTierlistId)}`
	);
	return data.items.filter((tierlist) => tierlist.status === 'published');
}

export async function getUserForkedTierlists(userId: string): Promise<TierlistData[]> {
	const data = await request<{ items: TierlistData[] }>(
		`/api/cloudflare/tierlists?owner=${encodeURIComponent(userId)}`
	);
	return data.items.filter((tierlist) => tierlist.isForked);
}

export async function getTierlistInteractions(tierlistId: string) {
	const data = await request<{ likes: number; comments: number; forks: number }>(
		`/api/cloudflare/tierlists/${tierlistId}/interactions`
	);
	return data;
}

export async function likeTierlist(tierlistId: string, userId: string) {
	return request<{ liked: boolean; count: number }>(
		`/api/cloudflare/tierlists/${tierlistId}/likes`,
		{
			method: 'POST',
			body: JSON.stringify({ userId })
		}
	);
}

export async function unlikeTierlist(tierlistId: string, userId: string) {
	return request<{ liked: boolean; count: number }>(
		`/api/cloudflare/tierlists/${tierlistId}/likes?userId=${encodeURIComponent(userId)}`,
		{ method: 'DELETE' }
	);
}

export async function hasUserLikedTierlist(tierlistId: string, userId: string) {
	const data = await request<{ liked: boolean }>(
		`/api/cloudflare/tierlists/${tierlistId}/likes?userId=${encodeURIComponent(userId)}`
	);
	return data.liked;
}

export async function likePoll(pollId: string, userId: string) {
	return request<{ liked: boolean; count: number }>(`/api/cloudflare/polls/${pollId}/likes`, {
		method: 'POST',
		body: JSON.stringify({ userId })
	});
}

export async function unlikePoll(pollId: string, userId: string) {
	return request<{ liked: boolean; count: number }>(
		`/api/cloudflare/polls/${pollId}/likes?userId=${encodeURIComponent(userId)}`,
		{ method: 'DELETE' }
	);
}

export async function hasUserLikedPoll(pollId: string, userId: string) {
	const data = await request<{ liked: boolean }>(
		`/api/cloudflare/polls/${pollId}/likes?userId=${encodeURIComponent(userId)}`
	);
	return data.liked;
}

export async function saveUserVote(
	pollId: string,
	userId: string,
	position: number,
	position2D?: { x: number; y: number }
) {
	await request(`/api/cloudflare/polls/${pollId}/votes`, {
		method: 'POST',
		body: JSON.stringify({ userId, position, position_2d: position2D })
	});
}

export async function getUserVote(
	pollId: string,
	userId: string
): Promise<{ position: number; position_2d?: { x: number; y: number } } | null> {
	const data = await request<{ position: number; position_2d?: { x: number; y: number } } | null>(
		`/api/cloudflare/polls/${pollId}/votes?userId=${encodeURIComponent(userId)}`
	);
	return data;
}

export async function updatePollStatistics(pollId: string): Promise<void> {
	await request(`/api/cloudflare/polls/${pollId}/stats`, {
		method: 'PATCH',
		body: JSON.stringify({})
	});
}
