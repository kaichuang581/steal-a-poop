import { describe, expect, it } from 'vitest';
import { CHASE, CHASE_READY, CODE_IN, DRAW_TO, expectedSteps, startProgress, stepProgress, withSteps } from '../progress';
import type { Now, Progress } from '../progress';

/** Runs the model frame by frame (16 ms) through `phases`: each a length in ms and what the screen knows then. */
function run(phases: [ms: number, now: Omit<Now, 'now' | 'dt'> | ((t: number) => Omit<Now, 'now' | 'dt'>)][], from = 0) {
  let p: Progress = startProgress(0, from), t = 0;
  const seen: Progress[] = [p];
  for (const [ms, what] of phases) {
    for (let e = 0; e < ms; e += 16) {
      t += 16;
      p = stepProgress(p, { now: t, dt: 16, ...(typeof what === 'function' ? what(t) : what) });
      seen.push(p);
    }
  }
  return seen;
}

describe('the progress shown', () => {
  it('never goes backwards, and never reaches 1 before ready, through a whole load', () => {
    const seen = run([
      [2000, (t) => ({ building: t / 4000, ready: false })],
      [3000, { building: 0.5, ready: false }], // a pause: creep
      [2000, (t) => ({ building: Math.min(1, t / 7000), ready: false })],
      [3000, { building: false, ready: false }],
      [1500, { building: false, ready: true }],
    ]);
    for (let i = 1; i < seen.length; i++) expect(seen[i].shown).toBeGreaterThanOrEqual(seen[i - 1].shown);
    const beforeReady = seen.slice(0, Math.round(10000 / 16));
    expect(Math.max(...beforeReady.map((p) => p.shown))).toBeLessThanOrEqual(DRAW_TO);
    expect(seen[seen.length - 1].shown).toBe(1);
  });

  it('never creeps past its stage\'s end less 0.01: 0.87 while building, 0.96 while drawing', () => {
    const building = run([[150000, { building: 0, ready: false }]]);
    expect(building[building.length - 1].target).toBeCloseTo(0.87, 9);
    const stuck = run([[150000, { building: null, ready: false }]]);
    expect(Math.max(...stuck.map((p) => p.target))).toBeCloseTo(0.87, 9);
    const drawing = run([[150000, { building: false, ready: false }]]);
    expect(Math.max(...drawing.map((p) => p.target))).toBeCloseTo(0.97, 9); // the stage's own end is reached by time
    const late = run([[1000, { building: false, ready: false }]]);
    expect(late[late.length - 1].target).toBeCloseTo(0.88 + 0.09 * (1008 / 1200), 2);
  });

  it('creeps by 0.01 every 1.5 s once the target has not risen for 1.5 s', () => {
    const seen = run([[4600, { building: 0, ready: false }]]);
    expect(seen[Math.round(1400 / 16)].target).toBeCloseTo(CODE_IN, 9);
    expect(seen[Math.round(1600 / 16)].target).toBeCloseTo(CODE_IN + 0.01, 9);
    expect(seen[seen.length - 1].target).toBeCloseTo(CODE_IN + 0.03, 9);
  });

  it('chases the target at most 0.9 a second, and 2.5 a second once ready', () => {
    const slow = run([[1000, { building: 1, ready: false }]], CODE_IN);
    for (let i = 1; i < slow.length; i++) expect(slow[i].shown - slow[i - 1].shown).toBeLessThanOrEqual((CHASE * 16) / 1000 + 1e-12);
    expect(slow[slow.length - 1].shown).toBeCloseTo(0.88, 6);
    const fast = run([[400, { building: false, ready: true }]], 0.2);
    for (let i = 1; i < fast.length; i++) expect(fast[i].shown - fast[i - 1].shown).toBeLessThanOrEqual((CHASE_READY * 16) / 1000 + 1e-12);
    expect(fast[fast.length - 1].shown).toBe(1);
  });

  it('a page load starts at 0 and heads for 0.10 once the code is in; other loads start at 0.10', () => {
    expect(startProgress(0, 0)).toMatchObject({ shown: 0, target: CODE_IN });
    expect(startProgress(0)).toMatchObject({ shown: CODE_IN, target: CODE_IN });
  });
});

describe('the steps a load is expected to take', () => {
  it('reads the device\'s own count, by key, and copes with a broken or missing record', () => {
    expect(expectedSteps('{"desktop":420,"touch":300}', 'touch', 99)).toBe(300);
    expect(expectedSteps('{"desktop":420}', 'touch', 99)).toBe(99);
    expect(expectedSteps(null, 'desktop', 99)).toBe(99);
    expect(expectedSteps('not json', 'desktop', 99)).toBe(99);
    expect(expectedSteps('[1,2]', 'desktop', null)).toBeNull();
    expect(expectedSteps('{"desktop":"many"}', 'desktop', 99)).toBe(99);
    expect(expectedSteps('{"desktop":-4}', 'desktop', 99)).toBe(99);
    expect(expectedSteps('"text"', 'desktop', 7)).toBe(7);
  });

  it('writes a count beside the others, starting a broken record again', () => {
    expect(JSON.parse(withSteps('{"desktop":420}', 'touch', 300))).toEqual({ desktop: 420, touch: 300 });
    expect(JSON.parse(withSteps('garbage', 'desktop', 5))).toEqual({ desktop: 5 });
    expect(JSON.parse(withSteps(null, 'Setting the table', 12))).toEqual({ 'Setting the table': 12 });
  });
});
