export type PollEdgeVisual = {
	label: string;
	color?: string;
};

export function getPollEdgeVisuals(options: string[], colors: string[] = []): PollEdgeVisual[] {
	const offset = options.length === 4 ? 2 : 0;

	return options.map((_, index) => {
		const sourceIndex = (index + offset) % options.length;

		return {
			label: options[sourceIndex],
			color: colors[sourceIndex]
		};
	});
}

export function hasPollEdgeColors(
	colors: string[] | undefined,
	edgeCount: number
): colors is string[] {
	return Array.isArray(colors) && colors.length === edgeCount;
}
