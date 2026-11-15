import { describe, expect, it } from 'vitest';
import { RoomManager, botsFor } from './rooms';
import { MAX_BOTS, MIN_TABLE, QUEUE_QUIET_MS } from './types';
import { ctx } from '../src/engine/__tests__/helpers';

// A lobby's empty seats (Brian, 2026-11-14: "remove the option to add bots. just add in the bots after the 15 sec thing
// i stated"): the host no longer chooses bots; like the casual queue, seats fill one at a time after a quiet spell, and
// the host still opens the gate.
function lobby(people: number) {
  let t = 1_000_000, seed = 99;
  const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => ((seed = (seed * 48271) % 2147483647), seed % n) });
  const made = m.createRoom('host', 'Host', { visibility: 'private' });
  if (!made.ok) throw new Error('create failed');
  for (let i = 1; i < people; i++) { t += 10; const j = m.join(`p${i}`, `P${i}`, made.code); if (!j.ok) throw new Error(j.error); }
  const at = (ms: number) => { t = 1_000_000 + ms; m.tick(); };
  const table = () => m.room(made.code)!.game!.players;
  return { m, code: made.code, at, table, view: () => m.view(made.code)! };
}

describe('empty seats in a lobby', () => {
  it('nothing fills a seat before the quiet spell, and alone the host cannot start', () => {
    const { m, at, view } = lobby(1);
    at(QUEUE_QUIET_MS - 100);
    expect(view().botNames).toEqual([]);
    expect(m.start('host')).toEqual({ ok: false, error: 'not_enough_players' });
  });

  it('after the quiet spell seats fill one at a time to four, and the lobby waits for its host', () => {
    const { m, at, view, table } = lobby(1);
    for (let ms = 0; ms <= QUEUE_QUIET_MS + 20_000; ms += 100) at(ms);
    expect(view().botNames).toHaveLength(MIN_TABLE - 1);
    expect(view().phase).toBe('lobby');
    expect(view().startAt).toBeNull();
    expect(m.start('host').ok).toBe(true);
    expect(table().map((p) => p.isHuman)).toEqual([true, false, false, false]);
    expect(table().slice(1).map((p) => p.name)).toEqual(view().botNames);
  });

  it('two friends can start at once, just the two of them', () => {
    const { m, table } = lobby(2);
    expect(m.start('host').ok).toBe(true);
    expect(table()).toHaveLength(2);
    expect(table().every((p) => p.isHuman)).toBe(true);
  });

  it('a friend who comes in takes a filled seat once the table is full', () => {
    const { m, code, at, view } = lobby(1);
    for (let ms = 0; ms <= QUEUE_QUIET_MS + 20_000; ms += 100) at(ms);
    expect(view().botNames).toHaveLength(3);
    expect(m.join('f', 'Friend', code).ok).toBe(true);
    expect(view().members).toHaveLength(2);
    expect(view().botNames).toHaveLength(2);
  });

  it('a host\'s old bots number (from an older client) changes nothing', () => {
    const { m, code } = lobby(1);
    expect(m.setOptions('host', { bots: MAX_BOTS }).ok).toBe(true);
    expect(botsFor(m.room(code)!)).toBe(0);
    expect(m.start('host')).toEqual({ ok: false, error: 'not_enough_players' });
  });

  it('a ranked table never fills a seat', () => {
    let t = 0;
    const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => n - 1 });
    const r = m.rankedJoin('a', 'A');
    t = QUEUE_QUIET_MS * 3;
    m.tick();
    expect(r.ok && m.view(r.code)!.botNames).toEqual([]);
  });

  it('the rules the game is dealt with are the room\'s game length and nothing else', () => {
    const { m, code } = lobby(2);
    m.setOptions('host', { lives: 5, turnsPerRound: 3, twists: false });
    m.start('host');
    const settings = m.room(code)!.game!.settings as unknown as Record<string, unknown>;
    expect(settings).toMatchObject({ lives: 5, turnsPerRound: 3, twists: false });
    expect('bots' in settings || 'botLevel' in settings).toBe(false);
  });
});
