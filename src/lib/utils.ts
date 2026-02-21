/**
 * Recursively removes undefined values from an object or array.
 * Used before writing to Firestore which rejects undefined values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cleanUndefinedValues(obj: any): any {
	if (obj === null || obj === undefined) {
		return null;
	}

	if (Array.isArray(obj)) {
		return obj.map(cleanUndefinedValues).filter((item) => item !== undefined);
	}

	if (typeof obj === 'object') {
		const cleaned: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			if (value !== undefined) {
				cleaned[key] = cleanUndefinedValues(value);
			}
		}
		return cleaned;
	}

	return obj;
}
