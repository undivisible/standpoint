/**
 * Security utilities for input sanitization and XSS prevention
 */

/**
 * Sanitize text input by escaping HTML special characters
 */
export function sanitizeText(text: string): string {
	if (!text) return '';
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 */
export function sanitizeUrl(url: string): string {
	if (!url) return '';

	const trimmed = url.trim().toLowerCase();

	// Block dangerous protocols
	if (
		trimmed.startsWith('javascript:') ||
		trimmed.startsWith('data:') ||
		trimmed.startsWith('vbscript:') ||
		trimmed.startsWith('file:')
	) {
		return '';
	}

	// Only allow http, https, and relative URLs
	if (
		!trimmed.startsWith('http://') &&
		!trimmed.startsWith('https://') &&
		!trimmed.startsWith('/') &&
		!trimmed.startsWith('./') &&
		!trimmed.startsWith('../')
	) {
		return '';
	}

	return url;
}

/**
 * Validate and sanitize image URLs
 */
export function sanitizeImageUrl(url: string): string {
	const sanitized = sanitizeUrl(url);
	if (!sanitized) return '';

	// Additional checks for image URLs
	try {
		const urlObj = new URL(sanitized, window.location.origin);

		// Only allow specific trusted domains for external images
		const allowedDomains = [
			'firebasestorage.googleapis.com',
			'storage.googleapis.com',
			'lh3.googleusercontent.com',
			'i.imgur.com',
			'cdn.discordapp.com'
		];

		if (urlObj.origin !== window.location.origin) {
			const isAllowed = allowedDomains.some(
				(domain) => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
			);
			if (!isAllowed) {
				return '';
			}
		}

		return sanitized;
	} catch {
		return '';
	}
}

/**
 * Sanitize poll/tierlist title
 */
export function sanitizeTitle(title: string, maxLength = 200): string {
	if (!title) return '';
	return sanitizeText(title.slice(0, maxLength).trim());
}

/**
 * Sanitize description or comment text
 */
export function sanitizeDescription(description: string, maxLength = 1000): string {
	if (!description) return '';
	return sanitizeText(description.slice(0, maxLength).trim());
}

/**
 * Sanitize tier/option names
 */
export function sanitizeOptionName(name: string, maxLength = 100): string {
	if (!name) return '';
	return sanitizeText(name.slice(0, maxLength).trim());
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate Firebase document ID
 */
export function isValidDocumentId(id: string): boolean {
	// Firebase document IDs can't be empty, contain /, or be . or ..
	if (!id || id === '.' || id === '..') return false;
	if (id.includes('/')) return false;
	if (id.length > 1500) return false; // Firebase limit
	return true;
}

/**
 * Strip all HTML tags from text
 */
export function stripHtml(html: string): string {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '');
}

/**
 * Validate numeric input is within bounds
 */
export function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize hex color code
 */
export function sanitizeColor(color: string): string {
	if (!color) return '#000000';

	// Remove any whitespace
	const cleaned = color.trim();

	// Validate hex color format
	const hexRegex = /^#[0-9A-Fa-f]{6}$/;
	if (hexRegex.test(cleaned)) {
		return cleaned;
	}

	// Validate rgb/rgba format
	const rgbRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
	if (rgbRegex.test(cleaned)) {
		return cleaned;
	}

	// Fallback to black if invalid
	return '#000000';
}
