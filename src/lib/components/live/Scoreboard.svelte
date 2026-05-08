<script lang="ts">
	import type { Player, ScoreEntry } from '$lib/live/types';

	export let players: Player[] = [];
	export let scores: ScoreEntry[] = [];
	export let psychicId: string | null = null;
	export let currentPlayerId: string | null = null;

	$: rows = players
		.map((player) => ({
			player,
			points: scores.find((score) => score.playerId === player.id)?.points ?? 0
		}))
		.sort((a, b) => b.points - a.points || a.player.joinOrder - b.player.joinOrder);
</script>

<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
	<h2 class="text-lg font-semibold text-[var(--text)]">Scoreboard</h2>
	<div class="mt-4 space-y-2">
		{#each rows as row, index (row.player.id)}
			{@const isPsychic = row.player.id === psychicId}
			{@const isYou = row.player.id === currentPlayerId}
			<div
				class="flex items-center justify-between rounded-md border bg-[var(--bg)] px-4 py-3 transition"
				class:border-[var(--border)]={!isPsychic}
				class:border-[rgb(var(--primary))]={isPsychic}
				style:opacity={row.player.connected ? 1 : 0.55}
			>
				<div class="flex items-center gap-3">
					<span class="text-sm text-[var(--text-secondary)]">#{index + 1}</span>
					<span class="font-medium text-[var(--text)]">{row.player.displayName}</span>
					{#if isYou}
						<span class="text-xs text-[var(--text-secondary)]">(you)</span>
					{/if}
					{#if isPsychic}
						<span
							class="rounded-full border border-[rgba(var(--primary),0.45)] bg-[rgba(var(--primary),0.12)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[rgb(var(--primary))] uppercase"
						>
							Psychic
						</span>
					{/if}
					{#if row.player.isHost}
						<span class="text-xs text-[var(--text-secondary)]">host</span>
					{/if}
					{#if !row.player.connected}
						<span class="text-xs text-[var(--text-secondary)]">offline</span>
					{/if}
				</div>
				<span class="text-lg font-bold text-[rgb(var(--primary))]">{row.points}</span>
			</div>
		{/each}
	</div>
</div>
