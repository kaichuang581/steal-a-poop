import { describe, expect, it } from 'vitest';
import { animalModel } from '../../voxel/animals';
import type { Species } from '../../voxel/animals/rig';
import { swellY } from '../Sheep';

/**
 * Legs join their bodies (V5.1 Part 4.2.3), at every coat level and while the coat breathes. Brian, 2026-11-08: "all
 * the animal bodies are floating on the legs". Each column of every leg's shaft must meet the coat drawn at that level
 * with no air between them, and the coat must swell about the legs' tops so a breath or a puff never lifts it off.
 */
const SPECIES: Species[] = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'];

describe('legs join the body', () => {
  for (const sp of SPECIES) {
    it(`${sp}: no air over any leg, at any coat level`, () => {
      const m = animalModel(sp);
      const coats = { sheared: m.sheared.cells!, 1: m.wools[1].cells!, 2: m.wools[2].cells!, 3: m.wools[3].cells!, 4: m.wools[4].cells! };
      const gaps: string[] = [];
      m.legs.forEach((leg, i) => {
        // The top of each shaft column (the hoof rows below y 2 splay out under nothing).
        const tops = new Map<string, { x: number; y: number; z: number }>();
        for (const v of leg.cells!.values()) if (v.y >= 2) { const k = `${v.x},${v.z}`; if ((tops.get(k)?.y ?? -1) < v.y) tops.set(k, v); }
        for (const [level, coat] of Object.entries(coats)) for (const t of tops.values()) {
          let low = Infinity;
          for (const v of coat.values()) if (v.x === t.x && v.z === t.z && v.y > 1) low = Math.min(low, v.y);
          if (low > t.y + 1) gaps.push(`leg ${i} at ${t.x},${t.z}, coat ${level}: ${low - t.y - 1} voxels of air`);
        }
      });
      expect(gaps).toEqual([]);
    });
  }

  it('the coat swells about the legs\' tops, so the belly stays put', () => {
    for (const sp of SPECIES) {
      const belly = animalModel(sp).legs[0].pivot[1];
      for (const k of [0.94, 1, 1.06 * 1.025, 1.12 * 1.025]) expect(belly * k + swellY(belly, k)).toBeCloseTo(belly, 9);
    }
  });
});
