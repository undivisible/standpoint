export function getContrastingLabelColor(color: string | undefined | null) {
	const fallback = '#000000';
	if (!color) return fallback;
	const hex = color.trim().replace('#', '');
	const normalized =
		hex.length === 3
			? hex
					.split('')
					.map((char) => char + char)
					.join('')
			: hex;
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
	const red = parseInt(normalized.slice(0, 2), 16) / 255;
	const green = parseInt(normalized.slice(2, 4), 16) / 255;
	const blue = parseInt(normalized.slice(4, 6), 16) / 255;
	const linear = [red, green, blue].map((channel) =>
		channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
	);
	const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
	return luminance > 0.35 ? '#000000' : '#ffffff';
}

export function dimHexColor(color: string | undefined | null, factor = 0.6) {
	if (!color) return '#000000';
	const hex = color.trim().replace('#', '');
	const normalized =
		hex.length === 3
			? hex
					.split('')
					.map((char) => char + char)
					.join('')
			: hex;
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return color;
	const red = Math.round(parseInt(normalized.slice(0, 2), 16) * factor);
	const green = Math.round(parseInt(normalized.slice(2, 4), 16) * factor);
	const blue = Math.round(parseInt(normalized.slice(4, 6), 16) * factor);
	return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

export function normalizeTierlistDate(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
		const date = (value as { toDate: () => Date }).toDate();
		return Number.isNaN(date.getTime()) ? null : date;
	}
	const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date;
}

type DynamicDisplayItem = {
	text?: string;
	image?: string | null;
	size?: { width: number; height: number };
	naturalSize?: { width: number; height: number };
};

export function getDynamicDisplayItemSize(item: DynamicDisplayItem): {
	width: number;
	height: number;
} {
	if (item.size) return item.size;

	if (item.image && item.naturalSize) {
		const scale = Math.min(200 / item.naturalSize.width, 200 / item.naturalSize.height, 1);
		return {
			width: item.naturalSize.width * scale,
			height: item.naturalSize.height * scale
		};
	}

	if (item.image) return { width: 128, height: 128 };

	const textLength = item.text?.length || 0;
	const minWidth = 80;
	const charWidth = 8;
	const padding = 24;
	return {
		width: Math.max(minWidth, Math.min(textLength * charWidth + padding, 300)),
		height: 40
	};
}

export function getDynamicTextDisplayStyle(item: DynamicDisplayItem) {
	if (!item.size || item.image) return '';

	const { width, height } = item.size;
	const minFontSize = 10;
	const maxFontSize = 32;

	const textLength = item.text?.length || 1;
	const avgCharWidth = 0.6;

	const maxFontForWidth = (width * 0.9) / (textLength * avgCharWidth);
	const maxFontForHeight = height * 0.4;

	const optimalFontSize = Math.min(maxFontForWidth, maxFontForHeight);
	const fontSize = Math.max(minFontSize, Math.min(maxFontSize, optimalFontSize));

	return `font-size: ${Math.round(fontSize)}px; line-height: ${Math.round(fontSize * 1.2)}px;`;
}
