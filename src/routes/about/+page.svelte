<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';

	let backendStatus = 'checking';
	let healthData: unknown = null;

	onMount(async () => {
		try {
			healthData = await apiClient.healthCheck();
			backendStatus = 'connected';
		} catch (err) {
			backendStatus = 'disconnected';
			console.error('Backend health check failed:', err);
		}
	});
</script>

<main class="grid min-h-screen grid-rows-2 gap-0">
	<div class="grid grid-cols-1 gap-0 md:grid-cols-2">
		<!-- About -->
		<div
			class="flex flex-col justify-center border-r border-white/20 bg-white/10 p-8 backdrop-blur"
		>
			<h1 class="mb-4 text-4xl font-bold text-white">This is Standpoint v0.8.25-beta</h1>
			<p class="text-lg text-white/70">
				Standpoint is an opinion platform for polls, tierlists, drafts, profiles, and live Spectrum
				rooms. It now runs on SvelteKit and Cloudflare Workers instead of the old separate backend
				deployment.
			</p>
		</div>

		<!-- Status -->
		<div
			class={`flex flex-col justify-center p-8 backdrop-blur ${
				backendStatus === 'connected'
					? 'bg-green-500'
					: backendStatus === 'disconnected'
						? 'bg-red-500'
						: 'border-yellow-400/30 bg-yellow-500/20'
			}`}
		>
			<h3 class="mb-4 text-2xl font-bold text-white">Runtime</h3>
			<div class="mb-2 text-4xl font-bold text-white">
				{backendStatus === 'connected'
					? 'Connected'
					: backendStatus === 'disconnected'
						? 'Disconnected'
						: 'Checking...'}
			</div>
			{#if healthData && typeof healthData === 'object' && healthData !== null && 'message' in healthData}
				<div class="text-lg text-white/70">
					{(healthData as { message: string }).message}
				</div>
			{/if}
		</div>
	</div>

	<!-- Stack -->
	<div class="grid grid-cols-2 gap-0 md:grid-cols-3 lg:grid-cols-9">
		<div
			class="flex flex-col items-center justify-center p-6 text-center transition-opacity hover:opacity-80"
			style="background-color: #ff5705;"
		>
			<div class="mb-2 text-xl font-semibold text-white">Svelte 5</div>
			<div class="text-white/80">Frontend</div>
		</div>

		<div
			class="flex flex-col items-center justify-center p-6 text-center transition-opacity hover:opacity-80"
			style="background-color: #c0ff05;"
		>
			<div class="mb-2 text-xl font-semibold text-black">SvelteKit</div>
			<div class="text-black/70">Framework</div>
		</div>

		<div
			class="flex flex-col items-center justify-center p-6 text-center transition-opacity hover:opacity-80"
			style="background-color: #05ffac;"
		>
			<div class="mb-2 text-xl font-semibold text-black">TypeScript</div>
			<div class="text-black/70">Language</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-zinc-950 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">Bun</div>
			<div class="text-white/80">Tooling</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-orange-500 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">Workers</div>
			<div class="text-white/80">Deploy</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-blue-900 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">D1</div>
			<div class="text-white/80">Data</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-violet-700 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">R2</div>
			<div class="text-white/80">Uploads</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-emerald-700 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">Durable Objects</div>
			<div class="text-white/80">Live Rooms</div>
		</div>

		<div
			class="flex flex-col items-center justify-center bg-indigo-900 p-6 text-center transition-opacity hover:opacity-80"
		>
			<div class="mb-2 text-xl font-semibold text-white">Tailwind</div>
			<div class="text-white/80">CSS</div>
		</div>
	</div>
</main>
