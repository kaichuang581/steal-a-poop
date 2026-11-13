import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ status: 'signedOut', session: null as null | { access_token: string }, subs: [] as ((s: unknown) => void)[] }));
const calls = vi.hoisted(() => [] as string[]);
vi.mock('../../../auth/config', () => ({ authEnabled: () => true, apiBase: () => 'https://server.test' }));
vi.mock('../../../auth/authStore', () => ({
  useAuth: { getState: () => auth, subscribe: (f: (s: unknown) => void) => { auth.subs.push(f); return () => {}; } },
  api: vi.fn(async (_m: string, path: string) => { calls.push(path); throw Object.assign(new Error('nope'), { code: 'short' }); }),
}));

import { useAdmin } from '../../../lib/admin';
import { ADMIN_PURSE, getWallet, holdWalletView, openFeedSack, releaseWalletView, resetWalletForTests, walletOnShow } from '../store';

beforeEach(() => {
  calls.length = 0;
  resetWalletForTests();
  const data = new Map<string, string>([['sap:barn', JSON.stringify({ coins: 40 })]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  auth.status = 'signedOut';
  auth.session = null;
  useAdmin.setState({ admin: false, coins: true });
});

describe("admin's unlimited purse", () => {
  it('shows the purse while unlocked and the real balance once locked', () => {
    expect(getWallet().coins).toBe(40);
    useAdmin.setState({ admin: true });
    expect(getWallet().coins).toBe(ADMIN_PURSE);
    expect(getWallet()).toBe(getWallet()); // a stable object, for useSyncExternalStore
    useAdmin.setState({ coins: false });
    expect(getWallet().coins).toBe(40); // the panel's switch is off
    useAdmin.setState({ coins: true, admin: false });
    expect(getWallet().coins).toBe(40); // admin locked
  });

  it('opens sacks for nothing, keeping the items', async () => {
    useAdmin.setState({ admin: true });
    const got: string[] = [];
    for (let i = 0; i < 5; i++) { const r = await openFeedSack('tick'); if (r.ok) got.push(r.entry.itemId); }
    expect(got).toHaveLength(5);
    useAdmin.setState({ admin: false });
    const w = getWallet();
    expect(w.coins).toBe(40);
    expect(w.owned).toEqual(expect.arrayContaining(got));
  });

  it('never touches the account wallet on the server, even signed in', async () => {
    auth.status = 'ready';
    auth.session = { access_token: 't' };
    useAdmin.setState({ admin: true });
    expect((await openFeedSack('bomb')).ok).toBe(true);
    expect(calls.filter((c) => c.startsWith('/api/barn/sack'))).toEqual([]);
  });
});

describe('a sack\'s result stays off the screen until the reel stops', () => {
  it('the screens show the wallet as it was before the lever, while the real one already holds the result', async () => {
    const data = new Map<string, string>([['sap:barn', JSON.stringify({ coins: 1000 })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
    resetWalletForTests();
    holdWalletView();
    const r = await openFeedSack('bomb');
    expect(r.ok).toBe(true);
    expect(getWallet().coins).toBeLessThan(1000); // rolled, paid for and saved at once
    expect(walletOnShow().coins).toBe(1000); // but nothing on screen has changed
    expect(walletOnShow().owned).not.toContain(r.ok && !r.entry.duplicate ? r.entry.itemId : 'nothing');
    releaseWalletView();
    expect(walletOnShow()).toEqual(getWallet());
  });
});

