import { describe, expect, it } from 'vitest';
import { streakRow } from '../streakRow';

const m = 'missed' as const, p = 'played' as const;

describe('streakRow: the streak fills its boxes from the left', () => {
  it('a first night played fills the first box', () => {
    expect(streakRow([m, m, m, m, m, m, p], 1)).toEqual([p, 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
  });
  it('each night fills the next box', () => {
    expect(streakRow([m, m, m, m, p, p, p], 3)).toEqual([p, p, p, 'empty', 'empty', 'empty', 'empty']);
  });
  it('tonight not yet played is ringed in the next box', () => {
    expect(streakRow([m, m, m, m, p, p, 'today'], 2)).toEqual([p, p, 'today', 'empty', 'empty', 'empty', 'empty']);
    expect(streakRow([m, m, m, m, m, m, 'today'], 0)).toEqual(['today', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
  });
  it('a run keeps its blankets and repairs in place', () => {
    expect(streakRow([m, m, m, p, 'blanket', 'repair', p], 4)).toEqual([p, 'blanket', 'repair', p, 'empty', 'empty', 'empty']);
  });
  it('a full week fills the row, and the eighth night starts it again', () => {
    expect(streakRow([p, p, p, p, p, p, p], 7)).toEqual([p, p, p, p, p, p, p]);
    expect(streakRow([p, p, p, p, p, p, p], 8)).toEqual([p, 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
    expect(streakRow([p, p, p, p, p, p, 'today'], 7)).toEqual([p, p, p, p, p, p, p]);
  });
});
