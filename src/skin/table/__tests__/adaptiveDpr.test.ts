import { describe, expect, it } from 'vitest';
import { DPR_STEP, nextDpr } from '../Rendering';

// Brian, 2026-11-09: "make the game less laggy without removing anything ... optimize this for all devices".
describe('the resolution governor', () => {
  const fresh = () => ({ slow: 0, fast: 0, ceiling: Infinity });

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

  it('climbs back after eight smooth seconds, but never to a level that was too slow', () => {
    const s = fresh();
    let d = 2;
    d = nextDpr(d, 24, s, 0.75, 2); d = nextDpr(d, 24, s, 0.75, 2); // 1.75, and 2 was too slow
    d = nextDpr(d, 24, s, 0.75, 2); d = nextDpr(d, 24, s, 0.75, 2); // 1.5, and 1.75 was too slow
    expect(d).toBe(1.5);
    for (let i = 0; i < 40; i++) d = nextDpr(d, 16.6, s, 0.75, 2);
    expect(d).toBe(1.5); // 1.75 already proved too slow
  });

  it('climbs when there is room under the ceiling', () => {
    const s = { slow: 0, fast: 0, ceiling: 2 };
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
});
