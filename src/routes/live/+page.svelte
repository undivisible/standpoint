<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores';

	let playerName = '';
	let roomCode = '';
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

	async function createRoom() {
		busy = true;
		error = '';
		try {
			const response = await fetch('/api/live/rooms', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					playerName: playerName || 'Host',
					userId: getLiveUserId()
				})
			});
			if (!response.ok) throw new Error(await response.text());
			const data = await response.json();
			localStorage.setItem('standpointLiveName', playerName || 'Host');
			await goto(`/live/${data.room.code}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to create room.';
		} finally {
			busy = false;
		}
	}

	async function joinRoom() {
		const code = cleanCode(roomCode);
		if (code.length !== 6) {
			error = 'Enter a 6-character room code.';
			return;
		}
		localStorage.setItem('standpointLiveName', playerName || 'Player');
		await goto(`/live/${code}`);
	}
</script>

<svelte:head>
	<title>Standpoint Live</title>
</svelte:head>

<section class="min-h-[calc(100vh-5rem)] bg-[var(--bg)] px-4 py-12 text-[var(--text)]">
	<div class="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
		<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-8 md:p-10">
			<p class="text-sm tracking-[0.28em] text-[rgb(var(--primary))] uppercase">
				multiplayer spectrum polls
			</p>
			<h1 class="mt-5 font-sans text-6xl font-black tracking-tight text-white md:text-8xl">
				Standpoint Live
			</h1>
			<p class="mt-6 max-w-2xl text-xl leading-relaxed text-[var(--text-secondary)]">
				A Wavelength-style room for arguing about taste. One player sees the secret target, gives a
				clue, and the room places a shared guess between two opposing takes.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<a
					href="/polls"
					class="rounded-md border border-neutral-700 px-5 py-3 font-semibold text-white transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
				>
					Browse polls
				</a>
				<a
					href="/tierlists"
					class="rounded-md border border-neutral-700 px-5 py-3 font-semibold text-white transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
				>
					Browse tierlists
				</a>
			</div>
		</div>

		<div class="space-y-4">
			<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-6">
				<label
					class="text-xs tracking-[0.22em] text-[var(--text-secondary)] uppercase"
					for="playerName">Display name</label
				>
				<input
					id="playerName"
					bind:value={playerName}
					maxlength="40"
					class="mt-2 w-full rounded-md border border-neutral-800 bg-black/30 px-4 py-3 text-white transition outline-none focus:border-[rgb(var(--primary))]"
					placeholder="Mia"
				/>
			</div>

			<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-6">
				<h2 class="text-2xl font-bold text-white">Create a room</h2>
				<p class="mt-2 text-[var(--text-secondary)]">
					Host a fresh spectrum game and invite friends with a six-character code.
				</p>
				<button
					type="button"
					class="mt-5 w-full rounded-md bg-[rgb(var(--primary))] px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
					disabled={busy}
					onclick={createRoom}
				>
					Create Room
				</button>
			</div>

			<div class="rounded-md border border-neutral-800 bg-neutral-900/80 p-6">
				<h2 class="text-2xl font-bold text-white">Join a room</h2>
				<div class="mt-4 flex gap-3">
					<input
						bind:value={roomCode}
						oninput={() => (roomCode = cleanCode(roomCode))}
						maxlength="6"
						class="min-w-0 flex-1 rounded-md border border-neutral-800 bg-black/30 px-4 py-3 text-xl font-black tracking-[0.16em] text-white uppercase transition outline-none focus:border-[rgb(var(--primary))]"
						placeholder="ABC123"
					/>
					<button
						type="button"
						class="rounded-md border border-neutral-700 px-5 py-3 font-semibold text-white transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
						onclick={joinRoom}
					>
						Join
					</button>
				</div>
			</div>

			{#if error}
				<p class="rounded-md border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
					{error}
				</p>
			{/if}
		</div>
	</div>
</section>
