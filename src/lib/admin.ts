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
/** The admin panel's "unlimited Wool Coins" switch (src/skin/shop/store.ts), on this device only. */
const COINS_KEY = 'sap:admin-coins';
/**
 * SHA-256 of the admin password. Never write the password itself into the repo (not in tests either; they set their own
 * hash). The old one leaked that way and was changed on 2026-11-08; it was changed again on 2026-11-15, to a password Kai
 * chose and typed into a chat. That one is not random, so a determined reader of the bundle could guess it back from this
 * hash: it is a convenience lock and unlocks nothing that reaches other players. Change it to a long random one when it matters.
 */
export const ADMIN_HASH = '4303a4957aae4dbf0d0c392f5e0bb4690b8b8be1f032f07d5692b960c8248f90';
let adminHash = ADMIN_HASH;
/** Tests only: compare against the hash of a password the test makes up. */
export const setAdminHashForTests = (hash: string) => { adminHash = hash; };

interface AdminStore {
  admin: boolean;
  /** Unlimited Wool Coins in the Trading Post, while admin is unlocked. */
  coins: boolean;
  setCoins(on: boolean): void;
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
  coins: load<boolean>(COINS_KEY, false),
  setCoins(on) {
    save(COINS_KEY, on);
    set({ coins: on });
  },
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
