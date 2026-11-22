import { describe, expect, it } from 'vitest';
import { CELL, CRATE, FAR, FINE, PROPS, RIM_Z, STEP_Z, farIsland, islandVoxels, placeOf, stageLayout } from '../island';
import { solid } from '../../voxel/paint';
import type { Grid } from '../../voxel/primitives';

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

/** Every voxel of a grid as S-cell keys (an M cell is 2 x 2 x 2 of them), moved by `at` metres. */
function fine(g: Grid, at: [number, number, number] = [0, 0, 0]): string[] {
  const k = Math.round(g.size / FINE), o = at.map((v) => Math.round(v / FINE));
  const out: string[] = [];
  for (const c of g.map.values()) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) for (let l = 0; l < k; l++)
    out.push(`${c.x * k + i + o[0]},${c.y * k + j + o[1]},${c.z * k + l + o[2]}`);
  return out;
}

// docs/leaderboards/LEADERBOARDS-PLAN-V3.md, section 4 (Brian, 2026-11-22): the island rebuilt.
describe('the leaderboards\' island (version 3)', () => {
  for (const phone of [false, true]) {
    const layout = stageLayout(phone), v = islandVoxels(layout), tag = phone ? 'phone' : 'computer';
    const top = (x: number, z: number) => { for (let y = 8; y >= -12; y--) if (v.body.has(x, y, z)) return y; return null; };

    it(`${tag}: the crates are a crate's ${phone ? '0.15' : 'quarter'} apart, the island 1.6 times their width`, () => {
      const gap = (phone ? 0.15 : 0.25) * CRATE.w;
      expect(layout.x[1]).toBe(0);
      expect(layout.x[2] - layout.x[1]).toBeCloseTo(CRATE.w + gap, 6);
      expect(layout.halfW * 2).toBeCloseTo(1.6 * (3 * CRATE.w + 2 * gap), 6);
      const xs = [...v.body.map.values()].filter((c) => c.y === -3).map((c) => c.x);
      expect((Math.max(...xs) - Math.min(...xs) + 1) * CELL).toBeCloseTo(layout.halfW * 2, 0);
    });

    it(`${tag}: is one connected piece with the pines, the lantern and its glass on it: nothing floats`, () => {
      const keys = [...fine(v.body), ...fine(v.under), ...fine(v.lantern), ...fine(v.glass), ...v.pines.flatMap((p) => fine(p.grid, p.at))];
      expect(pieces(keys)).toBe(1);
    });

    it(`${tag}: the floating rocks are each one piece, clear of the island`, () => {
      const island = new Set([...fine(v.body), ...fine(v.under)]);
      for (const r of v.rocks) {
        const keys = fine(r.grid, r.at);
        expect(pieces(keys)).toBe(1);
        expect(pieces([...keys, ...island])).toBe(2);
      }
    });

    it(`${tag}: the top is level but for one step a cell down, 0.5 m in front of the crates`, () => {
      // Under each crate: flat snow at y = -1 (the crates stand at 0), nothing in the crate.
      for (const cx of layout.x) for (let x = Math.ceil((cx - CRATE.w / 2) / CELL); x < Math.floor((cx + CRATE.w / 2) / CELL); x++)
        for (let z = Math.round(-CRATE.d / 2 / CELL); z < Math.round(CRATE.d / 2 / CELL); z++) {
          expect(v.body.has(x, -1, z), `snow under ${x},${z}`).toBe(true);
          expect(v.body.has(x, 0, z), `nothing in the crate at ${x},${z}`).toBe(false);
        }
      // Row by row from the crates' fronts to the rim, the commonest height of the top across the island: -1, then -2
      // from the step on (ripples, prints and props are the exceptions, not the rule).
      const modes: number[] = [];
      for (let z = Math.round(CRATE.d / 2 / CELL); z * CELL < RIM_Z - 0.1; z++) {
        const n = new Map<number, number>();
        for (let x = -60; x <= 60; x++) { const t = top(x, z); if (t !== null) n.set(t, (n.get(t) ?? 0) + 1); }
        modes.push([...n.entries()].sort((p, q) => q[1] - p[1])[0][0]);
      }
      const step = modes.indexOf(-2);
      expect(modes.slice(0, step).every((m) => m === -1)).toBe(true);
      expect(modes.slice(step).every((m) => m === -2)).toBe(true);
      expect((step + Math.round(CRATE.d / 2 / CELL)) * CELL).toBeCloseTo(STEP_Z, 1);
    });

    it(`${tag}: drifts behind each crate: 2 cells high for 2 cells out, then 1 for 2 more`, () => {
      for (const cx of layout.x) {
        const mid = Math.round(cx / CELL), back = Math.round(-CRATE.d / 2 / CELL) - 1;
        expect([0, 1, 2, 3, 4].map((d) => (top(mid, back - d) ?? 0) + 1)).toEqual([2, 2, 1, 1, 0]);
      }
    });

    it(`${tag}: no feature on the snow is smaller than one M cell, and every colour is one of the ladder's`, () => {
      expect(v.body.size).toBeCloseTo(CELL, 9);
      for (const p of v.pines) expect(p.grid.size).toBeCloseTo(CELL, 9);
    });

    it(`${tag}: under the soil, bands 0.2 m thick narrow to a tip 0.4 m left of the champion's middle, 2.2 m down`, () => {
      const stone = [solid('stone', 0).join(), solid('stone', -1).join()];
      const under = [...v.under.map.values()].filter((c) => c.y <= -9 && stone.includes(c.c.join()));
      const lowest = Math.min(...under.map((c) => c.y));
      expect((-9 - lowest + 1) * CELL).toBeCloseTo(2.2, 6);
      const tip = under.filter((c) => c.y === lowest);
      const mid = (tip.reduce((s, c) => s + c.x, 0) / tip.length + 0.5) * CELL;
      expect(mid).toBeCloseTo(-0.4, 0);
      // The widths only shrink, band by band (the main lobe, left of the third crate's lobe).
      const widths = new Map<number, number>();
      for (const c of under) if (c.x * CELL < layout.x[2] - 1.2) widths.set(c.y, Math.max(widths.get(c.y) ?? 0, -c.x));
      const ys = [...widths.keys()].sort((a, b) => b - a);
      for (let i = 1; i < ys.length; i++) expect(widths.get(ys[i])!).toBeLessThanOrEqual(widths.get(ys[i - 1])!);
    });

    it(`${tag}: the props stand where section 4.4 puts them`, () => {
      const [px] = placeOf(PROPS.tallPine.X, PROPS.tallPine.Z);
      expect(v.pines[0].at[0]).toBeCloseTo(px, 1);
      const [lx, lz] = placeOf(PROPS.lantern.X, PROPS.lantern.Z);
      expect(Math.abs(v.lamp[0] - lx)).toBeLessThan(0.1);
      expect(Math.abs(v.lamp[2] - lz)).toBeLessThan(0.1);
      // The lantern's top is 1.0 m over the ground it stands on.
      const tops = [...v.lantern.map.values()].map((c) => (c.y + 1) * FINE);
      expect(Math.max(...tops) - v.topAt(lx, lz)).toBeCloseTo(1.0, 1);
    });

    it(`${tag}: icicles hang only from the front half's overhang`, () => {
      expect(v.lips.length).toBeGreaterThan(20);
      for (const [, , z] of v.lips) expect(z).toBeGreaterThan(layout.midZ);
    });
  }

  it('the far islands are wider than they are tall, about 0.6 of their width', () => {
    for (const spec of Object.values(FAR)) {
      const g = farIsland(spec, [0.5, 0.7, 0.9]);
      const ys = [...g.map.values()].filter((c) => c.y < 0).map((c) => c.y);
      const h = (Math.max(...ys) - Math.min(...ys) + 1) * CELL;
      expect(h / spec.top).toBeGreaterThan(0.45);
      expect(h / spec.top).toBeLessThan(0.75);
      expect(pieces(g.map.keys())).toBe(1);
    }
  });

  it('is the same every time: nothing in it is random', () => {
    const a = islandVoxels(stageLayout(false)), b = islandVoxels(stageLayout(false));
    expect([...a.body.map.keys()].sort()).toEqual([...b.body.map.keys()].sort());
    for (const [k, c] of a.body.map) expect(b.body.map.get(k)!.c).toEqual(c.c);
  });
});
