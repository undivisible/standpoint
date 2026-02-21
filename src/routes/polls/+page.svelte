<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { apiClient } from '$lib/api';
	import { savePollToFirestore, getPollsFromFirestore } from '$lib/firestore-polls-tierlists';
	import { getUserVote, saveUserVote, updatePollStatistics } from '$lib/poll-vote-functions';
	import { getAuth } from 'firebase/auth';
	import PollSidebar from '$lib/../components/poll-sidebar.svelte';
	import ChartRenderer from '$lib/../components/chart-renderer.svelte';
	import LoadingIndicator from '$lib/../components/loading-indicator.svelte';
	import PollForm from '$lib/../components/poll-form.svelte';
	import { linear } from 'svelte/easing';
	import { currentUser, userGroup } from '$lib/stores';
	import { addToast } from '$lib/toast';

	let polls: any[] = [];
	const LOCAL_STORAGE_POLLS_KEY = 'standpoint_local_polls';
	let loading = true;
	let error = '';
	let selectedPoll: any = null;
	let showSidebar = false; // poll detail sidebar
	let isMobileView = typeof window !== 'undefined' ? window.innerWidth < 900 : false;
	let sidebarFloating = isMobileView; // track floating mode for poll detail sidebar
	// Collapsible poll list panel
	let showPollList = true;
	const POLL_LIST_STATE_KEY = 'poll_list_open';
	// drag state for mobile poll detail sheet
	let dragStartY = 0;
	let dragActive = false;
	const POLL_SIDEBAR_STATE_KEY_PREFIX = 'poll_sidebar_open_';

	function persistSidebarState() {
		if (typeof window === 'undefined' || !selectedPoll) return;
		try {
			localStorage.setItem(
				POLL_SIDEBAR_STATE_KEY_PREFIX + selectedPoll.id,
				showSidebar ? '1' : '0'
			);
		} catch (e) {
			void e;
		}
	}

	function restoreSidebarStateForPoll(pollId: string) {
		if (typeof window === 'undefined') return false;
		try {
			return localStorage.getItem(POLL_SIDEBAR_STATE_KEY_PREFIX + pollId) === '1';
		} catch (e) {
			void e;
			return false;
		}
	}

	function toggleSidebar(forceOpen: boolean | null = null) {
		if (forceOpen === true) {
			showSidebar = true;
			sidebarFloating = isMobileView;
		} else if (forceOpen === false) {
			showSidebar = false;
		} else {
			showSidebar = !showSidebar;
		}
		persistSidebarState();
	}
	function updateViewport() {
		if (typeof window !== 'undefined') {
			isMobileView = window.innerWidth < 900;
			if (!isMobileView) {
				if (selectedPoll) {
					showSidebar = restoreSidebarStateForPoll(selectedPoll.id) || !!selectedPoll;
				}
				sidebarFloating = false;
				// restore poll list open state
				try {
					const persisted = localStorage.getItem(POLL_LIST_STATE_KEY);
					if (persisted !== null) showPollList = persisted === '1';
				} catch (e) {
					void e;
				}
			} else {
				sidebarFloating = true;
				// on mobile always hide list when viewing detail? keep current state.
			}
		}
	}

	function togglePollList(forceOpen: boolean | null = null) {
		if (forceOpen === true) showPollList = true;
		else if (forceOpen === false) showPollList = false;
		else showPollList = !showPollList;
		try {
			localStorage.setItem(POLL_LIST_STATE_KEY, showPollList ? '1' : '0');
		} catch {}
	}
	let showCreateModal = false;
	let showProUpgradeModal = false;
	let creating = false;
	let createError = '';
	let voteMessage = '';
	let showVoteToast = false;
	let chartData: any = null;
	let hadPreviousVote = false;
	let onVote = vote;

	type PollFormType = {
		title: string;
		responseType: number;
		customOptions: string[];
		gradients: { colors: string[]; enabled: boolean };
	};

	const defaultPoll: PollFormType = {
		title: '',
		responseType: 2,
		customOptions: ['Option A', 'Option B'],
		gradients: { colors: ['rgb(var(--primary))', '#0066cc'], enabled: false }
	};

	let poll: PollFormType = { ...defaultPoll };

	const responseTypes = [
		{
			value: 2,
			label: 'Line Scale (2 options)',
			icon: '─',
			description: "It's a line, it has an option on each side."
		},
		{
			value: 3,
			label: 'Triangle (3 options)',
			icon: '△',
			description: "It's a triangle, great for three-way comparisons."
		},
		{
			value: 4,
			label: 'Square (4 options)',
			icon: '□',
			description: "It's a square, cool right?"
		},
		{
			value: 5,
			label: 'Pentagon (5 options)',
			icon: '⬟',
			description: "It's a pentagon, so many options to choose from!"
		}
	];

	onMount(() => {
		loadPolls();
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', updateViewport);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', updateViewport);
			}
		};
	});

	async function loadPolls() {
		try {
			loading = true;
			error = '';
			const auth = getAuth();
			let loadedPolls = await getPollsFromFirestore();
			// Attach user votes if signed in
			if (auth.currentUser) {
				const uid = auth.currentUser.uid;
				const votes = await Promise.all(
					loadedPolls.map((poll) => getUserVote(poll.id, uid))
				);
				for (let i = 0; i < loadedPolls.length; i++) {
					const userVote = votes[i];
					if (userVote) {
						loadedPolls[i].user_vote = userVote.position;
						loadedPolls[i].user_vote_2d = userVote.position_2d;
					}
				}
			} else {
				// Merge any locally created polls (offline) without duplicating existing ids
				const localPollsRaw = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				if (localPollsRaw) {
					const localArr = JSON.parse(localPollsRaw);
					const existingIds = new Set(loadedPolls.map((p: any) => p.id));
					for (const lp of localArr) {
						if (!existingIds.has(lp.id)) loadedPolls.push(lp);
					}
				}
			}
			polls = loadedPolls;
			// Keep selectedPoll reference fresh
			if (selectedPoll) {
				const updated = polls.find((p) => p.id === selectedPoll.id);
				if (updated) selectedPoll = { ...updated };
			}
		} catch (err) {
			error = 'Failed to load polls. Make sure the backend server is running.';
			console.error('Error loading polls:', err);
		} finally {
			loading = false;
		}
	}

	function handlePollClick(poll: any) {
		selectedPoll = { ...poll };
		// Only close sidebars on mobile; keep them open on desktop
		if (isMobileView) {
			showSidebar = false;
			showPollList = false;
			persistSidebarState();
		} else {
			// On desktop, keep both sidebars open
			showSidebar = true;
			showPollList = true;
			persistSidebarState();
		}
		if (isMobileView) {
			// scroll to top of poll area
			setTimeout(() => {
				try {
					document.querySelector('#mobile-poll-root')?.scrollIntoView({ behavior: 'smooth' });
				} catch {}
			}, 50);
		}
	}

	function handleLikesUpdated(event: CustomEvent) {
		const { id, likes, liked } = event.detail;
		const idx = polls.findIndex((p) => p.id === id);
		if (idx !== -1) {
			polls[idx] = {
				...polls[idx],
				stats: { ...polls[idx].stats, total_votes: polls[idx].stats?.total_votes || 0 },
				likes
			};
		}
		if (selectedPoll?.id === id) {
			selectedPoll = { ...selectedPoll, likes };
		}
	}

	function openCreateModal() {
		// Only allow Pro users to create polls
		showCreateModal = true;
		resetPollForm();
	}

	function resetPollForm() {
		poll = {
			title: '',
			responseType: 2,
			customOptions: ['Option A', 'Option B'],
			gradients: { colors: ['rgb(var(--primary))', '#0066cc'], enabled: false }
		};
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function showVoteMessage(wasUpdate: boolean) {
		voteMessage = wasUpdate ? 'Vote updated!' : 'Vote recorded!';
		showVoteToast = true;
		setTimeout(() => {
			showVoteToast = false;
		}, 3000);
	}

	function updateOptionsForResponseType() {
		const targetCount = poll.responseType;

		let newCustomOptions = [...poll.customOptions];
		let newColors = [...poll.gradients.colors];

		if (newCustomOptions.length < targetCount) {
			for (let i = newCustomOptions.length; i < targetCount; i++) {
				newCustomOptions.push(`Option ${String.fromCharCode(65 + i)}`);
			}
		} else {
			newCustomOptions = newCustomOptions.slice(0, targetCount);
		}

		const defaultColors = ['rgb(var(--primary))', '#0066cc', '#00ff88', '#ff4488', '#ffaa00'];
		while (newColors.length < targetCount) {
			newColors.push(defaultColors[newColors.length % defaultColors.length]);
		}
		newColors = newColors.slice(0, targetCount);

		poll = {
			...poll,
			customOptions: newCustomOptions,
			gradients: {
				...poll.gradients,
				colors: newColors
			}
		};
	}

	function updateOption(index: number, value: string) {
		const newCustomOptions = [...poll.customOptions];
		newCustomOptions[index] = value;
		poll = {
			...poll,
			customOptions: newCustomOptions
		};
	}

	async function vote(position: number, position2D?: { x: number; y: number }) {
		if (!selectedPoll) return;

		try {
			const auth = getAuth();
			const hadPreviousVote =
				selectedPoll.user_vote !== undefined && selectedPoll.user_vote !== null;

			// For Firebase users, store vote persistently
			if (auth.currentUser) {
				await saveUserVote(selectedPoll.id, auth.currentUser.uid, position, position2D);
				await updatePollStatistics(selectedPoll.id);

				selectedPoll = {
					...selectedPoll,
					user_vote: position,
					user_vote_2d: position2D || null
				};

				const pollIndex = polls.findIndex((p) => p.id === selectedPoll.id);
				if (pollIndex !== -1) {
					polls[pollIndex] = {
						...polls[pollIndex],
						user_vote: position,
						user_vote_2d: position2D || null
					};
					polls = [...polls];
				}
			} else {
				// Fallback to backend API for non-Firebase users
				const voteData: any = { position };
				const responseType = selectedPoll.response_type || selectedPoll.responseType;
				if (position2D && [3, 4, 5].includes(responseType)) {
					voteData.position_2d = position2D;
				}

				const voteResponse = await apiClient.vote(selectedPoll.id, position, voteData);

				if (
					voteResponse &&
					(voteResponse.user_vote !== undefined || voteResponse.user_vote_2d !== undefined)
				) {
					selectedPoll = {
						...selectedPoll,
						user_vote: voteResponse.user_vote,
						user_vote_2d: voteResponse.user_vote_2d
					};

					const pollIndex = polls.findIndex((p) => p.id === selectedPoll.id);
					if (pollIndex !== -1) {
						polls[pollIndex] = {
							...polls[pollIndex],
							user_vote: voteResponse.user_vote,
							user_vote_2d: voteResponse.user_vote_2d
						};
					}
				} else {
					await loadPolls();
					selectedPoll = polls.find((p) => p.id === selectedPoll.id);
				}
			}

			// Show feedback message
			showVoteMessage(hadPreviousVote);
		} catch (err) {
			console.error('Error voting:', err);
		}
	}

	$: if (poll.responseType) {
		updateOptionsForResponseType();
	}

	async function deletePoll(pollId: string | number) {
		try {
			const pollIdStr = typeof pollId === 'string' ? pollId : String(pollId);
			await apiClient.deletePoll(pollIdStr);
			await loadPolls();

			if (selectedPoll?.id === pollId) {
				selectedPoll = null;
				showSidebar = false;
			}
		} catch (err) {
			console.error('Error deleting poll:', err);
			error = 'Failed to delete poll. Please try again.';
		}
	}

	function handleSidebarDelete(event: CustomEvent) {
		const { id, type } = event.detail;
		if (type === 'poll') {
			deletePoll(id);
		}
	}

	async function createPoll() {
		try {
			creating = true;
			createError = '';

			if (!poll.title.trim()) {
				createError = 'Please provide a title';
				return;
			}

			const auth = getAuth();
			const ownerId = auth.currentUser ? auth.currentUser.uid : null;
			const pollData = {
				title: poll.title,
				question: poll.title,
				response_type: poll.responseType,
				options: poll.customOptions,
				gradients: poll.gradients,
				owner: ownerId,
				stats: {
					total_votes: 0,
					average: 0,
					std_dev: 0,
					vote_positions: [],
					vote_positions_2d: [],
					average_2d: [0, 0]
				},
				created_at: new Date().toISOString()
			};
			let newPollId;
			if (auth.currentUser) {
				newPollId = await savePollToFirestore(pollData);
				// Sync any local polls to Firebase
				const localPolls = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				if (localPolls) {
					const pollsArr = JSON.parse(localPolls);
					for (const localPoll of pollsArr) {
						if (!localPoll.owner) {
							await savePollToFirestore({ ...localPoll, owner: ownerId });
						}
					}
					localStorage.removeItem(LOCAL_STORAGE_POLLS_KEY);
				}
			} else {
				// Save to localStorage
				const localPolls = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				const pollsArr = localPolls ? JSON.parse(localPolls) : [];
				newPollId = Date.now().toString();
				pollsArr.push({ id: newPollId, ...pollData });
				localStorage.setItem(LOCAL_STORAGE_POLLS_KEY, JSON.stringify(pollsArr));
			}
			await loadPolls();
			selectedPoll = polls.find((p) => p.id === newPollId);
			showSidebar = true;
			closeCreateModal();
		} catch (err) {
			createError = 'Failed to create poll';
			console.error('Error creating poll:', err);
		} finally {
			creating = false;
		}
	}

	function renderChart(poll: any) {
		if (!poll) return null;

		const chartPoll = {
			...poll,
			response_type: poll.response_type || poll.responseType || 1
		};

		// Ensure stats object exists with defaults
		const stats = chartPoll.stats || {
			vote_positions: [],
			vote_positions_2d: [],
			average: 0,
			average_2d: null,
			std_dev: 0,
			total_votes: 0,
			median_x: 0,
			median_y: 0,
			mode_x: 0,
			mode_y: 0,
			range_x: 0,
			range_y: 0
		};

		const positions = stats.vote_positions || [];

		// Ensure positions2D is in the correct format for the chart renderer
		let positions2D: Array<{ x: number; y: number; id?: string }> = [];
		if (stats.vote_positions_2d && Array.isArray(stats.vote_positions_2d)) {
			positions2D = stats.vote_positions_2d.map((pos: any, i: number) => {
				if (typeof pos === 'object' && pos !== null) {
					return {
						x: typeof pos.x === 'number' ? pos.x : 0.5,
						y: typeof pos.y === 'number' ? pos.y : 0.5,
						id: `vote-${i}`
					};
				}
				return { x: 0.5, y: 0.5, id: `vote-${i}` };
			});
		}

		const average = stats.average || 0;
		const average2D =
			stats.average_2d &&
			stats.average_2d.length === 2 &&
			(stats.average_2d[0] !== 0 || stats.average_2d[1] !== 0)
				? stats.average_2d
				: null;
		const stdDev = stats.std_dev || 0;

		// Get the new statistics
		const medianX = stats.median_x !== undefined ? stats.median_x : 0;
		const medianY = stats.median_y !== undefined ? stats.median_y : 0;
		const modeX = stats.mode_x || 0;
		const modeY = stats.mode_y || 0;
		const rangeX = stats.range_x || 0;
		const rangeY = stats.range_y || 0;

		return {
			poll: chartPoll,
			positions,
			positions2D,
			average,
			average2D,
			stdDev,
			medianX,
			medianY,
			modeX,
			modeY,
			rangeX,
			rangeY,
			lowerBound: Math.max(0, average - 1.5 * stdDev),
			upperBound: Math.min(1, average + 1.5 * stdDev)
		};
	}

	$: chartData = renderChart(selectedPoll);
</script>

<div class="theme-transition flex min-h-[calc(100vh-5rem)]" style="background-color: var(--bg);">
	<!-- Collapsible Poll List -->
	{#if showPollList}
		<div
			class="theme-transition relative flex h-[calc(100vh-5rem)] w-80 flex-col border-r border-white/10 md:w-96"
			style="background-color: var(--bg);"
			transition:slide
		>
			<div class="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
				<div class="text-sm font-semibold text-white/70">Polls</div>
				<button
					class="p-1 text-white/60 active:scale-95"
					on:click={() => togglePollList(false)}
					aria-label="Hide poll list"
				>
					<span class="material-symbols-outlined text-xl">close</span>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto" id="poll-list-scroll">
				{#if error}
					<div class="mb-4 border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
						{error}
					</div>
				{/if}

				{#if loading}
					<div class="py-8 text-center">
						<LoadingIndicator size="md" />
					</div>
				{:else if polls.length === 0}
					<div class="py-8 text-center">
						<p class="text-white/70">No polls yet. Create the first one!</p>
					</div>
				{:else}
					<div class="overflow-hidden">
						{#each polls as poll (poll.id)}
							<div
								class="hover:border-accent cursor-pointer border-2 border-transparent bg-white/10 p-6 backdrop-blur transition-all duration-300 hover:bg-white/20"
								class:bg-accent={selectedPoll?.id === poll.id}
								on:click={() => handlePollClick(poll)}
								on:keydown={(e) => e.key === 'Enter' && handlePollClick(poll)}
								role="button"
								tabindex="0"
							>
								<h3 class="mb-2 text-xl font-bold text-white">{poll.title}</h3>
								<div class="mb-4 text-sm text-white/70">
									{poll.response_type} options • {poll.stats?.total_votes || 0} votes
								</div>

								<div class="flex flex-wrap gap-2 overflow-hidden text-xs">
									{#each poll.options as option, i (i)}
										<span
											class="flex flex-shrink-0 items-center space-x-1 bg-white/10 px-2 py-1 text-white/80"
										>
											{#if poll.gradients?.colors?.[i]}
												<div
													class="h-2 w-2 border border-white/30"
													style="background-color: {poll.gradients.colors[i]}"
												></div>
											{/if}
											<span class="font-normal text-white/50">{option}</span>
										</span>
									{/each}
								</div>

								{#if poll.stats?.total_votes && poll.stats.total_votes > 0}
									<div class="mt-4 text-sm text-white/60">
										Avg: {(poll.stats.average * 100).toFixed(1)}%
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<!-- Add Button -->
			<button
				on:click={openCreateModal}
				class="bg-accent hover:bg-accent/90 absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center text-white shadow-lg transition-all active:scale-95"
				aria-label="Create new poll"
			>
				<span class="material-symbols-outlined text-3xl">add</span>
			</button>
		</div>
	{/if}
	<!-- Chart / Main Area -->
	<div
		class="theme-transition relative flex h-[calc(100vh-5rem)] flex-1 items-center justify-center"
		style="background-color: var(--bg);"
	>
		<!-- Show toggle control when list hidden -->
		{#if !showPollList}
			<button
				class="absolute top-4 left-4 z-20 rounded-md bg-white/10 px-3 py-2 text-xs text-white backdrop-blur hover:bg-white/20 active:scale-95"
				on:click={() => togglePollList(true)}
				aria-label="Show poll list"
			>
				<span class="material-symbols-outlined mr-1 align-middle text-base">menu</span>LIST
			</button>
		{/if}
		<div class="flex h-full w-full items-center justify-center">
			{#if chartData}
				<div
					class="chart-container relative"
					style="--s: min(95vmin, 1100px); height: var(--s); width: var(--s); max-width: 100%; max-height: 100%;"
				>
					<div class="relative h-full w-full overflow-hidden">
						<ChartRenderer {chartData} {onVote} maxPolySize={1100} />
					</div>
				</div>
			{:else}
				<div class="flex h-full w-full items-center justify-center">
					<p class="text-s text-white/50">
						Select a poll to view details (only your vote is shown)
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Poll Detail Sidebar / Sheet -->
	{#if selectedPoll && showSidebar}
		{#if isMobileView}
			<!-- Backdrop -->
			<div
				class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
				on:click={() => toggleSidebar(false)}
				aria-hidden="true"
			></div>
			<div
				class="fixed right-0 bottom-0 left-0 z-40 flex max-h-[70vh] w-full flex-col overflow-hidden rounded-t-2xl bg-gray-900/95 shadow-2xl backdrop-blur-xl"
				on:touchstart={(e) => {
					dragStartY = e.touches[0].clientY;
					dragActive = true;
				}}
				on:touchmove={(e) => {
					if (dragActive) {
						const diff = e.touches[0].clientY - dragStartY;
						if (diff > 60) {
							showSidebar = false;
							dragActive = false;
						}
					}
				}}
				on:touchend={() => {
					dragActive = false;
				}}
			>
				<div class="mx-auto mt-2 mb-3 h-1.5 w-12 rounded-full bg-white/20"></div>
				<div class="flex-1 overflow-y-auto">
					<PollSidebar
						id={selectedPoll.id}
						pollData={selectedPoll}
						showComments={false}
						on:delete={handleSidebarDelete}
						on:likesUpdated={handleLikesUpdated}
					/>
				</div>
			</div>
		{:else}
			<div
				class="relative z-40 flex h-[calc(100vh-5rem)] w-80 flex-col border-l border-white/20 bg-gray-900"
			>
				<PollSidebar
					id={selectedPoll.id}
					pollData={selectedPoll}
					showComments={false}
					on:delete={handleSidebarDelete}
					on:likesUpdated={handleLikesUpdated}
				/>
			</div>
		{/if}
	{/if}

	{#if isMobileView && selectedPoll && !showSidebar && selectedPoll.title}
		<!-- Bottom full-width info bar for mobile to toggle poll sidebar (only shows when sidebar closed and has data) -->
		<button
			on:click={() => toggleSidebar(true)}
			class="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-4 border-t border-white/10 bg-gradient-to-t from-black/85 via-black/70 to-black/60 px-4 py-3 text-left backdrop-blur-md transition-all active:scale-[0.985] active:bg-black/80"
			aria-controls="poll-sidebar"
			aria-expanded="false"
			aria-label="Show poll info"
			style="-webkit-tap-highlight-color: transparent;"
		>
			<div class="flex min-w-0 flex-1 flex-col">
				<div class="truncate text-sm leading-tight font-semibold text-white">
					{selectedPoll.title}
				</div>
				<div
					class="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] tracking-wide text-white/60 uppercase"
				>
					<span class="max-w-[50%] truncate">{selectedPoll?.owner_displayName || 'Anonymous'}</span>
					<div class="flex items-center gap-1">
						<span class="material-symbols-outlined text-accent text-base">how_to_vote</span><span
							>{selectedPoll.stats?.total_votes || 0}</span
						>
					</div>
					{#if selectedPoll.likes !== undefined}
						<div class="flex items-center gap-1">
							<span class="material-symbols-outlined text-accent text-base">favorite</span><span
								>{selectedPoll.likes}</span
							>
						</div>
					{/if}
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
	{:else if isMobileView && !selectedPoll}
		<!-- Skeleton bottom bar when no poll selected yet -->
		<div
			class="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-4 border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-md"
		>
			<div class="flex min-w-0 flex-1 animate-pulse flex-col">
				<div class="h-3 w-36 bg-white/10"></div>
				<div class="mt-2 flex gap-3">
					<div class="h-2 w-14 bg-white/10"></div>
					<div class="h-2 w-10 bg-white/10"></div>
				</div>
			</div>
			<div class="text-accent ml-auto flex items-center gap-2 opacity-50">
				<span class="text-xs font-medium">INFO</span>
				<span class="material-symbols-outlined text-lg">expand_less</span>
			</div>
		</div>
	{/if}

	<!-- Create Poll Modal -->
	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-gray-800 p-8">
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-white">Create New Poll</h2>
					<button class="text-2xl text-white/70 hover:text-white" on:click={closeCreateModal}>
						×
					</button>
				</div>

				{#if createError}
					<div class="mb-6 border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
						{createError}
					</div>
				{/if}

				<!-- Title -->
				<div class="mb-6">
					<label for="poll-title" class="mb-2 block text-sm font-medium text-white/90"
						>Poll Title *</label
					>
					<input
						id="poll-title"
						class="focus:ring-accent w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:outline-none"
						type="text"
						bind:value={poll.title}
						placeholder="What would you like people to vote on?"
					/>
				</div>

				<!-- Poll Form Component -->
				<PollForm
					poll={{
						...poll,
						id: '',
						response_type: poll.responseType,
						options: poll.customOptions,
						stats: { average: 0, std_dev: 0, total_votes: 0, vote_positions: [] },
						user_vote: undefined,
						created_at: '',
						owner: $currentUser?.uid || 'anonymous'
					}}
					{responseTypes}
					onUpdate={(updatedPoll) => (poll = updatedPoll)}
				/>

				<!-- Preview -->
				<div class="mb-8 bg-gray-700/50 p-6">
					<h3 class="mb-4 text-lg font-medium text-white">Preview</h3>
					<div class="space-y-3">
						<div class="text-xl font-bold text-white">
							{poll.title || 'Your poll title will appear here'}
						</div>
						<div class="text-sm text-white/50 italic">Click anywhere on the chart to vote</div>
						<div class="flex items-center space-x-2 text-sm text-white/60">
							<span>{responseTypes.find((t) => t.value === poll.responseType)?.icon}</span>
							<span>{responseTypes.find((t) => t.value === poll.responseType)?.label}</span>
						</div>
						<div class="flex flex-wrap gap-2 text-xs">
							{#each poll.customOptions as option, index (index)}
								<span class="flex items-center space-x-2 bg-white/10 px-3 py-1 text-white/80">
									<div
										class="h-3 w-3 border border-white/30"
										style="background-color: {poll.gradients.colors[index]}"
									></div>
									<span>{option}</span>
								</span>
							{/each}
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between">
					<div class="flex space-x-3">
						<button
							class="bg-gray-600 px-6 py-3 font-bold text-white transition-colors hover:bg-gray-700"
							on:click={closeCreateModal}>Cancel</button
						>
						<button
							class="bg-accent px-6 py-3 font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
							on:click={createPoll}
							disabled={creating || !poll.title.trim()}
						>
							{creating ? 'Creating...' : 'Create Poll'}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pro Upgrade Modal -->

	<!-- Vote Toast Notification -->
	{#if showVoteToast}
		<div
			class="fixed right-6 bottom-6 z-50 bg-green-600 px-4 py-3 text-white shadow-lg transition-all duration-300"
			class:translate-y-0={showVoteToast}
			class:translate-y-full={!showVoteToast}
		>
			<div class="flex items-center space-x-2">
				<span class="material-symbols-outlined text-lg">check_circle</span>
				<span class="font-medium">{voteMessage}</span>
			</div>
		</div>
	{/if}
</div>
