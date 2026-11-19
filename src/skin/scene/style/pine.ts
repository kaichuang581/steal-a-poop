/**
 * The diorama pine (Brian's farm picture, docs/diorama/reference/farm-34.png): a short brown trunk under six round tiers
 * that narrow to the top, each tier's top laid with snow, a snow tip. Flat colours: the needles one green, the underside
 * of each tier a step darker, the snow one white. No random branches, gaps or speckle.
 */
import { lin, T } from '../../voxel/palette';
import { SNOW } from '../../voxel/snow';
import type { RGB } from '../../voxel/primitives';

/**
 * Plants a pine in a grid of `cell`-metre voxels: its trunk's middle at cell column (cx, cz) (a corner between four
 * cells), standing on row `y0`, `height` metres tall. `put` sets a voxel, `has` says whether one is there.
 */
export function tieredPine(put: (x: number, y: number, z: number, c: RGB) => void, has: (x: number, y: number, z: number) => boolean,
  cx: number, cz: number, y0: number, height: number, cell: number, tiers = 6): void {
  const trunk = lin(T.trunk[1]), needles = lin(T.pine[1]), under = lin(T.pine[2]);
  const H = Math.max(6, Math.round(height / cell));
  const bare = Math.max(2, Math.round(H * 0.14)); // the trunk shows under the lowest tier
  const R = Math.max(2, (height * 0.23) / cell);
  // The trunk: two cells square, or one on a coarse grid (the far forest's 0.4 m), where two would be a pillar.
  const from = cell >= 0.3 ? 0 : -1;
  for (let y = 0; y < bare + 2; y++) for (let dx = from; dx <= 0; dx++) for (let dz = from; dz <= 0; dz++) put(cx + dx, y0 + y, cz + dz, trunk);
  // A tall pine has `tiers` tiers of three rows or more; a short one has fewer, so it never stands taller than asked.
  const crown = H - bare - 1, th = crown >= tiers * 3 ? Math.floor(crown / tiers) : crown >= 6 ? 3 : 2;
  tiers = Math.max(1, Math.min(tiers, Math.floor(crown / th)));
  const needleCells: [number, number, number][] = [];
  const disc = (y: number, r: number, c: RGB) => {
    const n = Math.ceil(r);
    for (let x = -n; x < n; x++) for (let z = -n; z < n; z++) {
      if (Math.hypot(x + 0.5, z + 0.5) > r) continue;
      put(cx + x, y, cz + z, c);
      needleCells.push([cx + x, y, cz + z]);
    }
  };
  for (let k = 0; k < tiers; k++) {
    // A tier: a green side `th - 1` rows tall at its full width (its bottom row a step darker), then its core, narrower
    // than the next tier's skirt, so the next tier sits on it and this tier's top shows as a ring of snow.
    const r0 = Math.max(1.2, R * (1 - k / (tiers + 0.6)) + 0.5), next = Math.max(1, R * (1 - (k + 1) / (tiers + 0.6)) + 0.5);
    const yb = y0 + bare + k * th;
    for (let j = 0; j < th - 1; j++) disc(yb + j, r0 - j * 0.25, j === 0 ? under : needles);
    disc(yb + th - 1, Math.max(0.8, next * 0.55), needles);
  }
  const top = y0 + bare + tiers * th;
  for (let dy = 0; dy < 2; dy++) for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) put(cx + dx, top + dy, cz + dz, dy ? SNOW : needles);
  put(cx - 1, top + 2, cz - 1, SNOW);
  // Snow on every needle top nothing covers: a white rim on each tier.
  for (const [x, y, z] of needleCells) if (!has(x, y + 1, z)) put(x, y + 1, z, SNOW);
}
