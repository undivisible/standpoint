<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentUser, signInWithGoogle, signOutUser } from '../lib/stores';
	import NotificationBell from './notification-bell.svelte';
	import { getUserProfile } from '../lib/user-profile';

	let searchQuery = '';
	let avatarUrl: string | null = null;
	let inputEl: HTMLInputElement | null = null;

	let isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
	let mobileOpen = false;

	function updateIsMobile() {
		if (typeof window !== 'undefined') isMobile = window.innerWidth < 768;
		if (!isMobile) mobileOpen = false;
	}

	// Load user avatar when user changes
	$: if ($currentUser) {
		loadUserAvatar();
	} else {
		avatarUrl = null;
	}

	async function loadUserAvatar() {
		if (!$currentUser) return;

		// Try photoURL from Firebase Auth first
		if ($currentUser.photoURL) {
			avatarUrl = $currentUser.photoURL;
			return;
		}

		// Fall back to user profile
		try {
			const profile = await getUserProfile($currentUser.uid);
			if (profile?.photoURL) {
				avatarUrl = profile.photoURL;
			}
		} catch (error) {
			console.error('Error loading avatar:', error);
		}
	}

	onMount(() => {
		updateIsMobile();
		const onResize = () => updateIsMobile();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	async function handleGoogleLogin() {
		await signInWithGoogle();
	}
	async function handleSignOut() {
		await signOutUser();
		goto('/');
	}
</script>

<div class="justify center flex h-20 items-start gap-4">
	<nav class="relative z-50 mt-5 p-4 md:flex md:items-center md:gap-2" aria-label="Primary">
		<button
			type="button"
			class="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] md:hidden"
			onclick={() => (mobileOpen = !mobileOpen)}
			aria-expanded={mobileOpen}
			aria-label="Open page switcher"
		>
			<span class="material-symbols-outlined text-lg">apps</span>
			Pages
		</button>
		<div
			class={`absolute top-full left-4 mt-2 min-w-44 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl md:static md:mt-0 md:flex md:min-w-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none ${mobileOpen ? 'block' : 'hidden md:flex'}`}
		>
			<a
				href="/polls"
				class={`block rounded-md px-4 py-2 font-semibold transition md:px-5 ${$page.url.pathname.startsWith('/polls') ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`}
				onclick={() => (mobileOpen = false)}
			>
				Polls
			</a>
			<a
				href="/tierlists"
				class={`block rounded-md px-4 py-2 font-semibold transition md:px-5 ${$page.url.pathname.startsWith('/tierlists') && !$page.url.pathname.startsWith('/tierlists/drafts') ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`}
				onclick={() => (mobileOpen = false)}
			>
				Tierlists
			</a>
			<a
				href="/spectrum"
				class={`block rounded-md px-4 py-2 font-semibold transition md:px-5 ${$page.url.pathname.startsWith('/live') || $page.url.pathname.startsWith('/spectrum') ? 'bg-[rgb(var(--primary))] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`}
				onclick={() => (mobileOpen = false)}
			>
				Spectrum
			</a>
		</div>
	</nav>

	<div
		class="search-shell mt-5 flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] transition-all duration-500 ease-out focus-within:border-[rgb(var(--primary))]"
	>
		<button
			type="button"
			class="material-symbols-outlined hover:text-accent text-xl text-[var(--text-secondary)] transition-colors select-none focus:outline-none"
			onclick={() => inputEl?.focus()}
			aria-label="Focus search input">search</button
		>
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			placeholder="SEARCH"
			class="flex-1 bg-transparent text-[var(--text)] placeholder:bg-transparent placeholder:text-[var(--text-secondary)] focus:outline-none"
		/>
	</div>

	<div class="ml-auto flex h-full items-center justify-end gap-4">
		{#if $currentUser}
			<NotificationBell />
			<div class="group relative flex h-full items-center" role="group">
				<a
					href={'/user/' + $currentUser.uid}
					class="relative h-full w-[80px] cursor-pointer overflow-hidden bg-gray-300 transition-all duration-300 hover:scale-110 hover:brightness-110"
					style="box-shadow: 0 0 0 0px rgba(var(--primary), 0); transition: transform 0.3s ease, box-shadow 0.3s ease, filter 0.3s ease;"
					onmouseenter={(e) => {
						e.currentTarget.style.boxShadow =
							'0 10px 30px rgba(var(--primary), 0.4), 0 0 0 3px rgba(var(--primary), 0.6)';
					}}
					onmouseleave={(e) => {
						e.currentTarget.style.boxShadow = '0 0 0 0px rgba(var(--primary), 0)';
					}}
					title={$currentUser.displayName || $currentUser.email}
				>
					{#if avatarUrl}
						<img src={avatarUrl} alt="Profile" class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center">
							<span class="material-symbols-outlined text-4xl text-gray-500">person</span>
						</div>
					{/if}
				</a>
				<!-- Settings button on hover -->
				<div
					class="absolute top-full right-0 z-50 hidden min-w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl group-focus-within:block group-hover:block"
				>
					<a
						href="/tierlists/drafts"
						class="block rounded-md px-4 py-2 font-semibold text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
					>
						Drafts
					</a>
					<a
						href="/settings"
						class="block rounded-md px-4 py-2 font-semibold text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
					>
						Settings
					</a>
					<button
						type="button"
						class="w-full rounded-md px-4 py-2 text-left font-semibold text-[var(--text)] transition hover:bg-[rgb(var(--primary))] hover:text-white"
						onclick={handleSignOut}
					>
						Sign out
					</button>
				</div>
			</div>
		{:else}
			<a
				href="/tierlists/drafts"
				class="flex h-10 items-center border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-medium text-[var(--text)] transition-colors hover:border-[rgb(var(--primary))]"
				>Drafts</a
			>
			<button
				class="flex h-full items-center gap-2 border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
				onclick={handleGoogleLogin}
				aria-label="Sign in with Google">Sign in with Google</button
			>
		{/if}
	</div>
</div>
