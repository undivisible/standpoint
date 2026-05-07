<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { currentUser } from '$lib/stores';
	import { LiveWSClient } from '$lib/live/ws-client';
	import LiveLobby from '$lib/components/live/LiveLobby.svelte';
	import PsychicPanel from '$lib/components/live/PsychicPanel.svelte';
	import GuessPanel from '$lib/components/live/GuessPanel.svelte';
	import LeftRightPanel from '$lib/components/live/LeftRightPanel.svelte';
	import RoundReveal from '$lib/components/live/RoundReveal.svelte';
	import Scoreboard from '$lib/components/live/Scoreboard.svelte';
	import type { PublicRoomState } from '$lib/live/types';

	let playerName = '';
	let joined = false;
	let initialRoom: PublicRoomState | null = null;
	let roomState: PublicRoomState | null = null;
	let currentPlayerId: string | null = null;
	let client: LiveWSClient | null = null;
	let loading = true;
	let error = '';
	let liveUserId = '';

	$: code = ($page.params.code ?? '').toUpperCase();
	$: defaultName = $currentUser?.displayName || $currentUser?.email?.split('@')[0] || '';
	$: if (!playerName && defaultName) playerName = defaultName;

	async function loadRoom() {
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/live/rooms/${code}`);
			if (!response.ok) throw new Error(await response.text());
			initialRoom = await response.json();
			const saved = localStorage.getItem('standpointLiveName');
			if (!playerName) playerName = saved || defaultName || 'Player';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Room not found.';
		} finally {
			loading = false;
		}
	}

	function join() {
		playerName = playerName.trim() || 'Player';
		localStorage.setItem('standpointLiveName', playerName);
		liveUserId = $currentUser?.uid ?? liveUserId;
		client = new LiveWSClient(code);
		client.on('room_snapshot', (message) => {
			const snapshot = message.data;
			if (!snapshot?.players) {
				error = 'Received an invalid spectrum room message.';
				return;
			}
			roomState = snapshot;
			const me = liveUserId
				? snapshot.players.find((player) => player.userId === liveUserId)
				: snapshot.players.find((player) => player.displayName === playerName);
			currentPlayerId = me?.id ?? currentPlayerId;
		});
		client.on('error', (message) => {
			error = message.message;
		});
		client.connect(playerName, liveUserId);
		joined = true;
	}

	function leave() {
		client?.leaveRoom();
		goto('/live');
	}

	onMount(() => {
		const existing = localStorage.getItem('standpointLiveUserId');
		liveUserId = $currentUser?.uid ?? existing ?? `local_${crypto.randomUUID()}`;
		localStorage.setItem('standpointLiveUserId', liveUserId);
		void loadRoom();
	});

	onDestroy(() => {
		client?.disconnect();
	});
</script>

<svelte:head>
	<title>Spectrum Room {code}</title>
</svelte:head>

{#if loading}
	<section
		class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[var(--bg)] text-[var(--text-secondary)]"
	>
		Loading room…
	</section>
{:else if error && !joined}
	<section
		class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[var(--bg)] px-4 text-center"
	>
		<div class="max-w-md rounded-md border border-neutral-800 bg-neutral-900/80 p-6">
			<h1 class="text-2xl font-bold text-white">Room unavailable</h1>
			<p class="mt-2 text-[var(--text-secondary)]">{error}</p>
			<a
				class="mt-5 inline-block rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white"
				href="/spectrum">Back to Spectrum</a
			>
		</div>
	</section>
{:else if !joined}
	<section class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[var(--bg)] px-4">
		<div class="w-full max-w-md rounded-md border border-neutral-800 bg-neutral-900/80 p-6">
			<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">
				Join {initialRoom?.code ?? code}
			</p>
			<h1 class="mt-2 text-3xl font-black text-white">Enter the room</h1>
			<input
				bind:value={playerName}
				maxlength="40"
				class="mt-5 w-full rounded-md border border-neutral-800 bg-black/30 px-4 py-3 text-white transition outline-none focus:border-[rgb(var(--primary))]"
				placeholder="Display name"
				onkeydown={(event) => {
					if (event.key === 'Enter') join();
				}}
			/>
			<button
				type="button"
				class="mt-4 w-full rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110"
				onclick={join}
			>
				Join Room
			</button>
		</div>
	</section>
{:else}
	{#if error}
		<div
			class="fixed top-4 left-1/2 z-[90] -translate-x-1/2 rounded-md border border-red-900/60 bg-red-950/90 px-4 py-2 text-sm text-red-100"
		>
			{error}
		</div>
	{/if}

	{#if !roomState}
		<section
			class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[var(--bg)] text-[var(--text-secondary)]"
		>
			Connecting…
		</section>
	{:else if roomState.phase === 'lobby' || roomState.phase === 'starting'}
		<LiveLobby
			room={roomState}
			{currentPlayerId}
			on:start={() => client?.startGame()}
			on:leave={leave}
		/>
	{:else if roomState.phase === 'psychic_clue'}
		<PsychicPanel
			room={roomState}
			{currentPlayerId}
			on:submit={(event) => client?.submitClue(event.detail)}
		/>
	{:else if roomState.phase === 'guessing'}
		<GuessPanel
			room={roomState}
			{currentPlayerId}
			on:guess={(event) => client?.updateGuess(event.detail)}
			on:lock={() => client?.lockGuess()}
		/>
	{:else if roomState.phase === 'left_right'}
		<LeftRightPanel
			room={roomState}
			{currentPlayerId}
			on:guess={(event) => client?.submitLeftRight(event.detail)}
		/>
	{:else if roomState.phase === 'reveal'}
		<RoundReveal room={roomState} {currentPlayerId} on:next={() => client?.nextRound()} />
	{:else if roomState.phase === 'scoring'}
		<section class="min-h-[calc(100vh-5rem)] bg-[var(--bg)] px-4 py-10">
			<div class="mx-auto max-w-3xl">
				<h1 class="text-4xl font-black text-white">Next round starting</h1>
				<p class="mt-2 text-[var(--text-secondary)]">Scores are locked. Rotating psychic.</p>
				<div class="mt-6">
					<Scoreboard players={roomState.players} scores={roomState.scores} />
				</div>
			</div>
		</section>
	{:else}
		<section class="min-h-[calc(100vh-5rem)] bg-[var(--bg)] px-4 py-10 text-white">
			Game ended.
		</section>
	{/if}
{/if}
