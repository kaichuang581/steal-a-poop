import { describe, expect, it } from 'vitest';
import { advance, apply } from '../reducer';
import { createGame } from '../game';
import { validateWord } from '../validation';
import { readFileSync } from 'node:fs';
import { createDictionary } from '../dictionary';
import { T0 } from './helpers';

const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
const ctx = { dict };

// Brian, 2026-11-24: turns were being skipped. Each round used to open one seat further on, so the seat after the
// round's last player was passed over at every round change. The order now just keeps going round the table.
describe('turn order across rounds', () => {
  it('never skips a seat when a round ends', () => {
    let g = createGame({ seed: 'order', now: T0, humans: ['Ana', 'Ben', 'Cy'], playerCount: 4, difficulty: 'easy' }, dict);
    const n = g.players.length;
    let now = T0;
    const seats: number[] = [];
    let last = '';
    while (g.round <= 4 && g.phase !== 'gameOver') {
      if (g.phase === 'intro') { now = g.introEndsAt!; g = advance(g, ctx, now); continue; }
      const t = g.turn!;
      const key = `${t.seat}:${t.startedAt}`;
      if (key !== last) { last = key; seats.push(t.seat); }
      if (!g.players[t.seat].isHuman) { now = Math.min(t.botActAt ?? t.endsAt, t.endsAt); g = advance(g, ctx, now); continue; }
      now = Math.max(now, t.startedAt) + 100;
      const vctx = { dict, chainLetter: g.chainLetter, used: g.used, modifier: g.modifier };
      const word = dict.startingWith(g.chainLetter).find((w) => validateWord(w, vctx).ok);
      if (!word) { now = t.endsAt; g = advance(g, ctx, now); continue; }
      const r = apply(g, ctx, { type: 'play', seat: t.seat, word }, now);
      expect(r.reason ?? 'ok').toBe('ok');
      g = r.state;
    }
    expect(seats.length).toBeGreaterThan(20);
    // Every turn goes to the next seat still in the game.
    seats.forEach((seat, i) => {
      if (!i) return;
      let want = (seats[i - 1] + 1) % n;
      while (g.players[want].frozen && want !== seat) want = (want + 1) % n;
      expect(seat).toBe(want);
    });
  });
});
