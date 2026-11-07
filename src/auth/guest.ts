import { useSyncExternalStore } from 'react';

/** A guest has no account: just a username, kept in this browser on this device. Everything the game saves is saved there too. */
export interface Guest { nickname: string; createdAt: number }

const KEY = 'sap:guest';
const subs = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: Guest | null = null;

export function getGuest(): Guest | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return cached; }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const g = raw ? (JSON.parse(raw) as Guest) : null;
    cached = g && typeof g.nickname === 'string' && g.nickname ? g : null;
  } catch { cached = null; }
  return cached;
}

export function saveGuest(nickname: string): Guest {
  const g: Guest = { nickname, createdAt: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage blocked: the guest lasts until the page closes */ }
  cachedRaw = JSON.stringify(g);
  cached = g;
  subs.forEach((f) => f());
  return g;
}

export function forgetGuest(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  cachedRaw = null;
  cached = null;
  subs.forEach((f) => f());
}

export function useGuest(): Guest | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getGuest, () => null);
}
