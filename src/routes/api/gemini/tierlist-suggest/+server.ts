import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/cloudflare-data';

type GeminiResponse = {
	candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function cleanJson(text: string) {
	let cleaned = text.trim();
	if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
	if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
	if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
	return JSON.parse(cleaned.trim());
}

function buildPrompt(title: string, usedItems: string[], n: number) {
	const used = usedItems.length ? `Already used: ${usedItems.join(', ')}.` : '';
	return `Suggest ${n} concise tier list items for "${title}". ${used} Return only JSON in this shape: {"items":[{"name":"Item name","description":"Short description"}]}.`;
}

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const db = platform?.env?.DB;
	const apiKey = platform?.env?.GEMINI_API_KEY;
	if (!db) throw error(503, 'D1 is not configured');
	if (!apiKey) throw error(503, 'Gemini is not configured');
	const user = await getSessionUser(db, cookies);
	if (!user) throw error(401, 'Sign in required');
	const pro = await db
		.prepare('SELECT pro FROM users WHERE uid = ?')
		.bind(user.uid)
		.first<{ pro: number }>();
	if (!pro?.pro) throw error(403, 'Pro required');
	const body = (await request.json().catch(() => ({}))) as {
		title?: string;
		used_items?: string[];
		n?: number;
	};
	const title = String(body.title || '')
		.trim()
		.slice(0, 160);
	if (!title) throw error(400, 'Title is required');
	const usedItems = Array.isArray(body.used_items)
		? body.used_items
				.map((item) => String(item).trim().slice(0, 160))
				.filter(Boolean)
				.slice(0, 100)
		: [];
	const n = Math.max(1, Math.min(Number(body.n) || 30, 50));
	const prompt = buildPrompt(title, usedItems, n);
	const gemini = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ role: 'user', parts: [{ text: prompt }] }]
			})
		}
	);
	if (!gemini.ok) throw error(502, 'Gemini request failed');
	const geminiData = (await gemini.json()) as GeminiResponse;
	const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
	try {
		const data = cleanJson(text);
		return json({ ...data, raw_response: text });
	} catch {
		return json({ error: 'Invalid JSON in Gemini response', raw: text }, { status: 502 });
	}
};
