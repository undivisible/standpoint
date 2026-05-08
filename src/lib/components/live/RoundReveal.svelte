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
	$: results = [...(room.lastRoundResults ?? [])].sort((a, b) => b.points - a.points);
	$: topPoints = results[0]?.points ?? 0;
	$: avgGuess =
		results.length > 0
			? Math.round(results.reduce((sum, entry) => sum + entry.value, 0) / results.length)
			: null;
	$: phaseLabel = room.phase === 'scoring' ? 'Locking in scores' : 'Reveal';
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode="reveal"
	targetValue={room.targetValue}
	guessValue={avgGuess ?? 50}
	showScoringBands
	locked
/>

<div class="fixed inset-x-4 bottom-10 z-[70] mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_360px]">
	<div
		class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl backdrop-blur"
	>
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">{phaseLabel}</p>
		<h1 class="mt-2 text-3xl font-black text-[var(--text)]">
			Target {room.targetValue ?? 0}
		</h1>
		<p class="mt-1 text-xs text-[var(--text-secondary)]">
			Clue: <span class="text-[var(--text)]">{room.clue ?? '—'}</span>
		</p>

		{#if results.length > 0}
			<ul class="mt-4 max-h-56 space-y-1.5 overflow-y-auto pr-1">
				{#each results as entry (entry.playerId)}
					<li
						class="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
					>
						<div class="flex items-center gap-2">
							<span class="font-semibold text-[var(--text)]">{entry.displayName}</span>
							<span class="text-xs text-[var(--text-secondary)]">
								guess {entry.value} · off {entry.distance}
							</span>
						</div>
						<span class="text-base font-black text-[rgb(var(--primary))]">+{entry.points}</span>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-[var(--text-secondary)]">
				Best this round: {topPoints} {topPoints === 1 ? 'point' : 'points'}.
			</p>
		{:else}
			<p class="mt-4 text-sm text-[var(--text-secondary)]">No guesses were placed this round.</p>
		{/if}

		{#if isHost}
			<div class="mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110"
					onclick={() => dispatch('next')}
				>
					Next Round
				</button>
				<button
					type="button"
					class="rounded-md border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
					onclick={() => dispatch('reset')}
				>
					End Game
				</button>
			</div>
		{:else}
			<p class="mt-5 text-sm text-[var(--text-secondary)]">
				Waiting for the host to start the next round.
			</p>
		{/if}
	</div>
	<Scoreboard
		players={room.players}
		scores={room.scores}
		psychicId={room.psychicId}
		{currentPlayerId}
	/>
</div>
