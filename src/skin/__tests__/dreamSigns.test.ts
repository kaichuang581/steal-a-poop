import { describe, expect, it } from 'vitest';
import { foldedQuilt, roomOn } from '../dream/bedroom';

/** The results room and the folded quilts (docs/REDESIGN_PLAN_V6_UI.md Part 7.4). */
describe('the results room', () => {
  it('shows the walls only once the dream is over', () => {
    for (const p of ['ready', 'running', 'crashed', 'drifting']) expect(roomOn(p)).toBe(false);
    expect(roomOn('results')).toBe(true);
  });
  it('folds each Warm Blanket into one piece', () => {
    for (const seed of [0, 1]) {
      const pos = foldedQuilt(seed).getAttribute('position');
      expect(pos.count).toBeGreaterThan(0);
    }
  });
});
