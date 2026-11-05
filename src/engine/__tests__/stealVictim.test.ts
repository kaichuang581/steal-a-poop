import { describe, expect, it } from 'vitest';
import { apply } from '../reducer';
import { ctx, freezeBots, humanTurn, T0 } from './helpers';

describe('steal history', () => {
  it('records which seat a steal was taken from', () => {
    const start = T0 + 2500;
    const played = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    const s = freezeBots(played);
    const victim = s.turn!.seat;
    const r = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, s.turn!.endsAt - 1000);
    expect(r.accepted).toBe(true);
    const entry = r.state.history.find((h) => h.kind === 'steal');
    expect(entry).toMatchObject({ seat: 0, word: 'tiger', fromSeat: victim });
  });
});
