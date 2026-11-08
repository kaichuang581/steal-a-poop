import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { Grid, hash3 } from './primitives';
import { lin } from './palette';

/** The winner's trophy (Brian, 2026-11-08): a big golden cup on the sheep's grid scale, about 0.7 m tall. */
export const TROPHY_CELL = 0.035;
export const TROPHY_HEIGHT = 20 * TROPHY_CELL;

let geo: BufferGeometry | null = null;

/**
 * A two-handled cup of gold on a stem and a knob, standing on a dark wooden plinth with a gold band. Lit from the upper
 * left in the voxels' own colours, with a few bright glints. Its foot is at the origin.
 */
export function trophyGeometry(): BufferGeometry {
  if (geo) return geo;
  const g = new Grid(TROPHY_CELL);
  const deep = lin('#8A5A12'), mid = lin('#C98F22'), gold = lin('#E8B23A'), light = lin('#F7D673'), glint = lin('#FFF4C2');
  const wood = lin('#4A2E16'), woodLight = lin('#64401F');
  const shade = (x: number, y: number, z: number, r: number) => {
    const lit = (-x * 0.6 + z * 0.8) / Math.max(1, r) + y * 0.01;
    if (hash3(x, y, z, 9) < 0.04 && lit > 0.3) return glint;
    return lit > 0.55 ? light : lit > 0.05 ? gold : lit > -0.45 ? mid : deep;
  };
  const disc = (y: number, r: number, paint: (x: number, z: number) => ReturnType<typeof lin>, hollow = 0) => {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) for (let z = -Math.ceil(r); z <= Math.ceil(r); z++) {
      const d = Math.hypot(x, z);
      if (d <= r + 0.3 && d >= hollow) g.set(x, y, z, paint(x, z));
    }
  };
  // The plinth: two rows of dark wood, a gold band between.
  for (let y = 0; y <= 2; y++) for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    if (y === 1) g.set(x, y, z, (Math.abs(x) === 5 || Math.abs(z) === 5) ? light : wood);
    else g.set(x, y, z, (x + z * 3) % 4 === 0 ? woodLight : wood);
  }
  // The foot, the stem and a knob half way up.
  disc(3, 3.5, (x, z) => shade(x, 3, z, 3.5));
  for (let y = 4; y <= 7; y++) disc(y, y === 6 ? 2 : 1, (x, z) => shade(x, y, z, 2));
  // The cup: a round bowl, swelling fast off the stem then rising straight, hollow above its floor, a rolled rim.
  for (let y = 8; y <= 18; y++) {
    const r = 2 + Math.sqrt((y - 8) / 10) * 5.4;
    disc(y, r, (x, z) => (y > 9 && Math.hypot(x, z) < r - 1 ? deep : shade(x, y, z, r)), y > 9 ? r - 1.2 : 0);
  }
  disc(19, 7.6, (x, z) => shade(x, 19, z, 7.6) === deep ? mid : light, 6.6);
  // Two handles: a loop out each side.
  for (const s of [-1, 1]) {
    for (let y = 11; y <= 16; y++) g.set(s * 9, y, 0, shade(s * 9, y, 0, 9));
    for (const y of [10, 17]) for (let x = 7; x <= 9; x++) g.set(s * x, y, 0, shade(s * x, y, 0, 9));
  }
  geo = buildGeometry(g.map, TROPHY_CELL).translate(-TROPHY_CELL / 2, 0, -TROPHY_CELL / 2);
  return geo;
}
