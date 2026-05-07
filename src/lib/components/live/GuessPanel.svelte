<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{
		guess: number;
		lock: void;
	}>();

	let guessValue = room.guessValue ?? 50;
	let queuedGuess: number | null = null;
	let guessTimer: ReturnType<typeof setTimeout> | null = null;

	$: isPsychic = room.psychicId === currentPlayerId;
	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: locked = room.lockedGuess !== null;
	$: if (room.guessValue !== null) guessValue = room.guessValue;

	function guess(next: CustomEvent<number>) {
		guessValue = next.detail;
		queuedGuess = guessValue;
		if (guessTimer) return;
		flushQueuedGuess();
		guessTimer = setTimeout(() => {
			guessTimer = null;
			flushQueuedGuess();
		}, 150);
	}

	function flushQueuedGuess() {
		if (queuedGuess === null) return;
		guessValue = queuedGuess;
		queuedGuess = null;
		dispatch('guess', guessValue);
	}

	function lock() {
		flushQueuedGuess();
		dispatch('lock');
	}

	onDestroy(() => {
		if (guessTimer) clearTimeout(guessTimer);
	});
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	mode={isPsychic ? 'spectator' : 'guessing'}
	bind:value={guessValue}
	{guessValue}
	{locked}
	disabled={isPsychic}
	on:guessChange={guess}
	on:guessLock={lock}
/>

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-2xl backdrop-blur"
>
	<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Clue</p>
	<h1 class="mt-2 text-3xl font-black text-[var(--text)]">{room.clue}</h1>
	<p class="mt-2 text-[var(--text-secondary)]">
		{#if isPsychic}
			Watch the room place its guess.
		{:else}
			Drag to guess between {room.spectrum?.left} and {room.spectrum?.right}.
		{/if}
	</p>
	{#if isHost}
		<button
			type="button"
			class="mt-5 rounded-md bg-[rgb(var(--primary))] px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={room.guessValue === null}
			onclick={lock}
		>
			Lock In Guess
		</button>
	{/if}
</div>
