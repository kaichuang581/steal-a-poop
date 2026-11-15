import { describe, expect, it } from 'vitest';
import { RoomManager, rankedPlaces } from '../rooms';
import { RANKED_FULL_WAIT_MS, RANKED_WAIT_MS } from '../types';
import type { Room } from '../types';
import { ctx } from '../../src/engine/__tests__/helpers';
import { RankedService } from './service';
import { MemoryRankedStore } from './store';

function manager(onFinished?: (room: Room) => void) {
  let t = 1_000_000;
  let seed = 12345;
  const randomInt = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const m = new RoomManager({ ctx, now: () => t, randomInt, onFinished });
  return { m, tick: (ms: number) => { t += ms; return m.tick(); }, clock: () => t };
}
const sit = (m: RoomManager, ...ids: string[]) => ids.map((id) => { const r = m.rankedJoin(id, id); if (!r.ok) throw new Error(`${id}: ${r.error}`); return r; });

describe('the ranked queue', () => {
  it('puts players at the same waiting table, four at most, and opens another after that', () => {
    const { m } = manager();
    const [a, b, c, d, e] = sit(m, 'a', 'b', 'c', 'd', 'e');
    expect(a.created).toBe(true);
    expect([b.code, c.code, d.code]).toEqual([a.code, a.code, a.code]);
    expect(e.created).toBe(true);
    expect(e.code).not.toBe(a.code);
    expect(m.view(a.code)).toMatchObject({ ranked: true, queue: true, max: 4, min: 2 });
    expect(m.view(a.code)!.members).toHaveLength(4);
  });

  it('waits alone, counts down from the second player, and starts by itself', () => {
    const { m, tick, clock } = manager();
    const [a] = sit(m, 'a');
    expect(m.view(a.code)!.startAt).toBeNull();
    tick(60_000);
    expect(m.view(a.code)!.phase).toBe('lobby'); // one player never starts
    sit(m, 'b');
    expect(m.view(a.code)!.startAt).toBe(clock() + RANKED_WAIT_MS);
    tick(RANKED_WAIT_MS - 1);
    expect(m.view(a.code)!.phase).toBe('lobby');
    expect(tick(1)).toContain(a.code);
    expect(m.view(a.code)).toMatchObject({ phase: 'playing', startAt: null });
  });

  it('a full table starts in a few seconds instead of waiting the rest of the count', () => {
    const { m, tick, clock } = manager();
    const [a] = sit(m, 'a', 'b');
    tick(2_000);
    sit(m, 'c', 'd');
    expect(m.view(a.code)!.startAt).toBe(clock() + RANKED_FULL_WAIT_MS);
    tick(RANKED_FULL_WAIT_MS);
    expect(m.view(a.code)!.phase).toBe('playing');
  });

  it('stops the count when it is down to one player again', () => {
    const { m, tick } = manager();
    const [a] = sit(m, 'a', 'b');
    m.leave('b');
    expect(m.view(a.code)!.startAt).toBeNull();
    tick(RANKED_WAIT_MS * 2);
    expect(m.view(a.code)!.phase).toBe('lobby');
  });

  it('seats people only: two players are a table of two, with no farm sheep', () => {
    const { m, tick } = manager();
    const [a] = sit(m, 'a', 'b');
    tick(RANKED_WAIT_MS);
    const game = m.room(a.code)!.game!;
    expect(game.players).toHaveLength(2);
    expect(game.players.every((p) => p.isHuman)).toBe(true);
    const { m: m3, tick: tick3 } = manager();
    const [x] = sit(m3, 'x', 'y', 'z');
    tick3(RANKED_WAIT_MS);
    expect(m3.room(x.code)!.game!.players.map((p) => p.isHuman)).toEqual([true, true, true]);
  });

  it('has no host: nobody can start it early, change its rules, kick or mute', () => {
    const { m } = manager();
    sit(m, 'a', 'b');
    expect(m.start('a')).toEqual({ ok: false, error: 'ranked_room' });
    expect(m.setOptions('a', { lives: 5 })).toEqual({ ok: false, error: 'ranked_room' });
    expect(m.kick('a', 'b')).toEqual({ ok: false, error: 'ranked_room' });
    expect(m.setMute('a', true, 'b')).toEqual({ ok: false, error: 'ranked_room' });
  });

  it('cannot be reached by code, by Quick play or from the public list', () => {
    const { m } = manager();
    const [a] = sit(m, 'a');
    expect(m.join('z', 'Zed', a.code)).toEqual({ ok: false, error: 'room_not_found' });
    const quick = m.quickJoin('q', 'Quinn');
    expect(quick.ok && quick.code !== a.code && quick.created).toBe(true);
    expect(m.listPublic().some((r) => r.code === a.code)).toBe(false);
    // And the ranked queue never lands in a casual room.
    expect(sit(m, 'r')[0].code).toBe(a.code);
  });

  it('an ordinary room is not ranked and still fills with farm sheep', () => {
    const { m } = manager();
    const made = m.createRoom('h', 'Host', { visibility: 'public' });
    if (!made.ok) throw new Error('create failed');
    m.join('g', 'Guest', made.code);
    expect(m.start('h').ok).toBe(true);
    expect(m.view(made.code)).toMatchObject({ ranked: false, startAt: null, rated: null });
    expect(m.room(made.code)!.game!.players).toHaveLength(4);
  });
});

describe('the finishing order of a ranked game', () => {
  function played(n: number) {
    const k = manager();
    const ids = ['a', 'b', 'c', 'd'].slice(0, n);
    const [first] = sit(k.m, ...ids);
    k.tick(n === 4 ? RANKED_FULL_WAIT_MS : RANKED_WAIT_MS);
    return { ...k, room: k.m.room(first.code)! };
  }
  const freeze = (room: Room, userId: string, at: number) => {
    const p = room.game!.players[room.seatOf[userId] ?? room.ratedSeats.find((s) => s.userId === userId)!.seat];
    p.frozen = true; p.frozenAt = at; p.lives = 0;
  };

  it('the last sheep standing is first, and whoever froze later is ahead of whoever froze sooner', () => {
    const { room } = played(4);
    freeze(room, 'c', 100);
    freeze(room, 'a', 200);
    freeze(room, 'd', 300);
    expect(rankedPlaces(room)).toEqual([{ userId: 'b', place: 1 }, { userId: 'd', place: 2 }, { userId: 'a', place: 3 }, { userId: 'c', place: 4 }]);
  });

  it('walking out counts from that moment, whatever the farm sheep that takes the seat does next', () => {
    const { m, room, clock } = played(3);
    freeze(room, 'c', clock() - 500); // c is out first
    m.leave('a');                      // then a walks out: a farm sheep takes the seat and plays on
    expect(room.game!.players[0].isHuman).toBe(false);
    expect(rankedPlaces(room)).toEqual([{ userId: 'b', place: 1 }, { userId: 'a', place: 2 }, { userId: 'c', place: 3 }]);
  });

  it('a plain room has no finishing order to rate', () => {
    const { m } = manager();
    const made = m.createRoom('h', 'Host', { visibility: 'public' });
    if (!made.ok) throw new Error('create failed');
    m.join('g', 'Guest', made.code);
    m.start('h');
    expect(rankedPlaces(m.room(made.code)!)).toEqual([]);
  });
});

describe('ratings', () => {
  const service = (names: Record<string, string | null> = {}) => {
    let t = 5_000;
    const store = new MemoryRankedStore();
    const s = new RankedService(store, () => t, async (id) => (id in names ? names[id] : id.toUpperCase()));
    return { s, store, pass: (ms: number) => (t += ms) };
  };

  it('a newcomer is unrated at 0 until their first ranked game', async () => {
    const { s, store } = service();
    expect(await s.me('a')).toEqual({ rating: 0, games: 0, wins: 0, peak: 0 });
    expect(store.rows.size).toBe(0);
    expect(await s.load('a')).toBe(0);
    expect(s.cached('a')).toBe(0);
  });

  it('a finished game moves everyone by the ladder\'s maths, and counts the game, the win and the peak', async () => {
    const { s, store } = service();
    store.rows.set('a', { rating: 1200, games: 9, wins: 4, peak: 1260, updatedAt: 1 });
    store.rows.set('b', { rating: 1200, games: 3, wins: 1, peak: 1200, updatedAt: 1 });
    const r = await s.finish([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }]);
    expect(r.a).toEqual({ before: 1200, after: 1216, delta: 16, place: 1 });
    expect(r.b).toEqual({ before: 1200, after: 1184, delta: -16, place: 2 });
    expect(await s.me('a')).toEqual({ rating: 1216, games: 10, wins: 5, peak: 1260 });
    expect(await s.me('b')).toEqual({ rating: 1184, games: 4, wins: 1, peak: 1200 });
    expect(s.cached('a')).toBe(1216);
  });

  it('uses the stored rating, never a number a room might hand it', async () => {
    const { s } = service();
    await s.finish([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }]);
    const again = await s.finish([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }]);
    expect(again.a.before).toBe(16);
    expect(again.b.before).toBe(0);
  });

  it('lists the best first, by name only, with the asker marked and placed', async () => {
    const { s, store } = service({ hidden: null });
    store.rows.set('ann', { rating: 900, games: 5, wins: 2, peak: 900, updatedAt: 1 });
    store.rows.set('bob', { rating: 1500, games: 8, wins: 5, peak: 1500, updatedAt: 1 });
    store.rows.set('hidden', { rating: 2000, games: 8, wins: 7, peak: 2000, updatedAt: 1 });
    store.rows.set('new', { rating: 0, games: 0, wins: 0, peak: 0, updatedAt: 1 });
    const board = await s.boardFor('ann');
    expect(board.top).toEqual([
      { place: 1, name: 'BOB', rating: 1500, games: 8, wins: 5, you: false },
      { place: 2, name: 'ANN', rating: 900, games: 5, wins: 2, you: true },
    ]);
    expect(JSON.stringify(board)).not.toMatch(/"userId"|hidden/);
    expect(board.you).toEqual({ place: 3, of: 3 }); // the hidden player still counts ahead; the one with no games does not
    expect((await s.boardFor('new')).you).toBeNull();
  });

  it('forgets a player who deletes their account', async () => {
    const { s, store } = service();
    await s.finish([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }]);
    await s.erase('a');
    expect(store.rows.has('a')).toBe(false);
    expect(s.cached('a')).toBeUndefined();
    expect((await s.boardFor('b')).top.map((x) => x.name)).toEqual(['B']);
  });
});
