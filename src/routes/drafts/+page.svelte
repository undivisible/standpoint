<script lang="ts">
	import { currentUser } from '$lib/stores';
	import {
		getUserDrafts,
		publishTierlist,
		updateTierlist,
		type TierlistData
	} from '../../lib/firestore-polls-tierlists.js';
	import { addToast } from '$lib/toast';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '../../components/toast.svelte';

	export let data: { drafts: TierlistData[] };

	let drafts = data.drafts || [];
	let loading = false;
	let publishingId: string | null = null;

	async function refreshDrafts() {
		if (!$currentUser) return;

		try {
			loading = true;
			drafts = await getUserDrafts($currentUser.uid);
		} catch (error) {
			console.error('Error loading drafts:', error);
			addToast('Failed to load drafts', 'error');
		} finally {
			loading = false;
		}
	}

	async function publishDraft(draft: TierlistData) {
		if (!draft.id) return;

		try {
			publishingId = draft.id;
			await publishTierlist(draft.id);
			addToast('Tierlist published successfully!', 'success');
			await refreshDrafts();
		} catch (error) {
			console.error('Error publishing draft:', error);
			addToast('Failed to publish tierlist', 'error');
		} finally {
			publishingId = null;
		}
	}

	async function duplicateDraft(draft: TierlistData) {
		if (!$currentUser) return;

		try {
			const duplicatedDraft: Partial<TierlistData> = {
				...draft,
				title: `${draft.title} (Copy)`,
				owner: $currentUser.uid
			};
			// Remove id to create new document
			const { id, ...draftWithoutId } = duplicatedDraft;

			// Save as new draft using updateTierlist (which will create if no id)
			await updateTierlist('', draftWithoutId);
			addToast('Draft duplicated successfully!', 'success');
			await refreshDrafts();
		} catch (error) {
			console.error('Error duplicating draft:', error);
			addToast('Failed to duplicate draft', 'error');
		}
	}

	function editDraft(draft: TierlistData) {
		goto(`/tierlists/create?draft=${draft.id}`);
	}

	function formatDate(timestamp: any) {
		if (!timestamp) return 'Unknown';
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(() => {
		if (!$currentUser) {
			goto('/login?redirectTo=/drafts');
		}
	});
</script>

<svelte:head>
	<title>My Drafts - Standpoint</title>
</svelte:head>

<div
	class="min-h-screen animate-[fadeIn_0.4s_ease] bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white"
>
	<div class="container mx-auto px-6 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="mb-2 text-4xl font-bold">My Drafts</h1>
				<p class="text-gray-400">
					{drafts.length} draft{drafts.length !== 1 ? 's' : ''} waiting to be published
				</p>
			</div>
			<div class="flex gap-3">
				<button
					on:click={refreshDrafts}
					disabled={loading}
					class="flex items-center gap-2 bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
				>
					<span class="material-symbols-outlined text-sm {loading ? 'animate-spin' : ''}">
						refresh
					</span>
					Refresh
				</button>
				<a
					href="/tierlists/create"
					class="flex items-center gap-2 bg-[rgb(var(--primary))] px-4 py-2 text-white transition-colors hover:brightness-110"
				>
					<span class="material-symbols-outlined text-sm">add</span>
					New Tierlist
				</a>
			</div>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="border-accent h-8 w-8 animate-spin border-2 border-t-transparent"></div>
			</div>
		{/if}

		<!-- Empty State -->
		{#if !loading && drafts.length === 0}
			<div class="py-16 text-center">
				<div class="mb-6">
					<span class="material-symbols-outlined text-6xl text-gray-600">draft</span>
				</div>
				<h2 class="mb-4 text-2xl font-bold text-gray-300">No drafts yet</h2>
				<p class="mx-auto mb-8 max-w-md text-gray-400">
					Create your first tierlist and save it as a draft to perfect it before publishing.
				</p>
				<a
					href="/tierlists/create"
					class="inline-flex items-center gap-2 bg-[rgb(var(--primary))] px-6 py-3 text-white shadow-[0_0_0_0_rgba(var(--primary),0.4)] transition-colors hover:shadow-[0_0_0_4px_rgba(var(--primary),0.25)] hover:brightness-110"
				>
					<span class="material-symbols-outlined">add</span>
					Create Tierlist
				</a>
			</div>
		{/if}

		<!-- Drafts Grid -->
		{#if !loading && drafts.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each drafts as draft (draft.id)}
					<div
						class="group hover:border-accent/50 overflow-hidden border border-gray-700 bg-gray-800/50 backdrop-blur-sm transition-all duration-300"
					>
						<!-- Thumbnail -->
						<div class="relative h-48 overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800">
							{#if draft.thumbnail}
								<img
									src={draft.thumbnail}
									alt={draft.title}
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							{:else}
								<div class="flex h-full items-center justify-center">
									<span class="material-symbols-outlined text-4xl text-gray-500">view_list</span>
								</div>
							{/if}

							<!-- Draft Badge -->
							<div class="absolute top-3 left-3">
								<span class="bg-yellow-500 px-2 py-1 text-xs font-bold text-black"> DRAFT </span>
							</div>

							<!-- Actions Overlay -->
							<div
								class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/60 group-hover:opacity-100"
							>
								<div class="flex gap-2">
									<button
										on:click={() => editDraft(draft)}
										class="bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600"
										title="Edit Draft"
									>
										<span class="material-symbols-outlined text-sm">edit</span>
									</button>
									<button
										on:click={() => publishDraft(draft)}
										disabled={publishingId === draft.id}
										class="bg-green-500 p-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
										title="Publish Draft"
									>
										{#if publishingId === draft.id}
											<div
												class="h-4 w-4 animate-spin border-2 border-white border-t-transparent"
											></div>
										{:else}
											<span class="material-symbols-outlined text-sm">publish</span>
										{/if}
									</button>
									<button
										on:click={() => duplicateDraft(draft)}
										class="bg-purple-500 p-2 text-white transition-colors hover:bg-purple-600"
										title="Duplicate Draft"
									>
										<span class="material-symbols-outlined text-sm">content_copy</span>
									</button>
								</div>
							</div>
						</div>

						<!-- Content -->
						<div class="p-6">
							<h3 class="mb-2 line-clamp-2 text-lg font-bold">{draft.title}</h3>
							{#if draft.description}
								<p class="mb-3 line-clamp-2 text-sm text-gray-400">{draft.description}</p>
							{/if}

							<!-- Metadata -->
							<div class="flex items-center justify-between text-xs text-gray-500">
								<div class="flex items-center gap-1">
									<span class="material-symbols-outlined text-xs">schedule</span>
									{formatDate(draft.updated_at || draft.created_at)}
								</div>
								<div class="flex items-center gap-3">
									{#if draft.items}
										<span title="Items">{draft.items.length} items</span>
									{/if}
									{#if draft.tiers}
										<span title="Tiers">{draft.tiers.length} tiers</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Actions Footer -->
						<div class="border-t border-gray-700 bg-gray-800/30 p-4">
							<div class="flex gap-2">
								<button
									on:click={() => editDraft(draft)}
									class="flex flex-1 items-center justify-center gap-1 bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
								>
									<span class="material-symbols-outlined text-sm">edit</span>
									Edit
								</button>
								<button
									on:click={() => publishDraft(draft)}
									disabled={publishingId === draft.id}
									class="flex flex-1 items-center justify-center gap-1 bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50"
								>
									{#if publishingId === draft.id}
										<div
											class="h-3 w-3 animate-spin border-2 border-white border-t-transparent"
										></div>
									{:else}
										<span class="material-symbols-outlined text-sm">publish</span>
									{/if}
									Publish
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<Toast />

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
