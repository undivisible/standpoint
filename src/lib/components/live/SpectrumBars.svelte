<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let leftLabel = '';
	export let rightLabel = '';
	export let prompt: string | null = null;
	export let mode: 'psychic' | 'guessing' | 'reveal' | 'spectator' = 'spectator';
	export let targetValue: number | null = null;
	export let guessValue = 50;
	export let value = guessValue;
	export let locked = false;
	export let disabled = false;
	export let showScoringBands = false;

	/** Four equal-width rings from the target outward (inside → outside: 4, 3, 2, 0 pts). */
	const RING_SLICES = 4;
	const OUTER_RADIUS = 16;
	const SLICE = OUTER_RADIUS / RING_SLICES;

	const RING_META = [
		{ inner: 3 * SLICE, outer: 4 * SLICE, label: '0', color: '#57534e' },
		{ inner: 2 * SLICE, outer: 3 * SLICE, label: '2', color: '#facc15' },
		{ inner: 1 * SLICE, outer: 2 * SLICE, label: '3', color: '#3b82f6' },
		{ inner: 0, outer: 1 * SLICE, label: '4', color: '#10b981' }
	] as const;

	type RingChunk = {
		key: string;
		label: string;
		color: string;
		z: number;
		style: string;
	};

	const dispatch = createEventDispatcher<{
		guessChange: number;
		guessLock: number;
	}>();

	let frame: HTMLElement | null = null;
	let dragging = false;
	let displayGuess = value;

	$: displayGuess = value ?? guessValue;
	$: showZones = targetValue !== null && (mode === 'psychic' || mode === 'reveal' || showScoringBands);

	function clamp(next: number) {
		return Math.max(0, Math.min(100, next));
	}

	function isVertical() {
		if (!frame) return false;
		const rect = frame.getBoundingClientRect();
		return rect.width < 640;
	}

	function setFromPointer(clientX: number, clientY: number) {
		if (!frame || disabled || locked || mode !== 'guessing') return;
		const rect = frame.getBoundingClientRect();
		const next = isVertical()
			? clamp(((rect.bottom - clientY) / rect.height) * 100)
			: clamp(((clientX - rect.left) / rect.width) * 100);
		value = Math.round(next);
		guessValue = value;
		dispatch('guessChange', value);
	}

	function pointerDown(event: PointerEvent) {
		if (disabled || locked || mode !== 'guessing') return;
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		setFromPointer(event.clientX, event.clientY);
	}

	function pointerMove(event: PointerEvent) {
		if (!dragging) return;
		setFromPointer(event.clientX, event.clientY);
	}

	function pointerUp(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		dispatch('guessLock', value);
	}

	function ringChunkStyle(center: number, inner: number, outer: number, side: 'left' | 'right' | 'center'): string {
		const c = clamp(center);
		if (side === 'center') {
			const left = clamp(c - outer);
			const right = clamp(c + outer);
			return `--band-left:${left}%; --band-width:${Math.max(0, right - left)}%;`;
		}
		if (side === 'left') {
			const left = clamp(c - outer);
			const right = clamp(c - inner);
			return `--band-left:${left}%; --band-width:${Math.max(0, right - left)}%;`;
		}
		const left = clamp(c + inner);
		const right = clamp(c + outer);
		return `--band-left:${left}%; --band-width:${Math.max(0, right - left)}%;`;
	}

	function buildScoringChunks(center: number): RingChunk[] {
		const c = clamp(center);
		const out: RingChunk[] = [];
		let z = 20;
		for (const ring of RING_META) {
			if (ring.inner === 0) {
				out.push({
					key: `${ring.label}-mid`,
					label: ring.label,
					color: ring.color,
					z: z++,
					style: ringChunkStyle(c, 0, ring.outer, 'center')
				});
			} else {
				out.push({
					key: `${ring.label}-L`,
					label: ring.label,
					color: ring.color,
					z: z++,
					style: ringChunkStyle(c, ring.inner, ring.outer, 'left')
				});
				out.push({
					key: `${ring.label}-R`,
					label: ring.label,
					color: ring.color,
					z: z++,
					style: ringChunkStyle(c, ring.inner, ring.outer, 'right')
				});
			}
		}
		return out;
	}

	$: scoringChunks = showZones ? buildScoringChunks(targetValue ?? 50) : [];
</script>

<section
	class="spectrum fixed inset-0 isolate h-screen w-screen overflow-hidden text-[var(--text)]"
	class:is-guessing={mode === 'guessing' && !disabled && !locked}
	class:is-reveal={mode === 'reveal'}
	bind:this={frame}
	onpointerdown={pointerDown}
	onpointermove={pointerMove}
	onpointerup={pointerUp}
	onpointercancel={pointerUp}
	role="application"
	aria-label="Spectrum guess"
>
	{#if showZones}
		{#each scoringChunks as chunk (chunk.key)}
			<div
				class="zone"
				style={`${chunk.style} --zone-color:${chunk.color}; z-index:${chunk.z};`}
			>
				<span class="zone-label">{chunk.label}</span>
			</div>
		{/each}
	{/if}

	{#if mode === 'guessing' || mode === 'reveal'}
		<div
			class="guess-marker absolute top-0 bottom-0 z-30 w-px bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-[left] duration-200"
			style={`left:${displayGuess}%; --guess-value:${displayGuess};`}
		>
			<div
				class="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-[rgb(var(--primary))] shadow-[0_0_28px_rgba(var(--primary),0.78)]"
			></div>
		</div>
	{/if}

	<div
		class="spectrum-labels pointer-events-none absolute inset-x-0 top-8 z-50 flex items-start justify-between gap-4 px-6 text-sm font-semibold tracking-[0.18em] text-white/90 uppercase md:px-12"
	>
		<span class="rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">{leftLabel}</span>
		{#if prompt}
			<span
				class="prompt-pill max-w-[60%] rounded-full border border-white/30 bg-black/45 px-4 py-1 text-center text-xs leading-snug tracking-[0.18em] text-white normal-case backdrop-blur-sm md:text-sm"
			>
				{prompt}
			</span>
		{/if}
		<span class="rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">{rightLabel}</span>
	</div>

	<div
		class="pointer-events-none absolute inset-x-0 bottom-8 z-50 flex justify-center px-6 text-center text-sm text-white/70"
	>
		{#if mode === 'guessing' && !locked}
			<span>Drag anywhere on the spectrum</span>
		{:else if mode === 'psychic'}
			<span>Give a clue that points the room toward the hidden target</span>
		{:else if mode === 'reveal'}
			<span>Reveal locked</span>
		{/if}
	</div>
</section>

<style>
	.spectrum {
		touch-action: none;
		background: #000;
	}

	.spectrum.is-guessing {
		cursor: ew-resize;
	}

	.zone {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--band-left);
		width: var(--band-width);
		display: flex;
		align-items: center;
		justify-content: center;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--zone-color) 70%, transparent) 0%,
				color-mix(in srgb, var(--zone-color) 90%, transparent) 50%,
				color-mix(in srgb, var(--zone-color) 70%, transparent) 100%
			);
		box-shadow:
			inset 1px 0 0 rgba(255, 255, 255, 0.25),
			inset -1px 0 0 rgba(0, 0, 0, 0.45);
	}

	.zone-label {
		position: relative;
		display: inline-flex;
		min-width: 2.25rem;
		justify-content: center;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.35);
		padding: 0.25rem 0.65rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: white;
		text-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
	}

	@media (max-width: 639px) {
		.spectrum.is-guessing {
			cursor: ns-resize;
		}

		.zone {
			top: auto;
			left: 0;
			right: 0;
			width: auto;
			bottom: var(--band-left);
			height: var(--band-width);
			background: linear-gradient(
				90deg,
				color-mix(in srgb, var(--zone-color) 70%, transparent) 0%,
				color-mix(in srgb, var(--zone-color) 90%, transparent) 50%,
				color-mix(in srgb, var(--zone-color) 70%, transparent) 100%
			);
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.25),
				inset 0 -1px 0 rgba(0, 0, 0, 0.45);
		}

		.guess-marker {
			top: auto;
			right: 0;
			bottom: var(--mobile-position);
			left: 0 !important;
			width: auto;
			height: 1px;
			transition: bottom 200ms;
			--mobile-position: calc(var(--guess-value) * 1%);
		}

		.spectrum-labels {
			inset: 0 auto 0 0;
			flex-direction: column-reverse;
			padding: 1.5rem;
		}

		.prompt-pill {
			max-width: none;
		}
	}
</style>
