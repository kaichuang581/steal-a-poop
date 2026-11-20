import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { VoxelMap } from '../../voxel/mesher';
import { buildFarmstead, FARM } from '../farmstead';
import { buildDuelFestive, buildFarmFestive, buildFestive } from '../festive';
import type { FestiveGeometry, FestiveKind, FestivePart } from '../festive';
import { POV_SHOTS } from '../homePov';
import { BARN, YARD } from '../layout';
import { buildYard, snowmanGrid } from '../yard';

/**
 * The scale chart at game scale (plan file 04, section 4.4): things are sized against the 1.5 m hero, measured as the
 * voxels they draw. The season's decorations are moved and resized, never removed.
 */

type Box = { min: number[]; max: number[] };
const height = (b: Box) => b.max[1] - b.min[1];
const EPS = 1e-6;

/** Every voxel model built while `build` runs, with its cell size (the mesher's hook, as tools/floatingVoxels.ts uses it). */
function capture(build: () => void): { vox: VoxelMap; size: number }[] {
  const got: { vox: VoxelMap; size: number }[] = [];
  const host = globalThis as { __voxelHook?: (vox: VoxelMap, size: number) => void };
  const before = host.__voxelHook;
  host.__voxelHook = (vox, size) => got.push({ vox, size });
  try { build(); } finally { host.__voxelHook = before; }
  return got;
}

/** The box, in metres, of the voxels inside a region of x and z that pass `keep`. */
function boxIn(models: { vox: VoxelMap; size: number }[], x: [number, number], z: [number, number], keep: (c: [number, number, number], size: number) => boolean): Box | null {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { vox, size } of models)
    for (const v of vox.values()) {
      const wx = (v.x + 0.5) * size, wz = (v.z + 0.5) * size;
      if (wx < x[0] || wx > x[1] || wz < z[0] || wz > z[1] || v.y < 0 || !keep(v.c, size)) continue;
      [v.x, v.y, v.z].forEach((c, k) => { lo[k] = Math.min(lo[k], c * size); hi[k] = Math.max(hi[k], (c + 1) * size); });
    }
  return lo[0] <= hi[0] ? { min: lo, max: hi } : null;
}

/** Wood, not snow: the fences' posts and rails are brown (red over blue); their snow caps are white or blue. */
const wood = (c: [number, number, number]) => c[0] > c[2] + 0.03 && c[0] < 0.6;

const parts = (f: FestiveGeometry, kind: FestiveKind) => f.parts.filter((p) => p.kind === kind);
const count = (f: FestiveGeometry) => (kind: FestiveKind) => parts(f, kind).length;

let yard: { vox: VoxelMap; size: number }[] = [];
let farm: { vox: VoxelMap; size: number }[] = [];
let festive: FestiveGeometry;
let farmFestive: FestiveGeometry;

beforeAll(() => {
  yard = capture(() => buildYard());
  farm = capture(() => buildFarmstead()); // the orchard's baubles hang from its branches, so it comes first
  festive = buildFestive();
  farmFestive = buildFarmFestive();
}, 60_000);

describe('the scale chart (plan file 04, section 4.4)', () => {
  it('the back door stays the reference 3.4 m', () => {
    expect(BARN.backDoor.height).toBe(3.4);
  });

  it('the snowman is at most 2.2 m to its crown, and its hat sits on it', () => {
    const man = snowmanGrid();
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const v of man.map.values()) [v.x, v.y, v.z].forEach((c, k) => { lo[k] = Math.min(lo[k], c * man.size); hi[k] = Math.max(hi[k], (c + 1) * man.size); });
    const top = hi[1];
    expect(top).toBeLessThanOrEqual(2.2 + EPS);
    expect(top).toBeGreaterThan(1.8); // still taller than the hero
    const [hat] = parts(festive, 'hat');
    expect(parts(festive, 'hat')).toHaveLength(1);
    // Its brim on the crown: neither in the air nor sunk into the head.
    expect(Math.abs(hat.min[1] - top)).toBeLessThanOrEqual(0.1 + EPS);
    for (const k of [0, 2]) {
      const mid = (hat.min[k] + hat.max[k]) / 2;
      expect(Math.abs(mid - [YARD.snowman.x, 0, YARD.snowman.z][k])).toBeLessThan(0.3);
    }
    // The hat follows the head: no wider than the head was before the snowman shrank in proportion.
    expect(hat.max[0] - hat.min[0]).toBeLessThanOrEqual(0.9 * YARD.snowman.scale + 0.1 + EPS);
  });

  it('the Christmas tree by the doors is at most 4.2 m and still by the doors', () => {
    const trees = parts(festive, 'tree');
    const doors = trees.filter((t) => (t.min[2] + t.max[2]) / 2 > BARN.maxZ);
    expect(doors).toHaveLength(1);
    const [t] = doors;
    expect(height(t)).toBeLessThanOrEqual(4.2 + EPS);
    expect(height(t)).toBeGreaterThan(3.5);
    const cx = (t.min[0] + t.max[0]) / 2, cz = (t.min[2] + t.max[2]) / 2;
    // Beside the doors (x -1.8 to 1.8 in the back wall at BARN.maxZ), on the yard side, off the path.
    expect(cx).toBeLessThan(BARN.backDoor.minX - 1);
    expect(cx).toBeGreaterThan(BARN.backDoor.minX - 4);
    expect(cz - BARN.maxZ).toBeGreaterThan(1);
    expect(cz - BARN.maxZ).toBeLessThan(3.5);
  });

  it('no present on the farm is over 0.6 m, knot included', () => {
    for (const f of [festive, farmFestive, buildDuelFestive()])
      for (const p of parts(f, 'present')) expect(height(p), `present at ${p.min.join(', ')}`).toBeLessThanOrEqual(0.6 + EPS);
  });

  it('fences stand 1.2 to 1.4 m to the top of their wood', () => {
    const P = FARM.paddock, R = FARM.run, F = YARD.fence;
    const fences: [string, Box | null][] = [
      ['yard fence, right of the gate', boxIn(yard, [3.7, F.maxX + 0.3], [F.z - 0.3, F.z + 0.5], wood)],
      ['yard fence, left of the gate', boxIn(yard, [F.minX - 0.3, -3.7], [F.z - 0.3, F.z + 0.5], wood)],
      ['paddock, near side', boxIn(farm, [P.minX - 0.1, P.minX + 0.3], [P.minZ + 0.5, P.maxZ - 0.5], wood)],
      ['paddock, far side', boxIn(farm, [P.maxX - 0.1, P.maxX + 0.3], [P.minZ + 0.5, P.maxZ - 0.5], wood)],
      ['hen run', boxIn(farm, [R.maxX - 0.1, R.maxX + 0.3], [R.minZ + 0.5, R.maxZ - 0.5], wood)],
    ];
    for (const [name, b] of fences) {
      expect(b, name).not.toBeNull();
      expect(b!.max[1], name).toBeGreaterThanOrEqual(1.2 - EPS);
      expect(b!.max[1], name).toBeLessThanOrEqual(1.4 + EPS);
    }
  });
});

describe('the season tidied, inside today\'s amount', () => {
  it('keeps the count of trees, presents, canes, wreaths and strands', () => {
    const yardSide = count(festive), farmSide = count(farmFestive), ice = count(buildDuelFestive());
    expect([yardSide('tree'), yardSide('present'), yardSide('cane'), yardSide('wreath'), yardSide('strand')]).toEqual([2, 5, 4, 2, 11]);
    expect([farmSide('tree'), farmSide('present'), farmSide('cane'), farmSide('wreath'), farmSide('strand')]).toEqual([0, 0, 0, 1, 6]);
    // One Christmas tree by the barn doors, one in the barn, one on the ice: never a fourth.
    expect(yardSide('tree') + farmSide('tree') + ice('tree')).toBe(3);
  });

  it('leaves the tractor undressed: no presents on it or beside it (Brian, 2026-11-19: everything "intentionally placed")', () => {
    const tractor = boxIn(farm, [FARM.tractor.x - 3, FARM.tractor.x + 3], [FARM.tractor.z - 2, FARM.tractor.z + 2], (_, size) => size === 0.1); // its own 0.1 m cubes: no longer smoothed to 0.05 (CHUNKY)
    expect(tractor).not.toBeNull();
    const presents = parts(farmFestive, 'present');
    expect(presents).toHaveLength(0);
  });

  it('hangs no bulb within 1.0 m in front of a Home tour lens, anywhere along its push', () => {
    // "A bulb near a shot's camera hangs huge in front of the lens" (CLAUDE.md, the season): a bulb counts when any of
    // it is in front of the lens's plane. Behind the lens (the yard fence's lights behind tour shots 5 and 6) it is
    // never drawn.
    const bulbs: FestivePart[] = [...parts(festive, 'bulb'), ...parts(farmFestive, 'bulb')];
    const gap = (b: FestivePart, p: number[]) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));
    for (const [device, shots] of Object.entries(POV_SHOTS))
      shots.forEach((shot, i) => {
        for (let t = 0; t <= 1 + EPS; t += 0.05) {
          const lens = shot.position.map((v, k) => v + shot.push[k] * t);
          const ahead = new Vector3(...shot.target).sub(new Vector3(...lens)).normalize();
          for (const b of bulbs) {
            const front = Math.max(...[b.min[0], b.max[0]].flatMap((x) => [b.min[1], b.max[1]].flatMap((y) => [b.min[2], b.max[2]].map((z) => ahead.dot(new Vector3(x - lens[0], y - lens[1], z - lens[2]))))));
            if (front <= 0) continue;
            expect(gap(b, lens), `${device} ${i} at ${t.toFixed(2)}: bulb at ${b.min.join(', ')}`).toBeGreaterThanOrEqual(1.0);
          }
        }
      });
  });
});
