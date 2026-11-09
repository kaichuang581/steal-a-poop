import { create } from 'zustand';
import { load, save } from './storage';

/**
 * Admin access: a single password (no username) unlocks everything on this device: the night's dream can be played
 * again and again, for a start. The password is never stored or shipped in clear: only its SHA-256 is compared, and
 * the unlocked state is kept in local storage until it is locked again. This is a convenience lock for the game's
 * owner, not a security boundary: anything the client can do, a determined reader of the bundle can do too. So nothing
 * it unlocks may reach other players: the server refuses the admin avatar unless the account is on its own admin list.
 */
const ADMIN_KEY = 'sap:admin';
/**
 * SHA-256 of the admin password: a long random one, so the hash in the bundle cannot be guessed back. Never write the
 * password itself into the repo (not in tests either; they set their own hash). The old one leaked that way and was
 * changed on 2026-11-08.
 */
export const ADMIN_HASH = '5aef0cdc5d379d84e10c41d0ac7c5627622818b0ddae8cf90210ac2f50fe370c';
let adminHash = ADMIN_HASH;
/** Tests only: compare against the hash of a password the test makes up. */
export const setAdminHashForTests = (hash: string) => { adminHash = hash; };

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
    const ok = (await sha256Hex(password.trim())) === adminHash;
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
