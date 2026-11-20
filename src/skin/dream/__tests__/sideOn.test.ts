import { describe, expect, it } from 'vitest';
import { FIELD, JUMP_HEIGHT } from '../../../dream/dream';
import {
  A, ART, bumpOverlap, DISC_MAX_H, dreamLayout, dreamSpan, dreamView, fenceWarning, frameToWorld, GROUND, jumpClearance, PX, screenX, screenY,
  SHEEP_ART, SHEEP_CENTRE, SHEEP_SCALE, signScale, STRIP, worldX,
} from '../stage';
import { signCap } from '../world';
import { anchorsOf } from '../../voxel/animals/anchors';
import { SHEEP_DRAW, sheepModel } from '../../voxel/sheep';

/**
 * Counting Sheep seen side-on, "like the dinosaur game" (plan file 09, 4.2, 4.3 and 4.7). Every number here is
 * arithmetic from the rules' own constants and the mapping; nothing renders.
 */

/** The gate's sizes: width, height, and whether the dream takes it for a phone held upright (narrower than 640). */
const SIZES = [[1280, 800], [1920, 1080], [1024, 768], [844, 390], [390, 844], [390, 450]] as const;
const phoneAt = (w: number) => w < 640;
const SPEEDS = [120, 265, 320] as const;

/**
 * The floor: today's oblique and widened perspective cameras (V4.1's dreamShot, before this milestone), measured by
 * projection on 2026-11-17 (plan file 09, 4.1). Warning: seconds before take-off that the fence's face on the lane's
 * centre line comes into the frame, at 120 / 265 / 320. Letters: a three-letter sign's cap height in CSS px when its
 * fence comes into the frame (on an upright phone the sign grows as it nears: 25.5 px at logical x 200, 28.5 at
 * take-off). Sheep: the drawn sheep's height in CSS px, feet to the top of its head (no hat), the model's own height at
 rest (anchorsOf: 1.0 model units, 0.5538 m at the dream's scale) projected through those cameras.
 */
const TODAY: Record<string, { warning: readonly [number, number, number]; letters: number; sheep: number }> = {
  '1280x800': { warning: [1.165, 0.331, 0.212], letters: 37.4, sheep: 83.2 },
  '1920x1080': { warning: [1.236, 0.363, 0.239], letters: 52.3, sheep: 116.4 },
  '1024x768': { warning: [1.165, 0.331, 0.212], letters: 29.9, sheep: 66.5 },
  '844x390': { warning: [1.635, 0.543, 0.388], letters: 16.7, sheep: 37.1 },
  '390x844': { warning: [1.206, 0.349, 0.227], letters: 23.2, sheep: 47.9 },
  '390x450': { warning: [2.955, 1.141, 0.883], letters: 9.8, sheep: 25.5 },
};

/**
 * The table of 4.2: span, CSS px per logical px, the play strip, the sheep without and with its hat, and the letters.
 * 844 x 390 holds a span of 300, not the plan's 252, so that it keeps today's warning (the floor above).
 */
const TABLE: Record<string, { span: number; s: number; strip: number; sheep: number; hat: number; letters: number }> = {
  '1280x800': { span: 320, s: 4, strip: 384, sheep: 83, hat: 115, letters: 42 },
  '1920x1080': { span: 320, s: 6, strip: 576, sheep: 125, hat: 173, letters: 63 },
  '1024x768': { span: 306, s: 3.35, strip: 322, sheep: 70, hat: 97, letters: 35 },
  '844x390': { span: 300, s: 2.81, strip: 270, sheep: 58, hat: 81, letters: 30 },
  '390x844': { span: 240, s: 1.625, strip: 156, sheep: 34, hat: 47, letters: 25 },
  '390x450': { span: 240, s: 1.625, strip: 156, sheep: 34, hat: 47, letters: 25 },
};

const viewOf = (w: number, h: number) => dreamView(w, h, phoneAt(w));
/**
 * The drawn sheep, measured from its model at rest (anchorsOf): logical px from its feet to the top of its head, through
 * the scale DreamStage draws it at (SHEEP_SCALE times the sheep's own drawScale, then ART); and its height in CSS px in the view `v`.
 */
const rest = anchorsOf(sheepModel());
const SHEEP_HEAD = ((rest.crown[1] - rest.feet[1]) * SHEEP_SCALE * SHEEP_DRAW) / PX;
const sheepPx = (v: ReturnType<typeof viewOf>) => ART * SHEEP_HEAD * v.s;
const letterPx = (w: number, h: number) => signCap(3) * signScale(phoneAt(w)) * viewOf(w, h).zoom;

describe('the side view\'s mapping (plan file 09, 4.2)', () => {
  it('gives each size its span, scale and left edge', () => {
    for (const [w, h] of SIZES) {
      const v = viewOf(w, h), row = TABLE[`${w}x${h}`], phone = phoneAt(w);
      expect(v.span).toBeCloseTo(dreamSpan(w, phone), 9);
      expect(Math.abs(v.span - row.span)).toBeLessThan(0.5);
      expect(v.s).toBeCloseTo(w / v.span, 9);
      expect(Math.abs(v.s - row.s)).toBeLessThan(0.01);
      expect(v.l0).toBeCloseTo(88 - (phone ? 0.2 : 0.22) * v.span, 9);
      expect(v.zoom).toBeCloseTo(v.s / PX, 9);
    }
    expect(dreamSpan(5000, false)).toBe(320);
    expect(dreamSpan(390, true)).toBe(240);
  });
  it('puts the runner\'s centre at 22% of the width (phone 20%) and the ground line at 68% (phone 55%)', () => {
    for (const [w, h] of SIZES) {
      const v = viewOf(w, h), phone = phoneAt(w);
      expect(Math.abs(screenX(v, SHEEP_CENTRE) / v.s - (phone ? A.phone : A.computer) * v.span)).toBeLessThanOrEqual(0.5);
      expect(screenY(v, 0)).toBeCloseTo((phone ? GROUND.phone : GROUND.computer) * h, 9);
      expect(screenX(v, v.l0 + v.span)).toBeCloseTo(w, 6);
    }
  });
  it('agrees with the camera: the frame\'s centre, its edges and the ground line land where the helpers say', () => {
    for (const [w, h] of SIZES) {
      const v = viewOf(w, h);
      expect(frameToWorld(v, 50, 50)[0]).toBeCloseTo(v.camX, 9);
      expect(frameToWorld(v, 50, 50)[1]).toBeCloseTo(v.camY, 9);
      expect(frameToWorld(v, 0, 0)[0]).toBeCloseTo(worldX(v.l0), 9);
      expect(frameToWorld(v, 100, (screenY(v, 0) / h) * 100)[1]).toBeCloseTo(0, 9);
      expect(frameToWorld(v, (screenX(v, 200) / w) * 100, 0)[0]).toBeCloseTo(worldX(200), 9);
    }
  });
  it('matches the table within 1 px: strip, sheep, sheep with its hat, letters', () => {
    for (const [w, h] of SIZES) {
      const v = viewOf(w, h), row = TABLE[`${w}x${h}`];
      expect(Math.abs((STRIP.over + STRIP.under) * v.s - row.strip)).toBeLessThanOrEqual(1);
      expect(Math.abs(sheepPx(v) - row.sheep)).toBeLessThanOrEqual(1);
      expect(Math.abs(ART * SHEEP_ART.hat * v.s - row.hat)).toBeLessThanOrEqual(1);
      expect(Math.abs(letterPx(w, h) - row.letters)).toBeLessThanOrEqual(1);
    }
  });
  it('keeps the sheep at least 80 px tall at 1280 x 800, measured from its model', () => {
    expect(sheepPx(viewOf(1280, 800))).toBeGreaterThanOrEqual(80);
  });
  it('shows every fence at least as early as today at every size (an upright phone with its keyboard up: as early as without it)', () => {
    for (const [w, h] of SIZES) {
      const floor = TODAY[w === 390 && h === 450 ? '390x844' : `${w}x${h}`].warning;
      SPEEDS.forEach((speed, i) => expect(fenceWarning(viewOf(w, h), speed)).toBeGreaterThanOrEqual(floor[i]));
    }
    // The plan's own figures at 1280 x 800: 1.79 / 0.61 / 0.45 s.
    expect(SPEEDS.map((v) => +fenceWarning(viewOf(1280, 800), v).toFixed(2))).toEqual([1.79, 0.61, 0.45]);
  });
  it('draws the letters at least as tall as today at every size', () => {
    for (const [w, h] of SIZES) expect(letterPx(w, h)).toBeGreaterThanOrEqual(TODAY[`${w}x${h}`].letters);
  });
  it('keeps the admin\'s photo inside the strip at the jump\'s apex', () => {
    expect(ART * JUMP_HEIGHT + (ART * DISC_MAX_H) / PX).toBeLessThanOrEqual(STRIP.over);
    expect(ART * JUMP_HEIGHT + ART * SHEEP_ART.hat).toBeLessThanOrEqual(STRIP.over);
  });
});

describe('the jump and the bump, drawn (plan file 09, 4.3)', () => {
  it('clears the drawn fence by at least 3 logical px at 120, 265 and 320, with the leap\'s pitch and without', () => {
    for (const speed of SPEEDS) for (const pitched of [true, false]) expect(jumpClearance(speed, pitched)).toBeGreaterThanOrEqual(3);
    // For the level arc: 6.3 / 14.2 / 14.8 with the sheep of Brian's sheet (2026-11-19), 19.0 long with the extra all
    // tail; the plan's figures, 8.4 / 14.6 / 15.1, were for the 17.2 sheep it measured. The rule is the 3 px above.
    expect(SPEEDS.map((v) => +jumpClearance(v, false).toFixed(1))).toEqual([6.3, 14.2, 14.8]);
  });
  it('meets the rail at the bump and is clear of it once knocked back', () => {
    expect(bumpOverlap(0)).toBeGreaterThan(0);
    expect(bumpOverlap(0)).toBeLessThanOrEqual(7);
    expect(bumpOverlap(200)).toBe(0);
    // The rules' bump: the fence at sheepX + sheepW - 3.
    expect(FIELD.sheepX + FIELD.sheepW - 3).toBe(95);
  });
});

describe('the HTML over the side view (plan file 09, 4.6)', () => {
  it('keeps the bubble and the thought trail off the play strip\'s sheep, and the bubble on screen', () => {
    for (const [w, h] of SIZES) {
      const v = viewOf(w, h), lay = dreamLayout(v), b = lay.bubble;
      expect(b.shown).toBe(true);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h).toBeLessThanOrEqual(h);
      // Below the strip, or above it: never across it.
      expect(b.y >= lay.stripBottom || b.y + b.h <= lay.stripTop).toBe(true);
      const off = (r: { x: number; y: number; w: number; h: number }, o: typeof r) => r.x + r.w <= o.x || o.x + o.w <= r.x || r.y + r.h <= o.y || o.y + o.h <= r.y;
      for (const p of lay.puffs) expect(off(p, lay.sheep)).toBe(true);
    }
  });
});
