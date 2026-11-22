import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { shadeRaw } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

/**
 * The champion's trophy on the leaderboards (Brian, 2026-11-22: "make the trophy look cooler ... the trophy floating and
 * glowing above his head"): a tall gold cup with a flared lip, two looped handles and a ruby set in its front, on a knotted
 * stem and a plum foot banded in gold, a gold star standing on its rim. On S cells (0.05 m), its foot at the origin. The
 * stage draws it lit from within and floating, with a halo, slow rays and sparkles round it. The victory screen keeps its
 * own cup.
 */
export const CUP_CELL = 0.05;

const C = (h: string): RGB => shadeRaw(h);
const GOLD_HI = C('#FFE9A0'), GOLD = C('#F5BE3C'), GOLD_MID = C('#D89A22'), GOLD_LO = C('#A8650F');
const PLUM = C('#3B2B63'), RUBY = C('#E3245C'), RUBY_HI = C('#FF7AA2');

export interface CupVoxels { body: Grid; gem: Grid; height: number }

export function cupVoxels(): CupVoxels {
  const g = new Grid(CUP_CELL), gem = new Grid(CUP_CELL);
  /** A disc of radius `r` (cells) at row `y`, lit on its upper-left front and shaded on its right back. */
  const disc = (y: number, r: number, hollow = 0, tone?: RGB) => {
    const m = Math.ceil(r);
    for (let x = -m; x < m; x++) for (let z = -m; z < m; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > r || d < hollow) continue;
      const lit = (-(x + 0.5) * 0.6 + (z + 0.5) * 0.8) / r;
      g.set(x, y, z, tone ?? (lit > 0.45 ? GOLD_HI : lit > -0.35 ? GOLD : GOLD_MID));
    }
  };
  // The foot: plum, two rows, a gold band, then a stepped gold plate.
  for (let y = 0; y < 2; y++) for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) g.set(x, y, z, PLUM);
  for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) g.set(x, 2, z, GOLD_MID);
  disc(3, 3.2);
  // The stem and its knot.
  disc(4, 1.2, 0, GOLD_MID); disc(5, 2.1); disc(6, 1.2, 0, GOLD_MID);
  // The bowl, flaring to a lip, hollow at the top so its inside shows a darker gold.
  const bowl = [1.6, 2.6, 3.4, 3.9, 4.2, 4.4, 4.5, 4.7, 5.1];
  bowl.forEach((r, i) => disc(7 + i, r, i >= bowl.length - 2 ? r - 1.3 : 0));
  disc(7 + bowl.length - 2, 3.6, 0, GOLD_LO);
  // Handles: a loop on each side, from the bowl's shoulder out and down to its waist.
  for (const s of [-1, 1]) {
    const loop: [number, number][] = [[4, 13], [5, 13], [6, 13], [6, 12], [6, 11], [6, 10], [5, 10], [4, 10], [3, 10]];
    for (const [x, y] of loop) for (const z of [-1, 0]) g.set(s > 0 ? x : -x - 1, y, z, GOLD_MID);
  }
  // The ruby on the front.
  for (let x = -1; x < 1; x++) for (let y = 10; y < 12; y++) gem.set(x, y, 4, y === 11 && x === -1 ? RUBY_HI : RUBY);
  // A star on the rim: a short post, then a five-pointed star two cells thick.
  const top = 7 + bowl.length;
  disc(top - 1, 0.9, 0, GOLD_MID);
  const R = 3.6, r = 1.6, sy = top + 4;
  for (let x = -5; x <= 5; x++) for (let y = -5; y <= 5; y++) {
    const px = x + 0.5, py = y + 0.5, a = Math.atan2(px, py), k = (5 * a) / (2 * Math.PI), t = Math.abs(k - Math.round(k)) * 2;
    if (Math.hypot(px, py) > R + (r - R) * t) continue;
    for (const z of [-1, 0]) g.set(x, sy + y, z, Math.hypot(px, py) < 1.6 ? GOLD_HI : GOLD);
  }
  for (let y = top; y < sy - 2; y++) g.set(-1, y, -1, GOLD_MID), g.set(0, y, -1, GOLD_MID), g.set(-1, y, 0, GOLD_MID), g.set(0, y, 0, GOLD_MID);
  let maxY = 0;
  for (const c of g.map.values()) maxY = Math.max(maxY, c.y);
  return { body: g, gem, height: (maxY + 1) * CUP_CELL };
}

let built: { body: BufferGeometry; gem: BufferGeometry; height: number } | null = null;
/** The cup's meshes, built once. */
export function cupGeometry() {
  if (!built) {
    const v = cupVoxels();
    built = { body: buildGeometry(v.body.map, CUP_CELL), gem: buildGeometry(v.gem.map, CUP_CELL), height: v.height };
  }
  return built;
}
/** How big the stage draws the cup, and how high it bobs over its resting place (metres). */
export const PRIZE_SCALE = 0.72, PRIZE_BOB = 0.08;
/** The cup's height as drawn (metres), for framing the champion. */
export const prizeHeight = () => cupVoxels().height * PRIZE_SCALE;
