import { describe, expect, it } from 'vitest';
import { AFTERMATH_MS, ANNOUNCE_MS, ANNOUNCE_TAIL_MS, INTRO_MS, STUCK_LIMIT } from '../constants';
import { advance, apply, roundAnnouncements } from '../reducer';
import type { GameState } from '../types';
import { ctx, freezeBots, humanTurn } from './helpers';

/**
 * Brian, 2026-11-23: (1) a round's announcement "popups up WHILE the timer is ticking ... make the event popup actually
 * stall the timer"; (3) "after 2 people die to the same thing, the bomb resets with a new letter".
 */

/** Seat 0 on the last turn of round `round`: everyone else has taken their turns. */
function lastTurnOf(round: number, deck?: GameState['modifierDeck']): GameState {
  const s = freezeBots(humanTurn('c'));
  s.round = round as GameState['round'];
  if (deck) s.modifierDeck = deck;
  const per = s.settings.turnsPerRound;
  s.players.forEach((p, i) => { p.turnsTaken = i === 0 ? per - 1 : per; });
  return s;
}

describe('a round\'s announcements hold the table before the first fuse', () => {
  it('a round that ends on a bomb: the intro waits out the bang, then gives each announcement its time', () => {
    const g = lastTurnOf(1);
    const end = g.turn!.endsAt;
    const after = advance(g, ctx, end);
    expect(after.round).toBe(2);
    expect(after.phase).toBe('intro');
    const a = roundAnnouncements(after), n = Number(a.faster) + Number(a.twist);
    expect(a.faster).toBe(true); // 15 s turns to 10 s
    expect(n).toBeGreaterThan(0);
    expect(after.introEndsAt).toBe(end + AFTERMATH_MS + n * ANNOUNCE_MS + ANNOUNCE_TAIL_MS);
    // The screen is told when to start announcing: after the bang.
    expect(after.events.filter((e) => e.kind === 'roundStart').at(-1)!.amount).toBe(AFTERMATH_MS);
  });

  it('no clock runs while the announcements are up; the first fuse is lit, whole, when they are done', () => {
    const g = lastTurnOf(1);
    const after = advance(g, ctx, g.turn!.endsAt);
    const held = advance(after, ctx, after.introEndsAt! - 1);
    expect(held.phase).toBe('intro');
    expect(held.turn).toBeNull();
    const go = advance(after, ctx, after.introEndsAt!);
    expect(go.phase).toBe('playing');
    expect(go.turn!.startedAt).toBe(after.introEndsAt);
    expect(go.turn!.endsAt - go.turn!.startedAt).toBe(go.turn!.durationMs);
  });

  it('a round that ends on a word announces at once', () => {
    const g = lastTurnOf(1);
    const at = g.turn!.startedAt + 300;
    const res = apply(g, ctx, { type: 'play', seat: 0, word: 'cat' }, at);
    expect(res.state.phase).toBe('intro');
    const a = roundAnnouncements(res.state), n = Number(a.faster) + Number(a.twist);
    expect(res.state.introEndsAt).toBe(at + n * ANNOUNCE_MS + ANNOUNCE_TAIL_MS);
  });

  it('a round with nothing to announce keeps the plain intro', () => {
    // Past the last speed-up, with no twists.
    const g = lastTurnOf(5, Array(12).fill('none'));
    const end = g.turn!.endsAt;
    const after = advance(g, ctx, end);
    expect(roundAnnouncements(after)).toEqual({ faster: false, twist: false });
    expect(after.introEndsAt).toBe(end + Math.max(AFTERMATH_MS, INTRO_MS));
  });

  it('the tutorial and practice announce nothing', () => {
    const g = lastTurnOf(1);
    expect(roundAnnouncements({ ...g, mode: 'tour', round: 2 })).toEqual({ faster: false, twist: false });
    expect(roundAnnouncements({ ...g, mode: 'practice', round: 2 })).toEqual({ faster: false, twist: false });
  });
});

describe('two sheep in a row run out on one letter: a new letter', () => {
  const timeOut = (s: GameState) => freezeBots(advance(s, ctx, s.turn!.endsAt));

  it('one time-out keeps the letter; the second on the same letter moves the chain to another', () => {
    const one = timeOut(humanTurn('c'));
    expect(one.chainLetter).toBe('c');
    expect(one.stuck).toEqual({ letter: 'c', count: 1 });
    const two = timeOut(one);
    expect(STUCK_LIMIT).toBe(2);
    expect(two.chainLetter).not.toBe('c');
    // Never a corner letter: the reset is a fresh start, not another trap.
    expect(['x', 'z', 'q', 'j', 'y', 'k']).not.toContain(two.chainLetter);
    expect(two.stuck).toBeNull();
    const reset = two.events.find((e) => e.kind === 'chainReset');
    expect(reset?.text).toMatch(/2 sheep in a row ran out on C/);
    // The new letter is set before the next sheep's fuse is lit.
    expect(two.turn!.startedAt).toBeGreaterThan(reset!.at);
  });

  it('a word in between starts the count again', () => {
    const one = timeOut(humanTurn('c'));
    const t = one.turn!;
    const s = structuredClone(one);
    s.players[t.seat].isHuman = true; // let the test play seat 1's word
    const played = apply(s, ctx, { type: 'play', seat: t.seat, word: 'cat' }, t.startedAt + 100);
    expect(played.accepted).toBe(true);
    expect(played.state.stuck).toBeNull();
    const again = timeOut(freezeBots(played.state));
    expect(again.chainLetter).toBe('t');
    expect(again.stuck).toEqual({ letter: 't', count: 1 });
  });
});
