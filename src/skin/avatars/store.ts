import { useSyncExternalStore } from 'react';
import { isAdminAvatar, isAvatarId } from '../../avatars/ids';
import type { AvatarId } from '../../avatars/ids';
import { isAdmin } from '../../lib/admin';

const KEY = 'sap:avatar';
const subs = new Set<() => void>();
/**
 * The saved pick as storage last gave it; undefined until first asked. `useAvatar` reads this, not storage: React asks
 * a store for its snapshot on every render, and the game screens that wear the avatar render many times a second
 * (plan file 17, change 11). It is read again whenever it can have changed: a pick or the admin lock on this page,
 * another tab's pick, and any direct `getAvatar()`.
 */
let kept: AvatarId | null | undefined;

function readSaved(): AvatarId | null {
  try {
    const v = localStorage.getItem(KEY);
    return isAvatarId(v) ? v : null;
  } catch { return null; }
}
/** An admin avatar only counts while admin is unlocked. */
const worn = (v: AvatarId | null): AvatarId | null => (isAdminAvatar(v) && !isAdmin() ? null : v);
const refresh = () => { kept = readSaved(); subs.forEach((f) => f()); };

/** The avatar picked on this device, or null for the plain sheep. The admin avatar only counts while admin is unlocked. Reads storage. */
export function getAvatar(): AvatarId | null {
  return worn(kept = readSaved());
}
export function setAvatar(id: AvatarId | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  refresh();
}
/** Lets the admin store tell avatar watchers to look again (locking takes the admin avatar off). */
export function pokeAvatar(): void { refresh(); }

const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) refresh(); };
function watch(f: () => void): () => void {
  // Another tab's pick is heard here; the page's own picks go through setAvatar.
  if (subs.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  subs.add(f);
  return () => {
    subs.delete(f);
    if (subs.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
/** What is kept, without touching storage (the first call reads it). */
const snapshot = (): AvatarId | null => worn(kept === undefined ? (kept = readSaved()) : kept);

export function useAvatar(): AvatarId | null {
  return useSyncExternalStore(watch, snapshot, () => null);
}
