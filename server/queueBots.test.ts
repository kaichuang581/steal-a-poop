import { describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { MIN_TABLE, QUEUE_BOT_GAP_MS, QUEUE_FULL_WAIT_MS, QUEUE_QUIET_MS } from './types';
import { ctx } from '../src/engine/__tests__/helpers';
import { PLAYER_NAME_MAX } from '../src/lib/playerNames';
import { isInappropriateName } from '../src/lib/nickname';

// The casual queue (Brian, 2026-11-14: "only make it do bots if after 10 seconds nobody joins. and make it gradual ...
// make it look like actual player generated names").
function queue(start = 7) {
  let t = 1_000_000, seed = start;
  const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => ((seed = (seed * 48271) % 2147483647), seed % n) });
  const made = m.quickJoin('a', 'Ana');
  if (!made.ok) throw new Error('quick join failed');
  const at = (ms: number) => { t = 1_000_000 + ms; return m.tick(); };
  const view = () => m.view(made.code)!;
  return { m, code: made.code, at, view };
}

describe('the casual queue fills with bots', () => {
  it('no bot sits down in the first ten seconds', () => {
    const { at, view } = queue();
    for (let ms = 0; ms < QUEUE_QUIET_MS; ms += 500) at(ms);
    expect(view().botNames).toEqual([]);
    expect(view().startAt).toBeNull();
  });

  it('after ten quiet seconds bots come in one at a time, a gap apart, until the table holds four', () => {
    const { at, view } = queue();
    const joinedAt: number[] = [];
    for (let ms = 0; ms <= QUEUE_QUIET_MS + 20_000; ms += 100) {
      const before = view().botNames.length;
      at(ms);
      if (view().phase !== 'lobby') break;
      const after = view().botNames.length;
      expect(after - before).toBeLessThanOrEqual(1);
      if (after > before) joinedAt.push(ms);
    }
    expect(joinedAt).toHaveLength(MIN_TABLE - 1);
    expect(joinedAt[0]).toBe(QUEUE_QUIET_MS);
    for (let i = 1; i < joinedAt.length; i++) {
      const gap = joinedAt[i] - joinedAt[i - 1];
      expect(gap).toBeGreaterThanOrEqual(QUEUE_BOT_GAP_MS[0]);
      expect(gap).toBeLessThanOrEqual(QUEUE_BOT_GAP_MS[1] + 100);
    }
  });

  it('a full table starts itself, with the bots under their names', () => {
    const { at, view } = queue();
    let ms = 0;
    while (view().botNames.length < MIN_TABLE - 1) at((ms += 100));
    const names = view().botNames;
    expect(view().startAt).toBe(1_000_000 + ms + QUEUE_FULL_WAIT_MS);
    at(ms + QUEUE_FULL_WAIT_MS);
    const players = view().game!.players;
    expect(players.map((p) => p.isHuman)).toEqual([true, false, false, false]);
    expect(players.slice(1).map((p) => p.name)).toEqual(names);
  });

  it('a person coming in starts the quiet over and takes a bot\'s seat once the table is full', () => {
    const { m, code, at, view } = queue();
    at(QUEUE_QUIET_MS); // one bot
    expect(view().botNames).toHaveLength(1);
    at(QUEUE_QUIET_MS + 1_000);
    expect(m.quickJoin('b', 'Bo').ok).toBe(true);
    expect(m.view(code)!.members).toHaveLength(2);
    // Nobody new sits down for another ten seconds after Bo.
    at(QUEUE_QUIET_MS + 1_000 + QUEUE_QUIET_MS - 100);
    expect(view().botNames).toHaveLength(1);
    // The table fills, then a third person takes a bot's seat.
    let ms = QUEUE_QUIET_MS * 2 + 1_000;
    while (view().members.length + view().botNames.length < MIN_TABLE) at((ms += 100));
    expect(view().botNames).toHaveLength(2);
    expect(m.quickJoin('c', 'Cy').ok).toBe(true);
    expect(view().members).toHaveLength(3);
    expect(view().botNames).toHaveLength(1);
  });

  it('four people need no bots, and start themselves', () => {
    const { m, at, view } = queue();
    for (const [id, n] of [['b', 'Bo'], ['c', 'Cy'], ['d', 'Di']]) expect(m.quickJoin(id, n).ok).toBe(true);
    expect(view().startAt).not.toBeNull();
    at(QUEUE_FULL_WAIT_MS);
    expect(view().phase).toBe('playing');
    expect(view().game!.players.every((p) => p.isHuman)).toBe(true);
  });

  it('the first one in can still open the gate early with whoever is there', () => {
    const { m, at, view } = queue();
    at(QUEUE_QUIET_MS);
    expect(view().botNames).toHaveLength(1);
    expect(m.start('a').ok).toBe(true);
    expect(view().game!.players).toHaveLength(2);
  });

  it('a lobby fills its seats the same way but waits for its host; a ranked table never fills', () => {
    let t = 0, k = 0;
    const m = new RoomManager({ ctx, now: () => t, randomInt: (n) => (k++ * 7919) % n });
    const own = m.createRoom('h', 'Host', { visibility: 'public' });
    const ranked = m.rankedJoin('r', 'Rae');
    for (t = 0; t <= QUEUE_QUIET_MS + 20_000; t += 100) m.tick();
    expect(own.ok && m.view(own.code)!.botNames).toHaveLength(MIN_TABLE - 1);
    expect(own.ok && m.view(own.code)!.phase).toBe('lobby');
    expect(ranked.ok && m.view(ranked.code)!.botNames).toEqual([]);
  });

  it('bot names look like players\' own, fit a name plate, pass the name check and never repeat at a table', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { at, view } = queue(1_000 + i * 7_717);
      let ms = 0;
      while (view().botNames.length < MIN_TABLE - 1) at((ms += 250));
      const names = view().botNames;
      expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
      for (const n of names) {
        expect(n.length).toBeLessThanOrEqual(PLAYER_NAME_MAX);
        expect(isInappropriateName(n)).toBe(false);
        expect(n).not.toMatch(/sheep|bot|69|420|666/i);
        seen.add(n);
      }
    }
    expect(seen.size).toBeGreaterThan(80);
  });
});
