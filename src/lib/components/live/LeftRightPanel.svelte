<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{ guess: 'left' | 'right' }>();
	$: currentPlayer = room.players.find((player) => player.id === currentPlayerId);
	$: psychic = room.players.find((player) => player.id === room.psychicId);
	$: canGuess = currentPlayer && psychic && currentPlayer.team !== psychic.team;
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	mode="spectator"
	guessValue={room.lockedGuess ?? room.guessValue ?? 50}
	locked
/>

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-2xl backdrop-blur"
>
	<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Left or right</p>
	<h1 class="mt-2 text-3xl font-black text-[var(--text)]">{room.clue}</h1>
	<p class="mt-2 text-[var(--text-secondary)]">
		Is the hidden target left or right of the locked guess?
	</p>
	{#if canGuess}
		<div class="mt-5 grid grid-cols-2 gap-3">
			<button
				type="button"
				class="border border-[var(--border)] px-5 py-4 font-black text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
				onclick={() => dispatch('guess', 'left')}
			>
				Left
			</button>
			<button
				type="button"
				class="border border-[var(--border)] px-5 py-4 font-black text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
				onclick={() => dispatch('guess', 'right')}
			>
				Right
			</button>
		</div>
	{:else}
		<p class="mt-5 text-sm text-[var(--text-secondary)]">Waiting for other team.</p>
	{/if}
</div>
