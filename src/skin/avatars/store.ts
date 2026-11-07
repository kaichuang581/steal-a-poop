import { useSyncExternalStore } from 'react';
import { ADMIN_AVATAR_ID, isAvatarId } from '../../avatars/ids';
import type { AvatarId } from '../../avatars/ids';
import { isAdmin } from '../../lib/admin';

const KEY = 'sap:avatar';
const subs = new Set<() => void>();

/** The avatar picked on this device, or null for the plain sheep. The admin avatar only counts while admin is unlocked. */
export function getAvatar(): AvatarId | null {
  try {
    const v = localStorage.getItem(KEY);
    if (!isAvatarId(v)) return null;
    return v === ADMIN_AVATAR_ID && !isAdmin() ? null : v;
  } catch { return null; }
}
export function setAvatar(id: AvatarId | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}
/** Lets the admin store tell avatar watchers to look again (locking takes the admin avatar off). */
export function pokeAvatar(): void { subs.forEach((f) => f()); }
export function useAvatar(): AvatarId | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getAvatar, () => null);
}
