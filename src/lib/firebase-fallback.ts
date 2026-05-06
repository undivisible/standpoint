import { apiDelete, apiGet, apiPatch, apiPost } from './cloudflare-api';
import type {
	PollCreate,
	PollResponse,
	TierListCreate,
	TierListResponse,
	TierListUpdate
} from './types';

export class FirebaseFallbackClient {
	async healthCheck() {
		return { status: 'ok', backend: 'cloudflare' };
	}

	async getPolls(): Promise<PollResponse[]> {
		const data = await apiGet<{ items: PollResponse[] }>('polls');
		return data.items;
	}

	async getPoll(id: string): Promise<PollResponse> {
		return apiGet<PollResponse>(`polls/${encodeURIComponent(id)}`);
	}

	async createPoll(poll: PollCreate): Promise<PollResponse> {
		const data = await apiPost<{ id: string }>('polls', poll);
		return this.getPoll(data.id);
	}

	async vote(pollId: string, position: number, additionalData?: any): Promise<PollResponse> {
		await apiPost(`polls/${encodeURIComponent(pollId)}/votes`, {
			userId: additionalData?.userId || 'anonymous',
			position,
			position_2d: additionalData?.position_2d
		});
		return this.getPoll(pollId);
	}

	async deletePoll(pollId: string): Promise<void> {
		await apiDelete(`polls/${encodeURIComponent(pollId)}`);
	}

	async getTierLists(): Promise<TierListResponse[]> {
		const data = await apiGet<{ items: TierListResponse[] }>('tierlists');
		return data.items;
	}

	async getTierList(id: string): Promise<TierListResponse> {
		return apiGet<TierListResponse>(`tierlists/${encodeURIComponent(id)}`);
	}

	async createTierList(tierList: TierListCreate): Promise<TierListResponse> {
		const data = await apiPost<{ id: string }>('tierlists', tierList);
		return this.getTierList(data.id);
	}

	async updateTierList(id: string, tierList: TierListUpdate): Promise<TierListResponse> {
		return apiPatch<TierListResponse>(`tierlists/${encodeURIComponent(id)}`, tierList);
	}

	async deleteTierList(id: string): Promise<void> {
		await apiDelete(`tierlists/${encodeURIComponent(id)}`);
	}
}

export const firebaseFallbackClient = new FirebaseFallbackClient();
