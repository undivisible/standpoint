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
	export let axisEditable = false;

	const scoringZones = [
		{ radius: 14, points: 2, color: '#facc15' },
		{ radius: 8, points: 3, color: '#3b82f6' },
		{ radius: 4, points: 4, color: '#10b981' }
	];

	const dispatch = createEventDispatcher<{
		guessChange: number;
		guessLock: number;
		axisEdit: 'left' | 'right';
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

	function bandStyle(radius: number) {
		const center = targetValue ?? 50;
		const left = clamp(center - radius);
		const width = clamp(center + radius) - left;
		return `--band-left:${left}%; --band-width:${width}%;`;
	}
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
		{#each scoringZones as zone (zone.points)}
			<div
				class="zone"
				class:zone-2={zone.points === 2}
				class:zone-3={zone.points === 3}
				class:zone-4={zone.points === 4}
				style={`${bandStyle(zone.radius)} --zone-color:${zone.color};`}
			>
				<span class="zone-label">{zone.points}</span>
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
		class="spectrum-labels absolute inset-x-0 top-8 z-50 flex items-start justify-between gap-4 px-6 text-sm font-semibold tracking-[0.18em] text-white/90 uppercase md:px-12"
		class:pointer-events-none={!axisEditable}
	>
		{#if axisEditable}
			<button
				type="button"
				class="axis-pill rounded-full border border-white/25 bg-black/40 px-3 py-1 backdrop-blur-sm transition hover:border-white/50 hover:bg-black/55 pointer-events-auto"
				onclick={(e) => {
					e.stopPropagation();
					dispatch('axisEdit', 'left');
				}}
			>
				{leftLabel}
			</button>
		{:else}
			<span class="rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">{leftLabel}</span>
		{/if}
		{#if prompt}
			<span
				class="prompt-pill max-w-[60%] rounded-full border border-white/30 bg-black/45 px-4 py-1 text-center text-xs leading-snug tracking-[0.18em] text-white normal-case backdrop-blur-sm md:text-sm"
			>
				{prompt}
			</span>
		{/if}
		{#if axisEditable}
			<button
				type="button"
				class="axis-pill rounded-full border border-white/25 bg-black/40 px-3 py-1 backdrop-blur-sm transition hover:border-white/50 hover:bg-black/55 pointer-events-auto"
				onclick={(e) => {
					e.stopPropagation();
					dispatch('axisEdit', 'right');
				}}
			>
				{rightLabel}
			</button>
		{:else}
			<span class="rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">{rightLabel}</span>
		{/if}
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

	.zone-2 {
		z-index: 11;
	}
	.zone-3 {
		z-index: 12;
	}
	.zone-4 {
		z-index: 13;
	}

	.zone-label {
		position: relative;
		display: inline-flex;
		min-width: 2.5rem;
		justify-content: center;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.35);
		padding: 0.25rem 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
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
			justify-content: center;
			align-items: center;
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
