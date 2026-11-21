import { describe, expect, it } from 'vitest';
import { triangles } from '../../voxel/mesher';
import { KIT } from '../../voxel/microKit';
import { breach, buildFarmMicroSteps, inWedge, MICRO_BUDGET, MICRO_PLACEMENTS, STRAW_BED, underMicro } from '../farmMicro';
import { FARM } from '../farmstead';
import { finish } from '../slices';

describe('the micro layer on Home (docs/miniature/04; 05, sections 7 and 8)', () => {
  it('places only kit objects, on the 0.05 m grid, in eight clusters at most', () => {
    for (const p of MICRO_PLACEMENTS) {
      expect(KIT[p.kind], p.kind).toBeTypeOf('function');
      for (const m of p.at) expect(Math.abs(m / 0.05 - Math.round(m / 0.05)), `${p.kind} at ${p.at}`).toBeLessThan(1e-6);
    }
    expect(new Set(MICRO_PLACEMENTS.map((p) => p.cluster)).size).toBeLessThanOrEqual(MICRO_BUDGET.clusters);
  });

  it('keeps every rule of a place: the wedge and the paddock, the lane, the doorway, the animals, the season, the props', () => {
    expect(MICRO_PLACEMENTS.map((p) => [p.kind, p.at, breach(p)]).filter(([, , why]) => why)).toEqual([]);
  });

  it('knows the hens\' straw bed where the farm lays it (henYard in farmstead.ts): 0.6 m west and 3.5 m south of the coop', () => {
    expect(STRAW_BED).toEqual({ x: FARM.coop.x - 0.6, z: FARM.coop.z + 3.5, rx: 3, rz: 2.1, top: 0.1 });
  });

  it('refuses a place in the wedge, in the doorway, on the lane and beside the snowman', () => {
    expect(inWedge(18, 0)).toBe(true);
    expect(inWedge(0, 9)).toBe(false);
    expect(breach({ kind: 'crate', at: [15, 0, 0], cluster: 't' })).toMatch(/wedge or the paddock/);
    expect(breach({ kind: 'crate', at: [-0.2, 0, 20], cluster: 't' })).toMatch(/lane/);
    expect(breach({ kind: 'crate', at: [-1.7, 0, 7.6], cluster: 't' })).toMatch(/lane|doorway/);
    expect(breach({ kind: 'crate', at: [4.3, 0, 10.6], cluster: 't' })).toMatch(/snowman/);
    expect(breach({ kind: 'crate', at: [-4.4, 0, 8.4], cluster: 't' })).toMatch(/tree/);
  });

  it('builds one mesh a cluster inside the triangle budget, and says where its objects stand on the ground', () => {
    const micro = finish(buildFarmMicroSteps());
    expect(micro.clusters.map((c) => c.name)).toEqual([...new Set(MICRO_PLACEMENTS.map((p) => p.cluster))]);
    expect(micro.triangles).toBe(micro.clusters.reduce((n, c) => n + triangles(c.geo), 0) + (micro.glass ? triangles(micro.glass) : 0));
    expect(micro.triangles).toBeLessThanOrEqual(MICRO_BUDGET.triangles);
    expect(micro.glass).not.toBeNull(); // the lanterns' glass
    expect(underMicro(5.0, 8.9)).toBe(true); // under the crates
    expect(underMicro(0, 30)).toBe(false);
  });
});
