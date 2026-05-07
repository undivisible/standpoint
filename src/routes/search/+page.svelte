<script lang="ts">
	import { goto } from '$app/navigation';
	import type { TierlistData, PollData } from '$lib/firestore-re-export';

	export let data: {
		query: string;
		type: string;
		tierlists: TierlistData[];
		polls: PollData[];
		users: any[];
	};

	let searchType = data.type || 'all';

	$: filteredResults = {
		tierlists: searchType === 'all' || searchType === 'tierlists' ? data.tierlists : [],
		polls: searchType === 'all' || searchType === 'polls' ? data.polls : [],
		users: searchType === 'all' || searchType === 'users' ? data.users : []
	};

	$: totalResults =
		filteredResults.tierlists.length + filteredResults.polls.length + filteredResults.users.length;

	async function setSearchType(type: string) {
		searchType = type;
		const params = [
			data.query ? `q=${encodeURIComponent(data.query)}` : '',
			type !== 'all' ? `type=${encodeURIComponent(type)}` : ''
		].filter(Boolean);
		const search = params.join('&');
		await goto(search ? `/search?${search}` : '/search', { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Search{data.query ? ` - ${data.query}` : ''} - Standpoint</title>
</svelte:head>

<div class="theme-transition min-h-screen" style="background-color: var(--bg); color: var(--text);">
	<!-- Search Header -->
	<div
		class="sticky top-0 z-10 border-b border-gray-700 backdrop-blur-md"
		style="background: rgba(var(--surface-rgb), 0.9);"
	>
		<div class="container mx-auto px-6 py-4">
			<div class="flex items-center justify-end">
				<!-- Search Type Filter -->
				<div class="flex bg-[var(--bg)] p-1">
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'all'
							? 'bg-[rgb(var(--primary))] text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => setSearchType('all')}
					>
						All
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'tierlists'
							? 'bg-[rgb(var(--primary))] text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => setSearchType('tierlists')}
					>
						Tierlists
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'polls'
							? 'bg-[rgb(var(--primary))] text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => setSearchType('polls')}
					>
						Polls
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'users'
							? 'bg-[rgb(var(--primary))] text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => setSearchType('users')}
					>
						Users
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Search Results -->
	<div class="container mx-auto px-6 py-8">
		{#if data.query}
			<!-- Results Header -->
			<div class="mb-8">
				<h1 class="mb-2 text-3xl font-bold">Search Results</h1>
				<p class="text-gray-400">
					Found {totalResults} results for "<span class="font-medium text-white">{data.query}</span
					>"
				</p>
			</div>

			<!-- Results -->
			{#if totalResults === 0}
				<div class="py-16 text-center">
					<div class="mb-4 text-6xl">🔍</div>
					<h3 class="mb-2 text-xl font-semibold text-white">No results found</h3>
					<p class="mb-6 text-gray-400">Try adjusting your search terms or browse our content</p>
					<div class="flex justify-center gap-4">
						<a
							href="/tierlists"
							class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:bg-[rgb(var(--primary))]"
						>
							Browse Tierlists
						</a>
						<a
							href="/polls"
							class="bg-gray-700 px-6 py-3 text-white transition-colors hover:bg-gray-600"
						>
							Browse Polls
						</a>
					</div>
				</div>
			{:else}
				<!-- Tierlists -->
				{#if filteredResults.tierlists.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>📊</span>
							Tierlists ({filteredResults.tierlists.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each filteredResults.tierlists as tierlist (tierlist.id)}
								<a href="/tierlists/{tierlist.id}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										{#if tierlist.thumbnail}
											<img
												src={tierlist.thumbnail}
												alt={tierlist.title}
												class="mb-3 h-32 w-full object-cover"
											/>
										{:else}
											<div
												class="mb-3 flex h-32 w-full items-center justify-center bg-gradient-to-br from-orange-500/20 to-pink-500/20"
											>
												<span class="text-4xl">📊</span>
											</div>
										{/if}
										<h3 class="mb-2 line-clamp-2 font-semibold text-white">{tierlist.title}</h3>
										{#if tierlist.description}
											<p class="mb-3 line-clamp-2 text-sm text-white/60">{tierlist.description}</p>
										{/if}
										<div class="flex items-center justify-between text-xs text-white/40">
											<span>{tierlist.likes || 0} likes</span>
											<span>{tierlist.comments || 0} comments</span>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Polls -->
				{#if filteredResults.polls.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>📊</span>
							Polls ({filteredResults.polls.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each filteredResults.polls as poll (poll.id)}
								<a href="/polls/{poll.id}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										<h3 class="mb-2 line-clamp-2 font-semibold text-white">{poll.title}</h3>
										{#if poll.description}
											<p class="mb-3 line-clamp-2 text-sm text-white/60">{poll.description}</p>
										{/if}
										<div class="flex items-center justify-between text-xs text-white/40">
											<span>{poll.likes || 0} likes</span>
											<span>{poll.comments || 0} comments</span>
											<span>{poll.totalVotes || 0} votes</span>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Users -->
				{#if filteredResults.users.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>👥</span>
							Users ({filteredResults.users.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{#each filteredResults.users as user (user.uid)}
								<a href="/user/{user.uid}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-6 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										<div class="flex items-center gap-4">
											<img
												src={user.photoURL ||
													`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'User'}`}
												alt={user.displayName}
												class="h-12 w-12 object-cover"
											/>
											<div class="flex-1">
												<h3 class="mb-1 font-semibold text-white">
													{user.displayName || 'Anonymous User'}
												</h3>
												{#if user.bio}
													<p class="line-clamp-2 text-sm text-white/60">{user.bio}</p>
												{/if}
												<div class="mt-2 flex items-center gap-4 text-xs text-white/40">
													<span>{user.aura || 0} aura</span>
													<span>{user.tierlistsCreated || 0} tierlists</span>
													<span>{user.pollsCreated || 0} polls</span>
												</div>
											</div>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		{:else}
			<!-- Empty Search State -->
			<div class="py-16 text-center">
				<div class="mb-4 text-6xl">🔍</div>
				<h1 class="mb-4 text-3xl font-bold">Search Standpoint</h1>
				<p class="mx-auto mb-8 max-w-md text-gray-400">
					Discover amazing tierlists, polls, and creators in our community
				</p>

				<!-- Popular Searches -->
				<div class="mb-8">
					<h3 class="mb-4 text-lg font-semibold">Popular Searches</h3>
					<div class="flex flex-wrap justify-center gap-2">
						{#each ['movies', 'anime', 'games', 'music', 'food', 'sports'] as tag (tag)}
							<button
								class="bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-[rgb(var(--primary))]"
								on:click={() => {
									goto(`/search?q=${encodeURIComponent(tag)}`);
								}}
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="flex justify-center gap-4">
					<a
						href="/tierlists"
						class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:bg-[rgb(var(--primary))]"
					>
						Browse Tierlists
					</a>
					<a
						href="/polls"
						class="bg-gray-700 px-6 py-3 text-white transition-colors hover:bg-gray-600"
					>
						Browse Polls
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
