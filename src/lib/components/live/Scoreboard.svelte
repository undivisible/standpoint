<script lang="ts">
	import type { Player, TeamScores } from '$lib/live/types';

	export let players: Player[] = [];
	export let teamScores: TeamScores = { 0: 0, 1: 0 };
	export let activeTeam: 0 | 1 | null = null;
	export let winningTeam: 0 | 1 | null = null;
	export let winThreshold = 10;

	$: teamA = players.filter((player) => !player.isHost && player.team === 0);
	$: teamB = players.filter((player) => !player.isHost && player.team === 1);

	function teamLabel(team: 0 | 1) {
		return team === 0 ? 'Team Red' : 'Team Blue';
	}

	function teamAccent(team: 0 | 1) {
		return team === 0 ? '#ef4444' : '#3b82f6';
	}
</script>

<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
	<div class="flex items-baseline justify-between">
		<h2 class="text-lg font-semibold text-[var(--text)]">Scoreboard</h2>
		<span class="text-xs tracking-[0.18em] text-[var(--text-secondary)] uppercase">
			First to {winThreshold}
		</span>
	</div>
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each [0, 1] as team (team)}
			{@const t = team as 0 | 1}
			{@const roster = t === 0 ? teamA : teamB}
			{@const isActive = activeTeam === t}
			{@const isWinner = winningTeam === t}
			<div
				class="rounded-md border bg-[var(--bg)] px-4 py-3 transition"
				class:border-[var(--border)]={!isActive && !isWinner}
				style:border-color={isWinner || isActive ? teamAccent(t) : ''}
				style:box-shadow={isWinner ? `0 0 0 2px ${teamAccent(t)}` : ''}
			>
				<div class="flex items-baseline justify-between gap-3">
					<div class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 rounded-full" style:background={teamAccent(t)}></span>
						<span class="text-sm font-semibold tracking-[0.16em] text-[var(--text)] uppercase">
							{teamLabel(t)}
						</span>
						{#if isActive}
							<span class="rounded-full border border-current px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase opacity-80">
								Active
							</span>
						{/if}
					</div>
					<span class="text-3xl font-black text-[var(--text)]">{teamScores[t] ?? 0}</span>
				</div>
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#if roster.length === 0}
						<span class="text-xs text-[var(--text-secondary)]">Waiting for players</span>
					{:else}
						{#each roster as player (player.id)}
							<span
								class="rounded-full border px-2.5 py-1 text-xs"
								style:border-color={teamAccent(t)}
								style:opacity={player.connected ? 1 : 0.45}
							>
								{player.displayName}
							</span>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
