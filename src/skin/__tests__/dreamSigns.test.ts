import { describe, expect, it } from 'vitest';
import { foldedQuilt, roomOn } from '../dream/bedroom';
import { signPost } from '../dream/world';

/** The fence sign's post and the folded quilts (docs/REDESIGN_PLAN_V6_UI.md Part 7.4; docs/dream/02, section 6). */
describe('the fence sign\'s post', () => {
  it('builds a post, its arm and the lantern, with the board\'s hang point under the arm', () => {
    const g = signPost(22, 6);
    for (const part of [g.post, g.lantern]) expect(part.getAttribute('position').count).toBeGreaterThan(0);
    g.post.computeBoundingBox();
    expect(g.hang[1]).toBeCloseTo(2.2, 9);
    expect(g.post.boundingBox!.max.y).toBeGreaterThanOrEqual(g.hang[1]);
    // The arm reaches as far as it was asked to, each way.
    expect(g.post.boundingBox!.min.x).toBeLessThanOrEqual(-0.6);
    expect(g.post.boundingBox!.max.x).toBeGreaterThanOrEqual(0.6);
    expect(signPost(22, 6)).toBe(g);
  });
});

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
