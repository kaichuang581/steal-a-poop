import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BlockList } from '../blocks';
import { MemoryAccountStore } from '../auth/store';
import type { Profile } from '../auth/store';
import { CODE_ALPHABET, FriendsService, MAX_FRIENDS, MemoryFriendStore, PostgresFriendStore, makeCode, normalizeCode } from './friends';
import type { FriendStore } from './friends';

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  userId: id, nickname: id.toUpperCase(), emailHash: 'h', dateOfBirth: '1990-01-01', country: 'CA', consentStatus: 'not_required', leaderboardVisible: true,
  isModerator: false, sessionsValidAfter: 0, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
});

describe('friend codes', () => {
  it('are 8 unambiguous characters, and typed codes are cleaned up', () => {
    const code = makeCode();
    expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{8}$`));
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
    expect(normalizeCode(' abcd-2345 ')).toBe('ABCD2345');
  });
});

function setup(store: FriendStore = new MemoryFriendStore()) {
  const accounts = new MemoryAccountStore();
  const blocks = new BlockList();
  const online = new Set<string>();
  let n = 0;
  const svc = new FriendsService({ store, accounts, blocks, now: () => 1000, online: (id) => online.has(id), makeCode: () => `CODE${String(++n).padStart(4, '0')}` });
  const add = async (id: string, over: Partial<Profile> = {}) => void (await accounts.createProfile(profile(id, over)));
  return { svc, accounts, blocks, online, add, store };
}

function flows(make: () => FriendStore) {
  it('gives each player a stable code and can change it', async () => {
    const { svc, add } = setup(make());
    await add('a');
    const first = await svc.myCode('a');
    expect(first).toMatch(/^CODE\d{4}$/);
    expect(await svc.myCode('a')).toBe(first);
    const second = await svc.resetCode('a');
    expect(second).not.toBe(first);
    expect(await svc.request('b-not-a-user', first!)).toEqual({ ok: false, reason: 'not_allowed' }); // and the old code no longer finds anyone
  });

  it('a request is accepted by the other side, then both are friends', async () => {
    const { svc, add } = setup(make());
    await add('a');
    await add('b');
    const codeB = (await svc.myCode('b'))!;
    expect(await svc.request('a', codeB.toLowerCase())).toEqual({ ok: true, state: 'sent' });
    expect(await svc.request('a', codeB)).toEqual({ ok: false, reason: 'already_requested' });
    expect((await svc.list('b'))!.incoming.map((f) => f.userId)).toEqual(['a']);
    expect((await svc.list('a'))!.outgoing.map((f) => f.userId)).toEqual(['b']);
    expect(await svc.accept('a', 'b')).toBe(false); // you cannot accept your own request
    expect(await svc.accept('b', 'a')).toBe(true);
    expect(await svc.areFriends('a', 'b')).toBe(true);
    expect((await svc.list('a'))!.friends.map((f) => f.name)).toEqual(['B']);
    expect(await svc.request('b', (await svc.myCode('a'))!)).toEqual({ ok: false, reason: 'already_friends' });
  });

  it('asking someone who already asked you makes you friends at once', async () => {
    const { svc, add } = setup(make());
    await add('a');
    await add('b');
    await svc.request('a', (await svc.myCode('b'))!);
    expect(await svc.request('b', (await svc.myCode('a'))!)).toEqual({ ok: true, state: 'accepted' });
    expect(await svc.areFriends('a', 'b')).toBe(true);
  });

  it('decline, cancel and unfriend all just remove the link', async () => {
    const { svc, add } = setup(make());
    await add('a');
    await add('b');
    await svc.request('a', (await svc.myCode('b'))!);
    await svc.remove('b', 'a');
    expect((await svc.list('b'))!.incoming).toEqual([]);
    await svc.request('a', (await svc.myCode('b'))!);
    await svc.accept('b', 'a');
    await svc.remove('a', 'b');
    expect(await svc.areFriends('a', 'b')).toBe(false);
  });

  it('unknown codes, yourself, and children who cannot use friends all look like "no such code" or are refused', async () => {
    const { svc, add, accounts } = setup(make());
    await add('a');
    await add('kid', { consentStatus: 'pending' });
    await add('gone', { deletedAt: 5 });
    expect(await svc.myCode('kid')).toBeNull(); // a child waiting for consent has no code
    expect(await svc.request('kid', 'ANYTHING')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await svc.request('a', 'NOPE1234')).toEqual({ ok: false, reason: 'unknown_code' });
    expect(await svc.request('a', (await svc.myCode('a'))!)).toEqual({ ok: false, reason: 'self' });
    await add('c');
    const codeC = (await svc.myCode('c'))!;
    await accounts.updateProfile('c', { deletedAt: 5 }); // deleted after getting a code: the code no longer finds them
    expect(await svc.request('a', codeC)).toEqual({ ok: false, reason: 'unknown_code' });
    await accounts.updateProfile('c', { deletedAt: null, consentStatus: 'withdrawn' }); // a child whose consent was withdrawn
    expect(await svc.request('a', codeC)).toEqual({ ok: false, reason: 'unknown_code' });
  });

  it('blocks: you cannot ask someone you blocked; someone who blocked you never learns of the request and never gets it', async () => {
    const { svc, add, blocks } = setup(make());
    await add('a');
    await add('b');
    const codeB = (await svc.myCode('b'))!;
    blocks.block('a', 'b');
    expect(await svc.request('a', codeB)).toEqual({ ok: false, reason: 'blocked_by_you' });
    blocks.unblock('a', 'b');
    blocks.block('b', 'a');
    expect(await svc.request('a', codeB)).toEqual({ ok: true, state: 'sent' }); // looks like it worked
    expect((await svc.list('b'))!.incoming).toEqual([]);
    blocks.unblock('b', 'a');
    await svc.request('a', codeB);
    expect((await svc.list('b'))!.incoming).toHaveLength(1);
    blocks.block('b', 'a'); // blocking later hides the existing request too
    expect((await svc.list('b'))!.incoming).toEqual([]);
  });

  it('shows who is online, online first', async () => {
    const { svc, add, online } = setup(make());
    for (const id of ['a', 'b', 'c']) await add(id);
    for (const id of ['b', 'c']) {
      await svc.request('a', (await svc.myCode(id))!);
      await svc.accept(id, 'a');
    }
    online.add('c');
    expect((await svc.list('a'))!.friends.map((f) => [f.name, f.online])).toEqual([['C', true], ['B', false]]);
  });

  it('erasing a player removes their code and every link', async () => {
    const { svc, add } = setup(make());
    await add('a');
    await add('b');
    const codeA = (await svc.myCode('a'))!;
    await svc.request('b', codeA);
    await svc.accept('a', 'b');
    await svc.erase('a');
    expect(await svc.areFriends('a', 'b')).toBe(false);
    expect((await svc.list('b'))!.friends).toEqual([]);
    expect(await svc.request('b', codeA)).toEqual({ ok: false, reason: 'unknown_code' });
  });
}

describe('FriendsService (memory)', () => {
  flows(() => new MemoryFriendStore());
  it('stops at the friend limit', async () => {
    const { svc, add, store } = setup();
    await add('a');
    await add('z');
    for (let i = 0; i < MAX_FRIENDS; i++) {
      await store.createRequest('a', `f${String(i).padStart(3, '0')}`, 1);
      await store.accept('a', `f${String(i).padStart(3, '0')}`, 1);
    }
    expect(await svc.request('a', (await svc.myCode('z'))!)).toEqual({ ok: false, reason: 'limit' });
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('FriendsService against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/103_friends.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists friend_codes, friendships cascade');
    await pool.query(migration);
  });
  it('the migration can be run twice', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
  });
  flows(() => new PostgresFriendStore(pool));
  it('a pair can exist only once and in order, and row security is on', async () => {
    const s = new PostgresFriendStore(pool);
    expect(await s.createRequest('b', 'a', 1)).toBe(true);
    expect(await s.createRequest('a', 'b', 2)).toBe(false);
    await expect(pool.query("insert into friendships values ('z','a','z','pending',1,1)")).rejects.toThrow();
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname in ('friend_codes','friendships') and relkind = 'r'");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
