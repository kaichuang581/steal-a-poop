import { create } from 'zustand';
import { ADMIN_HASH } from './adminHash';
import { load, save } from './storage';

export { ADMIN_HASH };

/**
 * Admin access: a single password (no username) unlocks everything on this device: the night's dream can be played
 * again and again, for a start. The page only compares the password's SHA-256 and keeps the unlocked state in local
 * storage until it is locked again. That lock is a convenience, not a security boundary: anything the client can do, a
 * determined reader of the bundle can do too. So nothing it unlocks may reach other players on its say-so: the server
 * decides who wears the admin avatars, by its own admin list or by the password itself, which unlocking keeps on this
 * device (`adminProof`) and sends with the avatar so the server can check it against the same hash (server/adminProof.ts).
 */
const ADMIN_KEY = 'sap:admin';
/** The admin panel's "unlimited Wool Coins" switch (src/skin/shop/store.ts), on this device only. */
const COINS_KEY = 'sap:admin-coins';
/** The password this device unlocked with, sent to the game server beside an admin avatar. Cleared by Lock. */
const PROOF_KEY = 'sap:admin-proof';
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
    if (ok) { save(ADMIN_KEY, true); save(PROOF_KEY, password.trim()); set({ admin: true }); }
    return ok;
  },
  lock() {
    save(ADMIN_KEY, false);
    save(PROOF_KEY, '');
    set({ admin: false });
  },
}));

/** Read outside React. */
export const isAdmin = () => useAdmin.getState().admin;
/** The password to send with an admin avatar, while admin is unlocked. A device unlocked before this existed has none until it is locked and unlocked once. */
export const adminProof = (): string | null => (isAdmin() ? load<string>(PROOF_KEY, '') || null : null);
