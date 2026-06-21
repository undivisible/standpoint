import { apiDelete, apiGet, apiPatch, apiPost } from './cloudflare-api';

export const apiClient = {
	getPolls() {
		return apiGet<{ items: import('./types').PollResponse[] }>('polls');
	},

	getPoll(id: string) {
		return apiGet<import('./types').PollResponse>(`polls/${id}`);
	},

	createPoll(poll: import('./types').PollCreate) {
		return apiPost<{ id: string }>('polls', poll);
	},

	vote(
		pollId: string,
		position: number,
		additionalData?: import('./types').VoteCreate | Record<string, unknown>
	) {
		return apiPost<{ user_vote?: number; user_vote_2d?: { x: number; y: number } }>(
			`polls/${pollId}/votes`,
			{ ...(additionalData || {}), position }
		);
	},

	deletePoll(pollId: string) {
		return apiDelete(`polls/${pollId}`);
	},

	getTierLists() {
		return apiGet<{ items: import('./types').TierListResponse[] }>('tierlists');
	},

	getTierList(id: string) {
		return apiGet<import('./types').TierListResponse>(`tierlists/${id}`);
	},

	createTierList(tierList: import('./types').TierListCreate) {
		return apiPost<{ id: string }>('tierlists', tierList);
	},

	updateTierListPlacements(tierListId: string, update: import('./types').TierListUpdate) {
		return apiPatch<import('./types').TierListResponse>(`tierlists/${tierListId}`, update);
	},

	deleteTierList(tierListId: string) {
		return apiDelete(`tierlists/${tierListId}`);
	},

	updateTierList(id: string, tierList: any) {
		return apiPatch<import('./types').TierListResponse>(`tierlists/${id}`, tierList);
	}
};
