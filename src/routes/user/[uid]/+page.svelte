<script lang="ts">
	function normalizeDate(input: any): Date | null {
		if (!input) return null;
		if (typeof input === 'number' || typeof input === 'string') {
			const d = new Date(input);
			return isNaN(d.getTime()) ? null : d;
		}
		if (typeof input.toDate === 'function') {
			const d = input.toDate();
			return isNaN(d.getTime()) ? null : d;
		}
		return null;
	}

	function formatDateFull(input: any): string {
		const d = normalizeDate(input);
		if (!d) return 'Invalid date';
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);
		if (diffHour < 24) {
			if (diffHour >= 1) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
			if (diffMin >= 1) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
			return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
		}
		return d.toLocaleDateString(undefined, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
	// Core Svelte and SvelteKit imports
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	// Library imports
	import { currentUser } from '$lib';
	import { addToast } from '$lib/toast';
	import { getUserBadges, type UserStats, type Badge } from '../../../lib/badges.js';
	import { fadeImage } from '$lib/fadeImage';
	import {
		updateUserProfile,
		type UserProfile,
		followUser,
		unfollowUser,
		isFollowing
	} from '../../../lib/user-profile.js';
	import type { TierlistData, PollData } from '../../../lib/firestore-polls-tierlists.js';

	// Component imports
	import Toast from '../../../components/toast.svelte';
	import Modal from '../../../components/modal.svelte';

	// Type definitions
	interface PageData {
		userProfile: UserProfile;
		followerCount: number;
		followingCount: number;
		userTierlists: TierlistData[];
		userPolls: PollData[];
		requestedUid: string;
		resolvedUid: string;
	}

	// Component props and state
	export let data: PageData;

	// Destructure data with proper types and defaults
	$: userProfile = data?.userProfile;
	$: followerCount = data?.followerCount ?? 0;
	$: followingCount = data?.followingCount ?? 0;
	$: userTierlists = data?.userTierlists ?? [];
	$: userPolls = data?.userPolls ?? [];
	$: requestedUid = data?.requestedUid;
	$: resolvedUid = data?.resolvedUid;
	$: profileHandle = userProfile?.customUid || resolvedUid;

	// If the requested UID is different from the resolved UID, this is a redirect profile
	$: isRedirectProfile = requestedUid && resolvedUid && requestedUid !== resolvedUid;

	// Authentication and permission checks
	$: user = $currentUser;
	$: isOwnProfile = user?.uid === userProfile?.uid;
	$: isOwnRedirectedProfile = isOwnProfile || (isRedirectProfile && resolvedUid === user?.uid);

	// Component state variables
	let isFollowingUser = false;
	let followLoading = false;
	let selectedTab = 'creations';
	let editingField = '';
	let editingValue = '';
	let saving = false;

	// Check if current user is following this profile
	$: if (user && userProfile && !isOwnProfile) {
		isFollowing(user.uid, userProfile.uid)
			.then((following) => {
				isFollowingUser = following;
			})
			.catch((error) => {
				console.error('Error checking follow status:', error);
			});
	}

	// Toggle follow/unfollow functionality
	async function toggleFollow() {
		if (!user || !userProfile || isOwnProfile || followLoading) return;

		try {
			followLoading = true;
			const action = isFollowingUser ? unfollowUser : followUser;
			await action(user.uid, userProfile.uid);
			isFollowingUser = !isFollowingUser;
			if (isFollowingUser) {
				followerCount += 1;
			} else if (followerCount > 0) {
				followerCount -= 1;
			}
			addToast(isFollowingUser ? 'Following user' : 'Unfollowed user', 'success');
		} catch (error) {
			console.error('Error toggling follow:', error);
			addToast('Failed to update follow status', 'error');
		} finally {
			followLoading = false;
		}
	}

	// Redirect to canonical UID if needed
	onMount(() => {
		if (requestedUid && resolvedUid && requestedUid !== resolvedUid) {
			goto(`/user/${resolvedUid}`);
		}
	});

	// Utility function for number formatting
	const formatNumber = (num: number | undefined): string => {
		const value = num ?? 0;
		if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
		if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
		return value.toString();
	};

	// User statistics with proper error handling
	$: stats = {
		aura: userProfile?.aura ?? 0,
		followers: formatNumber(followerCount),
		following: formatNumber(followingCount),
		creations: formatNumber(userProfile?.tierlistsCreated),
		polls: formatNumber(userProfile?.pollsCreated),
		likes: formatNumber(userProfile?.totalLikes),
		comments: formatNumber(userProfile?.totalComments),
		forks: formatNumber(userProfile?.totalForks)
	};

	// Profile editing functionality
	function startEdit(field: string, currentValue: string) {
		if (!isOwnProfile) return;
		editingField = field;
		editingValue = currentValue || '';
	}

	function cancelEdit() {
		editingField = '';
		editingValue = '';
	}

	async function saveField(field: string) {
		if (!userProfile || !isOwnProfile || saving) return;

		try {
			saving = true;
			await updateUserProfile(userProfile.uid, { [field]: editingValue });

			// Update local state optimistically
			userProfile = { ...userProfile, [field]: editingValue };

			addToast('Profile updated successfully', 'success');
			cancelEdit();
		} catch (error) {
			console.error(`Error updating ${field}:`, error);
			addToast(`Failed to update ${field}`, 'error');
		} finally {
			saving = false;
		}
	}

	function handleKeydown(event: KeyboardEvent, field: string) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveField(field);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEdit();
		}
	}

	// User badges calculation
	$: userBadges = userProfile
		? getUserBadges({
				aura: userProfile.aura || 0,
				followers: followerCount || 0,
				following: followingCount || 0,
				pollsCreated: userProfile.pollsCreated || 0,
				tierlistsCreated: userProfile.tierlistsCreated || 0,
				pro: userProfile.group === 'pro' || userProfile.group === 'dev',
				dev: userProfile.group === 'dev',
				accountAge: userProfile.createdAt
					? Math.floor((Date.now() - userProfile.createdAt) / (1000 * 60 * 60 * 24))
					: 0
			} as UserStats)
		: [];

	$: bannerStyle = userProfile?.bannerURL
		? `background-image: url('${userProfile.bannerURL}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
		: 'background: linear-gradient(135deg, #ff5705 0%, #8b5cf6 100%);';
</script>

<svelte:head>
	<title>{userProfile?.displayName || 'User Profile'} - Standpoint</title>
</svelte:head>

<div
	class="theme-transition flex min-h-screen flex-col"
	style="background-color: var(--bg); color: var(--text);"
>
	{#if userProfile}
		<!-- Profile Header Section -->
		<div class="relative w-full">
			<!-- Banner and Profile Picture Container -->
			<div class="relative m-0 flex h-60 w-full overflow-hidden p-0">
				<div class="absolute inset-0 z-0 h-full w-full">
					{#if userProfile.bannerURL}
						<img
							use:fadeImage
							src={userProfile.bannerURL}
							alt="Banner"
							class="sp-fade-image h-full w-full object-cover"
							style="opacity:0.5;"
						/>
					{:else}
						<div
							class="absolute inset-0 z-0 h-full w-full"
							style="background-color: var(--bg); opacity: 0.3;"
						></div>
					{/if}
				</div>
				<div
					class="relative z-20 flex h-full flex-shrink-0 items-center justify-start"
					style="margin:0;padding:0;width:15rem;min-width:15rem;"
				>
					<img
						use:fadeImage
						src={userProfile.photoURL ||
							`https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || 'Anonymous')}&size=200&background=ff5705&color=fff`}
						alt="{userProfile.displayName || 'User'} Profile"
						class="sp-fade-image aspect-square h-full w-full object-cover shadow-2xl"
					/>
				</div>
				<!-- Info -->
				<div class="relative z-20 grid h-full flex-1 grid-cols-2 grid-rows-2 gap-2 p-6">
					<div class="col-start-1 row-start-2 flex flex-col items-start justify-end">
						<!-- Badges -->
						{#if userBadges.length > 0}
							<div class="mb-2 flex flex-wrap gap-3">
								{#each userBadges.slice(0, 4) as badge}
									<div
										class="theme-transition flex items-center gap-1.5 border px-3 py-1.5 text-sm"
										style="background: {badge.color &&
										badge.color.startsWith &&
										badge.color.startsWith('linear')
											? badge.color
											: 'var(--surface)'}; color: var(--text); border-color: {badge.borderColor ||
											'var(--border)'}"
										title={badge.description}
									>
										<span>{badge.icon}</span>
										<span class="font-medium">{badge.name}</span>
									</div>
								{/each}
							</div>
						{/if}
						<!-- Username (UID) -->
						<div
							class="theme-transition mb-1 font-mono text-xs"
							style="color: var(--text-secondary);"
						>
							@{profileHandle}
						</div>
						<!-- Name -->
						<div class="mb-2">
							{#if isOwnProfile && editingField === 'displayName'}
								<input
									type="text"
									bind:value={editingValue}
									on:keydown={(e) => handleKeydown(e, 'displayName')}
									on:blur={() => saveField('displayName')}
									class="font-display theme-transition border-b-2 bg-transparent text-4xl font-bold focus:outline-none"
									style="border-color: rgb(var(--primary)); color: var(--text);"
									placeholder="Enter display name"
								/>
							{:else if isOwnProfile}
								<button
									type="button"
									class="font-display theme-transition cursor-pointer text-left text-4xl font-bold transition-all duration-300"
									style="color: var(--text);"
									on:click={() => startEdit('displayName', userProfile.displayName || '')}
									on:mouseenter={(e) => (e.currentTarget.style.color = 'rgb(var(--primary))')}
									on:mouseleave={(e) => (e.currentTarget.style.color = 'var(--text)')}
									title="Click to edit"
								>
									{userProfile.displayName || 'Anonymous User'}
								</button>
							{:else}
								<h1
									class="font-display theme-transition text-4xl font-bold"
									style="color: var(--text);"
								>
									{userProfile.displayName || 'Anonymous User'}
								</h1>
							{/if}
						</div>
						<!-- Bio -->
						<div>
							{#if isOwnProfile && editingField === 'bio'}
								<textarea
									bind:value={editingValue}
									on:keydown={(e) => handleKeydown(e, 'bio')}
									on:blur={() => saveField('bio')}
									class="font-body theme-transition w-full resize-none border bg-transparent p-2 focus:outline-none"
									style="border-color: var(--border); color: var(--text-secondary); focus:border-color: rgb(var(--primary));"
									placeholder="Tell us about yourself..."
									rows="2"
								></textarea>
							{:else if isOwnProfile}
								<button
									type="button"
									class="font-body theme-transition w-full cursor-pointer text-left text-sm transition-colors"
									style="color: var(--text-secondary);"
									on:click={() => startEdit('bio', userProfile.bio || '')}
									on:mouseenter={(e) => (e.currentTarget.style.color = 'var(--text)')}
									on:mouseleave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
									title="Click to edit"
								>
									{userProfile.bio || 'Click to add a bio...'}
								</button>
							{:else}
								<p
									class="font-body theme-transition text-sm whitespace-pre-line"
									style="color: var(--text-secondary);"
								>
									{userProfile.bio || ''}
								</p>
							{/if}
						</div>
					</div>
					<!-- Stats -->
					<div class="col-start-2 row-start-1 flex flex-row items-start justify-end">
						<div class="flex flex-wrap gap-8">
							{#each [{ value: stats.aura, label: 'aura' }, { value: stats.followers, label: 'followers' }, { value: stats.following, label: 'following' }] as stat}
								<div class="flex items-center gap-2">
									<div class="theme-transition text-2xl font-bold" style="color: var(--text);">
										{stat.value}
									</div>
									<div
										class="theme-transition text-sm tracking-wide uppercase"
										style="color: var(--text-secondary);"
									>
										{stat.label}
									</div>
								</div>
							{/each}
						</div>
					</div>
					<!-- Links -->
					<div class="col-start-2 row-start-2 flex flex-col items-end justify-end">
						<div class="flex items-center gap-4">
							{#each [{ condition: userProfile.website, icon: 'globe', href: userProfile.website?.startsWith('http') ? userProfile.website : `https://${userProfile.website}`, title: 'Website' }, { condition: userProfile.twitter, icon: 'twitter-x', href: `https://twitter.com/${userProfile.twitter}`, title: 'Twitter / X' }, { condition: userProfile.instagram, icon: 'instagram', href: `https://instagram.com/${userProfile.instagram}`, title: 'Instagram' }] as link}
								{#if link.condition}
									<a
										href={link.href}
										target="_blank"
										rel="noopener noreferrer"
										class="theme-transition transition-colors hover:brightness-125"
										style="color: var(--text-secondary);"
										title={link.title}
										aria-label="Visit {link.title.toLowerCase()}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											{#if link.icon === 'globe'}
												<circle cx="12" cy="12" r="10"></circle>
												<line x1="2" x2="22" y1="12" y2="12"></line>
												<path
													d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
												></path>
											{:else if link.icon === 'twitter-x'}
												<path d="M6 6l6 6m0 0l6 6m-6-6l6-6m-6 6l-6 6"></path>
											{:else if link.icon === 'instagram'}
												<rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
												<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
												<line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
											{/if}
										</svg>
									</a>
								{/if}
							{/each}
							{#if userProfile.location}
								<div class="flex items-center gap-1 text-gray-400" title="Location">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
										<circle cx="12" cy="10" r="3"></circle>
									</svg>
									<span class="font-body text-sm">{userProfile.location}</span>
								</div>
							{/if}
						</div>
						{#if !isOwnRedirectedProfile && userProfile}
							<div class="mt-4 flex items-center gap-2">
								<button
									on:click={toggleFollow}
									disabled={followLoading}
									class="theme-transition px-4 py-2 text-sm font-semibold tracking-wide transition-all"
									style={isFollowingUser
										? 'background-color: var(--surface); color: var(--text);'
										: 'background-color: rgb(var(--primary)); color: white;'}
								>
									{followLoading
										? isFollowingUser
											? 'UNFOLLOWING...'
											: 'FOLLOWING...'
										: isFollowingUser
											? 'UNFOLLOW'
											: 'FOLLOW'}
								</button>
							</div>
						{/if}
					</div>
					<!-- Settings Button (Own Profile Only, stays top right) -->
					{#if isOwnProfile}
						<div class="absolute top-4 right-4 z-10">
							<a
								href="/settings"
								class="theme-transition flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
								style="background-color: rgba(0, 0, 0, 0.5); color: var(--text);"
								on:mouseenter={(e) =>
									(e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)')}
								on:mouseleave={(e) =>
									(e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)')}
								title="Change banner image in settings"
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
									class="lucide lucide-settings"
								>
									<path
										d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
									></path>
									<circle cx="12" cy="12" r="3"></circle>
								</svg>
								Edit Profile
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div
			class="theme-transition mt-8 border-b"
			style="border-color: var(--border); background-color: var(--bg);"
		>
			<div class="relative container mx-auto px-0">
				<nav class="relative flex space-x-12 overflow-x-auto px-6">
					{#each [{ id: 'creations', label: 'All Creations' }, { id: 'tierlists', label: `Tierlists ${stats.creations}` }, { id: 'polls', label: `Polls ${stats.polls}` }] as tab, i}
						<button
							class="theme-transition relative py-4 text-sm font-bold tracking-wide whitespace-nowrap uppercase transition-colors"
							style="color: {selectedTab === tab.id
								? 'var(--text)'
								: 'var(--text-secondary)'}; opacity: {selectedTab === tab.id ? 1 : 0.6};"
							on:click={() => (selectedTab = tab.id)}
						>
							<span
								class="transition-opacity duration-300"
								style="opacity:{selectedTab === tab.id ? 1 : 0.6}">{tab.label}</span
							>
						</button>
					{/each}
					<div
						class="theme-transition absolute bottom-0 left-6 h-[3px] w-32"
						style="background-color: rgb(var(--primary)); transform: translateX({(() => {
							const tabs = ['creations', 'tierlists', 'polls'];
							const idx = tabs.indexOf(selectedTab);
							const spacing = 48;
							if (idx === 0) return '0px';
							if (idx === 1) return `calc(128px + ${spacing}px)`;
							return `calc(256px + ${spacing * 2}px)`;
						})()}); transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);"
					></div>
				</nav>
			</div>
		</div>

		<!-- Content Grid -->
		<div class="container mx-auto px-0 pt-8 pb-16">
			<!-- Tab Content -->
			{#if selectedTab === 'creations'}
				{#if userTierlists.length === 0 && userPolls.length === 0}
					<div class="flex h-48 items-center justify-center">
						<p class="theme-transition" style="color: var(--text-secondary);">No creations found</p>
					</div>
				{:else}
					{#if userTierlists.length > 0}
						<div class="mb-8">
							<h3 class="theme-transition mb-4 px-6 text-xl font-bold" style="color: var(--text);">
								Tierlists
							</h3>
							<div class="grid grid-cols-1 gap-4 px-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
								{#each userTierlists as tierlist}
									<div
										class="theme-transition relative h-80 cursor-pointer overflow-hidden border transition-all duration-200 hover:brightness-110"
										style="border-color: var(--border); {tierlist.banner_image || tierlist.thumbnail
											? `background-image: url('${tierlist.banner_image || tierlist.thumbnail}'); background-size: cover; background-position: center;`
											: `background-color: ${
													[
														'#FFD6E0',
														'#FFEFB5',
														'#C1E7E3',
														'#DCEBDD',
														'#E2D0F9',
														'#FFB5B5',
														'#B5E5FF'
													][Math.floor(Math.random() * 7)]
												};`}"
										on:click={() => goto(`/tierlists/${tierlist.id}`)}
										on:keydown={(e) => e.key === 'Enter' && goto(`/tierlists/${tierlist.id}`)}
										role="button"
										tabindex="0"
									>
										<!-- Dark overlay for text readability -->
										<div
											class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
										></div>

										<!-- Content -->
										<div class="absolute right-0 bottom-0 left-0 p-4 text-white">
											<div class="mb-1 text-xs text-gray-300">
												{formatDateFull(tierlist.created_at)}
											</div>
											<h3 class="mb-2 line-clamp-2 text-sm font-bold text-white">
												{tierlist.title}
											</h3>

											<!-- Forked indicator -->
											{#if tierlist.isForked}
												<div
													class="theme-transition mb-2 text-xs"
													style="color: rgb(var(--primary));"
												>
													<span class="inline-flex items-center">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
															class="mr-1"
															><path d="M7 18l13-13"></path><path d="M10 18H7v-3"></path><path
																d="M20 4h-3v3"
															></path></svg
														>
														Forked
													</span>
												</div>
											{/if}

											<!-- Stats -->
											<div
												class="theme-transition flex justify-between text-xs"
												style="color: var(--text-secondary);"
											>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">favorite</span>
													<span>{formatNumber(tierlist.likes || 0)}</span>
												</div>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">call_split</span>
													<span>{formatNumber(tierlist.forks || 0)}</span>
												</div>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">comment</span>
													<span>{formatNumber(tierlist.comments || 0)}</span>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Polls -->
					{#if userPolls.length > 0}
						<div>
							<h3 class="theme-transition mb-4 px-6 text-xl font-bold" style="color: var(--text);">
								Polls
							</h3>
							<div class="grid grid-cols-1 gap-4 px-6 md:grid-cols-2 lg:grid-cols-3">
								{#each userPolls as poll}
									<a
										href="/polls/{poll.id}"
										class="group theme-transition relative overflow-hidden transition-transform hover:scale-105"
										style="background-color: var(--surface);"
									>
										<!-- Content -->
										<div class="flex aspect-video flex-col justify-between p-5">
											<div>
												<div
													class="theme-transition mb-1 text-xs"
													style="color: var(--text-secondary);"
												>
													{formatDateFull(poll.created_at)}
												</div>
												<h3
													class="theme-transition mb-2 line-clamp-2 text-lg font-bold"
													style="color: var(--text);"
												>
													{poll.title}
												</h3>
											</div>

											<!-- Stats -->
											<div
												class="theme-transition flex justify-between text-xs"
												style="color: var(--text-secondary);"
											>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">favorite</span>
													<span>{formatNumber(poll.likes || 0)}</span>
												</div>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">forum</span>
													<span>{formatNumber(poll.comments || 0)}</span>
												</div>
												<div class="flex items-center space-x-1">
													<span class="material-symbols-outlined text-xs">how_to_vote</span>
													<span>{formatNumber(poll.totalVotes || 0)}</span>
												</div>
											</div>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			{:else if selectedTab === 'tierlists'}
				{#if userTierlists.length === 0}
					<div class="flex h-48 items-center justify-center">
						<p class="theme-transition" style="color: var(--text-secondary);">No tierlists found</p>
					</div>
				{:else}
					<div class="flex h-48 items-center justify-center">
						<p class="theme-transition" style="color: var(--text-secondary);">No tierlists found</p>
					</div>
				{/if}
			{:else if selectedTab === 'polls'}
				{#if userPolls.length > 0}
					<div class="grid grid-cols-1 gap-4 px-6 md:grid-cols-2 lg:grid-cols-3">
						{#each userPolls as poll}
							<a
								href="/polls/{poll.id}"
								class="group theme-transition relative overflow-hidden transition-transform hover:scale-105"
								style="background-color: var(--surface);"
							>
								<div class="flex aspect-video flex-col justify-between p-5">
									<div>
										<div
											class="theme-transition mb-1 text-xs"
											style="color: var(--text-secondary);"
										>
											{new Date(poll.created_at).toLocaleDateString()}
										</div>
										<h3
											class="theme-transition mb-2 line-clamp-2 text-lg font-bold"
											style="color: var(--text);"
										>
											{poll.title}
										</h3>
									</div>

									<div
										class="theme-transition flex justify-between text-xs"
										style="color: var(--text-secondary);"
									>
										<div class="flex items-center space-x-1">
											<span class="material-symbols-outlined text-xs">favorite</span>
											<span>{formatNumber(poll.likes || 0)}</span>
										</div>
										<div class="flex items-center space-x-1">
											<span class="material-symbols-outlined text-xs">forum</span>
											<span>{formatNumber(poll.comments || 0)}</span>
										</div>
										<div class="flex items-center space-x-1">
											<span class="material-symbols-outlined text-xs">how_to_vote</span>
											<span>{formatNumber(poll.totalVotes || 0)}</span>
										</div>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="flex h-48 items-center justify-center">
						<p class="theme-transition" style="color: var(--text-secondary);">No polls found</p>
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<div class="flex h-screen items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl" style="color: rgb(var(--primary));">User not found</div>
				<a href="/" class="transition-all hover:brightness-125" style="color: rgb(var(--primary));"
					>← Go Home</a
				>
			</div>
		</div>
	{/if}
</div>

<Toast />
