import { describe, expect, it } from 'vitest';
import { pinnedPov, POV_DIP, POV_HOLD, povAt } from '../homePov';

describe('start screen camera angles', () => {
  it('opens on the first angle with no fade, then moves on one angle per hold and wraps', () => {
    expect(povAt(0, 4)).toEqual({ index: 0, progress: 0, veil: 0 });
    expect(povAt(POV_HOLD + 1, 4).index).toBe(1);
    expect(povAt(POV_HOLD * 3 + 1, 4).index).toBe(3);
    expect(povAt(POV_HOLD * 4 + 1, 4).index).toBe(0);
  });

  it('is fully dark at the cut, so the jump is never seen, and clear in the middle of a hold', () => {
    expect(povAt(POV_HOLD - 0.0001, 4).veil).toBeCloseTo(1, 2);
    expect(povAt(POV_HOLD, 4).veil).toBe(1);
    expect(povAt(POV_HOLD + POV_DIP / 2, 4).veil).toBeCloseTo(0.5, 5);
    expect(povAt(POV_HOLD * 1.5, 4).veil).toBe(0);
  });

  it('pins an angle only for a valid ?pov=', () => {
    expect(pinnedPov('?pov=2', 4)).toBe(2);
    expect(pinnedPov('?pov=0', 4)).toBe(0);
    expect(pinnedPov('?pov=9', 4)).toBeNull();
    expect(pinnedPov('?pov=x', 4)).toBeNull();
    expect(pinnedPov('', 4)).toBeNull();
  });
});
