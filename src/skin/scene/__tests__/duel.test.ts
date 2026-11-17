import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BOMB_RADIUS } from '../../voxel/bomb';
import { BOARD } from '../../voxel/table';
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

/** A box on the screen, in pixels from the top left. */
interface Rect { left: number; top: number; right: number; bottom: number }
const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The fight card's box (the two slips and the VS, `[aria-label="Who is playing"]` in PaintedGame.tsx), measured in the
 * browser on 2026-11-17 in a practice run against the easy bot (Brian VS Barley): 509.7 to 770.3 by 12 to 63 at
 * 1280 x 800, 64.7 to 325.3 by 64 to 115 at 390 x 844. Rounded outward.
 */
const SCREENS = [
  { name: 'computer', width: 1280, height: 800, phone: false, card: { left: 509, top: 12, right: 771, bottom: 63 } },
  { name: 'phone', width: 390, height: 844, phone: true, card: { left: 64, top: 64, right: 326, bottom: 115 } },
] as const;

function project(points: Vector3[], speaker: number | null, pressure: number, screen: (typeof SCREENS)[number]): Rect {
  const shot = duelShot(speaker, pressure, screen.phone);
  const camera = new PerspectiveCamera(shot.fov, screen.width / screen.height, 0.1, 900);
  camera.position.set(...shot.position);
  camera.lookAt(new Vector3(...shot.target));
  camera.updateMatrixWorld();
  const r: Rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const p of points) {
    const q = p.clone().project(camera);
    const x = ((q.x + 1) / 2) * screen.width, y = ((1 - q.y) / 2) * screen.height;
    r.left = Math.min(r.left, x); r.right = Math.max(r.right, x); r.top = Math.min(r.top, y); r.bottom = Math.max(r.bottom, y);
  }
  return r;
}

const corners = (x: [number, number], y: [number, number], z: [number, number], turn = 0) =>
  x.flatMap((a) => y.flatMap((b) => z.map((c) => new Vector3(a * Math.cos(turn) + c * Math.sin(turn), b, -a * Math.sin(turn) + c * Math.cos(turn)))));

/** The board hangs on 0.2 m of rope under the hook: its bottom is this far under it (BOARD.height and the rope). */
const HANG = BOARD.height + 0.2;

/**
 * The sign: the board (its ice block on a trap letter, 0.24 m deep), its ropes, and the arm's crossbar with the snow on
 * it, 0.2 m over the arm. The board turns about the hook to face the camera, as LetterBoard does.
 */
function signBox(speaker: number | null, pressure: number, screen: (typeof SCREENS)[number]): Rect {
  const [hx, hy, hz] = DUEL.hook;
  const bottom = hy - HANG;
  const cam = duelShot(speaker, pressure, screen.phone).position;
  const turn = Math.atan2(-(cam[0] - hx), -(cam[2] - hz));
  const half = Math.max(BOARD.width / 2, 0.45);
  return project(corners([-half, half], [bottom, DUEL.post.armY + 0.2], [-0.12, 0.12], turn).map((p) => p.add(new Vector3(hx, 0, hz))), speaker, pressure, screen);
}

/** The bomb resting on the ice in front of the speaker (DuelTable's duelSpot), as the checker's PLACED takes it: its body, a ball `size` times the table's. */
function bombBox(speaker: number, size: number, pressure: number, screen: (typeof SCREENS)[number]): Rect {
  const r = BOMB_RADIUS * 1.5 * size;
  const seat = duelSeat(speaker), x = seat.x - Math.sign(seat.x) * (0.85 + r), z = -0.3;
  return project(corners([x - r, x + r], [0, 2 * r], [z - r, z + r]), speaker, pressure, screen);
}

describe('the sign on the ice stays clear of the fight card and the bomb (plan file 08, section 4.1)', () => {
  const cases = SCREENS.flatMap((screen) => ([null, 0, 1] as const).flatMap((speaker) => [0, 0.5, 1].map((pressure) => ({ screen, speaker, pressure }))));

  it.each(cases)('$screen.name, speaker $speaker, pressure $pressure: the sign is in frame and under the fight card', ({ screen, speaker, pressure }) => {
    const sign = signBox(speaker, pressure, screen);
    expect(sign.top).toBeGreaterThanOrEqual(0.02 * screen.height);
    expect(overlaps(sign, screen.card)).toBe(false);
  });

  it.each(cases.filter((c) => c.speaker !== null))('$screen.name, speaker $speaker, pressure $pressure: no bomb up to DUEL.maxBomb runs into the sign', ({ screen, speaker, pressure }) => {
    const sign = signBox(speaker, pressure, screen);
    for (let size = 1; size <= DUEL.maxBomb + 1e-9; size += 0.1) expect(overlaps(sign, bombBox(speaker!, size, pressure, screen))).toBe(false);
  });

  it('the arm the board hangs from is at the hook', () => {
    expect(DUEL.post.armY).toBe(DUEL.hook[1]);
  });
});
