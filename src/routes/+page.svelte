<script lang="ts">
	import { goto } from '$app/navigation';
	import Toast from '../components/toast.svelte';

	const tiles = [
		{
			title: 'Polls',
			href: '/polls',
			icon: 'poll',
			description: 'Vote, compare answers, and see where the crowd lands.'
		},
		{
			title: 'Tierlists',
			href: '/tierlists',
			icon: 'stacked_bar_chart',
			description: 'Rank anything into tiers and share the order that feels right.'
		},
		{
			title: 'Spectrum',
			href: '/spectrum',
			icon: 'linear_scale',
			description: 'Give a clue for a hidden point between two prompts, then place the room guess.'
		}
	];
</script>

<svelte:head>
	<title>Standpoint</title>
	<meta
		name="description"
		content="Create polls, tierlists, and Spectrum rooms. Share your opinions and discover what others think."
	/>
</svelte:head>

<div class="theme-transition min-h-screen" style="background-color: var(--bg); color: var(--text);">
	<!-- Hero Section -->
	<div class="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 py-16">
		<div class="mx-auto w-full max-w-6xl">
			<!-- Logo/Title -->
			<h1 class="mb-6 text-center text-5xl font-bold tracking-tight md:text-7xl">Standpoint</h1>

			<!-- Subtitle -->
			<p
				class="mx-auto mb-12 max-w-2xl text-center text-xl leading-relaxed text-[var(--text-secondary)] md:text-2xl"
			>
				Choose how you want to make a point.
			</p>

			<!-- Action Buttons -->
			<div class="grid gap-4 md:grid-cols-3">
				{#each tiles as tile}
					<button
						type="button"
						onclick={() => goto(tile.href)}
						class="group flex min-h-64 flex-col justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] p-6 text-left transition hover:-translate-y-1 hover:border-[rgb(var(--primary))] hover:shadow-2xl"
					>
						<span
							class="material-symbols-outlined text-5xl text-[rgb(var(--primary))] transition group-hover:scale-110"
							>{tile.icon}</span
						>
						<span>
							<span class="block text-3xl font-black text-[var(--text)]">{tile.title}</span>
							<span class="mt-3 block text-base leading-relaxed text-[var(--text-secondary)]">
								{tile.description}
							</span>
						</span>
					</button>
				{/each}
			</div>

			<!-- Secondary Action -->
			<div class="mt-8"></div>
		</div>

		<!-- Scroll Indicator -->
		<div></div>
	</div>

	<!-- Features Section -->
	<div>
		<div>
			<div>
				<!-- Feature 1 -->
				<div></div>

				<!-- Feature 2 -->
				<div></div>

				<!-- Feature 3 -->
				<div></div>
			</div>
		</div>
	</div>

	<!-- CTA Section -->
	<div></div>
</div>

<Toast />
