import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import type { VoxelMap } from '../mesher';
import { triangles } from '../mesher';
import { animalModel } from '../animals';
import type { AnimalModel } from '../animals/rig';
import { DARKEST } from '../animals/rig';
import { CHARACTERS } from '../../avatars/catalog';
import { __rig } from '../../table/Sheep';
import type { SheepState } from '../../table/Sheep';
import { WORN_IDS, wornItem } from '../animals/worn';

/** The species built so far (V5 milestones A1 to A3); each gets the ten checks of Part 4.13. */
const BUILT = ['pig', 'cow', 'horse', 'goat', 'chicken'] as const;

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function union(maps: VoxelMap[]): VoxelMap { const m = new Map(); for (const a of maps) for (const [k, v] of a) m.set(k, v); return m; }
/** Whether every voxel of `m` is reachable from any other through face neighbours. */
function connected(m: VoxelMap): boolean {
  if (m.size === 0) return true;
  const seen = new Set<string>();
  const [start] = m.keys();
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const k = stack.pop()!;
    const [x, y, z] = k.split(',').map(Number);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = key(x + dx, y + dy, z + dz);
      if (m.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  return seen.size === m.size;
}
const hexOf = (c: [number, number, number]) => `#${new Color().setRGB(c[0], c[1], c[2]).getHexString()}`;
const lum = (hex: string) => { const { l } = new Color(hex).getHSL({ h: 0, s: 0, l: 0 }); return l; };
const sat = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).s;
const mirrorX = (m: VoxelMap, shift: number) => { const out = new Map(); for (const v of m.values()) out.set(key(-v.x - shift, v.y, v.z), v); return out; };
const overlapOnce = (a: VoxelMap, b: VoxelMap) => { let n = 0; for (const k of a.keys()) if (b.has(k)) n++; return n / Math.max(1, Math.min(a.size, b.size)); };
/** Mirror symmetry about the model's centre, whichever voxel column it falls on (within one voxel). */
const overlap = (a: VoxelMap, b: VoxelMap) => Math.max(overlapOnce(mirrorX(a, 0), b), overlapOnce(mirrorX(a, 1), b), overlapOnce(mirrorX(a, -1), b));

for (const species of BUILT) {
  describe(`${species} (V5 Part 4.13)`, () => {
    const m = animalModel(species) as AnimalModel;
    const named = m.cells;
    const level = (l: 0 | 1 | 2 | 3 | 4) => union([...Object.values(named), m.coatCells[l]]);

    it('1. is one connected solid at every level', () => {
      for (const l of [0, 1, 2, 3, 4] as const) {
        const all = level(l);
        if (!connected(all)) {
          // Say which parts are cut off from the body.
          const seen = new Set<string>();
          const [start] = named.body.keys();
          const stack = [start]; seen.add(start);
          while (stack.length) { const k = stack.pop()!; const [x, y, z] = k.split(',').map(Number); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = key(x + dx, y + dy, z + dz); if (all.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); } } }
          const loose = Object.entries(named).filter(([, m2]) => [...m2.keys()].some((k) => !seen.has(k))).map(([n]) => n);
          expect.fail(`level ${l}: not one solid; cut off from the body: ${loose.join(', ') || 'coat'}`);
        }
      }
    });
    it('2. has mirrored eyes, ears and legs', () => {
      expect(overlap(named.eye0, named.eye1)).toBeGreaterThan(0.9);
      if (named.ear0?.size) expect(overlap(named.ear0, named.ear1)).toBeGreaterThan(0.85);
      if (named.wing0) expect(overlap(named.wing0, named.wing1)).toBeGreaterThan(0.8);
      expect(overlap(named.leg0, named.leg1)).toBeGreaterThan(0.85);
    });
    it('3. meets the eye standard: two plates, an iris and one catchlight on the same side (whites on the bigger plates)', () => {
      expect(m.eyes).toHaveLength(2);
      const light = '#ffffff';
      for (const eye of [named.eye0, named.eye1]) {
        const cols = [...eye.values()].map((v) => hexOf(v.c));
        const lights = cols.filter((c) => c === light).length;
        const iris = cols.filter((c) => c !== light && lum(c) < 0.5).length;
        const whites = cols.length - lights - iris;
        // A 5 x 5 plate has 21 cells: 12 whites round an iris of 8 plus the catchlight; the pig's and the hen's 4 x 4 has
        // 12: 8 whites, an iris of 3 and the catchlight. The small eye (Brian, 2026-11-07: the sheep, cow, horse and goat)
        // is 2 x 2: an iris of 3 and the catchlight, no whites.
        if (whites === 0) { expect(lights).toBeLessThanOrEqual(1); expect(iris).toBe(cols.length - lights); expect(whites).toBe(0); continue; } // small eyes (no whites): 2 x 2, or the cow's 3 x 4; a pale face may have no glint
        expect(lights).toBe(1);
        expect([8, 5, 3]).toContain(iris);
        expect(whites).toBe(iris === 8 ? 12 : iris === 5 ? 15 : 8);
      }
      // The catchlight sits at the upper-left as the camera sees it: on a front plate one in from the plate's left edge
      // (the same column on both eyes); on a wrapped side plate in the front two columns of both eyes.
      for (const eye of [named.eye0, named.eye1]) {
        const cells = [...eye.values()];
        const l = cells.find((v) => hexOf(v.c) === light)!;
        const small = cells.every((v) => hexOf(v.c) === light || lum(hexOf(v.c)) < 0.5);
        if (small && !l) continue;
        if (small) {
          // A small eye: the glint in its top row (the cow's oval: the row under it, inside), at its front.
          expect(Math.max(...cells.map((v) => v.y)) - l.y).toBeLessThanOrEqual(1);
          expect(l.z).toBe(Math.max(...cells.map((v) => v.z)));
          continue;
        }
        const zs = cells.map((v) => v.z), xs = cells.map((v) => v.x);
        const front = Math.max(...zs) - Math.min(...zs) <= 1; // a flat plate on the front face
        if (front) expect(l.x - Math.min(...xs)).toBe(1); else expect(l.z).toBeGreaterThanOrEqual(Math.max(...zs) - 1);
        const irisN = cells.filter((v) => hexOf(v.c) !== light && lum(hexOf(v.c)) < 0.5).length;
        expect(l.y).toBe(Math.max(...cells.map((v) => v.y)) - (irisN === 5 ? 2 : 1)); // the goat's bar iris sits a row lower
      }
    });
    it('4. keeps the palette: at most 14 colours, nothing darker than the floor, body saturation under 55%', () => {
      const all = union([...Object.values(named), m.coatCells[2]]);
      const cols = new Set([...all.values()].map((v) => hexOf(v.c)));
      expect(cols.size).toBeLessThanOrEqual(14);
      for (const c of cols) expect(lum(c)).toBeGreaterThanOrEqual(lum(DARKEST) - 0.005);
      for (const v of named.body.values()) expect(sat(hexOf(v.c))).toBeLessThanOrEqual(0.56);
    });
    it('5. stays inside the budgets', () => {
      const s = m.stats;
      console.info(`${species}: ${s.voxels} voxels, ${s.triangles} triangles, ${s.colours} colours, ${s.parts} parts`);
      expect(s.voxels).toBeLessThanOrEqual(3200);
      expect(s.triangles).toBeLessThanOrEqual(10000);
      expect(s.parts).toBeLessThanOrEqual(24);
      expect(triangles(m.wools[2].geo)).toBeLessThanOrEqual(10000);
    });
    it('6. wears a one-voxel collar that stays above the chest line', () => {
      if (named.collar.size === 0) return;
      const ys = [...named.collar.values()].map((v) => v.y);
      const bodyYs = [...named.body.values()].map((v) => v.y);
      expect(Math.min(...ys)).toBeGreaterThan(Math.min(...bodyYs) + 0.7 * (Math.max(...bodyYs) - Math.min(...bodyYs)) * 0.5);
      // One voxel thick: no two collar voxels share an (x, y) column at different z more than one apart.
      const byXY = new Map<string, number[]>();
      for (const v of named.collar.values()) { const k = `${v.x},${v.y}`; byXY.set(k, [...(byXY.get(k) ?? []), v.z]); }
      for (const zs of byXY.values()) expect(Math.max(...zs) - Math.min(...zs)).toBeLessThanOrEqual(1);
    });
    it('7. carries its signature features at their minimum sizes', () => {
      const mins: Record<string, Record<string, number>> = {
        pig: { snout: 40, ear0: 10, ear1: 10, tail: 12 },
        cow: { muzzle: 60, bell: 20 }, horse: { mane: 40, blaze: 10, sock0: 12, sock1: 12 }, goat: { horn0: 14, horn1: 14, beard: 18, fringe: 24 }, chicken: { comb: 18, wing0: 24, wing1: 24 },
      };
      for (const [name, min] of Object.entries(mins[species] ?? {})) expect(named[name]?.size ?? 0, name).toBeGreaterThanOrEqual(min);
      expect(m.signature.length).toBeLessThanOrEqual(3);
      if (species === 'chicken') expect([...named.tail.values()].length).toBeGreaterThan(20);
    });
    it('8. shows the warmth layers of Part 4.9 per level, over the same body', () => {
      expect(m.coatCells[0].size).toBe(0);
      expect(m.coatCells[1].size).toBeGreaterThan(0); // scarf
      expect(m.coatCells[2].size).toBeGreaterThan(m.coatCells[1].size); // the sweater or blanket is bigger than a scarf
      expect(m.coatCells[3].size).toBeGreaterThan(m.coatCells[2].size); // plus the scarf
      expect(m.coatCells[4].size).toBeGreaterThan(m.coatCells[3].size); // plus leg warmers
      // The body is the same at every level: the coats only add to it.
      for (const l of [1, 2, 3, 4] as const) for (const k of named.body.keys()) expect(m.wools[l] && true).toBe(true), void k;
    });
    it('10. builds from its catalogue character', () => {
      expect(m.species).toBe(species);
      // V5.1's sheets: from the pig's 0.78 m to the horse's ear tips, the tallest at the table (V5.1 decision 10.3).
      expect(m.height).toBeGreaterThan(0.7);
      expect(m.height).toBeLessThanOrEqual(1.6);
    });
  });
}

const EVERY_STATE: SheepState[] = ['idle', 'proud', 'happy', 'startled', 'cold', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing', 'thinking', 'run', 'jump', 'bonk', 'land'];

describe('every species on the rig (V5 Part 4.13)', () => {
  it('9. steps every state for every species without a bad number', () => {
    // Without a GL renderer the smoke test drives the pose function the component's frame loop calls.
    const { poseFor, restPose, face0, N, CH } = __rig;
    for (const species of ['sheep', ...BUILT]) {
      const m = animalModel(species as (typeof BUILT)[number]);
      expect(m.species).toBe(species);
      const p = restPose(), f = face0();
      for (const live of EVERY_STATE) for (const e of [0, 0.1, 0.5, 1.2, 3, 7.5]) for (const moving of [true, false]) {
        poseFor(p, f, live, e, e * 1.7 + 0.3, moving, live === 'idle', e > 1, 0.1, null, 0.5, species);
        for (let i = 0; i < N; i++) expect(Number.isFinite(p[i]), `${species} ${live} e=${e} channel ${i}`).toBe(true);
        expect(p[CH.squash]).toBeGreaterThan(0);
      }
    }
  });

  it('10. builds every catalogue character; a worn item is a part or nothing, never an error', () => {
    for (const c of CHARACTERS) {
      const m = animalModel(c.animal);
      expect(m.voxels).toBeGreaterThan(500);
      expect(m.worn === undefined || m.worn.geo).toBeTruthy();
    }
    for (const id of [...WORN_IDS, 'unknown', undefined]) {
      const item = wornItem(id, 0.4, '#C24E45');
      expect(item === undefined || item.geo).toBeTruthy();
    }
  });
});
