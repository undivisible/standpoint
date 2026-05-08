<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{
		guess: number;
		lock: void;
		kick: string;
	}>();

	$: isPsychic = room.psychicId === currentPlayerId;
	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: canGuess = !isPsychic && Boolean(currentPlayerId);
	$: myCurrentGuess = currentPlayerId ? room.guesses?.[currentPlayerId] : undefined;

	let localGuess = myCurrentGuess ?? 50;
	let queued: number | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	$: if (myCurrentGuess !== undefined && timer === null && queued === null) {
		localGuess = myCurrentGuess;
	}

	function onChange(event: CustomEvent<number>) {
		localGuess = event.detail;
		queued = localGuess;
		if (timer) return;
		flush();
		timer = setTimeout(() => {
			timer = null;
			flush();
		}, 120);
	}

	function flush() {
		if (queued === null) return;
		const value = queued;
		queued = null;
		dispatch('guess', value);
	}

	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	$: guessesPlaced = room.players.filter(
		(p) => p.connected && p.id !== room.psychicId && room.guesses?.[p.id] !== undefined
	).length;
	$: guessesNeeded = room.players.filter((p) => p.connected && p.id !== room.psychicId).length;
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode={canGuess ? 'guessing' : 'spectator'}
	value={localGuess}
	guessValue={localGuess}
	disabled={!canGuess}
	on:guessChange={onChange}
/>

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-2xl backdrop-blur"
>
	<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Clue</p>
	<h1 class="mt-2 text-3xl font-black text-[var(--text)]">{room.clue}</h1>

	{#if room.players.length > 0}
		<div class="mt-3 flex flex-wrap justify-center gap-1.5">
			{#each room.players.filter((p) => p.connected && p.id !== room.psychicId) as player (player.id)}
				{@const has = room.guesses?.[player.id] !== undefined}
				{@const isMe = player.id === currentPlayerId}
				<span
					class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
					class:border-[var(--border)]={!has}
					class:text-[var(--text-secondary)]={!has}
					class:border-[rgb(var(--primary))]={has}
					class:text-[rgb(var(--primary))]={has}
					title={has ? `Guessed ${room.guesses?.[player.id]}` : 'Hasn’t guessed yet'}
				>
					<span>{player.displayName}{has ? ' ✓' : ''}</span>
					{#if isHost && !player.isHost && !isMe}
						<button
							type="button"
							class="rounded-full border border-[var(--border)] px-1.5 text-[10px] text-[var(--text-secondary)] transition hover:border-red-500 hover:text-red-300"
							title="Kick"
							onclick={() => dispatch('kick', player.id)}
						>
							×
						</button>
					{/if}
				</span>
			{/each}
		</div>
		<p class="mt-2 text-xs text-[var(--text-secondary)]">
			{guessesPlaced}/{guessesNeeded} guesses in
		</p>
	{/if}

	<p class="mt-3 text-[var(--text-secondary)]">
		{#if isPsychic}
			Watch everyone place their guesses.
		{:else if canGuess}
			Tap or drag the spectrum to place your own guess between {room.spectrum?.left} and {room.spectrum?.right}.
		{/if}
	</p>

	{#if isHost}
		<button
			type="button"
			class="mt-5 rounded-md bg-[rgb(var(--primary))] px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={guessesPlaced === 0}
			onclick={() => dispatch('lock')}
		>
			Lock Guesses & Reveal
		</button>
		{#if guessesPlaced === 0}
			<p class="mt-2 text-xs text-[var(--text-secondary)]">
				At least one guess is needed before reveal.
			</p>
		{/if}
	{:else}
		<p class="mt-4 text-xs text-[var(--text-secondary)]">
			The host will lock guesses when everyone is ready.
		</p>
	{/if}
</div>
