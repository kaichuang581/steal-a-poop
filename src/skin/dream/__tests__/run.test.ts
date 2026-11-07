import { describe, expect, it } from 'vitest';
import { dreamSeed, FIELD } from '../../../dream/dream';
import { activeFence, freshLive, SPAWN_X, TYPE_X, update } from '../run';
import { FIRST_FENCE_AHEAD, WAKE } from '../stage';

const SEED = dreamSeed('2026-11-06');

/** Plays a run: every fence is cleared the moment it opens, for `ms`, then the sheep stops typing and bumps. */
function play(seed: string, clearUntil: number, dt = 16) {
  const L = freshLive(seed);
  const log: string[] = [];
  let bumps = 0;
  for (let t = 0; t < 60000; t += dt) {
    L.t += dt;
    if (t < clearUntil) { const a = activeFence(L); if (a) { a.locked = true; a.word = a.f.source; log.push(`lock:${a.index}@${t}`); } }
    const over = update(L, dt, seed, { bump: () => { bumps++; }, count: (n) => log.push(`count:${n}@${t}`) });
    if (over) break;
  }
  return { L, log, bumps };
}

describe('the run (V4 Part 7.1 and 14)', () => {
  it('starts with the first fence 150 px ahead and converts the windows as specified', () => {
    const L = freshLive(SEED);
    expect(L.fences[0].x).toBe(FIELD.sheepX + FIRST_FENCE_AHEAD);
    expect(SPAWN_X).toBe(344);
    expect(TYPE_X).toBe(390);
  });
  it('is deterministic: the same seed and the same input give the same count and the same events', () => {
    const a = play(SEED, 12000), b = play(SEED, 12000);
    expect(a.L.count).toBe(b.L.count);
    expect(a.log).toEqual(b.log);
    expect(a.L.count).toBeGreaterThan(2);
    expect(play(dreamSeed('2026-11-07'), 12000).log).not.toEqual(a.log);
  });
  it('bumps exactly once, then the run is over and the wake-up finishes at 1500 ms (600 under reduced motion)', () => {
    const { L, bumps } = play(SEED, 5000);
    expect(bumps).toBe(1);
    expect(L.crashAt).not.toBeNull();
    expect(update(L, 16, SEED, { bump: () => { throw new Error('bumped twice'); } })).toBe(true);
    expect(WAKE.finish).toBe(1500);
    expect(WAKE.reducedFinish).toBe(600);
    expect(WAKE.stir).toBe(350);
    expect(WAKE.pop).toBe(600);
    expect(WAKE.dark).toBe(1100);
  });
});
