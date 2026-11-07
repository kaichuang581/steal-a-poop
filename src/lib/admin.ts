import { create } from 'zustand';
import { load, save } from './storage';

/**
 * Admin access: a single password (no username) unlocks everything on this device: the night's dream can be played
 * again and again, for a start. The password is never stored or shipped in clear: only its SHA-256 is compared, and
 * the unlocked state is kept in local storage until it is locked again. This is a convenience lock for the game's
 * owner, not a security boundary: anything the client can do, a determined reader of the bundle can do too.
 */
const ADMIN_KEY = 'sap:admin';
/** SHA-256 of the admin password. */
export const ADMIN_HASH = '4303a4957aae4dbf0d0c392f5e0bb4690b8b8be1f032f07d5692b960c8248f90';

interface AdminStore {
  admin: boolean;
  unlock(password: string): Promise<boolean>;
  lock(): void;
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return '';
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const useAdmin = create<AdminStore>((set) => ({
  admin: load<boolean>(ADMIN_KEY, false),
  async unlock(password) {
    const ok = (await sha256Hex(password.trim())) === ADMIN_HASH;
    if (ok) { save(ADMIN_KEY, true); set({ admin: true }); }
    return ok;
  },
  lock() {
    save(ADMIN_KEY, false);
    set({ admin: false });
  },
}));

/** Read outside React. */
export const isAdmin = () => useAdmin.getState().admin;
