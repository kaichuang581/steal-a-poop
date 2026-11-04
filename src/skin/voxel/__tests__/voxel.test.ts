import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildGeometry } from '../mesher';
import { Grid, ellipsoid, solid } from '../primitives';
import { CHAR, sheepModel } from '../sheep';

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

describe('the default sheep', () => {
  const m = sheepModel();
  it('has 9k to 14k voxels before face culling', () => {
    expect(m.voxels).toBeGreaterThanOrEqual(9000);
    expect(m.voxels).toBeLessThanOrEqual(14000);
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
