import { describe, expect, it } from 'vitest';
import { RoomManager, botsFor } from './rooms';
import { MAX_BOTS, MAX_ROOM_SIZE } from './types';
import { ctx } from '../src/engine/__tests__/helpers';

// A lobby's host chooses who sits down: people only, farm sheep only, or both (Brian, 2026-11-14: "in create lobby they
// can choose whether to ADD bots. so they can play only with bots, only players, or bots and players").
function lobby(people: number) {
  let t = 1_000_000, seed = 99;
  const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => ((seed = (seed * 48271) % 2147483647), seed % n) });
  const made = m.createRoom('host', 'Host', { visibility: 'private' });
  if (!made.ok) throw new Error('create failed');
  for (let i = 1; i < people; i++) { t += 10; const j = m.join(`p${i}`, `P${i}`, made.code); if (!j.ok) throw new Error(j.error); }
  const table = () => m.room(made.code)!.game!.players;
  return { m, code: made.code, table };
}

describe('farm sheep in a lobby', () => {
  it('only bots: one person and the farm sheep they added is a game', () => {
    const { m, table } = lobby(1);
    expect(m.setOptions('host', { bots: 3, botLevel: 'hard' }).ok).toBe(true);
    expect(m.start('host').ok).toBe(true);
    expect(table().map((p) => p.isHuman)).toEqual([true, false, false, false]);
    expect(table().slice(1).every((p) => p.difficulty === 'hard')).toBe(true);
  });

  it('only players: with no farm sheep added, two people are a table of two', () => {
    const { m, table } = lobby(2);
    m.setOptions('host', { bots: 0 });
    expect(m.start('host').ok).toBe(true);
    expect(table()).toHaveLength(2);
    expect(table().every((p) => p.isHuman)).toBe(true);
  });

  it('bots and players: everyone who came, and the farm sheep on top', () => {
    const { m, table } = lobby(3);
    m.setOptions('host', { bots: 2, botLevel: 'easy' });
    expect(m.start('host').ok).toBe(true);
    expect(table().map((p) => p.isHuman)).toEqual([true, true, true, false, false]);
    expect(table().slice(3).every((p) => p.difficulty === 'easy')).toBe(true);
  });

  it('a game needs two at the table: alone with no farm sheep it will not start, with one it will', () => {
    const { m, table } = lobby(1);
    m.setOptions('host', { bots: 0 });
    expect(m.start('host')).toEqual({ ok: false, error: 'not_enough_players' });
    m.setOptions('host', { bots: 1 });
    expect(m.start('host').ok).toBe(true);
    expect(table()).toHaveLength(2);
  });

  it('never seats more than the table holds', () => {
    const { m, code, table } = lobby(MAX_ROOM_SIZE - 2);
    m.setOptions('host', { bots: MAX_BOTS });
    expect(botsFor(m.room(code)!)).toBe(2);
    m.start('host');
    expect(table()).toHaveLength(MAX_ROOM_SIZE);
  });

  it('a lobby whose host never chose keeps the old rule: two people, farm sheep to fill the table of four', () => {
    const alone = lobby(1);
    expect(alone.m.view(alone.code)!.settings).toMatchObject({ bots: null, botLevel: 'medium' });
    expect(alone.m.start('host')).toEqual({ ok: false, error: 'not_enough_players' });
    const two = lobby(2);
    two.m.start('host');
    expect(two.table().map((p) => p.isHuman)).toEqual([true, true, false, false]);
  });

  it('takes only a whole number from none to the most allowed, and one of the three levels', () => {
    const { m, code } = lobby(1);
    for (const bad of [-1, MAX_BOTS + 1, 1.5, '3', null, Number.NaN]) expect(m.setOptions('host', { bots: bad }), String(bad)).toEqual({ ok: false, error: 'bad_settings' });
    expect(m.setOptions('host', { botLevel: 'insane' })).toEqual({ ok: false, error: 'bad_settings' });
    expect(m.view(code)!.settings).toMatchObject({ bots: null, botLevel: 'medium' });
    expect(m.setOptions('host', { bots: MAX_BOTS, botLevel: 'easy' }).ok).toBe(true);
    expect(m.view(code)!.settings).toMatchObject({ bots: MAX_BOTS, botLevel: 'easy' });
  });

  it('is the host\'s to set, and not at all in the Quick play queue or at a ranked table', () => {
    const { m } = lobby(2);
    expect(m.setOptions('p1', { bots: 2 })).toEqual({ ok: false, error: 'not_host' });
    const q = lobby(1).m;
    const quick = q.quickJoin('solo', 'Solo');
    if (!quick.ok) throw new Error('quick failed');
    expect(q.setOptions('solo', { bots: 2 })).toEqual({ ok: false, error: 'bad_settings' });
    expect(q.start('solo')).toEqual({ ok: false, error: 'not_enough_players' }); // the queue still waits for a second person
    const r = lobby(1).m;
    r.rankedJoin('a', 'A');
    expect(r.setOptions('a', { bots: 2 })).toEqual({ ok: false, error: 'ranked_room' });
  });

  it('the rules the game is dealt with are the room\'s game length and nothing else', () => {
    const { m, code } = lobby(1);
    m.setOptions('host', { bots: 2, lives: 5, turnsPerRound: 3, twists: false });
    m.start('host');
    const settings = m.room(code)!.game!.settings as unknown as Record<string, unknown>;
    expect(settings).toMatchObject({ lives: 5, turnsPerRound: 3, twists: false });
    expect('bots' in settings || 'botLevel' in settings).toBe(false);
  });
});
