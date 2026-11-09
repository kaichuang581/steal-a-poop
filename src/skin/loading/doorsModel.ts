import { FROST, lin, T } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

/**
 * The loading screen's barn doors as voxels, rendered once to images by tools/renderDoors.mjs (?preview=doors) and shown
 * by BarnDoors.tsx. A live scene can't be the loading screen: it has to be there on the first frame and keep moving
 * while the page is busy building the farm. So the doors are built and lit like the rest of the game, then baked.
 *
 * Three parts, each its own image, on one 0.05 m grid so they line up at the same scale on screen:
 * - leaves: both doors side by side, 96 x 52 voxels (4.8 x 2.6 m, near 16:9), split exactly down the middle;
 * - lintel: the snowy header beam with icicles, laid over the top of the screen;
 * - sill: the drift banked against the foot of the doors.
 */
export { DOOR_BOXES, DOOR_VOXEL, DOORS_W, LEAF_H, LEAF_W, LINTEL_BEAM, LINTEL_ICICLE, LINTEL_SNOW, SILL_ROWS } from './doorBoxes';
import { DOORS_W, DOOR_VOXEL, LEAF_H, LEAF_W, LINTEL_BEAM, LINTEL_ICICLE, LINTEL_SNOW, SILL_ROWS } from './doorBoxes';

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const IRON: readonly [string, string, string] = ['#4D4845', '#3B3734', '#2B2725'];
const RIVET = '#77706A';
const WREATH: readonly [string, string, string] = ['#3F7A4E', '#30643F', '#244E31'];
const BERRY = '#C8342E';
const BOW: readonly [string, string, string] = ['#D23F36', '#B5322B', '#8E2620'];

/** Both door leaves. x runs 0..95 across the doorway, y 0..71 up from the sill, z out towards the viewer. */
export function buildLeaves(): Grid {
  const g = new Grid(DOOR_VOXEL);
  const frost = lin(FROST);
  for (let gx = 0; gx < DOORS_W; gx++) {
    const side = gx < LEAF_W ? 0 : 1;
    // i counts from the leaf's hinge edge (0) to the crack (47), so both leaves are built the same way, mirrored.
    const i = side === 0 ? gx : DOORS_W - 1 - gx;
    const board = Math.floor(i / 4);
    const seam = i % 4 === 3 || i === LEAF_W - 1;
    // Each board its own tone and a little lighter or darker, like boards painted at different times.
    const base = shade(lin(T.barn[Math.floor(hash3(board, side, 0, 11) * 2.2)]), 0.92 + hash3(board, side, 1, 12) * 0.16);
    for (let y = 0; y < LEAF_H; y++) {
      // The backing, and in the seams (and the crack) a dark groove.
      g.set(gx, y, 0, i === LEAF_W - 1 ? lin('#1C0F0B') : shade(lin(T.barn[2]), 0.55));
      if (seam) continue;
      // Grain: long streaks down each board, now and then a knot.
      const streak = hash3(i, Math.floor(y / (4 + Math.floor(hash3(i, side, 2, 13) * 6))), side, 14);
      let c = shade(base, streak < 0.22 ? 0.88 : streak > 0.9 ? 1.06 : 1);
      if (hash3(Math.floor(i / 2), Math.floor(y / 2), side, 15) > 0.985) c = shade(base, 0.72);
      // Weathering: the lowest boards darker where the snow sits against them, then frost creeping up.
      if (y < 10) c = shade(c, 0.86 + y * 0.014);
      // Frost: a soft pale bloom at the very foot, not specks.
      if (y < 6) c = mix(c, frost, (6 - y) * 0.05);
      g.set(gx, y, 1, c);
    }
    // The white-painted frame and cross, raised a voxel, with worn paint: some greyer, a few chips showing the red.
    const trim = (y: number) => {
      const r = hash3(gx, y, 2, 21);
      if (r < 0.006) return; // the odd chip, showing the red
      const c = lin(r < 0.86 ? T.trim[0] : T.trim[1]);
      g.set(gx, y, 2, c);
    };
    const inFrameEdge = i <= 2 || (i >= LEAF_W - 4 && i <= LEAF_W - 2);
    for (let y = 0; y < LEAF_H; y++) {
      if (i === LEAF_W - 1) continue;
      if (inFrameEdge || y <= 2 || y >= LEAF_H - 3) { trim(y); continue; }
      // The cross: two diagonals from corner to corner of the frame's inside, four voxels across.
      const t = (y - 3) / (LEAF_H - 7);
      const a = 3 + t * (LEAF_W - 8), b = LEAF_W - 5 - t * (LEAF_W - 8);
      if (Math.abs(i - a) < 2 || Math.abs(i - b) < 2) trim(y);
    }
  }
  // Iron: two strap hinges from each hinge edge, riveted, with a barrel at the edge and snow along their tops;
  // a pull bar by the crack on each leaf.
  const iron = (gx: number, y: number, z: number) => g.set(gx, y, z, lin(IRON[Math.floor(hash3(gx, y, z, 31) * 2.4)]));
  for (const side of [0, 1] as const) {
    const X = (i: number) => (side === 0 ? i : DOORS_W - 1 - i);
    for (const hy of [14, LEAF_H - 12]) {
      for (let i = 0; i < 17; i++) {
        const half = i < 15 ? 1 : 0; // the strap narrows to a point
        for (let dy = -half; dy <= half; dy++) iron(X(i), hy + dy, 3);
      }
      for (let i = 0; i < 2; i++) for (let dy = -4; dy <= 4; dy++) { iron(X(i), hy + dy, 3); iron(X(i), hy + dy, 4); }
      for (const i of [4, 9, 14]) g.set(X(i), hy, 4, lin(RIVET));
      for (let i = 1; i < 15; i++) if (hash3(i, hy, side, 33) > 0.2) g.set(X(i), hy + 2, 3, lin(T.snow[hash3(i, hy, side, 34) < 0.7 ? 0 : 1]));
    }
    const px = X(LEAF_W - 7);
    for (let y = 21; y <= 31; y++) iron(px, y, 4);
    for (const y of [21, 31]) iron(px, y, 3);
  }
  buildWreath(g, DOORS_W - 1 - 23, 37);
  return g;
}

/** A small wreath on the right leaf, high in the cross's top triangle: the season, in passing. */
function buildWreath(g: Grid, cx: number, cy: number) {
  for (let dx = -7; dx <= 7; dx++)
    for (let dy = -7; dy <= 7; dy++) {
      const d = Math.hypot(dx, dy);
      if (d > 6.6 || d < 3.4) continue;
      const tone = WREATH[Math.floor(hash3(dx, dy, 0, 41) * 2.6)];
      g.set(cx + dx, cy + dy, 3, lin(tone));
      if (hash3(dx, dy, 1, 42) > 0.35) g.set(cx + dx, cy + dy, 4, lin(WREATH[Math.floor(hash3(dx, dy, 2, 43) * 2.2)]));
      if (hash3(dx, dy, 3, 44) > 0.93) g.set(cx + dx, cy + dy, 5, lin(BERRY));
      if (dy >= 4 && hash3(dx, dy, 4, 45) > 0.55) g.set(cx + dx, cy + dy + 1, 4, lin(T.snow[0]));
    }
  // The bow at the bottom, and its two tails.
  for (let dx = -3; dx <= 3; dx++) for (let dy = -1; dy <= 1; dy++) if (Math.abs(dx) + Math.abs(dy) < 4) g.set(cx + dx, cy - 6 + dy, 5, lin(BOW[Math.abs(dx) === 0 ? 2 : Math.abs(dx) > 2 ? 1 : 0]));
  for (let t = 1; t <= 4; t++) { g.set(cx - 1 - Math.floor(t / 2), cy - 7 - t, 5, lin(BOW[1])); g.set(cx + 1 + Math.floor(t / 2), cy - 7 - t, 5, lin(BOW[1])); }
}

/** The header beam over the doorway: timber with snow piled on it and icicles hanging below. */
export function buildLintel(): Grid {
  const g = new Grid(DOOR_VOXEL);
  const beamH = LINTEL_BEAM;
  for (let x = 0; x < DOORS_W; x++) {
    const plank = Math.floor(x / 24);
    for (let y = 0; y < beamH; y++)
      for (let z = 0; z < 4; z++) {
        const grain = hash3(x, Math.floor(y / 2), plank, 51);
        let c = shade(lin(T.beam[grain < 0.6 ? 1 : grain < 0.9 ? 0 : 2]), 0.85 + hash3(plank, 0, 0, 52) * 0.15);
        if (y === 0) c = shade(c, 0.8);
        g.set(x, y, z, c);
      }
    // Snow along the top, lumpy, and lipping over the front edge.
    const top = beamH + 1 + Math.min(LINTEL_SNOW - 1, Math.floor((Math.sin(x * 0.21) + 1) * 0.6 + hash3(x, 0, 0, 53) * 1.2));
    for (let y = beamH; y < top; y++) for (let z = 0; z < 5; z++) {
      if (z === 4 && y > beamH + 1) continue;
      g.set(x, y, z, lin(T.snow[hash3(x, y, z, 54) < 0.75 ? 0 : hash3(x, y, z, 55) < 0.7 ? 1 : 2]));
    }
    if (hash3(x, 0, 0, 56) > 0.6) g.set(x, beamH - 1, 4, lin(T.snow[1]));
    // Icicles: now and then, two voxels across at the root, tapering to a point.
    if (hash3(x, 0, 0, 57) > 0.8 && x % 2 === 0 && x > 1 && x < DOORS_W - 2) {
      const len = 2 + Math.floor(hash3(x, 1, 0, 58) * (LINTEL_ICICLE - 1));
      for (let k = 1; k <= len; k++) {
        const c = lin(T.ice[k < 2 ? 0 : k < len - 1 ? 1 : 2]);
        g.set(x, -k, 3, c);
        if (k <= len / 2) g.set(x + 1, -k, 3, c);
      }
    }
  }
  return g;
}

/** The drift banked against the foot of the doors. */
export function buildSill(): Grid {
  const g = new Grid(DOOR_VOXEL);
  for (let x = 0; x < DOORS_W; x++) {
    const h = Math.min(SILL_ROWS, 2 + Math.floor((Math.sin(x * 0.13 + 1.2) + 1) * 1.3 + (Math.sin(x * 0.37) + 1) * 0.6 + hash3(x, 0, 0, 61) * 1.2));
    for (let y = 0; y < h; y++) for (let z = 0; z < 6; z++) {
      if (y > h - 2 && z > 3) continue;
      const r = hash3(x, y, z, 62);
      g.set(x, y, z, lin(T.snow[r < 0.7 ? 0 : r < 0.92 ? 1 : 2]));
    }
  }
  return g;
}

/** The parts the render tool bakes, by name. */
export const DOOR_PARTS = { leaves: buildLeaves, lintel: buildLintel, sill: buildSill } as const;
export type DoorPart = keyof typeof DOOR_PARTS;
