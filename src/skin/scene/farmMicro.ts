/**
 * The micro layer on Home (docs/miniature/04; 05, sections 7 and 8): where each small object of the kit
 * (voxel/microKit.ts) stands, the rules a place must keep, and one mesh a cluster. Built at the end of the farm's own
 * sliced build (scene/farmstead.ts) and drawn only by the start screen (table/Farmstead.tsx). The barn table, the
 * podium and the small scenes never see it.
 *
 * The plan's places were written against v0.8.0. Where the farm of v0.8.3 has something standing there, an object is
 * moved the least distance that clears it and the move is said beside its line (docs/miniature/anchors.md, section 2).
 */
import type { BufferGeometry } from 'three';
import { FESTIVE } from '../../config';
import { noteShade } from '../voxel/groundShade';
import { buildGeometry, packGeometry, triangles } from '../voxel/mesher';
import type { Voxel } from '../voxel/mesher';
import { footprint, MICRO, place } from '../voxel/micro';
import type { MicroObject, Placement } from '../voxel/micro';
import { KIT } from '../voxel/microKit';
import { Grid } from '../voxel/primitives';
import { buildFestive } from './festive';
import { BARN, YARD } from './layout';
import { LIVESTOCK } from './livestock';
import type { Steps } from './slices';
import { onWalk, yardProps } from './yard';

/** How far from a tour camera a cluster is still drawn, and still casts a shadow (docs/miniature/04, section 4). */
export const MICRO_RANGE = { draw: 40, cast: 25 };
/** The budget: triangles in the whole layer after merging, and clusters. */
export const MICRO_BUDGET = { triangles: 120_000, clusters: 8, tallest: 1.9 };

const GROUND = 'ground' as const;
/**
 * The hens' straw bed (`henYard` in scene/farmstead.ts lays it: an ellipse off the coop, 0.10 m thick). Written out
 * here because that file reads this one; a test holds the two together.
 */
export const STRAW_BED = { x: -13.6, z: 11.9, rx: 3, rz: 2.1, top: 0.1 };
/** The ground's height under a place: the straw bed (0.10 m up), the yard's snow (0) or the land beyond it (0.05 m lower). */
const groundAt = (x: number, z: number) => (Math.hypot((x - STRAW_BED.x) / STRAW_BED.rx, (z - STRAW_BED.z) / STRAW_BED.rz) <= 1 ? STRAW_BED.top
  : x >= YARD.minX && x < YARD.maxX && z >= -7 && z < YARD.maxZ ? 0 : -0.05);
type Row = [kind: string, x: number, y: number | typeof GROUND, z: number, turn?: 0 | 1 | 2 | 3, options?: Record<string, unknown>];
const cluster = (name: string, rows: Row[]): Placement[] =>
  rows.map(([kind, x, y, z, turn = 0, options]) => ({ kind, at: [x, y === GROUND ? groundAt(x, z) : y, z], turn, ...(options ? { options } : {}), cluster: name }));

/**
 * Every object's place: its minimum corner in metres on the 0.05 m grid, quarter turns about y, its cluster.
 *
 * `workCorner` (M3, the proof): the barn's south wall east of the doors. At v0.8.3 the bale stack stands against that
 * wall from x 3.2 to 6.2 (Brian's farm picture), where the plan stood these. Moved, each the least that clears:
 * the cart wheel 0.2 m west (x 2.60 to 2.40), into the gap between the open door leaf and the stack; the cans, crates
 * and barrel straight out from the wall to the stack's front (z +1.25 to +1.35), a row in front of the bales; the
 * pitchfork to the wall's east end beside the stack (x 3.60 to 6.15), leaning on the white corner board. What hangs on
 * the wall is where the plan put it.
 */
export const MICRO_PLACEMENTS: Placement[] = [
  ...cluster('workCorner', [
    ['cartWheel', 2.40, GROUND, 7.30],
    ['pitchfork', 6.15, GROUND, 7.45], // on the corner board, which stands 0.2 m proud of the wall's boards
    ['milkCan', 4.05, GROUND, 8.70],
    ['milkCan', 4.30, GROUND, 9.00],
    ['crate', 4.75, GROUND, 8.65],
    ['crate', 4.80, 0.45, 8.65, 1, { snow: true }],
    ['crateOpen', 5.30, GROUND, 8.70, 0, { contents: 'apples' }],
    ['barrel', 5.85, GROUND, 8.70, 0, { snow: true }],
    ['ropeCoil', 4.90, 1.35, 7.20],
    ['wallLantern', 2.75, 2.30, 7.20],
    ['wallLantern', -2.90, 2.30, 7.20],
    ['horseshoe', -0.10, 3.45, 7.30],
    ['hoistRope', -0.05, 4.65, 8.30],
  ]),
  // `toolCorner` (M4): the west end of the same wall. The broom and the shovel stand 0.15 m east of the plan's places:
  // the white corner board reaches in to x -5.9 and stands proud of the red boards.
  ...cluster('toolCorner', [
    ['broom', -5.95, GROUND, 7.25],
    ['shovel', -5.65, GROUND, 7.25],
    ['pail', -6.10, GROUND, 7.70, 0, { contents: 'empty' }],
  ]),
  // `tractorSide` (M4): the pump and its pail, moved with the pasture's trough they stand by (z +2.0), the pail 0.15 m
  // nearer so it stands under the spout. The tractor's grille bars and wheel nuts are not built: since 0.8.2 the
  // tractor is parked behind the barn, where no shot of the tour sees it.
  ...cluster('tractorSide', [
    ['handPump', 7.80, GROUND, 15.75, 2],
    ['pail', 7.75, GROUND, 15.60, 0, { contents: 'ice' }],
  ]),
  // `henCorner` (M4), moved with the coop, which stands at (-13, 8.4) with its pop door and ramp on its south side.
  // Two cleats, not four: of the ramp's four steps the pop door stands on the first and the last is level with the
  // ground, under the straw. The feed pail stands at the trough's west
  // end (the hens stand within 1.2 m of its east end), and the sacks 0.4 m east of the window's middle, off the straw.
  // The bales stand against the run's west fence by its south corner.
  ...cluster('henCorner', [
    ['cleat', -14.20, 0.40, 10.15, 0, { w: 12 }],
    ['cleat', -14.20, 0.20, 10.35, 0, { w: 12 }],
    ['eggBasket', -13.40, GROUND, 10.00],
    ['sack', -12.15, GROUND, 9.80],
    ['sack', -11.70, GROUND, 9.80],
    ['pail', -17.05, GROUND, 11.95, 0, { contents: 'hay' }],
    ['squareBale', -17.15, GROUND, 13.90],
    ['squareBale', -17.15, GROUND, 14.35],
    ['squareBale', -16.90, 0.45, 13.90, 1, { snow: true }],
  ]),
  // `gate` (M4): on the leaf's face toward the lane (x -1.2). The upper hinge and the latch are on the upper rail, which
  // is 0.2 m lower than the plan's (0.8 to 1.0 m); turned so their backs lie on the leaf.
  ...cluster('gate', [
    ['strapHinge', -1.20, 0.45, 15.05, 3],
    ['strapHinge', -1.20, 0.85, 15.05, 3],
    ['latch', -1.20, 0.90, 17.75, 3],
  ]),
  // `pondSide` (M5): the bench and the skates on the pond's west bank. The pond stands 8 m east and 5 m south of where
  // it was and is wider; moved with it the bench stood on the ice, so it stands 1.6 m further west, on the bank.
  ...cluster('pondSide', [
    ['bench', 10.50, GROUND, 28.60, 1, { snow: true }],
    ['skates', 11.00, GROUND, 29.20],
  ]),
  // `porch` (M5): the farmhouse, whose front has faced east under a porch since 0.8.3, with four windows. A pair of
  // shutters a window (eight), as tall as the frames (1.8 m), their backs on the wall (x -15.0); the knob where the
  // door's 0.2 m cube was; the lantern on the porch post north of the steps (every strip of wall by the door holds a
  // shutter); the crate of carrots in the porch's north corner. There has been no woodpile since 0.8.3: the chopping
  // block and the split logs stand before the woodshed on the kitchen end, and the broom leans by the kitchen door
  // (no strip of the front wall is as wide as a broom).
  ...cluster('porch', [
    ...[17.4, 19.2, 22.2, 24.0].flatMap((z): Row[] => [['shutter', -15.00, 1.00, z - 0.30, 3, { h: 36 }], ['shutter', -15.00, 1.00, z + 1.00, 3, { h: 36 }]]),
    ['knob', -15.00, 1.45, 21.45, 3],
    ['wallLantern', -13.80, 2.00, 19.80, 1], // on the post's inner face: the season's string of lights runs along its outer one
    ['crateOpen', -14.80, 0.40, 17.05, 0, { contents: 'carrots' }],
    ['choppingBlock', -20.40, GROUND, 14.20],
    ['splitLogs', -19.70, GROUND, 14.20],
    ['broom', -17.85, GROUND, 16.30, 2],
  ]),
  // `flockSpot` (M5): the flock's bales and hay, moved with the three loose sheep (+33, -1), who stand in the pasture
  // by the trough now.
  ...cluster('flockSpot', [
    ['squareBale', 6.70, GROUND, 18.20],
    ['squareBale', 6.70, GROUND, 18.70],
    ['squareBale', 6.95, 0.45, 18.20, 1, { snow: true }],
    ['hayHeap', 7.40, GROUND, 19.40],
  ]),
];

// ---- the rules a place must keep (docs/miniature/05, sections 1.3 and 7)

/** The keep-clear wedge under the paddock camera's view of the wendigo, and the paddock. Nothing of the kit stands in either. */
export const WEDGE: readonly (readonly [number, number])[] = [[22.5, 7.5], [18.0, 7.5], [-6.5, -16.0], [12.5, -16.0]];
const PADDOCK = { minX: 12, maxX: 22, minZ: -14, maxZ: 7 };
/** The doorway, kept for the hero and tour shots 0, 3 and 6. */
const DOORWAY = { minX: -1.8, maxX: 1.8, minZ: 7.2, maxZ: 15, under: 3 };
const HERO: [number, number] = [0, BARN.maxZ + 1.2];
const BIG_TREE: [number, number] = [-4.2, BARN.maxZ + 2.2];

export function inWedge(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = WEDGE.length - 1; i < WEDGE.length; j = i++) {
    const [xi, zi] = WEDGE[i], [xj, zj] = WEDGE[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
const objectOf = (p: Placement): MicroObject => {
  const make = KIT[p.kind];
  if (!make) throw new Error(`micro: no "${p.kind}" in the kit (${p.cluster})`);
  return make(p.options);
};
function boxOf(p: Placement, o = objectOf(p)): Box {
  const [w, d] = footprint(o, p.turn);
  return { x0: p.at[0], x1: p.at[0] + w * MICRO, y0: p.at[1], y1: p.at[1] + o.size[1] * MICRO, z0: p.at[2], z1: p.at[2] + d * MICRO };
}
/** How far a point is from a box's footprint, in metres (0 inside it). */
const gap = (b: Box, x: number, z: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const overlaps = (b: Box, x0: number, x1: number, z0: number, z1: number, pad = 0) => b.x0 < x1 + pad && b.x1 > x0 - pad && b.z0 < z1 + pad && b.z1 > z0 - pad;

/** Why a placement breaks a rule, or null. Rules 2 to 4 are for what stands under 3 m: a horseshoe on the lintel blocks nobody. */
export function breach(p: Placement, o = objectOf(p)): string | null {
  const b = boxOf(p, o), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  const points: [number, number][] = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1], [mx, mz]];
  if (o.size[1] * MICRO > MICRO_BUDGET.tallest + 1e-9) return 'is taller than 1.9 m';
  if (points.some(([x, z]) => inWedge(x, z)) || overlaps(b, PADDOCK.minX, PADDOCK.maxX, PADDOCK.minZ, PADDOCK.maxZ)) return 'stands in the wedge or the paddock (the wendigo)';
  // The lane and the footpaths, for what stands on the ground (a hinge on the gate's leaf is on the gate). The trampled
  // apron before the doors is not counted: the plan's own corner stands at the wall on it, and it reads as walked ground
  // with a wheel leaning at its edge.
  if (b.y0 < 0.3 && (overlaps(b, -YARD.path.halfWidth, YARD.path.halfWidth, YARD.path.fromZ, YARD.path.toZ) || points.some(([x, z]) => onWalk(x, z)))) return 'stands on the lane or a footpath';
  if (b.y0 < DOORWAY.under) {
    if (overlaps(b, DOORWAY.minX, DOORWAY.maxX, DOORWAY.minZ, DOORWAY.maxZ)) return 'stands in the doorway';
    for (const [animal, x, z] of [...LIVESTOCK, ['hero', ...HERO] as const]) if (gap(b, x, z) < 1.2) return `stands within 1.2 m of the ${animal} at ${x}, ${z}`;
  }
  if (FESTIVE) {
    if (gap(b, ...BIG_TREE) < 1.9) return 'stands within 1.9 m of the season\'s tree';
    for (const part of buildFestive().parts)
      if ((part.kind === 'present' || part.kind === 'cane') && overlaps(b, part.min[0], part.max[0], part.min[2], part.max[2], 0.3) && b.y0 < part.max[1] + 0.3 && b.y1 > part.min[1] - 0.3)
        return `stands within 0.3 m of a ${part.kind}`;
  }
  for (const [name, x0, x1, z0, z1] of yardProps()) if (overlaps(b, x0, x1, z0, z1, 0.4)) return `stands within 0.4 m of the ${name}`;
  return null;
}

/** Whether a micro object stands on the ground here or within 0.1 m: the yard and the farm lay no drift under one. */
export function underMicro(x: number, z: number): boolean {
  return grounded().some((b) => x > b.x0 - 0.1 && x < b.x1 + 0.1 && z > b.z0 - 0.1 && z < b.z1 + 0.1);
}
let onGround: Box[] | null = null;
const grounded = () => (onGround ??= MICRO_PLACEMENTS.map((p) => boxOf(p)).filter((b) => b.y0 < 0.3));

// ---- what stands round the clusters: the yard's and the farm's own cubes, kept only near a cluster

let reach: Box[] | null = null;
/** Each cluster's box, a quarter of a metre wider every way. */
const reaches = () => (reach ??= [...new Set(MICRO_PLACEMENTS.map((p) => p.cluster))].map((name) => {
  const boxes = MICRO_PLACEMENTS.filter((p) => p.cluster === name).map((p) => boxOf(p)), pad = 0.25;
  const lo = (k: 'x0' | 'y0' | 'z0') => Math.min(...boxes.map((b) => b[k])) - pad, hi = (k: 'x1' | 'y1' | 'z1') => Math.max(...boxes.map((b) => b[k])) + pad;
  return { x0: lo('x0'), x1: hi('x1'), y0: lo('y0'), y1: hi('y1'), z0: lo('z0'), z1: hi('z1') };
}));
const cell = (x: number, y: number, z: number) => (x + 4096) * 67108864 + (y + 4096) * 8192 + (z + 4096);
/** Structure cells near a cluster, by how many micro cubes a side a structure cube is (4 for the 0.2 m grid, 2 for 0.1 m). */
const structure = new Map<number, Set<number>>();

/** Tells the layer what a structure model's cubes are (a yard or farm grid of `size` metres): only those near a cluster are kept. */
export function noteStructure(cubes: Iterable<Voxel>, size: number, keep?: (v: Voxel) => boolean): void {
  const k = Math.round(size / MICRO), boxes = reaches();
  let set = structure.get(k);
  if (!set) structure.set(k, (set = new Set()));
  for (const v of cubes) {
    if (keep && !keep(v)) continue;
    const x = v.x * size, y = v.y * size, z = v.z * size;
    if (boxes.some((b) => x < b.x1 && x + size > b.x0 && y < b.y1 && y + size > b.y0 && z < b.z1 && z + size > b.z0)) set.add(cell(v.x, v.y, v.z));
  }
}
/** Whether a structure cube fills this micro cell. */
function structureAt(x: number, y: number, z: number): boolean {
  for (const [k, set] of structure) if (set.has(cell(Math.floor(x / k), Math.floor(y / k), Math.floor(z / k)))) return true;
  return false;
}

export interface MicroCluster { name: string; geo: BufferGeometry; centre: [number, number, number]; triangles: number }
export interface FarmMicro {
  clusters: MicroCluster[];
  /** Every lantern's glass, one mesh: drawn glowing, as the farmhouse's panes are. */
  glass: BufferGeometry | null;
  triangles: number;
}

export function* buildFarmMicroSteps(): Steps<FarmMicro> {
  const names = [...new Set(MICRO_PLACEMENTS.map((p) => p.cluster))];
  if (names.length > MICRO_BUDGET.clusters) throw new Error(`micro: ${names.length} clusters, ${MICRO_BUDGET.clusters} at most`);
  const lit = new Grid(MICRO), clusters: MicroCluster[] = [];
  for (const name of names) {
    const world = new Grid(MICRO), list = MICRO_PLACEMENTS.filter((p) => p.cluster === name);
    for (const p of list) {
      const o = objectOf(p), why = breach(p, o);
      if (why) throw new Error(`micro: ${p.kind} at ${p.at.join(', ')} (${name}) ${why}`);
      place(world, o, p, lit);
    }
    for (const g of [world, lit]) for (const v of g.map.values()) if (structureAt(v.x, v.y, v.z)) throw new Error(`micro: a cube of ${name} at ${(v.x * MICRO).toFixed(2)}, ${(v.y * MICRO).toFixed(2)}, ${(v.z * MICRO).toFixed(2)} is inside the yard's or the farm's own cubes`);
    noteShade(world.map.values(), MICRO);
    const base = Math.min(...list.map((p) => p.at[1]));
    const geo = buildGeometry(world.map, MICRO, {
      merge: true,
      // Corner shade from what the object stands on and against: the ground under it and the structure beside it.
      near: (x, y, z) => y * MICRO < groundAt(x * MICRO, z * MICRO) - 1e-6 || structureAt(x, y, z),
      // Faces that look straight down at the ground are never seen.
      unseen: (axis, sign, plane) => axis === 1 && sign < 0 && plane <= base + 1e-6,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    packGeometry(geo);
    clusters.push({ name, geo, centre: [(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2], triangles: triangles(geo) });
    yield;
  }
  const glass = lit.count ? buildGeometry(lit.map, MICRO, { ao: false }) : null;
  if (glass) packGeometry(glass);
  const total = clusters.reduce((n, c) => n + c.triangles, 0) + (glass ? triangles(glass) : 0);
  if (total > MICRO_BUDGET.triangles) throw new Error(`micro: ${total} triangles, ${MICRO_BUDGET.triangles} at most`);
  return { clusters, glass, triangles: total };
}
