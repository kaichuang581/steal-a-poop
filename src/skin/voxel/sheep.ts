import type { BufferGeometry } from 'three';
import { DEFAULT_FACES, facesKey } from './animals/faces';
import type { Faces } from './animals/faces';
import { frostOf, hollow, noMouths, part as shellPart, smallEyes, step } from './animals/rig';
import { buildGeometry } from './mesher';
import type { VoxelMap } from './mesher';
import { ICE_CRACK, lin, T } from './palette';
import { shade as plain, solid as ladder } from './paint'; // the sheep's own colours, not desaturated; the block's ice and snow from the ladders (docs/miniature/06, 3.1)
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
export const HEAD_PIVOT: V3 = [CX, 8 * CHAR, 6 * CHAR]; // the head's back-bottom edge
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
export function paintLobes(g: Grid, lobes: Lobe[], keep: Keep, noise = 0.04, power = 2) {
  const owner = new Map<string, number>();
  const cells = new Map<string, [number, number, number]>();
  lobes.forEach((l, i) => {
    const tmp = new Grid(g.size);
    ellipsoid(tmp, l.c, l.r, solid([0, 0, 0]), noise, 3 + i, power);
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
    g.set(x, y, z, plain(crease ? CREASE : CREAM[lobes[i].tone]));
  }
}

/** The sheep's face and skin (Brian's six-view sheet, 2026-11-18): peach, a darker nose and ear lining, tan legs. */
export const SKIN = ['#F4C3A4', '#EDB394', '#D9958A'] as const;
export const SHIN = ['#D9BB8E', '#C9A577'] as const;
/** The fleece: one white. Its shape, not its paint, makes the wool (Brian's sheet shows no second tone). */
const FLEECE = ['#F6F5F2', '#E9E7E2', '#DEDBD4'] as const;

/**
 * The sheep is built at its sheet's own size, 17 cells from the ground to its crown (0.68 m of model), like every other
 * species at its sheet's, and drawn this much larger, so it stands 1 m as it always has. Whoever draws a sheep scales it
 * by this (`animalModel('sheep').drawScale`), as for any animal.
 */
export const SHEEP_ROWS = 17;
export const SHEEP_DRAW = 1 / (SHEEP_ROWS * CHAR);

/**
 * How far the fleece grows out per coat level, in cells, from the normal coat (level 2): its sides, its top, its back
 * (the tail rides back with it, TAIL_BACK) and the row its belly comes down to (the thickest coat reaches the ground).
 * Its front never grows: the face stays one cell proud of the wool round it.
 */
const GROW: Record<1 | 2 | 3 | 4, { side: number; top: number; back: number; bottom: number }> = {
  1: { side: -1, top: -1, back: -1, bottom: 4 }, 2: { side: 0, top: 0, back: 0, bottom: 3 }, 3: { side: 1, top: 1, back: 1, bottom: 2 }, 4: { side: 2, top: 1, back: 2, bottom: 0 },
};
/** How far back the tail sits at each coat level, in metres, so it stays on the fleece's back (table/Sheep.tsx, anchors.ts). */
export const TAIL_BACK = [0, -1, 0, 1, 2].map((cells) => cells * CHAR);

type Skip = (x: number, y: number, z: number) => boolean;
/**
 * A lobe of wool from `a` to `b` (cells, inclusive): a box with its edges taken off a cell, so lobes laid over one
 * another read as a soft, stepped cloud. Along a side under three cells nothing is taken off, nor at a face named in
 * `flat` (where another part sits against it: an edge taken off there would be a hole). `skip` leaves cells to other
 * parts.
 */
function lobe(g: Grid, a: V3, b: V3, skip: Skip = () => false, flat: { front?: boolean } = {}) {
  const wool = plain(FLEECE[0]);
  const wide = [b[0] - a[0] >= 2, b[1] - a[1] >= 2, b[2] - a[2] >= 2];
  for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) {
    const on = [wide[0] && (x === a[0] || x === b[0]), wide[1] && (y === a[1] || y === b[1]), wide[2] && (z === a[2] || (z === b[2] && !flat.front))].filter(Boolean).length;
    if (on < 2 && !skip(x, y, z)) g.set(x, y, z, wool);
  }
}

/**
 * The sheep's body wool at a coat level (Brian's six-view sheet): a long main lobe, two lobes along
 * the back that step down toward the rump, a chest under the chin, and over most of each flank a lobe one cell proud,
 * its top stepping down toward the rump and its bottom scalloped. Everything but its front grows with the coat.
 */
function bodyWool(level: 1 | 2 | 3 | 4, skip: Skip): Grid {
  const { side: w, top: t, back: k, bottom } = GROW[level];
  const g = new Grid(CHAR);
  lobe(g, [-4 - w, bottom, -8 - k], [4 + w, 13 + t, 5], skip, { front: true }); // the main lobe, down round the legs; the head's wool sits against its front
  lobe(g, [-3 - w, 14 + t, -6 - k], [3 + w, 14 + t, 2], skip); // along the back
  lobe(g, [-2 - w, 15 + t, -2], [2 + w, 15 + t, 2], skip); // the shoulders, behind the crown
  lobe(g, [-3, Math.min(5, bottom + 2), 6], [3, 6, 7], skip); // the chest, under the chin
  // The flanks: one cell proud of the main lobe's side.
  const wool = plain(FLEECE[0]);
  for (const sx of [-1, 1]) for (let z = -7 - k; z <= 4; z++) {
    const top = (z >= -2 ? 13 : z >= -5 ? 12 : 11) + t, low = bottom + (z >= 3 ? 3 : z <= -2 && z >= -4 ? 1 : 2);
    for (let y = low; y <= top; y++) if (!skip(sx * (5 + w), y, z)) g.set(sx * (5 + w), y, z, wool);
  }
  step(g, -1, (v) => v.y === bottom); // the belly row
  return g;
}

const cached = new Map<string, SheepModel>();

/**
 * The default sheep, after Brian's six-view sheet (2026-11-18), cell for cell: 17 cells tall, drawn at SHEEP_DRAW. A
 * long cloud of white wool in lobes on four short tan legs (2 x 2, three rows showing, the foot darker). Its head is
 * the front three cells: a peach face plate 7 wide and 5 tall, one cell proud of the wool round it, with one-cell black
 * eyes and a muzzle 5 wide, 3 tall and 2 proud carrying a darker T of a nose and mouth; wool all round the face (a cell
 * at its sides, three rows and a tuft over it, a row under it), which turns with the head; peach ears 2 x 2 x 2 out of
 * that wool's sides, the inner lower corner darker; a block of a tail on the rump. One model for every player, built
 * once and shared. Parts never share a cell: the wool is built round the head, ears and legs. Grid cells (0.04 m).
 */
export function sheepModel(faces: Faces = DEFAULT_FACES): SheepModel {
  const key = facesKey(faces);
  const hit = cached.get(key);
  if (hit) return hit;
  const s = CHAR;
  const lobes = { body: 6, hood: 3, tail: 1 };
  const cube = (g: Grid, a: V3, b: V3, paint: (x: number, y: number, z: number) => ReturnType<typeof lin> | null) => {
    for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) { const c = paint(x, y, z); if (c) g.set(x, y, z, c); }
  };

  // ---- Head: the face plate (z 9) and the skull behind it in the wool; the muzzle, its T darker.
  const head = new Grid(s);
  cube(head, [-3, 8, 6], [3, 12, 9], () => plain(SKIN[1]));
  cube(head, [-2, 8, 10], [2, 10, 11], (x, y, z) => plain(z === 11 && ((y === 9 && Math.abs(x) <= 1) || (x === 0 && y === 8)) ? SKIN[2] : SKIN[0]));
  const { eyes, lids, brows } = smallEyes(head, 11, 9, '#141212', [SKIN[0], SKIN[1], SKIN[2]], HEAD_PIVOT, { front: 2, rows: 1, cols: 1, glint: false });
  const mouths = noMouths(HEAD_PIVOT); // the T of its nose and mouth is painted on the muzzle; nothing more is drawn

  // ---- The head's wool: round the face (a cell at its sides, three rows over it, one under), the same through its
  // three cells of depth; a cap back over the shoulders that steps down; a tuft on the crown (the 17th row).
  const hood = new Grid(s);
  const wool = plain(FLEECE[0]);
  for (let z = 3; z <= 8; z++) for (let y = z >= 6 ? 7 : 14; y <= (z <= 4 ? 14 : 15); y++) { // the cap steps down toward the shoulders
    const half = y === 7 || y === 15 ? 3 : 4;
    for (let x = -half; x <= half; x++) if (!head.has(x, y, z)) hood.set(x, y, z, wool);
  }
  for (let x = -2; x <= 2; x++) for (let z = 6; z <= 8; z++) hood.set(x, 16, z, wool); // 5 wide: the crown steps in a cell a row, a soft dome
  step(hood, 1); // the head's wool, a step over the fleece

  // ---- Ears: peach, 2 out, 2 tall, 2 deep from the head wool's sides, the inner lower corner of the front darker.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    cube(g, [sx < 0 ? -6 : 5, 11, 6], [sx < 0 ? -5 : 6, 12, 7], (x, y, z) => plain(z === 7 && y === 11 && Math.abs(x) === 5 ? SKIN[2] : SKIN[1]));
    step(g, -1);
    return part(g, [sx * 4.5 * s + (sx < 0 ? 0 : s), 12 * s, 7 * s]);
  }) as [Part, Part];

  // ---- Legs: 2 x 2, tan, the foot a row darker; rows 3 to 5 run up inside the wool.
  const legGrids: Grid[] = [];
  const legs = ([[-3, 2], [2, 2], [-3, -6], [2, -6]] as const).map(([x0, z0]) => { // the back pair a cell in from the rump, under wool at every coat
    const g = new Grid(s);
    cube(g, [x0, 0, z0], [x0 + 1, 5, z0 + 1], (_x, y) => plain(y === 0 ? SHIN[1] : SHIN[0]));
    step(g, -1, (v) => v.y > 0); // the leg, not its foot
    legGrids.push(g);
    return part(g, [(x0 + 1) * s, 4 * s, (z0 + 1) * s]);
  }) as [Part, Part, Part, Part];

  const collar = new Grid(s), bell = new Grid(s);
  const taken = (x: number, y: number, z: number) => head.has(x, y, z) || hood.has(x, y, z) || ears.some((e) => e.cells?.has(`${x},${y},${z}`)) || legGrids.some((g) => g.has(x, y, z));

  // ---- Wool per coat level, with frost for the freeze.
  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  let woolTones = 0;
  for (const level of [1, 2, 3, 4] as const) {
    const g = bodyWool(level, taken);
    hollow(g);
    wools[level] = shellPart(g, [0, 0, 0]); // a hollowed shell: the mesher must know its cavity
    if (level === 2) woolTones = new Set([...g.map.values()].map((v) => v.c.join(','))).size;
    frosts[level] = frostOf(g.map, [0, 0, 0]);
  }

  // ---- Tail: a block of wool on the rump, a nub on top.
  const tail = new Grid(s);
  cube(tail, [-1, 8, -9], [1, 11, -9], () => plain(FLEECE[0]));
  tail.set(0, 12, -9, plain(FLEECE[0]));
  step(tail, -1);

  // ---- Shorn (level 0): the skin, a smaller lobe.
  const sheared = new Grid(s);
  cube(sheared, [-3, 4, -7], [3, 12, 5], (x, y, z) => {
    const on = [Math.abs(x) === 3, y === 4 || y === 12, z === -7].filter(Boolean).length;
    return on >= 2 || taken(x, y, z) ? null : plain(SKIN[0]);
  });
  step(sheared, -1, (v) => v.y === 4); // the belly row
  hollow(sheared);

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, 9 + y, 13 + z, plain(EYE_WHITE));

  const parts = {
    wools, frosts, head: part(head, HEAD_PIVOT), hood: part(hood, HEAD_PIVOT), tail: part(tail, [CX, 12 * s, -8 * s]), eyes, lids, brows, mouths, ears, legs,
    collar: part(collar, [0, 0, 0]), bell: part(bell, [CX, 7 * s, 9 * s]), sheared: shellPart(sheared, [CX, 8 * s, 0]), breath: part(breath, [CX, 9.5 * s, 13.5 * s]),
    lobes, woolTones,
  };
  const voxels = wools[2].voxels + parts.head.voxels + parts.hood.voxels + parts.tail.voxels + eyes[0].voxels + eyes[1].voxels
    + ears[0].voxels + ears[1].voxels + legs.reduce((n, l) => n + l.voxels, 0);
  const model = { ...parts, voxels };
  cached.set(key, model);
  return model;
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
        slab.set(x, y, z, rim ? ladder('snow', 1) : ladder('ice', 0));
      }

  // Frosted base: a slightly inset layer of snow-white ice in the bottom three voxels, ragged on top.
  const base = new Grid(s);
  for (let x = lo[0] + 1; x <= hi[0] - 1; x++)
    for (let z = lo[2] + 1; z <= hi[2] - 1; z++) {
      const top = 2 + (hash3(x >> 1, 0, z >> 1, 85) < 0.35 ? 1 : 0);
      for (let y = 0; y <= top; y++) base.set(x, lo[1] + y, z, ladder('snow', 1));
    }

  // The front face is at z = (hi + 1) voxels; glints and cracks lie in the row of voxels just in front of it, on it
  // (file 03, 4.3: at (hi + 1.5) voxels they landed a row further out and hovered).
  const front = (hi[2] + 1) * s;
  const glints = new Grid(s);
  const glint = (x0: number, y0: number, len: number) => line(glints, [x0, y0, front], [x0 + len * 0.55, y0 + len, front], solid(lin(T.snow[0])));
  glint(-w / 2 + 0.1, h / 2 - 0.52, 0.36);
  glint(-w / 2 + 0.18, h / 2 - 0.5, 0.36);
  glint(-w / 2 + 0.3, h / 2 - 0.4, 0.18);

  // Two zigzag cracks (the classic comic crack), one each side of the face.
  const cracks = new Grid(s);
  // Drawn for the sheep's block (1.1 x 1.2) and stretched with the block, so another animal's fitted block has them in
  // the same corners (file 03, 4.2); on the sheep's own block they are where they always were.
  const kx = w / 1.1, ky = h / 1.2;
  const crack = (pts: number[]) => {
    for (let i = 0; i + 3 < pts.length; i += 2) line(cracks, [pts[i] * kx, pts[i + 1] * ky, front], [pts[i + 2] * kx, pts[i + 3] * ky, front], solid(lin(ICE_CRACK)));
  };
  // Short and near the corners, so they never cross the sheep.
  crack([-0.5, -0.2, -0.42, -0.3, -0.47, -0.38, -0.4, -0.5]);
  crack([0.5, 0.46, 0.43, 0.38, 0.47, 0.3, 0.42, 0.22]);
  // Where a crack runs out over the chamfered edge there is no ice behind it to lie on: those cells are left out.
  for (const g of [glints, cracks]) for (const [k, v] of [...g.map]) if (!slab.has(v.x, v.y, v.z - 1)) g.map.delete(k);

  // Icicles hang from just under the chamfered front top edge; snow lies on top in drifts with bare ice between.
  const ic = new Grid(s);
  const r = rng(61);
  const edgeY = (hi[1] + 1 - CH) * s, edgeZ = (hi[2] + 1) * s - s;
  for (let k = 0; k < 9; k++) {
    const x = -w / 2 + 0.1 + (k / 8) * (w - 0.2);
    const len = 0.08 + r() * 0.14;
    cone(ic, [x, edgeY, edgeZ], 0.035, len, -1, () => ladder('ice', 1));
  }
  const cap = new Grid(s);
  const top = hi[1] + 1;
  for (let x = lo[0]; x <= hi[0]; x++)
    for (let z = lo[2]; z <= hi[2]; z++) {
      const patch = hash3(x >> 2, 0, z >> 2, 65) < 0.42;
      if (!patch) continue;
      const inner = hash3((x >> 2) + 1, 0, z >> 2, 65) < 0.42 || hash3(x >> 2, 0, (z >> 2) + 1, 65) < 0.42;
      if (hash3(x, 1, z, 67) < (inner ? 0.12 : 0.3)) continue; // ragged edges
      if (!slab.has(x, hi[1], z)) continue; // snow lies only on ice: none over the chamfered rim
      cap.set(x, top, z, ladder('snow', 1));
      if (inner && hash3(x, 3, z, 71) < 0.08) cap.set(x, top + 1, z, ladder('snow', 1));
    }

  // Shards: three rough chunks, reused at different sizes and turns.
  const shards = [0.13, 0.1, 0.16].map((rad, i) => {
    const g = new Grid(s);
    ellipsoid(g, [0, 0, 0], [rad, rad * 0.8, rad * 0.6], () => ladder('ice', 0), 0.35, 91 + i);
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
  ellipsoid(g, [0, 0, 0], [0.09, 0.07, 0.09], () => plain(CREAM[0]), 0.2, seed); // one colour a curl
  return buildGeometry(g.map, CHAR);
}
