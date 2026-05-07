<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getContext, onMount } from 'svelte';
	import { currentUser, signOutUser } from '../lib/stores';
	import NotificationBell from './notification-bell.svelte';
	import { getUserProfile } from '../lib/user-profile';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let searchQuery = '';
	let searchActive = false;
	let avatarUrl: string | null = null;
	let inputEl: HTMLInputElement | null = null;

	let isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
	let mobileOpen = false;
	let activeIndex: number = -1;
	let navGroupEl: HTMLElement | null = null;
	let linkEls: Array<{ el: HTMLElement; href: string } | null> = [null, null, null];
	let pollsEl: HTMLElement | null = null;
	let tierlistsEl: HTMLElement | null = null;
	let spectrumEl: HTMLElement | null = null;
	$: googleSignInHref = `/api/auth/google/start?redirectTo=${encodeURIComponent(
		$page.url.pathname + $page.url.search
	)}`;

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

	function updateLinks() {
		linkEls = [
			pollsEl ? { el: pollsEl, href: '/polls' } : null,
			tierlistsEl ? { el: tierlistsEl, href: '/tierlists' } : null,
			spectrumEl ? { el: spectrumEl, href: '/spectrum' } : null
		];
	}

	function openMobileNav(e: MouseEvent) {
		if (!isMobile) return;
		e.preventDefault();
		if (mobileOpen) {
			const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
			mobileOpen = false;
			activeIndex = -1;
			if (href) goto(href);
		} else {
			mobileOpen = true;
			updateLinks();
		}
	}

	function startMobileNav(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (!isMobile) return;
		mobileOpen = true;
		updateLinks();
		updateActiveFromTouch(e);
		if (activeIndex === -1) activeIndex = 0;
	}

	function updateActiveFromTouch(e: TouchEvent) {
		if (!mobileOpen) return;
		const touch = e.touches[0];
		if (!touch || !navGroupEl) return;
		const rect = navGroupEl.getBoundingClientRect();
		const y = touch.clientY - rect.top;
		let bestIdx = -1;
		let bestDist = Infinity;
		for (let i = 0; i < linkEls.length; i++) {
			const l = linkEls[i]?.el;
			if (!l) continue;
			const lr = l.getBoundingClientRect();
			const center = (lr.top + lr.bottom) / 2 - rect.top;
			const d = Math.abs(center - y);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
		activeIndex = bestIdx;
	}

	function moveMobileNav(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (!mobileOpen) return;
		updateActiveFromTouch(e);
	}

	function endMobileNav() {
		if (!mobileOpen) return;
		const target = linkEls[activeIndex]?.href;
		mobileOpen = false;
		activeIndex = -1;
		if (target) goto(target);
	}

	function handleMouseEnter() {
		navHoverStore?.set(true);
	}
	function handleMouseLeave() {
		navHoverStore?.set(false);
	}

	async function handleSignOut() {
		await signOutUser();
		goto('/');
	}

	async function handleSearchSubmit() {
		const query = searchQuery.trim();
		if (!query) {
			inputEl?.focus();
			return;
		}
		await goto(`/search?q=${encodeURIComponent(query)}`);
	}
</script>

<div class="justify center flex h-20 items-start gap-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 p-4 transition-all duration-500 ease-out"
		style="margin-top: calc((5rem - 2rem) / 3 / 3);"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		role="region"
		bind:this={navGroupEl}
	>
		<a
			href="/polls"
			bind:this={pollsEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-20' : 'h-2 w-4'} group-hover:h-12 group-hover:w-20 ${$page.url.pathname.startsWith('/polls') ? 'bg-[rgb(var(--primary))] text-white' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
			onclick={openMobileNav}
			ontouchstart={startMobileNav}
			ontouchmove={moveMobileNav}
			ontouchend={endMobileNav}
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>POLLS</span
				>
			</div>
		</a>

		<a
			href="/tierlists"
			bind:this={tierlistsEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-32' : 'h-2 w-6'} group-hover:h-12 group-hover:w-32 ${$page.url.pathname.startsWith('/tierlists') && !$page.url.pathname.startsWith('/tierlists/drafts') ? 'bg-[rgb(var(--primary))] text-white' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
			onclick={openMobileNav}
			ontouchstart={startMobileNav}
			ontouchmove={moveMobileNav}
			ontouchend={endMobileNav}
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>TIERLISTS</span
				>
			</div>
		</a>

		<a
			href="/spectrum"
			bind:this={spectrumEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-44' : 'h-2 w-8'} group-hover:h-12 group-hover:w-44 ${$page.url.pathname.startsWith('/live') || $page.url.pathname.startsWith('/spectrum') ? 'bg-[rgb(var(--primary))] text-white opacity-100' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
			onclick={openMobileNav}
			ontouchstart={startMobileNav}
			ontouchmove={moveMobileNav}
			ontouchend={endMobileNav}
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>SPECTRUM</span
				>
			</div>
		</a>
	</div>

	<form
		class="search-shell mt-5 flex h-10 items-center gap-2 bg-transparent transition-all duration-500 ease-out"
		class:overlay-active={searchActive}
		onsubmit={(event) => {
			event.preventDefault();
			void handleSearchSubmit();
		}}
	>
		<button
			type="submit"
			class="material-symbols-outlined hover:text-accent text-xl text-[var(--text-secondary)] transition-colors select-none focus:outline-none"
			aria-label="Search">search</button
		>
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			placeholder="SEARCH"
			class="flex-1 bg-transparent text-[var(--text)] placeholder:bg-transparent placeholder:text-[var(--text-secondary)] focus:outline-none"
		/>
	</form>

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
					class="absolute top-0 right-full z-50 flex h-full origin-right scale-x-95 items-stretch justify-end opacity-0 transition-all duration-300 group-focus-within:scale-x-100 group-focus-within:opacity-100 group-hover:scale-x-100 group-hover:opacity-100"
				>
					<a
						href="/tierlists/drafts"
						class="flex h-full items-center gap-2 border border-gray-300 bg-gray-100 px-4 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-200"
					>
						<span class="material-symbols-outlined text-lg">draft</span>
						Drafts
					</a>
					<a
						href="/settings"
						class="flex h-full items-center gap-2 border border-gray-300 bg-white px-4 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
					>
						<span class="material-symbols-outlined text-lg">settings</span>
						Settings
					</a>
					<button
						type="button"
						class="flex h-full items-center gap-2 border border-gray-300 bg-[rgb(var(--primary))] px-4 font-medium text-white shadow-sm transition-colors hover:brightness-110"
						onclick={handleSignOut}
					>
						<span class="material-symbols-outlined text-lg">logout</span>
						Sign out
					</button>
				</div>
			</div>
		{:else}
			<div class="flex h-full items-center justify-end gap-0">
				<a
					href="/tierlists/drafts"
					class="flex h-full items-center gap-2 border border-gray-300 bg-gray-100 px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-200"
					>Drafts</a
				>
				<a
					href={googleSignInHref}
					class="flex h-full items-center gap-2 border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
					aria-label="Sign in with Google">Sign in with Google</a
				>
			</div>
		{/if}
	</div>
</div>
