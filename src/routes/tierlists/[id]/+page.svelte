<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import TierlistSidebar from '../../../components/tierlist-sidebar.svelte';
	import Toast from '../../../components/toast.svelte';
	import LoadingIndicator from '../../../components/loading-indicator.svelte';
	import { apiClient } from '$lib/api';
	import type { TierListResponse, TierItem, TierCreate } from '$lib/types';
	import { currentUser, userGroup } from '$lib/stores';
	import { addToast } from '$lib/toast';
	import { fadeImage } from '$lib/fadeImage';
	import { dimHexColor, getContrastingLabelColor } from '$lib/tierlist-display';
	import {
		hasUserLikedTierlist,
		likeTierlist,
		unlikeTierlist
	} from '$lib/firestore-polls-tierlists.js';

	// Display model types
	interface DisplayTier {
		id: string;
		name: string;
		color: string;
		labelColor: string;
		position?: number;
		items: TierItem[];
	}

	interface DisplayTierList {
		id: string;
		title: string;
		description?: string;
		list_type: 'classic' | 'dynamic';
		tiers: DisplayTier[];
		unassignedItems: TierItem[];
		author?: string;
		owner?: string;
		owner_displayName?: string;
		banner_image?: string;
		created_at?: string;
		redirectUids?: string[];
	}

	let tierList: DisplayTierList | null = null;
	let loading = true;
	let error = '';
	let selectedItem: TierItem | null = null;

	let likes = 0;
	let liked = false;
	let comments = 0;
	let forks = 0;
	let interacting = false;
	let showComments = false;
	let commentText = '';
	let commentsList: any[] = [];

	// Responsive layout state
	let windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	let windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

	// Sidebar state (persistent per tierlist)
	let showSidebar = true; // desktop default
	let sidebarFloating = false; // mobile overlay mode
	let isMobileView = windowWidth < 900;
	let sidebarDragHandle: HTMLElement | null = null;
	const SIDEBAR_STATE_KEY_PREFIX = 'tierlist_sidebar_open_';

	function updateResponsiveFlags() {
		isMobileView = windowWidth < 900;
		if (isMobileView) {
			showSidebar = false;
			sidebarFloating = true;
		} else {
			showSidebar = true; // always visible desktop
			sidebarFloating = false;
		}
	}

	$: tierListId = $page.params.id;

	const LOCAL_STORAGE_TIERLISTS_KEY = 'standpoint_local_tierlists';
	$: if (tierListId) {
		const urlParams =
			typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
		const isLocal = urlParams?.get('local') === 'true';
		if (isLocal) {
			loadLocalTierList(tierListId);
		} else {
			loadTierList();
		}
	}

	function loadLocalTierList(localId: string) {
		try {
			const raw =
				typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY) : null;
			if (!raw) return;
			const arr = JSON.parse(raw);
			const found = arr.find((t: any) => String(t.id) === String(localId));
			if (!found) return;

			const defaultColors = [
				'#ff7f7f',
				'#ffbf7f',
				'#ffff7f',
				'#bfff7f',
				'#7fff7f',
				'#7fffff',
				'#7fbfff',
				'#7f7fff',
				'#bf7fff',
				'#ff7fff'
			];

			const transformedTiers: DisplayTier[] = (found.tiers || []).map(
				(tier: any, index: number) => ({
					id: tier.name || tier.id || `tier-${index}`,
					name: tier.name || `Tier ${index + 1}`,
					color: tier.color || defaultColors[index % defaultColors.length],
					labelColor:
						tier.labelColor ||
						tier.label_color ||
						getContrastingLabelColor(
							dimHexColor(tier.color || defaultColors[index % defaultColors.length])
						),
					position: tier.position ?? index / Math.max(1, (found.tiers || []).length),
					items: []
				})
			);

			const allItems: TierItem[] = (found.items || []).map((item: any) => ({
				id: item.id,
				text: item.text || item.name,
				image: item.image,
				type: item.type || (item.image ? 'image' : 'text'),
				position: item.position,
				size: item.size,
				naturalSize: item.naturalSize
			}));

			if (found.item_placements && found.item_placements.length > 0) {
				found.item_placements.forEach((placement: any) => {
					const item = allItems.find((it) => it.id === placement.item_id);
					const tierByPosition = transformedTiers[placement.tier_position];
					if (item && tierByPosition) {
						if (found.list_type === 'dynamic' && placement.position)
							item.position = placement.position;
						if (found.list_type === 'dynamic' && placement.size) item.size = placement.size;
						tierByPosition.items.push(item);
					}
				});
			} else {
				if ((found.list_type || found.type) !== 'dynamic') {
					allItems.forEach((item: any, index: number) => {
						const tierIdx = index % transformedTiers.length;
						transformedTiers[tierIdx]?.items.push(item);
					});
				}
			}

			const assignedIds = new Set<string>();
			transformedTiers.forEach((t) => t.items.forEach((it) => assignedIds.add(it.id)));
			const unassignedItems = allItems.filter((it) => !assignedIds.has(it.id));

			tierList = {
				id: String(found.id),
				title: found.title || 'Untitled Tier List',
				list_type: found.list_type || found.type || 'classic',
				tiers: transformedTiers,
				unassignedItems,
				author: 'Local',
				created_at: found.created_at || new Date().toISOString(),
				owner_displayName: 'Local'
			};
			loading = false;
		} catch (e) {
			console.error('Failed to load local tier list', e);
		}
	}

	onMount(() => {
		const handleResize = () => {
			if (typeof window !== 'undefined') {
				windowWidth = window.innerWidth;
				windowHeight = window.innerHeight;
				updateResponsiveFlags();
			}
		};

		// Restore persisted state after first render
		if (typeof window !== 'undefined') {
			queueMicrotask(() => {
				if (tierListId) {
					const persisted = localStorage.getItem(SIDEBAR_STATE_KEY_PREFIX + tierListId);
					if (persisted !== null && isMobileView) {
						showSidebar = persisted === '1';
					}
				}
			});
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
			updateResponsiveFlags();
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', handleResize);
			}
		};
	});

	async function loadTierList() {
		if (!tierListId) {
			console.log('No tierListId provided');
			return;
		}

		try {
			loading = true;
			error = '';
			const response: any = await apiClient.getTierList(String(tierListId));

			const defaultColors = [
				'#ff7f7f',
				'#ffbf7f',
				'#ffff7f',
				'#bfff7f',
				'#7fff7f',
				'#7fffff',
				'#7fbfff',
				'#7f7fff',
				'#bf7fff',
				'#ff7fff'
			];

			const responseTiers = response.tiers || [];
			const transformedTiers: DisplayTier[] = responseTiers.map((tier: any, index: number) => ({
				...tier,
				id: tier.name || `tier-${index}`,
				color: tier.color || defaultColors[index % defaultColors.length],
				labelColor:
					tier.labelColor ||
					tier.label_color ||
					getContrastingLabelColor(
						dimHexColor(tier.color || defaultColors[index % defaultColors.length])
					),
				items: []
			}));

			const allItems: TierItem[] = (response.items || []).map((item: any) => {
				if (typeof item === 'string') {
					return {
						id: item,
						text: item,
						type: 'text' as const
					};
				} else {
					return {
						id: item.id,
						text: item.text,
						image: item.image,
						type: item.type,
						position: item.position,
						size: item.size,
						naturalSize: item.naturalSize
					};
				}
			});

			if (response.item_placements && response.item_placements.length > 0) {
				response.item_placements.forEach((placement: any) => {
					const item = allItems.find((item) => item.id === placement.item_id);
					const tier = transformedTiers[placement.tier_position];

					if (item && tier) {
						if (response.list_type === 'dynamic') {
							if (placement.position) {
								item.position = placement.position;
							}
							if (placement.size) {
								item.size = placement.size;
							}
						}

						tier.items.push(item);
					} else {
						console.warn(
							`❌ Failed to place item: item=${!!item}, tier=${!!tier}, tierPosition=${placement.tier_position}`
						);
					}
				});
			} else {
				console.log('No item placements found - processing items directly');
				allItems.forEach((item, index) => {
					if (response.list_type === 'dynamic') {
						console.log(`✅ Using existing position for item "${item.text}":`, item.position);
					} else {
						const tierIndex = index % transformedTiers.length;
						const tier = transformedTiers[tierIndex];
						if (tier) {
							tier.items.push(item);
							console.log(`✅ Auto-placed item "${item.text}" in tier "${tier.name}"`);
						}
					}
				});
			}

			const assignedItemIds = new Set();
			transformedTiers.forEach((tier) => {
				tier.items.forEach((item) => assignedItemIds.add(item.id));
			});

			let unassignedItems;
			if (response.list_type === 'dynamic') {
				unassignedItems = allItems.filter((item) => !assignedItemIds.has(item.id));
			} else {
				unassignedItems = allItems.filter((item) => !assignedItemIds.has(item.id));
			}

			tierList = {
				id: response.id,
				title: response.title,
				list_type: response.list_type === 'dynamic' ? 'dynamic' : 'classic',
				tiers: transformedTiers,
				unassignedItems: unassignedItems,
				author: response.owner_displayName || response.ownerDisplayName || 'Anonymous',
				owner: response.owner,
				owner_displayName: response.owner_displayName || response.ownerDisplayName,
				created_at: response.created_at
			};

			// Initialize interaction counts (ensure numeric fallbacks)
			likes = typeof response.likes === 'number' ? response.likes : 0;
			comments = typeof response.comments === 'number' ? response.comments : 0;
			forks = typeof response.forks === 'number' ? response.forks : 0;

			if ($currentUser) {
				liked = await hasUserLikedTierlist(tierList.id, $currentUser.uid);
			}
		} catch (err) {
			error = 'Failed to load tier list';
			console.error('Error loading tier list:', err);
		} finally {
			loading = false;
		}
	}

	async function toggleLike() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to like tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			if (liked) {
				await unlikeTierlist(tierList.id, $currentUser.uid);
				likes--;
				liked = false;
				addToast('Removed like', 'success');
			} else {
				await likeTierlist(tierList.id, $currentUser.uid);
				likes++;
				liked = true;
				addToast('Added like!', 'success');
			}
		} catch (error: unknown) {
			console.error('Error toggling like:', error);
			addToast(error instanceof Error ? error.message : 'Failed to update like', 'error');
		} finally {
			interacting = false;
		}
	}

	async function addComment() {
		if (!$currentUser || !tierList || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			interacting = true;

			const newComment = {
				id: Date.now().toString(),
				text: commentText.trim(),
				author: $currentUser.displayName || 'Anonymous',
				timestamp: Date.now()
			};

			commentsList = [newComment, ...commentsList];
			comments++;
			commentText = '';
			addToast('Comment added!', 'success');
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		} finally {
			interacting = false;
		}
	}

	async function forkTierlist() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to fork tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			// Collect all items (assigned + unassigned)
			const allItems = [
				...(tierList.unassignedItems || []),
				...tierList.tiers.flatMap((tier) => tier.items || [])
			];

			const forkData = {
				sourceTitle: tierList.title,
				sourceId: tierList.id,
				items: allItems.map((item) => ({
					id: item.id,
					text: item.text,
					image: item.image,
					type: item.type,
					position: item.position,
					size: item.size,
					naturalSize: item.naturalSize
				})),
				timestamp: Date.now()
			};
			localStorage.setItem('standpoint_fork_data', JSON.stringify(forkData));

			// AI suggestions mirror
			const aiSuggestions = allItems.map((item) => ({
				name: item.text,
				image: !!item.image,
				imageUrl:
					typeof item.image === 'string' && item.image.startsWith('http') ? item.image : null
			}));
			localStorage.setItem('standpoint_ai_suggestions', JSON.stringify(aiSuggestions));
			localStorage.setItem('standpoint_ai_suggestions_enabled', 'true');

			forks++;
			addToast('Tierlist forked! Redirecting to editor...', 'success');

			setTimeout(() => {
				goto('/tierlists/create?forked=true');
			}, 900);
		} catch (error) {
			console.error('Error forking tierlist:', error);
			addToast('Failed to fork tierlist', 'error');
		} finally {
			interacting = false;
		}
	}

	async function editTierlist() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to edit tierlists', 'error');
			return;
		}

		const isOriginalOwner = tierList.owner === $currentUser.uid;
		const redirectUids = (tierList as any).redirectUids || [];
		const hasRedirectAccess = redirectUids.includes($currentUser.uid);
		const isDevUser = $userGroup === 'dev';
		const displayNameMatch = tierList.author === $currentUser.displayName;

		if (!isOriginalOwner && !hasRedirectAccess && !isDevUser && !displayNameMatch) {
			addToast('You can only edit your own tierlists', 'error');
			return;
		}

		try {
			// Prepare complete tierlist data for editing
			const editData = {
				id: tierList.id,
				title: tierList.title,
				description: tierList.description || '',
				list_type: tierList.list_type,
				tiers: tierList.tiers.map((tier) => ({
					name: tier.name,
					color: tier.color,
					labelColor: tier.labelColor,
					label_color: tier.labelColor,
					position: tier.position || 0
				})),
				items: [
					...(tierList.unassignedItems || []),
					...tierList.tiers.flatMap((tier) => tier.items || [])
				].map((item) => ({
					id: item.id,
					text: item.text,
					type: item.type,
					image: item.image,
					position: item.position,
					size: item.size,
					naturalSize: item.naturalSize
				})),
				owner: tierList.owner
			};

			console.log('Edit data being prepared:', editData);

			// Store edit data in sessionStorage for the create page
			sessionStorage.setItem('editData', JSON.stringify(editData));

			addToast('Redirecting to editor...', 'success');

			// Navigate to create page with edit parameter
			setTimeout(() => {
				if (tierList) {
					goto(`/tierlists/create?edit=${tierList.id}`);
				}
			}, 500);
		} catch (error) {
			console.error('Error preparing edit:', error);
			addToast('Failed to prepare edit', 'error');
		}
	}

	function selectItem(item: TierItem) {
		selectedItem = selectedItem?.id === item.id ? null : item;
	}

	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	// Dynamic viewport-filling sizing: tiers expand to fill available height (desktop only)
	function computeClassicSizing(itemCount: number, tierIndex: number, totalTiers: number) {
		const sidebarWidth = isMobileView ? 0 : 384; // desktop sidebar
		const labelWidth = 160;
		const paddingAllowance = 64;
		const containerWidth = Math.max(
			300,
			windowWidth - sidebarWidth - labelWidth - paddingAllowance
		);

		// Only apply viewport-filling on desktop; mobile uses natural scrolling
		if (isMobileView) {
			let target = 140;
			const min = 80;
			while (target > min) {
				const perRow = Math.max(1, Math.floor(containerWidth / (target + 16)));
				if (perRow * 2 >= itemCount || perRow >= itemCount) break;
				target -= 10;
			}
			console.debug('[ClassicSizing Mobile]', { itemCount, containerWidth, chosen: target });
			return { size: target, tierHeight: 0 }; // tierHeight unused on mobile
		}

		// Desktop: Calculate ideal tier height to fill viewport
		const availableHeight = windowHeight - 80; // reserve space for header/margins
		const tierHeight = Math.floor(availableHeight / totalTiers);
		const itemVerticalPadding = 48; // p-4/p-6 padding
		const availableItemHeight = Math.max(100, tierHeight - itemVerticalPadding);

		// Determine item size that fills height while maintaining square aspect and wrapping nicely
		let target = Math.min(availableItemHeight, 180); // cap at reasonable max
		const min = 80;
		const gap = 12; // gap-3

		// Adjust size to optimize row fitting
		while (target > min) {
			const perRow = Math.max(1, Math.floor((containerWidth + gap) / (target + gap)));
			const rows = Math.ceil(itemCount / perRow);
			const totalHeight = rows * target + (rows - 1) * gap;
			if (totalHeight <= availableItemHeight) break;
			target -= 5;
		}

		console.debug('[ClassicSizing Desktop]', {
			tierIndex,
			itemCount,
			tierHeight,
			availableItemHeight,
			chosen: target
		});
		return { size: target, tierHeight };
	}

	function getDynamicGradient(): string {
		if (!tierList?.tiers) return 'background: linear-gradient(to bottom, #222, #333)';

		// Convert hex color to rgba with opacity for darkening
		function hexToRgba(hex: string, alpha: number = 0.65) {
			let c = hex.replace('#', '');
			if (c.length === 3)
				c = c
					.split('')
					.map((x) => x + x)
					.join('');
			const num = parseInt(c, 16);
			const r = (num >> 16) & 255;
			const g = (num >> 8) & 255;
			const b = num & 255;
			return `rgba(${r},${g},${b},${alpha})`;
		}

		const colors = tierList.tiers.map((tier) => hexToRgba(tier.color || '#666666', 0.65));
		return `background: linear-gradient(to bottom, ${colors.join(', ')});`;
	}

	// Gets item size for dynamic mode
	function getItemSize(item: TierItem): { width: number; height: number } {
		if (item.size) return item.size;

		// Default size for items without specified size
		return { width: 120, height: 120 };
	}

	function handleSidebarDelete(event: CustomEvent) {
		const { id, type } = event.detail;
		if (type === 'tierlist') {
			deleteTierList(id);
		}
	}

	async function deleteTierList(tierListId: number) {
		try {
			await apiClient.deleteTierList(String(tierListId));
			window.location.href = '/tierlists';
		} catch (err) {
			console.error('Error deleting tier list:', err);
			if (err instanceof Error) {
				error = `Failed to delete tier list: ${err.message}`;
			} else {
				error = 'Failed to delete tier list. The server may be unavailable.';
			}
			setTimeout(() => {
				error = '';
			}, 5000);
		}
	}

	function toggleSidebar(forceOpen: boolean | null = null) {
		// Desktop: always visible, non-collapsible
		if (!isMobileView) {
			showSidebar = true;
			return;
		}
		if (forceOpen === true) {
			showSidebar = true;
		} else if (forceOpen === false) {
			showSidebar = false;
		} else {
			showSidebar = !showSidebar;
		}
		sidebarFloating = true; // mobile uses floating bottom sheet
		if (typeof window !== 'undefined' && tierListId) {
			localStorage.setItem(SIDEBAR_STATE_KEY_PREFIX + tierListId, showSidebar ? '1' : '0');
		}
	}

	let dragStartY = 0;
	let dragActive = false;
	const DEBUG_CLASSIC_ITEMS =
		typeof import.meta.env !== 'undefined' && !!import.meta.env.VITE_DEBUG_TIERLIST; // toggle via env
	// Root cause note: Some users reported invisible tiles likely due to fadeImage style injection race where image not yet loaded keeps opacity:0 with no fallback. We add a visible placeholder background & ensure min-size + explicit bg color.
	onMount(() => {
		if (DEBUG_CLASSIC_ITEMS) {
			setTimeout(() => {
				const tiles = document.querySelectorAll('[data-item-id]');
				console.debug('[TierClassic] Mounted tiles:', tiles.length);
				tiles.forEach((el) => {
					const r = (el as HTMLElement).getBoundingClientRect();
					console.debug(
						'[TileBBox]',
						(el as HTMLElement).dataset.itemId,
						r.width,
						r.height,
						r.top,
						r.left
					);
				});
			}, 300);
		}
	});
	function handleDragStart(e: TouchEvent) {
		if (!sidebarFloating || !isMobileView) return;
		dragActive = true;
		dragStartY = e.touches[0].clientY;
	}
	function handleDragMove(e: TouchEvent) {
		if (!dragActive) return;
		const diff = e.touches[0].clientY - dragStartY; // positive when dragging down
		if (diff > 60) {
			showSidebar = false; // swipe down to close
			dragActive = false;
		}
	}

	// (Debug moved inside loadTierList earlier)
	function handleDragEnd() {
		dragActive = false;
	}
</script>

<svelte:head>
	<title>{tierList?.title || 'Tier List'} - Standpoint</title>
</svelte:head>

<!-- Fullscreen Tier List Viewer -->
<div
	class="theme-transition fixed inset-0 flex h-screen"
	style="background-color: var(--bg); color: var(--text);"
>
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<LoadingIndicator size="lg" />
		</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl text-red-400">{error}</div>
				<a href="/tierlists" class="bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
					Back to Tier Lists
				</a>
			</div>
		</div>
	{:else if tierList}
		<!-- Main Tier List Display -->
		<div class="flex flex-1 flex-col">
			{#if tierList.list_type === 'classic'}
				<!-- Classic Mode -->
				<div class="flex flex-1 flex-col {isMobileView ? 'overflow-y-auto' : 'overflow-hidden'}">
					{#each tierList.tiers as tier, index (tier.id)}
						{@const sizing = computeClassicSizing(
							tier.items?.length || 0,
							index,
							tierList.tiers.length
						)}
						<div
							class="relative flex transition-all duration-300 {isMobileView ? 'py-2' : ''}"
							style="background-color: {dimColor(tier.color || '#666666', 0.6)}; {isMobileView
								? ''
								: `min-height: ${sizing.tierHeight}px; flex: 1 1 0;`}"
							in:fade={{ duration: 350 }}
							data-tier-index={index}
						>
							<!-- Items left, label column right -->
							<div class="flex w-full">
								<div class="flex-1 p-4 md:p-6">
									{#if tier.items && tier.items.length > 0}
										<div class="relative flex min-h-[110px] flex-wrap content-start gap-3">
											{#if DEBUG_CLASSIC_ITEMS}
												<div
													class="pointer-events-none absolute -top-2 -left-1 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/70"
												>
													{tier.items.length} item{tier.items.length === 1 ? '' : 's'}
												</div>
											{/if}
											{#each tier.items as item, itemIndex (item.id)}
												<div
													class="group/item relative cursor-pointer overflow-hidden rounded-md shadow-sm transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none {selectedItem?.id ===
													item.id
														? 'ring-2 ring-orange-400'
														: ''} bg-gray-800/60"
													style="height:{sizing.size}px;width:{sizing.size}px;display:flex;align-items:center;justify-content:center;min-width:80px;min-height:80px;background:#1f2937;position:relative;"
													data-item-id={item.id}
													data-item-index={itemIndex}
													on:click|stopPropagation={() => selectItem(item)}
													on:keydown={(e) =>
														(e.key === 'Enter' || e.key === ' ') && selectItem(item)}
													role="button"
													tabindex="0"
													aria-label={`View item ${item.text}`}
													in:fade={{ duration: 250 }}
												>
													<!-- Placeholder always visible to avoid opacity:0 blank -->
													<div
														class="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,#374151,#111827)]"
														aria-hidden="true"
													></div>
													{#if item.image}
														<img
															use:fadeImage
															src={item.image}
															alt={item.text}
															class="sp-fade-image absolute inset-0 h-full w-full object-cover"
															loading="lazy"
															draggable="false"
														/>
														<div
															class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
														></div>
													{:else if item.type === 'text'}
														<div class="absolute inset-0 flex items-center justify-center p-2">
															<span class="text-center text-sm leading-tight font-medium text-white"
																>{item.text}</span
															>
														</div>
													{:else}
														<span
															class="absolute inset-0 flex items-center justify-center text-xs text-white/70"
															>{item.text}</span
														>
													{/if}
													{#if item.image}
														<div class="absolute bottom-1 left-1 z-10">
															<span
																class="line-clamp-2 max-w-[95%] text-xs font-medium text-white drop-shadow-lg md:text-sm"
																>{item.text}</span
															>
														</div>
													{/if}
													{#if DEBUG_CLASSIC_ITEMS}
														<div
															class="pointer-events-none absolute inset-0 border border-white/10"
														>
															<div
																class="absolute top-0 left-0 bg-black/70 px-1 text-[10px] text-white/70 select-none"
															>
																{itemIndex}
															</div>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{:else}
										<div class="flex h-full items-center justify-center text-center">
											<div class="text-white/70">
												<div class="text-sm md:text-lg">No items in this tier</div>
											</div>
										</div>
									{/if}
								</div>
								<div
									class="flex items-center justify-center border-l border-white/10 px-4"
									style="width:160px;"
								>
									<div
										class="text-center text-3xl leading-tight font-bold break-words md:text-4xl"
										style="color:{tier.labelColor};"
									>
										{tier.name}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Dynamic Tier List -->
				<div class="flex flex-1 flex-col">
					<!-- Dynamic Canvas -->
					<div class="dynamic-canvas relative flex-1 overflow-hidden" style={getDynamicGradient()}>
						<!-- Tier Zones -->
						{#each tierList.tiers as tier, index (tier.id)}
							{@const tierHeight = 100 / tierList.tiers.length}
							{@const tierTop = (index / tierList.tiers.length) * 100}
							<div
								class="pointer-events-none absolute right-0 left-0 transition-all"
								style="top: {tierTop}%; height: {tierHeight}%;"
							>
								<!-- Tier Controls -->
								<div
									class="pointer-events-auto absolute top-0 right-0 flex h-full w-64 items-center justify-end pr-8"
								>
									<div class="flex flex-col items-end space-y-3" style="color: {tier.labelColor};">
										<div class="text-right text-4xl font-bold" style="color: {tier.labelColor};">
											{tier.name}
										</div>
									</div>
								</div>
							</div>
						{/each}

						<!-- All Dynamic Items -->
						{#if tierList && tierList.tiers}
							{#each [...(tierList.unassignedItems || []), ...tierList.tiers.flatMap( (tier, tierIndex) => (tier.items || []).map( (item) => ({ ...item, _tierIndex: tierIndex }) ) )] as item, i (item.id)}
								{@const x = item.position?.x ?? 0.1 + (i % 8) * 0.1}
								{@const y = item.position?.y ?? 0.5}
								{@const itemSize = getItemSize(item)}

								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="group/item absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer overflow-hidden shadow-lg transition-all hover:shadow-xl {selectedItem?.id ===
									item.id
										? 'ring-2 ring-orange-400'
										: ''}"
									style="left: {x * 100}%; top: {y *
										100}%; width: {itemSize.width}px; height: {itemSize.height}px; {item.image
										? ''
										: item.type === 'text'
											? 'background: linear-gradient(135deg, #374151, #4b5563); display: flex; align-items: center; justify-content: center;'
											: 'background: linear-gradient(135deg, #1f2937, #374151);'}"
									on:click|stopPropagation={() => selectItem(item)}
									on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
									role="button"
									tabindex="0"
									aria-label="View item {item.text}"
									in:fade={{ duration: 250 }}
								>
									<!-- Gradient overlay for images -->
									{#if item.image}
										<img
											use:fadeImage
											src={item.image}
											alt={item.text}
											class="sp-fade-image absolute inset-0 h-full w-full object-cover"
											loading="lazy"
											draggable="false"
										/>
										<div
											class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
										></div>
									{/if}

									{#if item.type === 'text' && !item.image}
										<!-- Text items -->
										<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
											<div class="text-center text-sm leading-tight font-medium text-white">
												{item.text}
											</div>
										</div>
									{:else}
										<!-- Image items -->
										<div class="absolute right-1 bottom-1 z-10">
											<div
												class="text-right text-xs leading-tight font-medium text-white drop-shadow-lg"
											>
												{item.text}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		{#if isMobileView}
			{#if showSidebar}
				<!-- Mobile backdrop -->
				<div
					class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
					on:click={() => toggleSidebar(false)}
					role="button"
					aria-label="Close tierlist sidebar"
					tabindex="0"
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSidebar(false)}
				></div>
				<div
					id="tierlist-sidebar"
					role="complementary"
					aria-label="Tierlist information"
					class="fixed right-0 bottom-0 left-0 z-50 flex w-full flex-col overflow-hidden rounded-t-2xl bg-gray-900/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out"
					in:slide={{ duration: 250, axis: 'y' }}
					out:slide={{ duration: 220, axis: 'y' }}
					on:touchstart={handleDragStart}
					on:touchmove={handleDragMove}
					on:touchend={handleDragEnd}
				>
					<div class="relative max-h-[70vh] flex-1 overflow-y-auto">
						<div class="mx-auto mt-2 mb-4 h-1.5 w-12 rounded-full bg-white/20"></div>
						<TierlistSidebar
							title={tierList.title}
							shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tierlists/${tierList.id}`}
							id={tierList.id}
							tierListData={{
								...tierList,
								items: tierList.tiers
									.flatMap((tier) => tier.items || [])
									.concat(tierList.unassignedItems || []),
								item_placements: []
							} as any}
							on:delete={handleSidebarDelete}
							on:fork={forkTierlist}
							on:edit={editTierlist}
						/>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Desktop static sidebar -->
			<div class="w-96 overflow-y-auto border-l border-gray-800 bg-gray-900/70 backdrop-blur-md">
				<TierlistSidebar
					title={tierList.title}
					shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tierlists/${tierList.id}`}
					id={tierList.id}
					tierListData={{
						...tierList,
						items: tierList.tiers
							.flatMap((tier) => tier.items || [])
							.concat(tierList.unassignedItems || []),
						item_placements: []
					} as any}
					on:delete={handleSidebarDelete}
					on:fork={forkTierlist}
					on:edit={editTierlist}
				/>
			</div>
		{/if}

		{#if isMobileView}
			{#if tierList}
				<!-- Bottom full-width info bar (always visible). Clicking opens/closes floating sidebar on mobile -->
				<button
					on:click={() => toggleSidebar(showSidebar ? false : true)}
					class="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-4 border-t border-white/10 bg-gradient-to-t from-black/85 via-black/70 to-black/60 px-4 py-3 text-left shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[background,color] active:bg-black/80"
					aria-controls="tierlist-sidebar"
					aria-expanded={showSidebar}
					aria-label={showSidebar ? 'Hide tierlist info' : 'Show tierlist info'}
					style="-webkit-tap-highlight-color: transparent;"
					in:slide={{ duration: 250 }}
				>
					<div class="flex min-w-0 flex-1 flex-col">
						<div class="truncate text-sm leading-tight font-semibold">
							{tierList.title || 'Untitled Tierlist'}
						</div>
						<div
							class="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] tracking-wide text-white/60 uppercase"
						>
							<span class="max-w-[50%] truncate"
								>{tierList.author || tierList.owner_displayName || 'Anonymous'}</span
							>
							<div class="flex items-center gap-1">
								<span class="material-symbols-outlined text-accent text-base">favorite</span><span
									>{likes}</span
								>
							</div>
							<div class="flex items-center gap-1">
								<span class="material-symbols-outlined text-accent text-base">comment</span><span
									>{comments}</span
								>
							</div>
							<div class="flex items-center gap-1">
								<span class="material-symbols-outlined text-accent text-base">fork_right</span><span
									>{forks}</span
								>
							</div>
						</div>
					</div>
					<div class="text-accent ml-auto flex items-center gap-2">
						<span class="text-xs font-medium">{showSidebar ? 'HIDE' : 'INFO'}</span>
						<span
							class="material-symbols-outlined text-lg transition-transform duration-300"
							style="transform: rotate({showSidebar ? 180 : 0}deg);">expand_less</span
						>
					</div>
				</button>
			{:else}
				<!-- Skeleton bottom bar while loading tierlist -->
				<div
					class="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-4 border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md"
				>
					<div class="flex min-w-0 flex-1 animate-pulse flex-col">
						<div class="h-3 w-40 bg-white/10"></div>
						<div class="mt-2 flex gap-3">
							<div class="h-2 w-16 bg-white/10"></div>
							<div class="h-2 w-10 bg-white/10"></div>
							<div class="h-2 w-10 bg-white/10"></div>
						</div>
					</div>
					<div class="text-accent ml-auto flex items-center gap-2 opacity-50">
						<span class="text-xs font-medium">INFO</span>
						<span class="material-symbols-outlined text-lg">expand_less</span>
					</div>
				</div>
			{/if}
		{/if}
	{:else}
		<!-- Debug: No tierList data -->
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl text-yellow-400">Debug: No tier list data available</div>
				<div class="text-sm text-gray-400">
					Loading: {loading}, Error: {error}, TierListId: {tierListId}
				</div>
				<a
					href="/tierlists"
					class="mt-4 inline-block bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
				>
					Back to Tier Lists
				</a>
			</div>
		</div>
	{/if}
</div>

<Toast />
