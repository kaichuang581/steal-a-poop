import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { shade } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { CELL, CRATE, FINE } from './island';

/**
 * The leaderboards' podiums (Brian, 2026-11-22: "make the podiums look more exciting, rn they're pretty boring"; they
 * replace the timber crates here, and the victory screen keeps its own). Each is the crate's footprint and height, so
 * every pose, plate and drift still fits it: a plum plinth with a trim of its metal, a column of gold, silver or bronze
 * set in a cell, with lighter pillars at its corners and a plum frieze studded with its metal, and a cap the full size of
 * the top carrying a red carpet. On the column's front, a cream star with the place's number in plum; down the column's
 * front corners and along the plinth, marquee bulbs (the stage lights them in turn). Pure: voxels and points.
 */

/** Each place's metal: [lit, middle, shaded]. */
export const METALS: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['#FFE08A', '#F2B83A', '#C98A1E'],
  2: ['#F1F5FA', '#C8D2DF', '#9AA8BA'],
  3: ['#F0B07A', '#CD7E46', '#9C5A2C'],
};
/** The numbers, drawn for the badge (a bold 5 x 7, so each reads crisply at this size). */
const DIGITS: Record<1 | 2 | 3, string[]> = {
  1: ['..##.', '.###.', '..##.', '..##.', '..##.', '..##.', '.####'],
  2: ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
  3: ['####.', '...##', '..##.', '...##', '...##', '##.##', '.###.'],
};
const PLUM = '#3B2B63', PLUM_HI = '#5A4290', CARPET = '#B3263A', CARPET_EDGE = '#E2C26A', CREAM = '#FFF4D6';

export interface PodiumVoxels {
  /** The podium on M cells, its foot at y = 0, centred on x and z. */
  body: Grid;
  /** The star and number on its front, on S cells. */
  badge: Grid;
  /** Each marquee bulb's middle (metres), in the order they are lit along. */
  bulbs: [number, number, number][];
  /** Where the number's box is on the front, from the top (metres): its top, its bottom, its half width. */
  numeral: { top: number; bottom: number; half: number };
}

/** A podium `height` metres tall for `place`. */
export function podiumVoxels(place: 1 | 2 | 3, height: number): PodiumVoxels {
  const g = new Grid(CELL);
  const [hi, mid, lo] = METALS[place].map((h) => shade(h)) as [RGB, RGB, RGB];
  const plum = shade(PLUM), plumHi = shade(PLUM_HI), carpet = shade(CARPET), edge = shade(CARPET_EDGE);
  const W = Math.round(CRATE.w / CELL), D = Math.round(CRATE.d / CELL), H = Math.round(height / CELL);
  const x0 = -W / 2, z0 = -D / 2;
  const put = (x: number, y: number, z: number, c: RGB) => g.set(x0 + x, y, z0 + z, c);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const rim = x === 0 || z === 0 || x === W - 1 || z === D - 1;
    // The plinth: two rows of plum and a row of the metal's shade.
    put(x, 0, z, plum); put(x, 1, z, plum); put(x, 2, z, lo);
    // The cap: a shaded row, a lit row, the carpet with a gold edge.
    put(x, H - 3, z, lo); put(x, H - 2, z, hi); put(x, H - 1, z, rim ? edge : carpet);
    // The column, a cell in: the metal, its corners lit, a plum frieze two rows under the cap with studs of the metal.
    if (rim) continue;
    const corner = (x === 1 || x === W - 2) && (z === 1 || z === D - 2);
    for (let y = 3; y < H - 3; y++) {
      const frieze = y === H - 5 || y === H - 6;
      const stud = frieze && y === H - 5 && (x + z) % 2 === 0;
      put(x, y, z, corner ? hi : frieze ? (stud ? hi : plum) : mid);
    }
  }
  // The badge: a five-pointed star in cream on the column's front, the number in plum on it, each a cell proud.
  const badge = new Grid(FINE);
  const front = Math.round((D / 2 - 1) * (CELL / FINE)); // the column's front face, in S cells
  const R = 0.36, r = 0.16, cy = height - 0.95;           // the star's radii and middle (metres)
  const inStar = (px: number, py: number) => {
    const a = Math.atan2(px, py), d = Math.hypot(px, py), k = (5 * a) / (2 * Math.PI);
    const t = Math.abs(k - Math.round(k)) * 2;             // 0 at a point, 1 between two
    return d <= R + (r - R) * t;
  };
  const cream = shade(CREAM), ink = plum;
  const n = Math.round(R / FINE) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (inStar((i + 0.5) * FINE, (j + 0.5) * FINE)) badge.set(i, Math.round(cy / FINE) + j, front, cream);
  const top = Math.round(cy / FINE) + 3;
  DIGITS[place].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') badge.set(x - 3, top - y, front + 1, ink); }));
  // Bulbs: down both front corners of the column every 0.2 m, and along the plinth's front edge.
  const bulbs: [number, number, number][] = [];
  const fz = D / 2 * CELL - CELL + 0.04, sx = (W / 2 - 1) * CELL - 0.05;
  for (let y = 0.45; y < height - 0.45; y += 0.2) bulbs.push([-sx, y, fz]);
  for (let x = -sx + 0.2; x < sx - 0.1; x += 0.2) bulbs.push([x, 0.15, D / 2 * CELL + 0.04]);
  for (let y = height - 0.45; y >= 0.45; y -= 0.2) bulbs.push([sx, y, fz]);
  void plumHi;
  return { body: g, badge, bulbs, numeral: { top: -(height - cy - R), bottom: -(height - cy + R), half: R } };
}

export interface PodiumGeo { body: BufferGeometry; badge: BufferGeometry; bulbs: [number, number, number][] }
const cache = new Map<string, PodiumGeo>();
/** The podium as meshes (cached by place and height). */
export function podiumGeometry(place: 1 | 2 | 3, height: number): PodiumGeo {
  const key = `${place}|${height}`;
  let hit = cache.get(key);
  if (!hit) {
    const v = podiumVoxels(place, height);
    cache.set(key, (hit = { body: buildGeometry(v.body.map, CELL), badge: buildGeometry(v.badge.map, FINE), bulbs: v.bulbs }));
  }
  return hit;
}
