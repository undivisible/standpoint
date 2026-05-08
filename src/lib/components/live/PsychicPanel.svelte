<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PublicRoomState, RoomSettingsInput } from '$lib/live/types';
	import SpectrumBars from './SpectrumBars.svelte';

	export let room: PublicRoomState;
	export let currentPlayerId: string | null = null;

	const dispatch = createEventDispatcher<{ submit: string; settings: RoomSettingsInput }>();
	let clue = '';
	let clueError = '';
	let axisFormError = '';

	let editingSide: 'left' | 'right' | null = null;
	let draftAxis = '';

	$: isPsychic = room.psychicId === currentPlayerId;
	$: canSubmit = isPsychic && clue.trim().length > 0 && !/\d|%|percent/i.test(clue.trim());

	function openAxisEdit(side: 'left' | 'right') {
		editingSide = side;
		draftAxis = (side === 'left' ? room.spectrum?.left : room.spectrum?.right) ?? '';
		axisFormError = '';
	}

	function saveAxis() {
		if (!editingSide) return;
		const trimmed = draftAxis.trim();
		if (!trimmed) {
			axisFormError = 'Enter a label or cancel.';
			return;
		}
		if (editingSide === 'left') {
			dispatch('settings', { customLeftLabel: trimmed });
		} else {
			dispatch('settings', { customRightLabel: trimmed });
		}
		editingSide = null;
		axisFormError = '';
	}

	function cancelAxisEdit() {
		editingSide = null;
		axisFormError = '';
	}

	function submit() {
		clueError = '';
		if (!canSubmit) {
			clueError = 'Clue required, and it cannot include numbers.';
			return;
		}
		dispatch('submit', clue.trim());
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !editingSide) return;
		cancelAxisEdit();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<SpectrumBars
	leftLabel={room.spectrum?.left ?? ''}
	rightLabel={room.spectrum?.right ?? ''}
	prompt={room.settings?.customPrompt ?? null}
	mode={isPsychic ? 'psychic' : 'spectator'}
	targetValue={isPsychic ? room.targetValue : null}
	axisEditable={isPsychic}
	disabled
	on:axisEdit={(e) => openAxisEdit(e.detail)}
/>

{#if editingSide}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 px-4"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && cancelAxisEdit()}
	>
		<div
			class="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="axis-edit-title"
			tabindex="-1"
		>
			<h2 id="axis-edit-title" class="text-lg font-bold text-[var(--text)]">
				Rename {editingSide === 'left' ? 'left' : 'right'} end
			</h2>
			<p class="mt-1 text-sm text-[var(--text-secondary)]">
				This updates the spectrum for everyone in the round.
			</p>
			<input
				bind:value={draftAxis}
				maxlength="40"
				class="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] transition outline-none focus:border-[rgb(var(--primary))]"
				placeholder={editingSide === 'left' ? 'Left label' : 'Right label'}
				onkeydown={(e) => {
					if (e.key === 'Enter') saveAxis();
				}}
			/>
			{#if axisFormError}
				<p class="mt-2 text-sm text-red-300">{axisFormError}</p>
			{/if}
			<div class="mt-5 flex justify-end gap-3">
				<button
					type="button"
					class="rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--text)] transition hover:border-[rgb(var(--primary))]"
					onclick={cancelAxisEdit}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-md bg-[rgb(var(--primary))] px-4 py-2 font-semibold text-white transition hover:brightness-110"
					onclick={saveAxis}
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}

<div
	class="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl backdrop-blur"
>
	{#if isPsychic}
		<p class="text-xs tracking-[0.24em] text-[rgb(var(--primary))] uppercase">You are psychic</p>
		<h1 class="mt-2 text-2xl font-bold text-[var(--text)]">
			{room.spectrum?.left} / {room.spectrum?.right}
		</h1>
		<p class="mt-2 text-sm text-[var(--text-secondary)]">
			Tap the axis labels on the spectrum above to rename them.
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
</div>
