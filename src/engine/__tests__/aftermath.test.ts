import { describe, expect, it } from 'vitest';
import { AFTERMATH_MS, PASS_MIN_MS } from '../constants';
import { advance, apply, replaceWithBot } from '../reducer';
import { ctx, freezeBots, humanTurn } from './helpers';

/**
 * After a bomb goes off the table takes a beat: the next sheep's fuse is lit AFTERMATH_MS later and its whole turn
 * runs from then (Brian, 2026-11-13: "people only get 3s when it says 5s or 10s ... make some sort of a pause").
 */
describe('the beat after a bomb', () => {
  const timedOut = () => {
    const g = humanTurn('c');
    const end = g.turn!.endsAt;
    return { end, after: freezeBots(advance(g, ctx, end)) };
  };

  it('a time-out lights the next fuse AFTERMATH_MS later, for a whole turn', () => {
    const { end, after } = timedOut();
    expect(after.events.some((e) => e.kind === 'timeout')).toBe(true);
    const t = after.turn!;
    expect(t.seat).toBe(1);
    expect(t.startedAt).toBe(end + AFTERMATH_MS);
    expect(t.endsAt).toBe(t.startedAt + t.durationMs);
  });

  it('the next sheep is not timed out until its own turn has run its length after the beat', () => {
    const { after } = timedOut();
    const t = after.turn!;
    const almost = advance(after, ctx, t.endsAt - 1);
    expect(almost.turn!.seat).toBe(1);
    expect(almost.events.filter((e) => e.kind === 'timeout')).toHaveLength(1);
    const over = advance(after, ctx, t.endsAt);
    expect(over.events.filter((e) => e.kind === 'timeout')).toHaveLength(2);
  });

  it('a bot waits out the beat before it answers', () => {
    const g = humanTurn('c');
    const after = advance(g, ctx, g.turn!.endsAt);
    expect(after.turn!.botActAt).not.toBeNull();
    expect(after.turn!.botActAt!).toBeGreaterThan(after.turn!.startedAt);
  });

  it('a bot that takes over the seat that is up next still waits for the fuse', () => {
    // Seat 0 times out, seat 1 is a person who leaves a moment into the beat.
    const { end, after } = timedOut();
    const s = structuredClone(after);
    s.players[1].isHuman = true;
    s.turn!.botActAt = null;
    const taken = replaceWithBot(s, 1, 'easy', end + 200);
    expect(taken.turn!.botActAt!).toBeGreaterThan(taken.turn!.startedAt);
  });

  it('a word played normally starts the next turn at once: only a bomb makes the table wait', () => {
    const g = humanTurn('c');
    const at = g.turn!.startedAt + 500;
    const res = apply(g, ctx, { type: 'play', seat: 0, word: 'cat' }, at);
    expect(res.accepted).toBe(true);
    expect(res.state.turn!.startedAt).toBe(at);
  });

  it('a bomb passed during the beat hands on a whole turn at most, never the beat as well', () => {
    // Seat 0 times out; make seat 1 a person, who passes at once, before the fuse is lit.
    const { end, after } = timedOut();
    const s = structuredClone(after);
    s.players[1].isHuman = true;
    const res = apply(s, ctx, { type: 'pass', seat: 1 }, end + 100);
    expect(res.accepted).toBe(true);
    const next = res.state.turn!;
    expect(next.durationMs).toBe(Math.max(PASS_MIN_MS, s.turn!.durationMs));
    expect(next.startedAt).toBe(end + 100);
  });
});
