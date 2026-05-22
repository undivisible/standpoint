import { describe, expect, it } from 'vitest';
import { getPollEdgeVisuals, hasPollEdgeColors } from './poll-geometry';

describe('poll geometry', () => {
	it('rotates square edge labels and colors clockwise twice', () => {
		expect(
			getPollEdgeVisuals(['top', 'right', 'bottom', 'left'], ['red', 'blue', 'green', 'yellow'])
		).toEqual([
			{ label: 'bottom', color: 'green' },
			{ label: 'left', color: 'yellow' },
			{ label: 'top', color: 'red' },
			{ label: 'right', color: 'blue' }
		]);
	});

	it('leaves non-square edge labels and colors in order', () => {
		expect(getPollEdgeVisuals(['a', 'b', 'c'], ['red', 'blue', 'green'])).toEqual([
			{ label: 'a', color: 'red' },
			{ label: 'b', color: 'blue' },
			{ label: 'c', color: 'green' }
		]);
	});

	it('requires one color per edge', () => {
		expect(hasPollEdgeColors(['red', 'blue', 'green', 'yellow'], 4)).toBe(true);
		expect(hasPollEdgeColors(['red', 'blue'], 4)).toBe(false);
	});
});
