import { describe, expect, it } from 'vitest';
import {
	dimHexColor,
	getContrastingLabelColor,
	getDynamicDisplayItemSize,
	getDynamicTextDisplayStyle,
	normalizeTierlistDate
} from './tierlist-display';

describe('tierlist display helpers', () => {
	it('chooses readable label colors from tier background colors', () => {
		expect(getContrastingLabelColor('#111111')).toBe('#ffffff');
		expect(getContrastingLabelColor('#ffff7f')).toBe('#000000');
		expect(getContrastingLabelColor('#7f7fff')).toBe('#ffffff');
	});

	it('dims tier colors before choosing label color for rendered tier rows', () => {
		expect(dimHexColor('#ff7f7f', 0.6)).toBe('#994c4c');
		expect(getContrastingLabelColor(dimHexColor('#ff7f7f', 0.6))).toBe('#ffffff');
	});

	it('normalizes D1 string dates and Firebase-like timestamp dates', () => {
		expect(normalizeTierlistDate('2026-05-22T00:00:00.000Z')?.toISOString()).toBe(
			'2026-05-22T00:00:00.000Z'
		);
		expect(
			normalizeTierlistDate({ toDate: () => new Date('2026-05-21T00:00:00.000Z') })?.toISOString()
		).toBe('2026-05-21T00:00:00.000Z');
		expect(normalizeTierlistDate(null)).toBeNull();
	});

	it('sizes dynamic text items like the create canvas', () => {
		expect(getDynamicDisplayItemSize({ text: 'short' })).toEqual({ width: 80, height: 40 });
		expect(getDynamicDisplayItemSize({ text: 'a longer text-only item' })).toEqual({
			width: 208,
			height: 40
		});
		expect(getDynamicDisplayItemSize({ image: 'image.png' })).toEqual({ width: 128, height: 128 });
	});

	it('keeps resized dynamic text readable', () => {
		expect(getDynamicTextDisplayStyle({ text: 'large', size: { width: 200, height: 80 } })).toBe(
			'font-size: 32px; line-height: 38px;'
		);
	});
});
