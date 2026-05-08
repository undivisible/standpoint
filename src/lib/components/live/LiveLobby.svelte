<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState, RoomSettingsInput } from '$lib/live/types';
	import GameSettings from './GameSettings.svelte';
	import PlayerList from './PlayerList.svelte';
	import RoomCodeInvite from './RoomCodeInvite.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{
		start: void;
		leave: void;
		settings: RoomSettingsInput;
	}>();

	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: connectedTeamA = room.players.filter(
		(player) => player.connected && !player.isHost && player.team === 0
	).length;
	$: connectedTeamB = room.players.filter(
		(player) => player.connected && !player.isHost && player.team === 1
	).length;
	$: canStart = connectedTeamA >= 1 && connectedTeamB >= 1;
</script>

<section
	class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-6 px-4 py-10 md:grid-cols-[1fr_360px]"
>
	<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-8">
		<p class="text-sm tracking-[0.28em] text-[rgb(var(--primary))] uppercase">Spectrum</p>
		<h1 class="mt-4 font-sans text-5xl font-black text-[var(--text)] md:text-7xl">Lobby</h1>
		<p class="mt-4 max-w-2xl text-lg text-[var(--text-secondary)]">
			Two teams take turns. Each round one team's psychic sees a hidden target on the spectrum, gives
			a clue, and their team places a guess. The other team picks left or right of that guess. First
			team to {room.winThreshold} wins. The host runs the game and doesn't play.
		</p>
		<div class="mt-8 flex flex-wrap gap-3">
			<button
				type="button"
				class="rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
				disabled={!isHost || !canStart}
				onclick={() => dispatch('start')}
			>
				Start Game
			</button>
			<button
				type="button"
				class="rounded-md border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
				onclick={() => dispatch('leave')}
			>
				Leave
			</button>
		</div>
		{#if !isHost}
			<p class="mt-4 text-sm text-[var(--text-secondary)]">Waiting for the host to start.</p>
		{:else if !canStart}
			<p class="mt-4 text-sm text-[var(--text-secondary)]">
				Each team needs at least one connected player. Team Red {connectedTeamA}, Team Blue
				{connectedTeamB}.
			</p>
		{/if}
	</div>

	<div class="space-y-4">
		<RoomCodeInvite code={room.code} />
		{#if isHost}
			<GameSettings
				settings={room.settings}
				on:save={(event) => dispatch('settings', event.detail)}
			/>
		{:else if room.settings.customPrompt || room.settings.customLeftLabel || room.settings.customRightLabel}
			<div class="border border-[var(--border)] bg-[var(--surface)] p-5">
				<p class="text-xs tracking-[0.24em] text-[var(--text-secondary)] uppercase">
					Game settings
				</p>
				{#if room.settings.customPrompt}
					<p class="mt-3 text-base text-[var(--text)]">{room.settings.customPrompt}</p>
				{/if}
				{#if room.settings.customLeftLabel || room.settings.customRightLabel}
					<p class="mt-2 text-sm text-[var(--text-secondary)]">
						{room.settings.customLeftLabel ?? '—'} / {room.settings.customRightLabel ?? '—'}
					</p>
				{/if}
			</div>
		{/if}
		<PlayerList players={room.players} psychicId={room.psychicId} />
	</div>
</section>
