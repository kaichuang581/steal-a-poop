import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { buildBarn } from '../barn';
import { BARN } from '../layout';

/** True if any vertex of the geometries lies inside the box. */
function anyVertexIn(geos: BufferGeometry[], min: [number, number, number], max: [number, number, number]) {
  for (const g of geos) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]) return true;
    }
  }
  return false;
}

describe('buildBarn', () => {
  const t0 = performance.now();
  const barn = buildBarn();
  const ms = performance.now() - t0;
  const world = [...barn.static, barn.lanterns, barn.tarp];

  it('returns geometries within the triangle budget, quickly', () => {
    console.log(`barn: ${barn.triangles} triangles, built in ${ms.toFixed(0)} ms`);
    expect(barn.static.length).toBeGreaterThan(0);
    for (const g of [...world, barn.robin, barn.cat.body, barn.cat.tail, ...barn.doorLeaves.map((l) => l.geo)]) expect(g.index!.count).toBeGreaterThan(0);
    expect(barn.doorLeaves).toHaveLength(2);
    expect(barn.triangles).toBeLessThan(300000);
    expect(ms).toBeLessThan(4000);
  });

  it('leaves the back doorway open', () => {
    expect(anyVertexIn(world, [-0.5, 1.0, BARN.maxZ - 0.1], [0.5, 2.0, BARN.maxZ + 0.3])).toBe(false);
  });

  it('has no wall across the front', () => {
    expect(anyVertexIn(world, [-5.5, 0.5, -1e9], [5.5, BARN.wallHeight, BARN.minZ + 0.01])).toBe(false);
  });
});
