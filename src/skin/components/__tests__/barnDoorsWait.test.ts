import { describe, expect, it } from 'vitest';
import { FROZEN_MS, GRACE_MS, REVEAL_HOLD_MS, waitedFor } from '../BarnDoors';

// Going into a game the screen goes dark for a moment, and the doors come down only if the wait goes on (GRACE_MS).
// The doors must be up only while something is loading: never brought down by a wait that is already over.
const wait = (gaps: number[]) => gaps.reduce(waitedFor, 0);
const frames = (ms: number) => Array.from({ length: Math.round(ms / 16) }, () => 16);

describe('when the doors come down on a quick change of screen', () => {
  it('not for a build that froze the page and is done: the freeze is noticed only once it is over', () => {
    // Two frames, a 2.4 s freeze while the scene is built, then the three frames the scene needs to be marked drawn.
    expect(wait([16, 16, 2400, 16, 16, 16])).toBeLessThan(GRACE_MS);
    // Even a very slow device's 8 s freeze, or three freezes in a row.
    expect(wait([16, 8000, 16, 16, 16])).toBeLessThan(GRACE_MS);
    expect(wait([16, 1500, 16, 1500, 16, 1500, 16, 16, 16])).toBeLessThan(GRACE_MS);
  });

  it('for a wait the page is awake through: something still on its way after most of a second', () => {
    expect(wait(frames(700))).toBeLessThan(GRACE_MS);
    expect(wait(frames(900))).toBeGreaterThan(GRACE_MS);
  });

  it('for a build that goes on in steps, with frames between them', () => {
    expect(wait(Array.from({ length: 10 }, () => 250))).toBeGreaterThan(GRACE_MS);
  });

  it('a frame gap counts whole up to FROZEN_MS and no further, and time never runs backwards', () => {
    expect(waitedFor(0, 60)).toBe(60);
    expect(waitedFor(0, FROZEN_MS)).toBe(FROZEN_MS);
    expect(waitedFor(0, 5000)).toBe(FROZEN_MS);
    expect(waitedFor(40, -5)).toBe(40);
  });

  it('doors that do come down late are held only until they have faded in', () => {
    expect(REVEAL_HOLD_MS).toBeLessThanOrEqual(240);
  });
});
