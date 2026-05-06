<script lang="ts">
	import type { Player } from '$lib/live/types';

	export let players: Player[] = [];
	export let psychicId: string | null = null;
</script>

<div class="space-y-2">
	{#each players as player (player.id)}
		<div
			class="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/80 px-4 py-3"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-[var(--surface)] text-sm font-bold text-[rgb(var(--primary))]"
				>
					{player.displayName.slice(0, 1).toUpperCase()}
				</div>
				<div>
					<div class="font-medium text-white">{player.displayName}</div>
					<div class="text-xs text-[var(--text-secondary)]">
						{player.connected ? 'connected' : 'disconnected'}
						{#if player.isHost}
							<span> · host</span>
						{/if}
					</div>
				</div>
			</div>
			{#if player.id === psychicId}
				<div
					class="rounded-full border border-[rgba(var(--primary),0.45)] bg-[rgba(var(--primary),0.12)] px-3 py-1 text-xs font-semibold text-[rgb(var(--primary))]"
				>
					psychic
				</div>
			{/if}
		</div>
	{/each}
</div>
