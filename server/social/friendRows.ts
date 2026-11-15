import type { Pool } from 'pg';

/**
 * What is left of the friends list. The feature was removed on 2026-11-14 (Brian: "remove friend feature"): the list,
 * friend codes, requests, the online dots and room invites, for accounts and for guests. Its two tables, friend_codes
 * and friendships (db/migrations/103_friends.sql), are still in the database with what players stored before. Nothing
 * reads them any more, but deleting an account must go on taking that person out of them, so this one function stays
 * for as long as the tables do. Drop it together with them.
 */
export async function eraseFriendRows(pool: Pick<Pool, 'query'> | null, userId: string): Promise<void> {
  if (!pool) return;
  await pool.query('delete from friendships where low_id = $1 or high_id = $1', [userId]);
  await pool.query('delete from friend_codes where user_id = $1', [userId]);
}
