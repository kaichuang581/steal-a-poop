import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { Grid, ellipsoid } from './primitives';
import { lin } from './palette';

/** Characters' voxel size (plan V3 Part 4): the bomb is built on the same grid as the sheep. */
const S = 0.04;
export const BOMB_FUSE_LENGTH = 10 * S;
/** Where the fuse starts, above the bomb's centre. */
export const BOMB_NECK_Y = 7 * S;

export interface BombModel {
  body: BufferGeometry;
  /** Grows upward from the origin; scale y by the fuse left. */
  fuse: BufferGeometry;
  spark: BufferGeometry;
}

let model: BombModel | null = null;

/** A round black bomb with a lit highlight, a grey neck, a rope fuse and a spark, all built from axis-aligned voxels. */
export function bombModel(): BombModel {
  if (model) return model;
  const dark = lin('#34343f'), mid = lin('#4c4c5c'), light = lin('#85859c');
  const g = new Grid(S);
  ellipsoid(g, [0, 0, 0], [0.2, 0.2, 0.2], (x, y, z) => {
    const lit = (-x * 0.5 + y * 0.6 + z * 0.6) / 5;
    return lit > 0.55 ? light : lit > 0.1 ? mid : dark;
  });
  for (let y = 5; y <= 6; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.set(x, y, z, lin('#80808e'));
  const f = new Grid(S);
  for (let i = 0; i < 10; i++) f.set(i > 6 ? 1 : 0, i, 0, lin(i % 2 ? '#c9a66b' : '#a98550'));
  const sp = new Grid(S);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) sp.set(x, y, z, lin('#ffd24a'));
  model = {
    body: buildGeometry(g.map, S).translate(-S / 2, -S / 2, -S / 2),
    fuse: buildGeometry(f.map, S).translate(-S / 2, 0, -S / 2),
    spark: buildGeometry(sp.map, S).translate(-S, -S, -S),
  };
  return model;
}
