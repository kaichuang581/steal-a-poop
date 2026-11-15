import { describe, expect, it } from 'vitest';
import { eraseFriendRows } from './friendRows';

describe('the friends tables after the friends list was removed', () => {
  it('deleting an account still takes the person out of both tables, as either side of a pair', async () => {
    const ran: Array<[string, unknown[]]> = [];
    const pool = { query: async (sql: string, args: unknown[]) => { ran.push([sql, args]); return { rows: [] }; } };
    await eraseFriendRows(pool as never, 'user-1');
    expect(ran).toEqual([
      ['delete from friendships where low_id = $1 or high_id = $1', ['user-1']],
      ['delete from friend_codes where user_id = $1', ['user-1']],
    ]);
  });
  it('is quiet on a server with no database', async () => {
    await expect(eraseFriendRows(null, 'user-1')).resolves.toBeUndefined();
  });
});
