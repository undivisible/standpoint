<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type { TierListResponse, TierCreate, TierItem } from '$lib/types';
	import { currentUser, userGroup } from '$lib/stores';
	import { getUserProfile } from '$lib/user-profile';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/toast';
	import LoginModal from './login-modal.svelte';
	import { signInWithGoogle } from '$lib/stores';
	import confetti from 'canvas-confetti';
	import {
		likeTierlist,
		unlikeTierlist,
		hasUserLikedTierlist,
		getTierlist,
		deleteTierlistFromFirestore
	} from '$lib/firestore-polls-tierlists.js';
	import Modal from './modal.svelte';

	export let title: string = '';
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let tierListData: TierListResponse | null = null;

	let isLocal = false;
	let showLoginModal = false;
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		isLocal = params.get('local') === 'true';
	}

	let isForked = false;
	let originalId = '';
	let originalTitle = '';
	let originalAuthor = '';

	const dispatch = createEventDispatcher();

	// Interaction states
	let liked = false;
	let likeHover = false;
	let likes = 0;
	let comments = 0;
	let forks = 0;
	let commentText = '';
	let commentsList: Array<{
		id: string;
		text: string;
		author: string;
		timestamp: number;
		authorUid?: string;
	}> = [];
	let interacting = false;
	let unsubscribeComments: (() => void) | null = null;
	let unsubscribeLikes: (() => void) | null = null;
	let unsubscribeForks: (() => void) | null = null;

	$: resolvedAuthorName =
		tierListData &&
		typeof tierListData.owner_displayName === 'string' &&
		tierListData.owner_displayName.trim()
			? tierListData.owner_displayName
			: tierListData?.author || 'Anonymous';

	function normalizeDate(input: any): Date | null {
		if (!input) return null;
		if (typeof input === 'string' || typeof input === 'number') {
			const d = new Date(input);
			return isNaN(d.getTime()) ? null : d;
		}
		if (typeof input.toDate === 'function') {
			const d = input.toDate();
			return isNaN(d.getTime()) ? null : d;
		}
		return null;
	}
	function formatDateSafe(input: any): string {
		const d = normalizeDate(input);
		if (!d) return '—';
		return (
			d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
			' • ' +
			d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
		);
	}

	function handleShare() {
		if (navigator.share && shareUrl) {
			navigator.share({
				title: title,
				url: shareUrl
			});
		} else if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			addToast('Link copied to clipboard!', 'success');
		}
	}

	function handleDelete() {
		showDeleteModal = true;
	}

	async function handleDeleteWithFallback() {
		try {
			if (isLocal) {
				// Remove from local storage instead
				const raw = localStorage.getItem('standpoint_local_tierlists');
				if (raw) {
					const arr = JSON.parse(raw).filter((t: any) => String(t.id) !== String(id));
					localStorage.setItem('standpoint_local_tierlists', JSON.stringify(arr));
				}
			} else {
				await deleteTierlistFromFirestore(id.toString());
			}
			addToast('Tierlist deleted!', 'success');
			goto('/tierlists');
		} catch (error) {
			addToast('Failed to delete tierlist', 'error');
		}
	}

	// Themed delete modal state and handlers
	let showDeleteModal = false;
	function confirmDelete() {
		showDeleteModal = false;
		handleDeleteWithFallback();
	}
	function cancelDelete() {
		showDeleteModal = false;
	}

	async function toggleLike(event?: Event) {
		if (!$currentUser) {
			if (!isLocal) addToast('Please sign in to like tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			if (liked) {
				await unlikeTierlist(id.toString(), $currentUser.uid);
				liked = false;
				addToast('Removed like', 'success');
			} else {
				await likeTierlist(id.toString(), $currentUser.uid);
				liked = true;

				// Confetti
				if (event?.target) {
					const button = event.target as HTMLElement;
					const rect = button.getBoundingClientRect();
					const x = (rect.left + rect.width / 2) / window.innerWidth;
					const y = (rect.top + rect.height / 2) / window.innerHeight;

					confetti({
						particleCount: 50,
						spread: 60,
						origin: { x, y },
						startVelocity: 15,
						gravity: 0.8,
						ticks: 100
					});
				} else {
					confetti({
						particleCount: 50,
						spread: 60,
						origin: { y: 0.7 },
						startVelocity: 15,
						gravity: 0.8,
						ticks: 100
					});
				}
			}
		} catch (error) {
			console.error('Error toggling like:', error);
			addToast('Failed to update like', 'error');
		} finally {
			interacting = false;
		}
	}

	async function addComment() {
		if (!$currentUser || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			interacting = true;

			const response = await fetch(`/api/cloudflare/tierlists/${id.toString()}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					text: commentText.trim(),
					author: $currentUser.displayName || 'Anonymous',
					authorUid: $currentUser.uid,
					userId: $currentUser.uid
				})
			});
			if (!response.ok) throw new Error(await response.text());

			commentText = '';
			addToast('Comment added!', 'success');
			loadComments();
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		} finally {
			interacting = false;
		}
	}

	async function loadComments() {
		if (!id) return;
		if (isLocal) return;

		const response = await fetch(`/api/cloudflare/tierlists/${id.toString()}/comments`);
		if (!response.ok) return;
		const data = await response.json();
		commentsList = (data.items || []).map((item: any) => ({
			id: item.id,
			text: item.text,
			author: item.author || item.userDisplayName || 'Anonymous',
			authorUid: item.authorUid || item.userId,
			timestamp: item.createdAt ? new Date(item.createdAt).getTime() : Date.now()
		}));
		comments = commentsList.length;
		unsubscribeComments = null;
	}

	async function loadLikes() {
		if (!id) return;
		if (isLocal) return;

		const response = await fetch(
			`/api/cloudflare/tierlists/${id.toString()}/likes${$currentUser ? `?userId=${encodeURIComponent($currentUser.uid)}` : ''}`
		);
		if (!response.ok) return;
		const data = await response.json();
		likes = data.count || 0;
		liked = Boolean(data.liked);
		unsubscribeLikes = null;
	}

	async function loadForks() {
		if (!id) return;
		if (isLocal) return;

		const response = await fetch(`/api/cloudflare/tierlists/${id.toString()}/interactions`);
		if (!response.ok) return;
		const data = await response.json();
		forks = data.forks || 0;
		unsubscribeForks = null;
	}

	async function forkTierlist() {
		if (!$currentUser) {
			addToast('Please sign in to fork tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			let allItems: TierItem[] = [];
			if (tierListData?.list_type === 'dynamic' && Array.isArray(tierListData.items)) {
				allItems = [...tierListData.items];
			} else if (tierListData?.tiers) {
				tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
					if (tier.items) {
						allItems.push(...tier.items);
					}
				});
			}

			const forkData = {
				sourceTitle: title,
				sourceId: id,
				items: allItems,
				timestamp: Date.now()
			};
			localStorage.setItem('standpoint_fork_data', JSON.stringify(forkData));

			const aiSuggestions = allItems.map((item) => ({
				name: item.text || item.name,
				image: !!item.image,
				imageUrl:
					typeof item.image === 'string' && item.image.startsWith('http') ? item.image : null
			}));
			localStorage.setItem('standpoint_ai_suggestions', JSON.stringify(aiSuggestions));
			localStorage.setItem('standpoint_ai_suggestions_enabled', 'true');

			const response = await fetch(`/api/cloudflare/tierlists/${id.toString()}/forks`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userUid: $currentUser.uid,
					userName: $currentUser.displayName || 'Anonymous'
				})
			});
			if (!response.ok) throw new Error(await response.text());

			addToast('Tierlist forked! Redirecting to editor...', 'success');

			setTimeout(() => {
				goto('/tierlists/create?forked=true');
			}, 1000);
		} catch (error) {
			console.error('Error forking tierlist:', error);
			addToast('Failed to fork tierlist', 'error');
		} finally {
			interacting = false;
		}
	}

	function formatDate(dateStr: string) {
		try {
			return new Date(dateStr).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function getTierListTypeName(type: string) {
		const names: Record<string, string> = {
			classic: 'Classic Grid',
			dynamic: 'Dynamic Canvas'
		};
		return names[type] || 'Classic Grid';
	}

	function getTotalItems(): number {
		if (!tierListData) return 0;
		if (tierListData.list_type === 'dynamic' && Array.isArray(tierListData.items)) {
			return tierListData.items.length;
		}
		if (!tierListData.tiers) return 0;
		return tierListData.tiers.reduce(
			(total: number, tier: TierCreate & { items?: TierItem[] }) =>
				total + (tier.items?.length || 0),
			0
		);
	}

	function getItemsInTier(tierName: string): number {
		// For classic tierlists
		if (tierListData?.list_type !== 'dynamic') {
			if (!tierListData?.tiers) return 0;
			const tier = tierListData.tiers.find(
				(t: TierCreate & { items?: TierItem[] }) => t.name === tierName
			);
			return tier?.items?.length || 0;
		}
		// For dynamic tierlists, items are in tierListData.items and assigned to tiers by y position
		if (Array.isArray(tierListData?.items) && Array.isArray(tierListData?.tiers)) {
			const tier = tierListData.tiers.find((t: TierCreate) => t.name === tierName);
			if (!tier) return 0;
			// Find the next tier below (for range)
			const sortedTiers = [...tierListData.tiers].sort((a, b) => a.position - b.position);
			const idx = sortedTiers.findIndex((t) => t.name === tierName);
			const topY = tier.position;
			const bottomY = idx < sortedTiers.length - 1 ? sortedTiers[idx + 1].position : 1.0;
			// Items whose y position is >= topY and < bottomY are in this tier
			return tierListData.items.filter((item: any) => {
				const y = item.position?.y;
				return typeof y === 'number' && y >= topY && y < bottomY;
			}).length;
		}
		return 0;
	}

	function getMostPopulatedTier(): string {
		if (!tierListData) return 'None';
		if (!tierListData.tiers || tierListData.tiers.length === 0) return 'None';
		const counts: Record<string, number> = {};
		if (tierListData.list_type === 'dynamic' && Array.isArray(tierListData.items)) {
			const sortedTiers = [...tierListData.tiers].sort((a, b) => a.position - b.position);
			tierListData.items.forEach((item: any) => {
				const y = item.position?.y;
				if (typeof y !== 'number') return;
				for (let i = 0; i < sortedTiers.length; i++) {
					const top = sortedTiers[i].position;
					const bottom = i < sortedTiers.length - 1 ? sortedTiers[i + 1].position : 1.000001;
					if (y >= top && y < bottom) {
						counts[sortedTiers[i].name] = (counts[sortedTiers[i].name] || 0) + 1;
						break;
					}
				}
			});
		} else {
			tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
				counts[tier.name] = tier.items?.length || 0;
			});
		}
		let max = 0;
		let chosen = 'None';
		Object.entries(counts).forEach(([name, count]) => {
			if (count > max) {
				max = count;
				chosen = name;
			}
		});
		return max > 0 ? chosen : 'None';
	}

	function getItemTypeBreakdown(): { text: number; image: number } {
		if (!tierListData) return { text: 0, image: 0 };
		let textCount = 0;
		let imageCount = 0;
		if (tierListData.list_type === 'dynamic' && Array.isArray(tierListData.items)) {
			tierListData.items.forEach((item: any) => {
				if (item.image) imageCount++;
				else textCount++;
			});
			return { text: textCount, image: imageCount };
		}
		if (!tierListData.tiers) return { text: 0, image: 0 };
		tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
			tier.items?.forEach((item: TierItem) => {
				if (item.image) imageCount++;
				else textCount++;
			});
		});
		return { text: textCount, image: imageCount };
	}

	let totalItems = getTotalItems();
	let itemBreakdown = getItemTypeBreakdown();
	let mostPopulated = getMostPopulatedTier();

	$: if (tierListData) {
		totalItems = getTotalItems();
		itemBreakdown = getItemTypeBreakdown();
		mostPopulated = getMostPopulatedTier();
	}

	onMount(() => {
		loadComments();
		loadLikes();
		loadForks();
		checkIfForked();
	});

	async function checkIfForked() {
		if (!id) return;

		try {
			const data = await getTierlist(id.toString());

			if (data) {
				isForked = data.isForked || false;
				originalId = data.originalId || '';

				if (isForked && originalId) {
					const originalData = await getTierlist(originalId);

					if (originalData) {
						originalTitle = originalData.title || 'Original Tierlist';
						originalAuthor = (originalData as any).authorName || 'Unknown Author';
					}
				}
			}
		} catch (error) {
			console.error('Error checking if tierlist is forked:', error);
		}
	}

	onDestroy(() => {
		if (unsubscribeComments) {
			unsubscribeComments();
		}
		if (unsubscribeLikes) {
			unsubscribeLikes();
		}
		if (unsubscribeForks) {
			unsubscribeForks();
		}
	});

	let isOwner = false;
	let forkHover = false;
	let commentPostHover = false;

	// Safe accessors for optional fields not in the strict interface
	$: safeLastEdited = (tierListData && (tierListData as any).last_edited) || null;

	$: if (isLocal) {
		isOwner = true;
	} else if ($currentUser && tierListData) {
		const isOriginalOwner = $currentUser.uid === tierListData.owner;
		const redirectUids = tierListData.redirectUids || [];
		const hasRedirectAccess = redirectUids.includes($currentUser.uid);
		const isDevUser = $userGroup === 'dev';
		const displayNameMatch = $currentUser.displayName === tierListData.owner_displayName;
		isOwner = isOriginalOwner || hasRedirectAccess || isDevUser || displayNameMatch;
	}

	function handleLike(event: Event) {
		toggleLike(event);
	}

	function handleFork() {
		forkTierlist();
	}

	function promptLogin() {
		addToast('Please sign in to interact with tierlists', 'info');
		showLoginModal = true;
	}

	async function handleLogin() {
		await signInWithGoogle();
		showLoginModal = false;
		location.reload();
	}

	function handleCloseLogin() {
		showLoginModal = false;
	}

	function copyShareUrl() {
		if (navigator.clipboard && shareUrl) {
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					addToast('Link copied to clipboard!', 'success');
				})
				.catch(() => {
					addToast('Failed to copy link', 'error');
				});
		} else {
			addToast('Clipboard not available', 'error');
		}
	}

	function handleEdit() {
		// Enforce owner/redirect/dev permissions on client before dispatch
		if (isLocal) {
			// Always allow editing local copies
			dispatch('edit');
			return;
		}
		if (!$currentUser || !tierListData) {
			addToast('Please sign in to edit tierlists', 'error');
			return;
		}
		const isOriginalOwner = $currentUser.uid === tierListData.owner;
		const redirectUids = tierListData.redirectUids || [];
		const hasRedirectAccess = redirectUids.includes($currentUser.uid);
		const isDevUser = $userGroup === 'dev';
		const displayNameMatch = $currentUser.displayName === tierListData.owner_displayName;
		const allowed = isOriginalOwner || hasRedirectAccess || isDevUser || displayNameMatch;
		if (!allowed) {
			addToast('You can only edit your own tierlists', 'error');
			return;
		}
		dispatch('edit');
	}
</script>

{#if showLoginModal}
	<LoginModal open={showLoginModal} on:close={handleCloseLogin} on:login={handleLogin} />
{/if}

<div
	class="flex h-full flex-col overflow-y-auto p-6 text-white"
	style="background: rgba(var(--primary), 0.12);"
>
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm" style="color: rgb(var(--primary-light-rgb));">{resolvedAuthorName}</span
			>
			<!-- Interaction buttons (hidden for local tierlists) -->
			{#if !isLocal}
				<div class="flex items-center space-x-2">
					{#if $currentUser}
						<!-- Like count -->
						<span class="mr-2 text-sm font-bold text-white">{likes}</span>
						<!-- Like button -->
						<button
							class="flex h-10 w-10 items-center justify-center transition-colors duration-200"
							style="background: {likeHover
								? 'rgba(255,0,0,0.5)'
								: liked
									? 'rgba(255,0,0,1)'
									: 'var(--primary)'}; color: {liked ? 'white' : 'var(--primary-light)'};"
							on:mouseenter={() => (likeHover = true)}
							on:mouseleave={() => (likeHover = false)}
							on:click={handleLike}
							title={liked ? 'Unlike' : 'Like'}
						>
							<span class="material-symbols-outlined text-lg"
								>{liked ? 'favorite' : 'favorite_border'}</span
							>
						</button>

						<button
							class="flex h-10 w-10 items-center justify-center transition-colors duration-200"
							style="background: {forkHover
								? 'rgba(var(--primary-light),0.5)'
								: 'var(--primary)'}; color: var(--primary-light);"
							on:click={handleFork}
							on:mouseenter={() => (forkHover = true)}
							on:mouseleave={() => (forkHover = false)}
							title="Fork this tierlist"
							aria-label="Fork this tierlist"
						>
							<span class="material-symbols-outlined text-lg">call_split</span>
						</button>
					{:else}
						<!-- Login prompt for guests -->
						<button
							class=" bg-blue-600 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-blue-700"
							on:click={promptLogin}
						>
							Login to interact
						</button>
					{/if}
				</div>
			{/if}
		</div>
		<h1 class="mb-4 text-2xl font-bold break-words">{title || 'UNTITLED TIER LIST'}</h1>

		<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">
			Created: {formatDateSafe(tierListData?.created_at)}
		</div>
		{#if safeLastEdited}
			<div class="mb-6 text-sm" style="color: rgb(var(--primary-light-rgb));">
				Last edited: {formatDateSafe(safeLastEdited)}
			</div>
		{:else}
			<div class="mb-6"></div>
		{/if}

		<!-- Tier List Statistics Section (shown for all including local) -->
		{#if tierListData}
			<div class="mb-6 p-4" style="background: rgba(var(--primary), 0.12);">
				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-3 gap-4">
					<div class="p-3 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-2xl font-bold text-white">{totalItems}</div>
						<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Items</div>
					</div>
					<div class="p-3 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-lg font-bold text-white">{tierListData.tiers?.length || 0}</div>
						<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Tiers</div>
					</div>
					<div class="p-3 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-lg font-bold text-white">
							{getTierListTypeName(tierListData?.list_type || 'classic')}
						</div>
						<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Type</div>
					</div>
				</div>

				<!-- Item Type Breakdown -->
				<div class="mb-4 grid grid-cols-2 gap-3">
					<div class="p-2 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-sm font-bold text-white">{itemBreakdown.text}</div>
						<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Text Items</div>
					</div>
					<div class="p-2 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-sm font-bold text-white">{itemBreakdown.image}</div>
						<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Image Items</div>
					</div>
				</div>

				<!-- Tier Breakdown -->
				<div class="mb-4">
					<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">Tiers</div>
					<div class="space-y-2">
						{#if tierListData.tiers && tierListData.tiers.length > 0}
							{@const tierCounts = tierListData.tiers.map((tier) => getItemsInTier(tier.name))}
							{@const totalTierCount = tierCounts.reduce((a, b) => a + b, 0)}
							{#each tierListData.tiers as tier, i (tier.name)}
								{@const tierCount = getItemsInTier(tier.name)}
								{@const percent = totalTierCount ? (tierCount / totalTierCount) * 100 : 0}
								{@const barWidth = percent}
								<div
									class="tier-row flex items-center justify-between p-2 {tier.name === mostPopulated
										? 'active-tier'
										: ''}"
									style="background: rgba(var(--primary), 0.04);"
								>
									<div class="flex items-center space-x-2">
										<div
											class="h-3 w-3 flex-shrink-0"
											style="border: 1px solid rgb(var(--primary-light-rgb)); background-color: {tier.color ||
												'#ff7f7f'};"
										></div>
										<span class="max-w-1.5 text-sm" style="color: rgb(var(--primary-light-rgb));"
											>{tier.name}</span
										>
									</div>
									<div class="tier-bar-wrap flex items-center gap-2">
										<span class="min-w-[1.5rem] text-right text-sm font-bold text-white"
											>{tierCount}</span
										>
										<span class="text-xs font-medium text-white">{percent.toFixed(1)}%</span>
										<div class="tier-bar relative h-2 flex-1 overflow-hidden bg-white/10">
											<div
												class="h-2"
												style="background: rgb(var(--primary-light-rgb)); width: {barWidth}%; transition: width 0.4s ease;"
											></div>
										</div>
									</div>
								</div>
							{/each}
						{:else if tierListData.list_type === 'dynamic' && Array.isArray(tierListData.items) && tierListData.items.length > 0}
							<div
								class="tier-row flex items-center justify-between p-2"
								style="background: rgba(var(--primary), 0.04);"
							>
								<div class="flex items-center space-x-2">
									<span class="text-sm" style="color: rgb(var(--primary-light-rgb));">Items</span>
								</div>
								<div class="tier-bar-wrap flex items-center gap-2">
									<span class="min-w-[1.5rem] text-right text-sm font-bold text-white"
										>{tierListData.items.length}</span
									>
									<span class="text-xs font-medium text-white">100.0%</span>
									<div class="tier-bar relative h-2 flex-1 overflow-hidden bg-white/10">
										<div
											class="h-2"
											style="background: rgb(var(--primary-light-rgb)); width: 100%; transition: width 0.4s ease;"
										></div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Most Populated Tier -->
				<div class="mb-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm" style="color: rgb(var(--primary-light-rgb));"
							>Most Populated Tier</span
						>
						<span class="text-sm font-bold text-white">{mostPopulated}</span>
					</div>
				</div>

				<!-- Original Tierlist Button (if this is a fork) -->
				{#if isForked && originalId}
					<div class="mt-4 mb-4">
						<a
							href="/tierlists/{originalId}"
							class="block w-full px-4 py-2 text-center text-sm font-medium text-white transition-colors"
							style="background: var(--primary);"
						>
							<div class="flex items-center justify-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="m7 7 10 10"></path>
									<path d="M17 7h-7"></path>
									<path d="M7 17v-7"></path>
								</svg>
								View Original Tierlist
							</div>
						</a>
					</div>
				{/if}

				<!-- Original Tierlist Link (if this is a fork) -->
				{#if isForked && originalId}
					<div class="mt-6 mb-4">
						<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">
							Forked From
						</div>
						<a
							href="/tierlists/{originalId}"
							class="flex items-center gap-2 px-4 py-2 text-sm text-white transition-colors"
							style="background: var(--primary); opacity: 0.5;"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="lucide lucide-git-fork"
							>
								<circle cx="12" cy="18" r="3"></circle>
								<circle cx="6" cy="6" r="3"></circle>
								<circle cx="18" cy="6" r="3"></circle>
								<path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
								<path d="M12 12v3"></path>
							</svg>
							View Original Tierlist
							<span class="ml-1 opacity-70">by {originalAuthor}</span>
						</a>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Local tierlist notice -->
		{#if isLocal}
			<div
				class="mb-6 p-4 text-sm"
				style="background: rgba(var(--primary), 0.08); color: rgb(var(--primary-light-rgb));"
			>
				This tierlist exists only in your browser.
			</div>
		{/if}

		<!-- Comments Section -->
		{#if !isLocal}
			<div class="mb-6 p-4" style="background: rgba(var(--primary), 0.08);">
				<h3 class="mb-4 text-lg font-semibold" style="color: rgb(var(--primary-light-rgb));">
					Comments ({comments})
				</h3>

				<!-- Add Comment Form -->
				{#if $currentUser}
					<div class="mb-4">
						<textarea
							bind:value={commentText}
							placeholder="Add a comment..."
							class="w-full px-3 py-2 text-white focus:outline-none"
							style="border: 1px solid var(--primary); background: rgba(var(--primary), 0.12); color: rgb(var(--primary-light-rgb));"
							rows="3"
							maxlength="500"
						></textarea>
						<div class="mt-2 flex justify-end">
							<button
								on:click={addComment}
								disabled={!commentText.trim() || interacting}
								class="px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
								style="background: {commentPostHover
									? 'rgba(var(--primary-light),0.5)'
									: 'var(--primary)'};"
								on:mouseenter={() => (commentPostHover = true)}
								on:mouseleave={() => (commentPostHover = false)}
							>
								{interacting ? 'Posting...' : 'Post'}
							</button>
						</div>
					</div>
				{:else}
					<div class="mb-4 text-center">
						<p class="text-sm" style="color: rgb(var(--primary-light-rgb));">
							Please sign in to add comments
						</p>
					</div>
				{/if}

				<!-- Comments List -->
				{#if commentsList.length > 0}
					<div class="max-h-80 space-y-3 overflow-y-auto">
						{#each commentsList as comment (comment.id)}
							<div class="p-3" style="background: rgba(var(--primary), 0.12);">
								<div class="mb-1 flex items-center space-x-2">
									<span class="text-sm font-medium" style="color: rgb(var(--primary-light-rgb));"
										>{comment.author}</span
									>
									<span class="text-xs" style="color: rgb(var(--primary-light-rgb));"
										>{new Date(comment.timestamp).toLocaleDateString()}</span
									>
								</div>
								<p
									class="overflow-auto text-sm break-words"
									style="color: rgb(var(--primary-light-rgb)); max-height: 6em; word-break: break-word; white-space: pre-line;"
								>
									{comment.text}
								</p>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center" style="color: rgb(var(--primary-light-rgb));">
						<p class="text-sm">No comments yet. Be the first to comment!</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Bottom section with link, edit and delete (share link hidden for local) -->
		<div class="mt-auto border-t border-white pt-4">
			<div class="flex items-center justify-between">
				{#if !isLocal}
					<!-- Copyable link at bottom left -->
					<button
						class="flex-1 truncate pr-4 text-left text-sm transition-colors"
						on:click={copyShareUrl}
						title="Click to copy link"
						style="color: rgb(var(--primary));"
					>
						{shareUrl}
					</button>
				{:else}
					<div class="flex-1 pr-4 text-left text-xs" style="color: rgb(var(--primary));">
						Local draft (not shareable)
					</div>
				{/if}

				<!-- Edit and Delete buttons at bottom right -->
				<div class="flex items-center space-x-2">
					{#if isOwner}
						<button
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center text-white transition-colors duration-200"
							style="background: var(--primary);"
							on:click={handleEdit}
							title="Edit tierlist"
						>
							<span class="material-symbols-outlined text-xl">edit</span>
						</button>
						<button
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-red-600 text-white transition-colors duration-200 hover:bg-red-700"
							on:click={handleDelete}
							title="Delete tierlist"
						>
							<span class="material-symbols-outlined text-xl">delete</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Themed Delete Confirmation Modal -->
	<Modal bind:open={showDeleteModal} on:close={cancelDelete}>
		<div class="space-y-4">
			<div class="text-lg font-semibold text-white">Delete tierlist?</div>
			<p class="text-sm" style="color: rgb(var(--primary-light-rgb));">
				This action cannot be undone. This will permanently delete the tierlist and remove its data.
			</p>
			<div class="flex justify-end gap-2">
				<button
					class="px-3 py-1 text-sm"
					style="background: rgba(var(--primary), 0.12); color: rgb(var(--primary-light-rgb));"
					on:click={cancelDelete}>Cancel</button
				>
				<button
					class="bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
					on:click={confirmDelete}>Delete</button
				>
			</div>
		</div>
	</Modal>
</div>

<style>
	.tier-bar-wrap {
		width: 160px;
	}
	.tier-bar {
		width: 110px;
	}
	.tier-row.active-tier {
		outline: 1px solid rgba(var(--primary-light-rgb), 0.8);
		box-shadow: 0 0 0 2px rgba(var(--primary-light-rgb), 0.15) inset;
	}
</style>
