import { describe, expect, it } from 'vitest';
import { HEAP, seatPosition, SPEAKER_CAMERA } from '../../scene/layout';
import { BOMB_RADIUS } from '../../voxel/bomb';
import { barnSide, barnSpot, BOMB_SIZES, LETTERS_BOX } from '../Bomb';

/** The bomb's side at the barn (plan files 06 4.3 and 07 4.2), for every speaker at tables of 2 to 10, on both screens. */
const shots = () => Array.from({ length: 9 }, (_, k) => k + 2).flatMap((n) => Array.from({ length: n }, (_, i) => [i, n] as const));

describe('where the bomb rests at the barn', () => {
  it('the floating letters\' box is the one the browser measured (.sk-input-bar at a six-seat table, 1280 x 800 and 390 x 844)', () => {
    expect(LETTERS_BOX.desktop).toEqual({ x0: 256, y0: 627, x1: 1024, y1: 788 });
    expect(LETTERS_BOX.phone).toEqual({ x0: 8, y0: 689, x1: 382, y1: 832 });
    expect(BOMB_SIZES[0]).toBe(1);
    expect(BOMB_SIZES[BOMB_SIZES.length - 1]).toBe(3.2);
  });

  for (const phone of [false, true]) {
    const label = phone ? '390 x 844' : '1280 x 800';
    it(`stays on the floor beside the stepped-in speaker, 0.42 m plus its radius out (${label})`, () => {
      for (const [i, n] of shots()) {
        const p = seatPosition(i, n), dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz);
        const sx = p.x + (dx / len) * (SPEAKER_CAMERA.step - 0.05), sz = p.z + (dz / len) * (SPEAKER_CAMERA.step - 0.05);
        for (const size of BOMB_SIZES) {
          const r = BOMB_RADIUS * 1.5 * size;
          const [x, z] = barnSpot(i, n, phone)(r);
          expect(Math.hypot(x - sx, z - sz)).toBeCloseTo(0.42 + r, 6);
        }
      }
    });

    it(`takes the side that stays clear of the letters and the plate the longest as it swells, else today's (${label})`, () => {
      for (const [i, n] of shots()) {
        const b = barnSide(i, n, phone);
        expect(b.clearUpTo[b.side], `n=${n} seat=${i}`).toBeGreaterThanOrEqual(b.clearUpTo[-b.side]);
        if (!b.clearUpTo[1] && !b.clearUpTo[-1]) expect(b.side).toBe(b.today);
      }
    });
  }

  it('on a phone a fresh bomb, up to size 1.8, is clear of the letters and the plate at every speaker', () => {
    for (const [i, n] of shots()) {
      const b = barnSide(i, n, true);
      expect(BOMB_SIZES[b.clearUpTo[b.side] - 1] ?? 0, `n=${n} seat=${i}`).toBeGreaterThanOrEqual(1.8);
    }
  });

  it('on a computer no side is clear of the measured letters\' box at any size, so today\'s side stands (a shortfall for Brian)', () => {
    // The box is 768 px wide and covers the bottom fifth, where the floor beside the speaker is in every shot; the
    // plan's rule falls back to today's choice. If the box or the shots change so a side clears, this fails: then
    // replace it with the plan's check (the chosen box overlaps neither, every size).
    for (const [i, n] of shots()) {
      const b = barnSide(i, n, false);
      expect(Math.max(b.clearUpTo[1], b.clearUpTo[-1])).toBe(0);
      expect(b.side).toBe(b.today);
    }
  });
});
