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

	/** Wavelength scoring rings: narrow bullseye, wider 3, widest 2. */
	const RING_META = [
		{ inner: 8, outer: 16, label: '2', color: '#facc15' },
		{ inner: 2, outer: 8, label: '3', color: '#3b82f6' },
		{ inner: 0, outer: 2, label: '4', color: '#10b981' }
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
		axisChange: { side: 'left' | 'right'; value: string };
	}>();

	let frame: HTMLElement | null = null;
	let dragging = false;
	let displayGuess = value;
	let editingSide: 'left' | 'right' | null = null;
	let leftDraft = leftLabel;
	let rightDraft = rightLabel;

	$: if (editingSide !== 'left') leftDraft = leftLabel;
	$: if (editingSide !== 'right') rightDraft = rightLabel;

	function startAxisEdit(side: 'left' | 'right', event: Event) {
		if (!axisEditable) return;
		event.stopPropagation();
		event.preventDefault();
		editingSide = side;
		if (side === 'left') leftDraft = leftLabel;
		else rightDraft = rightLabel;
		queueMicrotask(() => {
			const el = document.getElementById(side === 'left' ? 'axis-left-input' : 'axis-right-input');
			if (el instanceof HTMLInputElement) {
				el.focus();
				el.select();
			}
		});
	}

	function commitAxisEdit(side: 'left' | 'right') {
		const draft = side === 'left' ? leftDraft : rightDraft;
		const trimmed = draft.trim().slice(0, 40);
		const original = side === 'left' ? leftLabel : rightLabel;
		editingSide = null;
		if (!trimmed || trimmed === original) {
			if (side === 'left') leftDraft = leftLabel;
			else rightDraft = rightLabel;
			return;
		}
		dispatch('axisChange', { side, value: trimmed });
	}

	function cancelAxisEdit(side: 'left' | 'right') {
		if (side === 'left') leftDraft = leftLabel;
		else rightDraft = rightLabel;
		editingSide = null;
	}

	$: displayGuess = value ?? guessValue;
	$: showZones =
		targetValue !== null && (mode === 'psychic' || mode === 'reveal' || showScoringBands);

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
	}

	function ringChunkStyle(
		center: number,
		inner: number,
		outer: number,
		side: 'left' | 'right' | 'center'
	): string {
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
	class="spectrum absolute inset-0 isolate h-full min-h-0 w-full max-w-full overflow-hidden text-[var(--text)]"
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
			<div class="zone" style={`${chunk.style} --zone-color:${chunk.color}; z-index:${chunk.z};`}>
				<span class="zone-label">{chunk.label}</span>
			</div>
		{/each}
		<div
			class="target-line absolute top-0 bottom-0 z-40 w-[2px] bg-white shadow-[0_0_28px_rgba(255,255,255,0.85)]"
			style={`left:${targetValue}%; --target-value:${targetValue};`}
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

	<div
		class="spectrum-labels absolute inset-x-0 top-8 z-50 flex items-start justify-between gap-4 px-6 text-sm font-semibold tracking-[0.18em] text-white/90 uppercase md:px-12"
		class:pointer-events-none={!axisEditable && !editingSide}
	>
		{#if axisEditable && editingSide === 'left'}
			<input
				id="axis-left-input"
				bind:value={leftDraft}
				maxlength="40"
				class="axis-input pointer-events-auto rounded-full border border-white/60 bg-black/60 px-3 py-1 text-left text-sm tracking-[0.18em] text-white uppercase outline-none"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
				onblur={() => commitAxisEdit('left')}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						commitAxisEdit('left');
					} else if (e.key === 'Escape') {
						e.preventDefault();
						cancelAxisEdit('left');
					}
				}}
			/>
		{:else if axisEditable}
			<button
				type="button"
				class="axis-pill pointer-events-auto rounded-full border border-white/25 bg-black/40 px-3 py-1 backdrop-blur-sm transition hover:border-white/60 hover:bg-black/55"
				title="Click to rename"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={(e) => startAxisEdit('left', e)}
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
		{#if axisEditable && editingSide === 'right'}
			<input
				id="axis-right-input"
				bind:value={rightDraft}
				maxlength="40"
				class="axis-input pointer-events-auto rounded-full border border-white/60 bg-black/60 px-3 py-1 text-right text-sm tracking-[0.18em] text-white uppercase outline-none"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
				onblur={() => commitAxisEdit('right')}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						commitAxisEdit('right');
					} else if (e.key === 'Escape') {
						e.preventDefault();
						cancelAxisEdit('right');
					}
				}}
			/>
		{:else if axisEditable}
			<button
				type="button"
				class="axis-pill pointer-events-auto rounded-full border border-white/25 bg-black/40 px-3 py-1 backdrop-blur-sm transition hover:border-white/60 hover:bg-black/55"
				title="Click to rename"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={(e) => startAxisEdit('right', e)}
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
			<span>Tap or drag the spectrum to place the guess</span>
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
		background: linear-gradient(
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

		.target-line {
			top: auto;
			right: 0;
			bottom: var(--mobile-target);
			left: 0 !important;
			width: auto;
			height: 2px;
			--mobile-target: calc(var(--target-value) * 1%);
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
