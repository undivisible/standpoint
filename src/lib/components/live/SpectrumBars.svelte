<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let leftLabel = '';
	export let rightLabel = '';
	export let mode: 'psychic' | 'guessing' | 'reveal' | 'spectator' = 'spectator';
	export let targetValue: number | null = null;
	export let guessValue = 50;
	export let value = guessValue;
	export let locked = false;
	export let disabled = false;
	export let showScoringBands = false;

	const dispatch = createEventDispatcher<{
		guessChange: number;
		guessLock: number;
	}>();

	let frame: HTMLElement | null = null;
	let dragging = false;
	let displayGuess = value;

	$: displayGuess = value ?? guessValue;

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

	function bandStyle(radius: number, color: string) {
		const center = targetValue ?? 50;
		const left = clamp(center - radius);
		const width = clamp(center + radius) - left;
		return `left:${left}%; width:${width}%; background:${color};`;
	}
</script>

<section
	class="spectrum fixed inset-0 isolate h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]"
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
	<div class="spectrum-field absolute inset-0"></div>
	<div class="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.42))]"></div>

	{#if showScoringBands && targetValue !== null}
		<div
			class="absolute inset-y-0 z-10 opacity-25 blur-sm"
			style={bandStyle(14, 'rgba(245,158,11,0.55)')}
		></div>
		<div
			class="absolute inset-y-0 z-10 opacity-25 blur-sm"
			style={bandStyle(8, 'rgba(59,130,246,0.55)')}
		></div>
		<div
			class="absolute inset-y-0 z-10 opacity-30 blur-sm"
			style={bandStyle(4, 'rgba(34,197,94,0.6)')}
		></div>
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

	{#if targetValue !== null && (mode === 'psychic' || mode === 'reveal')}
		<div
			class="target absolute top-0 bottom-0 z-40 w-[2px] bg-white shadow-[0_0_40px_rgba(255,255,255,0.9)]"
			style={`left:${targetValue}%; --target-value:${targetValue};`}
		>
			<div
				class="absolute top-[18vh] left-1/2 -translate-x-1/2 rounded-full border border-[rgba(var(--primary),0.6)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[rgb(var(--primary))]"
			>
				{Math.round(targetValue)}
			</div>
		</div>
	{/if}

	<div
		class="spectrum-labels pointer-events-none absolute inset-x-0 top-8 z-50 flex items-start justify-between px-6 text-sm font-semibold tracking-[0.18em] text-[var(--text-secondary)] uppercase md:px-12"
	>
		<span>{leftLabel}</span>
		<span>{rightLabel}</span>
	</div>

	<div
		class="pointer-events-none absolute inset-x-0 bottom-8 z-50 flex justify-center px-6 text-center text-sm text-[var(--text-secondary)]"
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
	}

	.spectrum.is-guessing {
		cursor: ew-resize;
	}

	.spectrum-field {
		background: linear-gradient(
			90deg,
			#ef4444 0%,
			#f97316 18%,
			#facc15 36%,
			#22c55e 50%,
			#14b8a6 64%,
			#3b82f6 82%,
			#8b5cf6 100%
		);
	}

	@media (max-width: 639px) {
		.spectrum.is-guessing {
			cursor: ns-resize;
		}

		.spectrum-field {
			background: linear-gradient(
				0deg,
				#ef4444 0%,
				#f97316 18%,
				#facc15 36%,
				#22c55e 50%,
				#14b8a6 64%,
				#3b82f6 82%,
				#8b5cf6 100%
			);
		}

		.guess-marker,
		.target {
			top: auto;
			right: 0;
			bottom: var(--mobile-position);
			left: 0 !important;
			width: auto;
			height: 1px;
			transition: bottom 200ms;
		}

		.guess-marker {
			--mobile-position: calc(var(--guess-value) * 1%);
		}

		.target {
			--mobile-position: calc(var(--target-value) * 1%);
		}

		.spectrum-labels {
			inset: 0 auto 0 0;
			flex-direction: column-reverse;
			padding: 1.5rem;
		}
	}
</style>
