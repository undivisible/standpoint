<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{ submit: string }>();
	let clue = '';
	let error = '';

	$: isPsychic = room.psychicId === currentPlayerId;
	$: canSubmit = isPsychic && clue.trim().length > 0 && !/\d|%|percent/i.test(clue.trim());

	function submit() {
		error = '';
		if (!canSubmit) {
			error = 'Clue required, and it cannot include numbers.';
			return;
		}
		dispatch('submit', clue.trim());
	}
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode={isPsychic ? 'psychic' : 'spectator'}
	targetValue={isPsychic ? room.targetValue : null}
	disabled
/>

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl backdrop-blur"
>
	{#if isPsychic}
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">You are psychic</p>
		<h1 class="mt-2 text-2xl font-bold text-[var(--text)]">
			{room.spectrum?.left} / {room.spectrum?.right}
		</h1>
		<textarea
			bind:value={clue}
			maxlength="200"
			class="mt-4 min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))]"
			placeholder="Write a clue without numbers"
		></textarea>
		<div class="mt-3 flex items-center justify-between gap-3">
			<p class="text-sm text-[var(--text-secondary)]">{clue.length}/200</p>
			<button
				type="button"
				class="rounded-md bg-[rgb(var(--primary))] px-5 py-2 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
				disabled={!canSubmit}
				onclick={submit}
			>
				Submit Clue
			</button>
		</div>
		{#if error}
			<p class="mt-2 text-sm text-red-300">{error}</p>
		{/if}
	{:else}
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">
			Psychic is thinking
		</p>
		<h1 class="mt-2 text-2xl font-bold text-[var(--text)]">Waiting for the clue</h1>
		<p class="mt-2 text-[var(--text-secondary)]">The target is hidden until reveal.</p>
	{/if}
</div>
