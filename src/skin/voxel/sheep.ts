import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { ICE_CRACK, lin, pick, T } from './palette';
import { cone, ellipsoid, Grid, hash3, line, rng, solid } from './primitives';
import type { RGB, V3 } from './primitives';

/** Characters are built on the 0.04 m grid (plan V3 Part 4.1). */
export const CHAR = 0.04;

export type Brows = 'neutral' | 'up' | 'worried';
export type Mouth = 'flat' | 'smile' | 'o' | 'chewL' | 'chewDown' | 'chewR';
export type Lids = 'closed' | 'arc';
export type WoolLevel = 0 | 1 | 2 | 3 | 4;

/** One geometry per moving part, with the point it pivots about (the geometry is built around that pivot). */
export interface Part { geo: BufferGeometry; pivot: V3; voxels: number }

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
/** The neck: the head group turns about this point, at the back of the jaw where it leaves the fleece. */
export const HEAD_PIVOT: V3 = [CX, 0.58, 0.34];
/** How much bigger each coat level's fleece is than the normal coat (level 2). */
export const LEVEL_K = [0, 0.88, 1, 1.12, 1.26] as const;

export function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count };
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
  return zm > 0.5 && Math.abs(xm - CX) < 0.16 && ym > 0.44 && ym < 0.82;
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
    { c: at(0, 0.6, 0.16), r: rr(0.2, 0.16, 0.2), tone: 1 },
    { c: at(0, 0.6, -0.16), r: rr(0.2, 0.16, 0.2), tone: 0 },
    { c: at(-0.13, 0.48, 0.17), r: rr(0.16, 0.17, 0.18), tone: 0 },
    { c: at(0.13, 0.48, 0.17), r: rr(0.16, 0.17, 0.18), tone: 1 },
    { c: at(-0.13, 0.48, -0.17), r: rr(0.16, 0.17, 0.18), tone: 1 },
    { c: at(0.13, 0.48, -0.17), r: rr(0.16, 0.17, 0.18), tone: 0 },
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

/** The head wedge, row by row from the top: half-width in columns, and the back and front z cells. */
export const HEAD_ROWS: [number, number, number, number][] = [
  [22, 3, 8, 13], [21, 3, 7, 14], [20, 3, 7, 14], [19, 3, 7, 15], [18, 3, 8, 15],
  [17, 3, 9, 15], [16, 2, 10, 15], [15, 2, 11, 15], [14, 2, 12, 15], [13, 2, 12, 15],
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

  // ---- Head: the wedge, narrower toward the muzzle, the vertical edges knocked off; the bridge and cheeks lighter.
  const head = new Grid(s);
  for (const [y, hw, zb, zf] of HEAD_ROWS) {
    for (let x = -hw; x <= hw; x++) for (let z = zb; z <= zf; z++) {
      // Knock off the vertical edges, except at the front of the eye rows so the eyes sit on the face plane.
      if (Math.abs(x) === hw && (z === zb || (z === zf && (y < 17 || y > 18)))) continue;
      const bridge = z === zf && Math.abs(x) <= 1 && y >= 15 && y <= 20;
      const cheek = Math.abs(x) === hw && y >= 14 && y <= 17;
      head.set(x, y, z, lin(bridge || cheek ? FACE[1] : FACE[0]));
    }
  }
  const front = new Map<string, number>();
  for (const v of head.map.values()) front.set(`${v.x},${v.y}`, Math.max(front.get(`${v.x},${v.y}`) ?? -99, v.z));
  /** Paints the front-most head cell at (x, y), or a cell `extra` voxels proud of it. */
  const proud = (g: Grid, x: number, y: number, c: RGB, extra = 1) => {
    const z = front.get(`${x},${y}`);
    if (z !== undefined) g.set(x, y, z + extra, c);
  };
  // Nose: a small dark patch at the bottom of the face, the nostrils a darker inverted Y.
  for (const x of [-1, 0]) for (const y of [14, 15]) proud(head, x, y, lin(NOSE), 0);
  proud(head, -1, 14, lin(NOSTRIL), 0);
  proud(head, 0, 14, lin(NOSTRIL), 0);
  // Thin dark upper lids over each eye.
  for (const base of EYE_BASES) for (let c = 0; c < 3; c++) proud(head, base + c, 19, lin(LID), 0);

  // Eyes: 0.12 by 0.08 m, set into the face near its sides at mid-height, 0.16 m apart: white sclera at the outer
  // end, a dark brown horizontal iris over the inner two thirds with one catchlight. The eye cells are cut out of
  // the head so the eye can scale without two faces sharing a plane.
  const eyes = EYE_BASES.map((base) => {
    const eye = new Grid(s);
    const outer = base < 0 ? 0 : 2;
    let zc = 0;
    for (let c = 0; c < 3; c++) for (const y of [17, 18]) {
      const z = front.get(`${base + c},${y}`)!;
      head.del(base + c, y, z);
      zc = Math.max(zc, z);
      const catchlight = c === 1 && y === 18;
      eye.set(base + c, y, z, lin(c === outer || catchlight ? EYE_WHITE : IRIS));
    }
    return part(eye, [(base + 1.5) * s, 18 * s, (zc + 0.5) * s]);
  }) as [Part, Part];
  const lids = {} as Record<Lids, Part>;
  for (const kind of ['closed', 'arc'] as Lids[]) {
    const g = new Grid(s);
    for (const base of EYE_BASES) {
      for (let c = 0; c < 3; c++) for (const y of [17, 18]) proud(g, base + c, y, lin(FACE[0]), 1);
      const light = kind === 'closed' ? [[0, 18], [1, 18], [2, 18]] : [[0, 17], [1, 18], [2, 17]];
      for (const [c, y] of light) proud(g, base + c, y, lin(FACE[1]), 1);
    }
    lids[kind] = part(g, HEAD_PIVOT);
  }
  // Brows: nothing at rest; raised or tilted lighter bars above the lids for the emotions.
  const brows = {} as Record<Brows, Part>;
  const BROW_ROWS: Record<Brows, [number, number, number] | null> = { neutral: null, up: [21, 21, 21], worried: [20, 21, 21] };
  for (const kind of ['neutral', 'up', 'worried'] as Brows[]) {
    const g = new Grid(s);
    const rows = BROW_ROWS[kind];
    if (rows) [-1, 1].forEach((sx) => [4, 3, 2].forEach((dx, n) => proud(g, sx * dx, rows[n], lin(BROW))));
    brows[kind] = part(g, HEAD_PIVOT);
  }
  // Mouths: a short dark line under the nose, a small "o", and chewing frames that shift and open it.
  const MOUTHS: Record<Mouth, [number, number][]> = {
    flat: [[-1, 13], [0, 13], [1, 13]],
    smile: [[-2, 14], [-1, 13], [0, 13], [1, 13], [2, 14]],
    o: [[-1, 13], [0, 13], [-1, 12], [0, 12]],
    chewL: [[-2, 13], [-1, 13], [0, 13]],
    chewDown: [[-1, 12], [0, 12], [1, 12]],
    chewR: [[0, 13], [1, 13], [2, 13]],
  };
  const mouths = {} as Record<Mouth, Part>;
  for (const kind of Object.keys(MOUTHS) as Mouth[]) {
    const g = new Grid(s);
    for (const [x, y] of MOUTHS[kind]) g.set(x, y, (front.get(`${x},${Math.max(13, y)}`) ?? 15) + 1, lin(kind === 'o' || kind === 'chewDown' ? NOSTRIL : NOSE));
    mouths[kind] = part(g, HEAD_PIVOT);
  }

  // Ears: 0.16 m leaves out from the sides of the head at eye height, two voxels tall and one thick, face colour
  // with a pink strip along the inside, the tip one voxel. Pivot at the head's edge.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const px = sx < 0 ? -4 : 4;
    for (let k = 0; k < 4; k++) {
      g.set(px + sx * k, 19, 11, lin(FACE[0]));
      if (k < 3) g.set(px + sx * k, 18, 11, lin(EAR_PINK));
    }
    return part(g, [(px + 0.5) * s, 19 * s, 11.5 * s]);
  }) as [Part, Part];

  // Legs: 0.08 m square and 0.32 m tall in the face colour, a lighter hoof splayed one voxel outward.
  const legGrids: Grid[] = [];
  const legs = ([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sz]) => {
    const g = new Grid(s);
    const xs = sx < 0 ? [-5, -4] : [4, 5];
    const zs = sz < 0 ? [-6, -5] : [4, 5];
    for (const x of xs) for (const z of zs) {
      for (let y = 1; y <= 7; y++) g.set(x, y, z, lin(FACE[0]));
      g.set(x + sx, 0, z, lin(HOOF));
    }
    legGrids.push(g);
    return part(g, [(xs[0] + 1) * s, 0.32, (zs[0] + 1) * s]);
  }) as [Part, Part, Part, Part];

  // Collar: a thin red band under the chin, its back half in the fleece, with a brass bell hanging from the front.
  const collar = new Grid(s);
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    const x = Math.floor((CX + 0.15 * Math.cos(a)) / s), z = Math.floor((0.42 + 0.15 * Math.sin(a)) / s);
    for (const y of [11, 12]) collar.set(x, y, z, pick(T.collar, hash3(k >> 3, y, 0, 47), [0.6, 1]));
  }
  // Bell: a small brass cup, wider at the mouth, with a dark slot and the clapper showing below.
  const bell = new Grid(s);
  for (const [y, hw] of [[10, 0], [9, 1], [8, 1]] as const)
    for (let x = -hw; x <= hw; x++) for (const z of [13, 14]) bell.set(x, y, z, lin(T.brass[y === 10 ? 0 : 1]));
  bell.set(0, 8, 15, lin(T.hoof[1])); // slot
  bell.set(0, 7, 14, lin(T.brass[2])); // clapper

  // Cells the wool and the bare body must leave alone.
  const taken = (x: number, y: number, z: number) => head.has(x, y, z) || collar.has(x, y, z) || bell.has(x, y, z) || legGrids.some((g) => g.has(x, y, z));

  // ---- Wool per coat level, with frost for the freeze.
  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  let woolTones = 0;
  for (const level of [1, 2, 3, 4] as const) {
    const g = new Grid(s);
    paintLobes(g, bodyLobes(level), (xm, ym, zm, x, y, z) => ym >= 0.02 && !inFace(xm, ym, zm) && !taken(x, y, z));
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

  // Wool hood: a cap of four lobes over the skull reaching the brow line, and two cheek lobes beside the jaw, so
  // the dark face sits inside white fleece. Never shares a cell with the head.
  const hood = new Grid(s);
  paintLobes(hood, [
    { c: [CX, 0.9, 0.5], r: [0.18, 0.1, 0.14], tone: 0 },
    { c: [CX, 0.88, 0.3], r: [0.2, 0.13, 0.17], tone: 1 },
    { c: [CX - 0.15, 0.82, 0.42], r: [0.09, 0.13, 0.16], tone: 1 },
    { c: [CX + 0.15, 0.82, 0.42], r: [0.09, 0.13, 0.16], tone: 0 },
    { c: [CX - 0.18, 0.64, 0.46], r: [0.08, 0.12, 0.12], tone: 0 },
    { c: [CX + 0.18, 0.64, 0.46], r: [0.08, 0.12, 0.12], tone: 1 },
  ], (xm, ym, zm, x, y, z) => !inFace(xm, ym, zm) && !taken(x, y, z), 0.03);

  // Tail: two lobes on the rump.
  const tail = new Grid(s);
  paintLobes(tail, [{ c: [CX, 0.62, -0.42], r: [0.09, 0.08, 0.09], tone: 0 }, { c: [CX, 0.68, -0.46], r: [0.06, 0.06, 0.06], tone: 1 }], () => true, 0.03);

  // The sheared body for coat level 0, with a little stubble.
  const sheared = new Grid(s);
  ellipsoid(sheared, [CX, 0.5, 0.0], [0.26, 0.2, 0.34], (x, y, z) => (taken(x, y, z) ? null : pick(T.skin, hash3(x >> 2, y >> 2, z >> 2, 53))));
  for (const v of [...sheared.map.values()]) {
    if (hash3(v.x, v.y, v.z, 55) < 0.08 && !sheared.has(v.x, v.y + 1, v.z) && !taken(v.x, v.y + 1, v.z)) sheared.set(v.x, v.y + 1, v.z, lin(CREAM[0]));
  }

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, 14 + y, 17 + z, lin(EYE_WHITE));

  const parts = {
    wools, frosts, head: part(head, HEAD_PIVOT), hood: part(hood, HEAD_PIVOT), tail: part(tail, [CX, 0.6, -0.38]), eyes, lids, brows, mouths, ears, legs,
    collar: part(collar, [0, 0, 0]), bell: part(bell, [CX, 0.44, 0.56]), sheared: part(sheared, [CX, 0.5, 0]), breath: part(breath, [CX, 0.56, 0.68]),
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
