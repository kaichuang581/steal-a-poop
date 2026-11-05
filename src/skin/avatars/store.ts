import { useSyncExternalStore } from 'react';
import { isAvatarId } from '../../avatars/ids';
import type { AvatarId } from '../../avatars/ids';

const KEY = 'sap:avatar';
const subs = new Set<() => void>();

export function getAvatar(): AvatarId | null {
  try {
    const v = localStorage.getItem(KEY);
    return isAvatarId(v) ? v : null;
  } catch { return null; }
}
export function setAvatar(id: AvatarId | null): void {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}
export function useAvatar(): AvatarId | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getAvatar, () => null);
}
