import { describe, expect, it } from 'vitest';
import { decideEntry } from '../entry';

describe('first screen', () => {
  it('a build with no accounts goes straight to the menu', () => {
    expect(decideEntry({ accounts: false, status: 'off', hasGuest: false })).toBe('menu');
  });
  it('a first visit, or a logged-out player, sees the landing page', () => {
    expect(decideEntry({ accounts: true, status: 'signedOut', hasGuest: false })).toBe('landing');
    expect(decideEntry({ accounts: true, status: 'error', hasGuest: false })).toBe('landing');
  });
  it('a saved login goes straight to the menu, with no landing page', () => {
    expect(decideEntry({ accounts: true, status: 'ready', hasGuest: false })).toBe('menu');
  });
  it('a guest goes straight to the menu on return', () => {
    expect(decideEntry({ accounts: true, status: 'signedOut', hasGuest: true })).toBe('menu');
  });
  it('waits while a saved login is checked, unless a guest is already known', () => {
    expect(decideEntry({ accounts: true, status: 'loading', hasGuest: false })).toBe('wait');
    expect(decideEntry({ accounts: true, status: 'loading', hasGuest: true })).toBe('menu');
  });
});
