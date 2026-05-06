<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';
	import Scoreboard from './Scoreboard.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{ next: void }>();
	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: roundPoints = room.lastRoundPoints.reduce((sum, entry) => Math.max(sum, entry.points), 0);
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	mode="reveal"
	targetValue={room.targetValue}
	guessValue={room.lockedGuess ?? room.guessValue ?? 50}
	showScoringBands
	locked
/>

<div class="fixed inset-x-4 bottom-10 z-[70] mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_360px]">
	<div class="rounded-md border border-neutral-800 bg-neutral-950/90 p-6 shadow-2xl backdrop-blur">
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Reveal</p>
		<h1 class="mt-2 text-4xl font-black text-white">{roundPoints} points</h1>
		<p class="mt-2 text-[var(--text-secondary)]">
			Target {room.targetValue ?? 0}, guess {room.lockedGuess ?? room.guessValue ?? 0}, distance {Math.round(
				room.lastDistance ?? 0
			)}.
		</p>
		{#if isHost}
			<button
				type="button"
				class="mt-5 rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110"
				onclick={() => dispatch('next')}
			>
				Next Round
			</button>
		{:else}
			<p class="mt-5 text-sm text-[var(--text-secondary)]">Next round starts automatically.</p>
		{/if}
	</div>
	<Scoreboard players={room.players} scores={room.scores} />
</div>
