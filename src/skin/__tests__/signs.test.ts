import { describe, expect, it } from 'vitest';
import type { VoxelMap } from '../voxel/mesher';
import { lin, T } from '../voxel/palette';
import { plankY, STAKE, stakeVoxels } from '../voxel/props';

/** Every voxel reaches the ground (y = 0) through face-adjacent voxels (V6 Part 7.4, the v5 connectivity test). */
function grounded(m: VoxelMap): boolean {
  const seen = new Set<string>();
  const queue = [...m.values()].filter((v) => v.y === 0).map((v) => `${v.x},${v.y},${v.z}`);
  queue.forEach((k) => seen.add(k));
  while (queue.length) {
    const [x, y, z] = queue.pop()!.split(',').map(Number);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const k = `${x + dx},${y + dy},${z + dz}`;
      if (m.has(k) && !seen.has(k)) { seen.add(k); queue.push(k); }
    }
  }
  return seen.size === m.size;
}

const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

describe('name stake (V6 Part 5.3)', () => {
  for (const opts of [{}, { ice: true }, { height: 26, ice: true }]) {
    it(`is one grounded piece ${JSON.stringify(opts)}`, () => {
      expect(grounded(stakeVoxels(opts).map)).toBe(true);
    });
  }

  it('has a plank 8 x 3 across its face, a darker rim and two brass nails', () => {
    const m = stakeVoxels().map;
    const plank = [...m.values()].filter((v) => v.z === -2 && v.y < STAKE.post - 1);
    expect(new Set(plank.map((v) => v.x)).size).toBe(STAKE.plankW);
    expect(new Set(plank.map((v) => v.y)).size).toBe(STAKE.plankH);
    const nails = [...m.values()].filter((v) => same(v.c, lin(T.brass[1])));
    expect(nails).toHaveLength(2);
    expect(nails.every((v) => v.z === -3)).toBe(true);
    const xs = plank.map((v) => v.x), ys = plank.map((v) => v.y);
    const edge = plank.filter((v) => v.x === Math.min(...xs) || v.x === Math.max(...xs) || v.y === Math.min(...ys) || v.y === Math.max(...ys));
    expect(edge.length).toBe(2 * STAKE.plankW + 2 * (STAKE.plankH - 2));
    expect(edge.every((v) => same(v.c, lin(T.beam[2])))).toBe(true);
  });

  it('hangs its slips at the plank centre', () => {
    expect(plankY()).toBeCloseTo(0.525, 6);
  });
});
