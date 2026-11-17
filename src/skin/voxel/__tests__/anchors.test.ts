import { describe, expect, it } from 'vitest';
import { tailShown } from '../../table/Sheep';
import { anchorsOf, scarfCells } from '../animals/anchors';
import { animalModel } from '../animals';
import { cavityOf } from '../animals/rig';
import { iceBlock } from '../sheep';

const SPECIES = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'] as const;
describe('integrity fixes (plan file 03, milestone 3)', () => {
  it('4.1: only the sheep is shorn of its tail', () => {
    expect(tailShown(0, 'sheep')).toBe(false);
    for (const sp of SPECIES.slice(1)) expect(tailShown(0, sp)).toBe(true);
    for (const sp of SPECIES) expect(tailShown(2, sp)).toBe(true);
  });

  it('4.3: glints and cracks lie on the slab\'s front, the snow cap on its top', () => {
    for (const size of [[1.1, 1.2, 1.3], [0.96, 1.36, 1.6]] as [number, number, number][]) {
      const b = iceBlock(size);
      const box = (g: import('three').BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
      const slab = box(b.slab);
      for (const g of [b.glints, b.cracks]) expect(box(g).min.z).toBeCloseTo(slab.max.z, 6);
      expect(box(b.cap).min.y).toBeCloseTo(slab.max.y, 6);
      // No snow over the chamfered rim: the cap stays inside the slab's flat top.
      expect(box(b.cap).max.x).toBeLessThanOrEqual(slab.max.x - 0.04 + 1e-6);
      expect(box(b.cap).min.x).toBeGreaterThanOrEqual(slab.min.x + 0.04 - 1e-6);
    }
  });

  it('4.4: no cell of the cow\'s mouth is inside its head', () => {
    const m = animalModel('cow');
    const head = m.cells.head, cavity = cavityOf(head);
    for (const k of Object.keys(m.mouths) as (keyof typeof m.mouths)[]) {
      for (const key of (m.mouths[k] as { cells?: Map<string, unknown> }).cells?.keys() ?? []) {
        expect(head.has(key), `${k} ${key}`).toBe(false);
        expect(cavity?.has(key) ?? false, `${k} ${key}`).toBe(false);
      }
    }
  });

  it('4.7: anchors are measured: feet on the ground, the plate over the top, the hat on the crown', () => {
    for (const sp of SPECIES) {
      const a = anchorsOf(animalModel(sp));
      expect(Math.abs(a.feet[1])).toBeLessThan(1e-6);
      expect(a.plate[1]).toBeGreaterThan(a.top);
      expect(a.top).toBeGreaterThanOrEqual(a.hatTip[1] - 1e-6);
      expect(a.bounds.max[1]).toBeCloseTo(a.top, 6);
      expect(anchorsOf(animalModel(sp))).toBe(a);
    }
  });

  it('4.7: every species but the sheep has its own scarf, every ring cell touching the animal', () => {
    for (const sp of SPECIES.slice(1)) {
      const m = animalModel(sp), ring = anchorsOf(m).neckRing!;
      const cells = scarfCells(m);
      expect(cells.length, sp).toBeGreaterThan(20);
      const own = new Set(cells.map(([x, y, z]) => `${x},${y},${z}`));
      for (const [x, y, z] of cells) {
        expect(ring.taken.has(`${x},${y},${z}`), `${sp} overlaps the animal`).toBe(false);
        const touches = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => ring.solid.has(`${x + dx},${y + dy},${z + dz}`) || own.has(`${x + dx},${y + dy},${z + dz}`));
        expect(touches, `${sp} ${x},${y},${z}`).toBe(true);
      }
    }
    expect(scarfCells(animalModel('sheep'))).toEqual([]);
  });
});
