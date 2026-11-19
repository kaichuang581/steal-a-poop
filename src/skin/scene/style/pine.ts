/**
 * The diorama pine (Brian's farm picture, docs/diorama/reference/farm-34.png): a short brown trunk under six round tiers
 * that narrow to the top, each tier's top laid with snow, a snow tip. Flat colours: the needles one green, the underside
 * of each tier a step darker, the snow one white. No random branches, gaps or speckle, and no snow on a tier's side.
 */
import { lin, T } from '../../voxel/palette';
import { SNOW } from '../../voxel/snow';
import type { RGB } from '../../voxel/primitives';

/** How a pine of `height` metres is laid out on a grid of `cell` metres: its rows, its bare trunk, its tiers. */
export function pineShape(height: number, cell: number, tiers = 6) {
  const H = Math.max(6, Math.round(height / cell));
  const bare = Math.max(2, Math.round(H * 0.14)); // the trunk shows under the lowest tier
  const R = Math.max(2, (height * 0.23) / cell);
  // A tall pine has `tiers` tiers of three rows or more; a short one has fewer, so it never stands taller than asked.
  const crown = H - bare - 1, th = crown >= tiers * 3 ? Math.floor(crown / tiers) : crown >= 6 ? 3 : 2;
  const n = Math.max(1, Math.min(tiers, Math.floor(crown / th)));
  /** Tier `k`'s radius at its foot, in cells (tier `n` is the tip). */
  const radius = (k: number) => Math.max(k >= n ? 1 : 1.2, R * (1 - k / (n + 0.6)) + 0.5);
  return { H, bare, th, n, radius };
}

/**
 * Plants a pine in a grid of `cell`-metre voxels: its trunk's middle at cell column (cx, cz) (a corner between four
 * cells), standing on row `y0`, `height` metres tall. `put` sets a voxel, `has` says whether one is there.
 */
export function tieredPine(put: (x: number, y: number, z: number, c: RGB) => void, has: (x: number, y: number, z: number) => boolean,
  cx: number, cz: number, y0: number, height: number, cell: number, tiers = 6): void {
  const trunk = lin(T.trunk[1]), needles = lin(T.pine[1]), under = lin(T.pine[2]);
  const { bare, th, n, radius } = pineShape(height, cell, tiers);
  // The trunk: two cells square, or one on a coarse grid (the far forest's 0.4 m), where two would be a pillar.
  const from = cell >= 0.3 ? 0 : -1;
  for (let y = 0; y < bare + 2; y++) for (let dx = from; dx <= 0; dx++) for (let dz = from; dz <= 0; dz++) put(cx + dx, y0 + y, cz + dz, trunk);
  const needleCells: [number, number, number][] = [];
  const disc = (y: number, r: number, c: RGB, shelf = false) => {
    const m = Math.ceil(r);
    for (let x = -m; x < m; x++) for (let z = -m; z < m; z++) {
      if (Math.hypot(x + 0.5, z + 0.5) > r) continue;
      put(cx + x, y, cz + z, c);
      if (shelf) needleCells.push([cx + x, y, cz + z]);
    }
  };
  for (let k = 0; k < n; k++) {
    // A tier: a green side `th - 1` rows tall at its full width (its bottom row a step darker), then its core, narrower
    // than the next tier's skirt, so the next tier sits on it and this tier's top shows as a ring of snow.
    const yb = y0 + bare + k * th;
    // The dark underside row and the row on it are one width (a row stepped in over the underside left the underside's
    // rim bare to the sky); the rows above those step in.
    for (let j = 0; j < th - 1; j++) disc(yb + j, radius(k) - Math.max(0, j - 1) * 0.25, j === 0 ? under : needles, j === th - 2);
    disc(yb + th - 1, Math.max(0.8, radius(k + 1) * 0.55), needles);
  }
  const top = y0 + bare + n * th;
  for (let dy = 0; dy < 2; dy++) for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) put(cx + dx, top + dy, cz + dz, dy ? SNOW : needles);
  put(cx - 1, top + 2, cz - 1, SNOW);
  // Snow lies on the shelf each tier leaves open to the sky, a white ring, and nowhere on a tier's side (it showed as
  // stray white blocks where one row stepped in from the next).
  for (const [x, y, z] of needleCells) if (!has(x, y + 1, z)) put(x, y + 1, z, SNOW);
}
