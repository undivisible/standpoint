import { writable } from 'svelte/store';
import { persistThemeMode } from './stores';
import { browser } from '$app/environment';

// Theme settings interface
export interface ThemeSettings {
	theme: 'dark' | 'light';
	colorScheme: 'orange' | 'red' | 'blue' | 'green';
	fontSize: 'small' | 'medium' | 'large';
}

// Default theme settings
const defaultTheme: ThemeSettings = {
	theme: 'dark',
	colorScheme: 'orange',
	fontSize: 'medium'
};

// Create theme store
export const themeSettings = writable<ThemeSettings>(defaultTheme);

// Load theme from localStorage if available
if (browser) {
	const stored = localStorage.getItem('standpoint-theme');
	if (stored) {
		try {
			const parsedTheme = JSON.parse(stored);
			themeSettings.set({ ...defaultTheme, ...parsedTheme });
		} catch (e) {
			console.warn('Failed to parse stored theme settings');
		}
	}
}

// Save theme to localStorage when it changes
if (browser) {
	themeSettings.subscribe((theme) => {
		localStorage.setItem('standpoint-theme', JSON.stringify(theme));
		applyTheme(theme);
		persistThemeMode(theme.theme).catch(() => {});
	});
}

// Apply theme to document
export function applyTheme(theme: ThemeSettings) {
	if (!browser) return;

	const root = document.documentElement;

	// Apply color scheme CSS variables
	const colorSchemes = {
		orange: {
			'--primary': '255, 87, 5',
			'--primary-600': '255, 87, 5',
			'--primary-700': '220, 66, 0'
		},
		red: {
			'--primary': '239, 68, 68',
			'--primary-600': '220, 38, 38',
			'--primary-700': '185, 28, 28'
		},
		blue: {
			'--primary': '59, 130, 246',
			'--primary-600': '37, 99, 235',
			'--primary-700': '29, 78, 216'
		},
		green: {
			'--primary': '34, 197, 94',
			'--primary-600': '22, 163, 74',
			'--primary-700': '21, 128, 61'
		}
	};

	// Apply color scheme
	const colors = colorSchemes[theme.colorScheme];
	Object.entries(colors).forEach(([property, value]) => {
		root.style.setProperty(property, value);
	});

	// Apply font size
	const fontSizes = {
		small: '14px',
		medium: '16px',
		large: '18px'
	};
	root.style.setProperty('--base-font-size', fontSizes[theme.fontSize]);

	// Apply theme class
	root.className = theme.theme === 'dark' ? 'dark' : 'light';
}

// Initialize theme on load
if (browser) {
	themeSettings.subscribe(applyTheme);
}
