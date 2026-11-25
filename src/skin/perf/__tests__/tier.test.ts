import { afterEach, describe, expect, it } from 'vitest';
import {
  applyPendingTier, createSlowWatch, readRemembered, createTierJudge, exemptShot, FAIL_MS, getTier, pendingTier, proposeTier,
  resetTierForTests, resetTierRulesForTests, setExemptShot,
} from '../tier';
import type { FrameSample, Tier } from '../tier';

const T60 = 1000 / 60;
/** Feeds `seconds` of frames from `make(i)` to the judge; returns the first tier it earns, or null. */
function feed(judge: ReturnType<typeof createTierJudge>, seconds: number, make: (i: number) => FrameSample, tier: Tier = 'medium'): Tier | null {
  let t = 0;
  for (let i = 0; t < seconds * 1000; i++) {
    const s = make(i);
    t += s.ms;
    const got = judge.frame(s, tier);
    if (got) return got;
  }
  return null;
}
const at = (ms: number, extra: Partial<FrameSample> = {}): FrameSample => ({ ms, targetMs: T60, atMax: true, atMin: false, ...extra });

afterEach(() => { resetTierForTests(); resetTierRulesForTests(); });

describe('High is earned', () => {
  it('after 10 s of steady frames at full resolution, not before', () => {
    const j = createTierJudge();
    expect(feed(j, 9.5, () => at(T60))).toBeNull();
    expect(feed(j, 1.5, () => at(T60))).toBe('high');
  });

  it('at 30 pictures a second when that is what the governor asked for', () => {
    expect(feed(createTierJudge(), 11, () => at(1000 / 30, { targetMs: 1000 / 30 }))).toBe('high');
  });

  it('not with a median over 1.1 times the target', () => {
    expect(feed(createTierJudge(), 30, () => at(T60 * 1.15))).toBeNull();
  });

  it('not with more than 5% of frames over 1.5 times the target', () => {
    expect(feed(createTierJudge(), 30, (i) => at(i % 10 === 0 ? T60 * 2 : T60))).toBeNull();
    // A hitch now and then (2%) is allowed.
    expect(feed(createTierJudge(), 30, (i) => at(i % 50 === 0 ? T60 * 2 : T60))).toBe('high');
  });

  it('not below full resolution: a step down starts the 10 s again', () => {
    const j = createTierJudge();
    expect(feed(j, 8, () => at(T60))).toBeNull();
    expect(j.frame(at(T60, { atMax: false }), 'medium')).toBeNull();
    expect(feed(j, 8, () => at(T60))).toBeNull();
    expect(feed(j, 3, () => at(T60))).toBe('high');
  });

  it('not across a hidden tab: a long gap starts the count again', () => {
    const j = createTierJudge();
    expect(feed(j, 8, () => at(T60))).toBeNull();
    expect(j.frame(at(5000), 'medium')).toBeNull();
    expect(feed(j, 8, () => at(T60))).toBeNull();
  });
});

describe('Low is fallen to', () => {
  it("when Medium's median is over 1.5 times the target at the lowest resolution", () => {
    expect(feed(createTierJudge(), 6, () => at(T60 * 1.8, { atMax: false, atMin: true }))).toBe('low');
  });

  it('not while the resolution can still come down', () => {
    expect(feed(createTierJudge(), 30, () => at(T60 * 3, { atMax: false, atMin: false }))).toBeNull();
  });

  it('not at 1.4 times the target', () => {
    expect(feed(createTierJudge(), 30, () => at(T60 * 1.4, { atMax: false, atMin: true }))).toBeNull();
  });
});

describe('the tiers move once a session', () => {
  it('only from Medium', () => {
    expect(feed(createTierJudge(), 12, () => at(T60), 'high')).toBeNull();
    expect(feed(createTierJudge(), 12, () => at(T60 * 3, { atMin: true, atMax: false }), 'low')).toBeNull();
  });

  it('waits for a dip or a scene change, and never goes back the other way', () => {
    expect(getTier()).toBe('medium');
    proposeTier('high');
    expect(getTier()).toBe('medium');
    expect(pendingTier()).toBe('high');
    expect(applyPendingTier()).toBe(true);
    expect(getTier()).toBe('high');
    expect(applyPendingTier()).toBe(false);
    proposeTier('low');
    expect(applyPendingTier()).toBe(false);
    expect(getTier()).toBe('high');
  });

  it("keeps the wendigo's shot exempt until the next dip says otherwise", () => {
    expect(exemptShot()).toBe(false);
    setExemptShot(true);
    expect(exemptShot()).toBe(true);
    setExemptShot(false);
    expect(exemptShot()).toBe(false);
  });
});

describe('the failure card', () => {
  const run = (ms: number, seconds: number, w = createSlowWatch()) => {
    let t = 0, out = false;
    while (t < seconds * 1000) { t += ms; out = w.frame(ms); }
    return out;
  };
  it('comes after 10 s under 10 pictures a second, not before', () => {
    expect(run(125, FAIL_MS / 1000 - 1)).toBe(false);
    expect(run(125, FAIL_MS / 1000 + 1)).toBe(true);
  });
  it('not at 12 pictures a second, nor across a hidden tab', () => {
    expect(run(83, 60)).toBe(false);
    const w = createSlowWatch();
    expect(run(125, 8, w)).toBe(false);
    w.frame(5000);
    expect(run(125, 8, w)).toBe(false);
  });
});

describe('A remembered tier', () => {
  const DAY = 86_400_000;
  it('keeps Low for a week, then forgets it', () => {
    expect(readRemembered(`low@${10 * DAY}`, 12 * DAY)).toBe('low');
    expect(readRemembered(`low@${10 * DAY}`, 18 * DAY)).toBeNull();
    expect(readRemembered('low', 12 * DAY)).toBeNull();
  });
  it('reads High with or without a time, and nothing else', () => {
    expect(readRemembered('high')).toBe('high');
    expect(readRemembered('high@5')).toBe('high');
    expect(readRemembered('fast')).toBeNull();
    expect(readRemembered(null)).toBeNull();
  });
});
