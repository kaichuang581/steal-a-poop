import { describe, expect, it } from 'vitest';
import { animalModel } from '../animals';
import { chickenOrientation, faceRule, garmentCheck, notch, proportions, RATIO_NAMES, ratioFails, roots, SHEET, sheepHead } from '../animals/measure';
import type { Species } from '../animals/rig';

/** V5.1 Part 7, tests 1 to 4, 6 and 8, for every species. The numbers are printed by tools/animalReport.ts. */
const SPECIES: Species[] = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'];

for (const species of SPECIES) {
  describe(`${species} (V5.1 Part 7)`, () => {
    const m = animalModel(species);
    it('1. keeps every ratio of the proportion sheet', () => {
      const r = proportions(m);
      const bad = ratioFails(m).map((k) => `${RATIO_NAMES[k]} ${r[k].toFixed(2)} (${SHEET[species][k][0]} to ${SHEET[species][k][1]})`);
      expect(bad, bad.join('; ')).toEqual([]);
    });
    it('2. has no notch between the withers and the crown', () => {
      const n = notch(m);
      expect(n.dip, `dip ${n.dip}`).toBeLessThanOrEqual(2);
      expect(n.spike, `notch ${n.spike}`).toBeLessThanOrEqual(2);
    });
    it('3. roots every ear, horn, tail, comb, beard, beak and wing in its parent', () => {
      const bad = roots(m).filter((r) => !r.ok).map((r) => `${r.part}: ${r.contact} touching, spans ${r.spans.join('/')}`);
      expect(bad, bad.join('; ')).toEqual([]);
    });
    it('4. paints every mouth, lid and brow on the face, never below the chin', () => {
      const bad = faceRule(m).filter((c) => !c.ok).map((c) => `${c.part}: ${c.off} off, ${c.belowChin} below`);
      expect(bad, bad.join('; ')).toEqual([]);
    });
    if (species !== 'sheep') it('5. shells every exposed face of its zone, leaves the belly bare, bands the neck, keeps off the head', () => {
      const g = garmentCheck(m);
      expect(g, 'no garment').not.toBeNull();
      expect(g!.missing, 'faces left bare in the zone').toBe(0);
      expect(g!.bare, `bare share ${g!.bare.toFixed(2)}`).toBeGreaterThanOrEqual(g!.bareMin - 1e-9);
      if (g!.needsBand) expect(g!.band, 'neck band').toBeGreaterThan(0);
      expect(g!.nearHead, 'shell voxels within two of the head or ears').toBe(0);
    });
    if (species === 'chicken') it('6. stands horizontal, head forward, tail high', () => expect(chickenOrientation(m)).toMatchObject({ ok: true }));
    if (species === 'sheep') it('8. has a head wider than tall, level with its back, with long ears', () => expect(sheepHead(m)).toMatchObject({ ok: true }));
  });
}
