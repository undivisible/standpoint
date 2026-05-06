import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { currentUser } from './stores';
import { apiPatch } from './cloudflare-api';

export const accentColor = writable<string>('orange');

export const accentCss = writable<string>('255, 107, 53');

export async function setAccent(color: string) {
	accentColor.set(color);
	let css = '255, 107, 53'; // default leuchtorange #FF6B35)
	let cssLight = '255, 180, 120'; // #FFB478
	if (color === 'blue') {
		css = '0, 255, 255'; // #00FFFF
		cssLight = '120, 255, 255'; // #78FFFF
	} else if (color === 'purple') {
		css = '180, 0, 255'; // #B400FF
		cssLight = '210, 120, 255'; // #D278FF
	} else if (color === 'green') {
		css = '5, 255, 172'; // #05FFAC
		cssLight = '120, 255, 200'; // #78FFC8
	} else if (color === 'red') {
		css = '255, 53, 107'; // #FF356B
		cssLight = '255, 120, 180'; // #FF78B4
	} else if (color === 'lime') {
		css = '192, 255, 5'; // #C0FF05
		cssLight = '220, 255, 120'; // #DCFF78
	}
	accentCss.set(css);
	document.documentElement.style.setProperty('--primary', css);
	document.documentElement.style.setProperty('--primary-light', cssLight);

	document.documentElement.style.setProperty('--primary-rgb', css);
	document.documentElement.style.setProperty('--primary-light-rgb', cssLight);
	const [r, g, b] = css.split(',').map((v) => v.trim());
	const [rl, gl, bl] = cssLight.split(',').map((v) => v.trim());
	document.documentElement.style.setProperty('--primary-soft', `${r}, ${g}, ${b}, 0.12`);
	document.documentElement.style.setProperty('--primary-light-soft', `${rl}, ${gl}, ${bl}, 0.18`);

	// Persist preference for logged-in user
	try {
		const user = get(currentUser);
		if (user) {
			await apiPatch(`users/${encodeURIComponent(user.uid)}`, { preferences: { accent: color } });
		}
	} catch (e) {
		console.warn('Failed to persist accent preference', e);
	}
}
