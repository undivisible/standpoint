import { apiDelete, apiGet, apiPatch, apiPost } from './cloudflare-api';

class ApiClient {
	async healthCheck() {
		return { status: 'ok', backend: 'cloudflare' };
	}

	async getPolls() {
		return apiGet<{ items: import('./types').PollResponse[] }>('polls');
	}

	async getPoll(id: string) {
		return apiGet<import('./types').PollResponse>(`polls/${id}`);
	}

	async createPoll(poll: import('./types').PollCreate) {
		return apiPost<{ id: string }>('polls', poll);
	}

	async vote(
		pollId: string,
		position: number,
		additionalData?: import('./types').VoteCreate | Record<string, unknown>
	) {
		return apiPost<{ user_vote?: number; user_vote_2d?: { x: number; y: number } }>(
			`polls/${pollId}/votes`,
			{ ...(additionalData || {}), position }
		);
	}

	async deletePoll(pollId: string) {
		return apiDelete(`polls/${pollId}`);
	}

	async getTierLists() {
		return apiGet<{ items: import('./types').TierListResponse[] }>('tierlists');
	}

	async getTierList(id: string) {
		return apiGet<import('./types').TierListResponse>(`tierlists/${id}`);
	}

	async createTierList(tierList: import('./types').TierListCreate) {
		return apiPost<{ id: string }>('tierlists', tierList);
	}

	async updateTierListPlacements(tierListId: string, update: import('./types').TierListUpdate) {
		return apiPatch<import('./types').TierListResponse>(`tierlists/${tierListId}`, update);
	}

	async deleteTierList(tierListId: string) {
		return apiDelete(`tierlists/${tierListId}`);
	}

	async updateTierList(id: string, tierList: any) {
		return apiPatch<import('./types').TierListResponse>(`tierlists/${id}`, tierList);
	}
}

export const apiClient = new ApiClient();
export { apiClient as default };
