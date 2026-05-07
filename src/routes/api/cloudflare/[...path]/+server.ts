import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	cleanUndefinedValues,
	mapPoll,
	mapTierlist,
	mapUser,
	randomId,
	parseData,
	clean,
	getSessionUser,
	type AppUser
} from '$lib/server/cloudflare-data';

function db(platform: App.Platform | undefined) {
	if (!platform?.env?.DB) throw error(503, 'D1 is not configured');
	return platform.env.DB;
}

function parts(params: { path?: string }) {
	return (params.path || '').split('/').filter(Boolean);
}

async function body(request: Request) {
	return cleanUndefinedValues(await request.json());
}

async function requireUser(
	database: D1Database,
	cookies: { get(name: string): string | undefined }
) {
	const user = await getSessionUser(database, cookies);
	if (!user) throw error(401, 'Sign in required');
	return user;
}

function assertOwner(user: AppUser, owner: unknown) {
	if (owner !== user.uid) throw error(403, 'Not allowed');
}

function limit(url: URL) {
	const value = Number(url.searchParams.get('limit') || '50');
	return Math.max(1, Math.min(100, Number.isFinite(value) ? value : 50));
}

async function getPoll(database: D1Database, id: string) {
	const row = await database
		.prepare('SELECT * FROM polls WHERE id = ?')
		.bind(id)
		.first<Record<string, unknown>>();
	return row ? mapPoll(row) : null;
}

async function getTierlist(database: D1Database, id: string) {
	const row = await database
		.prepare('SELECT * FROM tierlists WHERE id = ?')
		.bind(id)
		.first<Record<string, unknown>>();
	return row ? mapTierlist(row) : null;
}

async function updatePollStats(database: D1Database, pollId: string) {
	const votes = await database
		.prepare('SELECT position, position_2d FROM poll_votes WHERE poll_id = ?')
		.bind(pollId)
		.all<{ position: number; position_2d?: string | null }>();
	const votePositions = (votes.results || []).map((vote) => Number(vote.position));
	const votePositions2D = (votes.results || [])
		.map((vote) => parseData<{ x: number; y: number } | null>(vote.position_2d, null))
		.filter((vote): vote is { x: number; y: number } => Boolean(vote));
	const totalVotes = votePositions.length;
	const average = totalVotes ? votePositions.reduce((sum, vote) => sum + vote, 0) / totalVotes : 0;
	const stdDev = totalVotes
		? Math.sqrt(
				votePositions.reduce((sum, vote) => sum + Math.pow(vote - average, 2), 0) / totalVotes
			)
		: 0;
	const average2D =
		votePositions2D.length > 0
			? [
					votePositions2D.reduce((sum, vote) => sum + vote.x, 0) / votePositions2D.length,
					votePositions2D.reduce((sum, vote) => sum + vote.y, 0) / votePositions2D.length
				]
			: null;
	const stats = {
		average,
		std_dev: stdDev,
		total_votes: totalVotes,
		vote_positions: votePositions,
		vote_positions_2d: votePositions2D,
		...(average2D && { average_2d: average2D })
	};
	await database
		.prepare(
			'UPDATE polls SET stats_json = ?, total_votes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		)
		.bind(JSON.stringify(stats), totalVotes, pollId)
		.run();
	return stats;
}

async function listComments(database: D1Database, contentType: string, contentId: string) {
	const rows = await database
		.prepare(
			'SELECT * FROM comments WHERE content_type = ? AND content_id = ? ORDER BY created_at DESC'
		)
		.bind(contentType, contentId)
		.all<Record<string, unknown>>();
	return (rows.results || []).map((row) => ({
		...parseData(row.data, {}),
		id: row.id,
		text: row.text,
		author: row.user_display_name,
		authorUid: row.user_id,
		userId: row.user_id,
		userDisplayName: row.user_display_name,
		userPhotoURL: row.user_photo_url,
		timestamp: row.created_at,
		createdAt: row.created_at
	}));
}

async function likeCount(database: D1Database, contentType: string, contentId: string) {
	const row = await database
		.prepare('SELECT COUNT(*) AS count FROM likes WHERE content_type = ? AND content_id = ?')
		.bind(contentType, contentId)
		.first<{ count: number }>();
	return row?.count || 0;
}

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const database = db(platform);
	const path = parts(params);
	const [resource, id, child] = path;

	if (resource === 'session') {
		const session = await fetch(`${url.origin}/api/auth/session`, { headers: { cookie: '' } });
		return json(await session.json());
	}

	if (resource === 'polls' && !id) {
		const owner = url.searchParams.get('owner');
		const status = url.searchParams.get('status');
		const rows = owner
			? await database
					.prepare('SELECT * FROM polls WHERE owner = ? ORDER BY created_at DESC LIMIT ?')
					.bind(owner, limit(url))
					.all<Record<string, unknown>>()
			: status
				? await database
						.prepare('SELECT * FROM polls WHERE status = ? ORDER BY created_at DESC LIMIT ?')
						.bind(status, limit(url))
						.all<Record<string, unknown>>()
				: await database
						.prepare('SELECT * FROM polls ORDER BY created_at DESC LIMIT ?')
						.bind(limit(url))
						.all<Record<string, unknown>>();
		return json({ items: (rows.results || []).map(mapPoll) });
	}

	if (resource === 'polls' && id && !child) {
		const poll = await getPoll(database, id);
		if (!poll) throw error(404, 'Poll not found');
		return json(poll);
	}

	if (resource === 'polls' && id && child === 'votes') {
		const userId = url.searchParams.get('userId');
		if (userId) {
			const vote = await database
				.prepare('SELECT position, position_2d FROM poll_votes WHERE poll_id = ? AND user_id = ?')
				.bind(id, userId)
				.first<{ position: number; position_2d?: string | null }>();
			return json(
				vote ? { position: vote.position, position_2d: parseData(vote.position_2d, null) } : null
			);
		}
		const votes = await database
			.prepare('SELECT position, position_2d FROM poll_votes WHERE poll_id = ?')
			.bind(id)
			.all<{ position: number; position_2d?: string | null }>();
		const vote_positions = (votes.results || []).map((vote) => Number(vote.position));
		const vote_positions_2d = (votes.results || [])
			.map((vote) => parseData<{ x: number; y: number } | null>(vote.position_2d, null))
			.filter((vote): vote is { x: number; y: number } => Boolean(vote));
		return json({ vote_positions, vote_positions_2d, total_votes: vote_positions.length });
	}

	if (resource === 'polls' && id && child === 'likes') {
		const userId = url.searchParams.get('userId');
		const count = await likeCount(database, 'poll', id);
		const liked = userId
			? Boolean(
					await database
						.prepare(
							'SELECT user_id FROM likes WHERE content_type = ? AND content_id = ? AND user_id = ?'
						)
						.bind('poll', id, userId)
						.first()
				)
			: false;
		return json({ count, liked });
	}

	if (resource === 'polls' && id && child === 'comments')
		return json({ items: await listComments(database, 'poll', id) });

	if (resource === 'tierlists' && !id) {
		const owner = url.searchParams.get('owner');
		const status = url.searchParams.get('status');
		const originalId = url.searchParams.get('originalId');
		const rows = originalId
			? await database
					.prepare('SELECT * FROM tierlists WHERE original_id = ? ORDER BY created_at DESC LIMIT ?')
					.bind(originalId, limit(url))
					.all<Record<string, unknown>>()
			: owner
				? await database
						.prepare('SELECT * FROM tierlists WHERE owner = ? ORDER BY created_at DESC LIMIT ?')
						.bind(owner, limit(url))
						.all<Record<string, unknown>>()
				: status
					? await database
							.prepare('SELECT * FROM tierlists WHERE status = ? ORDER BY created_at DESC LIMIT ?')
							.bind(status, limit(url))
							.all<Record<string, unknown>>()
					: await database
							.prepare('SELECT * FROM tierlists ORDER BY created_at DESC LIMIT ?')
							.bind(limit(url))
							.all<Record<string, unknown>>();
		return json({ items: (rows.results || []).map(mapTierlist) });
	}

	if (resource === 'tierlists' && id && !child) {
		const tierlist = await getTierlist(database, id);
		if (!tierlist) throw error(404, 'Tierlist not found');
		return json(tierlist);
	}

	if (resource === 'tierlists' && id && child === 'likes') {
		const userId = url.searchParams.get('userId');
		const count = await likeCount(database, 'tierlist', id);
		const liked = userId
			? Boolean(
					await database
						.prepare(
							'SELECT user_id FROM likes WHERE content_type = ? AND content_id = ? AND user_id = ?'
						)
						.bind('tierlist', id, userId)
						.first()
				)
			: false;
		return json({ count, liked });
	}

	if (resource === 'tierlists' && id && child === 'comments')
		return json({ items: await listComments(database, 'tierlist', id) });

	if (resource === 'tierlists' && id && child === 'interactions') {
		const [likes, comments, forks] = await Promise.all([
			likeCount(database, 'tierlist', id),
			database
				.prepare('SELECT COUNT(*) AS count FROM comments WHERE content_type = ? AND content_id = ?')
				.bind('tierlist', id)
				.first<{ count: number }>(),
			database
				.prepare('SELECT COUNT(*) AS count FROM tierlists WHERE original_id = ?')
				.bind(id)
				.first<{ count: number }>()
		]);
		return json({ likes, comments: comments?.count || 0, forks: forks?.count || 0 });
	}

	if (resource === 'notifications' && !id) {
		const userId = url.searchParams.get('userId');
		if (!userId) return json({ items: [] });
		const rows = await database
			.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
			.bind(userId, limit(url))
			.all<Record<string, unknown>>();
		return json({
			items: (rows.results || []).map((row) => ({
				...parseData(row.data, {}),
				id: row.id,
				type: row.type,
				contentType: row.content_type,
				contentId: row.content_id,
				contentTitle: row.content_title,
				fromUserId: row.from_user_id,
				fromUserName: row.from_user_name,
				bundleKey: row.bundle_key,
				read: Boolean(row.read),
				timestamp: row.created_at
			}))
		});
	}

	if (resource === 'users' && id && !child) {
		const row = await database
			.prepare(
				"SELECT users.uid, users.email, users.display_name, users.photo_url, users.banner_url, users.data, preferences.data AS preferences FROM users LEFT JOIN preferences ON preferences.user_id = users.uid WHERE users.uid = ? OR json_extract(users.data, '$.customUid') = ? LIMIT 1"
			)
			.bind(id, id)
			.first<Record<string, unknown>>();
		if (!row) return json(null);
		return json({ ...parseData(row.data, {}), ...mapUser(row as any) });
	}

	if (resource === 'users' && id && child === 'followers') {
		const row = await database
			.prepare('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?')
			.bind(id)
			.first<{ count: number }>();
		return json({ count: row?.count || 0 });
	}

	if (resource === 'users' && id && child === 'following') {
		const target = url.searchParams.get('target');
		if (target) {
			const row = await database
				.prepare('SELECT follower_id FROM follows WHERE follower_id = ? AND following_id = ?')
				.bind(id, target)
				.first();
			return json({ following: Boolean(row) });
		}
		const row = await database
			.prepare('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?')
			.bind(id)
			.first<{ count: number }>();
		return json({ count: row?.count || 0 });
	}

	if (resource === 'notifications' && !id) {
		const userId = url.searchParams.get('userId');
		if (!userId) return json({ items: [] });
		const rows = await database
			.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
			.bind(userId, limit(url))
			.all<Record<string, unknown>>();
		return json({
			items: (rows.results || []).map((row) => ({
				...parseData(row.data, {}),
				id: row.id,
				type: row.type,
				contentType: row.content_type,
				contentId: row.content_id,
				contentTitle: row.content_title,
				fromUserId: row.from_user_id,
				fromUserName: row.from_user_name,
				bundleKey: row.bundle_key,
				read: Boolean(row.read),
				createdAt: row.created_at
			}))
		});
	}

	if (resource === 'search') {
		const q = (url.searchParams.get('q') || '').toLowerCase();
		const kind = url.searchParams.get('type') || 'all';
		const [tierlists, polls, users] = await Promise.all([
			kind === 'all' || kind === 'tierlists'
				? database
						.prepare('SELECT * FROM tierlists WHERE status = ? ORDER BY created_at DESC LIMIT 100')
						.bind('published')
						.all<Record<string, unknown>>()
				: Promise.resolve({ results: [] }),
			kind === 'all' || kind === 'polls'
				? database
						.prepare('SELECT * FROM polls WHERE status = ? ORDER BY created_at DESC LIMIT 100')
						.bind('published')
						.all<Record<string, unknown>>()
				: Promise.resolve({ results: [] }),
			kind === 'all' || kind === 'users'
				? database
						.prepare(
							'SELECT users.uid, users.email, users.display_name, users.photo_url, users.banner_url, users.data, preferences.data AS preferences FROM users LEFT JOIN preferences ON preferences.user_id = users.uid ORDER BY users.display_name LIMIT 100'
						)
						.all<Record<string, unknown>>()
				: Promise.resolve({ results: [] })
		]);
		return json({
			tierlists: (tierlists.results || [])
				.map(mapTierlist)
				.filter((item: any) =>
					`${item.title || ''} ${item.description || ''}`.toLowerCase().includes(q)
				)
				.slice(0, 20),
			polls: (polls.results || [])
				.map(mapPoll)
				.filter((item: any) =>
					`${item.title || ''} ${item.description || ''}`.toLowerCase().includes(q)
				)
				.slice(0, 20),
			users: (users.results || [])
				.map((row) => ({ ...parseData(row.data, {}), ...mapUser(row as any) }))
				.filter((item: any) =>
					`${item.displayName || ''} ${item.bio || ''}`.toLowerCase().includes(q)
				)
				.slice(0, 20)
		});
	}

	throw error(404, 'Not found');
};

export const POST: RequestHandler = async ({ params, platform, request, cookies }) => {
	const database = db(platform);
	const path = parts(params);
	const [resource, id, child] = path;
	const payload = await body(request);
	let user: AppUser | null = null;
	if (!(resource === 'polls' && !id)) {
		user = await requireUser(database, cookies);
	}

	if (resource === 'polls' && !id) {
		user = await getSessionUser(database, cookies);
		const pollId = randomId('poll');
		const stats = payload.stats || {
			average: 0,
			std_dev: 0,
			total_votes: 0,
			vote_positions: [],
			vote_positions_2d: []
		};
		await database
			.prepare(
				'INSERT INTO polls (id, title, description, owner, status, visibility, response_type, options_json, stats_json, gradients_json, likes, comments, total_votes, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				pollId,
				clean(payload.title || payload.question, 'Untitled poll', 240),
				payload.description || null,
				user?.uid ?? null,
				payload.status || 'published',
				payload.visibility || 'public',
				payload.response_type || payload.responseType || 1,
				JSON.stringify(payload.options || []),
				JSON.stringify(stats),
				payload.gradients ? JSON.stringify(payload.gradients) : null,
				payload.likes || 0,
				payload.comments || 0,
				stats.total_votes || payload.totalVotes || 0,
				JSON.stringify(payload)
			)
			.run();
		return json({ id: pollId }, { status: 201 });
	}

	if (!user) throw error(401, 'Sign in required');

	if (resource === 'polls' && id && child === 'votes') {
		await database
			.prepare(
				'INSERT INTO poll_votes (poll_id, user_id, position, position_2d, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(poll_id, user_id) DO UPDATE SET position = excluded.position, position_2d = excluded.position_2d, updated_at = CURRENT_TIMESTAMP'
			)
			.bind(
				id,
				user.uid,
				payload.position,
				payload.position_2d ? JSON.stringify(payload.position_2d) : null
			)
			.run();
		const stats = await updatePollStats(database, id);
		return json({ stats, user_vote: payload.position, user_vote_2d: payload.position_2d || null });
	}

	if (resource === 'polls' && id && child === 'likes') {
		await database
			.prepare(
				'INSERT OR IGNORE INTO likes (content_type, content_id, user_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
			)
			.bind('poll', id, user.uid)
			.run();
		const count = await likeCount(database, 'poll', id);
		await database
			.prepare('UPDATE polls SET likes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ count, liked: true });
	}

	if (resource === 'polls' && id && child === 'comments') {
		const commentId = randomId('comment');
		await database
			.prepare(
				'INSERT INTO comments (id, content_type, content_id, user_id, user_display_name, user_photo_url, text, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				commentId,
				'poll',
				id,
				user.uid,
				user.displayName || payload.userDisplayName || payload.author || null,
				user.photoURL || payload.userPhotoURL || null,
				clean(payload.text, '', 2000),
				JSON.stringify(payload)
			)
			.run();
		const count = (await listComments(database, 'poll', id)).length;
		await database
			.prepare('UPDATE polls SET comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ id: commentId }, { status: 201 });
	}

	if (resource === 'tierlists' && !id) {
		const tierlistId = randomId('tierlist');
		await database
			.prepare(
				'INSERT INTO tierlists (id, title, description, owner, status, visibility, list_type, tiers_json, items_json, placements_json, banner_image, likes, comments, forks, is_forked, original_id, is_guest, data, created_at, updated_at, last_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				tierlistId,
				clean(payload.title, 'Untitled tierlist', 240),
				payload.description || null,
				user.uid,
				payload.status || 'published',
				payload.visibility || 'public',
				payload.list_type || payload.type || 'classic',
				JSON.stringify(payload.tiers || []),
				JSON.stringify(payload.items || []),
				JSON.stringify(payload.item_placements || payload.placements || []),
				payload.banner_image || payload.bannerImage || null,
				payload.likes || 0,
				payload.comments || 0,
				payload.forks || 0,
				payload.isForked ? 1 : 0,
				payload.originalId || null,
				payload.isGuest ? 1 : 0,
				JSON.stringify(payload)
			)
			.run();
		return json({ id: tierlistId }, { status: 201 });
	}

	if (resource === 'tierlists' && id && child === 'likes') {
		await database
			.prepare(
				'INSERT OR IGNORE INTO likes (content_type, content_id, user_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
			)
			.bind('tierlist', id, user.uid)
			.run();
		const count = await likeCount(database, 'tierlist', id);
		await database
			.prepare('UPDATE tierlists SET likes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ count, liked: true });
	}

	if (resource === 'tierlists' && id && child === 'comments') {
		const commentId = randomId('comment');
		await database
			.prepare(
				'INSERT INTO comments (id, content_type, content_id, user_id, user_display_name, user_photo_url, text, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				commentId,
				'tierlist',
				id,
				user.uid,
				user.displayName || payload.author || payload.userDisplayName || null,
				user.photoURL || payload.userPhotoURL || null,
				clean(payload.text, '', 2000),
				JSON.stringify(payload)
			)
			.run();
		const count = (await listComments(database, 'tierlist', id)).length;
		await database
			.prepare('UPDATE tierlists SET comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ id: commentId }, { status: 201 });
	}

	if (resource === 'tierlists' && id && child === 'forks') {
		const original = await getTierlist(database, id);
		if (!original) throw error(404, 'Tierlist not found');
		const forkId = randomId('tierlist');
		const fork = {
			...original,
			...payload,
			id: forkId,
			originalId: id,
			isForked: true,
			status: payload.status || 'draft',
			owner: user.uid
		};
		await database
			.prepare(
				'INSERT INTO tierlists (id, title, description, owner, status, visibility, list_type, tiers_json, items_json, placements_json, banner_image, likes, comments, forks, is_forked, original_id, is_guest, data, created_at, updated_at, last_edited) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 1, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				forkId,
				fork.title,
				fork.description || null,
				fork.owner || null,
				fork.status,
				fork.visibility || 'public',
				fork.list_type || 'classic',
				JSON.stringify(fork.tiers || []),
				JSON.stringify(fork.items || []),
				JSON.stringify(fork.item_placements || []),
				fork.banner_image || null,
				id,
				JSON.stringify(fork)
			)
			.run();
		const forks = await database
			.prepare('SELECT COUNT(*) AS count FROM tierlists WHERE original_id = ?')
			.bind(id)
			.first<{ count: number }>();
		await database
			.prepare('UPDATE tierlists SET forks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(forks?.count || 0, id)
			.run();
		return json({ id: forkId }, { status: 201 });
	}

	if (resource === 'users' && !id) {
		const uid = user.uid;
		await database
			.prepare(
				'INSERT INTO users (uid, email, display_name, photo_url, banner_url, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, photo_url = excluded.photo_url, banner_url = excluded.banner_url, data = excluded.data, updated_at = CURRENT_TIMESTAMP'
			)
			.bind(
				uid,
				payload.email || null,
				payload.displayName || null,
				payload.photoURL || null,
				payload.bannerURL || null,
				JSON.stringify(payload)
			)
			.run();
		return json({ uid }, { status: 201 });
	}

	if (resource === 'users' && id && child === 'following') {
		assertOwner(user, id);
		await database
			.prepare(
				'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
			)
			.bind(id, payload.targetUid)
			.run();
		return json({ following: true });
	}

	if (resource === 'notifications' && !id) {
		const notificationId = randomId('notification');
		await database
			.prepare(
				'INSERT INTO notifications (id, user_id, type, content_type, content_id, content_title, from_user_id, from_user_name, bundle_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
			)
			.bind(
				notificationId,
				user.uid,
				payload.type,
				payload.contentType || null,
				payload.contentId || null,
				payload.contentTitle || null,
				payload.fromUserId || null,
				payload.fromUserName || null,
				payload.bundleKey || null,
				JSON.stringify(payload)
			)
			.run();
		return json({ id: notificationId }, { status: 201 });
	}

	throw error(404, 'Not found');
};

export const PATCH: RequestHandler = async ({ params, platform, request, cookies }) => {
	const database = db(platform);
	const path = parts(params);
	const [resource, id, child] = path;
	const payload = await body(request);
	const user = await requireUser(database, cookies);

	if (resource === 'polls' && id && !child) {
		const current = await getPoll(database, id);
		if (!current) throw error(404, 'Poll not found');
		assertOwner(user, current.owner);
		const merged = { ...current, ...payload };
		await database
			.prepare(
				'UPDATE polls SET title = ?, description = ?, owner = ?, status = ?, visibility = ?, response_type = ?, options_json = ?, stats_json = ?, gradients_json = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			)
			.bind(
				clean(merged.title, 'Untitled poll', 240),
				merged.description || null,
				user.uid,
				merged.status || 'published',
				merged.visibility || 'public',
				merged.response_type || 1,
				JSON.stringify(merged.options || []),
				JSON.stringify(merged.stats || {}),
				merged.gradients ? JSON.stringify(merged.gradients) : null,
				JSON.stringify(merged),
				id
			)
			.run();
		return json(await getPoll(database, id));
	}

	if (resource === 'polls' && id && child === 'stats') {
		const current = await getPoll(database, id);
		if (!current) throw error(404, 'Poll not found');
		assertOwner(user, current.owner);
		return json({ stats: await updatePollStats(database, id) });
	}

	if (resource === 'tierlists' && id && !child) {
		const current = await getTierlist(database, id);
		if (!current) throw error(404, 'Tierlist not found');
		assertOwner(user, current.owner);
		const merged = { ...current, ...payload };
		await database
			.prepare(
				'UPDATE tierlists SET title = ?, description = ?, owner = ?, status = ?, visibility = ?, list_type = ?, tiers_json = ?, items_json = ?, placements_json = ?, banner_image = ?, data = ?, updated_at = CURRENT_TIMESTAMP, last_edited = CURRENT_TIMESTAMP WHERE id = ?'
			)
			.bind(
				clean(merged.title, 'Untitled tierlist', 240),
				merged.description || null,
				user.uid,
				merged.status || 'published',
				merged.visibility || 'public',
				merged.list_type || 'classic',
				JSON.stringify(merged.tiers || []),
				JSON.stringify(merged.items || []),
				JSON.stringify(merged.item_placements || []),
				merged.banner_image || null,
				JSON.stringify(merged),
				id
			)
			.run();
		return json(await getTierlist(database, id));
	}

	if (resource === 'users' && id && !child) {
		assertOwner(user, id);
		const current = await database
			.prepare('SELECT data FROM users WHERE uid = ?')
			.bind(id)
			.first<{ data?: string }>();
		const data = { ...parseData(current?.data, {}), ...payload };
		if (data.customUid) {
			const customUid = clean(String(data.customUid), '', 80);
			if (!/^[a-zA-Z0-9_-]{3,30}$/.test(customUid)) {
				throw error(
					400,
					'Custom username must be 3-30 characters and contain only letters, numbers, hyphens, and underscores'
				);
			}
			const existing = await database
				.prepare(
					"SELECT uid FROM users WHERE uid != ? AND (uid = ? OR json_extract(data, '$.customUid') = ?) LIMIT 1"
				)
				.bind(id, customUid, customUid)
				.first<{ uid: string }>();
			if (existing) throw error(409, 'Custom username is already taken');
			data.customUid = customUid;
		}
		await database
			.prepare(
				'INSERT INTO users (uid, email, display_name, photo_url, banner_url, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, photo_url = excluded.photo_url, banner_url = excluded.banner_url, data = excluded.data, updated_at = CURRENT_TIMESTAMP'
			)
			.bind(
				id,
				data.email || null,
				data.displayName || null,
				data.photoURL || null,
				data.bannerURL || null,
				JSON.stringify(data)
			)
			.run();
		if (payload.preferences) {
			await database
				.prepare(
					'INSERT INTO preferences (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP'
				)
				.bind(id, JSON.stringify(payload.preferences))
				.run();
		}
		return json({ ok: true });
	}

	if (resource === 'notifications' && id) {
		const row = await database
			.prepare('SELECT user_id FROM notifications WHERE id = ?')
			.bind(id)
			.first<{ user_id: string }>();
		if (!row) throw error(404, 'Notification not found');
		assertOwner(user, row.user_id);
		await database
			.prepare('UPDATE notifications SET read = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(payload.read ? 1 : 0, id)
			.run();
		return json({ ok: true });
	}

	throw error(404, 'Not found');
};

export const DELETE: RequestHandler = async ({ params, platform, url, cookies }) => {
	const database = db(platform);
	const path = parts(params);
	const [resource, id, child] = path;
	const user = await requireUser(database, cookies);

	if (resource === 'polls' && id && !child) {
		const current = await getPoll(database, id);
		if (!current) throw error(404, 'Poll not found');
		assertOwner(user, current.owner);
		await database.prepare('DELETE FROM polls WHERE id = ?').bind(id).run();
		return json({ ok: true });
	}

	if (resource === 'polls' && id && child === 'likes') {
		await database
			.prepare('DELETE FROM likes WHERE content_type = ? AND content_id = ? AND user_id = ?')
			.bind('poll', id, user.uid)
			.run();
		const count = await likeCount(database, 'poll', id);
		await database
			.prepare('UPDATE polls SET likes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ count, liked: false });
	}

	if (resource === 'tierlists' && id && !child) {
		const current = await getTierlist(database, id);
		if (!current) throw error(404, 'Tierlist not found');
		assertOwner(user, current.owner);
		await database.prepare('DELETE FROM tierlists WHERE id = ?').bind(id).run();
		return json({ ok: true });
	}

	if (resource === 'tierlists' && id && child === 'likes') {
		await database
			.prepare('DELETE FROM likes WHERE content_type = ? AND content_id = ? AND user_id = ?')
			.bind('tierlist', id, user.uid)
			.run();
		const count = await likeCount(database, 'tierlist', id);
		await database
			.prepare('UPDATE tierlists SET likes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(count, id)
			.run();
		return json({ count, liked: false });
	}

	if (resource === 'comments' && id) {
		const row = await database
			.prepare('SELECT user_id FROM comments WHERE id = ?')
			.bind(id)
			.first<{ user_id: string }>();
		if (!row) throw error(404, 'Comment not found');
		assertOwner(user, row.user_id);
		await database.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
		return json({ ok: true });
	}

	if (resource === 'users' && id && child === 'following') {
		const target = url.searchParams.get('target');
		assertOwner(user, id);
		await database
			.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
			.bind(id, target)
			.run();
		return json({ following: false });
	}

	throw error(404, 'Not found');
};
