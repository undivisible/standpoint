<script context="module" lang="ts">
	export type ChartData = {
		poll: {
			id?: string;
			response_type: number;
			gradients?: { enabled?: boolean; colors: string[] };
			options: string[];
			user_vote?: number | null;
			user_vote_2d?: { x: number; y: number } | null;
		};
		positions: number[];
		positions2D?: Array<{ x: number; y: number; id?: string }>;
		average: number;
		average2D?: [number, number];
		stdDev: number;
		lowerBound: number;
		upperBound: number;
	};
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { getPollEdgeVisuals, hasPollEdgeColors, type PollEdgeVisual } from '$lib/poll-geometry';
	export let chartData: ChartData;
	export let onVote: (position: number, position2D?: { x: number; y: number }) => void;
	// Orientation hint for line charts; polygons remain square. auto chooses based on aspect ratio.
	export let orientation: 'auto' | 'horizontal' | 'vertical' = 'auto';
	// Auto scroll into view when (re)rendered / orientation changes
	export let autoScroll: boolean = true;
	// Debug flag (can be toggled via env VITE_DEBUG_POLL or parent prop)
	export let debug: boolean =
		typeof import.meta.env !== 'undefined' && !!import.meta.env.VITE_DEBUG_POLL;
	// Allow overriding max polygon size from parent (desktop enhancement)
	export let maxPolySize: number = 720;
	// Phone threshold constant (enforced vertical below this)
	const PHONE_THRESHOLD = 640; // px
	// Minimum polygon size clamp
	const POLY_MIN = 220; // px
	const POLY_MAX = 1100; // internal hard ceiling

	// Dynamic viewport-fit sizing for polygons
	let polyPixelSize = 0; // computed square side in px
	let windowHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
	if (typeof window !== 'undefined') {
		window.addEventListener('resize', () => {
			windowWidth = window.innerWidth;
			windowHeight = window.innerHeight;
			computePolySize();
		});
	}

	function computePolySize() {
		if (!(chartData?.poll?.response_type >= 3)) return;
		// Width allowance (side padding ~16px each)
		const horizontalPadding = 32;
		const availW = Math.max(POLY_MIN, windowWidth - horizontalPadding);
		// Height allowance: actual distance from container top to bottom of viewport
		let topOffset = 0;
		if (polyContainerEl) {
			try {
				topOffset = polyContainerEl.getBoundingClientRect().top;
			} catch (e) {
				void e;
			}
		} else if (containerEl) {
			try {
				topOffset = containerEl.getBoundingClientRect().top;
			} catch (e) {
				void e;
			}
		}
		const bottomGap = 24; // leave breathing room at bottom
		const availHFromTop = Math.max(POLY_MIN, windowHeight - topOffset - bottomGap);
		// Desktop: use maxPolySize directly for bigger charts
		if (windowWidth > 900) {
			// Use the maxPolySize prop value (1000px) capped by POLY_MAX
			polyPixelSize = Math.min(maxPolySize, POLY_MAX);
		} else {
			// Mobile: use available space
			const base = Math.min(availW, availHFromTop);
			polyPixelSize = Math.max(POLY_MIN, Math.min(base, maxPolySize, POLY_MAX));
		}
		polyPixelSize = Math.max(POLY_MIN, Math.round(polyPixelSize));
	}

	let scrollScheduled = false;
	function handleScroll() {
		if (scrollScheduled) return;
		scrollScheduled = true;
		requestAnimationFrame(() => {
			scrollScheduled = false;
			computePolySize();
		});
	}

	onMount(() => {
		computePolySize();
		// Recompute after initial layout settling
		setTimeout(() => computePolySize(), 60);
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', handleScroll, { passive: true });
		}
		return () => {
			if (typeof window !== 'undefined') window.removeEventListener('scroll', handleScroll);
		};
	});

	$: computePolySize();

	// --- Internal state & helpers (restored / consolidated) ---
	let containerEl: HTMLDivElement | null = null;
	let polyContainerEl: HTMLDivElement | null = null;
	let windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	if (typeof window !== 'undefined') {
		window.addEventListener('resize', () => {
			windowWidth = window.innerWidth;
		});
	}
	let cWidth = 0,
		cHeight = 0;
	let polyWidth = 0;
	let effectiveOrientation: 'horizontal' | 'vertical' | 'square' = 'horizontal';
	let instanceId = Math.random().toString(36).slice(2);

	// Voting state
	let lastPosition: number | null = null;
	let lastPosition2D: { x: number; y: number } | null = null;
	let dragging2DPosition: { x: number; y: number } | null = null;
	let userHasVoted = false;
	let userHasVoted2D = false;
	let showSavedMessage = false;

	// Derived stats (1D)
	let derivedAverage1D: number | null = null;
	let derivedStd1D: number | null = null;
	let sdBandStart1D = 0,
		sdBandEnd1D = 0;
	$: if (chartData && chartData.poll.response_type === 2) {
		derivedAverage1D = chartData.average ?? chartData.poll.user_vote ?? 0.5;
		// Approx std from bounds if provided
		if (chartData.lowerBound != null && chartData.upperBound != null) {
			const span = chartData.upperBound - chartData.lowerBound;
			derivedStd1D = span / 2 / 1.5; // reverse of ±1.5σ
			sdBandStart1D = chartData.lowerBound;
			sdBandEnd1D = chartData.upperBound;
		} else {
			derivedStd1D = chartData.stdDev ?? null;
			if (derivedStd1D != null) {
				sdBandStart1D = Math.max(0, derivedAverage1D - derivedStd1D * 1.5);
				sdBandEnd1D = Math.min(1, derivedAverage1D + derivedStd1D * 1.5);
			} else {
				sdBandStart1D = 0.45;
				sdBandEnd1D = 0.55;
			}
		}
	} else {
		derivedAverage1D = null;
		derivedStd1D = null;
	}

	// Distribution buckets for 1D (simple kernel-ish grouping)
	let lineBuckets: Array<{ x: number; count: number }> = [];
	$: if (chartData && chartData.poll.response_type === 2) {
		const pts = chartData.positions || [];
		const buckets: Array<{ x: number; count: number }> = [];
		const bucketSize = 0.05;
		pts.forEach((p) => {
			const b = Math.round(p / bucketSize) * bucketSize;
			const f = buckets.find((x) => Math.abs(x.x - b) < bucketSize / 2);
			if (f) f.count += 1;
			else buckets.push({ x: b, count: 1 });
		});
		const max = Math.max(1, ...buckets.map((b) => b.count));
		lineBuckets = buckets.map((b) => ({ x: b.x, count: b.count / max }));
	} else lineBuckets = [];

	// 2D geometry for polygons
	type Pt = { x: number; y: number };
	let shapePoints: Pt[] = [];
	$: if (chartData && chartData.poll.response_type >= 3) {
		const sides = chartData.poll.response_type;
		// Guarantee upright square (flat top & bottom) for 4 sides
		// For other counts keep pointing upward (top vertex centered)
		let startAngle = -Math.PI / 2; // default (top vertex)
		if (sides === 4) startAngle = Math.PI / 4; // rotate classic diamond 45deg back to square? Actually diamond is at -90deg; using 45deg produces flat top.
		// We want vertices at midpoints of edges to become corners => choose 45deg shift relative to top-vertex orientation.
		if (sides === 4) startAngle = Math.PI / 4; // enforce again for clarity
		shapePoints = Array.from({ length: sides }, (_, i) => {
			const a = startAngle + (Math.PI * 2 * i) / sides;
			return { x: 0.5 + 0.45 * Math.cos(a), y: 0.5 + 0.45 * Math.sin(a) };
		});
	} else shapePoints = [];

	// Edge midpoints for labeling / gradients
	let edgeMidpoints: Pt[] = [];
	$: if (shapePoints.length >= 3) {
		edgeMidpoints = shapePoints.map((p, i) => {
			const n = shapePoints[(i + 1) % shapePoints.length];
			return { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 };
		});
	} else edgeMidpoints = [];
	let pollEdgeVisuals: PollEdgeVisual[] = [];
	let showPollEdgeColors = false;
	$: if (chartData?.poll?.response_type >= 3 && edgeMidpoints.length) {
		const colors = chartData.poll.gradients?.colors;
		showPollEdgeColors = hasPollEdgeColors(colors, edgeMidpoints.length);
		pollEdgeVisuals = getPollEdgeVisuals(chartData.poll.options, showPollEdgeColors ? colors : []);
	} else {
		showPollEdgeColors = false;
		pollEdgeVisuals = [];
	}

	// Heatmap toggle (could later be prop)
	let heatmapEnabled = true;

	// Average & std for 2D radial distribution
	function computeMean(a: number[]) {
		return a.reduce((s, v) => s + v, 0) / (a.length || 1);
	}
	function computeStd(a: number[], mean: number) {
		return Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (a.length || 1));
	}
	let avg2D: [number, number] | null = null;
	let derivedRadialStd2D: number | null = null;
	$: if (chartData && chartData.poll.response_type >= 3) {
		if (chartData.average2D) {
			avg2D = [chartData.average2D[0], chartData.average2D[1]];
		} else if (chartData.positions2D && chartData.positions2D.length) {
			const sx = chartData.positions2D.reduce((a, p) => a + p.x, 0);
			const sy = chartData.positions2D.reduce((a, p) => a + p.y, 0);
			avg2D = [sx / chartData.positions2D.length, sy / chartData.positions2D.length];
		} else {
			avg2D = [0.5, 0.5];
		}
		if (chartData.stdDev) {
			derivedRadialStd2D = chartData.stdDev;
		} else if (chartData.positions2D && chartData.positions2D.length > 1) {
			const cx = avg2D[0];
			const cy = avg2D[1];
			const dists = chartData.positions2D.map((p) => Math.hypot(p.x - cx, p.y - cy));
			const meanD = computeMean(dists);
			derivedRadialStd2D = computeStd(dists, meanD) || 0.0001;
		} else derivedRadialStd2D = 0.0001;
	} else {
		avg2D = null;
		derivedRadialStd2D = null;
	}
	let std2DOuterRadius = 0,
		std2DInnerRadius = 0;
	$: if (avg2D) {
		const base = derivedRadialStd2D && derivedRadialStd2D > 0.0002 ? derivedRadialStd2D : 0.06;
		std2DInnerRadius = Math.min(0.45, base);
		std2DOuterRadius = Math.min(0.45, base * 1.5);
	}

	function clamp01(v: number) {
		return v < 0 ? 0 : v > 1 ? 1 : v;
	}
	function snap(p: { x: number; y: number }) {
		return { x: clamp01(p.x), y: clamp01(p.y) };
	}

	// Resize observer for orientation auto detection
	let ro: ResizeObserver | null = null;
	if (typeof window !== 'undefined') {
		ro = new ResizeObserver((entries) => {
			for (const e of entries) {
				cWidth = e.contentRect.width;
				cHeight = e.contentRect.height;
			}
		});
	}
	$: if (containerEl && ro) ro.observe(containerEl);
	$: if (chartData?.poll?.response_type === 2) {
		const phone = (typeof window !== 'undefined' ? windowWidth : cWidth) < 700; // broaden threshold
		if (orientation === 'horizontal') effectiveOrientation = 'horizontal';
		else if (orientation === 'vertical') effectiveOrientation = 'vertical';
		else effectiveOrientation = phone ? 'vertical' : 'horizontal';
	} else effectiveOrientation = 'square';

	// Auto scroll to keep chart in viewport when orientation changes or on first mount
	let lastOrientation: string | null = null;
	$: if (autoScroll && containerEl && chartData) {
		if (lastOrientation !== effectiveOrientation) {
			lastOrientation = effectiveOrientation;
			setTimeout(() => {
				try {
					containerEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
				} catch (e) {
					void e;
				}
			}, 50);
		}
	}

	// Pointer / keyboard handlers (1D & 2D)
	function handleVote(e: MouseEvent) {
		if (chartData.poll.response_type !== 2) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const rel =
			effectiveOrientation === 'vertical'
				? 1 - (e.clientY - rect.top) / rect.height // invert so top = 1
				: (e.clientX - rect.left) / rect.width;
		const norm = clamp01((rel - 0.05) / 0.9);
		lastPosition = norm;
		submitVote();
		userHasVoted = true;
	}
	function relFromEvent(e: PointerEvent, el: HTMLElement) {
		const r = el.getBoundingClientRect();
		return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
	}
	let isDragging = false;
	function handlePointerDown(e: PointerEvent) {
		if (chartData.poll.response_type < 3) return;
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) return;
		}
		isDragging = true;
		lastPosition2D = rel;
		dragging2DPosition = lastPosition2D;
	}
	function handlePointerMove(e: PointerEvent) {
		if (!isDragging || chartData.poll.response_type < 3) return;
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) return;
		}
		lastPosition2D = rel;
		dragging2DPosition = lastPosition2D;
	}
	function handlePointerUp(e: PointerEvent) {
		if (!isDragging || chartData.poll.response_type < 3) return;
		isDragging = false;
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) {
				dragging2DPosition = null;
				return;
			}
		}
		lastPosition2D = rel;
		dragging2DPosition = null;
		submitVote();
		userHasVoted2D = true;
	}

	function submitVote() {
		if (chartData.poll.response_type >= 3) {
			if (lastPosition2D) {
				const pts = shapePoints;
				const px = lastPosition2D.x,
					py = lastPosition2D.y;
				function distToSeg(ax: number, ay: number, bx: number, by: number) {
					const vx = bx - ax,
						vy = by - ay;
					const wx = px - ax,
						wy = py - ay;
					const c1 = vx * wx + vy * wy;
					if (c1 <= 0) return Math.hypot(px - ax, py - ay);
					const c2 = vx * vx + vy * vy;
					if (c2 <= c1) return Math.hypot(px - bx, py - by);
					const t = c1 / c2;
					const projx = ax + t * vx,
						projy = ay + t * vy;
					return Math.hypot(px - projx, py - projy);
				}
				const edgeDists = pts.map((p, i) => {
					const n = pts[(i + 1) % pts.length];
					return distToSeg(p.x, p.y, n.x, n.y);
				});
				const maxD = Math.max(...edgeDists, 0.0001);
				const inv = edgeDists.map((d) => 1 - d / maxD);
				const sum = inv.reduce((a, b) => a + b, 0) || 1;
				let scalar = 0;
				inv.forEach((w, i) => {
					scalar += (w / sum) * (i / (inv.length - 1 || 1));
				});
				scalar = clamp01(scalar);
				onVote(scalar, lastPosition2D);
			}
			lastPosition2D = null;
		} else if (lastPosition !== null) {
			onVote(lastPosition);
			lastPosition = null;
		}
		showSavedMessage = true;
		setTimeout(() => (showSavedMessage = false), 1100);
	}

	// Path for polygon
	let pathD = '';
	$: if (chartData.poll.response_type >= 3) {
		pathD = shapePoints.length
			? shapePoints.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z'
			: '';
	} else pathD = '';

	// Heatmap clusters
	let clusters: Array<{ x: number; y: number; count: number }> = [];
	$: if (chartData.poll.response_type >= 3 && heatmapEnabled && chartData.positions2D?.length) {
		const maxRefDist = 0.07;
		const raw: Array<{ x: number; y: number; count: number }> = [];
		chartData.positions2D.forEach((p) => {
			const f = raw.find(
				(c) => Math.abs(c.x - p.x) < maxRefDist && Math.abs(c.y - p.y) < maxRefDist
			);
			if (f) {
				f.count++;
				f.x = (f.x * (f.count - 1) + p.x) / f.count;
				f.y = (f.y * (f.count - 1) + p.y) / f.count;
			} else raw.push({ x: p.x, y: p.y, count: 1 });
		});
		clusters = raw;
	} else clusters = [];

	// 1D label opacity proximity
	let currentLinePosition = 0.5;
	let leftLabelOpacity = 1,
		rightLabelOpacity = 1;
	$: currentLinePosition = lastPosition ?? chartData.poll.user_vote ?? chartData.average ?? 0.5;
	$: leftLabelOpacity =
		chartData.poll.response_type === 2 ? 0.4 + 0.6 * (1 - currentLinePosition) : 1;
	$: rightLabelOpacity = chartData.poll.response_type === 2 ? 0.4 + 0.6 * currentLinePosition : 1;

	// Label positions (not currently used, but keep for future)
	let labelPositions: Array<{ x: number; y: number }> = [];
	$: if (chartData.poll.response_type >= 3) {
		const base = edgeMidpoints.length ? edgeMidpoints : shapePoints;
		labelPositions = base.length ? chartData.poll.options.map((_, i) => base[i % base.length]) : [];
	} else labelPositions = [];

	// dynamic font scale for labels on very small devices
	$: labelScale =
		chartData.poll.response_type >= 3 ? Math.max(0.7, Math.min(1, polyWidth / 340)) : 1;
</script>

<!-- MARKUP -->
<div class="relative w-full" bind:this={containerEl}>
	{#if chartData.poll.response_type === 2}
		<div class="sr-only" aria-live="polite">Orientation: {effectiveOrientation}</div>
	{/if}
	<div class="relative w-full">
		{#key `${instanceId}-${chartData.poll.id ?? ''}-${chartData.poll.response_type}-${shapePoints.map((p) => p.x.toFixed(3) + p.y.toFixed(3)).join('-')}-${effectiveOrientation}`}
			<div class="relative w-full">
				{#if chartData.poll.response_type === 2}
					<!-- Orientation debug / QA label -->
					{#if debug}
						<div
							class="absolute -top-5 right-0 z-20 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/80"
							aria-live="polite"
							aria-atomic="true"
						>
							<span>1D:{effectiveOrientation[0].toUpperCase()}</span>
							<span class="ml-1 opacity-70">vw:{windowWidth}</span>
							<span class="ml-1 opacity-70">thr:{PHONE_THRESHOLD}</span>
						</div>
					{/if}
					<!-- Responsive 1D line scale (horizontal or vertical) -->
					<div
						class={effectiveOrientation === 'vertical'
							? 'relative h-[420px] select-none'
							: 'relative h-48 select-none'}
					>
						<div
							class="absolute inset-0"
							role="slider"
							tabindex="0"
							aria-label="Vote position"
							aria-valuemin="0"
							aria-valuemax="1"
							aria-valuenow={lastPosition ?? chartData.poll.user_vote ?? chartData.average}
							on:click={handleVote}
							on:keydown={(e) => {
								// Support arrow keys for either orientation
								const dec =
									effectiveOrientation === 'vertical' ? ['ArrowDown', 'ArrowLeft'] : ['ArrowLeft'];
								const inc =
									effectiveOrientation === 'vertical' ? ['ArrowUp', 'ArrowRight'] : ['ArrowRight'];
								if (dec.includes(e.key)) {
									e.preventDefault();
									lastPosition = clamp01((lastPosition ?? chartData.poll.user_vote ?? 0.5) - 0.05);
									submitVote();
								} else if (inc.includes(e.key)) {
									e.preventDefault();
									lastPosition = clamp01((lastPosition ?? chartData.poll.user_vote ?? 0.5) + 0.05);
									submitVote();
								} else if (e.key === 'Home') {
									e.preventDefault();
									lastPosition = 0;
									submitVote();
								} else if (e.key === 'End') {
									e.preventDefault();
									lastPosition = 1;
									submitVote();
								} else if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									lastPosition = lastPosition ?? chartData.poll.user_vote ?? 0.5;
									submitVote();
								}
							}}
						>
							<div
								class={effectiveOrientation === 'vertical'
									? 'absolute top-10 bottom-10 left-1/2 w-16 -translate-x-1/2 overflow-hidden rounded-md border border-white/15 bg-black/20 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)]'
									: 'absolute inset-x-4 top-6 bottom-6 overflow-hidden rounded-md border border-white/15 bg-black/20 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)]'}
							>
								<!-- gradient -->
								<div
									class={effectiveOrientation === 'vertical'
										? 'absolute inset-0 bg-gradient-to-b from-[rgb(var(--primary))]/30 via-[rgb(var(--primary))]/10 to-[rgb(var(--primary))]/30 opacity-60'
										: 'absolute inset-0 bg-gradient-to-r from-[rgb(var(--primary))]/30 via-[rgb(var(--primary))]/10 to-[rgb(var(--primary))]/30 opacity-60'}
								></div>
								{#if derivedAverage1D != null}
									<div
										class={effectiveOrientation === 'vertical'
											? 'sd-band-1d absolute right-0 left-0'
											: 'sd-band-1d absolute top-0 bottom-0'}
										style={effectiveOrientation === 'vertical'
											? `top:${(1 - sdBandEnd1D) * 0.9 * 100 + 5}%;height:${Math.max(0.8, (sdBandEnd1D - sdBandStart1D) * 0.9 * 100)}%;`
											: `left:${(sdBandStart1D * 0.9 + 0.05) * 100}%;width:${Math.max(0.8, (sdBandEnd1D - sdBandStart1D) * 0.9 * 100)}%;`}
									></div>
								{/if}
								{#if lineBuckets.length}
									{#each lineBuckets as b (b.x)}
										{#if effectiveOrientation === 'vertical'}
											<div
												class="absolute right-0 left-0 -translate-y-1/2"
												style="top:{(1 - b.x) * 0.9 * 100 + 5}%"
											>
												<div
													class="h-px w-full"
													style="background:linear-gradient(to right,rgba(255,255,255,0),rgba(255,255,255,{b.count *
														0.35}),rgba(255,255,255,0));"
												></div>
											</div>
										{:else}
											<div
												class="absolute top-0 bottom-0 -translate-x-1/2"
												style="left:{(b.x * 0.9 + 0.05) * 100}%"
											>
												<div
													class="h-full w-px"
													style="background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,{b.count *
														0.35}),rgba(255,255,255,0));"
												></div>
											</div>
										{/if}
									{/each}
								{/if}
								{#if effectiveOrientation === 'vertical'}
									{#each [0.25, 0.5, 0.75] as g (g)}
										<div
											class="absolute right-0 left-0 h-px bg-white/10"
											style="top:{(1 - g) * 100}%"
										></div>
									{/each}
								{:else}
									{#each [0.25, 0.5, 0.75] as g (g)}
										<div
											class="absolute top-0 bottom-0 w-px bg-white/10"
											style="left:{g * 100}%"
										></div>
									{/each}
								{/if}
								{#if effectiveOrientation === 'vertical'}
									<div
										class="absolute top-2 left-1/2 -translate-x-1/2 text-center text-base leading-tight font-medium text-white"
										style="font-family:'Mozilla Text',system-ui,sans-serif;opacity:{rightLabelOpacity}"
									>
										{chartData.poll.options?.[1] || 'Option 2'}
									</div>
									<div
										class="absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-base leading-tight font-medium text-white"
										style="font-family:'Mozilla Text',system-ui,sans-serif;opacity:{leftLabelOpacity}"
									>
										{chartData.poll.options?.[0] || 'Option 1'}
									</div>
								{:else}
									<div
										class="absolute top-1/2 left-2 max-w-[30%] -translate-y-1/2 text-base leading-tight font-medium text-white"
										style="font-family:'Mozilla Text',system-ui,sans-serif;opacity:{leftLabelOpacity}"
									>
										{chartData.poll.options?.[0] || 'Option 1'}
									</div>
									<div
										class="absolute top-1/2 right-2 max-w-[30%] -translate-y-1/2 text-right text-base leading-tight font-medium text-white"
										style="font-family:'Mozilla Text',system-ui,sans-serif;opacity:{rightLabelOpacity}"
									>
										{chartData.poll.options?.[1] || 'Option 2'}
									</div>
								{/if}
								{#if derivedAverage1D != null}
									{#if effectiveOrientation === 'vertical'}
										<div
											class="absolute right-0 left-0 h-[3px] -translate-y-1/2 bg-white/80 shadow-[0_0_4px_rgba(255,255,255,0.6)]"
											style="top:{(1 - derivedAverage1D) * 0.9 * 100 + 5}%"
											title="Average"
										></div>
									{:else}
										<div
											class="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 bg-white/80 shadow-[0_0_4px_rgba(255,255,255,0.6)]"
											style="left:{(derivedAverage1D * 0.9 + 0.05) * 100}%"
											title="Average"
										></div>
									{/if}
								{/if}
								{#if derivedAverage1D != null}
									{#if effectiveOrientation === 'vertical'}
										<div
											class="absolute left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wide text-white"
											style="top:{(1 - derivedAverage1D) * 0.9 * 100 +
												2}%;font-family:'Mozilla Text',system-ui,sans-serif;"
										>
											Avg {(derivedAverage1D * 100).toFixed(1)}% {#if derivedStd1D != null && derivedStd1D > 0}<span
													class="ml-1 opacity-70">±{(derivedStd1D * 100).toFixed(1)}%</span
												>{/if}
										</div>
									{:else}
										<div
											class="absolute -top-5 -translate-x-1/2 text-[10px] font-medium tracking-wide text-white"
											style="left:{(derivedAverage1D * 0.9 + 0.05) *
												100}%;font-family:'Mozilla Text',system-ui,sans-serif;"
										>
											Avg {(derivedAverage1D * 100).toFixed(1)}% {#if derivedStd1D != null && derivedStd1D > 0}<span
													class="ml-1 opacity-70">±{(derivedStd1D * 100).toFixed(1)}%</span
												>{/if}
										</div>
									{/if}
								{/if}
								{#if chartData.poll.user_vote != null}
									{#if effectiveOrientation === 'vertical'}
										<div
											class="absolute right-0 left-0 h-[5px] -translate-y-1/2 bg-[rgb(var(--primary))] shadow-[0_0_6px_rgba(var(--primary),0.8)]"
											style="top:{(1 - chartData.poll.user_vote) * 0.9 * 100 + 5}%"
										></div>
									{:else}
										<div
											class="absolute top-0 bottom-0 w-[5px] -translate-x-1/2 bg-[rgb(var(--primary))] shadow-[0_0_6px_rgba(var(--primary),0.8)]"
											style="left:{(chartData.poll.user_vote * 0.9 + 0.05) * 100}%"
										></div>
									{/if}
								{/if}
								{#if lastPosition != null}
									{#if effectiveOrientation === 'vertical'}
										<div
											class="absolute right-0 left-0 h-[5px] -translate-y-1/2 bg-white/80 mix-blend-screen"
											style="top:{(1 - lastPosition) * 0.9 * 100 + 5}%"
										></div>
									{:else}
										<div
											class="absolute top-0 bottom-0 w-[5px] -translate-x-1/2 bg-white/80 mix-blend-screen"
											style="left:{(lastPosition * 0.9 + 0.05) * 100}%"
										></div>
									{/if}
								{/if}
							</div>
						</div>
						<!-- close outer 1D container -->
					</div>
				{:else if chartData.poll.response_type >= 3}
					<div
						class="relative flex w-full items-center justify-center select-none"
						bind:this={polyContainerEl}
						style={`aspect-ratio:1/1;margin:0 auto;padding:clamp(8px,4vw,28px);width:${polyPixelSize || POLY_MIN}px;max-width:${POLY_MAX}px;`}
						data-size={polyPixelSize}
						aria-label="Polygon poll"
					>
						{#if debug}
							<div
								class="absolute -top-5 left-0 z-20 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/80"
								aria-live="polite"
								aria-atomic="true"
							>
								<span>2D:{polyPixelSize}px</span>
								<span class="ml-1 opacity-70">vw:{windowWidth}</span>
								<span class="ml-1 opacity-70">vh:{windowHeight}</span>
							</div>
						{/if}
						<div
							class="relative h-full w-full"
							role="application"
							on:pointerdown={handlePointerDown}
							on:pointermove={handlePointerMove}
							on:pointerup={handlePointerUp}
							on:pointerleave={handlePointerUp}
						>
							<svg viewBox="0 0 1 1" class="relative z-0 h-full w-full">
								{#if pathD}
									<defs>
										<clipPath id="clip-{instanceId}"><path d={pathD} /></clipPath>
										{#if showPollEdgeColors}
											{#each edgeMidpoints as m, i (i)}
												<radialGradient
													id="edge-grad-{instanceId}-{i}"
													cx={m.x * 100 + '%'}
													cy={m.y * 100 + '%'}
													r="65%"
												>
													<stop
														offset="0%"
														stop-color={pollEdgeVisuals[i]?.color}
														stop-opacity="0.55"
													/>
													<stop
														offset="70%"
														stop-color={pollEdgeVisuals[i]?.color}
														stop-opacity="0.12"
													/>
													<stop offset="100%" stop-color="transparent" stop-opacity="0" />
												</radialGradient>
											{/each}
										{/if}
									</defs>
									{#if showPollEdgeColors}
										{#each edgeMidpoints as m, i (i)}
											<circle
												cx={m.x}
												cy={m.y}
												r="0.65"
												fill={`url(#edge-grad-${instanceId}-${i})`}
												clip-path={`url(#clip-${instanceId})`}
											/>
										{/each}
									{/if}
									<path
										d={pathD}
										fill="rgba(255,255,255,0.05)"
										stroke="rgba(255,255,255,0.55)"
										stroke-width="0.005"
									/>
									{#if clusters.length}
										{#each clusters as c (c.x + '-' + c.y)}
											<circle
												class="vote-cloud"
												cx={c.x}
												cy={c.y}
												r={0.02 + (c.count / Math.max(1, clusters.length / 2)) * 0.05}
												fill={`rgba(255,255,255,${Math.min(0.5, 0.15 + (c.count / Math.max(1, clusters.length / 2)) * 0.35)})`}
											/>
										{/each}
									{/if}
									{#if avg2D && avg2D[0] >= 0 && avg2D[0] <= 1 && avg2D[1] >= 0 && avg2D[1] <= 1}
										<g class="avg-layer">
											<circle
												class="avg-std-ring"
												cx={avg2D[0]}
												cy={avg2D[1]}
												r={std2DOuterRadius || 0.0001}
												fill="none"
												stroke="rgba(255,255,255,0.35)"
												stroke-width="0.003"
												stroke-dasharray="0.01,0.01"
											/>
											<circle
												class="avg-core"
												cx={avg2D[0]}
												cy={avg2D[1]}
												r="0.022"
												fill="rgba(255,255,255,0.95)"
											/>
										</g>
									{/if}
								{/if}
							</svg>
							{#if pollEdgeVisuals.length === edgeMidpoints.length && edgeMidpoints.length > 2}
								{#each edgeMidpoints as m, i (i)}
									<div
										class="label-edge pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[15px] font-medium tracking-wide text-white/85 md:text-base"
										style="left:{m.x * 100}%; top:{m.y *
											100}%; font-family: 'Mozilla Text', system-ui, sans-serif;"
									>
										{pollEdgeVisuals[i].label}
									</div>
								{/each}
							{/if}
							{#if dragging2DPosition}
								<div
									class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
									style="left:{dragging2DPosition.x * 100}%; top:{dragging2DPosition.y * 100}%"
								>
									<div
										class="h-4 w-4 rounded-full bg-white ring-2 ring-[rgb(var(--primary))]"
									></div>
								</div>
							{/if}
							{#if userHasVoted2D && chartData.poll.user_vote_2d}
								<div
									class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
									style="left:{chartData.poll.user_vote_2d.x * 100}%; top:{chartData.poll
										.user_vote_2d.y * 100}%"
								>
									<div
										class="h-4 w-4 rounded-full bg-[rgb(var(--primary))] ring-2 ring-white"
									></div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/key}
	</div>

	{#if showSavedMessage}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="rounded-md bg-black/70 px-3 py-1 text-[10px] tracking-wide text-white/90 uppercase backdrop-blur"
			>
				Vote saved
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.average-point) {
		filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
	}
	:global(.vote-cloud) {
		filter: blur(2px);
	}
	:global(.avg-core),
	:global(.avg-std-area),
	:global(.avg-std-ring) {
		pointer-events: none;
	}
	:global(.avg-core) {
		filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
	}
	:global(g.avg-layer) {
		pointer-events: none;
	}
	.sd-band-1d {
		background: rgba(255, 255, 255, 0.18);
		box-shadow:
			0 0 6px rgba(255, 255, 255, 0.4) inset,
			0 0 4px rgba(255, 255, 255, 0.4);
		mix-blend-mode: screen;
	}
	.label-edge {
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
		max-width: 7rem;
		text-align: center;
		font-family: 'Mozilla Text', system-ui, sans-serif;
		/* scale font-size for extremely narrow devices */
		font-size: clamp(10px, calc(14px * var(--edge-scale, 1)), 16px);
	}
</style>
