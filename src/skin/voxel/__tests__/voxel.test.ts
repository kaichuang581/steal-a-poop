import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildGeometry } from '../mesher';
import { Grid, ellipsoid, solid } from '../primitives';
import { CHAR, CREAM, FACE, NOSE, sheepModel } from '../sheep';
import type { Part } from '../sheep';

describe('mesher', () => {
  it('emits only outside faces, wound outward, with colours and AO', () => {
    const g = new Grid(1);
    for (let x = 0; x < 2; x++) g.set(x, 0, 0, [1, 1, 1]);
    const geo = buildGeometry(g.map, 1);
    expect(geo.index!.count / 6).toBe(10); // 12 faces minus the 2 shared ones
    const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), idx = geo.index!;
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(pos, idx.getX(t + k)));
      const n = new Vector3().fromBufferAttribute(nor, idx.getX(t));
      const face = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      expect(face.dot(n)).toBeGreaterThan(0.99);
    }
  });
});

/** A part's extent in model metres (its geometry is built around its pivot). */
function bounds(p: Part) {
  p.geo.computeBoundingBox();
  const b = p.geo.boundingBox!;
  return { width: b.max.x - b.min.x, height: b.max.y - b.min.y, depth: b.max.z - b.min.z, bottom: b.min.y + p.pivot[1], top: b.max.y + p.pivot[1] };
}
const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

describe('the default sheep', () => {
  const m = sheepModel();
  it('is smooth wool lobes in two creams plus a crease tone, no per-voxel noise', () => {
    expect(m.lobes.body).toBeGreaterThanOrEqual(8);
    expect(m.lobes.body).toBeLessThanOrEqual(10);
    expect(m.woolTones).toBeLessThanOrEqual(3);
  });
  it('has a tall dark wedge head about 1 : 1.6 to the body cloud, and thin legs', () => {
    const head = bounds(m.head);
    expect(head.height).toBeGreaterThan(head.width);
    expect(head.width).toBeLessThanOrEqual(0.3);
    expect(bounds(m.wools[2]).depth / head.depth).toBeGreaterThan(1.6);
    expect(lum(FACE[0])).toBeLessThan(lum(CREAM[1]) / 2); // dark face, white fleece
    const leg = bounds(m.legs[0]);
    expect(leg.width).toBeLessThanOrEqual(0.13); // 0.08 m leg plus the splayed hoof
    expect(leg.top - leg.bottom).toBeGreaterThanOrEqual(0.28);
  });
  it('has small eyes, a dark nose and no pink on the face', () => {
    expect(m.eyes[0].voxels).toBeLessThanOrEqual(8);
    expect(m.eyes[0].voxels).toBe(m.eyes[1].voxels);
    expect(lum(NOSE)).toBeLessThan(lum(FACE[0]));
  });
  it('keeps the voxel budget at the normal coat, and each coat level is bigger than the last', () => {
    expect(m.voxels).toBeGreaterThanOrEqual(2500);
    expect(m.voxels).toBeLessThanOrEqual(14000);
    for (const level of [2, 3, 4] as const) expect(m.wools[level].voxels).toBeGreaterThan(m.wools[(level - 1) as 1 | 2 | 3].voxels);
    expect(bounds(m.wools[4]).bottom).toBeLessThanOrEqual(0.02); // the thickest coat reaches the ground
  });
  it('has a round silhouette: the wool top crosses at least 8 voxel steps', () => {
    const g = new Grid(CHAR);
    ellipsoid(g, [0, 0.64, 0], [0.42, 0.37, 0.55], solid([1, 1, 1]));
    const tops = new Map<number, number>();
    for (const v of g.map.values()) if (v.x === 0) tops.set(v.z, Math.max(tops.get(v.z) ?? -1e9, v.y));
    const profile = [...tops.entries()].sort((a, b) => a[0] - b[0]).map(([, y]) => y);
    const steps = profile.slice(1).filter((y, i) => y !== profile[i]).length;
    expect(steps).toBeGreaterThanOrEqual(8);
  });
});

describe('the animal avatars', () => {
  it('build every animal on the sheep rig, each its own colours, standing on the same ground (V5: horizontal heads)', async () => {
    const { animalModel } = await import('../animals');
    const seen = new Set<string>();
    for (const a of ['pig', 'cow', 'goat', 'horse', 'chicken'] as const) {
      const m = animalModel(a);
      expect(m.species).toBe(a);
      expect(m.voxels).toBeGreaterThan(800);
      expect(bounds(m.wools[2]).bottom).toBeGreaterThanOrEqual(0);
      expect(bounds(m.legs[0]).bottom).toBeCloseTo(0, 1);
      // V5 Part 4.4: the head is a horizontal shape, muzzle forward, never a vertical plank.
      const head = bounds(m.head);
      expect(head.height).toBeLessThanOrEqual(head.width * 1.35);
      const col = m.wools[2].geo.getAttribute('color');
      const key = [col.getX(0), col.getY(0), col.getZ(0)].map((v) => v.toFixed(2)).join(',');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(animalModel('sheep').wools).toBe(sheepModel().wools);
  });
});
