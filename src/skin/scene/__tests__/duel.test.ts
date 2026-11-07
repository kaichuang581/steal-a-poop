import { describe, expect, it } from 'vitest';
import { buildDuel, DUEL, duelSeat, duelShot } from '../duel';
import { SHEEP_SCALE } from '../layout';

/** Half the width of the view at the sheep, for a screen of this aspect. */
const halfWidth = (shot: ReturnType<typeof duelShot>, aspect: number) =>
  Math.abs(shot.position[2]) * Math.tan((shot.fov * Math.PI) / 360) * aspect;

describe('the practice duel', () => {
  it('stands you and the bot face to face, you on the left of the screen', () => {
    const you = duelSeat(0), bot = duelSeat(1);
    expect(you.x).toBeGreaterThan(0); // the camera looks toward +z, so +x is screen left
    expect(bot.x).toBe(-you.x);
    expect(you.z).toBe(bot.z);
    // The model's front is +z, so a yaw of y points it along (sin y, cos y).
    expect(Math.sin(you.yaw)).toBeCloseTo(-1);
    expect(Math.sin(bot.yaw)).toBeCloseTo(1);
  });

  it('the camera closes in as the clock runs out, and opens wide before the first turn', () => {
    for (const phone of [false, true]) {
      const open = Math.abs(duelShot(null, 0, phone).position[2]);
      const calm = Math.abs(duelShot(0, 0, phone).position[2]);
      const tense = Math.abs(duelShot(0, 1, phone).position[2]);
      expect(open).toBeGreaterThan(calm);
      expect(calm).toBeGreaterThan(tense);
    }
  });

  it('keeps both sheep in frame at full pressure, on a wide screen and on a phone', () => {
    const body = 0.75 * SHEEP_SCALE; // half a sheep, seen side on
    for (const [phone, aspect] of [[false, 16 / 9], [true, 9 / 19]] as const) {
      for (const speaker of [0, 1]) {
        const shot = duelShot(speaker, 1, phone);
        for (const seat of [0, 1]) {
          expect(Math.abs(duelSeat(seat).x - shot.target[0]) + body).toBeLessThan(halfWidth(shot, aspect));
        }
      }
    }
  });

  it('leans toward whoever is on turn', () => {
    expect(duelShot(0, 1, false).target[0]).toBeGreaterThan(0);
    expect(duelShot(1, 1, false).target[0]).toBeLessThan(0);
  });

  it('builds the place once, with both sheep standing on the ice', () => {
    const w = buildDuel();
    expect(buildDuel()).toBe(w);
    w.ice.computeBoundingBox();
    const b = w.ice.boundingBox!;
    expect(b.max.y).toBeCloseTo(0);
    expect(b.max.x).toBeGreaterThan(DUEL.gap + 1);
    expect(b.min.x).toBeLessThan(-DUEL.gap - 1);
    expect(b.min.y).toBeGreaterThanOrEqual(DUEL.waterY - 0.3);
  });
});
