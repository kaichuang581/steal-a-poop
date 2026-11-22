import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { cupVoxels, PRIZE_SCALE } from '../cup';
import { CRATE, CRATE_HEIGHTS } from '../island';
import { METALS, podiumVoxels } from '../podium';
import { PARTY_SKY, skyAt } from '../sky';
import { shade } from '../../voxel/paint';
import { FAR_SPOTS, skyBehind } from '../frame';

/** Pieces joined by a face. */
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
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const o = `${x + dx},${y + dy},${z + dz}`;
        if (all.has(o) && !seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
  }
  return n;
}

// Brian, 2026-11-22: livelier podiums, a cooler trophy floating and glowing, a party sky.
describe('the leaderboards\' party', () => {
  for (const place of [1, 2, 3] as const) {
    it(`podium ${place}: the crate's footprint and height, one piece, its own metal, its number on a star, bulbs on it`, () => {
      const h = CRATE_HEIGHTS[place - 1], v = podiumVoxels(place, h);
      const xs = [...v.body.map.values()].map((c) => c.x), zs = [...v.body.map.values()].map((c) => c.z), ys = [...v.body.map.values()].map((c) => c.y);
      expect((Math.max(...xs) - Math.min(...xs) + 1) * v.body.size).toBeCloseTo(CRATE.w, 6);
      expect((Math.max(...zs) - Math.min(...zs) + 1) * v.body.size).toBeCloseTo(CRATE.d, 6);
      expect((Math.max(...ys) + 1) * v.body.size).toBeCloseTo(h, 6);
      expect(Math.min(...ys)).toBe(0);
      expect(pieces(v.body.map.keys())).toBe(1);
      expect(pieces(v.badge.map.keys())).toBe(1);
      const metal = shade(METALS[place][1]).join();
      expect([...v.body.map.values()].filter((c) => c.c.join() === metal).length).toBeGreaterThan(100);
      expect(v.bulbs.length).toBeGreaterThan(10);
      // Nothing of it stands past the top's front edge, where the second's legs hang.
      for (const [, y, z] of v.bulbs) if (y > h - 0.4) expect(z).toBeLessThan(CRATE.d / 2);
      for (const c of v.badge.map.values()) expect((c.z + 1) * v.badge.size).toBeLessThanOrEqual(CRATE.d / 2 + 1e-9);
    });
  }

  it('the trophy is one piece with its ruby, taller than it is wide, and drawn at a size that floats clear of the head', () => {
    const v = cupVoxels();
    expect(pieces([...v.body.map.keys(), ...v.gem.map.keys()])).toBe(1);
    const xs = [...v.body.map.values()].map((c) => c.x);
    expect(v.height).toBeGreaterThan((Math.max(...xs) - Math.min(...xs) + 1) * v.body.size);
    expect(v.height * PRIZE_SCALE).toBeGreaterThan(0.6);
    expect(v.height * PRIZE_SCALE).toBeLessThan(1);
  });

  it('the sky runs from deep indigo at the top to a gold glow at the foot, and the far islands take its colour', () => {
    expect(PARTY_SKY[0][0]).toBe(0);
    expect(PARTY_SKY[PARTY_SKY.length - 1][0]).toBe(1);
    const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    for (let f = 0.1; f <= 1; f += 0.1) expect(lum(skyAt(f))).toBeGreaterThanOrEqual(lum(skyAt(f - 0.1)) - 1e-6);
    for (const n of Object.keys(FAR_SPOTS) as (keyof typeof FAR_SPOTS)[]) expect(skyBehind(n).getHex()).toBe(skyAt(FAR_SPOTS[n].sy).getHex());
  });
});
