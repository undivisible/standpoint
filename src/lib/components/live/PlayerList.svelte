<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Player } from '$lib/live/types';

	export let players: Player[] = [];
	export let psychicId: string | null = null;
	export let currentPlayerId: string | null = null;
	export let canKick = false;

	const dispatch = createEventDispatcher<{ kick: string }>();
</script>

<div class="space-y-2">
	{#each players as player (player.id)}
		{@const isYou = player.id === currentPlayerId}
		<div
			class="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-sm font-bold text-[rgb(var(--primary))]"
				>
					{player.displayName.slice(0, 1).toUpperCase()}
				</div>
				<div>
					<div class="font-medium text-[var(--text)]">
						{player.displayName}
						{#if isYou}
							<span class="ml-1 text-xs text-[var(--text-secondary)]">(you)</span>
						{/if}
					</div>
					<div class="text-xs text-[var(--text-secondary)]">
						{#if player.isHost}
							host ·
						{/if}
						{player.connected ? 'connected' : 'disconnected'}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				{#if player.id === psychicId}
					<div
						class="rounded-full border border-[rgba(var(--primary),0.45)] bg-[rgba(var(--primary),0.12)] px-3 py-1 text-xs font-semibold text-[rgb(var(--primary))]"
					>
						psychic
					</div>
				{/if}
				{#if canKick && !player.isHost && !isYou}
					<button
						type="button"
						class="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:border-red-500 hover:text-red-300"
						title="Remove from room"
						onclick={() => dispatch('kick', player.id)}
					>
						Kick
					</button>
				{/if}
			</div>
		</div>
	{/each}
</div>
