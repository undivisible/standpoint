import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { currentUser } from './stores';
import { apiPatch } from './cloudflare-api';

export interface Theme {
	id: string;
	name: string;
	description: string;
	colors: {
		primary: string; // RGB values as string "r, g, b"
		secondary: string; // Secondary accent color (RGB)
		background: string;
		surface: string;
		surfaceHover: string;
		text: string;
		textSecondary: string;
		border: string;
		success: string;
		warning: string;
		error: string;
	};
	customizable?: boolean; // Can users customize this theme?
}

export const themes: Theme[] = [
	{
		id: 'dark',
		name: 'Dark (Default)',
		description: 'Classic dark theme with purple accents',
		colors: {
			primary: '255, 87, 5', // Purple
			secondary: '255, 107, 53', // Pink
			background: '#000000',
			surface: '#0f0f0f',
			surfaceHover: '#1a1a1a',
			text: '#ffffff',
			textSecondary: '#a0a0a0',
			border: '#333333',
			success: '34, 197, 94',
			warning: '234, 179, 8',
			error: '239, 68, 68'
		},
		customizable: true
	},
	{
		id: 'light',
		name: 'Light',
		description: 'Clean light theme',
		colors: {
			primary: '139, 92, 246', // Violet
			secondary: '59, 130, 246', // Blue
			background: '#ffffff',
			surface: '#f5f5f5',
			surfaceHover: '#eeeeee',
			text: '#0f0f0f',
			textSecondary: '#666666',
			border: '#e0e0e0',
			success: '34, 197, 94',
			warning: '234, 179, 8',
			error: '239, 68, 68'
		},
		customizable: true
	},
	{
		id: 'sepia',
		name: 'Sepia',
		description: 'Warm, eye-friendly sepia tones',
		colors: {
			primary: '184, 134, 11', // Dark goldenrod
			secondary: '217, 119, 6', // Amber
			background: '#f4f1ea',
			surface: '#ebe6dc',
			surfaceHover: '#e2dccf',
			text: '#5b4636',
			textSecondary: '#8b7355',
			border: '#d4c5b0',
			success: '101, 163, 13',
			warning: '202, 138, 4',
			error: '185, 28, 28'
		},
		customizable: true
	},
	{
		id: 'nord',
		name: 'Nord',
		description: 'Cool arctic-inspired palette',
		colors: {
			primary: '136, 192, 208', // Nord frost
			secondary: '143, 188, 187', // Nord aurora
			background: '#2e3440',
			surface: '#3b4252',
			surfaceHover: '#434c5e',
			text: '#eceff4',
			textSecondary: '#d8dee9',
			border: '#4c566a',
			success: '163, 190, 140',
			warning: '235, 203, 139',
			error: '191, 97, 106'
		},
		customizable: true
	},
	{
		id: 'dracula',
		name: 'Dracula',
		description: 'Vibrant dark theme with rich colors',
		colors: {
			primary: '255, 121, 198', // Pink
			secondary: '189, 147, 249', // Purple
			background: '#282a36',
			surface: '#44475a',
			surfaceHover: '#4d5066',
			text: '#f8f8f2',
			textSecondary: '#6272a4',
			border: '#6272a4',
			success: '80, 250, 123',
			warning: '241, 250, 140',
			error: '255, 85, 85'
		},
		customizable: true
	},
	{
		id: 'neo-tokyo',
		name: 'Neo Tokyo',
		description: 'Cyberpunk-inspired neon theme',
		colors: {
			primary: '0, 255, 255', // Cyan
			secondary: '255, 0, 255', // Magenta
			background: '#0a0e27',
			surface: '#1a1f3a',
			surfaceHover: '#252a47',
			text: '#ffffff',
			textSecondary: '#7b89d7',
			border: '#2d3561',
			success: '0, 255, 127',
			warning: '255, 215, 0',
			error: '255, 0, 127'
		},
		customizable: true
	},
	{
		id: 'taiga',
		name: 'Taiga',
		description: 'Forest-inspired green theme',
		colors: {
			primary: '52, 211, 153', // Emerald
			secondary: '74, 222, 128', // Green
			background: '#1a2321',
			surface: '#2d3a36',
			surfaceHover: '#384842',
			text: '#e8f5f1',
			textSecondary: '#a7c4bc',
			border: '#3d4f4a',
			success: '34, 197, 94',
			warning: '250, 204, 21',
			error: '248, 113, 113'
		},
		customizable: true
	},
	{
		id: 'sunset',
		name: 'Sunset',
		description: 'Warm orange and red gradients',
		colors: {
			primary: '251, 146, 60', // Orange
			secondary: '239, 68, 68', // Red
			background: '#1c1410',
			surface: '#2d241f',
			surfaceHover: '#3a2f28',
			text: '#fef3c7',
			textSecondary: '#d4a574',
			border: '#4a3b2f',
			success: '34, 197, 94',
			warning: '234, 179, 8',
			error: '220, 38, 38'
		},
		customizable: true
	},
	{
		id: 'midnight',
		name: 'Midnight Blue',
		description: 'Deep blue night theme',
		colors: {
			primary: '96, 165, 250', // Sky blue
			secondary: '147, 197, 253', // Light blue
			background: '#0c1222',
			surface: '#1e293b',
			surfaceHover: '#334155',
			text: '#f1f5f9',
			textSecondary: '#94a3b8',
			border: '#334155',
			success: '34, 197, 94',
			warning: '234, 179, 8',
			error: '239, 68, 68'
		},
		customizable: true
	},
	{
		id: 'sakura',
		name: 'Sakura',
		description: 'Soft pink Japanese-inspired theme',
		colors: {
			primary: '244, 114, 182', // Pink
			secondary: '249, 168, 212', // Light pink
			background: '#fdf2f8',
			surface: '#fce7f3',
			surfaceHover: '#fbcfe8',
			text: '#500724',
			textSecondary: '#9d174d',
			border: '#f9a8d4',
			success: '34, 197, 94',
			warning: '234, 179, 8',
			error: '239, 68, 68'
		},
		customizable: true
	}
];

const THEME_STORAGE_KEY = 'standpoint_theme';
const THEME_ACCENTS_KEY = 'standpoint_theme_accents';

function createThemeStore() {
	// Load saved theme or default to dark
	const savedTheme = browser ? localStorage.getItem(THEME_STORAGE_KEY) : null;
	const initialTheme = themes.find((t) => t.id === savedTheme) || themes[0];

	const { subscribe, set } = writable<Theme>(initialTheme);

	return {
		subscribe,
		setTheme: (themeId: string) => {
			const theme = themes.find((t) => t.id === themeId);
			if (!theme) return;

			set(theme);

			// Persist to localStorage
			if (browser) {
				localStorage.setItem(THEME_STORAGE_KEY, themeId);
			}

			// Apply theme to CSS variables
			applyTheme(theme);
		},
		getTheme: (themeId: string): Theme | undefined => {
			return themes.find((t) => t.id === themeId);
		},
		applyCurrentTheme: () => {
			applyTheme(initialTheme);
		}
	};
}

function applyTheme(theme: Theme) {
	if (!browser) return;

	const root = document.documentElement;

	// If there are saved per-theme accents in localStorage, apply them to the theme object
	try {
		const accentsRaw = localStorage.getItem(THEME_ACCENTS_KEY);
		if (accentsRaw) {
			const accents = JSON.parse(accentsRaw || '{}');
			const accentFor = accents[theme.id];
			if (accentFor) {
				// mutate a shallow copy so we don't permanently overwrite definitions on disk
				theme = {
					...theme,
					colors: {
						...theme.colors,
						primary: accentFor.primary || theme.colors.primary,
						secondary: accentFor.secondary || theme.colors.secondary
					}
				};
			}
		}
	} catch (e) {
		// ignore parse errors
	}

	// Apply CSS custom properties
	root.style.setProperty('--primary', theme.colors.primary);
	root.style.setProperty('--primary-rgb', theme.colors.primary);
	root.style.setProperty('--secondary', theme.colors.secondary);
	root.style.setProperty('--secondary-rgb', theme.colors.secondary);
	root.style.setProperty('--bg', theme.colors.background);

	// If background is provided as hex, also expose an rgb var for opacity usage
	function hexToRgb(hex: string) {
		if (!hex) return '0,0,0';
		if (hex[0] === '#') hex = hex.substring(1);
		if (hex.length === 3)
			hex = hex
				.split('')
				.map((c) => c + c)
				.join('');
		const bigint = parseInt(hex, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return `${r}, ${g}, ${b}`;
	}
	try {
		const bgRgb = theme.colors.background.startsWith('#')
			? hexToRgb(String(theme.colors.background))
			: // if it's already rgb(...) or similar, attempt to extract numbers
				String(theme.colors.background)
					.replace(/[^0-9,]/g, '')
					.trim();
		root.style.setProperty('--bg-rgb', bgRgb);
	} catch (e) {
		root.style.setProperty('--bg-rgb', '0, 0, 0');
	}
	root.style.setProperty('--surface', theme.colors.surface);
	try {
		const surfaceRgb = theme.colors.surface.startsWith('#')
			? hexToRgb(String(theme.colors.surface))
			: String(theme.colors.surface)
					.replace(/[^0-9,]/g, '')
					.trim();
		root.style.setProperty('--surface-rgb', surfaceRgb);
	} catch (e) {
		root.style.setProperty('--surface-rgb', '0, 0, 0');
	}
	root.style.setProperty('--surface-hover', theme.colors.surfaceHover);
	root.style.setProperty('--text', theme.colors.text);
	root.style.setProperty('--text-secondary', theme.colors.textSecondary);
	root.style.setProperty('--border', theme.colors.border);
	root.style.setProperty('--success', theme.colors.success);
	root.style.setProperty('--warning', theme.colors.warning);
	root.style.setProperty('--error', theme.colors.error);

	// Update background and text colors globally
	document.body.style.backgroundColor = theme.colors.background;
	document.body.style.color = theme.colors.text;

	// Compute a contrasting text color to use on dark overlays. If the theme
	// background is light, use white for text on dark overlays; otherwise use
	// the theme text color. This helps readability for themes like Sepia.
	function hexToLuminance(hex: string) {
		if (!hex || hex[0] !== '#') return 1;
		const h = hex.replace('#', '');
		const bigint = parseInt(h, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		// relative luminance
		const srgb = [r, g, b]
			.map((v) => v / 255)
			.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
		const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
		return lum;
	}

	try {
		const lum = hexToLuminance(String(theme.colors.background));
		// If background is light (luminance > 0.5), text-on-dark should be white
		// (so dark overlays keep white text). Otherwise use the theme text color.
		const textOnDark = lum > 0.5 ? '#ffffff' : theme.colors.text;
		document.documentElement.style.setProperty('--text-on-dark', textOnDark);
	} catch (e) {
		document.documentElement.style.setProperty('--text-on-dark', theme.colors.text);
	}

	// Add theme class to body for additional styling
	document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
	document.body.classList.add(`theme-${theme.id}`);

	// Apply theme colors to common elements
	applyThemeToElements(theme);
}

function applyThemeToElements(theme: Theme) {
	if (!browser) return;

	// Update all elements with hardcoded colors
	const style = document.createElement('style');
	style.id = 'theme-overrides';

	// Remove existing theme overrides
	const existingStyle = document.getElementById('theme-overrides');
	if (existingStyle) {
		existingStyle.remove();
	}

	// Create dynamic CSS based on theme
	style.textContent = `
		/* Background overrides */
		.bg-gray-900 {
			background-color: ${theme.colors.background} !important;
		}

		.bg-gray-700,
		.bg-gray-800,
		.bg-gray-800/50 {
			background-color: ${theme.colors.surface} !important;
		}

		/* Black with opacity overrides: ensure overlays remain dark so text
		   placed on semi-transparent black stays readable across themes */
		.bg-black/50 { background-color: rgba(0,0,0,0.5) !important; }
		.bg-black/60 { background-color: rgba(0,0,0,0.6) !important; }
		.bg-black/70 { background-color: rgba(0,0,0,0.7) !important; }
		.bg-black/80 { background-color: rgba(0,0,0,0.8) !important; }
		.bg-black/95 { background-color: rgba(0,0,0,0.95) !important; }

		/* Border overrides */
		.border-gray-600,
		.border-gray-700,
		.border-gray-800 {
			border-color: ${theme.colors.border} !important;
		}


		/* Text overrides */
		.text-gray-300,
		.text-gray-400,
		.text-gray-500 {
			color: ${theme.colors.textSecondary} !important;
		}

		/* Map .text-white to a computed color for readability on dark overlays */
		.text-white {
			color: var(--text-on-dark) !important;
		}

		/* Orange/accent overrides - use primary color */
		.bg-orange-500,
		.bg-orange-600,
		.hover\\:bg-orange-500:hover,
		.hover\\:bg-orange-600:hover {
			background-color: rgb(${theme.colors.primary}) !important;
		}

		.bg-orange-600/70 {
			background-color: rgba(${theme.colors.primary}, 0.7) !important;
		}

		.text-orange-300,
		.text-orange-400,
		.hover\\:text-orange-200:hover,
		.hover\\:text-orange-300:hover,
		.hover\\:text-orange-400:hover {
			color: rgb(${theme.colors.primary}) !important;
		}

		.border-orange-400,
		.border-orange-500,
		.focus\\:border-orange-500:focus,
		.hover\\:border-orange-400:hover {
			border-color: rgb(${theme.colors.primary}) !important;
		}

		.focus\\:ring-orange-500/20:focus {
			--tw-ring-color: rgba(${theme.colors.primary}, 0.2) !important;
		}

		/* Spinner border colors */
		.border-orange-500 {
			border-color: rgb(${theme.colors.primary}) !important;
		}

		/* Input/Select overrides */
		input:not([type="checkbox"]):not([type="radio"]),
		select,
		textarea {
			background-color: ${theme.colors.surface} !important;
			color: ${theme.colors.text} !important;
			border-color: ${theme.colors.border} !important;
		}

		input::placeholder,
		textarea::placeholder {
			color: ${theme.colors.textSecondary} !important;
			opacity: 0.6;
		}

		/* Primary color elements */
		.bg-\\[rgb\\(var\\(--primary\\)\\)\\] {
			background-color: rgb(${theme.colors.primary}) !important;
		}

		.text-\\[rgb\\(var\\(--primary\\)\\)\\] {
			color: rgb(${theme.colors.primary}) !important;
		}

		.border-\\[rgb\\(var\\(--primary\\)\\)\\] {
			border-color: rgb(${theme.colors.primary}) !important;
		}

		/* Hover state for surface elements */
		.hover\\:bg-gray-600:hover,
		.hover\\:bg-gray-700:hover,
		.hover\\:bg-gray-800:hover {
			background-color: ${theme.colors.surfaceHover} !important;
		}
	`;

	document.head.appendChild(style);
}

export const currentTheme = createThemeStore();

// Allow updating a theme's primary/secondary accent and persist per-theme accents to localStorage
export function setThemeAccent(themeId: string, primaryRgb: string, secondaryRgb?: string) {
	if (!browser) return;

	const theme = themes.find((t) => t.id === themeId);
	if (!theme) return;

	// Persist accents in localStorage per-theme
	try {
		const raw = localStorage.getItem(THEME_ACCENTS_KEY);
		const accents = raw ? JSON.parse(raw) : {};
		accents[themeId] = { primary: primaryRgb, secondary: secondaryRgb || theme.colors.secondary };
		localStorage.setItem(THEME_ACCENTS_KEY, JSON.stringify(accents));
	} catch (e) {
		console.warn('Failed to persist theme accent', e);
	}

	// Persist per-theme accent to server for logged-in users
	try {
		const user = get(currentUser);
		if (user && user.uid) {
			apiPatch(`users/${encodeURIComponent(user.uid)}`, {
				preferences: {
					themeAccents: {
						[themeId]: {
							primary: primaryRgb,
							secondary: secondaryRgb || theme.colors.secondary
						}
					}
				}
			}).catch((err) => {
				console.warn('Failed to persist theme accent to server', err);
			});
		}
	} catch (e) {
		console.warn('Failed to persist theme accent to server', e);
	}

	// If this theme is currently active, re-apply it so the new accent takes effect
	try {
		const active = localStorage.getItem(THEME_STORAGE_KEY) || themes[0].id;
		if (active === themeId) {
			// create a modified shallow copy so applyTheme picks up the overridden values
			const modified = {
				...theme,
				colors: {
					...theme.colors,
					primary: primaryRgb,
					secondary: secondaryRgb || theme.colors.secondary
				}
			};
			applyTheme(modified);
		}
	} catch (e) {
		console.warn('Failed to re-apply theme after accent change', e);
	}
}

// Apply theme on module load
if (browser) {
	currentTheme.applyCurrentTheme();
}
