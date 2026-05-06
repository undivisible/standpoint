import { apiPost } from './cloudflare-api';

interface FirebaseNotification {
	type: 'like' | 'comment' | 'fork' | 'mention';
	contentType: 'poll' | 'tierlist';
	contentId: string;
	contentTitle: string;
	fromUserId: string;
	fromUserName?: string;
	timestamp: unknown;
	read: boolean;
	bundleKey?: string; // Key for bundling similar notifications
}

/**
 * Create or update a bundled notification
 * Bundles notifications of the same type for the same content within a time window
 */
export async function createBundledNotification(
	ownerId: string,
	notification: Omit<FirebaseNotification, 'timestamp' | 'read' | 'bundleKey'>
) {
	if (ownerId === notification.fromUserId) {
		// Don't notify users about their own actions
		return;
	}

	try {
		// Create a bundle key: type + contentType + contentId
		const bundleKey = `${notification.type}_${notification.contentType}_${notification.contentId}`;

		// Check for existing notifications with same bundle key in last 24 hours
		const oneDayAgo = new Date();
		oneDayAgo.setDate(oneDayAgo.getDate() - 1);

		// No existing notification found or time window expired - create new one
		await apiPost('notifications', {
			ownerId,
			...notification,
			bundleKey,
			timestamp: oneDayAgo.toISOString(),
			read: false,
			userIds: [notification.fromUserId],
			count: 1
		});

		console.log(`Created new notification for ${bundleKey}`);
	} catch (error) {
		console.error('Error creating bundled notification:', error);
	}
}

/**
 * Format bundled notification message
 */
export function formatBundledMessage(
	type: string,
	contentType: string,
	contentTitle: string,
	count: number,
	lastUserName?: string
): string {
	if (count === 1) {
		// Single notification
		switch (type) {
			case 'like':
				return `${lastUserName || 'Someone'} liked your ${contentType}`;
			case 'comment':
				return `${lastUserName || 'Someone'} commented on your ${contentType}`;
			case 'fork':
				return `${lastUserName || 'Someone'} forked your ${contentType}`;
			case 'mention':
				return `${lastUserName || 'Someone'} mentioned you`;
			default:
				return `New activity on your ${contentType}`;
		}
	} else {
		// Multiple users
		const others = count - 1;
		switch (type) {
			case 'like':
				return `${lastUserName || 'Someone'} and ${others} ${others === 1 ? 'other' : 'others'} liked your ${contentType}`;
			case 'comment':
				return `${lastUserName || 'Someone'} and ${others} ${others === 1 ? 'other' : 'others'} commented on your ${contentType}`;
			case 'fork':
				return `${lastUserName || 'Someone'} and ${others} ${others === 1 ? 'other' : 'others'} forked your ${contentType}`;
			default:
				return `${count} people interacted with your ${contentType}`;
		}
	}
}
