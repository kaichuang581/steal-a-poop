/**
 * SHA-256 of the admin password. Never write the password itself into the repo (not in tests either; they set their own
 * hash). Changed on 2026-11-28 to a long random password: the one before it had been written into the repo and could be
 * read from git history, which let anyone wear the admin avatars in rooms. No imports, so the game server can read it
 * too (server/adminProof.ts). The password is under 200 characters (the server's limit for a proof).
 */
export const ADMIN_HASH = '6c6fef5d34600fae855bcef70766db4c92123965ba1a2fe650690440be78f462';
