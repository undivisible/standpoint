export type AppUser = {
	id: string;
	uid: string;
	email?: string | null;
	displayName?: string | null;
	photoURL?: string | null;
	bannerURL?: string | null;
	userGroup?: string | null;
	isAdmin?: boolean;
	preferences?: Record<string, unknown>;
};

type UserRow = {
	uid: string;
	email?: string | null;
	display_name?: string | null;
	photo_url?: string | null;
	banner_url?: string | null;
	user_group?: string | null;
	preferences?: string | null;
	data?: string | null;
};

export function randomId(prefix: string) {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function clean(value: unknown, fallback = '', max = 160) {
	return String(value || fallback)
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s.,!?'"()/_@:-]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

export function jsonParse<T>(value: unknown, fallback: T): T {
	if (typeof value !== 'string') return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

export function toTimestamp(value?: unknown) {
	const date = value ? new Date(String(value)) : new Date();
	return {
		seconds: Math.floor(date.getTime() / 1000),
		nanoseconds: 0,
		toDate: () => date,
		toMillis: () => date.getTime()
	};
}

export function mapUser(row: UserRow): AppUser {
	const data = jsonParse<Record<string, unknown>>(row.data, {});
	return {
		id: row.uid,
		uid: row.uid,
		email: row.email ?? null,
		displayName: row.display_name ?? (data.displayName as string | undefined) ?? null,
		photoURL: row.photo_url ?? (data.photoURL as string | undefined) ?? null,
		bannerURL: row.banner_url ?? (data.bannerURL as string | undefined) ?? null,
		userGroup: row.user_group ?? null,
		isAdmin: row.user_group === 'admin',
		preferences: jsonParse(row.preferences, {})
	};
}

export async function getSessionUser(
	db: D1Database,
	cookies: { get(name: string): string | undefined }
) {
	const sessionId = cookies.get('spectrum_session');
	if (!sessionId) return null;
	const row = await db
		.prepare(
			"SELECT users.uid, users.email, users.display_name, users.photo_url, users.banner_url, users.user_group, users.data, preferences.data AS preferences FROM sessions JOIN users ON users.uid = sessions.user_id LEFT JOIN preferences ON preferences.user_id = users.uid WHERE sessions.id = ? AND sessions.expires_at > datetime('now')"
		)
		.bind(sessionId)
		.first<UserRow>();
	return row ? mapUser(row) : null;
}

export function serializeRow(row: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(row).map(([key, value]) => [
			key,
			typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))
				? jsonParse(value, value)
				: value
		])
	);
}

export function cleanUndefinedValues(obj: any): any {
	if (obj === null || obj === undefined) return null;
	if (Array.isArray(obj)) return obj.map(cleanUndefinedValues).filter((item) => item !== undefined);
	if (typeof obj === 'object') {
		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) cleaned[key] = cleanUndefinedValues(value);
		}
		return cleaned;
	}
	return obj;
}

export function parseData<T>(value: unknown, fallback: T): T {
	return jsonParse(value, fallback);
}

export function mapPoll(input: unknown): any {
	const row = input as Record<string, any>;
	const data = parseData<Record<string, unknown>>(row.data, {});
	const stats = parseData<Record<string, unknown>>(row.stats_json, {});
	const options = parseData<unknown[]>(row.options_json, []);
	const gradients = row.gradients_json ? parseData(row.gradients_json, null) : undefined;
	return {
		...data,
		id: row.id,
		title: row.title,
		description: row.description,
		owner: row.owner || 'anonymous',
		status: row.status,
		visibility: row.visibility,
		response_type: row.response_type || data.response_type || 1,
		options,
		stats,
		gradients,
		likes: row.likes || 0,
		comments: row.comments || 0,
		totalVotes: row.total_votes || 0,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

export function mapTierlist(input: unknown): any {
	const row = input as Record<string, any>;
	const data = parseData<Record<string, unknown>>(row.data, {});
	const ownerDisplayName =
		row.owner_display_name || data.ownerDisplayName || data.owner_displayName || data.author;
	return {
		...data,
		id: row.id,
		title: row.title,
		description: row.description,
		owner: row.owner || 'anonymous',
		owner_displayName: ownerDisplayName,
		ownerDisplayName,
		author: ownerDisplayName,
		status: row.status,
		visibility: row.visibility,
		list_type: row.list_type,
		tiers: parseData(row.tiers_json, []),
		items: parseData(row.items_json, []),
		item_placements: parseData(row.placements_json, []),
		banner_image: row.banner_image,
		likes: row.likes || 0,
		comments: row.comments || 0,
		forks: row.forks || 0,
		isForked: Boolean(row.is_forked),
		originalId: row.original_id,
		isGuest: Boolean(row.is_guest),
		created_at: row.created_at,
		updated_at: row.updated_at,
		last_edited: row.last_edited
	};
}
