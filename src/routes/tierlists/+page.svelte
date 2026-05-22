<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import {
		getTierlistsFromFirestore,
		getTierlistInteractions
	} from '$lib/firestore-polls-tierlists.js';
	import Hero from '../../components/hero.svelte';
	import LoadingIndicator from '../../components/loading-indicator.svelte';
	import { fade } from 'svelte/transition';
	import { fadeImage } from '$lib/fadeImage';
	import { goto } from '$app/navigation';
	import { normalizeTierlistDate } from '$lib/tierlist-display';
	const LOCAL_STORAGE_TIERLISTS_KEY = 'standpoint_local_tierlists';

	let tierLists: any[] = [];
	let loading = true;
	let error = '';
	let heroSlides: any[] = [];

	let interactionCounts: Record<string, { likes: number; comments: number; forks: number }> = {};

	function formatTierlistDate(value: unknown) {
		const date = normalizeTierlistDate(value);
		if (!date) return '';
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatTierlistDateISO(value: unknown) {
		return (
			normalizeTierlistDate(value)?.toISOString().split('T')[0] ||
			new Date().toISOString().split('T')[0]
		);
	}

	onMount(async () => {
		await loadTierLists();
	});

	async function loadInteractions(tierlistId: string) {
		try {
			const counts = await getTierlistInteractions(tierlistId);
			interactionCounts[tierlistId] = counts;
			return counts;
		} catch (error) {
			console.error('Error loading interactions:', error);
			return { likes: 0, comments: 0, forks: 0 };
		}
	}

	async function loadTierLists() {
		try {
			loading = true;
			error = '';
			const remote = await getTierlistsFromFirestore();
			// Load local tierlists
			let local: any[] = [];
			if (typeof window !== 'undefined') {
				const raw = localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY);
				if (raw) {
					try {
						local = JSON.parse(raw).map((t: any) => ({
							...t,
							id: t.id,
							ownerDisplayName: 'Local',
							_created_local: true,
							likes: 0,
							comments: 0,
							forks: 0,
							items: t.items || t.items?.length ? t.items : t.item_placements ? t.items : t.items,
							created_at: t.created_at || new Date().toISOString()
						}));
					} catch {}
				}
			}
			tierLists = [...local, ...remote];

			// Load interaction counts only for remote tierlists
			await Promise.all(
				remote.map(async (tierList) => {
					const counts = await loadInteractions(tierList.id);
					tierList.likes = counts.likes;
					tierList.comments = counts.comments;
					tierList.forks = counts.forks;
				})
			);

			if (tierLists.length > 0) {
				heroSlides = tierLists.slice(0, 5).map((tierList, index) => ({
					header: tierList.title,
					author: tierList.ownerDisplayName || tierList.owner_displayName || 'Community',
					date: formatTierlistDateISO(tierList.created_at),
					revision: 1,
					likes: tierList.likes || 0,
					comments: tierList.comments || 0,
					forks: tierList.forks || 0,
					backgroundColor: ['#FFD6E0', '#FFEFB5', '#C1E7E3', '#DCEBDD', '#E2D0F9'][index % 5],
					image: tierList.banner_image || tierList.thumbnail,
					tierlist: tierList
				}));
			}
		} catch (err) {
			error = 'Failed to load tier lists. Please try again.';
			console.error('Error loading tier lists:', err);
		} finally {
			loading = false;
		}
	}

	function navigateToTierList(tierList: any) {
		goto(`/tierlists/${tierList.id}${tierList._created_local ? '?local=true' : ''}`);
	}

	function deleteLocalTierlist(tierList: any, e: Event) {
		e.stopPropagation();
		if (!tierList._created_local) return;
		if (!confirm('Delete this local tierlist?')) return;
		const raw = localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY);
		if (raw) {
			try {
				let arr = JSON.parse(raw);
				arr = arr.filter((t: any) => String(t.id) !== String(tierList.id));
				localStorage.setItem(LOCAL_STORAGE_TIERLISTS_KEY, JSON.stringify(arr));
				// Remove from in-memory list and refresh hero slides
				tierLists = tierLists.filter((t) => t !== tierList);
				if (heroSlides.some((s) => s.tierlist.id === tierList.id)) {
					heroSlides = heroSlides.filter((s) => s.tierlist.id !== tierList.id);
				}
			} catch {}
		}
	}
</script>

<svelte:head>
	<title>Tier Lists - Standpoint</title>
</svelte:head>

<div
	class="theme-transition min-h-screen w-full overflow-x-hidden"
	style="background-color: var(--bg);"
>
	<!-- Hero Carousel -->
	{#if heroSlides.length > 0}
		<Hero slides={heroSlides} />
	{/if}

	<div>
		{#if error}
			<div class="container mx-auto mb-4 px-6">
				<div class="border border-red-400 bg-red-100 px-4 py-3 text-red-700">
					{error}
				</div>
			</div>
		{/if}

		{#if loading}
			<div class="py-8 text-center">
				<LoadingIndicator size="lg" />
			</div>
		{:else if tierLists.length === 0}
			<div class="py-16 text-center">
				<div class="mb-4 text-6xl">📋</div>
				<h3 class="mb-2 text-xl font-bold text-gray-600">No tier lists yet</h3>
				<p class="mb-6 text-gray-500">Be the first to create a tier list!</p>
			</div>
		{:else}
			<!-- Tierlist Grid -->
			<div
				class="grid w-full grid-cols-1 gap-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
			>
				{#each tierLists as tierList}
					<div
						class="relative h-64 cursor-pointer overflow-hidden border-r border-b border-gray-800 transition-all duration-200 hover:brightness-110"
						on:click={() => navigateToTierList(tierList)}
						on:keydown={(e) => e.key === 'Enter' && navigateToTierList(tierList)}
						role="button"
						tabindex="0"
						in:fade={{ duration: 350 }}
					>
						<!-- Background Image -->
						{#if tierList.banner_image}
							<img
								use:fadeImage
								src={tierList.banner_image}
								alt={tierList.title}
								class="sp-fade-image absolute inset-0 h-full w-full object-cover opacity-40"
							/>
						{:else if tierList.thumbnail}
							<img
								use:fadeImage
								src={tierList.thumbnail}
								alt={tierList.title}
								class="sp-fade-image absolute inset-0 h-full w-full object-cover opacity-40"
							/>
						{:else}
							<div
								class="absolute inset-0"
								style="background-color:{[
									'#FFD6E0',
									'#FFEFB5',
									'#C1E7E3',
									'#DCEBDD',
									'#E2D0F9',
									'#FFB5B5',
									'#B5E5FF'
								][Math.floor(Math.random() * 7)]};"
							></div>
						{/if}

						<!-- Dark overlay -->
						<div class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40"></div>

						<!-- Content -->
						<div class="relative z-10 flex h-full flex-col justify-between p-4 text-white">
							<!-- Top metadata -->
							<div class="flex items-start justify-between text-xs">
								<div class="flex gap-2 opacity-80">
									{#if formatTierlistDate(tierList.created_at)}<span>
											{formatTierlistDate(tierList.created_at)}</span
										>{/if}
								</div>
								<div class="flex items-center gap-2 opacity-80">
									{#if tierList._created_local}
										<span
											class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wide"
											style="background-color: rgba(var(--primary-rgb), 0.7);">LOCAL</span
										>
									{:else}
										<span class="flex items-center gap-1">
											<span class="material-symbols-outlined align-middle text-base">favorite</span>
											{tierList.likes || 0}
										</span>
										<span class="flex items-center gap-1">
											<span class="material-symbols-outlined align-middle text-base"
												>chat_bubble</span
											>
											{tierList.comments || 0}
										</span>
										<span class="flex items-center gap-1">
											<span class="material-symbols-outlined align-middle text-base"
												>call_split</span
											>
											{tierList.forks || 0}
										</span>
									{/if}
								</div>
							</div>

							<!-- Title -->
							<div class="flex flex-1 items-center">
								<div class="w-full">
									<span class="mt-1 text-xs text-gray-300">
										{tierList.ownerDisplayName || tierList.owner_displayName || 'Anonymous User'}
									</span>
									<h3 class="text-xl leading-tight font-bold">{tierList.title}</h3>
								</div>
							</div>

							<!-- Bottom stats -->
							<div class="flex items-center justify-between text-xs opacity-80">
								<span>{tierList.tiers?.length || 4} tiers</span>
								<span>{tierList.items?.length ?? tierList.item_count ?? 0} items</span>
								{#if tierList._created_local}
									<button
										class="ml-2 bg-red-600/70 px-2 py-0.5 text-[10px] font-semibold hover:bg-red-600"
										on:click={(e) => deleteLocalTierlist(tierList, e)}>Delete</button
									>
								{/if}
								<span
									class="px-2 py-1 text-white"
									style="background-color: {tierList.list_type === 'dynamic'
										? 'rgba(var(--primary),0.6)'
										: '#ffffff55'};"
								>
									{tierList.list_type === 'dynamic' ? 'DYNAMIC' : 'CLASSIC'}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Create Button -->
	<a
		href="/tierlists/create"
		class="bg-accent hover:text-accent fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center text-white shadow-lg transition-colors duration-300 hover:bg-white"
		aria-label="Create new tier list"
	>
		<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
			></path>
		</svg>
	</a>
</div>
