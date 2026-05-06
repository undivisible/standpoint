<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { LiveWSClient } from '$lib/live/ws-client';
	import type { PublicRoomState } from '$lib/live/types';

	export let code: string;
	export let playerName: string;
	export let userId: string | undefined = undefined;

	const dispatch = createEventDispatcher<{
		leave: void;
		error: string;
	}>();

	let client: LiveWSClient;
	let roomState: PublicRoomState | null = null;
	let currentPlayerId: string | null = null;
	let error = '';

	onMount(() => {
		client = new LiveWSClient(code);
		client.on('room_snapshot', (message) => {
			roomState = message.data;
			const me = userId
				? message.data.players.find((player) => player.userId === userId)
				: message.data.players.find((player) => player.displayName === playerName);
			currentPlayerId = me?.id ?? currentPlayerId;
		});
		client.on('error', (message) => {
			error = message.message;
			dispatch('error', error);
		});
		client.connect(playerName, userId);
	});

	onDestroy(() => {
		client?.disconnect();
	});

	function leave() {
		client?.leaveRoom();
		dispatch('leave');
	}
</script>

<slot {roomState} {currentPlayerId} {client} {leave} {error}></slot>
