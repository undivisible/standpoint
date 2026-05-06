import { notifications } from './notifications';
import type { Notification } from './notifications';

/**
 * Subscribe to real-time Firebase notifications for a user
 * Syncs Firebase notifications with local notification store
 */
export function subscribeToUserNotifications(userId: string) {
	let stopped = false;
	async function load() {
		if (stopped) return;
		try {
			const response = await fetch(
				`/api/cloudflare/notifications?userId=${encodeURIComponent(userId)}`
			);
			if (!response.ok) return;
			const data = (await response.json()) as { items?: any[] };
			for (const item of data.items || []) {
				const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
					type: item.type as 'like' | 'comment' | 'fork' | 'mention',
					title: formatNotificationTitle(item),
					message: formatNotificationMessage(item),
					link: getNotificationLink(item)
				};
				notifications.add(notification);
			}
		} catch (error) {
			console.error('Error subscribing to notifications:', error);
		}
	}
	load();
	const interval = setInterval(load, 30000);
	return () => {
		stopped = true;
		clearInterval(interval);
	};
}

/**
 * Format notification title based on type
 */
function formatNotificationTitle(data: any): string {
	switch (data.type) {
		case 'like':
			return 'New Like';
		case 'comment':
			return 'New Comment';
		case 'fork':
			return 'Content Forked';
		case 'mention':
			return 'Mentioned';
		default:
			return 'Notification';
	}
}

/**
 * Format notification message based on type and data
 */
function formatNotificationMessage(data: any): string {
	const contentType = data.contentType || data.content_type || 'content';
	const contentTitle = data.contentTitle || data.content_title || 'Untitled';

	switch (data.type) {
		case 'like':
			return `Someone liked your ${contentType}: "${contentTitle}"`;
		case 'comment':
			return `New comment on your ${contentType}: "${contentTitle}"`;
		case 'fork':
			return `Someone forked your ${contentType}: "${contentTitle}"`;
		case 'mention':
			return `You were mentioned in "${contentTitle}"`;
		default:
			return `New notification about "${contentTitle}"`;
	}
}

/**
 * Generate link URL for notification
 */
function getNotificationLink(data: any): string {
	const contentType = data.contentType || data.content_type || 'poll';
	const contentId = data.contentId || data.content_id;

	if (!contentId) return '/';

	switch (contentType) {
		case 'poll':
			return `/polls/${contentId}`;
		case 'tierlist':
			return `/tierlists/${contentId}`;
		case 'user':
			return `/user/${contentId}`;
		default:
			return '/';
	}
}

/**
 * Mark a notification as read in Firebase
 */
export async function markNotificationRead(userId: string, notificationId: string) {
	try {
		await fetch(`/api/cloudflare/notifications/${encodeURIComponent(notificationId)}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ userId, read: true })
		});
	} catch (error) {
		console.error('Error marking notification as read:', error);
	}
}

/**
 * Mark all notifications as read in Firebase
 */
export async function markAllNotificationsRead(userId: string) {
	try {
		const response = await fetch(
			`/api/cloudflare/notifications?userId=${encodeURIComponent(userId)}`
		);
		if (!response.ok) return;
		const data = (await response.json()) as { items?: any[] };
		await Promise.all(
			(data.items || []).map((item) =>
				fetch(`/api/cloudflare/notifications/${encodeURIComponent(item.id)}`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ read: true })
				})
			)
		);
	} catch (error) {
		console.error('Error marking all notifications as read:', error);
	}
}
