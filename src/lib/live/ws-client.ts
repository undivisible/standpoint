import type { LiveClientMessage, LiveMessageType, LiveServerMessage } from './types';

type Listener<T extends LiveMessageType> = (
	message: Extract<LiveServerMessage, { type: T }>
) => void;

export class LiveWSClient {
	private socket: WebSocket | null = null;
	private listeners = new Map<LiveMessageType, Set<(message: LiveServerMessage) => void>>();
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectDelay = 2000;
	private manuallyClosed = false;
	private playerName = '';
	private userId?: string;

	constructor(private readonly code: string) {}

	on<T extends LiveMessageType>(type: T, fn: Listener<T>) {
		const set = this.listeners.get(type) ?? new Set();
		set.add(fn as (message: LiveServerMessage) => void);
		this.listeners.set(type, set);
		return () => this.off(type, fn);
	}

	off<T extends LiveMessageType>(type: T, fn: Listener<T>) {
		this.listeners.get(type)?.delete(fn as (message: LiveServerMessage) => void);
	}

	connect(playerName: string, userId?: string) {
		this.playerName = playerName;
		this.userId = userId;
		this.manuallyClosed = false;
		this.open();
	}

	disconnect() {
		this.manuallyClosed = true;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		this.send({ type: 'leave_room' });
		this.socket?.close();
		this.socket = null;
	}

	send(message: LiveClientMessage) {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(message));
		}
	}

	startGame() {
		this.send({ type: 'start_game' });
	}

	submitClue(clue: string) {
		this.send({ type: 'submit_clue', clue });
	}

	updateGuess(value: number) {
		this.send({ type: 'update_guess', value });
	}

	lockGuess() {
		this.send({ type: 'lock_guess' });
	}

	submitLeftRight(direction: 'left' | 'right') {
		this.send({ type: 'submit_left_right', direction });
	}

	nextRound() {
		this.send({ type: 'next_round' });
	}

	leaveRoom() {
		this.disconnect();
	}

	private open() {
		if (typeof window === 'undefined') return;
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const url = `${protocol}//${window.location.host}/api/spectrum/rooms/${encodeURIComponent(this.code)}/ws`;
		this.socket = new WebSocket(url);

		this.socket.onopen = () => {
			this.reconnectDelay = 2000;
			this.send({ type: 'join_room', playerName: this.playerName, userId: this.userId });
		};

		this.socket.onmessage = (event) => {
			try {
				const message = JSON.parse(String(event.data)) as LiveServerMessage;
				this.dispatch(message);
			} catch {
				this.dispatch({ type: 'error', message: 'Received an invalid spectrum room message.' });
			}
		};

		this.socket.onclose = () => {
			this.socket = null;
			if (!this.manuallyClosed) this.scheduleReconnect();
		};

		this.socket.onerror = () => {
			this.dispatch({ type: 'error', message: 'Spectrum room connection failed.' });
		};
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.reconnectTimer = setTimeout(() => this.open(), this.reconnectDelay);
		this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
	}

	private dispatch(message: LiveServerMessage) {
		this.listeners.get(message.type)?.forEach((fn) => fn(message));
	}
}
