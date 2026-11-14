import { useSyncExternalStore } from 'react';
import { api, useAuth } from '../../auth/authStore';
import { apiBase, authEnabled } from '../../auth/config';
import { loadStreak } from '../../dream/daily';
import { load, save } from '../../lib/storage';
import { useAdmin } from '../../lib/admin';
import { localDateKey } from '../hooks/useToday';
import { buy, equip, freshWallet, grantStreakItems, normalise, openSack, payGame } from './economy';
import type { BuyResult, GameReward, Line, Payout, SackResult, Wallet } from './economy';
import { cryptoRand } from './roll';
import type { SackId } from './sacks';

/**
 * The Trading Post's wallet. Signed out, it lives in this browser (`sap:barn`). Signed in, the game server keeps it
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

// ---------------------------------------------------------------- admin: an unlimited purse

/**
 * With admin unlocked and the admin panel's "Unlimited Wool Coins" switch on (src/lib/admin.ts), the Trading Post runs
 * on this browser's wallet with ADMIN_PURSE Wool Coins, and opening sacks costs nothing: the real balance is put back
 * after every action, and shows again when the switch or admin is turned off. The account's wallet on the server is never
 * touched, because the admin lock is client-only and the server must not hand out coins on a browser's say-so. Items
 * got this way stay owned. (A stopgap: Brian, 2026-11-12, "for now we'll change it later".)
 */
export const ADMIN_PURSE = 999_999;
const adminOn = () => { const a = useAdmin.getState(); return a.admin && a.coins; };
/** Signed in and not in admin mode: actions go to the account's wallet on the server. */
const remote = () => online() && !adminOn();

let purseFor: Wallet | null = null;
let purse: Wallet | null = null;
function adminView(real: Wallet): Wallet {
  if (purseFor !== real || !purse) { purseFor = real; purse = { ...real, coins: ADMIN_PURSE, bells: ADMIN_PURSE }; }
  return purse;
}
/** Runs a wallet action against the unlimited purse, then saves its result with the real balance put back. */
function adminDo<T extends { ok: boolean }>(fn: (w: Wallet) => T & { wallet?: Wallet }): T {
  const real = getLocal();
  const r = fn(adminView(real));
  if (r.ok && r.wallet) setLocal({ ...r.wallet, coins: real.coins, bells: real.bells });
  return r;
}

export function getWallet(): Wallet {
  if (adminOn()) return adminView(getLocal());
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
  useAdmin.subscribe((a, b) => { if (a.admin !== b.admin || a.coins !== b.coins) notify(); });
  let was = useAuth.getState().status;
  if (was === 'ready') void syncWithServer();
  useAuth.subscribe((s) => {
    if (s.status === was) return;
    was = s.status;
    if (s.status === 'ready') void syncWithServer();
    else { server = null; notify(); }
  });
}

/**
 * While a Feed Sack's reel spins, the screens go on showing the wallet as it was before the lever was pulled. The sack
 * is rolled and saved the moment it is pulled (so a closed page loses nothing), and the new balance and the found item
 * used to show at once behind the reel: 750 left said "new item" and 870 "an uncommon you had" before it stopped.
 */
let heldView: Wallet | null = null;
export function holdWalletView(): void { heldView = getWallet(); }
export function releaseWalletView(): void { if (heldView) { heldView = null; notify(); } }
/** The wallet the screens show: the real one, or the one held while a reel spins. */
export const walletOnShow = (): Wallet => heldView ?? getWallet();

export function useWallet(): Wallet {
  return useSyncExternalStore((f) => { watchSignIn(); subs.add(f); return () => { subs.delete(f); }; }, walletOnShow, freshWallet);
}

/** Whether the wallet on show is the account's (true) or this browser's (false). */
export function useWalletIsAccount(): boolean {
  useWallet();
  return remote() && !!server;
}

/** True while admin's unlimited purse is on show. */
export function useAdminPurse(): boolean {
  useWallet();
  return adminOn();
}

// ---------------------------------------------------------------- actions

type Claimed = { ok: true; wallet: Wallet; lines: Line[]; coins: number; xp: number; levelUp: Payout['levelUp']; achievements: string[]; items?: string[]; bells?: number };

/** Pays a finished game once. Null if it could not be paid (the server could not be reached). */
export async function payFinishedGame(id: string, g: GameReward): Promise<Payout | null> {
  if (online()) {
    try {
      const r = await api<Claimed>('POST', '/api/barn/claim', token(), { gameId: id, reward: g });
      if (r.lines.length) setServer(r.wallet);
      return { wallet: r.wallet, lines: r.lines, coins: r.coins, xp: r.xp, levelUp: r.levelUp, achievements: r.achievements, capped: r.lines.some((l) => l.coins < 0), items: r.items ?? [], bells: r.bells ?? 0 };
    } catch {
      return null;
    }
  }
  const out = payGame(getLocal(), id, g, localDateKey(new Date()));
  if (out.lines.length) setLocal(out.wallet);
  return out;
}

/** Buys a Bell Shelf item with Golden Bells. */
export async function buyItem(id: string): Promise<BuyResult> {
  if (adminOn()) return adminDo((w) => buy(w, id));
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

export type OpenResult = SackResult | { ok: false; reason: 'offline' };

/**
 * Opens a Feed Sack. Signed in, the server rolls it; otherwise the browser does, with crypto. Either way the result is
 * saved before this returns, so the reveal only shows what is already recorded.
 */
export async function openFeedSack(sack: SackId): Promise<OpenResult> {
  if (adminOn()) return adminDo((w) => openSack(w, sack, cryptoRand, Date.now()));
  if (online()) {
    try {
      const r = await api<{ wallet: Wallet; entry: Extract<SackResult, { ok: true }>['entry'] }>('POST', '/api/barn/sack', token(), { sack });
      setServer(r.wallet);
      return { ok: true, wallet: normalise(r.wallet), entry: r.entry };
    } catch (e) {
      const code = (e as { code?: string }).code;
      return { ok: false, reason: code === 'short' || code === 'complete' ? code : 'offline' };
    }
  }
  const r = openSack(getLocal(), sack, cryptoRand, Date.now());
  if (r.ok) setLocal(r.wallet);
  return r;
}

export async function equipItem(id: string): Promise<void> {
  if (remote()) {
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
      const r = await api<{ wallet: Wallet; granted: string[]; changed?: boolean }>('POST', '/api/barn/streak', token(), { best });
      if (r.changed || r.granted.length) setServer(r.wallet);
      return r.granted;
    } catch { return []; }
  }
  const r = grantStreakItems(getLocal(), best);
  if (r.changed) setLocal(r.wallet);
  return r.granted;
}

/** Tests only. */
export function resetWalletForTests() { local = null; server = null; purse = null; purseFor = null; heldView = null; }
export { freshWallet };
