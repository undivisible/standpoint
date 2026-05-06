import { describe, expect, it } from 'vitest';
import { mapPoll, mapTierlist, mapUser, toTimestamp } from './cloudflare-data';

describe('cloudflare data mapping', () => {
	it('maps users with stored preferences', () => {
		expect(
			mapUser({
				uid: 'user_1',
				email: 'a@example.com',
				display_name: 'A',
				photo_url: 'https://example.com/a.png',
				preferences: '{"accent":"green"}',
				data: '{}'
			})
		).toMatchObject({
			uid: 'user_1',
			displayName: 'A',
			preferences: { accent: 'green' }
		});
	});

	it('maps poll json fields', () => {
		expect(
			mapPoll({
				id: 'poll_1',
				title: 'Best color',
				owner: 'user_1',
				options_json: '["red","blue"]',
				stats_json: '{"total_votes":2}',
				response_type: 2,
				likes: 1,
				comments: 0,
				total_votes: 2,
				status: 'published',
				visibility: 'public'
			})
		).toMatchObject({
			id: 'poll_1',
			options: ['red', 'blue'],
			stats: { total_votes: 2 },
			totalVotes: 2
		});
	});

	it('maps tierlist json fields', () => {
		expect(
			mapTierlist({
				id: 'tierlist_1',
				title: 'Breakfast',
				owner: 'user_1',
				tiers_json: '[{"name":"S"}]',
				items_json: '[{"id":"item_1"}]',
				placements_json: '[]',
				is_forked: 0,
				is_guest: 0,
				status: 'published',
				visibility: 'public'
			})
		).toMatchObject({
			id: 'tierlist_1',
			tiers: [{ name: 'S' }],
			items: [{ id: 'item_1' }]
		});
	});

	it('creates timestamp-compatible objects', () => {
		expect(toTimestamp('2026-05-06T00:00:00.000Z').toDate().toISOString()).toBe(
			'2026-05-06T00:00:00.000Z'
		);
	});
});
