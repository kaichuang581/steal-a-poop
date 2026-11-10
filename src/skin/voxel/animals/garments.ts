import type { VoxelMap } from '../mesher';
import { lin } from '../palette';
import { Grid } from '../primitives';
import type { V3 } from '../primitives';
import { addCavity, cavityOf, frostOf, hollow, part, S } from './rig';
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

const N6: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/**
 * Grows a shell one voxel proud of `body` over every exposed face of its cells inside the z range (V5.1 Part 4.5: the
 * sides, the top, the ends where the body curves, and the undersides above the cut), never below `bellyY`, so the
 * belly line is a straight horizontal cut and the body shows under it. The lowest row is the ribbed hem.
 */
function shell(g: Grid, body: VoxelMap, zFrom: number, zTo: number, bellyY: number, knit: Knit, hem: boolean) {
  const z0 = Math.round(zFrom / S), z1 = Math.round(zTo / S), yb = Math.round(bellyY / S);
  for (const v of body.values()) {
    if (v.z < z0 || v.z > z1 || v.y < yb) continue;
    for (const [dx, dy, dz] of N6) {
      const x = v.x + dx, y = v.y + dy, z = v.z + dz;
      if (y < yb || body.has(key(x, y, z))) continue;
      // Plain knit with a ribbed hem: stripes everywhere would cost faces the mesher cannot merge.
      const rib = hem && y === yb ? (x + z) % 2 === 0 : false;
      g.set(x, y, z, lin(rib ? knit.b : knit.a));
    }
  }
}

/** The sweater's and the vest's own band (4.5): a ring one voxel thick round the neck's base, ribbed in the two tones. */
export function neckBand(centre: V3, rx: number, ry: number, knit: Knit, solid?: Set<string>): Grid {
  const g = new Grid(S);
  if (solid) {
    const z = Math.round(centre[2] / S);
    for (const [x, y] of outline(solid, z)) g.set(x, y, z, lin((x + y) % 4 < 2 ? knit.a : knit.b));
    return g;
  }
  for (let k = 0; k < 200; k++) {
    const a = (k / 200) * Math.PI * 2;
    g.set(Math.round((centre[0] + Math.cos(a) * rx) / S), Math.round((centre[1] + Math.sin(a) * ry) / S), Math.round(centre[2] / S), lin(Math.floor(k / 8) % 2 ? knit.b : knit.a));
  }
  return g;
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
    for (const [dx, dy, dz] of N6) {
      const x = v.x + dx, y = v.y + dy, z = v.z + dz;
      if (y < yb || body.has(key(x, y, z))) continue;
      // The fringe: one row of the second tone along the hem and the two ends.
      const fringe = y === yb || v.z === z0 || v.z === z1;
      g.set(x, y, z, lin(fringe ? knit.b : knit.a));
    }
  }
  return g;
}
/**
 * The outline of a solid's section at slice `z`: the cells outside it that face-touch it. A ring traced this way hugs
 * a sloped neck, so it never floats a voxel off it (V5.1: the scarf and the band, as the collar).
 */
function outline(solid: Set<string>, z: number): [number, number][] {
  const inS = (x: number, y: number) => solid.has(`${x},${y},${z}`);
  const xs: number[] = [], ys: number[] = [];
  for (const k of solid) { const [x, y, zz] = k.split(',').map(Number); if (zz === z) { xs.push(x); ys.push(y); } }
  const out: [number, number][] = [];
  for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + 1; x++) for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y++) {
    if (!inS(x, y) && (inS(x + 1, y) || inS(x - 1, y) || inS(x, y + 1) || inS(x, y - 1))) out.push([x, y]);
  }
  return out;
}
/** A scarf: a ring two voxels thick at the neck and two tails six long hanging at the chest, ribbed. */
export function scarf(centre: V3, rx: number, ry: number, knit: Knit, tails: V3, solid?: Set<string>): Grid {
  const g = new Grid(S);
  const cz = Math.round(centre[2] / S);
  if (solid) {
    // Hugging the neck: its outline on two slices; the tails hang from the ring's lowest row at the front.
    for (const dz of [0, 1]) for (const [x, y] of outline(solid, cz + dz)) g.set(x, y, cz + dz, lin((x + y) % 4 < 2 ? knit.a : knit.b));
    // The tails hang from the ring's own bottom row: its two ends, two voxels wide each, on the slice that row is on.
    const cells = [...g.map.values()];
    const low = Math.min(...cells.map((v) => v.y));
    const bottom = cells.filter((v) => v.y === low).sort((p, q) => p.x - q.x);
    const tz = bottom[0].z;
    const ends = [bottom[0].x, bottom[bottom.length - 1].x - 1];
    for (const x0 of ends) for (let k = 1; k <= 6; k++) for (const w of [0, 1]) g.set(x0 + w, low - k, tz, lin(k % 2 ? knit.b : knit.a));
    void tails;
    return g;
  }
  for (let k = 0; k < 200; k++) {
    const a = (k / 200) * Math.PI * 2;
    for (const dz of [0, 1]) g.set(Math.round((centre[0] + Math.cos(a) * rx) / S), Math.round((centre[1] + Math.sin(a) * ry) / S), cz + dz, lin(k % 10 < 5 ? knit.a : knit.b));
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
  /** The scarf's ring; with `solid` (the neck's, or the pig's head's) it hugs that section instead of an ellipse. */
  neck: { centre: V3; rx: number; ry: number; tails: V3; solid?: Set<string> };
  /** The sweater's or the vest's neck band (4.5); the blanket has none. */
  band?: { centre: V3; rx: number; ry: number; solid?: Set<string> };
  /** Cells no garment voxel may come within two voxels of: the head and the ears (4.5). */
  avoid?: VoxelMap[];
  /** Cells the shell leaves to another part (the chicken's wings where the vest's hem meets them). */
  clear?: VoxelMap[];
  legs: { cx: number; cz: number; w: number }[];
  knit: Knit;
}

/** Drops every garment voxel within two voxels (in every axis) of the cells to avoid: the torso shell's rule (4.5). */
function keepClear(g: Grid, avoid: VoxelMap[] = []): Grid {
  if (!avoid.length) return g;
  const near = new Set<string>();
  for (const m of avoid) for (const v of m.values()) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) near.add(key(v.x + dx, v.y + dy, v.z + dz));
  const out = new Grid(S);
  for (const v of g.map.values()) if (!near.has(key(v.x, v.y, v.z))) out.set(v.x, v.y, v.z, v.c);
  return out;
}
/** Drops every voxel that would sit inside another part: the neck pieces (band, scarf) ring the neck, they never enter it. */
function outside(g: Grid, solid: VoxelMap[]): Grid {
  const out = new Grid(S);
  for (const v of g.map.values()) if (!solid.some((m) => m.has(key(v.x, v.y, v.z)))) out.set(v.x, v.y, v.z, v.c);
  return out;
}

/** The level-2 garment's pieces, for the garment test (V5.1 Part 7.5). */
export interface GarmentCells { kind: GarmentSpec['kind']; shell: VoxelMap; band: VoxelMap; zFrom: number; zTo: number; bellyY: number; avoid: VoxelMap[]; clear: VoxelMap[] }

/** The coats per level and their frosts, from the species' garment spec (Part 4.9's table). */
export function coatsFor(spec: GarmentSpec): { wools: AnimalModel['wools']; frosts: AnimalModel['frosts']; coatCells: AnimalModel['coatCells']; garment: GarmentCells } {
  const merge = (grids: Grid[]) => { const g = new Grid(S); for (const h of grids) for (const v of h.map.values()) g.set(v.x, v.y, v.z, v.c); return g; };
  const t = spec.torso;
  const solid = [spec.body, ...(spec.avoid ?? [])];
  const shellG = keepClear(spec.kind === 'sweater' || spec.kind === 'vest'
    ? sweater(spec.body, t.zFrom, t.zTo, t.bellyY, spec.knit)
    : blanket(spec.body, t.zFrom, t.zTo, t.bellyY, spec.knit, spec.kind === 'blanket-saddle' ? 'saddle' : 'square'), spec.avoid);
  for (const m of spec.clear ?? []) for (const v of m.values()) shellG.del(v.x, v.y, v.z);
  const bandG = outside(spec.band && spec.kind !== 'blanket-square' && spec.kind !== 'blanket-saddle' ? neckBand(spec.band.centre, spec.band.rx, spec.band.ry, spec.knit, spec.band.solid) : new Grid(S), solid);
  const torsoOf = () => merge([shellG, bandG]);
  const sc = () => outside(scarf(spec.neck.centre, spec.neck.rx, spec.neck.ry, spec.knit, spec.neck.tails, spec.neck.solid), solid);
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
    addCavity(merged.map, cavityOf(spec.body));
    // The body's shell under the coat can never show at this level: hollow the pair together.
    hollow(merged);
    const p = part(merged, [0, 0, 0]);
    wools[level] = p;
    coatCells[level] = garment;
    frosts[level] = frostOf(merged.map, [0, 0, 0]);
  }
  return { wools, frosts, coatCells, garment: { kind: spec.kind, shell: shellG.map, band: bandG.map, zFrom: t.zFrom, zTo: t.zTo, bellyY: t.bellyY, avoid: spec.avoid ?? [], clear: spec.clear ?? [] } };
}

export type { Part };
