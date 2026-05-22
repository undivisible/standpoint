import { cleanup, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChartRenderer, { type ChartData } from './chart-renderer.svelte';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

describe('ChartRenderer', () => {
	beforeEach(() => {
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('rotates square labels and edge colors clockwise twice', () => {
		const chartData: ChartData = {
			poll: {
				id: 'square-poll',
				response_type: 4,
				options: ['Option A', 'Option B', 'Option C', 'Option D'],
				gradients: {
					enabled: false,
					colors: ['#111111', '#222222', '#333333', '#444444']
				}
			},
			positions: [],
			positions2D: [],
			average: 0,
			stdDev: 0,
			lowerBound: 0,
			upperBound: 0
		};

		const { container } = render(ChartRenderer, {
			props: {
				chartData,
				onVote: vi.fn(),
				autoScroll: false
			}
		});

		expect(
			Array.from(container.querySelectorAll('.label-edge')).map((label) =>
				label.textContent?.trim()
			)
		).toEqual(['Option C', 'Option D', 'Option A', 'Option B']);
		expect(
			Array.from(container.querySelectorAll('radialGradient stop:first-child')).map((stop) =>
				stop.getAttribute('stop-color')
			)
		).toEqual(['#333333', '#444444', '#111111', '#222222']);
		expect(container.querySelectorAll('circle[clip-path]')).toHaveLength(4);
	});
});
