<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Header from '../components/header.svelte';
	import Onboarding from '../components/onboarding.svelte';
	let { children } = $props();

	import { writable } from 'svelte/store';
	import { setContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { currentTheme } from '$lib/themes';

	const navHoverStore = writable(false);
	setContext('navHover', navHoverStore);

	let showOnboarding = $state(false);

	function handleOnboardingComplete() {
		showOnboarding = false;
	}

	// Apply theme on mount and subscribe to changes
	onMount(() => {
		currentTheme.applyCurrentTheme();

		// Subscribe to theme changes
		const unsubscribe = currentTheme.subscribe(() => {
			// Theme already applied by setTheme, but we can trigger re-render if needed
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" />
	<link
		href="https://fonts.googleapis.com/css2?family=Mozilla+Text:wght@200..700&display=swap"
		rel="stylesheet"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
		rel="stylesheet"
	/>
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-47M9FC1D5S"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag() {
			dataLayer.push(arguments);
		}
		gtag('js', new Date());

		gtag('config', 'G-47M9FC1D5S');
	</script>
</svelte:head>

<main class="h-full w-full font-sans" style="background-color: var(--bg, #000000);">
	{#if !$page.url.pathname.startsWith('/tierlists/create')}
		<Header />
	{/if}
	{#if $navHoverStore && !$page.url.pathname.startsWith('/tierlists/create')}
		<div
			class="pointer-events-none fixed inset-0 z-40 opacity-90"
			style="background-color: var(--bg, #000000);"
			transition:fade={{ duration: 300 }}
		></div>
	{/if}
	<div in:fade={{ duration: 250 }} out:fade={{ duration: 200 }} class="min-h-screen">
		{@render children()}
	</div>

	{#if !$page.url.pathname.startsWith('/tierlists/create')}
		<Onboarding bind:show={showOnboarding} on:complete={handleOnboardingComplete} />
	{/if}
</main>

<style>
	:global(:root) {
		--default-font-family:
			'Mozilla Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
			Roboto, Arial, 'Noto Sans', sans-serif;
		--font-sans:
			'Mozilla Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
			Roboto, Arial, 'Noto Sans', sans-serif;
		--sidebar-bg: rgba(var(--primary-light, 255, 180, 120), 0.18);
		--sidebar-bg-dark: rgba(var(--primary, 255, 120, 60), 0.85);
	}
	:global(body),
	:global(html),
	:global(:host) {
		font-family:
			'Mozilla Text',
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Arial,
			'Noto Sans',
			sans-serif !important;
	}
</style>
