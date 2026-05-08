<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState, RoomSettingsInput } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{
		submit: string;
		settings: RoomSettingsInput;
		kick: string;
	}>();

	let clue = '';
	let clueError = '';
	let editingSide: 'left' | 'right' | null = null;
	let leftDraft = '';
	let rightDraft = '';

	$: isPsychic = room.psychicId === currentPlayerId;
	$: isHost =
		room.hostPlayerId === currentPlayerId ||
		room.players.find((player) => player.id === currentPlayerId)?.isHost;
	$: canSubmit = isPsychic && clue.trim().length > 0 && !/\d|%|percent/i.test(clue.trim());
	$: if (editingSide !== 'left') leftDraft = room.spectrum?.left ?? '';
	$: if (editingSide !== 'right') rightDraft = room.spectrum?.right ?? '';

	function startEdit(side: 'left' | 'right') {
		editingSide = side;
		if (side === 'left') leftDraft = room.spectrum?.left ?? '';
		else rightDraft = room.spectrum?.right ?? '';
		queueMicrotask(() => {
			const el = document.getElementById(
				side === 'left' ? 'panel-left-input' : 'panel-right-input'
			);
			if (el instanceof HTMLInputElement) {
				el.focus();
				el.select();
			}
		});
	}

	function commitEdit(side: 'left' | 'right') {
		const draft = side === 'left' ? leftDraft : rightDraft;
		const trimmed = draft.trim().slice(0, 40);
		const original = side === 'left' ? room.spectrum?.left ?? '' : room.spectrum?.right ?? '';
		editingSide = null;
		if (!trimmed || trimmed === original) {
			if (side === 'left') leftDraft = original;
			else rightDraft = original;
			return;
		}
		dispatch(
			'settings',
			side === 'left' ? { customLeftLabel: trimmed } : { customRightLabel: trimmed }
		);
	}

	function cancelEdit(side: 'left' | 'right') {
		if (side === 'left') leftDraft = room.spectrum?.left ?? '';
		else rightDraft = room.spectrum?.right ?? '';
		editingSide = null;
	}

	function applyAxisFromBars(detail: { side: 'left' | 'right'; value: string }) {
		dispatch(
			'settings',
			detail.side === 'left'
				? { customLeftLabel: detail.value }
				: { customRightLabel: detail.value }
		);
	}

	function submit() {
		clueError = '';
		if (!canSubmit) {
			clueError = 'Clue required, and it cannot include numbers.';
			return;
		}
		dispatch('submit', clue.trim());
	}
</script>

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode={isPsychic ? 'psychic' : 'spectator'}
	targetValue={isPsychic ? room.targetValue : null}
	axisEditable={isPsychic}
	disabled
	on:axisChange={(e) => applyAxisFromBars(e.detail)}
/>

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl backdrop-blur"
>
	{#if isPsychic}
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">You are psychic</p>
		<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
			{#if editingSide === 'left'}
				<input
					id="panel-left-input"
					bind:value={leftDraft}
					maxlength="40"
					class="rounded-md border border-[rgb(var(--primary))] bg-[var(--bg)] px-3 py-2 text-left text-base font-bold text-[var(--text)] outline-none"
					onblur={() => commitEdit('left')}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							commitEdit('left');
						} else if (e.key === 'Escape') {
							e.preventDefault();
							cancelEdit('left');
						}
					}}
				/>
			{:else}
				<button
					type="button"
					class="truncate rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left text-base font-bold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
					title="Click to rename"
					onclick={() => startEdit('left')}
				>
					{room.spectrum?.left}
				</button>
			{/if}
			<span class="text-sm text-[var(--text-secondary)]">/</span>
			{#if editingSide === 'right'}
				<input
					id="panel-right-input"
					bind:value={rightDraft}
					maxlength="40"
					class="rounded-md border border-[rgb(var(--primary))] bg-[var(--bg)] px-3 py-2 text-right text-base font-bold text-[var(--text)] outline-none"
					onblur={() => commitEdit('right')}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							commitEdit('right');
						} else if (e.key === 'Escape') {
							e.preventDefault();
							cancelEdit('right');
						}
					}}
				/>
			{:else}
				<button
					type="button"
					class="truncate rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-right text-base font-bold text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
					title="Click to rename"
					onclick={() => startEdit('right')}
				>
					{room.spectrum?.right}
				</button>
			{/if}
		</div>
		<p class="mt-2 text-xs text-[var(--text-secondary)]">
			Click either side to rename it (here or above the dial).
		</p>
		<textarea
			bind:value={clue}
			maxlength="200"
			class="mt-4 min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))]"
			placeholder="Write a clue without numbers"
		></textarea>
		<div class="mt-3 flex items-center justify-between gap-3">
			<p class="text-sm text-[var(--text-secondary)]">{clue.length}/200</p>
			<button
				type="button"
				class="rounded-md bg-[rgb(var(--primary))] px-5 py-2 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
				disabled={!canSubmit}
				onclick={submit}
			>
				Submit Clue
			</button>
		</div>
		{#if clueError}
			<p class="mt-2 text-sm text-red-300">{clueError}</p>
		{/if}
	{:else}
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">
			Psychic is thinking
		</p>
		<h1 class="mt-2 text-2xl font-bold text-[var(--text)]">Waiting for the clue</h1>
		<p class="mt-2 text-[var(--text-secondary)]">The target is hidden until reveal.</p>
	{/if}
	{#if isHost}
		<div class="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
			<span class="text-xs tracking-[0.18em] text-[var(--text-secondary)] uppercase">Players</span>
			{#each room.players.filter((p) => p.connected) as player (player.id)}
				{@const isMe = player.id === currentPlayerId}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
				>
					<span>{player.displayName}</span>
					{#if !player.isHost && !isMe}
						<button
							type="button"
							class="rounded-full border border-[var(--border)] px-1.5 text-[10px] transition hover:border-red-500 hover:text-red-300"
							title="Kick"
							onclick={() => dispatch('kick', player.id)}
						>
							×
						</button>
					{/if}
				</span>
			{/each}
		</div>
	{/if}
</div>
