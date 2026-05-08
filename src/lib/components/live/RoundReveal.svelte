<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';
	import Scoreboard from './Scoreboard.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{ next: void; reset: void }>();
	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: result = room.lastRoundResult;
	$: gameEnded = room.winningTeam !== null;
	$: winnerLabel = room.winningTeam === 0 ? 'Team Red' : 'Team Blue';
	$: activeLabel = result
		? result.activeTeam === 0
			? 'Team Red'
			: 'Team Blue'
		: '';
	$: otherLabel = result
		? result.activeTeam === 0
			? 'Team Blue'
			: 'Team Red'
		: '';
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode="reveal"
	targetValue={room.targetValue}
	guessValue={room.lockedGuess ?? room.guessValue ?? 50}
	showScoringBands
	locked
/>

<div class="fixed inset-x-4 bottom-10 z-[70] mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_360px]">
	<div
		class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl backdrop-blur"
	>
		{#if gameEnded}
			<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Game over</p>
			<h1 class="mt-2 text-4xl font-black text-[var(--text)]">{winnerLabel} wins</h1>
			<p class="mt-2 text-[var(--text-secondary)]">
				Final score {room.teamScores[0]}–{room.teamScores[1]}.
			</p>
			{#if isHost}
				<button
					type="button"
					class="mt-5 rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110"
					onclick={() => dispatch('reset')}
				>
					New Game
				</button>
			{:else}
				<p class="mt-5 text-sm text-[var(--text-secondary)]">Waiting for the host.</p>
			{/if}
		{:else}
			<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">Reveal</p>
			<h1 class="mt-2 text-4xl font-black text-[var(--text)]">
				{result?.activePoints ?? 0} {result?.activePoints === 1 ? 'point' : 'points'}
			</h1>
			<p class="mt-2 text-[var(--text-secondary)]">
				{activeLabel} scores {result?.activePoints ?? 0}.
				{#if result && result.leftRightPoints > 0}
					{otherLabel} guessed left/right and gets +1.
				{/if}
			</p>
			<p class="mt-1 text-xs text-[var(--text-secondary)]">
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
		{/if}
	</div>
	<Scoreboard
		players={room.players}
		teamScores={room.teamScores}
		activeTeam={room.activeTeam}
		winningTeam={room.winningTeam}
		winThreshold={room.winThreshold}
	/>
</div>
