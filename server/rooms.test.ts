import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_PATTERN, generateCode, normalizeCode } from './codes';
import { RoomManager } from './rooms';
import { ctx } from '../src/engine/__tests__/helpers';

function manager() {
  let t = 1_000_000;
  let seed = 12345;
  const randomInt = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const m = new RoomManager({ ctx, now: () => t, randomInt });
  return { m, tick: (ms: number) => (t += ms), clock: () => t };
}

/** Creates a room with `n` members, "u0" hosting. Returns the code. */
function lobby(m: RoomManager, n: number, visibility: 'public' | 'private' = 'public', tick?: (ms: number) => number) {
  const made = m.createRoom('u0', 'Host', { visibility });
  if (!made.ok) throw new Error('create failed');
  for (let i = 1; i < n; i++) {
    tick?.(10);
    const j = m.join(`u${i}`, `Player${i}`, made.code);
    if (!j.ok) throw new Error(`join ${i} failed: ${j.error}`);
  }
  return made.code;
}

describe('room codes', () => {
  it('uses only unambiguous characters', () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
    expect(CODE_ALPHABET).toHaveLength(32);
  });
  it('generates well-formed codes that are never already taken', () => {
    const taken = new Set<string>();
    let seed = 7;
    const randomInt = (n: number) => ((seed = (seed * 48271) % 2147483647), seed % n);
    for (let i = 0; i < 100_000; i++) {
      const code = generateCode(taken, randomInt);
      expect(CODE_PATTERN.test(code)).toBe(true);
      expect(taken.has(code)).toBe(false);
      taken.add(code);
    }
    expect(taken.size).toBe(100_000);
  });
  it('retries on a collision', () => {
    const calls: number[] = [];
    const sequence = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]; // first code AAAAA is taken, second is BBBBB
    const code = generateCode(new Set(['AAAAA']), (n) => { calls.push(n); return sequence[calls.length - 1] ?? 2; });
    expect(code).toBe('BBBBB');
  });
  it('normalizes typed codes', () => {
    expect(normalizeCode(' ab-cde ')).toBe('ABCDE');
  });
});

describe('creating and joining', () => {
  it('creates a room with the creator as host', () => {
    const { m } = manager();
    const r = m.createRoom('u0', 'Kai', { visibility: 'private', roomName: 'Friday' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(CODE_PATTERN.test(r.code)).toBe(true);
      const v = m.view(r.code)!;
      expect(v.hostId).toBe('u0');
      expect(v.name).toBe('Friday');
      expect(v.phase).toBe('lobby');
    }
  });
  it('lets others join by code, typed any way', () => {
    const { m } = manager();
    const code = lobby(m, 1);
    expect(m.join('u1', 'Ben', code.toLowerCase()).ok).toBe(true);
    expect(m.join('u2', 'Cy', ` ${code.slice(0, 2)}-${code.slice(2)} `).ok).toBe(true);
    expect(m.view(code)!.members).toHaveLength(3);
  });
  it('rejects bad codes, unknown rooms, double joins and empty names', () => {
    const { m } = manager();
    const code = lobby(m, 1);
    expect(m.join('u1', 'Ben', 'nope')).toEqual({ ok: false, error: 'bad_code' });
    expect(m.join('u1', 'Ben', 'ZZZZZ')).toEqual({ ok: false, error: 'room_not_found' });
    expect(m.join('u1', '   ', code)).toEqual({ ok: false, error: 'bad_name' });
    expect(m.join('u0', 'Host', code)).toEqual({ ok: false, error: 'already_in_room' });
    expect(m.createRoom('u0', 'Host', { visibility: 'public' })).toEqual({ ok: false, error: 'already_in_room' });
  });
  it('holds at most ten players', () => {
    const { m } = manager();
    const code = lobby(m, 10);
    expect(m.join('late', 'Late', code)).toEqual({ ok: false, error: 'room_full' });
  });
  it('gives duplicate names a suffix so seats stay distinct', () => {
    const { m } = manager();
    const code = lobby(m, 1);
    m.join('u1', 'Host', code);
    m.join('u2', 'host', code);
    expect(m.view(code)!.members.map((x) => x.name)).toEqual(['Host', 'Host 2', 'host 3']);
  });
});

describe('public and private rooms', () => {
  it('lists open public rooms and never private ones', () => {
    const { m } = manager();
    const pub = lobby(m, 2, 'public');
    m.createRoom('p0', 'Priv', { visibility: 'private' });
    const list = m.listPublic();
    expect(list.map((r) => r.code)).toEqual([pub]);
    expect(list[0]).toMatchObject({ players: 2, max: 10, min: 4, hostName: 'Host' });
  });
  it('drops a public room from the list when it is full', () => {
    const { m, tick } = manager();
    lobby(m, 10, 'public', tick);
    expect(m.listPublic()).toHaveLength(0);
  });
  it('drops a public room from the list once it has started', () => {
    const { m, tick } = manager();
    lobby(m, 4, 'public', tick);
    expect(m.listPublic()).toHaveLength(1);
    m.start('u0');
    expect(m.listPublic()).toHaveLength(0);
  });
  it('a private room can still be joined with its code', () => {
    const { m } = manager();
    const code = lobby(m, 1, 'private');
    expect(m.join('u1', 'Ben', code).ok).toBe(true);
  });
});

describe('starting', () => {
  it('only the host can start, and only with four or more players', () => {
    const { m, tick } = manager();
    const code = lobby(m, 3, 'public', tick);
    expect(m.start('u0')).toEqual({ ok: false, error: 'not_enough_players' });
    m.join('u3', 'Dee', code);
    expect(m.start('u2')).toEqual({ ok: false, error: 'not_host' });
    expect(m.start('stranger')).toEqual({ ok: false, error: 'not_in_room' });
    expect(m.start('u0')).toEqual({ ok: true, code });
  });
  it('never starts by itself, even when the room fills up', () => {
    const { m, tick } = manager();
    const code = lobby(m, 10, 'public', tick);
    expect(m.view(code)!.phase).toBe('lobby');
    expect(m.view(code)!.game).toBeNull();
  });
  it('seats players in join order and runs a real game', () => {
    const { m, tick } = manager();
    const code = lobby(m, 5, 'public', tick);
    m.start('u0');
    const v = m.view(code)!;
    expect(v.phase).toBe('playing');
    expect(v.seatOf).toEqual({ u0: 0, u1: 1, u2: 2, u3: 3, u4: 4 });
    expect(v.game!.players.map((p) => p.name)).toEqual(['Host', 'Player1', 'Player2', 'Player3', 'Player4']);
    expect(v.game!.players.every((p) => p.isHuman)).toBe(true);
  });
  it('cannot be joined once started', () => {
    const { m, tick } = manager();
    const code = lobby(m, 4, 'public', tick);
    m.start('u0');
    expect(m.join('late', 'Late', code)).toEqual({ ok: false, error: 'room_started' });
    expect(m.start('u0')).toEqual({ ok: false, error: 'room_started' });
  });
});

describe('leaving', () => {
  it('frees the spot in the lobby', () => {
    const { m, tick } = manager();
    const code = lobby(m, 4, 'public', tick);
    expect(m.leave('u3').ok).toBe(true);
    expect(m.view(code)!.members).toHaveLength(3);
    expect(m.join('u3', 'Dee', code).ok).toBe(true);
  });
  it('passes host to whoever joined second when the host leaves', () => {
    const { m, tick } = manager();
    const code = lobby(m, 4, 'public', tick);
    const r = m.leave('u0');
    expect(r).toMatchObject({ ok: true, newHostId: 'u1' });
    expect(m.view(code)!.hostId).toBe('u1');
    m.leave('u1');
    expect(m.view(code)!.hostId).toBe('u2');
  });
  it('closes an empty room and releases its code', () => {
    const { m } = manager();
    const code = lobby(m, 1);
    expect(m.leave('u0')).toMatchObject({ ok: true, roomClosed: true });
    expect(m.view(code)).toBeNull();
    expect(m.roomCount).toBe(0);
    expect(m.createRoom('u0', 'Host', { visibility: 'public' }).ok).toBe(true); // free to make another
  });
  it('puts a bot in the seat mid-game, keeping the score', () => {
    const { m, tick } = manager();
    const code = lobby(m, 4, 'public', tick);
    m.start('u0');
    m.room(code)!.game!.players[2].banked = 31;
    const r = m.leave('u2');
    expect(r).toMatchObject({ ok: true, botSeat: 2 });
    const v = m.view(code)!;
    expect(v.game!.players[2].isHuman).toBe(false);
    expect(v.game!.players[2].banked).toBe(31);
    expect(v.members).toHaveLength(3);
    expect('u2' in v.seatOf).toBe(false);
    expect(m.act('u2', { type: 'bank' })).toEqual({ ok: false, error: 'not_in_room' });
  });
  it('keeps the game going when the host leaves mid-game', () => {
    const { m, tick } = manager();
    const code = lobby(m, 4, 'public', tick);
    m.start('u0');
    m.leave('u0');
    expect(m.view(code)!.hostId).toBe('u1');
    expect(m.view(code)!.phase).toBe('playing');
  });
  it('cannot leave twice', () => {
    const { m } = manager();
    lobby(m, 1);
    m.leave('u0');
    expect(m.leave('u0')).toEqual({ ok: false, error: 'not_in_room' });
  });
});

describe('playing', () => {
  function running() {
    const h = manager();
    const code = lobby(h.m, 4, 'public', h.tick);
    h.m.start('u0');
    h.tick(2600); // past the round intro
    h.m.tick();
    const room = h.m.room(code)!;
    room.game = structuredClone(room.game!);
    room.game.chainLetter = 'c';
    room.game.modifier = 'vowel_double';
    return { ...h, code, room };
  }
  it('routes a move to the right seat and enforces whose turn it is', () => {
    const { m, tick } = running();
    expect(m.act('u1', { type: 'play', word: 'cat' })).toMatchObject({ ok: true, result: { accepted: false, reason: 'not_your_turn' } });
    tick(100);
    const r = m.act('u0', { type: 'play', word: 'cat' });
    expect(r).toMatchObject({ ok: true, result: { accepted: true } });
  });
  it('lets another player steal in the last three seconds of a turn, and not before', () => {
    const { m, tick, clock, room } = running();
    tick(100);
    m.act('u0', { type: 'play', word: 'cat' }); // chain letter is now T, seat 1 is up
    const turn = room.game!.turn!;
    expect(turn.seat).toBe(1);
    tick(turn.endsAt - 5000 - clock()); // five seconds left: too early
    const early = m.act('u2', { type: 'steal', word: 'tiger' });
    expect(early).toMatchObject({ ok: true, result: { accepted: false, reason: 'outside_steal_window' } });
    tick(4000); // one second left: inside the window
    const steal = m.act('u2', { type: 'steal', word: 'tiger' });
    expect(steal).toMatchObject({ ok: true, result: { accepted: true } });
    expect(room.game!.players[2].steals).toBe(1);
    expect(room.game!.turn!.seat).toBe(2); // play continues after the victim
  });
  it('rejects actions from people not in a running game', () => {
    const { m } = manager();
    expect(m.act('nobody', { type: 'bank' })).toEqual({ ok: false, error: 'not_in_room' });
    lobby(m, 1);
    expect(m.act('u0', { type: 'bank' })).toEqual({ ok: false, error: 'game_not_running' });
  });
  it('runs timeouts on tick, and marks the room finished at game over', () => {
    const { m, tick, room, code } = running();
    expect(m.tick()).toEqual([]); // nothing due
    tick(10 * 60 * 1000);
    for (let i = 0; i < 400 && room.phase === 'playing'; i++) { tick(60_000); m.tick(); }
    expect(m.view(code)!.phase).toBe('finished');
    expect(m.view(code)!.game!.phase).toBe('gameOver');
  });
});
