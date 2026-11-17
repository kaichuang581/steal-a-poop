import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { animalModel } from '../animals';
import { contactPatch, footBounds, patchCells, PATCH_VOXEL } from '../contactPatch';
import { sheepModel } from '../sheep';

const SPECIES = ['pig', 'cow', 'goat', 'horse', 'chicken'] as const;
const models = [['sheep', sheepModel()] as const, ...SPECIES.map((a) => [a, animalModel(a)] as const)];

describe('ground-contact patch (plan file 02, change 5)', () => {
  for (const [name, m] of models) {
    describe(name, () => {
      const cells = patchCells(m);
      const has = new Set(cells.map(([x, z]) => `${x},${z}`));

      it('is one piece', () => {
        const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
        const todo = [cells[0]];
        while (todo.length) {
          const [x, z] = todo.pop()!;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${x + dx},${z + dz}`;
            if (has.has(k) && !seen.has(k)) { seen.add(k); todo.push([x + dx, z + dz]); }
          }
        }
        expect(seen.size).toBe(cells.length);
      });

      it('is under every foot at rest, with a cell to spare round the feet', () => {
        const f = footBounds(m);
        expect(Number.isFinite(f.minX) && Number.isFinite(f.minZ)).toBe(true);
        const v = new Vector3();
        for (const leg of m.legs) {
          const p = leg.geo.getAttribute('position');
          for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            if (v.y + leg.pivot[1] > PATCH_VOXEL + 1e-6) continue;
            // The cells either side of a hoof corner, and one more beyond it.
            const x = v.x + leg.pivot[0], z = v.z + leg.pivot[2];
            for (const dx of [-PATCH_VOXEL * 0.5, PATCH_VOXEL * 0.5]) for (const dz of [-PATCH_VOXEL * 0.5, PATCH_VOXEL * 0.5])
              expect(has.has(`${Math.floor((x + dx) / PATCH_VOXEL)},${Math.floor((z + dz) / PATCH_VOXEL)}`), `${name} foot at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true);
          }
        }
      });

      it('has no face in the ground plane, its top just above it, and no underside', () => {
        const g = contactPatch(m);
        const p = g.getAttribute('position'), n = g.getAttribute('normal');
        let top = -Infinity;
        for (let i = 0; i < p.count; i++) {
          expect(Math.abs(p.getY(i))).toBeGreaterThan(1e-4);
          top = Math.max(top, p.getY(i));
          expect(n.getY(i)).toBeGreaterThanOrEqual(0);
        }
        expect(top).toBeCloseTo(0.005, 6);
        expect(contactPatch(m)).toBe(g); // built once, reused
      });

      it('costs about 300 triangles', () => {
        const tris = (contactPatch(m).index?.count ?? 0) / 3;
        expect(tris).toBeLessThan(700);
      });
    });
  }
});
