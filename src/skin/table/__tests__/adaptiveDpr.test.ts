import { describe, expect, it } from 'vitest';
import { believeSettled, DPR_STEP, DPR_WINDOW_S, keepSettled, nextDpr, RETRY_S, SETTLED_DAYS } from '../Rendering';
import type { DprStreak } from '../Rendering';

// Brian, 2026-11-09: "make the game less laggy without removing anything ... optimize this for all devices".
// Replaced in milestone 2 of the visual overhaul (plan file 17, change 10): the judge measures against the frame
// governor's target, and a level it found too slow is tried again instead of being refused for good.
describe('the resolution judge', () => {
  const fresh = (): DprStreak => ({ slow: 0, fast: 0, ceiling: Infinity });
  const MS60 = 1000 / 60, MS30 = 1000 / 30;
  /** `seconds` of half-second looks at `avgMs` a frame, from time `t`: the level it ends on, and the time. */
  const play = (d: number, avgMs: number, seconds: number, s: DprStreak, t: number, look: { targetMs?: number; climb?: boolean } = {}) => {
    for (let i = 0; i < seconds / DPR_WINDOW_S; i++) { t += DPR_WINDOW_S; d = nextDpr(d, avgMs, s, 0.75, 2, { ...look, now: t }); }
    return [d, t] as const;
  };

  it('steps down after two somewhat slow looks in a row', () => {
    const s = fresh();
    expect(nextDpr(2, 24, s, 0.75, 2)).toBe(2);
    expect(nextDpr(2, 24, s, 0.75, 2)).toBe(2 - DPR_STEP);
  });

  it('steps down at once when the rate is clearly too low', () => {
    const s = fresh();
    expect(nextDpr(2, 33, s, 0.75, 2)).toBe(2 - DPR_STEP);
  });

  it('ignores a single somewhat slow look between good ones', () => {
    const s = fresh();
    expect(nextDpr(2, 24, s, 0.75, 2)).toBe(2);
    expect(nextDpr(2, 16.7, s, 0.75, 2)).toBe(2);
    expect(nextDpr(2, 24, s, 0.75, 2)).toBe(2);
  });

  it('never goes under the floor', () => {
    const s = fresh();
    let d = 1;
    for (let i = 0; i < 20; i++) d = nextDpr(d, 50, s, 0.75, 2);
    expect(d).toBe(0.75);
  });

  it('climbs when there is room under the ceiling', () => {
    const s: DprStreak = { slow: 0, fast: 0, ceiling: 2 };
    let d = 1.25;
    for (let i = 0; i < 15; i++) d = nextDpr(d, 16.6, s, 0.75, 2);
    expect(d).toBe(1.25); // eight seconds are sixteen half-second looks
    d = nextDpr(d, 16.6, s, 0.75, 2);
    expect(d).toBe(1.5);
  });

  it('holds steady at a middling rate', () => {
    const s = fresh();
    let d = 1.5;
    for (let i = 0; i < 30; i++) d = nextDpr(d, 19, s, 0.75, 2);
    expect(d).toBe(1.5);
  });

  it('holds the level at 30 pictures a second when 30 is what the governor asks for', () => {
    const s = fresh();
    // Home at rest: neither slow (it is on its target) nor a reason to draw finer (the pace shows nothing).
    const [d] = play(1.5, MS30, 120, s, 0, { targetMs: MS30, climb: false });
    expect(d).toBe(1.5);
    expect(s.ceiling).toBe(Infinity);
    // The same frames against the full rate are clearly slow.
    expect(nextDpr(1.5, MS30, fresh(), 0.75, 2, { targetMs: MS60 })).toBe(1.5 - DPR_STEP);
  });

  it('still steps down at a slow pace the device cannot keep', () => {
    const s = fresh();
    expect(nextDpr(1.5, 60, s, 0.75, 2, { targetMs: MS30, climb: false })).toBe(1.5 - DPR_STEP);
  });

  it('judges a 144 Hz screen against 72 pictures a second', () => {
    const target = 2 * (1000 / 144), s = fresh();
    expect(nextDpr(2, target, s, 0.75, 2, { targetMs: target })).toBe(2);
    // Every third refresh instead of every second: slow, twice running.
    expect(nextDpr(2, 3 * (1000 / 144), s, 0.75, 2, { targetMs: target })).toBe(2);
    expect(nextDpr(2, 3 * (1000 / 144), s, 0.75, 2, { targetMs: target })).toBe(2 - DPR_STEP);
  });

  it('after 10 fps, 60 s at 60 fps restores the level', () => {
    const s = fresh();
    let d = 2, t = 0;
    [d, t] = play(d, 100, 0.5, s, t); // one clearly slow look
    expect(d).toBe(2 - DPR_STEP);
    expect(s.ceiling).toBe(2);
    [d, t] = play(d, MS60, RETRY_S - 1, s, t);
    expect(d).toBe(2 - DPR_STEP); // refused until the wait is over, however smooth
    [d, t] = play(d, MS60, 1, s, t);
    expect(d).toBe(2);
    // And once it has held there, it is no longer a refused level.
    [d, t] = play(d, MS60, 8, s, t);
    expect(d).toBe(2);
    expect(s.ceiling).toBe(Infinity);
  });

  it('comes all the way back from the floor', () => {
    const s = fresh();
    let d = 2, t = 0;
    [d, t] = play(d, 100, 5, s, t);
    expect(d).toBe(0.75);
    [d, t] = play(d, MS60, RETRY_S + 5 * 8, s, t);
    expect(d).toBe(2);
  });

  it('waits twice as long each time the same level fails again', () => {
    const s = fresh();
    let d = 1.5, t = 0;
    [d, t] = play(d, 100, 0.5, s, t);
    expect([d, s.tries]).toEqual([1.25, 1]);
    [d, t] = play(d, MS60, RETRY_S, s, t);
    expect(d).toBe(1.5); // tried again
    [d, t] = play(d, 100, 0.5, s, t);
    expect([d, s.tries]).toEqual([1.25, 2]); // and too slow again
    [d, t] = play(d, MS60, 2 * RETRY_S - 1, s, t);
    expect(d).toBe(1.25);
    [d, t] = play(d, MS60, 1, s, t);
    expect(d).toBe(1.5);
  });

  it('believes a kept level only from this judge, and only for a week', () => {
    const now = Date.UTC(2026, 10, 16), day = 86_400_000;
    const kept = keepSettled({ dpr: 1.25, ceiling: 1.5, tries: 2 }, now);
    expect(believeSettled(kept, now + day)).toEqual({ dpr: 1.25, ceiling: 1.5, tries: 2 });
    expect(believeSettled(kept, now + (SETTLED_DAYS + 1) * day)).toBeNull();
    expect(believeSettled(keepSettled({ dpr: 1, ceiling: Infinity, tries: 0 }, now), now)).toEqual({ dpr: 1, ceiling: Infinity, tries: 0 });
    // What the judge kept before its repair, which refused a level for good after one slow second.
    expect(believeSettled('{"dpr":0.75,"ceiling":1,"v":2}', now)).toBeNull();
    expect(believeSettled('not json', now)).toBeNull();
    expect(believeSettled(null, now)).toBeNull();
  });
});
