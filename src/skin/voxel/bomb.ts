import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { Grid, ellipsoid, hash3 } from './primitives';
import { lin } from './palette';

/** Characters' voxel size (plan V3 Part 4): the bomb is built on the same grid as the sheep. */
const S = 0.04;
export const BOMB_FUSE_LENGTH = 10 * S;
/** Where the fuse starts, above the bomb's centre. */
export const BOMB_NECK_Y = 7 * S;
/** The bomb's radius at scale 1, so it can be set down on the floor. */
export const BOMB_RADIUS = 5.5 * S;
/** Seconds from a turn starting to the bomb landing beside its new holder (the toss, or the drop of a fresh bomb). */
export const BOMB_TOSS_S = 0.55;

export interface BombModel {
  body: BufferGeometry;
  /** Grows upward from the origin; scale y by the fuse left. */
  fuse: BufferGeometry;
  spark: BufferGeometry;
  /** A flat ring of frost, centred on the origin at floor level, that spreads under the bomb where it lands. */
  frost: BufferGeometry;
  /** One chunk of the ice shell, for the burst. */
  chunk: BufferGeometry;
}

let model: BombModel | null = null;

/**
 * A bomb frozen solid, all built from axis-aligned voxels: an ice-blue shell lit from the upper left with cracks through
 * it, a cap of frost, a collar of frost round a neck of clear ice, a frosted fuse and a cold
 * blue spark. It sits on the floor.
 */
export function bombModel(): BombModel {
  if (model) return model;
  const deep = lin('#1d4a7c'), mid = lin('#3a7ab2'), pale = lin('#78b6e0'), shine = lin('#d6f1ff'), frost = lin('#f1faff'), vein = lin('#2a5f94');
  const g = new Grid(S);
  ellipsoid(g, [0, 0, 0], [0.2, 0.2, 0.2], (x, y, z) => {
    const lit = (-x * 0.5 + y * 0.6 + z * 0.6) / 5;
    // Frost settles on the crown, thinning down the sides.
    if (y >= 3 && hash3(x, y, z, 7) < 0.35 + (y - 3) * 0.3) return frost;
    // A few cracks run through the ice.
    if (hash3(x, y, z, 11) < 0.07 && lit < 0.55) return vein;
    return lit > 0.7 ? shine : lit > 0.35 ? pale : lit > -0.05 ? mid : deep;
  });
  // The neck: a block of clear ice, with a collar of frost round its foot.
  const ice = lin('#cdeefc'), iceDark = lin('#94cfee');
  for (let y = 5; y <= 6; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.set(x, y, z, (x + z + y) % 2 ? ice : iceDark);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 2 || Math.abs(z) === 2) if (!(Math.abs(x) === 2 && Math.abs(z) === 2)) g.set(x, 5, z, frost);
  const f = new Grid(S);
  for (let i = 0; i < 10; i++) f.set(i > 6 ? 1 : 0, i, 0, lin(i % 2 ? '#e4f4ff' : '#9cc6e4'));
  const sp = new Grid(S);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) sp.set(x, y, z, lin(x + y + z === 1 ? '#e8fbff' : '#7fdcff'));
  // The frost ring: a ragged disc, densest in the middle, one voxel thin.
  const fr = new Grid(S);
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    const d = Math.hypot(x, z) / 12;
    if (d <= 1 && hash3(x, 0, z, 3) > d * d * 0.85) fr.set(x, 0, z, hash3(x, 1, z, 5) < 0.5 ? frost : lin('#cfeaf8'));
  }
  const ch = new Grid(S);
  ch.set(0, 0, 0, pale); ch.set(1, 0, 0, shine); ch.set(0, 1, 0, frost); ch.set(0, 0, 1, mid);
  model = {
    body: buildGeometry(g.map, S).translate(-S / 2, -S / 2, -S / 2),
    fuse: buildGeometry(f.map, S).translate(-S / 2, 0, -S / 2),
    spark: buildGeometry(sp.map, S).translate(-S, -S, -S),
    frost: buildGeometry(fr.map, S, { ao: false }).translate(-S / 2, 0, -S / 2),
    chunk: buildGeometry(ch.map, S, { ao: false }).translate(-S, -S, -S),
  };
  return model;
}
