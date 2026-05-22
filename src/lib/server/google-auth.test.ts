import { describe, expect, it } from 'vitest';
import { _getGoogleUserGroup } from '../../routes/api/auth/google/callback/+server';

describe('google auth callback', () => {
	it('grants admin to undivisible profiles', () => {
		expect(_getGoogleUserGroup({ name: 'undivisible' })).toBe('admin');
		expect(_getGoogleUserGroup({ email: 'undivisible@vk.com', name: 'Someone' })).toBe('admin');
	});

	it('keeps other profiles as regular users', () => {
		expect(_getGoogleUserGroup({ email: 'person@example.com', name: 'Person' })).toBe('user');
	});
});
