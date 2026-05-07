<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/stores';
	import type { PublicRoomListEntry } from '$lib/live/types';

	let playerName = '';
	let roomCode = '';
	let visibility: 'private' | 'public' = 'private';
	let publicRooms: PublicRoomListEntry[] = [];
	let busy = false;
	let error = '';
	const roomTileColors = [
		'#FFD6E0',
		'#FFEFB5',
		'#C1E7E3',
		'#DCEBDD',
		'#E2D0F9',
		'#FFB5B5',
		'#B5E5FF'
	];

	$: defaultName = $currentUser?.displayName || $currentUser?.email?.split('@')[0] || '';
	$: if (!playerName && defaultName) playerName = defaultName;

	function cleanCode(value: string) {
		return value
			.replace(/[^a-z0-9]/gi, '')
			.toUpperCase()
			.slice(0, 6);
	}

	function roomTileColor(index: number) {
		return roomTileColors[index % roomTileColors.length];
	}

	function getLiveUserId() {
		if ($currentUser?.uid) return $currentUser.uid;
		const existing = localStorage.getItem('standpointLiveUserId');
		if (existing) return existing;
		const next = `local_${crypto.randomUUID()}`;
		localStorage.setItem('standpointLiveUserId', next);
		return next;
	}

	async function loadPublicRooms() {
		try {
			const response = await fetch('/api/spectrum/rooms');
			if (!response.ok) throw new Error(await response.text());
			const data = await response.json();
			publicRooms = data.rooms ?? [];
		} catch {
			publicRooms = [];
		}
	}

	async function createRoom() {
		busy = true;
		error = '';
		try {
			const response = await fetch('/api/spectrum/rooms', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					playerName: playerName || 'Host',
					userId: getLiveUserId(),
					visibility
				})
			});
			if (!response.ok) throw new Error(await response.text());
			const data = await response.json();
			localStorage.setItem('standpointLiveName', playerName || 'Host');
			await goto(`/spectrum/${data.room.code}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to create room.';
		} finally {
			busy = false;
		}
	}

	async function joinRoom(code = cleanCode(roomCode)) {
		if (code.length !== 6) {
			error = 'Enter a 6-character room code.';
			return;
		}
		localStorage.setItem('standpointLiveName', playerName || 'Player');
		await goto(`/spectrum/${code}`);
	}

	onMount(() => {
		void loadPublicRooms();
	});
</script>

<svelte:head>
	<title>Spectrum - Standpoint</title>
</svelte:head>

<section class="min-h-[calc(100vh-5rem)] bg-[var(--bg)] text-[var(--text)]">
	<div class="grid w-full lg:grid-cols-[1.15fr_0.85fr]">
		<div
			class="flex min-h-[48vh] flex-col justify-center border-r border-b border-[var(--border)] bg-[var(--surface)] p-8 md:p-10 lg:min-h-[60vh]"
		>
			<h1 class="font-sans text-6xl font-black tracking-tight text-[var(--text)] md:text-8xl">
				Spectrum
			</h1>
			<p class="mt-6 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">
				One player sees a hidden point between two prompts, gives a clue, and the room places a
				shared guess on the spectrum.
			</p>
		</div>

		<div class="grid lg:min-h-[60vh] lg:grid-rows-3">
			<div class="relative border-b border-[var(--border)] bg-[var(--surface)]">
				<label
					class="absolute top-5 left-6 z-10 text-xs tracking-[0.22em] text-[var(--text-secondary)] uppercase"
					for="playerName">Display name</label
				>
				<input
					id="playerName"
					bind:value={playerName}
					maxlength="40"
					class="h-full min-h-36 w-full bg-[var(--surface)] px-6 pt-12 pb-6 text-3xl font-black text-[var(--text)] transition outline-none focus:bg-[var(--bg)] md:text-4xl"
					placeholder="Mia"
				/>
			</div>

			<div class="grid min-h-44 grid-rows-2 border-b border-[var(--border)] bg-[var(--surface)]">
				<div class="grid grid-cols-2 border-b border-[var(--border)]">
					<button
						type="button"
						class={`h-full border-r border-[var(--border)] px-3 py-4 text-sm font-semibold transition ${visibility === 'private' ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text)]'}`}
						onclick={() => (visibility = 'private')}
					>
						Private
					</button>
					<button
						type="button"
						class={`h-full px-3 py-4 text-sm font-semibold transition ${visibility === 'public' ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text)]'}`}
						onclick={() => (visibility = 'public')}
					>
						Public
					</button>
				</div>
				<button
					type="button"
					class="h-full w-full bg-[var(--surface)] px-5 py-5 text-xl font-black text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
					disabled={busy}
					onclick={createRoom}
				>
					Create Room
				</button>
			</div>

			<div
				class="grid min-h-36 grid-cols-[1fr_auto] border-b border-[var(--border)] bg-[var(--surface)]"
			>
				<div class="relative min-w-0">
					<label
						class="absolute top-5 left-6 z-10 text-xs tracking-[0.22em] text-[var(--text-secondary)] uppercase"
						for="roomCode">Join a room</label
					>
					<input
						id="roomCode"
						bind:value={roomCode}
						oninput={() => (roomCode = cleanCode(roomCode))}
						maxlength="6"
						class="h-full w-full bg-[var(--surface)] px-6 pt-12 pb-6 text-4xl font-black tracking-[0.16em] text-[var(--text)] uppercase transition outline-none focus:bg-[var(--bg)]"
						placeholder="ABC123"
					/>
				</div>
				<button
					type="button"
					class="h-full border-l border-[var(--border)] px-8 text-lg font-black text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
					onclick={() => joinRoom()}
				>
					Join
				</button>
			</div>

			{#if error}
				<p class="border-t border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>
			{/if}
		</div>
	</div>

	<div class="flex items-stretch border-b border-[var(--border)] bg-[var(--surface)]">
		<h2 class="flex-1 px-6 py-4 text-xl font-black text-[var(--text)]">Public rooms</h2>
		<button
			type="button"
			class="border-l border-[var(--border)] px-6 py-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--bg)] hover:text-[rgb(var(--primary))]"
			onclick={loadPublicRooms}
		>
			Refresh
		</button>
	</div>

	<div
		class="grid w-full grid-cols-1 gap-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
	>
		{#if publicRooms.length === 0}
			<div
				class="relative flex h-64 flex-col justify-end overflow-hidden border-r border-b border-[var(--border)] p-4"
				style="background-color: {roomTileColor(0)};"
			>
				<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/30"></div>
				<div class="relative z-10 text-white">
					<div class="text-2xl font-black">No public rooms</div>
					<div class="mt-2 text-sm opacity-80">Create a public room to appear here.</div>
				</div>
			</div>
		{:else}
			{#each publicRooms as room, index (room.id)}
				<button
					type="button"
					class="relative h-64 overflow-hidden border-r border-b border-[var(--border)] p-4 text-left transition hover:brightness-110"
					style="background-color: {roomTileColor(index)};"
					onclick={() => joinRoom(room.code)}
				>
					<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/30"></div>
					<div class="relative z-10 flex h-full flex-col justify-between text-white">
						<div class="flex justify-end text-sm font-semibold opacity-80">
							{room.playerCount} online
						</div>
						<div>
							<div class="text-4xl font-black tracking-[0.16em]">{room.code}</div>
							<div class="mt-2 text-sm uppercase opacity-80">Join public room</div>
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</section>
