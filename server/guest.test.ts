import { describe, expect, it } from 'vitest';
import { guestUser } from './guest';

const ID = '3f2b8c1e-9d4a-4b7e-8f10-2c6d5e7a9b01';

describe('guest players', () => {
  it('accepts a guest token and keeps the id as the identity', () => {
    const u = guestUser(`guest:${ID}:Maya`);
    expect(u).toEqual({ userId: `guest:${ID}`, name: 'Maya', chatAllowed: true, resultsAllowed: false, isModerator: false });
  });

  it('decodes the typed name and trims it', () => {
    expect(guestUser(`guest:${ID}:${encodeURIComponent('  Big Bo ')}`)?.name).toBe('Big Bo');
  });

  it('refuses a malformed id', () => {
    expect(guestUser('guest:not-a-uuid:Maya')).toBeNull();
    expect(guestUser(`guest:${ID}:`)).toBeNull();
  });

  it('refuses a name that is blank, too long or inappropriate', () => {
    expect(guestUser(`guest:${ID}:${encodeURIComponent('   ')}`)).toBeNull();
    expect(guestUser(`guest:${ID}:${'x'.repeat(61)}`)).toBeNull();
    expect(guestUser(`guest:${ID}:${encodeURIComponent('sh1t')}`)).toBeNull();
  });

  it('refuses a token with a colon in the name or a broken escape', () => {
    expect(guestUser(`guest:${ID}:a:b`)).toBeNull();
    expect(guestUser(`guest:${ID}:%E0%A4%A`)).toBeNull();
  });

  it('cuts a long name to the nickname length', () => {
    expect(guestUser(`guest:${ID}:${encodeURIComponent('abcdefghijklmnop')}`)?.name).toBe('abcdefghijkl');
  });
});
