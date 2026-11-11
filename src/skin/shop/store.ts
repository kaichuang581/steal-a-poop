import { useSyncExternalStore } from 'react';
import { api, useAuth } from '../../auth/authStore';
import { apiBase, authEnabled } from '../../auth/config';
import { loadStreak } from '../../dream/daily';
import { load, save } from '../../lib/storage';
import { localDateKey } from '../hooks/useToday';
import { buy, equip, freshWallet, grantStreakItems, normalise, payGame } from './economy';
import type { BuyResult, GameReward, Line, Payout, Wallet } from './economy';

/**
 * The Barn Bazaar's wallet. Signed out, it lives in this browser (`sap:barn`). Signed in, the game server keeps it
 * (/api/barn), so it follows the player to any device: the first time a player signs in, this browser's wallet is
 * brought into the account once (the server caps the coins), and from then on the account's wallet is the one shown.
 * Signing out shows this browser's own wallet again.
 */
export const WALLET_KEY = 'sap:barn';

const subs = new Set<() => void>();
let local: Wallet | null = null;
let server: Wallet | null = null;
const notify = () => subs.forEach((f) => f());

const token = () => useAuth.getState().session?.access_token ?? null;
/** Signed in with a profile, with a game server to talk to. */
export const online = () => authEnabled() && !!apiBase() && useAuth.getState().status === 'ready' && !!token();

function getLocal(): Wallet {
  if (!local) local = normalise(load<unknown>(WALLET_KEY, null));
  return local;
}
function setLocal(w: Wallet) {
  local = w;
  save(WALLET_KEY, w);
  notify();
}
function setServer(w: Wallet) {
  server = normalise(w);
  notify();
}

export function getWallet(): Wallet {
  return online() && server ? server : getLocal();
}

// ---------------------------------------------------------------- following the sign-in

let syncing: Promise<void> | null = null;
/** Brings this browser's wallet in (once per account, the server decides) and loads the account's wallet. */
export function syncWithServer(): Promise<void> {
  if (!online()) return Promise.resolve();
  syncing ??= (async () => {
    try {
      const r = await api<{ wallet: Wallet }>('POST', '/api/barn/import', token(), { wallet: getLocal() });
      setServer(r.wallet);
      const best = loadStreak().best;
      if (best > 0) setServer((await api<{ wallet: Wallet }>('POST', '/api/barn/streak', token(), { best })).wallet);
    } catch {
      /* the server can't be reached: the browser's wallet stays on show until the next sign-in */
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

let watching = false;
function watchSignIn() {
  if (watching) return;
  watching = true;
  let was = useAuth.getState().status;
  if (was === 'ready') void syncWithServer();
  useAuth.subscribe((s) => {
    if (s.status === was) return;
    was = s.status;
    if (s.status === 'ready') void syncWithServer();
    else { server = null; notify(); }
  });
}

export function useWallet(): Wallet {
  return useSyncExternalStore((f) => { watchSignIn(); subs.add(f); return () => { subs.delete(f); }; }, getWallet, freshWallet);
}

/** Whether the wallet on show is the account's (true) or this browser's (false). */
export function useWalletIsAccount(): boolean {
  useWallet();
  return online() && !!server;
}

// ---------------------------------------------------------------- actions

type Claimed = { ok: true; wallet: Wallet; lines: Line[]; coins: number; xp: number; levelUp: Payout['levelUp']; achievements: string[] };

/** Pays a finished game once. Null if it could not be paid (the server could not be reached). */
export async function payFinishedGame(id: string, g: GameReward): Promise<Payout | null> {
  if (online()) {
    try {
      const r = await api<Claimed>('POST', '/api/barn/claim', token(), { gameId: id, reward: g });
      if (r.lines.length) setServer(r.wallet);
      return { wallet: r.wallet, lines: r.lines, coins: r.coins, xp: r.xp, levelUp: r.levelUp, achievements: r.achievements, capped: r.lines.some((l) => l.coins < 0) };
    } catch {
      return null;
    }
  }
  const out = payGame(getLocal(), id, g, localDateKey(new Date()));
  if (out.lines.length) setLocal(out.wallet);
  return out;
}

export async function buyItem(id: string): Promise<BuyResult> {
  if (online()) {
    try {
      const r = await api<{ wallet: Wallet }>('POST', '/api/barn/buy', token(), { itemId: id });
      setServer(r.wallet);
      return { ok: true, wallet: r.wallet };
    } catch (e) {
      const code = (e as { code?: string }).code;
      return { ok: false, reason: code === 'short' || code === 'owned' || code === 'not_for_sale' || code === 'unknown' ? code : 'offline' };
    }
  }
  const r = buy(getLocal(), id);
  if (r.ok) setLocal(r.wallet);
  return r;
}

export async function equipItem(id: string): Promise<void> {
  if (online()) {
    try { setServer((await api<{ wallet: Wallet }>('POST', '/api/barn/equip', token(), { itemId: id })).wallet); } catch { /* stays as it was */ }
    return;
  }
  setLocal(equip(getLocal(), id));
}

/** Streak items earned by the best Counting Sheep streak; kept for good. Returns the ids newly given. */
export async function grantStreak(best: number): Promise<string[]> {
  if (best <= 0) return [];
  if (online()) {
    try {
      const r = await api<{ wallet: Wallet; granted: string[] }>('POST', '/api/barn/streak', token(), { best });
      if (r.granted.length) setServer(r.wallet);
      return r.granted;
    } catch { return []; }
  }
  const r = grantStreakItems(getLocal(), best);
  if (r.granted.length) setLocal(r.wallet);
  return r.granted;
}

/** Tests only. */
export function resetWalletForTests() { local = null; server = null; }
export { freshWallet };
