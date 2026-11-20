/**
 * SHA-256 of the admin password. Never write the password itself into the repo (not in tests either; they set their own
 * hash). This is the hash of a password that was once written into the repo, so it can be found in git history. It was
 * replaced on 2026-11-08 and restored on 2026-11-15 at Kai's request. No imports, so the game server can read it too
 * (server/adminProof.ts); change it to a long random password's hash if the admin avatar ever matters more.
 */
export const ADMIN_HASH = '4303a4957aae4dbf0d0c392f5e0bb4690b8b8be1f032f07d5692b960c8248f90';
