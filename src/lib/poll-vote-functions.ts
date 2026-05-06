// i hate maths lucky i dont have to do any because the computer does it for me :))
export { saveUserVote, getUserVote, updatePollStatistics } from './firestore-polls-tierlists';

export async function getAllVotesForPoll(pollId: string): Promise<{
	vote_positions: number[];
	vote_positions_2d: { x: number; y: number }[];
	total_votes: number;
}> {
	try {
		const response = await fetch(`/api/cloudflare/polls/${pollId}/votes`);
		if (!response.ok) throw new Error(await response.text());
		return await response.json();
	} catch (error) {
		console.error('Error getting all votes for poll:', error);
		return {
			vote_positions: [],
			vote_positions_2d: [],
			total_votes: 0
		};
	}
}
