import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshWallet } from '../economy';

// The wallet follows the sign-in: signed out it is this browser's, signed in it is the account's on the server.
const auth = vi.hoisted(() => ({ status: 'signedOut', session: null as null | { access_token: string }, subs: [] as ((s: unknown) => void)[] }));
const calls = vi.hoisted(() => [] as { method: string; path: string; body: unknown }[]);
vi.mock('../../../auth/config', () => ({ authEnabled: () => true, apiBase: () => 'https://server.test' }));
vi.mock('../../../auth/authStore', () => ({
  useAuth: { getState: () => auth, subscribe: (f: (s: unknown) => void) => { auth.subs.push(f); return () => {}; } },
  api: vi.fn(async (method: string, path: string, _token: unknown, body: unknown) => {
    calls.push({ method, path, body });
    const wallet = { ...freshWallet(), coins: 777 };
    if (path === '/api/barn/claim') return { ok: true, wallet, lines: [{ label: 'Finished the game', coins: 20 }], coins: 20, xp: 20, levelUp: null, achievements: [] };
    if (path === '/api/barn/buy') throw Object.assign(new Error('short'), { code: 'short' });
    if (path === '/api/barn/streak') return { wallet, granted: [] };
    return { wallet };
  }),
}));

import { buyItem, getWallet, payFinishedGame, resetWalletForTests, syncWithServer } from '../store';

beforeEach(() => {
  calls.length = 0;
  resetWalletForTests();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  auth.status = 'signedOut';
  auth.session = null;
});

describe('the wallet and the sign-in', () => {
  it('signed out, a game pays into this browser', async () => {
    const p = await payFinishedGame('quick:a', { mode: 'quick', won: false, words: [] });
    expect(p?.coins).toBe(20);
    expect(getWallet().coins).toBe(20);
    expect(calls).toEqual([]);
  });
  it('signed in, the browser wallet is brought in and the account is shown and paid', async () => {
    auth.status = 'ready';
    auth.session = { access_token: 't' };
    await syncWithServer();
    expect(calls[0].path).toBe('/api/barn/import');
    expect(getWallet().coins).toBe(777);
    const p = await payFinishedGame('quick:b', { mode: 'quick', won: false, words: [] });
    expect(calls.at(-1)?.path).toBe('/api/barn/claim');
    expect(p?.coins).toBe(20);
    expect(await buyItem('bomb-gold')).toEqual({ ok: false, reason: 'short' });
  });
});
