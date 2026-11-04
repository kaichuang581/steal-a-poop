import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildGeometry } from '../mesher';
import { Grid, ellipsoid, solid } from '../primitives';
import { CHAR, FACE, MUZZLE, sheepModel } from '../sheep';
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
  return { width: b.max.x - b.min.x, bottom: b.min.y + p.pivot[1], top: b.max.y + p.pivot[1] };
}
const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

describe('the default sheep (plan V3.3 Part 3)', () => {
  const m = sheepModel();
  it('is wool lobes, 7 + 5 + 3 + 2, in two creams plus a crease tone and no per-voxel noise', () => {
    expect(m.lobes).toEqual({ body: 7, hood: 5, tuft: 3, tail: 2 });
    expect(m.woolTones).toBeLessThanOrEqual(3);
  });
  it('has chibi proportions: a 0.52 m head, 1.05 m to the top of the head, stubby legs', () => {
    const head = bounds(m.head);
    expect(head.width).toBeCloseTo(0.52, 1);
    expect(head.top).toBeCloseTo(1.05, 1);
    const leg = bounds(m.legs[0]);
    expect(leg.top - leg.bottom).toBeLessThanOrEqual(0.22);
    expect(leg.width).toBeLessThanOrEqual(0.17);
  });
  it('has a light face, a darker muzzle, and eyes as the largest feature', () => {
    expect(lum(FACE[0])).toBeGreaterThan(lum(MUZZLE));
    for (const mouth of Object.values(m.mouths)) expect(m.eyes[0].voxels).toBeGreaterThanOrEqual(mouth.voxels);
    expect(m.eyes[0].voxels).toBe(m.eyes[1].voxels);
  });
  it('keeps the voxel budget at the normal coat, and each coat level is bigger than the last', () => {
    expect(m.voxels).toBeGreaterThanOrEqual(3000);
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
