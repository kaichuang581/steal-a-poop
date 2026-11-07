import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPracticeBest, recordPracticeRun } from '../practice';

describe('practice high scores', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  });

  it('keeps one best per clock and bot level', () => {
    expect(recordPracticeRun(10, 'hard', 7)).toEqual({ score: 7, best: 7, isNew: true });
    expect(getPracticeBest(10, 'hard')).toBe(7);
    expect(getPracticeBest(10, 'easy')).toBe(0);
    expect(getPracticeBest(15, 'hard')).toBe(0);
  });

  it('a lower or equal score leaves the best alone', () => {
    recordPracticeRun(5, 'easy', 4);
    expect(recordPracticeRun(5, 'easy', 3)).toEqual({ score: 3, best: 4, isNew: false });
    expect(recordPracticeRun(5, 'easy', 4).isNew).toBe(false);
    expect(getPracticeBest(5, 'easy')).toBe(4);
  });

  it('a run with no words is never a new best', () => {
    expect(recordPracticeRun(15, 'medium', 0).isNew).toBe(false);
  });
});
