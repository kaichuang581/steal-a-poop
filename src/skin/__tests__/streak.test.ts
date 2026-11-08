import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markStarted, recordResult } from '../../lib/daily';
import { streakDays } from '../model/useTableView';

// A minimal in-memory localStorage for the node test environment.
beforeEach(() => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size; },
  } as Storage;
});
afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

const day = (d: string) => new Date(`${d}T12:00:00Z`);
const finish = (date: string) => recordResult({ date, status: 'done', rank: 1, players: 6, banked: 10, longest: 5 });

describe('streakDays', () => {
  it('lights every day of a streak, not just today', () => {
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) finish(d);
    expect(streakDays(day('2026-11-04'))).toEqual([false, false, false, true, true, true, true]);
  });

  it('a streak that ended yesterday stays lit while today is not played yet', () => {
    for (const d of ['2026-11-02', '2026-11-03']) finish(d);
    expect(streakDays(day('2026-11-04'))).toEqual([false, false, false, false, true, true, false]);
  });

  it('today counts as soon as it is started', () => {
    finish('2026-11-03');
    markStarted('2026-11-04');
    expect(streakDays(day('2026-11-04'))).toEqual([false, false, false, false, false, true, true]);
  });

  it('a broken streak shows nothing before today', () => {
    finish('2026-11-01');
    expect(streakDays(day('2026-11-04'))).toEqual([false, false, false, false, false, false, false]);
  });
});
