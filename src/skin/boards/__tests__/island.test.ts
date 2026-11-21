import { describe, expect, it } from 'vitest';
import { CELL, CRATE, islandVoxels, stageLayout } from '../island';

/** The pieces of a voxel set: voxels joined when they share a face or an edge (the scene checker's own rule). */
function pieces(keys: Iterable<string>): number {
  const all = new Set(keys), seen = new Set<string>();
  let n = 0;
  for (const k of all) {
    if (seen.has(k)) continue;
    n++;
    const stack = [k];
    seen.add(k);
    while (stack.length) {
      const [x, y, z] = stack.pop()!.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2 || (!dx && !dy && !dz)) continue;
        const o = `${x + dx},${y + dy},${z + dz}`;
        if (all.has(o) && !seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
  }
  return n;
}

// docs/leaderboards/LEADERBOARDS-PLAN.md, section 8.1 (Brian, 2026-11-21): one snowy island under the crates, no clouds.
describe('the leaderboards\' island', () => {
  for (const phone of [false, true]) {
    const layout = stageLayout(phone);
    const v = islandVoxels(layout);

    it(`${phone ? 'phone' : 'computer'}: the crates are a crate's ${phone ? '0.15' : 'quarter'} apart, the island 1.6 times their width and 2.5 times a crate's depth`, () => {
      const gap = (phone ? 0.15 : 0.25) * CRATE.w;
      expect(layout.x[1]).toBe(0);
      expect(layout.x[2] - layout.x[1]).toBeCloseTo(CRATE.w + gap, 6);
      expect(layout.x[1] - layout.x[0]).toBeCloseTo(CRATE.w + gap, 6);
      expect(layout.halfW * 2).toBeCloseTo(1.6 * (3 * CRATE.w + 2 * gap), 6);
      expect(layout.halfD * 2).toBeCloseTo(2.5 * CRATE.d, 6);
      const xs = [...v.body.map.values()].filter((c) => c.y === -3).map((c) => c.x);
      expect((Math.max(...xs) - Math.min(...xs) + 1) * CELL).toBeCloseTo(layout.halfW * 2, 0);
    });

    it(`${phone ? 'phone' : 'computer'}: is one connected piece, the lantern's glass included: nothing floats`, () => {
      expect(pieces([...v.body.map.keys(), ...v.glow.map.keys()])).toBe(1);
    });

    it(`${phone ? 'phone' : 'computer'}: the ground under each crate is flat snow at y = 0, and a mound stands against its foot`, () => {
      for (const cx of layout.x) {
        for (let x = Math.ceil((cx - CRATE.w / 2) / CELL); x < Math.floor((cx + CRATE.w / 2) / CELL); x++) {
          for (let z = Math.round(-CRATE.d / 2 / CELL); z < Math.round(CRATE.d / 2 / CELL); z++) {
            expect(v.body.has(x, -1, z), `snow under ${x},${z}`).toBe(true);
            expect(v.body.has(x, 0, z), `nothing in the crate at ${x},${z}`).toBe(false);
          }
        }
        // In front of the crate's middle: three cells high against it, then two, then one.
        const mid = Math.floor(cx / CELL), front = Math.round(CRATE.d / 2 / CELL);
        expect([0, 1, 2].map((d) => [0, 1, 2, 3].filter((y) => v.body.has(mid, y, front + d)).length)).toEqual([3, 2, 1]);
      }
    });

    it(`${phone ? 'phone' : 'computer'}: narrows to a point underneath, in steps`, () => {
      const widths = new Map<number, number>();
      for (const c of v.body.map.values()) if (c.y < -5) widths.set(c.y, Math.max(widths.get(c.y) ?? 0, Math.abs(c.x)));
      const ys = [...widths.keys()].sort((a, b) => b - a);
      for (let i = 1; i < ys.length; i++) expect(widths.get(ys[i])!).toBeLessThanOrEqual(widths.get(ys[i - 1])!);
      expect(widths.get(ys[ys.length - 1])!).toBeLessThanOrEqual(3);
    });
  }

  it('is the same every time: nothing in it is random', () => {
    const a = islandVoxels(stageLayout(false)), b = islandVoxels(stageLayout(false));
    expect([...a.body.map.keys()].sort()).toEqual([...b.body.map.keys()].sort());
    for (const [k, c] of a.body.map) expect(b.body.map.get(k)!.c).toEqual(c.c);
  });
});
