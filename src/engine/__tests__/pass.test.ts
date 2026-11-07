import { describe, expect, it } from 'vitest';
import { apply } from '../reducer';
import { PASS_MIN_MS } from '../constants';
import { ctx, freezeBots, humanTurn } from './helpers';

describe('passing the bomb', () => {
  it('hands the turn on with the fuse that is left, and counts as a turn', () => {
    const s = humanTurn('c');
    const at = s.turn!.startedAt + 3000;
    const left = s.turn!.endsAt - at;
    const r = apply(freezeBots(s), ctx, { type: 'pass', seat: 0 }, at);
    expect(r.accepted).toBe(true);
    expect(r.state.players[0].turnsTaken).toBe(1);
    expect(r.state.turn!.seat).not.toBe(0);
    expect(r.state.turn!.endsAt - r.state.turn!.startedAt).toBe(Math.max(PASS_MIN_MS, left));
    expect(r.state.chainLetter).toBe('c'); // nothing was played
    expect(r.state.history.at(-1)).toMatchObject({ kind: 'pass', seat: 0 });
    expect(r.state.players[0].lives).toBe(s.players[0].lives); // free
  });
  it('never gives the next sheep less than the floor', () => {
    const s = humanTurn('c');
    const r = apply(freezeBots(s), ctx, { type: 'pass', seat: 0 }, s.turn!.endsAt - 500);
    expect(r.state.turn!.endsAt - r.state.turn!.startedAt).toBe(PASS_MIN_MS);
  });
  it('only on your own turn, and once a round', () => {
    const s = humanTurn('c');
    expect(apply(freezeBots(s), ctx, { type: 'pass', seat: 1 }, s.turn!.startedAt + 100).accepted).toBe(false);
    const again = structuredClone(s);
    again.players[0].passedRound = again.round;
    const r = apply(freezeBots(again), ctx, { type: 'pass', seat: 0 }, again.turn!.startedAt + 100);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('already_passed');
  });
  it('the next turn after the passed one is back to the normal length', () => {
    const s = humanTurn('c');
    const r = apply(freezeBots(s), ctx, { type: 'pass', seat: 0 }, s.turn!.startedAt + 3000);
    expect(r.state.passMs).toBeUndefined();
  });
});
