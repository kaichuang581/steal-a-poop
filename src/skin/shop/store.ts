import { useSyncExternalStore } from 'react';
import { load, save } from '../../lib/storage';
import { localDateKey } from '../hooks/useToday';
import { buy, equip, freshWallet, grantStreakItems, normalise, payGame } from './economy';
import type { BuyResult, GameReward, Payout, Wallet } from './economy';

/** The wallet lives in this browser only (guests and signed-in players alike, until the server keeps it). */
export const WALLET_KEY = 'sap:barn';

const subs = new Set<() => void>();
let cached: Wallet | null = null;

export function getWallet(): Wallet {
  if (!cached) cached = normalise(load<unknown>(WALLET_KEY, null));
  return cached;
}
function setWallet(w: Wallet) {
  cached = w;
  save(WALLET_KEY, w);
  subs.forEach((f) => f());
}
/** Reloads after something else wrote the key (the save code's import). */
export function reloadWallet() {
  cached = null;
  subs.forEach((f) => f());
}

export function useWallet(): Wallet {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getWallet, freshWallet);
}

export function payFinishedGame(id: string, g: GameReward): Payout {
  const out = payGame(getWallet(), id, g, localDateKey(new Date()));
  if (out.lines.length) setWallet(out.wallet);
  return out;
}

export function buyItem(id: string): BuyResult {
  const r = buy(getWallet(), id);
  if (r.ok) setWallet(r.wallet);
  return r;
}

export function equipItem(id: string) {
  setWallet(equip(getWallet(), id));
}

export function grantStreak(best: number): string[] {
  const r = grantStreakItems(getWallet(), best);
  if (r.granted.length) setWallet(r.wallet);
  return r.granted;
}

/** Tests only. */
export function resetWalletForTests() { cached = null; }
export { freshWallet };
