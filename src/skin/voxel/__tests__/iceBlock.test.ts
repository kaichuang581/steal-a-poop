import { describe, expect, it } from 'vitest';
import { iceBlock } from '../sheep';

describe('iceBlock', () => {
  const b = iceBlock([1.1, 1.2, 1.3]);

  it('is cached per size', () => {
    expect(iceBlock([1.1, 1.2, 1.3])).toBe(b);
  });

  it('draws no underside on the snow cap (it would show through the ice)', () => {
    const idx = b.cap.index!.array;
    const n = b.cap.getAttribute('normal');
    for (let i = 0; i < idx.length; i++) expect(n.getY(idx[i])).toBeGreaterThanOrEqual(0);
    expect(idx.length).toBeGreaterThan(0);
  });

  it('keeps the cracks in the corners of the front face, clear of the sheep', () => {
    b.cracks.computeBoundingBox();
    const { min, max } = b.cracks.boundingBox!;
    expect(min.z).toBeGreaterThan(0.6); // on the front face
    // every crack voxel is at least 0.35 m from the centre line, where the sheep stands
    const p = b.cracks.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(Math.abs(p.getX(i))).toBeGreaterThanOrEqual(0.35);
    expect(max.y).toBeLessThanOrEqual(0.6);
  });

  it('builds three thaw chunks', () => {
    expect(b.shards).toHaveLength(3);
  });
});
