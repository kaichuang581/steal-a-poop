import type { BufferGeometry } from 'three';
import { mouths as rigMouths, smallEyes, sockets } from './animals/rig';
import { buildGeometry } from './mesher';
import type { VoxelMap } from './mesher';
import { ICE_CRACK, lin, pick, T } from './palette';
import { cone, ellipsoid, Grid, hash3, line, rng, solid } from './primitives';
import type { V3 } from './primitives';

/** Characters are built on the 0.04 m grid (plan V3 Part 4.1). */
export const CHAR = 0.04;

export type Brows = 'neutral' | 'up' | 'worried';
export type Mouth = 'flat' | 'smile' | 'o' | 'chewL' | 'chewDown' | 'chewR';
export type Lids = 'closed' | 'arc';
export type WoolLevel = 0 | 1 | 2 | 3 | 4;

/** One geometry per moving part, with the point it pivots about (the geometry is built around that pivot). */
export interface Part { geo: BufferGeometry; pivot: V3; voxels: number; cells?: VoxelMap }

export interface SheepModel {
  /** The body's wool lobes per coat level 1..4 (the thick levels add lobes down the flanks). Pivot at the ground. */
  wools: Record<1 | 2 | 3 | 4, Part>;
  /** Frost that settles on each fleece's upper surface while freezing. */
  frosts: Record<1 | 2 | 3 | 4, Part>;
  /** The dark wedge head with the nose, lid lines and lighter bridge painted on. Pivot at the neck. */
  head: Part;
  /** The wool hood: a cap over the skull down to the brow and two cheek lobes beside the jaw. Part of the head group. */
  hood: Part;
  /** Two lobes on the rump, wagged about their pivot. */
  tail: Part;
  /** Left and right eye, each scaled about its own centre. */
  eyes: [Part, Part];
  /** Closed lids: a flat line for blinks and sleep, an arc for happy. */
  lids: Record<Lids, Part>;
  brows: Record<Brows, Part>;
  mouths: Record<Mouth, Part>;
  /** Left and right ear, built pointing straight out; the component droops them 20 degrees. */
  ears: [Part, Part];
  /** Front left, front right, back left, back right; pivot at the top. */
  legs: [Part, Part, Part, Part];
  collar: Part;
  bell: Part;
  /** The bare body at level 0, with stubble. */
  sheared: Part;
  breath: Part;
  /** Lobe counts, for the acceptance check. */
  lobes: { body: number; hood: number; tail: number };
  /** Distinct colours in the normal fleece: two creams and the crease tone, nothing per voxel. */
  woolTones: number;
  /** Voxels before face culling at coat level 2. */
  voxels: number;
}

/**
 * The palette: a dark face and legs so the white fleece reads as a sheep (Brian's notes on V3.3 Part 3), the
 * bridge and cheeks a step lighter, two creams for the wool with a third tone only in the creases.
 */
export const FACE = ['#3F3A3A', '#5A5454'] as const;
export const NOSE = '#2B2626';
export const NOSTRIL = '#1E1B1B';
export const LID = '#2B2626';
export const IRIS = '#2B2522';
export const EYE_WHITE = '#FBFBF8';
export const EAR_PINK = '#C9908A';
export const CREAM = ['#FAF6EC', '#EFE8D7'] as const;
export const CREASE = '#DDD3BE';
export const HOOF = '#6F6764';
export const BROW = '#6F6764';

/** The model is centred on voxel column 0, whose centre is 0.02 m, so the face has a middle column. */
export const CX = 0.02;
/** The rebuilt head's face (V5.1 Part 5.1): a dark Suffolk face, the bridge and cheeks a step lighter, a soft grey nose. */
export const HEAD_FACE = ['#6A5A50', '#4A3B34', '#3A2E29'] as [string, string, string];
export const NOSE_V51 = '#8E7B78';
export const NOSTRIL_V51 = '#5A4A46';
/** The neck: the head group turns about this point, at the back of the jaw where it leaves the fleece. */
export const HEAD_PIVOT: V3 = [CX, 0.58, 0.34];
/** How much bigger each coat level's fleece is than the normal coat (level 2). */
export const LEVEL_K = [0, 0.88, 1, 1.12, 1.26] as const;

export function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  // The cells are kept so the tests can measure the sheep as they do every other species (V5.1 Part 7).
  return { geo, pivot, voxels: g.count, cells: g.map };
}

export interface Lobe { c: V3; r: V3; tone: 0 | 1 }
/** Whether a wool cell may exist, given its centre in metres and its grid position. */
export type Keep = (xm: number, ym: number, zm: number, x: number, y: number, z: number) => boolean;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/**
 * Paints wool as a few smooth lobes: every voxel takes its lobe's cream, and the crease tone only where a lobe meets
 * a later one, so the fleece reads as lobes with folds between them rather than noise.
 */
export function paintLobes(g: Grid, lobes: Lobe[], keep: Keep, noise = 0.04) {
  const owner = new Map<string, number>();
  const cells = new Map<string, [number, number, number]>();
  lobes.forEach((l, i) => {
    const tmp = new Grid(g.size);
    ellipsoid(tmp, l.c, l.r, solid([0, 0, 0]), noise, 3 + i);
    for (const v of tmp.map.values()) {
      if (!keep((v.x + 0.5) * g.size, (v.y + 0.5) * g.size, (v.z + 0.5) * g.size, v.x, v.y, v.z)) continue;
      const key = `${v.x},${v.y},${v.z}`;
      owner.set(key, i);
      cells.set(key, [v.x, v.y, v.z]);
    }
  });
  for (const [key, i] of owner) {
    const [x, y, z] = cells.get(key)!;
    const crease = NEIGHBOURS.some(([dx, dy, dz]) => {
      const o = owner.get(`${x + dx},${y + dy},${z + dz}`);
      return o !== undefined && o > i;
    });
    g.set(x, y, z, lin(crease ? CREASE : CREAM[lobes[i].tone]));
  }
}

/** The face window: no wool in front of the head below the brow line. */
function inFace(xm: number, ym: number, zm: number): boolean {
  return zm > 0.44 && Math.abs(xm - CX) < 0.22 && ym > 0.52 && ym < 0.88;
}

/**
 * The body's nine lobes making a 0.56 by 0.5 by 0.74 m cloud at the normal coat, scaled about the body's centre
 * for the other levels. Thick coats hang more lobes down the flanks; the thickest reaches the ground.
 */
function bodyLobes(level: 1 | 2 | 3 | 4): Lobe[] {
  const k = LEVEL_K[level];
  const at = (x: number, y: number, z: number): V3 => [CX + x * k, 0.5 + (y - 0.5) * k, z * k];
  const rr = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
  const lobes: Lobe[] = [
    { c: at(0, 0.5, 0), r: rr(0.26, 0.23, 0.33), tone: 0 },
    // V5.1: the back stands one voxel taller (to the 0.80 m back line) and the four corner lobes hang half a voxel lower
    // over the legs, so the fleece meets the proportion sheet (torso 1.40 to 1.55 long and 1.05 to 1.20 wide for its
    // height, the visible leg at most 0.55 of it, the head's top at most 1.10 of the back) with the legs unchanged.
    { c: at(0, 0.6, 0.16), r: rr(0.2, 0.2, 0.2), tone: 1 },
    { c: at(0, 0.6, -0.16), r: rr(0.2, 0.2, 0.2), tone: 0 },
    { c: at(-0.13, 0.46, 0.17), r: rr(0.16, 0.17, 0.18), tone: 0 },
    { c: at(0.13, 0.46, 0.17), r: rr(0.16, 0.17, 0.18), tone: 1 },
    { c: at(-0.13, 0.46, -0.17), r: rr(0.16, 0.17, 0.18), tone: 1 },
    { c: at(0.13, 0.46, -0.17), r: rr(0.16, 0.17, 0.18), tone: 0 },
    { c: at(0, 0.52, -0.3), r: rr(0.17, 0.16, 0.1), tone: 1 },
    { c: at(0, 0.5, 0.3), r: rr(0.17, 0.16, 0.1), tone: 0 },
  ];
  if (level >= 3) {
    for (const [x, z] of [[-0.26, 0.16], [0.26, 0.16], [-0.26, -0.16], [0.26, -0.16]] as const) {
      lobes.push({ c: [CX + x * k, level === 4 ? 0.2 : 0.28, z * k], r: rr(0.15, 0.15, 0.17), tone: 1 });
    }
  }
  if (level === 4) {
    for (const [x, z, tone] of [[0, 0.44, 0], [0, -0.44, 1], [-0.22, 0.4, 1], [0.22, 0.4, 0], [-0.22, -0.4, 0], [0.22, -0.4, 1]] as const) {
      lobes.push({ c: [CX + x, 0.17, z], r: [0.16, 0.16, 0.14], tone });
    }
  }
  return lobes;
}

/**
 * The head (V5.1 Part 5.1), row by row from the top: half-width in columns, and the back and front z cells. A blunt
 * wedge 9 wide, 7 tall and 8 long: a convex crown, a narrower blunt muzzle, wider than it is tall.
 */
export const HEAD_ROWS: [number, number, number, number][] = [
  [21, 4, 8, 12], [20, 4, 7, 13], [19, 4, 7, 14], [18, 4, 7, 14], [17, 3, 8, 14], [16, 3, 9, 14], [15, 2, 10, 13],
];

/** The left column of each eye. */
export const EYE_BASES = [-3, 1] as const;

let cached: SheepModel | null = null;

/**
 * The default sheep: a 0.56 by 0.5 by 0.74 m cloud of nine smooth wool lobes on thin dark legs, a dark wedge head
 * (0.28 wide, 0.40 tall, 0.36 deep) coming out of the front of the cloud at two thirds of its height, small
 * white-and-brown eyes near the sides, leaf ears, a wool cap down to the brow and cheek lobes beside the jaw, a
 * red collar with a bell, and a tail puff. One model for every player, built once and shared.
 *
 * Parts never share a cell: the wool, the hood and the sheared body are built around the head, collar, bell and
 * legs, so no two parts can put a face on the same plane and flicker against each other.
 */
export function sheepModel(): SheepModel {
  if (cached) return cached;
  const s = CHAR;
  const i = (m: number) => Math.round(m / s);
  const lobes = { body: 9, hood: 6, tail: 2 };

  // ---- Head (V5.1 Part 5.1): the blunt wedge, its bridge and cheeks a step lighter.
  const head = new Grid(s);
  const zFront = new Map<number, number>();
  for (const [y, hw, zb, zf] of HEAD_ROWS) {
    zFront.set(y, zf);
    for (let x = -hw; x <= hw; x++) for (let z = zb; z <= zf; z++) {
      const bridge = z === zf && Math.abs(x) <= 1 && y >= 17 && y <= 20;
      const cheek = Math.abs(x) === hw && y >= 15 && y <= 17;
      head.set(x, y, z, lin(bridge || cheek ? HEAD_FACE[0] : HEAD_FACE[1]));
    }
  }
  // The nose: a soft grey 2 x 2 at the front, its lower row the nostrils (an inverted Y). It sits on rows 17 and 18,
  // above the mouth row (the plan's rows 15 and 16 would put the nose and the mouth on the same voxels).
  for (const x of [-1, 0]) { head.set(x, 18, 14, lin(NOSE_V51)); head.set(x, 17, 14, lin(NOSTRIL_V51)); }
  // Eyes: small and simple (Brian, 2026-11-07), 2 x 2 on the face's front either side of the bridge at rows 18 and 19,
  // nearly black with a white glint so they read on the dark face.
  const { eyes, lids, brows } = smallEyes(head, 18, 14, '#1E1A19', HEAD_FACE, HEAD_PIVOT, { front: 2 });
  // The mouth on row 16, the second from the bottom; the chewing frames on rows 15 and 16, every one on the face.
  const mouths = rigMouths([-1, 15, 14], 3, 'z', NOSTRIL_V51, HEAD_PIVOT, { front: (_x, y) => zFront.get(y) ?? 14 });

  // Ears (V5.1 Part 5.1): 5 long x 2 tall x 2 deep, straight out from the head's sides at rows 19 and 20, z 9 and 10,
  // the lower front voxels pink; pivots at the roots, so the component droops them.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    for (let k = 0; k < 5; k++) for (const y of [19, 20]) for (const z of [9, 10]) g.set(sx * (5 + k), y, z, lin(y === 19 && z === 10 && k < 4 ? EAR_PINK : HEAD_FACE[1]));
    return part(g, [sx * 4.5 * s + (sx < 0 ? 0 : s), 20 * s, 10 * s]);
  }) as [Part, Part];

  // Legs: 0.08 m square in the face colour, a lighter hoof splayed one voxel outward. V5.1: 0.28 m shows below the wool
  // (rows 0 to 6, the proportion sheet's 0.55 of the torso); rows 7 and 8 run up inside it (4.2.3), held by `sockets`.
  const legGrids: Grid[] = [];
  const legs = ([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sz]) => {
    const g = new Grid(s);
    const xs = sx < 0 ? [-5, -4] : [4, 5];
    const zs = sz < 0 ? [-6, -5] : [4, 5];
    for (const x of xs) for (const z of zs) {
      // V5.1: the legs in the face's tone and the hooves in the nostrils' (the palette's 14 colours, Part 4.7).
      for (let y = 1; y <= 8; y++) g.set(x, y, z, lin(HEAD_FACE[1]));
      g.set(x + sx, 0, z, lin(NOSTRIL_V51));
    }
    legGrids.push(g);
    return part(g, [(xs[0] + 1) * s, 0.28, (zs[0] + 1) * s]);
  }) as [Part, Part, Part, Part];

  // Collar (V5.1 Part 5.1): a ring at rows 14 and 15 round the neck, radius 0.13 about (CX, 0.58, 0.36); the bell
  // 3 x 3 x 3 straight under the chin at rows 11 to 13, its top touching the ring's lowest voxel.
  const collar = new Grid(s);
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    const x = Math.round((CX + 0.13 * Math.cos(a)) / s - 0.5), z = Math.round((0.36 + 0.13 * Math.sin(a)) / s - 0.5);
    for (const y of [14]) collar.set(x, y, z, lin(T.collar[1]));
  }
  const bell = new Grid(s);
  for (let y = 11; y <= 13; y++) for (let x = -1; x <= 1; x++) for (let z = 11; z <= 13; z++) {
    if (y === 11 && (Math.abs(x) === 1 && (z === 11 || z === 13))) continue; // a rounded mouth
    bell.set(x, y, z, lin(T.brass[y === 13 ? 0 : 1]));
  }
  bell.set(0, 10, 12, lin(T.brass[1])); // the clapper
  for (let z = 11; z <= 13; z++) if (!collar.has(0, 14, z)) collar.set(0, 14, z, lin(T.collar[1])); // the strap the bell hangs from

  const legSpots = legs.map((l) => ({ cx: l.pivot[0], cz: l.pivot[2], w: 2 }));

  // Cells the wool and the bare body must leave alone.
  const taken = (x: number, y: number, z: number) => head.has(x, y, z) || collar.has(x, y, z) || bell.has(x, y, z) || legGrids.some((g) => g.has(x, y, z));

  // ---- Wool per coat level, with frost for the freeze.
  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  let woolTones = 0;
  for (const level of [1, 2, 3, 4] as const) {
    const g = new Grid(s);
    paintLobes(g, bodyLobes(level), (xm, ym, zm, x, y, z) => ym >= 0.02 && !inFace(xm, ym, zm) && !taken(x, y, z));
    // The thin coats ride higher than the legs' tops: the wool comes down round each one, so no coat floats off them.
    sockets(g, legSpots, 7, 8, taken);
    wools[level] = part(g, [0, 0, 0]);
    if (level === 2) woolTones = new Set([...g.map.values()].map((v) => v.c.join(','))).size;
    const frost = new Grid(s);
    const rf = rng(57 + level);
    const k = LEVEL_K[level];
    for (let n = 0; n < 30; n++) {
      const a = rf() * Math.PI * 2, b = rf() * 0.9;
      const x = Math.round((CX + Math.cos(a) * b * 0.26 * k) / s), z = Math.round((Math.sin(a) * b * 0.34 * k) / s);
      let y = i(1.0);
      while (y > 0 && !g.has(x, y, z)) y--;
      if (y > 0) frost.set(x, y + 1, z, lin(T.ice[0]));
    }
    frosts[level] = part(frost, [0, 0, 0]);
  }

  // Wool hood (V5.1 Part 5.1): lobes over the crown and down the cheeks to row 17 behind the eyes, never on the face
  // below row 21, and a topknot of three lobes above row 21 between z 9 and 12. Never shares a cell with the head.
  const hood = new Grid(s);
  paintLobes(hood, [
    { c: [CX, 0.89, 0.34], r: [0.2, 0.07, 0.15], tone: 0 },
    { c: [CX, 0.84, 0.26], r: [0.2, 0.1, 0.1], tone: 1 },
    { c: [CX - 0.19, 0.78, 0.34], r: [0.07, 0.1, 0.1], tone: 1 },
    { c: [CX + 0.19, 0.78, 0.34], r: [0.07, 0.1, 0.1], tone: 0 },
    { c: [CX, 0.94, 0.42], r: [0.07, 0.05, 0.06], tone: 0 },
    { c: [CX - 0.06, 0.93, 0.38], r: [0.06, 0.04, 0.05], tone: 1 },
    { c: [CX + 0.06, 0.93, 0.38], r: [0.06, 0.04, 0.05], tone: 1 },
  ], (xm, ym, zm, x, y, z) => !inFace(xm, ym, zm) && !taken(x, y, z) && !(y < 22 && z >= 11) && !(y < 17), 0.03);

  // Tail: two lobes on the rump.
  const tail = new Grid(s);
  paintLobes(tail, [{ c: [CX, 0.62, -0.42], r: [0.09, 0.08, 0.09], tone: 0 }, { c: [CX, 0.68, -0.46], r: [0.06, 0.06, 0.06], tone: 1 }], () => true, 0.03);

  // The sheared body for coat level 0, with a little stubble.
  const sheared = new Grid(s);
  ellipsoid(sheared, [CX, 0.5, 0.0], [0.26, 0.2, 0.34], (x, y, z) => (taken(x, y, z) ? null : pick(T.skin, hash3(x >> 2, y >> 2, z >> 2, 53))));
  for (const v of [...sheared.map.values()]) {
    if (hash3(v.x, v.y, v.z, 55) < 0.08 && !sheared.has(v.x, v.y + 1, v.z) && !taken(v.x, v.y + 1, v.z)) sheared.set(v.x, v.y + 1, v.z, lin(CREAM[0]));
  }
  sockets(sheared, legSpots, 7, 8, taken);

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, 16 + y, 16 + z, lin(EYE_WHITE));

  const parts = {
    wools, frosts, head: part(head, HEAD_PIVOT), hood: part(hood, HEAD_PIVOT), tail: part(tail, [CX, 0.6, -0.38]), eyes, lids, brows, mouths, ears, legs,
    collar: part(collar, [0, 0, 0]), bell: part(bell, [CX, 0.56, 0.5]), sheared: part(sheared, [CX, 0.5, 0]), breath: part(breath, [CX, 0.66, 0.64]),
    lobes, woolTones,
  };
  const voxels = wools[2].voxels + parts.head.voxels + parts.hood.voxels + parts.tail.voxels + eyes[0].voxels + eyes[1].voxels
    + ears[0].voxels + ears[1].voxels + legs.reduce((n, l) => n + l.voxels, 0) + parts.collar.voxels + parts.bell.voxels;
  cached = { ...parts, voxels };
  return cached;
}

/** The ice block for the freeze sequence, built once per size and shared by every sheep. */
export interface IceBlock {
  /** The slab itself (transparent ice): chamfered, with white rims on its edges and deeper blue toward the floor. */
  slab: BufferGeometry;
  /** Frosted ice in the bottom 0.12 m, which anchors the block to the floor. */
  base: BufferGeometry;
  /** Two diagonal glints on the front face, upper left. */
  glints: BufferGeometry;
  /** Two comic cracks on the front face (1-voxel lines, dark blue). */
  cracks: BufferGeometry;
  /** Nine icicles hanging from the front top edge, and snow in scattered patches on top. */
  icicles: BufferGeometry;
  cap: BufferGeometry;
  /** Small ice chunks the block breaks into on the thaw. */
  shards: BufferGeometry[];
}

/** Drops the downward-facing quads of a mesher geometry (each quad is 4 vertices with one normal). */
function withoutDownFaces(g: BufferGeometry): BufferGeometry {
  const idx = g.index!.array;
  const ny = g.getAttribute('normal');
  const keep: number[] = [];
  for (let i = 0; i < idx.length; i += 3) if (ny.getY(idx[i]) >= 0) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep);
  return g;
}

const iceBlocks = new Map<string, IceBlock>();
/** Plan V3 Part 6: the slab, its icicles, snow cap and cracks, all voxels on the character grid, centred on the origin. */
export function iceBlock(size: V3): IceBlock {
  const key = size.join(',');
  const hit = iceBlocks.get(key);
  if (hit) return hit;
  const s = CHAR;
  const [w, h] = size;
  const lo = size.map((v) => Math.round(-v / 2 / s));
  const hi = size.map((v) => Math.round(v / 2 / s) - 1);
  const CH = 2; // chamfer, in voxels

  // The slab: a solid chamfered box. Only its outer faces are meshed, so the voxel count costs nothing at runtime.
  const slab = new Grid(s);
  for (let x = lo[0]; x <= hi[0]; x++)
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++) {
        const e = [Math.min(x - lo[0], hi[0] - x), Math.min(y - lo[1], hi[1] - y), Math.min(z - lo[2], hi[2] - z)];
        const near = e.filter((v) => v < CH);
        if (near.length >= 2 && near.reduce((n, v) => n + (CH - v), 0) > CH) continue;
        const rim = e.filter((v) => v <= CH).length >= 2;
        const up = (y - lo[1]) / (hi[1] - lo[1]); // 0 at the floor, 1 at the top
        const n = hash3(x >> 1, y >> 1, z >> 1, 83);
        const tone = rim ? lin(T.snow[n < 0.5 ? 0 : 1]) : up < 0.35 ? pick(T.ice, n, [0.15, 0.45]) : up < 0.75 ? pick(T.ice, n, [0.35, 0.8]) : pick(T.ice, n, [0.7, 0.95]);
        slab.set(x, y, z, tone);
      }

  // Frosted base: a slightly inset layer of snow-white ice in the bottom three voxels, ragged on top.
  const base = new Grid(s);
  for (let x = lo[0] + 1; x <= hi[0] - 1; x++)
    for (let z = lo[2] + 1; z <= hi[2] - 1; z++) {
      const top = 2 + (hash3(x >> 1, 0, z >> 1, 85) < 0.35 ? 1 : 0);
      for (let y = 0; y <= top; y++) base.set(x, lo[1] + y, z, pick(T.snow, hash3(x, y, z, 87), [0.4, 0.95]));
    }

  // The front face is at z = (hi + 1) voxels; glints and cracks sit one voxel proud of it.
  const front = (hi[2] + 1) * s + s / 2;
  const glints = new Grid(s);
  const glint = (x0: number, y0: number, len: number) => line(glints, [x0, y0, front], [x0 + len * 0.55, y0 + len, front], solid(lin(T.snow[0])));
  glint(-w / 2 + 0.1, h / 2 - 0.52, 0.36);
  glint(-w / 2 + 0.18, h / 2 - 0.5, 0.36);
  glint(-w / 2 + 0.3, h / 2 - 0.4, 0.18);

  // Two zigzag cracks (the classic comic crack), one each side of the face.
  const cracks = new Grid(s);
  const crack = (pts: number[]) => {
    for (let i = 0; i + 3 < pts.length; i += 2) line(cracks, [pts[i], pts[i + 1], front], [pts[i + 2], pts[i + 3], front], solid(lin(ICE_CRACK)));
  };
  // Short and near the corners, so they never cross the sheep.
  crack([-0.5, -0.2, -0.42, -0.3, -0.47, -0.38, -0.4, -0.5]);
  crack([0.5, 0.46, 0.43, 0.38, 0.47, 0.3, 0.42, 0.22]);

  // Icicles hang from just under the chamfered front top edge; snow lies on top in drifts with bare ice between.
  const ic = new Grid(s);
  const r = rng(61);
  const edgeY = (hi[1] + 1 - CH) * s, edgeZ = (hi[2] + 1) * s - s;
  for (let k = 0; k < 9; k++) {
    const x = -w / 2 + 0.1 + (k / 8) * (w - 0.2);
    const len = 0.08 + r() * 0.14;
    cone(ic, [x, edgeY, edgeZ], 0.035, len, -1, (xx, yy, zz) => pick(T.ice, hash3(xx, yy, zz, 63), [0.5, 0.85]));
  }
  const cap = new Grid(s);
  const top = hi[1] + 1;
  for (let x = lo[0]; x <= hi[0]; x++)
    for (let z = lo[2]; z <= hi[2]; z++) {
      const patch = hash3(x >> 2, 0, z >> 2, 65) < 0.42;
      if (!patch) continue;
      const inner = hash3((x >> 2) + 1, 0, z >> 2, 65) < 0.42 || hash3(x >> 2, 0, (z >> 2) + 1, 65) < 0.42;
      if (hash3(x, 1, z, 67) < (inner ? 0.12 : 0.3)) continue; // ragged edges
      cap.set(x, top, z, pick(T.snow, hash3(x, 2, z, 69), [0.7, 0.95]));
      if (inner && hash3(x, 3, z, 71) < 0.08) cap.set(x, top + 1, z, lin(T.snow[0]));
    }

  // Shards: three rough chunks, reused at different sizes and turns.
  const shards = [0.13, 0.1, 0.16].map((rad, i) => {
    const g = new Grid(s);
    ellipsoid(g, [0, 0, 0], [rad, rad * 0.8, rad * 0.6], (xx, yy, zz) => pick(T.ice, hash3(xx, yy, zz, 89 + i), [0.3, 0.9]), 0.35, 91 + i);
    return buildGeometry(g.map, s).translate(-s / 2, -s / 2, -s / 2);
  });

  const block: IceBlock = {
    slab: buildGeometry(slab.map, s), base: buildGeometry(base.map, s), glints: buildGeometry(glints.map, s),
    // The cap's underside would show through the clear ice (lit by the floor colour), so it is not drawn.
    cracks: buildGeometry(cracks.map, s), icicles: buildGeometry(ic.map, s), cap: withoutDownFaces(buildGeometry(cap.map, s)), shards,
  };
  iceBlocks.set(key, block);
  return block;
}

/** A wind curl: a flat voxel spiral of radius 0.25 m, 1 voxel thick. */
export function windCurl(): BufferGeometry {
  const g = new Grid(CHAR);
  for (let k = 0; k <= 90; k++) {
    const a = (k / 90) * Math.PI * 3.2;
    const rr = 0.25 * (1 - k / 140);
    line(g, [Math.cos(a) * rr, 0, Math.sin(a) * rr], [Math.cos(a) * rr, 0, Math.sin(a) * rr], () => lin(T.ice[0]));
  }
  return buildGeometry(g.map, CHAR);
}

/** A small wool tuft (about 40 voxels) for the effects. */
export function tuftGeometry(seed = 71): BufferGeometry {
  const g = new Grid(CHAR);
  ellipsoid(g, [0, 0, 0], [0.09, 0.07, 0.09], (x, y, z) => lin(hash3(x >> 1, y >> 1, z >> 1, seed) < 0.6 ? CREAM[0] : CREAM[1]), 0.2, seed);
  return buildGeometry(g.map, CHAR);
}
