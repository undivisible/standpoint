export function fadeImage(node: HTMLImageElement) {
	// Enable native lazy loading on all images using this action
	if (!node.hasAttribute('loading')) {
		node.loading = 'lazy';
	}

	function handleLoaded() {
		requestAnimationFrame(() => {
			node.classList.add('sp-fade-image-loaded');
		});
	}
	if (node.complete && node.naturalWidth > 0) {
		handleLoaded();
	} else {
		node.addEventListener('load', handleLoaded, { once: true });
		node.addEventListener('error', () => node.classList.add('sp-fade-image-error'), { once: true });
	}
	return {
		destroy() {}
	};
}

if (typeof document !== 'undefined') {
	const styleId = 'sp-fade-image-styles';
	if (!document.getElementById(styleId)) {
		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = `
    .sp-fade-image, .sp-fade-image:not(.sp-fade-image-loaded) { opacity: 0; }
    .sp-fade-image { transition: opacity .45s ease; }
    .sp-fade-image-loaded { opacity: 1; }
    `;
		document.head.appendChild(style);
	}
}
