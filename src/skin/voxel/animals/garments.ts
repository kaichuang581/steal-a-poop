import type { VoxelMap } from '../mesher';
import { lin } from '../palette';
import { Grid } from '../primitives';
import type { V3 } from '../primitives';
import { frostOf, part, S } from './rig';
import type { AnimalModel, Part } from './rig';

/**
 * Warmth layers (V5 Part 4.9): the farmer's knitwear stands in for the sheep's wool as lives on every other species.
 * Level 2 (the start) is a sweater or a blanket; 1 is a scarf alone; 3 adds the scarf; 4 adds leg warmers; 0 is bare.
 * Every garment is one voxel proud of what it covers, in two knit tones, ribbed by row.
 */
export interface Knit { a: string; b: string }
export const KNIT: Record<string, Knit> = {
  pig: { a: '#3F7F84', b: '#F3EAD6' },
  goat: { a: '#C9A24A', b: '#7F7973' },
  chicken: { a: '#C24E45', b: '#F3EAD6' },
  cow: { a: '#8E7CC3', b: '#F3EAD6' },
  horse: { a: '#3E6B4E', b: '#F3EAD6' },
};

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Grows a shell one voxel proud of `body` over its cells inside the z range and above `bellyY`, on the +x, -x and +y faces. */
function shell(g: Grid, body: VoxelMap, zFrom: number, zTo: number, bellyY: number, knit: Knit, hem: boolean, sides = true) {
  const z0 = Math.round(zFrom / S), z1 = Math.round(zTo / S), yb = Math.round(bellyY / S);
  let lowest = Infinity;
  for (const v of body.values()) if (v.z >= z0 && v.z <= z1 && v.y >= yb) lowest = Math.min(lowest, v.y);
  for (const v of body.values()) {
    if (v.z < z0 || v.z > z1 || v.y < yb) continue;
    const dirs: [number, number, number][] = sides ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0]] : [[0, 1, 0]];
    for (const [dx, dy, dz] of dirs) {
      if (body.has(key(v.x + dx, v.y + dy, v.z + dz))) continue;
      // Plain knit with a ribbed hem: stripes everywhere would cost faces the mesher cannot merge.
      const rib = hem && v.y === lowest ? (v.x + v.z) % 2 === 0 : false;
      g.set(v.x + dx, v.y + dy, v.z + dz, lin(rib ? knit.b : knit.a));
    }
  }
}

/** A sweater: the band over the torso from behind the shoulders to before the hips, down to the belly line, with a ribbed hem. */
export function sweater(body: VoxelMap, zFrom: number, zTo: number, bellyY: number, knit: Knit): Grid {
  const g = new Grid(S);
  shell(g, body, zFrom, zTo, bellyY, knit, true);
  return g;
}
/** A blanket: a quilt over the back from the withers to the hips, hanging to the belly line, with a fringe of the second tone. */
export function blanket(body: VoxelMap, zFrom: number, zTo: number, bellyY: number, knit: Knit, shape: 'square' | 'saddle'): Grid {
  const g = new Grid(S);
  const z0 = Math.round(zFrom / S), z1 = Math.round(zTo / S), yb = Math.round(bellyY / S);
  const zc = (z0 + z1) / 2, zh = (z1 - z0) / 2;
  for (const v of body.values()) {
    if (v.z < z0 || v.z > z1 || v.y < yb) continue;
    // A saddle pad is rounded at its corners.
    if (shape === 'saddle' && Math.abs(v.z - zc) > zh - 2 && v.y < yb + 4) continue;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0]] as const) {
      if (body.has(key(v.x + dx, v.y + dy, v.z + dz))) continue;
      const fringe = v.y === yb || v.z === z0 || v.z === z1;
      g.set(v.x + dx, v.y + dy, v.z + dz, lin(fringe ? knit.b : knit.a));
    }
  }
  return g;
}
/** A scarf: a ring two voxels thick at the neck and two tails six long hanging at the chest, ribbed. */
export function scarf(centre: V3, rx: number, ry: number, knit: Knit, tails: V3): Grid {
  const g = new Grid(S);
  for (let k = 0; k < 200; k++) {
    const a = (k / 200) * Math.PI * 2;
    for (const dz of [0, 1]) g.set(Math.round((centre[0] + Math.cos(a) * rx) / S), Math.round((centre[1] + Math.sin(a) * ry) / S), Math.round(centre[2] / S) + dz, lin(k % 10 < 5 ? knit.a : knit.b));
  }
  const tx = Math.round(tails[0] / S), ty = Math.round(tails[1] / S), tz = Math.round(tails[2] / S);
  for (const dx of [-2, 1]) for (let k = 0; k < 6; k++) for (const w of [0, 1]) g.set(tx + dx + w, ty - k, tz, lin(k % 2 ? knit.b : knit.a));
  return g;
}
/** Leg warmers: the four voxels above each hoof wrapped one voxel proud, ribbed. */
export function legWarmers(legs: { cx: number; cz: number; w: number }[], knit: Knit, rows: [number, number] = [2, 5]): Grid {
  const g = new Grid(S);
  for (const l of legs) {
    const half = Math.floor(l.w / 2);
    const x0 = Math.round(l.cx / S) - half - 1, z0 = Math.round(l.cz / S) - half - 1, n = l.w + 2;
    for (let y = rows[0]; y <= rows[1]; y++) for (let x = x0; x < x0 + n; x++) for (let z = z0; z < z0 + n; z++) {
      if (x !== x0 && x !== x0 + n - 1 && z !== z0 && z !== z0 + n - 1) continue;
      g.set(x, y, z, lin(y % 2 ? knit.a : knit.b));
    }
  }
  return g;
}

export interface GarmentSpec {
  body: VoxelMap;
  torso: { zFrom: number; zTo: number; bellyY: number };
  kind: 'sweater' | 'blanket-square' | 'blanket-saddle' | 'vest';
  neck: { centre: V3; rx: number; ry: number; tails: V3 };
  legs: { cx: number; cz: number; w: number }[];
  knit: Knit;
}

/** The coats per level and their frosts, from the species' garment spec (Part 4.9's table). */
export function coatsFor(spec: GarmentSpec): { wools: AnimalModel['wools']; frosts: AnimalModel['frosts']; coatCells: AnimalModel['coatCells'] } {
  const torsoOf = () => {
    const t = spec.torso;
    if (spec.kind === 'sweater' || spec.kind === 'vest') return sweater(spec.body, t.zFrom, t.zTo, t.bellyY, spec.knit);
    return blanket(spec.body, t.zFrom, t.zTo, t.bellyY, spec.knit, spec.kind === 'blanket-saddle' ? 'saddle' : 'square');
  };
  const merge = (grids: Grid[]) => { const g = new Grid(S); for (const h of grids) for (const v of h.map.values()) g.set(v.x, v.y, v.z, v.c); return g; };
  const sc = () => scarf(spec.neck.centre, spec.neck.rx, spec.neck.ry, spec.knit, spec.neck.tails);
  const sets: Record<1 | 2 | 3 | 4, Grid> = {
    1: sc(),
    2: torsoOf(),
    3: merge([torsoOf(), sc()]),
    4: merge([torsoOf(), sc(), legWarmers(spec.legs, spec.knit)]),
  };
  // Each coat is meshed together with the body it covers, so the garment's inner faces are culled and the body is
  // drawn once; the garment's own cells are kept apart for the tests.
  const wools = {} as AnimalModel['wools'], frosts = {} as AnimalModel['frosts'];
  const coatCells = { 0: new Map() } as AnimalModel['coatCells'];
  for (const level of [1, 2, 3, 4] as const) {
    const garment = sets[level].map;
    const merged = new Grid(S);
    for (const v of spec.body.values()) merged.set(v.x, v.y, v.z, v.c);
    for (const v of garment.values()) merged.set(v.x, v.y, v.z, v.c);
    const p = part(merged, [0, 0, 0]);
    wools[level] = p;
    coatCells[level] = garment;
    frosts[level] = frostOf(merged.map, [0, 0, 0]);
  }
  return { wools, frosts, coatCells };
}

export type { Part };
