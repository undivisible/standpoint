<script lang="ts">
	import type { PollResponse } from '$lib/types';
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import confetti from 'canvas-confetti';
	import { currentUser, userGroup } from '$lib/stores';
	import { get } from 'svelte/store';
	import { addToast } from '$lib/toast';
	import LoginModal from '../components/login-modal.svelte';
	import { signInWithGoogle } from '$lib/stores';

	let likeBtn: HTMLButtonElement | null = null;
	let likeHover = false;

	export let title: string = '';
	export let date: string = '';
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let pollData: PollResponse | null = null;
	export const showComments: boolean = true;

	let showLogin = false;
	let likeLoading = false;
	let copied = false;
	let commentText = '';
	let commentsList: Array<{
		id: string;
		text: string;
		createdAt: Date;
		userId: string;
		userDisplayName: string;
		userPhotoURL: string;
	}> = [];
	let comments = 0;
	let commentPostHover = false;
	let unsubscribeComments: (() => void) | null = null;
	let unsubscribeLikes: (() => void) | null = null;
	let likes = 0;
	let liked = false;

	function openLogin() {
		showLogin = true;
	}
	function promptLogin() {
		addToast('Please sign in to interact with polls', 'info');
		showLogin = true;
	}
	function handleClose() {
		showLogin = false;
	}
	async function handleLogin() {
		await signInWithGoogle();
		showLogin = false;
		location.reload();
	}

	let currentPollId = '';
	$: pollId =
		typeof id === 'string' || typeof id === 'number'
			? id.toString()
			: pollData?.id?.toString() || '';
	$: if (pollId && pollId !== currentPollId) {
		if (unsubscribeLikes) {
			unsubscribeLikes();
			unsubscribeLikes = null;
		}
		if (unsubscribeComments) {
			unsubscribeComments();
			unsubscribeComments = null;
		}
		// Reset like state when poll changes
		likes = 0;
		liked = false;
		currentPollId = pollId;
		loadLikes();
		loadComments();
	}

	onMount(() => {
		if (pollId && !unsubscribeLikes) {
			currentPollId = pollId;
			loadLikes();
		}
		if (pollId && !unsubscribeComments) {
			loadComments();
		}
	});

	onDestroy(() => {
		if (unsubscribeComments) {
			unsubscribeComments();
		}
		if (unsubscribeLikes) {
			unsubscribeLikes();
		}
	});

	async function loadLikes() {
		let pollId = typeof id === 'string' || typeof id === 'number' ? id.toString() : '';
		if (
			!pollId &&
			pollData &&
			(typeof pollData.id === 'string' || typeof pollData.id === 'number')
		) {
			pollId = pollData.id.toString();
		}
		if (!pollId) return;
		const user = get(currentUser);
		const response = await fetch(
			`/api/cloudflare/polls/${pollId}/likes${user ? `?userId=${encodeURIComponent(user.uid)}` : ''}`
		);
		if (!response.ok) return;
		const data = await response.json();
		likes = data.count || 0;
		liked = Boolean(data.liked);
		unsubscribeLikes = null;
	}

	async function handleLike(event?: Event) {
		if (likeLoading) {
			addToast('Like action is still processing. Please wait.', 'info');
			return;
		}
		const user = get(currentUser);
		let pollId = typeof id === 'string' || typeof id === 'number' ? id.toString() : '';
		if (
			!pollId &&
			pollData &&
			(typeof pollData.id === 'string' || typeof pollData.id === 'number')
		) {
			pollId = pollData.id.toString();
		}
		const userId = user && user.uid ? user.uid.toString() : '';
		if (!userId || !pollId) {
			addToast('Missing poll or user information. Please sign in and try again.', 'error');
			console.warn('handleLike: missing userId or pollId', { userId, pollId });
			return;
		}
		likeLoading = true;
		try {
			if (liked) {
				const response = await fetch(
					`/api/cloudflare/polls/${pollId}/likes?userId=${encodeURIComponent(userId)}`,
					{ method: 'DELETE' }
				);
				if (!response.ok) throw new Error(await response.text());
				const data = await response.json();
				likes = data.count || 0;
				liked = false;
				addToast('Removed like', 'success');
			} else {
				const response = await fetch(`/api/cloudflare/polls/${pollId}/likes`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ userId })
				});
				if (!response.ok) throw new Error(await response.text());
				const data = await response.json();
				likes = data.count || 0;
				liked = true;
				addToast('Liked poll!', 'success');
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
			if (pollData) {
				pollData = { ...pollData };
			}
		} catch (error) {
			console.error('Error toggling like:', error);
			addToast(
				'Failed to update like: ' +
					(typeof error === 'object' && error !== null && 'message' in error
						? (error as any).message
						: String(error)),
				'error'
			);
		} finally {
			likeLoading = false;
		}
	}

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
		return d
			? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
			: 'Invalid date';
	}

	const dispatch = createEventDispatcher();

	function getResponseTypeName(responseType: number) {
		const names: Record<number, string> = {
			2: 'Line Scale',
			3: 'Triangle',
			4: 'Square',
			5: 'Pentagon'
		};
		return names[responseType] || 'Unknown';
	}

	function computeOptionProximity() {
		if (!pollData) return null;
		// 1D line (two options)
		if (pollData.response_type === 2) {
			const votes: number[] = pollData.stats?.vote_positions || pollData.stats?.positions || [];
			if (!Array.isArray(votes) || !votes.length) return null;
			let sumLeft = 0;
			let sumRight = 0;
			votes.forEach((v) => {
				if (typeof v === 'number') {
					sumRight += v; // closeness to right endpoint (1)
					sumLeft += 1 - v; // closeness to left endpoint (0)
				}
			});
			const total = sumLeft + sumRight || 1;
			return [sumLeft / total, sumRight / total];
		}
		// 2D shapes
		if (pollData.response_type >= 3 && pollData.stats?.vote_positions_2d) {
			const pts = pollData.stats.vote_positions_2d as Array<{ x: number; y: number }>;
			if (!pts.length) return null;
			// Recreate shape points exactly as in chart renderer
			let shape: Array<{ x: number; y: number }> = [];
			if (pollData.response_type === 3) {
				shape = [
					{ x: 0.5, y: 0.1 },
					{ x: 0.1, y: 0.9 },
					{ x: 0.9, y: 0.9 }
				];
			} else if (pollData.response_type === 4) {
				shape = [
					{ x: 0.1, y: 0.1 },
					{ x: 0.9, y: 0.1 },
					{ x: 0.9, y: 0.9 },
					{ x: 0.1, y: 0.9 }
				];
			} else if (pollData.response_type === 5) {
				const cx = 0.5,
					cy = 0.5,
					r = 0.45;
				shape = Array.from({ length: 5 }, (_, i) => {
					const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
					return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
				});
			}
			// Edge midpoints correspond to option labels in chart
			const anchors = shape.map((p, i) => {
				const n = shape[(i + 1) % shape.length];
				return { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 };
			});
			if (!anchors.length) return null;
			const sums = new Array(anchors.length).fill(0);
			const EPS = 0.0001;
			pts.forEach((p) => {
				let weights: number[] = [];
				let totalW = 0;
				anchors.forEach((a, idx) => {
					const dx = a.x - p.x;
					const dy = a.y - p.y;
					const d = Math.sqrt(dx * dx + dy * dy);
					const w = 1 / (d + EPS);
					weights[idx] = w;
					totalW += w;
				});
				if (totalW) weights.forEach((w, idx) => (sums[idx] += w / totalW));
			});
			const voteCount = pts.length || 1;
			let proximities = sums.map((s) => s / voteCount);
			// If options length differs, map proportionally
			if (pollData.options.length && pollData.options.length !== proximities.length) {
				const mapped: number[] = [];
				for (let i = 0; i < pollData.options.length; i++) {
					const from = (i / pollData.options.length) * proximities.length;
					const i0 = Math.floor(from) % proximities.length;
					mapped.push(proximities[i0]);
				}
				proximities = mapped;
			}
			return proximities;
		}
		return null;
	}
	let derivedOptionProximity: number[] | null = null;
	// Force reload derived stats when pollData changes (using a key)
	$: pollKey = pollData ? JSON.stringify({ id: pollData.id, created: pollData.created_at }) : '';
	$: if (pollKey) {
		derivedOptionProximity =
			pollData?.stats?.option_proximity &&
			pollData.stats.option_proximity.length === pollData.options.length
				? pollData.stats.option_proximity
				: computeOptionProximity();
		nonLineDistribution = computeNonLineDistributionSummary();
		average2D = getAverage2DFallback();
	}

	// Basic aggregate for non-line charts to emulate a distribution metric: use average distance to polygon center.
	function computeNonLineDistributionSummary() {
		if (!pollData || pollData.response_type < 3) return null;
		const pts = (pollData.stats?.vote_positions_2d || []) as Array<{ x: number; y: number }>;
		if (!pts.length) return { meanDist: 0 };
		const cx = pollData.stats.average_2d?.[0] ?? pts.reduce((a, p) => a + p.x, 0) / pts.length;
		const cy = pollData.stats.average_2d?.[1] ?? pts.reduce((a, p) => a + p.y, 0) / pts.length;
		let sum = 0;
		pts.forEach((p) => {
			const dx = p.x - cx;
			const dy = p.y - cy;
			sum += Math.sqrt(dx * dx + dy * dy);
		});
		const meanDist = sum / pts.length;
		return { meanDist };
	}
	// Fallback for average_2d if missing or zero
	function getAverage2DFallback() {
		if (
			pollData?.stats?.average_2d &&
			pollData.stats.average_2d.length === 2 &&
			pollData.stats.average_2d.some((v) => v > 0)
		) {
			return pollData.stats.average_2d;
		}
		const pts = pollData?.stats?.vote_positions_2d as Array<{ x: number; y: number }>;
		if (pts && pts.length) {
			const sx = pts.reduce((a, p) => a + p.x, 0);
			const sy = pts.reduce((a, p) => a + p.y, 0);
			return [sx / pts.length, sy / pts.length];
		}
		return [0.5, 0.5];
	}
	$: nonLineDistribution = computeNonLineDistributionSummary();
	$: average2D = getAverage2DFallback();

	function calculateConfidenceInterval(average: number, stdDev: number, totalVotes: number) {
		if (totalVotes === 0 || !average || !stdDev || isNaN(average) || isNaN(stdDev)) {
			return { lower: 0, upper: 0 };
		}
		const margin = (1.96 * stdDev) / Math.sqrt(totalVotes);
		return {
			lower: Math.max(0, average - margin),
			upper: Math.min(1, average + margin)
		};
	}

	function getConsensusLevel(stdDev: number) {
		if (stdDev < consensusThreshold * 0.5) return 'Very Strong';
		if (stdDev < consensusThreshold) return 'Strong';
		if (stdDev < consensusThreshold * 1.5) return 'Moderate';
		if (stdDev < consensusThreshold * 2) return 'Weak';
		return 'No Consensus';
	}

	function getVariabilityLevel(stdDev: number) {
		if (stdDev < variabilityThreshold * 0.5) return 'Very Low';
		if (stdDev < variabilityThreshold) return 'Low';
		if (stdDev < variabilityThreshold * 1.5) return 'Medium';
		return 'High';
	}

	function getEngagementLevel(totalVotes: number) {
		if (totalVotes < engagementThreshold * 0.5) return 'Very Low';
		if (totalVotes < engagementThreshold) return 'Low';
		if (totalVotes < engagementThreshold * 2) return 'Medium';
		return 'High';
	}

	function copyLink() {
		if (navigator.clipboard && shareUrl) {
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					copied = true;
					setTimeout(() => {
						copied = false;
					}, 2000);
				})
				.catch(() => {});
		}
	}

	// Comments functionality
	async function addComment() {
		if (!$currentUser || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			// Add comment to Firebase
			const response = await fetch(`/api/cloudflare/polls/${id.toString()}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					text: commentText.trim(),
					userId: $currentUser.uid,
					userDisplayName: $currentUser.displayName || 'Anonymous',
					userPhotoURL: $currentUser.photoURL || ''
				})
			});
			if (!response.ok) throw new Error(await response.text());

			commentText = '';
			addToast('Comment added!', 'success');
			loadComments();
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		}
	}

	// Load comments from Firebase when component mounts
	async function loadComments() {
		let pollId = typeof id === 'string' || typeof id === 'number' ? id.toString() : '';
		if (
			!pollId &&
			pollData &&
			(typeof pollData.id === 'string' || typeof pollData.id === 'number')
		) {
			pollId = pollData.id.toString();
		}
		if (!pollId) return;

		const response = await fetch(`/api/cloudflare/polls/${pollId}/comments`);
		if (!response.ok) return;
		const data = await response.json();
		commentsList = (data.items || []).map((item: any) => ({
			id: item.id,
			text: item.text,
			createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
			userId: item.userId,
			userDisplayName: item.userDisplayName || 'Anonymous',
			userPhotoURL: item.userPhotoURL || ''
		}));
		comments = commentsList.length;
		unsubscribeComments = null;
	}

	async function deleteComment(commentId: string) {
		if (!$currentUser) return;

		try {
			const commentData = commentsList.find((comment) => comment.id === commentId);
			if (!commentData) return;
			if (commentData.userId !== $currentUser.uid && $userGroup !== 'dev') {
				addToast('You can only delete your own comments', 'error');
				return;
			}

			const response = await fetch(`/api/cloudflare/comments/${commentId}`, { method: 'DELETE' });
			if (!response.ok) throw new Error(await response.text());
			addToast('Comment deleted', 'success');
			loadComments();
		} catch (error) {
			console.error('Error deleting comment:', error);
			addToast('Failed to delete comment', 'error');
		}
	}

	$: hasVotes = (pollData?.stats?.total_votes ?? 0) > 0;

	// Default slider values
	let consensusThreshold = 0.2;
	let variabilityThreshold = 0.3;
	let engagementThreshold = 10;
</script>

<div
	class="flex h-full min-h-0 flex-col overflow-y-auto p-6 text-white"
	style="background: rgba(var(--primary), 0.12);"
>
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center">
			<!-- Interaction buttons-->
			<div class="ml-auto flex items-center space-x-2">
				{#if $currentUser}
					<span class="text-sm font-bold text-white" title="Total likes">{likes}</span>
					<button
						class="flex h-10 w-10 items-center justify-center transition-colors duration-200 {liked
							? 'bg-red-600 text-white hover:bg-red-700'
							: 'bg-[color:var(--primary)] text-[color:var(--primary-light)] hover:bg-[color:var(--primary)]/80'}"
						on:click={handleLike}
						title={liked ? 'Unlike' : 'Like'}
						aria-label={liked ? 'Unlike this poll' : 'Like this poll'}
						disabled={likeLoading}
						bind:this={likeBtn}
					>
						<span class="material-symbols-outlined text-lg"
							>{liked ? 'favorite' : 'favorite_border'}</span
						>
					</button>
				{:else}
					<button
						class="bg-blue-600 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-blue-700"
						on:click={promptLogin}
					>
						Login to interact
					</button>
				{/if}
			</div>
		</div>
		<h1 class="mb-4 text-2xl font-bold break-words">{pollData?.title || title}</h1>

		<div class="mb-6 text-sm" style="color: var(--primary-light);">
			{formatDateSafe(pollData?.created_at || date)}
		</div>

		<!-- Poll Statistics Section -->
		{#if pollData}
			<!-- User Vote Status -->
			{#if !$currentUser}
				<div class="mb-4 border border-red-700/50 bg-red-800/30 p-3">
					<div class="mb-2 flex items-center space-x-2">
						<span class="material-symbols-outlined text-sm text-red-400">login</span>
						<span class="text-sm font-medium text-red-300">Login required</span>
					</div>
					<div class="text-xs text-red-200">Please log in before you can vote on this poll.</div>
					<div class="mt-1">
						<button
							class="bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
							on:click={promptLogin}
						>
							Log in to vote
						</button>
					</div>
				</div>
			{:else if pollData.user_vote !== undefined && pollData.user_vote !== null}
				<div class="mb-4 border border-green-700/50 bg-green-800/30 p-3">
					<div class="mb-2 flex items-center space-x-2">
						<span class="material-symbols-outlined text-sm text-green-400">check_circle</span>
						<span class="text-sm font-medium text-green-300">You've voted!</span>
					</div>
					<div class="text-xs text-green-200">
						Your vote: {pollData.user_vote !== undefined
							? (pollData.user_vote * 100).toFixed(1)
							: '0'}%
						{#if pollData.user_vote_2d}
							(Position: {(pollData.user_vote_2d.x * 100).toFixed(1)}%, {(
								pollData.user_vote_2d.y * 100
							).toFixed(1)}%)
						{/if}
					</div>
					<div class="mt-1 text-xs text-green-300">
						Click anywhere on the chart to update your vote
					</div>
				</div>
			{:else}
				<div class="mb-4 border border-blue-700/50 bg-blue-800/30 p-3">
					<div class="mb-2 flex items-center space-x-2">
						<span class="material-symbols-outlined text-sm text-blue-400">how_to_vote</span>
						<span class="text-sm font-medium text-blue-300">Ready to vote?</span>
					</div>
					<div class="text-xs text-blue-200">Click anywhere on the chart to cast your vote</div>
				</div>
			{/if}

			<div class="mb-6 p-4" style="background: rgba(var(--primary), 0.12);">
				<h3 class="mb-4 text-lg font-semibold" style="color: var(--primary-light);">
					Poll Statistics
				</h3>

				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class="p-3 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-2xl font-bold text-white">{pollData.stats.total_votes}</div>
						<div class="text-xs" style="color: var(--primary-light);">Total Votes</div>
					</div>
					<div class="p-3 text-center" style="background: rgba(var(--primary), 0.04);">
						<div class="text-lg font-bold text-white">
							{getResponseTypeName(pollData.response_type)}
						</div>
						<div class="text-xs" style="color: var(--primary-light);">Response Type</div>
					</div>
				</div>

				{#if hasVotes}
					<!-- Central Tendency Measures -->
					<div class="mb-4">
						<div class="mb-2 text-sm font-semibold" style="color: var(--primary-light);">
							Vote Distribution
						</div>
						<div class="p-3" style="background: rgba(var(--primary), 0.04);">
							<div class="mb-2 text-sm font-bold text-white">
								{#if pollData.response_type === 2}
									{pollData.stats.average !== undefined
										? (pollData.stats.average * 100).toFixed(1)
										: '0'}% Average
								{:else}
									<span class="font-bold text-white">X:</span>
									<span class="text-white/90"
										>{average2D?.[0] !== undefined ? (average2D[0] * 100).toFixed(1) : '0'}%</span
									>
									<span class="ml-2 font-bold text-white">Y:</span>
									<span class="text-white/90"
										>{average2D?.[1] !== undefined ? (average2D[1] * 100).toFixed(1) : '0'}%</span
									>
									{#if nonLineDistribution}
										<span class="ml-4 text-xs font-normal text-white/60"
											>Spread {(nonLineDistribution.meanDist * 100).toFixed(1)}%</span
										>
									{/if}
								{/if}
							</div>
							<div class="mb-2 text-xs" style="color: rgb(var(--primary-light-rgb));">
								Total Votes: {pollData.stats.total_votes}
							</div>
							{#if pollData.stats.std_dev !== undefined}
								<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">
									Consensus Level: {getConsensusLevel(pollData.stats.std_dev)}
								</div>
							{/if}
						</div>
					</div>

					<!-- Options -->
					<div class="mb-4">
						<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">Options</div>
						<div class="space-y-2">
							{#if pollData && pollData.options && pollData.options.length > 0}
								{@const optionValues =
									pollData.stats?.option_proximity &&
									pollData.stats.option_proximity.length === pollData.options.length
										? pollData.stats.option_proximity
										: derivedOptionProximity || []}
								{@const total = optionValues.reduce((a: number, b: number) => a + b, 0) || 1}
								{#each pollData.options as option, i (option)}
									{@const value = optionValues[i] || 0}
									{@const percent = total ? (value / total) * 100 : 0}
									<div
										class="flex items-center gap-2 p-3"
										style="background: rgba(var(--primary), 0.04);"
									>
										<span class="flex-1">{option}</span>
										<span class="text-xs font-medium text-white">{percent.toFixed(1)}%</span>
										<div class="relative h-2 w-32 overflow-hidden bg-white/10">
											<div
												class="h-2"
												style="background: rgb(var(--primary-light-rgb)); width: {percent}%; transition: width 0.4s ease;"
											></div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>

					<!-- Confidence Interval -->
					{#if pollData.stats.total_votes > 1 && pollData.stats.average !== undefined && pollData.stats.std_dev !== undefined && !isNaN(pollData.stats.average) && !isNaN(pollData.stats.std_dev)}
						{@const ci = calculateConfidenceInterval(
							pollData.stats.average,
							pollData.stats.std_dev,
							pollData.stats.total_votes
						)}
						{#if !isNaN(ci.lower) && !isNaN(ci.upper)}
							<div class="mb-4">
								<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">
									95% Confidence Interval
								</div>
								<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">
									{(ci.lower * 100).toFixed(1)}% - {(ci.upper * 100).toFixed(1)}%
								</div>
								<div
									class="relative mt-1 h-2 w-full"
									style="background: rgba(var(--primary), 0.18);"
								>
									<div
										class="absolute h-2"
										style="background: rgba(var(--primary-light-rgb),0.5); left: {ci.lower *
											100}%; width: {(ci.upper - ci.lower) * 100}%;"
									></div>
								</div>
							</div>
						{/if}
					{/if}

					<!-- 2D Statistics -->
					{#if pollData.stats.average_2d && pollData.response_type > 2}
						<div class="mb-4">
							<div class="mb-2 text-sm" style="color: rgb(var(--primary-light-rgb));">
								2D Position Statistics
							</div>
							<div class="mb-3 grid grid-cols-2 gap-4">
								<div class="p-3" style="background: rgba(var(--primary), 0.04);">
									<div
										class="mb-2 text-sm font-semibold"
										style="color: rgb(var(--primary-light-rgb));"
									>
										X-Axis
									</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{(pollData.stats.average_2d?.[0] !== undefined
													? pollData.stats.average_2d[0] * 100
													: 0
												).toFixed(1)}%
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Mean</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.median_x !== null && pollData.stats.median_x !== undefined
													? (pollData.stats.median_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">
												Median
											</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.mode_x !== null && pollData.stats.mode_x !== undefined
													? (pollData.stats.mode_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Mode</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.range_x !== null && pollData.stats.range_x !== undefined
													? (pollData.stats.range_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Range</div>
										</div>
									</div>
								</div>
								<div class="p-3" style="background: rgba(var(--primary), 0.04);">
									<div
										class="mb-2 text-sm font-semibold"
										style="color: rgb(var(--primary-light-rgb));"
									>
										Y-Axis
									</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{(pollData.stats.average_2d?.[1] !== undefined
													? pollData.stats.average_2d[1] * 100
													: 0
												).toFixed(1)}%
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Mean</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.median_y !== null && pollData.stats.median_y !== undefined
													? (pollData.stats.median_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">
												Median
											</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.mode_y !== null && pollData.stats.mode_y !== undefined
													? (pollData.stats.mode_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Mode</div>
										</div>
										<div class="p-2 text-center" style="background: rgba(var(--primary), 0.02);">
											<div class="text-sm font-bold text-white">
												{pollData.stats.range_y !== null && pollData.stats.range_y !== undefined
													? (pollData.stats.range_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">Range</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Comments Section -->
		<div class="mb-6 p-4" style="background: rgba(var(--primary), 0.08);">
			<h3 class="mb-4 text-lg font-semibold" style="color: rgb(var(--primary-light-rgb));">
				Comments ({comments})
			</h3>

			<!-- Add Comment Form -->
			<div class="mb-4">
				<textarea
					bind:value={commentText}
					placeholder="Add a comment..."
					class="w-full px-3 py-2 text-white focus:outline-none"
					style="border: 1px solid var(--primary); background: rgba(var(--primary), 0.12); color: rgb(var(--primary-light-rgb));"
					rows="3"
					disabled={!get(currentUser)}
				></textarea>
				<div class="mt-2 flex items-center justify-between">
					{#if !$currentUser}
						<p class="text-xs" style="color: rgb(var(--primary));">Sign in to comment</p>
					{:else}
						<p class="text-xs" style="color: rgb(var(--primary));">
							{commentText.length}/500 characters
						</p>
					{/if}
					<button
						on:click={addComment}
						disabled={!get(currentUser) || !commentText.trim() || commentText.length > 500}
						class="px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
						style="background: {commentPostHover
							? 'rgba(var(--primary-light),0.5)'
							: 'var(--primary)'}; color: var(--primary-light);"
						on:mouseover={() => (commentPostHover = true)}
						on:mouseleave={() => (commentPostHover = false)}
						on:focus={() => (commentPostHover = true)}
						on:blur={() => (commentPostHover = false)}
					>
						Post
					</button>
				</div>
			</div>

			<!-- Comments List -->
			{#if commentsList.length > 0}
				<div class="max-h-80 space-y-4 overflow-y-auto">
					{#each commentsList as comment (comment.id)}
						<div class="p-3" style="background: rgba(var(--primary), 0.12);">
							<div class="mb-2 flex justify-between">
								<div class="flex items-center">
									{#if comment.userPhotoURL}
										<img
											src={comment.userPhotoURL}
											alt={comment.userDisplayName}
											class="mr-2 h-8 w-8"
										/>
									{:else}
										<div
											class="mr-2 flex h-8 w-8 items-center justify-center"
											style="background: rgba(var(--primary), 0.12);"
										>
											<span class="text-sm text-white"
												>{comment.userDisplayName?.charAt(0) || 'A'}</span
											>
										</div>
									{/if}
									<div>
										<div class="text-sm font-medium" style="color: rgb(var(--primary-light-rgb));">
											{comment.userDisplayName}
										</div>
										<div class="text-xs" style="color: rgb(var(--primary-light-rgb));">
											{comment.createdAt.toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})}
										</div>
									</div>
								</div>
								{#if $currentUser && ($currentUser.uid === comment.userId || $userGroup === 'dev')}
									<button
										on:click={() => deleteComment(comment.id)}
										class="hover:text-white"
										style="color: rgb(var(--primary-light-rgb));"
										title="Delete comment"
									>
										<span class="material-symbols-outlined text-sm">delete</span>
									</button>
								{/if}
							</div>
							<p
								class="overflow-auto text-sm break-words text-white"
								style="max-height: 6em; word-break: break-word; white-space: pre-line;"
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

		<!-- Bottom section with link and delete -->
		<div class="sticky bottom-0 mt-auto border-t" style="border-color: var(--primary, #6c3fcf);">
			<div class="flex items-end justify-between">
				<!-- Copyable link at bottom left -->
				<button
					class="flex-1 truncate pr-4 text-left text-sm transition-colors hover:text-white"
					style="color: rgb(var(--primary-light-rgb));"
					on:click={copyLink}
					title="Click to copy link"
				>
					{shareUrl}
				</button>
			</div>
		</div>
	</div>
</div>
