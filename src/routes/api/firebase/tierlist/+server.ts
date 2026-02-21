import type { RequestHandler } from '@sveltejs/kit';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

// Function to clean undefined values
function cleanUndefinedValues(obj: any): any {
	if (obj === null || obj === undefined) {
		return null;
	}

	if (Array.isArray(obj)) {
		return obj.map(cleanUndefinedValues).filter((item) => item !== undefined);
	}

	if (typeof obj === 'object') {
		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				cleaned[key] = cleanUndefinedValues(value);
			}
		}
		return cleaned;
	}

	return obj;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const tierlist = await request.json();
		// Validation
		if (!tierlist.title || typeof tierlist.title !== 'string') {
			return new Response(JSON.stringify({ error: 'Missing or invalid tierlist title' }), {
				status: 400
			});
		}
		if (!tierlist.owner) {
			return new Response(JSON.stringify({ error: 'Missing owner for tierlist' }), {
				status: 400
			});
		}

		// Clean and save tierlist
		const cleanedTierlist = cleanUndefinedValues({
			...tierlist,
			likes: tierlist.likes || 0,
			forks: tierlist.forks || 0,
			comments: tierlist.comments || 0,
			created_at: serverTimestamp()
		});

		const docRef = await addDoc(collection(db, 'tierlists'), cleanedTierlist);

		// Save placements as subcollection if provided
		if (tierlist.placements && Array.isArray(tierlist.placements)) {
			for (const placement of tierlist.placements) {
				const cleanedPlacement = cleanUndefinedValues(placement);
				if (cleanedPlacement.item_id) {
					await setDoc(
						doc(db, 'tierlists', docRef.id, 'placements', cleanedPlacement.item_id),
						cleanedPlacement
					);
				}
			}
		}

		return new Response(JSON.stringify({ id: docRef.id }), { status: 201 });
	} catch (e: unknown) {
		console.error('Tierlist creation error:', e);
		return new Response(JSON.stringify({ error: 'Failed to create tierlist' }), {
			status: 500
		});
	}
};
