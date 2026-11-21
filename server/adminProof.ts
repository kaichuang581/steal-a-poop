import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Whether `proof` is the admin password: its SHA-256 matches `hash`. The browser sends the password it unlocked admin
 * with next to an admin avatar (src/lib/admin.ts, `adminProof`), so the server, not the page's own lock, decides.
 * Only a person who typed the real password has it; it is not the hash, which anyone can read in the game's code.
 */
export function isAdminProof(proof: unknown, hash: string): boolean {
  if (typeof proof !== 'string' || proof.length === 0 || proof.length > 200) return false;
  const got = createHash('sha256').update(proof.trim()).digest();
  const want = Buffer.from(hash, 'hex');
  return want.length === got.length && timingSafeEqual(got, want);
}
