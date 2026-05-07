<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { currentUser } from '$lib/stores';
	import confetti from 'canvas-confetti';

	const dispatch = createEventDispatcher();

	export let show = false;

	let currentStep = 0;
	let totalSteps = 5;

	const onboardingSteps = [
		{
			title: 'Welcome to Standpoint! 🎉',
			content: "We're so glad you're here. Let's get you started!",
			action: 'Get Started',
			highlight: 'welcome'
		},
		{
			title: 'Create Tier Lists 📊',
			content:
				"Organize anything into tiers - movies, music, food, or whatever you're passionate about. Trust us, we're better than Tiermaker.",
			action: 'Cool!',
			highlight: 'tierlists'
		},
		{
			title: 'AI-Powered Suggestions ✨',
			content: "Stop wasting hours looking for items, we've got AI, AI and AI.",
			action: 'Amazing!',
			highlight: 'ai'
		},
		{
			title: 'Share & Discover 🌟',
			content:
				'Share your opinions with friends and more, we make it easy with links and photos, or find a tierlist that you want to make.',
			action: "Let's Go!",
			highlight: 'community'
		},
		{
			title: 'Ready? 🚀',
			content: "Well what are you waiting for? I want to hear what you've got to say!",
			action: 'Start Creating',
			highlight: 'start'
		}
	];

	function nextStep() {
		if (currentStep < totalSteps - 1) {
			// Small celebration for step completion
			confetti({
				particleCount: 20,
				spread: 35,
				origin: { y: 0.8 },
				colors: ['rgb(var(--primary))', '#ff8c42'],
				scalar: 0.6
			});
			currentStep++;
		} else {
			completeOnboarding();
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	function completeOnboarding() {
		// Confetti 🎊
		confetti({
			particleCount: 100,
			spread: 70,
			origin: { y: 0.6 },
			colors: ['rgb(var(--primary))', '#ff8c42', '#ffa726', '#ffcc02']
		});

		// Not enough confetti
		setTimeout(() => {
			confetti({
				particleCount: 50,
				angle: 60,
				spread: 55,
				origin: { x: 0, y: 0.7 },
				colors: ['rgb(var(--primary))', '#ff8c42']
			});
			confetti({
				particleCount: 50,
				angle: 120,
				spread: 55,
				origin: { x: 1, y: 0.7 },
				colors: ['#ffa726', '#ffcc02']
			});
		}, 200);

		// Mark onboarding as completed in localStorage
		localStorage.setItem('standpoint_onboarding_completed', 'true');
		show = false;
		dispatch('complete');
	}

	function skipOnboarding() {
		completeOnboarding();
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!show) return;

		switch (event.key) {
			case 'ArrowRight':
			case 'Enter':
				event.preventDefault();
				nextStep();
				break;
			case 'ArrowLeft':
				event.preventDefault();
				prevStep();
				break;
			case 'Escape':
				event.preventDefault();
				skipOnboarding();
				break;
		}
	}

	onMount(() => {
		// Check if user has completed onboarding
		const hasCompletedOnboarding = localStorage.getItem('standpoint_onboarding_completed');
		if (!hasCompletedOnboarding && !$currentUser) {
			// Show onboarding for new users
			setTimeout(() => {
				show = true;
			}, 1000);
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div
		class="bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm"
		transition:fade={{ duration: 300 }}
	>
		<!-- Onboarding Card -->
		<div
			class="relative mx-4 w-full max-w-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-8 shadow-2xl"
			transition:fly={{ y: 20, duration: 400 }}
		>
			<!-- Progress Bar -->
			<div class="mb-6 w-full">
				<div class="mb-2 flex justify-between text-sm text-gray-400">
					<span>Step {currentStep + 1} of {totalSteps}</span>
					<button
						on:click={skipOnboarding}
						class="text-gray-400 transition-colors hover:text-white"
					>
						Skip tour
					</button>
				</div>
				<div class="h-2 w-full bg-gray-700">
					<div
						class="h-2 bg-gradient-to-r from-[rgb(var(--primary))] to-red-500 transition-all duration-500 ease-out"
						style="width: {((currentStep + 1) / totalSteps) * 100}%"
					></div>
				</div>
			</div>

			<!-- Step Content -->
			<div class="mb-8 text-center">
				<h2 class="mb-4 text-3xl font-bold text-white">
					{onboardingSteps[currentStep].title}
				</h2>
				<p class="text-lg leading-relaxed text-gray-300">
					{onboardingSteps[currentStep].content}
				</p>
			</div>

			<!-- Visual Indicator based on step -->
			<div class="mb-8 flex justify-center">
				{#if onboardingSteps[currentStep].highlight === 'welcome'}
					<div class="bg-gradient-to-br from-[rgb(var(--primary))] to-red-500 p-4">
						<div class="text-6xl">🎯</div>
					</div>
				{:else if onboardingSteps[currentStep].highlight === 'tierlists'}
					<div class="bg-gradient-to-br from-blue-500 to-purple-500 p-4">
						<div class="text-6xl">📊</div>
					</div>
				{:else if onboardingSteps[currentStep].highlight === 'ai'}
					<div class="bg-gradient-to-br from-green-500 to-teal-500 p-4">
						<div class="text-6xl">✨</div>
					</div>
				{:else if onboardingSteps[currentStep].highlight === 'community'}
					<div class="bg-gradient-to-br from-pink-500 to-red-500 p-4">
						<div class="text-6xl">🌟</div>
					</div>
				{:else}
					<div class="bg-gradient-to-br from-yellow-500 to-orange-500 p-4">
						<div class="text-6xl">🚀</div>
					</div>
				{/if}
			</div>

			<!-- Navigation -->
			<div class="flex items-center justify-between">
				<button
					on:click={prevStep}
					disabled={currentStep === 0}
					class="bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Previous
				</button>

				<div class="flex space-x-2">
					{#each Array(totalSteps) as _, index (index)}
						<button
							on:click={() => (currentStep = index)}
							class="h-3 w-3 transition-colors {index === currentStep
								? 'bg-accent'
								: 'bg-gray-600 hover:bg-gray-500'}"
							aria-label="Go to step {index + 1}"
						></button>
					{/each}
				</div>

				<button
					on:click={nextStep}
					class="bg-gradient-to-r from-[rgb(var(--primary))] to-red-500 px-6 py-2 font-bold text-white transition-all hover:shadow-lg hover:brightness-110"
				>
					{onboardingSteps[currentStep].action}
				</button>
			</div>

			<!-- Close button -->
			<button
				on:click={skipOnboarding}
				class="absolute top-4 right-4 text-gray-400 transition-colors hover:text-white"
				aria-label="Close onboarding"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<!-- Keyboard hints -->
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500">
				Use ← → keys to navigate • ESC to skip
			</div>
		</div>
	</div>
{/if}
