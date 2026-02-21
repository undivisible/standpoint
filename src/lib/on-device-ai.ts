/**
 * On-device AI module using Chrome's built-in Prompt API (LanguageModel).
 *
 * This uses Gemini Nano (Chrome) or Phi 4 mini (Edge) running locally in
 * the browser — no API keys, no network calls for inference, and no cost.
 *
 * The API has gone through several namespace iterations:
 *   - `window.ai.languageModel` — older Chrome Canary builds
 *   - `LanguageModel` (global)   — Chrome 138+ / Edge 138+
 *
 * We detect both and prefer the newer global.
 *
 * Reference: https://developer.chrome.com/docs/ai/prompt-api
 */

import { writable } from 'svelte/store';

// ---------------------------------------------------------------------------
// Type declarations for the Prompt API (not yet in lib.dom.d.ts)
// ---------------------------------------------------------------------------

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LanguageModelCreateOptions {
	initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	expectedInputs?: Array<{ type: string; languages?: string[] }>;
	expectedOutputs?: Array<{ type: string; languages?: string[] }>;
	temperature?: number;
	topK?: number;
	signal?: AbortSignal;
	monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelSession {
	prompt(input: string, options?: { signal?: AbortSignal; responseConstraint?: unknown }): Promise<string>;
	promptStreaming(input: string, options?: { signal?: AbortSignal }): AsyncIterable<string>;
	destroy(): void;
	inputUsage: number;
	inputQuota: number;
}

interface LanguageModelAPI {
	availability(options?: Record<string, unknown>): Promise<Availability>;
	create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare global {
	// Chrome 138+ exposes LanguageModel as a global
	// eslint-disable-next-line no-var
	var LanguageModel: LanguageModelAPI | undefined;

	interface Window {
		// Older namespace (Chrome Canary / early builds)
		ai?: {
			languageModel?: LanguageModelAPI;
		};
	}
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/** Whether the on-device AI is usable in this browser. */
export const onDeviceAIAvailable = writable<boolean>(false);

/** Human-readable status for the UI. */
export const onDeviceAIStatus = writable<string>('checking');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let _available = false;

/**
 * Resolve the LanguageModel API from whichever namespace is present.
 * Prefers the newer global `LanguageModel` over `window.ai.languageModel`.
 */
function getLanguageModelAPI(): LanguageModelAPI | null {
	if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) {
		return globalThis.LanguageModel;
	}
	if (typeof window !== 'undefined' && window.ai?.languageModel) {
		return window.ai.languageModel;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Check whether the browser supports the on-device Prompt API.
 * Safe to call multiple times — only probes once.
 */
export async function detectOnDeviceAI(): Promise<boolean> {
	if (_available) return true;

	if (typeof window === 'undefined') {
		onDeviceAIStatus.set('unavailable');
		return false;
	}

	try {
		const lm = getLanguageModelAPI();
		if (!lm) {
			onDeviceAIStatus.set('unavailable');
			onDeviceAIAvailable.set(false);
			return false;
		}

		const status = await lm.availability({
			expectedInputs: [{ type: 'text', languages: ['en'] }],
			expectedOutputs: [{ type: 'text', languages: ['en'] }]
		});

		if (status === 'unavailable') {
			onDeviceAIStatus.set('unavailable');
			onDeviceAIAvailable.set(false);
			return false;
		}

		// 'available', 'downloadable', or 'downloading' all mean usable (or soon)
		_available = true;
		onDeviceAIAvailable.set(true);
		onDeviceAIStatus.set(status === 'available' ? 'ready' : status);
		return true;
	} catch (err) {
		console.warn('[on-device-ai] detection failed:', err);
		onDeviceAIStatus.set('unavailable');
		onDeviceAIAvailable.set(false);
		return false;
	}
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

let _session: LanguageModelSession | null = null;

async function getSession(): Promise<LanguageModelSession> {
	const lm = getLanguageModelAPI();
	if (!lm) throw new Error('On-device AI not available');

	if (!_session) {
		_session = await lm.create({
			initialPrompts: [
				{
					role: 'system',
					content:
						'You are a helpful assistant that suggests items for tier lists. ' +
						'You always respond with valid JSON and nothing else.'
				}
			],
			expectedInputs: [{ type: 'text', languages: ['en'] }],
			expectedOutputs: [{ type: 'text', languages: ['en'] }]
		});
	}
	return _session;
}

/** Destroy the current session (e.g. when navigating away). */
export function destroySession(): void {
	if (_session) {
		_session.destroy();
		_session = null;
	}
}

// ---------------------------------------------------------------------------
// Tier-list suggestions
// ---------------------------------------------------------------------------

export interface AISuggestion {
	name: string;
	image: boolean;
	image_query: string;
}

/**
 * Ask the on-device model for tier-list item suggestions.
 *
 * Returns `null` if on-device AI is not available.
 */
export async function fetchOnDeviceSuggestions(
	title: string,
	usedItems: string[] = [],
	count = 30
): Promise<{ items: AISuggestion[]; raw: string } | null> {
	if (!_available) return null;

	const used =
		usedItems.length > 0
			? `\nAlready suggested/used items (do not repeat): ${usedItems.join(', ')}`
			: '';

	const prompt =
		`I'm creating a tier list titled "${title}".${used}\n` +
		`1. Suggest ${count} items that would be appropriate for this tier list.\n` +
		'2. For each item, indicate if an image would be appropriate (true/false).\n' +
		'3. If images are appropriate, suggest a short search query for finding a representative image.\n' +
		'Respond ONLY in JSON:\n' +
		'{\n' +
		'  "items": [\n' +
		'    { "name": "...", "image": true/false, "image_query": "..." }\n' +
		'  ]\n' +
		'}\n' +
		'You MUST respond with only the JSON object and nothing else. Do not add any explanation, code block, or extra text.';

	try {
		const session = await getSession();
		const raw = await session.prompt(prompt);

		// Clean potential markdown fences
		let cleaned = raw.trim();
		if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
		if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
		if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
		cleaned = cleaned.trim();

		const data = JSON.parse(cleaned);
		const items: AISuggestion[] = Array.isArray(data.items) ? data.items : [];

		return { items, raw };
	} catch (err) {
		console.error('[on-device-ai] suggestion request failed:', err);

		// Reset session on failure so next call creates a fresh one
		destroySession();

		return { items: [], raw: String(err) };
	}
}
