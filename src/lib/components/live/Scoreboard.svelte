<script lang="ts">
	import type { Player, ScoreEntry } from '$lib/live/types';

	export let players: Player[] = [];
	export let scores: ScoreEntry[] = [];

	$: rows = players
		.map((player) => ({
			player,
			points: scores.find((score) => score.playerId === player.id)?.points ?? 0
		}))
		.sort((a, b) => b.points - a.points || a.player.joinOrder - b.player.joinOrder);
</script>

<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-5">
	<h2 class="text-lg font-semibold text-white">Scoreboard</h2>
	<div class="mt-4 space-y-2">
		{#each rows as row, index (row.player.id)}
			<div
				class="flex items-center justify-between rounded-md border border-neutral-800 bg-black/20 px-4 py-3"
			>
				<div class="flex items-center gap-3">
					<span class="text-sm text-[var(--text-secondary)]">#{index + 1}</span>
					<span class="font-medium text-white">{row.player.displayName}</span>
				</div>
				<span class="text-lg font-bold text-[rgb(var(--primary))]">{row.points}</span>
			</div>
		{/each}
	</div>
</div>
