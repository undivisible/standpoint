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

	$: defaultName = $currentUser?.displayName || $currentUser?.email?.split('@')[0] || '';
	$: if (!playerName && defaultName) playerName = defaultName;

	function cleanCode(value: string) {
		return value
			.replace(/[^a-z0-9]/gi, '')
			.toUpperCase()
			.slice(0, 6);
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
	<div class="grid min-h-[calc(100vh-5rem)] w-full lg:grid-cols-[1.15fr_0.85fr]">
		<div
			class="flex min-h-[48vh] flex-col justify-between border-r border-b border-[var(--border)] bg-[var(--surface)] p-8 md:p-10 lg:min-h-[calc(100vh-5rem)]"
		>
			<p class="text-sm tracking-[0.28em] text-[rgb(var(--primary))] uppercase">
				multiplayer spectrum polls
			</p>
			<div class="py-12">
				<h1 class="font-sans text-6xl font-black tracking-tight text-[var(--text)] md:text-8xl">
					Spectrum
				</h1>
				<p class="mt-6 max-w-3xl text-xl leading-relaxed text-[var(--text-secondary)]">
					One player sees a hidden point between two prompts, gives a clue, and the room places a
					shared guess on the spectrum.
				</p>
			</div>
			<div class="grid border border-[var(--border)] sm:grid-cols-2">
				<a
					href="/polls"
					class="border-b border-[var(--border)] px-5 py-4 font-semibold text-[var(--text)] transition hover:bg-[var(--bg)] hover:text-[rgb(var(--primary))] sm:border-r sm:border-b-0"
				>
					Browse polls
				</a>
				<a
					href="/tierlists"
					class="px-5 py-4 font-semibold text-[var(--text)] transition hover:bg-[var(--bg)] hover:text-[rgb(var(--primary))]"
				>
					Browse tierlists
				</a>
			</div>
		</div>

		<div class="grid lg:min-h-[calc(100vh-5rem)]">
			<div class="border-b border-[var(--border)] bg-[var(--surface)] p-6">
				<label
					class="text-xs tracking-[0.22em] text-[var(--text-secondary)] uppercase"
					for="playerName">Display name</label
				>
				<input
					id="playerName"
					bind:value={playerName}
					maxlength="40"
					class="mt-2 w-full border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))]"
					placeholder="Mia"
				/>
			</div>

			<div class="border-b border-[var(--border)] bg-[var(--surface)] p-6">
				<h2 class="text-2xl font-bold text-[var(--text)]">Create a room</h2>
				<div class="mt-4 grid grid-cols-2 border border-[var(--border)] bg-[var(--bg)]">
					<button
						type="button"
						class={`border-r border-[var(--border)] px-3 py-3 text-sm font-semibold transition ${visibility === 'private' ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
						onclick={() => (visibility = 'private')}
					>
						Private
					</button>
					<button
						type="button"
						class={`px-3 py-3 text-sm font-semibold transition ${visibility === 'public' ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
						onclick={() => (visibility = 'public')}
					>
						Public
					</button>
				</div>
				<button
					type="button"
					class="mt-5 w-full bg-[rgb(var(--primary))] px-5 py-4 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
					disabled={busy}
					onclick={createRoom}
				>
					Create Room
				</button>
			</div>

			<div class="border-b border-[var(--border)] bg-[var(--surface)] p-6">
				<h2 class="text-2xl font-bold text-[var(--text)]">Join a room</h2>
				<div class="mt-4 grid grid-cols-[1fr_auto]">
					<input
						bind:value={roomCode}
						oninput={() => (roomCode = cleanCode(roomCode))}
						maxlength="6"
						class="min-w-0 border border-r-0 border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-xl font-black tracking-[0.16em] text-[var(--text)] uppercase transition outline-none focus:border-[rgb(var(--primary))]"
						placeholder="ABC123"
					/>
					<button
						type="button"
						class="border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
						onclick={() => joinRoom()}
					>
						Join
					</button>
				</div>
			</div>

			<div class="bg-[var(--surface)] p-6">
				<div class="flex items-center justify-between gap-3">
					<h2 class="text-2xl font-bold text-[var(--text)]">Public rooms</h2>
					<button
						type="button"
						class="border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
						onclick={loadPublicRooms}
					>
						Refresh
					</button>
				</div>
				<div class="mt-4">
					{#if publicRooms.length === 0}
						<p class="text-sm text-[var(--text-secondary)]">No public lobby rooms are open.</p>
					{:else}
						{#each publicRooms as room (room.id)}
							<button
								type="button"
								class="-mt-px flex w-full items-center justify-between gap-4 border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-left transition first:mt-0 hover:border-[rgb(var(--primary))]"
								onclick={() => joinRoom(room.code)}
							>
								<span class="font-black tracking-[0.16em] text-[var(--text)]">{room.code}</span>
								<span class="text-sm text-[var(--text-secondary)]">{room.playerCount} online</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			{#if error}
				<p class="border-t border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>
			{/if}
		</div>
	</div>
</section>
