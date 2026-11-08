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
    expect(TYPE_X).toBe(650);
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

describe('the nightly dream (V4 Part 15)', () => {
  const NIGHT = { fences: 30, bumps: 3 };
  /** Clears every fence except those at `miss`. */
  function night(miss: number[], length: { fences: number; bumps: number } | null = NIGHT, dt = 16) {
    const L = freshLive(SEED);
    const log = { stumbles: [] as number[], bumps: 0, asleep: 0 };
    for (let t = 0; t < 900000; t += dt) {
      L.t += dt;
      const a = activeFence(L);
      if (a && !miss.includes(a.index)) { a.locked = true; a.word = a.f.source; }
      const over = update(L, dt, SEED, { stumble: (n) => log.stumbles.push(n), bump: () => { log.bumps++; }, asleep: () => { log.asleep++; } }, length);
      if (over) break;
    }
    return { L, log };
  }

  it('puts the farmer to sleep at the last fence and spawns nothing past it', () => {
    const { L, log } = night([]);
    expect(L.asleepAt).not.toBeNull();
    expect(L.crashAt).toBeNull();
    expect(L.count).toBe(30);
    expect(L.reached).toBe(30);
    expect(L.next).toBe(30);
    expect(log).toEqual({ stumbles: [], bumps: 0, asleep: 1 });
    expect(update(L, 16, SEED, { asleep: () => { throw new Error('slept twice'); } }, NIGHT)).toBe(true);
  });

  it('survives two bumps: the fence goes flat, the sheep stops for a moment, the fence counts as reached but no sheep', () => {
    const { L, log } = night([4, 12]);
    expect(log.stumbles).toEqual([1, 2]);
    expect(L.bumps).toEqual([4, 12]);
    expect(L.asleepAt).not.toBeNull();
    expect(L.reached).toBe(30);
    expect(L.count).toBe(28);
  });

  it('wakes the farmer on the third bump, where it happened', () => {
    const { L, log } = night([4, 12, 20]);
    expect(log.stumbles).toEqual([1, 2]);
    expect(log.bumps).toBe(1);
    expect(L.crashAt).not.toBeNull();
    expect(L.asleepAt).toBeNull();
    expect(L.bumps).toEqual([4, 12, 20]);
    expect(L.count).toBe(18);
  });

  it('holds the sheep for the stumble, then runs again', () => {
    const L = freshLive(SEED);
    let stumbledAt = -1, resumedAt = -1;
    for (let t = 0; t < 30000 && resumedAt < 0; t += 16) {
      L.t += 16;
      const before = L.dist;
      update(L, 16, SEED, { stumble: () => { stumbledAt = L.t; } }, NIGHT);
      if (stumbledAt > 0 && L.t > stumbledAt + 16 && L.dist > before) resumedAt = L.t;
    }
    expect(resumedAt - stumbledAt).toBeGreaterThanOrEqual(700);
    expect(resumedAt - stumbledAt).toBeLessThan(760);
  });

  it('never bumps a fence the sheep took off for, even at a low frame rate', () => {
    for (const dt of [16, 33, 50]) {
      const L = freshLive(SEED);
      for (let t = 0; t < 900000; t += dt) {
        L.t += dt;
        const a = activeFence(L);
        if (a) { a.locked = true; a.word = a.f.source; }
        if (update(L, dt, SEED, {}, NIGHT)) break;
      }
      expect(L.bumps).toEqual([]);
      expect(L.count).toBe(30);
    }
  });

  it('keeps practice endless: no last fence, and the first bump ends it', () => {
    const { L, log } = night([35], null);
    expect(L.asleepAt).toBeNull();
    expect(log).toEqual({ stumbles: [], bumps: 1, asleep: 0 });
    expect(L.count).toBe(35);
  });

  it('gives a perfect typist time for every fence: nothing is bumped when words come at once', () => {
    for (const d of ['2026-11-08', '2026-11-09', '2026-11-10']) {
      const seed = dreamSeed(d), L = freshLive(seed);
      for (let t = 0; t < 900000; t += 16) {
        L.t += 16;
        const a = activeFence(L);
        if (a) { a.locked = true; a.word = a.f.source; }
        if (update(L, 16, seed, {}, NIGHT)) break;
      }
      expect(L.bumps).toEqual([]);
      expect(L.count).toBe(30);
    }
  });
});
