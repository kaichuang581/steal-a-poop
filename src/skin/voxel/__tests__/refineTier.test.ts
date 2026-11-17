import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { coarseFor, detailed, detailedSteps, inDetail, withDetail } from '../refine';
import { finish } from '../../scene/slices';
import { lowDrops, LOW_DROP_M, WENDIGO_AT } from '../../scene/countryside';
import type { CountryPart } from '../../scene/countryside';
import type { VoxelMap } from '../mesher';

// World detail per tier (plan file 17, change 15).
const one: VoxelMap = new Map([['0,0,0', { x: 0, y: 0, z: 0, c: [0.5, 0.5, 0.5] }]]);
const pointer = (coarse: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q.includes('coarse') }));

afterEach(() => vi.unstubAllGlobals());

describe('world detail per tier', () => {
  it('High keeps the device detail; Medium and Low are the touch detail everywhere', () => {
    pointer(false);
    expect([coarseFor('high'), coarseFor('medium'), coarseFor('low')]).toEqual([false, true, true]);
    pointer(true);
    expect([coarseFor('high'), coarseFor('medium'), coarseFor('low')]).toEqual([true, true, true]);
  });

  it('a build told a detail gets it, whatever the device, and the default is the device', () => {
    pointer(false);
    expect(detailed(one, 0.2).size).toBe(0.1);
    expect(withDetail(true, () => detailed(one, 0.2)).size).toBe(0.2);
    pointer(true);
    expect(detailed(one, 0.2).size).toBe(0.2);
    expect(withDetail(false, () => detailed(one, 0.2)).size).toBe(0.1);
    expect(detailed(one, 0.2).size).toBe(0.2); // put back after
  });

  it('two builds sliced side by side each keep their own detail', () => {
    pointer(false);
    function* builder() {
      yield;
      const a = yield* detailedSteps(one, 0.2);
      yield;
      const b = yield* detailedSteps(one, 0.2);
      return [a.size, b.size];
    }
    const coarse = inDetail(true, builder()), fine = inDetail(false, builder());
    const out: Record<string, number[]> = {};
    for (let i = 0; i < 10; i++) {
      const c = coarse.next(), f = fine.next();
      if (c.done && c.value) out.coarse ??= c.value;
      if (f.done && f.value) out.fine ??= f.value;
    }
    expect(out).toEqual({ coarse: [0.2, 0.2], fine: [0.1, 0.1] });
    expect(finish(builder())).toEqual([0.1, 0.1]);
  });

  it('the same voxels as the device build at either detail', () => {
    pointer(false);
    const map: VoxelMap = new Map();
    for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) map.set(`${x},${y},0`, { x, y, z: 0, c: [0.4, 0.5, 0.6] });
    const fine = withDetail(false, () => detailed(map, 0.2)).map;
    expect([...fine.keys()]).toEqual([...detailed(map, 0.2).map.keys()]);
    pointer(true);
    expect([...withDetail(true, () => detailed(map, 0.2)).map.keys()]).toEqual([...detailed(map, 0.2).map.keys()]);
  });
});

describe('Low drops far scrub and drifts', () => {
  const ball = (x: number, z: number, r = 1) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([x - r, 0, z, x + r, 0, z, x, 0, z - r, x, 0, z + r], 3));
    return g;
  };
  const [wx, wz] = WENDIGO_AT;
  it('drops only what is far, unseen by the paddock shot, and holds no wall', () => {
    const near = ball(wx + LOW_DROP_M - 2, wz), far = ball(wx + LOW_DROP_M + 5, wz), seen = ball(wx - LOW_DROP_M - 5, wz), wall = ball(wx, wz + LOW_DROP_M + 5);
    const drift = ball(wx + 50, wz), driftSeen = ball(wx - 50, wz);
    const part: CountryPart = { woods: [], forest: [], scrub: [near, far, seen, wall, undefined], drifts: [drift, driftSeen], scrubFixed: [false, false, false, true, false] };
    const out = lowDrops(part, ([x]) => x < wx);
    expect([...out]).toEqual([far, drift]);
  });
  it('keeps every scrub piece when it cannot tell which hold the wall', () => {
    const part: CountryPart = { woods: [], forest: [], scrub: [ball(wx + 60, wz)], drifts: [] };
    expect(lowDrops(part, () => false).size).toBe(0);
  });
});
