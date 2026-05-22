import { describe, expect, it } from 'vitest';
import { dimHexColor, getContrastingLabelColor, normalizeTierlistDate } from './tierlist-display';

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
});
