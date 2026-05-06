<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState } from '$lib/live/types';
	import PlayerList from './PlayerList.svelte';
	import RoomCodeInvite from './RoomCodeInvite.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{
		start: void;
		leave: void;
	}>();

	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: connectedCount = room.players.filter((player) => player.connected).length;
</script>

<section
	class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-6 px-4 py-10 md:grid-cols-[1fr_360px]"
>
	<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-8">
		<p class="text-sm tracking-[0.28em] text-[rgb(var(--primary))] uppercase">Standpoint Live</p>
		<h1 class="mt-4 font-sans text-5xl font-black text-white md:text-7xl">Lobby</h1>
		<p class="mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
			Invite at least one other player. One psychic sees the target, gives a clue, and everyone else
			drags the room guess across the spectrum.
		</p>
		<div class="mt-8 flex flex-wrap gap-3">
			<button
				type="button"
				class="rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
				disabled={!isHost || connectedCount < 2}
				onclick={() => dispatch('start')}
			>
				Start Game
			</button>
			<button
				type="button"
				class="rounded-md border border-neutral-700 px-5 py-3 font-semibold text-white transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
				onclick={() => dispatch('leave')}
			>
				Leave
			</button>
		</div>
		{#if !isHost}
			<p class="mt-4 text-sm text-[var(--text-secondary)]">Waiting for the host to start.</p>
		{:else if connectedCount < 2}
			<p class="mt-4 text-sm text-[var(--text-secondary)]">Two connected players are required.</p>
		{/if}
	</div>

	<div class="space-y-4">
		<RoomCodeInvite code={room.code} />
		<PlayerList players={room.players} psychicId={room.psychicId} />
	</div>
</section>
