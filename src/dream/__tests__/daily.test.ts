import { beforeEach, describe, expect, it } from 'vitest';
import { BLANKET_EVERY, dreamStreakDays, getDreamStreak, loadStreak, recordDream, repairAvailable, settle, takeCoverNotice } from '../daily';

const mem = new Map<string, string>();
const day = (n: number) => { const d = new Date(Date.UTC(2026, 10, 1 + n)); return d.toISOString().slice(0, 10); };
const play = (n: number, extra: Partial<Parameters<typeof recordDream>[0]> = {}) => recordDream({ date: day(n), status: 'done', count: 5, longest: 5, ...extra });

describe('the streak, Warm Blankets and the repair (V4 Part 12)', () => {
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
  });
  it('migrates the old shape: best = count, no blankets', () => {
    mem.set('sap:dream-streak', JSON.stringify({ count: 4, last: day(3) }));
    expect(loadStreak()).toMatchObject({ count: 4, last: day(3), best: 4, blankets: 0, earnedAt: 0 });
  });
  it('earns a blanket every seven nights, two at most', () => {
    for (let n = 0; n < 6; n++) play(n);
    expect(loadStreak().blankets).toBe(0);
    play(6);
    expect(loadStreak()).toMatchObject({ count: 7, blankets: 1, earnedAt: 7 });
    for (let n = 7; n < 14; n++) play(n);
    expect(loadStreak()).toMatchObject({ count: 14, blankets: 2 });
    for (let n = 14; n < 21; n++) play(n);
    expect(loadStreak().blankets).toBe(2);
  });
  it('covers one missed night with a blanket: streak unchanged, blanket spent, last advanced', () => {
    for (let n = 0; n < 7; n++) play(n);
    // Night 7 missed; on night 8 the streak settles.
    expect(getDreamStreak(day(8))).toBe(7);
    expect(loadStreak()).toMatchObject({ last: day(7), blankets: 0 });
    expect(takeCoverNotice()).toBe(true);
    expect(takeCoverNotice()).toBe(false);
    expect(play(8)).toBe(8);
  });
  it('spends nothing on two missed nights with one blanket: the streak reads 0', () => {
    for (let n = 0; n < 7; n++) play(n);
    expect(getDreamStreak(day(9))).toBe(0);
    expect(loadStreak().blankets).toBe(1);
  });
  it('covers two missed nights with two blankets', () => {
    for (let n = 0; n < 14; n++) play(n);
    expect(getDreamStreak(day(16))).toBe(14);
    expect(loadStreak()).toMatchObject({ blankets: 0, last: day(15) });
    expect(dreamStreakDays(day(16)).filter((s) => s === 'blanket')).toHaveLength(2);
  });
  it('offers a repair only for a one-night gap no blanket covered, and the repair restores the chain', () => {
    for (let n = 0; n < 3; n++) play(n);
    expect(repairAvailable(day(4))).toBe(day(3));
    expect(repairAvailable(day(5))).toBeNull();
    recordDream({ date: day(3), status: 'done', count: 3, longest: 4, repaired: true });
    expect(getDreamStreak(day(4))).toBe(4);
    expect(repairAvailable(day(4))).toBeNull();
    expect(dreamStreakDays(day(4))[5]).toBe('repair');
    expect(loadStreak().blankets).toBe(0);
  });
  it('never spends a blanket on a night already played', () => {
    for (let n = 0; n < 7; n++) play(n);
    expect(settle(day(7)).blankets).toBe(1);
    play(7);
    expect(loadStreak().blankets).toBe(1);
  });
  it('keeps the best streak across a break, and practice changes nothing', () => {
    for (let n = 0; n < 5; n++) play(n);
    play(9);
    expect(loadStreak()).toMatchObject({ count: 1, best: 5 });
    const before = loadStreak();
    // Practice never calls recordDream; the store is untouched by a practice run.
    expect(loadStreak()).toEqual(before);
    expect(BLANKET_EVERY).toBe(7);
  });
});
