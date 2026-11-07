import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, T } from './palette';
import { Grid, hash3 } from './primitives';

/** The name stake's sizes, in 0.05 m cells (V6 Part 5.3). */
export const STAKE = { cell: 0.05, post: 13, plankW: 8, plankH: 3 };

/**
 * A wooden name stake planted at a seat (V6 Part 5.3): a post 2 x 13 x 2 cells, a plank 8 x 3 x 1 across its face toward
 * -z with a darker rim, two brass nails at its top corners and a cap of snow with gaps. `height` lifts the plank on a
 * taller post (the duel stands its stakes behind the sheep); `ice` freezes the post's foot into the lake (an ice collar).
 * The plank's centre is at `plankY(height)` metres; slips are hung there.
 */
export function stakeVoxels({ height = STAKE.post, ice = false }: { height?: number; ice?: boolean } = {}): Grid {
  const g = new Grid(STAKE.cell);
  const wood = (x: number, y: number, z: number) => pick(T.beam, hash3(x, y >> 1, z, 91), [0.3, 0.75]);
  for (let y = 0; y < height; y++) for (let x = -1; x <= 0; x++) for (let z = -1; z <= 0; z++) g.set(x, y, z, wood(x, y, z));
  const top = height - 2, bottom = top - STAKE.plankH + 1;
  const x0 = -STAKE.plankW / 2, x1 = STAKE.plankW / 2 - 1;
  for (let x = x0; x <= x1; x++)
    for (let y = bottom; y <= top; y++) {
      const rim = x === x0 || x === x1 || y === bottom || y === top;
      g.set(x, y, -2, rim ? lin(T.beam[2]) : pick(T.beam, hash3(x >> 2, y, 0, 93), [0.15, 0.4]));
    }
  // Brass nails one cell proud at the plank's top corners, one cell in from its ends.
  for (const x of [x0 + 1, x1 - 1]) g.set(x, top, -3, lin(T.brass[1]));
  // Snow on the plank's top edge and the post's top, with gaps.
  for (let x = x0; x <= x1; x++) if (hash3(x, top, 0, 95) > 0.3) g.set(x, top + 1, -2, pick(T.snow, hash3(x, 0, 0, 97)));
  for (let x = -1; x <= 0; x++) for (let z = -1; z <= 0; z++) if (hash3(x, height, z, 99) > 0.2) g.set(x, height, z, pick(T.snow, hash3(x, 1, z, 97)));
  if (ice) {
    for (let x = -2; x <= 1; x++)
      for (let z = -2; z <= 1; z++)
        for (let y = 0; y <= 1; y++) {
          if (g.has(x, y, z) || (y === 1 && (x === -2 || x === 1) && (z === -2 || z === 1))) continue;
          g.set(x, y, z, pick(T.ice, hash3(x, y, z, 101)));
        }
  }
  return g;
}

/** Where a stake's plank centre sits, in metres above its foot. */
export const plankY = (height = STAKE.post) => (height - 2 - (STAKE.plankH - 1) / 2) * STAKE.cell + STAKE.cell / 2;

const stakes = new Map<string, BufferGeometry>();
/** The stake as one face-culled mesh, built once per kind and shared by every seat. */
export function stakeGeometry(opts: { height?: number; ice?: boolean } = {}): BufferGeometry {
  const key = `${opts.height ?? STAKE.post}:${!!opts.ice}`;
  let geo = stakes.get(key);
  if (!geo) {
    const g = stakeVoxels(opts);
    geo = buildGeometry(g.map, g.size);
    stakes.set(key, geo);
  }
  return geo;
}
