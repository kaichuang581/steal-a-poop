import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin, T } from '../voxel/palette';
import { Grid } from '../voxel/primitives';

/** A small star for a bonk, 0.04 m voxels in the lantern tone, built about its orbit's centre (the table uses it too). */
export function bonkStar(): BufferGeometry {
  const g = new Grid(0.04);
  for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x, y, 0, lin(T.lantern[0]));
  return buildGeometry(g.map, 0.04);
}
