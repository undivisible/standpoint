<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { RoomSettings, RoomSettingsInput } from '$lib/live/types';

	export let settings: RoomSettings = {
		customLeftLabel: null,
		customRightLabel: null,
		customPrompt: null
	};
	export let disabled = false;

	const dispatch = createEventDispatcher<{ save: RoomSettingsInput }>();

	let leftLabel = settings.customLeftLabel ?? '';
	let rightLabel = settings.customRightLabel ?? '';
	let prompt = settings.customPrompt ?? '';
	let savedFlash = false;
	let savedTimer: ReturnType<typeof setTimeout> | null = null;

	$: dirty =
		(leftLabel || '').trim() !== (settings.customLeftLabel ?? '') ||
		(rightLabel || '').trim() !== (settings.customRightLabel ?? '') ||
		(prompt || '').trim() !== (settings.customPrompt ?? '');

	function flashSaved() {
		savedFlash = true;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => {
			savedFlash = false;
			savedTimer = null;
		}, 1600);
	}

	function save() {
		dispatch('save', {
			customLeftLabel: leftLabel.trim() || null,
			customRightLabel: rightLabel.trim() || null,
			customPrompt: prompt.trim() || null
		});
		flashSaved();
	}

	function clearAll() {
		leftLabel = '';
		rightLabel = '';
		prompt = '';
		dispatch('save', {
			customLeftLabel: null,
			customRightLabel: null,
			customPrompt: null
		});
		flashSaved();
	}
</script>

<div class="border border-[var(--border)] bg-[var(--surface)] p-5">
	<div class="flex items-center justify-between gap-3">
		<p class="text-xs tracking-[0.24em] text-[var(--text-secondary)] uppercase">Game settings</p>
		{#if savedFlash}
			<span class="text-xs font-semibold text-[rgb(var(--primary))]">Saved</span>
		{/if}
	</div>

	<label
		for="game-settings-prompt"
		class="mt-4 block text-xs tracking-[0.18em] text-[var(--text-secondary)] uppercase"
	>
		Prompt
	</label>
	<textarea
		id="game-settings-prompt"
		bind:value={prompt}
		maxlength="200"
		rows="2"
		{disabled}
		placeholder="What is this spectrum about?"
		class="mt-1 w-full resize-none border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
	></textarea>

	<div class="mt-3 grid grid-cols-2 gap-3">
		<div>
			<label
				for="game-settings-left"
				class="block text-xs tracking-[0.18em] text-[var(--text-secondary)] uppercase"
			>
				Left axis
			</label>
			<input
				id="game-settings-left"
				bind:value={leftLabel}
				maxlength="40"
				{disabled}
				placeholder="cold take"
				class="mt-1 w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
			/>
		</div>
		<div>
			<label
				for="game-settings-right"
				class="block text-xs tracking-[0.18em] text-[var(--text-secondary)] uppercase"
			>
				Right axis
			</label>
			<input
				id="game-settings-right"
				bind:value={rightLabel}
				maxlength="40"
				{disabled}
				placeholder="hot take"
				class="mt-1 w-full border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
			/>
		</div>
	</div>

	<div class="mt-4 flex gap-3">
		<button
			type="button"
			class="flex-1 bg-[rgb(var(--primary))] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
			disabled={disabled || !dirty}
			onclick={save}
		>
			Save
		</button>
		<button
			type="button"
			class="border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-45"
			{disabled}
			onclick={clearAll}
		>
			Reset
		</button>
	</div>

	<p class="mt-3 text-xs text-[var(--text-secondary)]">
		Leave a field empty to use the random spectrum card. Both axis names must be set to fully
		override.
	</p>
</div>
