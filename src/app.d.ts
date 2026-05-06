// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	type D1Value = string | number | boolean | null | ArrayBuffer;
	type D1Result<T = unknown> = { results?: T[]; success: boolean; meta: unknown };
	type D1ExecResult = { count: number; duration: number };
	interface D1PreparedStatement {
		bind(...values: D1Value[]): D1PreparedStatement;
		first<T = unknown>(): Promise<T | null>;
		all<T = unknown>(): Promise<D1Result<T>>;
		run(): Promise<D1Result>;
	}
	interface D1Database {
		prepare(query: string): D1PreparedStatement;
		exec(query: string): Promise<D1ExecResult>;
	}
	type DurableObjectState = object;
	interface DurableObjectStub {
		fetch(request: Request): Promise<Response>;
	}
	interface DurableObjectNamespace {
		idFromName(name: string): DurableObjectId;
		get(id: DurableObjectId): DurableObjectStub;
	}
	type DurableObjectId = object;
	interface WebSocket {
		accept(): void;
	}
	interface ResponseInit {
		webSocket?: WebSocket;
	}
	var WebSocketPair: {
		new (): { 0: WebSocket; 1: WebSocket };
	};
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				ROOMS: DurableObjectNamespace;
			};
		}
	}
}

export {};
