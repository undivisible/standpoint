// Type definitions for API models
export interface PollCreate {
	title: string;
	description?: string;
	response_type: number;
	options: string[];
}

export interface VoteCreate {
	poll_id: string;
	position: number;
}

export interface PollStats {
	[x: string]: any;
	average: number;
	std_dev: number;
	total_votes: number;
	vote_positions: number[];
	vote_positions_2d?: Array<{ x: number; y: number }>;
	average_2d?: [number, number];
	median_x?: number;
	median_y?: number;
	mode_x?: number;
	mode_y?: number;
	range_x?: number;
	range_y?: number;
}

export interface PollResponse {
	id: string;
	title: string;
	description?: string;
	response_type: number;
	options: string[];
	stats: PollStats;
	user_vote?: number;
	user_vote_2d?: { x: number; y: number };
	created_at: string;
	owner: string;
	gradients?: {
		colors: string[];
		enabled: boolean;
	};
}

export interface TierCreate {
	name: string;
	position: number;
	color?: string;
	labelColor?: string;
	label_color?: string;
	items?: TierItem[];
}

export interface TierItem {
	id: string;
	text: string;
	name?: string;
	url?: string;
	image?: string;
	type: 'text' | 'image' | 'search';
	position?: { x: number; y: number };
	size?: { width: number; height: number };
	naturalSize?: { width: number; height: number };
}

export interface ItemPlacement {
	item_id: string;
	tier_position: number;
	position?: { x: number; y: number };
	size?: { width: number; height: number };
}

export interface TierListCreate {
	title: string;
	description?: string;
	list_type?: 'classic' | 'dynamic';
	tiers: TierCreate[];
	items: TierItem[];
}

export interface TierListResponse {
	id: string;
	title: string;
	description?: string;
	list_type: string;
	tiers: TierCreate[];
	items: TierItem[];
	created_at: string;
	updated_at?: string;
	owner: string;
	owner_displayName?: string;
	redirectUids?: string[];
	item_placements: ItemPlacement[];
	likes?: number;
	comments?: number;
	forks?: number;
	banner_image?: string;
	isForked?: boolean;
	originalId?: string;
	author?: string;
}

export interface TierListUpdate {
	title?: string;
	description?: string;
	list_type?: string;
	tiers?: TierCreate[];
	items?: TierItem[];
	item_placements?: ItemPlacement[];
}
