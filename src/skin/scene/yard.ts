import { BufferGeometry, Float32BufferAttribute } from 'three';
import { buildGeometry, packGeometry, triangles } from '../voxel/mesher';
import { structureSteps } from '../voxel/refine';
import { each, finish } from './slices';
import type { Steps } from './slices';
import type { Voxel, VoxelMap } from '../voxel/mesher';
import { blanket, SNOW, snowPaint } from '../voxel/snow';
import { noteShade } from '../voxel/groundShade';
import { byPart, paint, solid, SOLID_SNOW } from '../voxel/paint';
import { course, patches } from '../voxel/texture';
import { pinePaint, tieredPine } from './style/pine';
import { box, ellipsoid, Grid, line, ring, rng } from '../voxel/primitives';
import type { Paint, V3 } from '../voxel/primitives';
import { noteStructure, underMicro } from './farmMicro';
import { BARN, YARD } from './layout';

/** The yard is built on the 0.20 m grid (plan V3 Part 4.1, 7.2). */
const S = 0.2;
const CHUNK = 8;
const ix = (m: number) => Math.round(m / S);
/**
 * Snow (docs/miniature/03, section 3): the open ground one white, a cap a step over it, packed snow a step under, a
 * rut two under. With `SOLID_SNOW` off the ground and the caps take the painted texture they had.
 */
const groundSnow: Paint = SOLID_SNOW ? paint('snow', 0) : snowPaint(S, 2);
const snow: Paint = SOLID_SNOW ? paint('snow', 1) : snowPaint(S, 3);
const CAP_SNOW = SOLID_SNOW ? solid('snow', 1) : SNOW;

/** A chunk's own voxels, but face culling and AO look at the whole yard so chunk borders stay seamless. */
export class ChunkMap extends Map<string, Voxel> {
  constructor(readonly all: VoxelMap) {
    super();
  }
  override has(k: string) {
    return this.all.has(k);
  }
}

const HALF = YARD.path.halfWidth, FENCE = YARD.fence, HOME = YARD.farmhouse;
/** The porch's front edge, and where the lane's surface starts breaking up into the open snow on its way to the road. */
const PORCH_X = HOME.x + HOME.halfX + HOME.porch, LANE_FADE = 39;
/**
 * Footpaths, each worn straight from one door to the next ([x0, z0, x1, z1]): the porch steps to the court's gate, the
 * barn's doors to the hens' gate.
 */
const WALKS = [[PORCH_X + 0.5, HOME.z, -HALF, FENCE.z + 2.4], [-HALF, 10.6, FENCE.minX, 10.6]] as const;
export const onWalk = (x: number, z: number) => WALKS.some(([x0, z0, x1, z1]) => {
  const dx = x1 - x0, dz = z1 - z0, t = Math.min(1, Math.max(0, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < 0.45;
});
/** The lane, the trampled apron before the barn's doors, and the footpaths: everywhere the snow is packed. */
const onPath = (x: number, z: number) => (z >= YARD.path.fromZ && Math.abs(x) <= HALF && (z < LANE_FADE || patches(x, z, 1.8, 9) > (z - LANE_FADE) / 7))
  || (z >= YARD.path.fromZ && (x / 4.4) ** 2 + ((z - YARD.path.fromZ) / 3.2) ** 2 < 1) || onWalk(x, z);
const inBarn = (x: number, z: number) => x >= BARN.minX && x <= BARN.maxX && z >= BARN.minZ && z <= BARN.maxZ;
/**
 * How far out from the pond's middle a point lies: under 1 is the pond. The shore is a smooth, uneven line (two slow
 * waves round an oval), as a farm pond's is, never an ellipse.
 */
export const pondD = (x: number, z: number) => {
  const dx = (x - YARD.pond.x) / YARD.pond.rx, dz = (z - YARD.pond.z) / YARD.pond.rz, a = Math.atan2(dz, dx);
  return (dx * dx + dz * dz) / (1 + 0.15 * Math.sin(2 * a + 0.6) + 0.1 * Math.sin(3 * a + 2.1)) ** 2;
};

export interface Yard {
  chunks: BufferGeometry[];
  /** For each chunk, whether it can cast a shadow at all (see `castsShadow`). */
  casts: boolean[];
  snowman: BufferGeometry;
  /** The farmhouse's window panes: their own mesh, which `Farm` draws lit from inside. */
  panes: BufferGeometry;
  smokeFrom: [number, number, number]; triangles: number;
}

/** The yard, built in steps (scene/slices.ts). */
/**
 * The yard's small props a micro object keeps 0.4 m from (docs/miniature/05, section 7, rule 7), each
 * [name, minX, maxX, minZ, maxZ] in metres: the same cells `snowman`, `sled`, `feeder` and the mailbox in `fence` fill.
 */
export function yardProps(): [string, number, number, number, number][] {
  const m = YARD.snowman, r = 0.78 * m.scale, sx = ix(PORCH_X + 0.5), sz = ix(HOME.z + 1.8), fx = ix(PORCH_X + 3.2), fz = ix(HOME.z - 3.6), mx = ix(2.6), mz = ix(FENCE.laneTo) + 5;
  return [
    ['snowman', m.x - r, m.x + r, m.z - r, m.z + r],
    ['sled', sx * S, (sx + 3) * S, (sz - 2) * S, (sz + 7) * S],
    ['bird feeder', (fx - 2) * S, (fx + 3) * S, (fz - 1) * S, (fz + 2) * S],
    ['mailbox', (mx - 1) * S, (mx + 3) * S, (mz - 3) * S, (mz + 2) * S],
  ];
}

export function buildYard(): Yard {
  return finish(buildYardSteps());
}

/** What the yard's builders draw with, on a grid. */
function toolsFor(g: Grid) {
  const set: Set = (x, y, z, p) => {
    const c = p(x, y, z);
    if (c) g.set(x, y, z, c);
  };
  const boxI: BoxI = (x0, x1, y0, y1, z0, z1, p) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, p);
  };
  /** Snow on the upper face of a voxel, only where nothing sits there already. */
  const capAt: Cap = (x, y, z) => {
    if (!g.has(x, y + 1, z)) set(x, y + 1, z, snow);
  };
  return { set, boxI, capAt };
}

/**
 * One of the yard's models alone, as cubes, for the review page (`?preview=mini`; docs/miniature/04, section 7).
 * Development only: the game never calls it. The gate and a run of fence are cut out of the whole fence.
 */
export function yardPiece(name: string): { vox: VoxelMap; size: number; plain?: boolean; glow?: boolean }[] | null {
  const g = new Grid(S), { set, boxI, capAt } = toolsFor(g);
  if (name === 'snowman') return [{ vox: snowmanGrid().map, size: S / 2, plain: true }];
  if (name === 'pine') { pine(g, set, 0, 0, 1, 7.8); return [{ vox: g.map, size: S }]; }
  if (name === 'farmhouse') {
    const panes = new Grid(S), caps = new Grid(S);
    farmhouse(g, panes, caps, set, boxI, capAt);
    return [{ vox: g.map, size: S }, { vox: caps.map, size: S, plain: true }, { vox: panes.map, size: S, glow: true }];
  }
  if (name === 'fence' || name === 'gate') {
    fence(g, set, boxI, capAt);
    const [x0, x1, z0, z1] = name === 'gate' ? [-2.4, 2.4, FENCE.z - 0.2, FENCE.z + 3.4] : [3.6, 9.8, FENCE.z - 0.2, FENCE.z + 0.4];
    for (const [k, v] of g.map) { const x = (v.x + 0.5) * S, z = (v.z + 0.5) * S; if (x < x0 || x > x1 || z < z0 || z > z1) g.map.delete(k); }
    return [{ vox: g.map, size: S }];
  }
  return null;
}

export function* buildYardSteps(): Steps<Yard> {
  const g = new Grid(S), { set, boxI, capAt } = toolsFor(g);

  const caps = new Grid(S); // the roofs' snow and the pond's bank: their own mesh with no corner shading, as the snowman is
  ground(caps, set);
  yield;
  fence(g, set, boxI, capAt);
  yield;
  YARD.pines.forEach(([x, z, h], i) => pine(g, set, x, z, i + 1, h));
  yield;
  sled(set, boxI, capAt);
  feeder(set, boxI, capAt);
  trough(boxI);
  baleStack(boxI, capAt);
  const panes = new Grid(S);
  const smokeFrom = farmhouse(g, panes, caps, set, boxI, capAt);
  yield;

  // Split into 8 m chunks in x/z; each chunk's faces still cull against its neighbours. The ground stays as it is, and
  // everything standing on it is refined to the barn's 0.1 m, so the yard and the barn read as one place.
  function* inChunks(map: VoxelMap, size: number, keep: (v: Voxel) => boolean, drop: (ny: number, y: number) => boolean) {
    const chunks = new Map<string, ChunkMap>();
    for (const [k, v] of map) {
      if (!keep(v)) continue;
      const ck = `${Math.floor((v.x * size) / CHUNK)},${Math.floor((v.z * size) / CHUNK)}`;
      let m = chunks.get(ck);
      if (!m) chunks.set(ck, (m = new ChunkMap(map)));
      Map.prototype.set.call(m, k, v);
    }
    return yield* each([...chunks.values()], (m) => dropFaces(buildGeometry(m, size), drop));
  }
  const standing = (v: Voxel) => v.y >= 0;
  const fine = yield* structureSteps(g.map, S, standing);
  yield;
  const man = snowmanGrid();
  // What stands in the yard, for the micro layer (what its objects stand against) and the ground's shade map.
  noteStructure(g.map.values(), S, standing);
  noteShade(g.map.values(), S, 0, standing);
  noteShade(man.map.values(), S / 2);
  const geos = [
    ...(yield* inChunks(g.map, S, (v) => !standing(v), (ny, y) => ny < 0 && y < 0)),
    ...(yield* inChunks(fine.map, fine.size, () => true, (ny, y) => ny < 0 && y <= 0)),
  ];
  // The snowman is its own mesh with no corner shading: on a white ball the corner shading of every little step stacks
  // into dark stripes. It takes light and shadow like the snow around it, so it never looks glazed or out of place.
  const man2 = buildGeometry(man.map, S / 2, { ao: false });
  const glass = buildGeometry(panes.map, S, { ao: false });
  geos.push(plain(buildGeometry(caps.map, S, { ao: false })));
  for (const g of [...geos, man2, glass]) packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
  return { chunks: geos, casts: geos.map(castsShadow), snowman: man2, panes: glass, smokeFrom, triangles: [...geos, man2, glass].reduce((s, x) => s + triangles(x), 0) };
}

/**
 * Whether a mesh can cast a shadow. The shadow pass draws only the faces turned away from the light, and every light
 * that casts is above the ground, so a mesh whose every face looks straight up (a flat piece of the yard's ground,
 * with its undersides dropped) draws nothing into any shadow map: asking it to cast only costs its triangles again,
 * every frame. A piece with a footprint, a track or an edge in it has faces that look sideways, and still casts.
 */
export function castsShadow(g: BufferGeometry): boolean {
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0.5) return true;
  return false;
}

/** A mesh with no rounding at its edges (voxel/rounded.ts): with the corner shading off too, a stepped blanket of snow is one white. */
export const plain = (g: BufferGeometry) => (g.deleteAttribute('bevel'), g);

type Set = (x: number, y: number, z: number, p: Paint) => void;
type BoxI = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) => void;
type Cap = (x: number, y: number, z: number) => void;

function ground(caps: Grid, set: Set) {
  // Packed snow a step under the yard's, the lane's two wheel ruts a step under that; the pond's ice one colour.
  const packed = paint('snow', -1), rutted = paint('snow', -2), ice = paint('ice', 0);
  for (let xi = ix(YARD.minX); xi < ix(YARD.maxX); xi++)
    for (let zi = ix(-7); zi < ix(YARD.maxZ); zi++) {
      const x = (xi + 0.5) * S, z = (zi + 0.5) * S;
      if (inBarn(x, z)) continue; // the barn floor covers this
      // Never visible: beside the barn (hidden by its side walls) and the far front corners below the frame.
      if (z < BARN.maxZ && z > BARN.minZ && Math.abs(x) > BARN.maxX + 1) continue;
      if (z < BARN.minZ && Math.abs(x) > 14) continue;
      const pd = pondD(x, z);
      if (pd < 1) {
        // Wind keeps the middle and the west of the ice bare; snow lies on it toward the sheltered east shore.
        const cover = patches(x, z, 2.6, 31) * 0.55 + pd * 0.45 + ((x - YARD.pond.x) / YARD.pond.rx) * 0.22;
        set(xi, -1, zi, cover > 0.74 ? groundSnow : ice);
        continue;
      }
      const path = onPath(x, z);
      const rut = path && z < LANE_FADE && z > BARN.maxZ + 3 && Math.abs(Math.abs(x) - 0.8) < 0.2;
      // Snow in soft drifts (voxel/snow.ts), never the square patches it used to have.
      set(xi, -1, zi, rut ? rutted : path ? packed : groundSnow);
      if (path) continue;
      // Round the pond, a whole raised rim of snow with a clean outline (docs/miniature/03, 3.1), a second step on the
      // sheltered east shore. It goes with the roofs' snow, in the mesh with no corner shading.
      if (underMicro(x, z)) continue; // a micro object stands on the flat ground, never in a drift
      if (pd < 1.18) caps.set(xi, 0, zi, CAP_SNOW);
      if (pd < 1.08 && x > YARD.pond.x + 1) caps.set(xi, 1, zi, CAP_SNOW);
    }
  // No hoof dents or sled ruts in the path: square holes in the ground read as a fault (Brian, 2026-11-19).
}

function fence(g: Grid, set: Set, boxI: BoxI, cap: Cap) {
  // Posts a step under the lower rail, the upper rail a step over it (docs/miniature/03, 7.2).
  const post = paint('wood', -1), rail = paint('wood', 0), upper = paint('wood', 1);
  const F = YARD.fence;
  const zf = ix(F.z); // the rails' row of cells; the gate posts stand on zf and zf + 1
  const gate = ix(F.gateHalfWidth + 0.2); // gate posts at x = ±(1.6..2.0)
  /**
   * A run of rail fence from one cell to another, in the make of the pens' fences (`fenceRun` in farmstead.ts): two
   * rails with an even line of snow on the upper, a post every 2 m counted back from where it ends, a cap of snow on each.
   */
  const run = (x0: number, z0: number, x1: number, z1: number, endPost = true) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)), sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    for (let i = 0; i <= n; i++) {
      const x = x0 + sx * i, z = z0 + sz * i;
      set(x, 2, z, rail), set(x, 4, z, upper);
      cap(x, 4, z);
      if ((n - i) % 10 === 0 && (i > 3 || n < 4) && (endPost || i < n)) {
        boxI(x, x, 0, 5, z, z, post);
        cap(x, 5, z);
      }
    }
  };
  // West from the gate to the hens' run, whose corner post it ends at; east from it, and back to the paddock's corner;
  // and the lane's fence, south from the gate along the pasture's side.
  run(-gate - 1, zf, ix(F.minX) + 1, zf, false);
  run(gate, zf, ix(F.maxX), zf);
  run(ix(F.maxX), zf - 1, ix(F.maxX), ix(F.sideTo), false);
  run(gate - 1, zf + 2, gate - 1, ix(F.laneTo));
  // Gate posts (taller), the gate leaf swung open into the yard, hinges, latch.
  const lp = -gate, rp = gate - 2;
  boxI(lp, lp + 1, 0, 7, zf, zf + 1, post);
  boxI(rp, rp + 1, 0, 7, zf, zf + 1, post);
  for (let dz = 0; dz < 2; dz++) cap(lp, 7, zf + dz), cap(lp + 1, 7, zf + dz);
  const leafX = lp + 2, len = ix(YARD.fence.gateHalfWidth * 2 - 0.4);
  for (let dz = 0; dz < len; dz++) {
    // The leaf's uprights and brace first, a step under its rails, which are laid over them.
    if (dz === 0 || dz === len - 1 || dz === len >> 1) boxI(leafX, leafX, 1, 5, zf + 1 + dz, zf + 1 + dz, post);
  }
  line(g, [(leafX + 0.5) * S, 2.5 * S, (zf + 1.5) * S], [(leafX + 0.5) * S, 4.5 * S, (zf + len - 0.5) * S], post);
  for (let dz = 0; dz < len; dz++) {
    set(leafX, 2, zf + 1 + dz, rail), set(leafX, 4, zf + 1 + dz, rail);
    cap(leafX, 4, zf + 1 + dz);
  }
  // The hinge and latch cubes are the wood they sit in; the fittings themselves are the micro layer's (docs/miniature/04).
  for (const y of [2, 4]) set(leafX, y, zf, rail);
  set(rp - 1, 4, zf + 1, rail);
  set(rp - 1, 4, zf, rail);
  // A small lantern on the right gate post: iron base, glow in two steps, iron hood, a pinch of snow.
  const dark = paint('iron', 0);
  boxI(rp, rp + 1, 8, 8, zf, zf + 1, dark);
  boxI(rp, rp + 1, 9, 9, zf, zf + 1, paint('brass', 0));
  boxI(rp, rp + 1, 10, 10, zf, zf + 1, paint('brass', 1));
  boxI(rp, rp + 1, 11, 11, zf, zf + 1, dark);
  set(rp, 12, zf, dark);
  cap(rp, 12, zf);
  // The mailbox where the lane's fence ends, by the lane's edge: post, grey box, red flag, snow on top.
  const mx = ix(2.6), mz = ix(F.laneTo) + 5;
  boxI(mx, mx, 0, 4, mz, mz, post);
  boxI(mx - 1, mx + 1, 5, 6, mz - 2, mz + 1, paint('stone', 0));
  set(mx, 5, mz - 3, paint('stone', -1));
  boxI(mx + 2, mx + 2, 6, 7, mz, mz, paint('scarfRed', 0));
  for (let x = mx - 1; x <= mx + 1; x++) for (let z = mz - 2; z <= mz + 1; z++) cap(x, 6, z);
}

/** A yard pine: the diorama's tiered pine (style/pine.ts), 5 to 9 m tall unless `height` says. */
export function pine(g: Grid, set: Set, wx: number, wz: number, seed: number, height?: number) {
  const r = rng(seed * 97);
  const drawn = 5 + r() * 4;
  tieredPine((x, y, z, c) => set(x, y, z, () => c), (x, y, z) => g.has(x, y, z), ix(wx), ix(wz), 0, height ?? drawn, S, 6, pinePaint(seed));
}


/**
 * The snowman, on its own 0.1 m grid: three round balls, a face turned toward the start screen's camera, a scarf knotted
 * at the neck with its tail hanging over the chest, stick arms and coal buttons. Everything is placed in metres off the
 * ball it sits on, so it stays on the surface.
 */
function snowman(g: Grid) {
  // Everything in metres is `k` of the first snowman's, which stood 2.96 m to the crown over a 1.5 m hero; the
  // features (eyes, buttons, carrot, scarf and stick thickness) keep their cell sizes so they still read.
  const { x, z, scale: k } = YARD.snowman;
  const balls = [{ y: 0.72 * k, r: 0.78 * k }, { y: 1.74 * k, r: 0.56 * k }, { y: 2.56 * k, r: 0.42 * k }];
  // The bottom ball the ground's white, the two above it a step lighter.
  balls.forEach((b, i) => ellipsoid(g, [x, b.y, z], [b.r, b.r * 0.96, b.r], paint('snow', i ? 1 : 0)));
  // Facing: toward the home camera, which looks at the yard from the -x, +z side.
  const fx = -0.82, fz = 0.58, sx = -fz, sz = fx;
  const radiusAt = (b: { y: number; r: number }, y: number) => b.r * Math.sqrt(Math.max(0, 1 - ((y - b.y) / (b.r * 0.96)) ** 2));
  const coal = paint('iron', -1);
  const dot = (y: number, b: { y: number; r: number }, side: number, out = 0.05) => {
    const r = radiusAt(b, y) + out;
    const px = x + fx * r + sx * side, pz = z + fz * r + sz * side;
    box(g, [px - 0.05, y - 0.05, pz - 0.05], [px + 0.05, y + 0.05, pz + 0.05], coal);
  };
  const head = balls[2], body = balls[1];
  for (const side of [-0.13, 0.13]) dot(2.64 * k, head, side * 0.85 * k, 0.0);
  line(g, [x + fx * 0.4 * k, 2.54 * k, z + fz * 0.4 * k], [x + fx * 0.68 * k, 2.5 * k, z + fz * 0.68 * k], paint('carrot', 0));
  for (const y of [1.48, 1.74, 2.0]) dot(y * k, body, 0, 0.0);
  // The scarf: a snug band where head meets body, and a tail hanging down over the chest.
  const red = paint('scarfRed', 0), hanging = paint('scarfRed', -1);
  const neck = 2.2 * k;
  for (const [y, r] of [[neck - 0.05, 0.36 * k], [neck + 0.05, 0.33 * k]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  for (const [y, r] of [[neck - 0.05, 0.3 * k], [neck + 0.05, 0.28 * k]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  const tail = (t: number): V3 => [x + fx * (0.36 + t * 0.2) * k + sx * 0.14 * k, neck - 0.05 - t * 0.5 * k, z + fz * (0.36 + t * 0.2) * k + sz * 0.14 * k];
  line(g, tail(0), tail(1), hanging);
  line(g, [tail(0)[0] + sx * 0.1, tail(0)[1], tail(0)[2] + sz * 0.1], [tail(1)[0] + sx * 0.1, tail(1)[1], tail(1)[2] + sz * 0.1], hanging);
  // Stick arms out of the sides of the body, one raised, with a twig each.
  const stick = paint('darkWood', 0);
  for (const [side, rise] of [[1, 0.45], [-1, 0.15]] as const) {
    const from: V3 = [x + sx * side * 0.5 * k, 1.86 * k, z + sz * side * 0.5 * k];
    const to: V3 = [x + sx * side * 1.25 * k, (1.86 + rise) * k, z + sz * side * 1.25 * k];
    // Joined (one axis at a time): at this size a diagonal step left the lower arm touching its body at a corner only.
    line(g, from, to, stick, true);
    line(g, [(from[0] + to[0] * 2) / 3, (from[1] + to[1] * 2) / 3, (from[2] + to[2] * 2) / 3], [to[0] + sx * side * 0.05 * k, to[1] + 0.3 * k, to[2] + sz * side * 0.05 * k], stick, true);
  }
}

/** The snowman alone, on its own 0.1 m grid, as the yard draws it (the scale chart measures this). */
export function snowmanGrid(): Grid {
  const g = new Grid(S / 2);
  snowman(g);
  return g;
}

function sled(set: Set, boxI: BoxI, cap: Cap) {
  // Left by the porch steps.
  const x0 = ix(PORCH_X + 0.5), z0 = ix(HOME.z + 1.8), len = 7;
  const runner = paint('iron', 1);
  const board = byPart('scarfRed', [0, -1, 0], (x) => x - x0); // three boards along z
  for (const x of [x0, x0 + 2]) {
    boxI(x, x, 0, 0, z0, z0 + len - 1, runner);
    set(x, 1, z0 - 1, runner);
    set(x, 2, z0 - 1, runner);
  }
  boxI(x0, x0 + 2, 1, 1, z0, z0 + len - 1, board);
  for (let z = z0 + 2; z < z0 + len - 1; z++) cap(x0 + 1, 1, z);
  set(x0 + 1, 2, z0 - 2, paint('straw', -2)); // tow rope knot
}

function feeder(set: Set, boxI: BoxI, cap: Cap) {
  // In the farmhouse's garden, where it is watched from the porch.
  const fx = ix(PORCH_X + 3.2), fz = ix(HOME.z - 3.6);
  const post = paint('wood', -1);
  boxI(fx, fx, 0, 6, fz, fz, post);
  boxI(fx - 1, fx + 1, 7, 7, fz - 1, fz + 1, paint('wood', 0));
  set(fx - 1, 8, fz - 1, post), set(fx + 1, 8, fz + 1, post);
  set(fx, 8, fz, paint('hay', 0));
  set(fx + 1, 8, fz - 1, paint('hay', 0));
  boxI(fx - 2, fx + 2, 9, 9, fz - 1, fz + 1, paint('roofBrown', 0));
  boxI(fx - 1, fx + 1, 10, 10, fz - 1, fz + 1, paint('roofBrown', 1));
  for (let x = fx - 2; x <= fx + 2; x++) for (let z = fz - 1; z <= fz + 1; z++) cap(x, Math.abs(x - fx) <= 1 ? 10 : 9, z);
}

/**
 * Square bales stacked against the barn's wall beside its doors, as in Brian's farm picture: three in a row at the wall
 * and two in front of them, two across those, one on top. Each bale is one step of hay, no two that touch alike but
 * the pair one lies across, with its two twine bands two steps under hay. Snow only on what the gable's overhang does not shelter.
 */
const BALE_STEPS = [0, 1, 0, 1, 0, -1, 0, 1] as const;
function baleStack(boxI: BoxI, cap: Cap) {
  const x0 = ix(3.2), z0 = ix(BARN.maxZ + 0.4), L = 5, W = 3, H = 3; // a bale: 1.0 x 0.6 x 0.6 m, its length along x
  const bale = (bx: number, by: number, bz: number, n: number) => {
    const straw = solid('hay', BALE_STEPS[n]), twine = solid('hay', -2);
    boxI(bx, bx + L - 1, by, by + H - 1, bz, bz + W - 1, (x) => (x === bx + 1 || x === bx + L - 2 ? twine : straw));
    for (let x = bx; x < bx + L; x++) for (let z = Math.max(bz, z0 + 2); z < bz + W; z++) cap(x, by + H - 1, z); // a bale set on top takes its place
  };
  for (let i = 0; i < 3; i++) bale(x0 + i * L, 0, z0, i);
  for (let i = 0; i < 2; i++) bale(x0 + i * L, 0, z0 + W, 3 + i);
  bale(x0, H, z0 + 1, 5), bale(x0 + L, H, z0 + 1, 6);
  bale(x0 + 2, H * 2, z0 + 1, 7);
}

function trough(boxI: BoxI) {
  // The pasture's water trough, against the court's fence, frozen over.
  const x0 = ix(5.8), x1 = ix(7.6) - 1, z0 = ix(FENCE.z + 0.6), z1 = z0 + 3;
  const wood = paint('wood', 0);
  boxI(x0, x1, 0, 0, z0, z1, paint('wood', -1));
  boxI(x0, x1, 1, 2, z0, z0, wood), boxI(x0, x1, 1, 2, z1, z1, wood);
  boxI(x0, x0, 1, 2, z0, z1, wood), boxI(x1, x1, 1, 2, z0, z1, wood);
  boxI(x0 + 1, x1 - 1, 1, 1, z0 + 1, z1 - 1, paint('ice', 0));
  boxI(x0, x1, 3, 3, z1, z1, snow);
}

/**
 * The farmhouse's paint (Brian's farm picture, docs/diorama/reference/farm-34.png, in the ladders of voxel/paint.ts):
 * cream clapboards two rows deep and a step apart, the two rows under the roof a step darker (the eave's shade), dark
 * timber at the corners and round every opening, panes lit from inside in one colour.
 */

/**
 * The farmhouse, a storey and a half, its ridge along z: a stone footing, clapboard walls with timber corners, five bays
 * to the front (a door between two pairs of tall windows) under a porch that faces the lane and the court, a kitchen
 * door and the woodshed on the gable end nearest the barn, a shingled roof at about nine in twelve, a stone chimney
 * through the ridge. Its snow is as a heated house's is: thinner on the windward (west) slope, a bare ring melted round
 * the chimney, none under the eaves. Returns the chimney top (smoke origin).
 */
function farmhouse(g: Grid, panes: Grid, caps: Grid, set: Set, boxI: BoxI, cap: Cap): [number, number, number] {
  const X0 = ix(HOME.x - HOME.halfX), X1 = ix(HOME.x + HOME.halfX) - 1, Z0 = ix(HOME.z - HOME.halfZ), Z1 = ix(HOME.z + HOME.halfZ) - 1;
  const WH = 17, xc = (X0 + X1 + 1) / 2, half = (X1 - X0 + 1) / 2, zm = Math.round((Z0 + Z1) / 2);
  const timber = paint('darkWood', 0), TIMBER = solid('darkWood', 0);
  const roofY = (x: number) => WH + Math.floor((half - Math.abs(x + 0.5 - xc)) * 0.875);
  const wall: Paint = (x, y, z) => (y < 2 ? solid('stone', 0)
    : solid('houseCream', ((y >> 1) & 1) - (y >= (z === Z0 || z === Z1 ? Math.max(WH, roofY(x)) : WH) - 2 ? 1 : 0)));
  // Courses two rows deep down the slope, a step apart, with staggered seams a step under the darker course.
  const shingle = (along: number, d: number): Paint => () => solid('roofBrown', (along + ((d >> 1) % 2) * 2) % 4 === 0 ? -1 : (d >> 1) % 2 ? 0 : 1);
  const snowOn = (tops: [number, number, number][], thick: number | ((x: number) => number)) =>
    blanket(tops, (x, y, z) => { if (!g.has(x, y, z)) caps.set(x, y, z, CAP_SNOW); }, thick);
  // Walls (one voxel shell) and the gable ends.
  for (let x = X0; x <= X1; x++)
    for (let z = Z0; z <= Z1; z++) {
      const edgeX = x === X0 || x === X1, edgeZ = z === Z0 || z === Z1;
      if (!edgeX && !edgeZ) continue;
      for (let y = 0; y < (edgeZ ? roofY(x) : WH); y++) set(x, y, z, wall);
    }
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) boxI(x, x, 2, WH - 1, z, z, timber);
  /**
   * A lit window in a wall: a timber frame and cross, warm panes (brighter at the top), a timber sill.
   * `at(i, j, out)` gives the cell `i` along the wall, `j` up and `out` cells proud of it.
   */
  const lit = (at: (i: number, j: number, out: number) => [number, number, number], w: number, h: number) => {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < h; j++) {
        const frame = i === 0 || i === w - 1 || j === 0 || j === h - 1 || (w > 4 && i === w >> 1) || (h > 4 && j === h >> 1);
        const [x, y, z] = at(i, j, 0);
        if (frame) { g.set(x, y, z, TIMBER); continue; }
        // A pane is taken out of the wall and set in the panes' own grid, which is drawn glowing.
        g.del(x, y, z);
        panes.set(x, y, z, solid('brass', 1));
      }
    for (let i = -1; i <= w; i++) set(...at(i, -1, 1), paint('darkWood', -1)); // the sill
  };
  /** A plank door in a timber frame: `at` as for `lit`, two planks wide. Its knob is the micro layer's (docs/miniature/04). */
  const door = (at: (i: number, j: number, out: number) => [number, number, number]) => {
    for (let i = -1; i <= 4; i++) for (let j = 0; j <= 11; j++) g.set(...at(i, j, 0), i < 0 || i > 3 || j > 10 ? TIMBER : solid('roofBrown', (i >> 1) & 1 ? -1 : 0));
  };
  const wy = 5;
  for (const off of [4, 13, 28, 37]) {
    lit((i, j, out) => [X1 + out, wy + j, Z0 + off + i], 5, 9); // the front, two each side of the door
    lit((i, j, out) => [X0 - out, wy + j, Z0 + off + i], 5, 9); // the back
  }
  const gx = Math.round(xc) - 2;
  lit((i, j, out) => [gx + i, wy + j, Z1 + out], 5, 9); // the gable end toward the road
  for (const [z, out] of [[Z0, -1], [Z1, 1]] as const) lit((i, j, o) => [gx + 1 + i, 23 + j, z + out * o], 3, 5); // each loft window
  door((i, j, out) => [X1 + out, 2 + j, zm - 2 + i]);
  door((i, j, out) => [gx + 8 + i, 2 + j, Z0 - out]); // the kitchen door, toward the court
  const flag: Paint = (x, y, z) => solid('stone', course(x, z, 4, 3, 2, 104 + y)); // each flagstone its own step
  boxI(gx + 6, gx + 13, 0, 1, Z0 - 4, Z0 - 1, flag);
  boxI(gx + 7, gx + 12, 0, 0, Z0 - 6, Z0 - 5, flag);
  // The chimney, built before the roof's snow so the snow leaves it standing clear: stone with mortar courses, a wider crown.
  const cz = Z0 + 13, top = roofY(xc) + 6;
  for (let y = WH; y <= top; y++) boxI(xc - 2, xc + 1, y, y, cz - 2, cz + 1, (_a, b) => solid('stone', b % 3 === 0 ? 1 : 0));
  for (let dx = -3; dx <= 2; dx++)
    for (let dz = -3; dz <= 2; dz++)
      if (dx === -3 || dx === 2 || dz === -3 || dz === 2) {
        set(xc + dx, top, cz + dz, paint('stone', -1));
        cap(xc + dx, top, cz + dz);
      }
  // The roof: shingle courses down the slope with staggered seams, a two-voxel overhang.
  const roof: [number, number, number][] = [];
  for (let x = X0 - 2; x <= X1 + 2; x++)
    for (let z = Z0 - 2; z <= Z1 + 2; z++) {
      const y = roofY(x);
      set(x, y, z, shingle(z, Math.floor(Math.abs(x + 0.5 - xc))));
      if (Math.max(Math.abs(x + 0.5 - xc), Math.abs(z + 0.5 - cz)) > 3.6) roof.push([x, y, z]); // melted bare round the chimney
    }
  snowOn(roof, (x) => (x < xc ? 1 : 2));
  // The porch along the front: a plank deck on the footing's level, four posts and a beam, a shingled roof tucked under
  // the eave, two steps down to the path.
  const PX = X1 + 8, pz0 = Z0 + 2, pz1 = Z1 - 2, plank = byPart('wood', [0, 1], (_x, _y, z) => z >> 1); // deck boards two cubes wide
  boxI(X1 + 1, PX, 0, 1, pz0, pz1, plank);
  boxI(PX + 1, PX + 2, 0, 0, zm - 3, zm + 4, plank);
  boxI(PX, PX, 11, 11, pz0, pz1, timber);
  for (const z of [pz0, pz0 + 14, pz1 - 14, pz1]) boxI(PX, PX, 2, 11, z, z, paint('darkWood', -1));
  const lean: [number, number, number][] = [];
  for (let x = X1 + 1; x <= PX + 2; x++)
    for (let z = pz0 - 2; z <= pz1 + 2; z++) {
      const y = 14 - Math.round(((x - X1 - 1) * 2) / 9);
      set(x, y, z, shingle(z, x - X1));
      if (x > X1 + 2) lean.push([x, y, z]); // none under the eave
    }
  snowOn(lean, 2);
  // The woodshed on the kitchen end: two tall posts at the wall, two short ones out front, a sloped plank roof, and the
  // logs stacked under it with their cut ends toward the court.
  const x0 = X0 + 2, x1 = X0 + 16, zf = Z0 - 9, zb = Z0 - 1;
  const post = paint('wood', -1), shed: [number, number, number][] = [];
  for (const x of [x0, x1]) {
    boxI(x, x, 0, 8, zf, zf, post);
    boxI(x, x, 0, 10, zb, zb, post);
  }
  for (let z = zf - 1; z <= zb; z++) {
    const y = 9 + Math.round(((z - zf) / (zb - zf)) * 2);
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      set(x, y, z, (a) => solid('roofBrown', [0, -1][a & 1])); // alternate courses, a step apart
      shed.push([x, y, z]);
    }
  }
  snowOn(shed, 2);
  // Each log one bark, a step apart log to log; every cut end the same pale wood.
  const end = solid('wood', 2);
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < 6 - row; k++) {
      const lx = x0 + 1 + row + k * 2, ly = row * 2;
      if (lx + 1 >= x1) continue;
      boxI(lx, lx + 1, ly, ly + 1, zf + 1, zb - 1, paint('darkWood', (row + k) % 2 ? -1 : 0));
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) set(lx + dx, ly + dy, zf + 1, () => end);
    }
  return [xc * S, (top + 1) * S, cz * S];
}

/**
 * Drop whole voxel faces the fixed camera can never see (the mesher emits 4 vertices and 6 indices per face, in order).
 * drop(normalY, faceMinY) returning true removes the face. Used for the undersides of ground and terrain.
 */
export function dropFaces(g: BufferGeometry, drop: (ny: number, y: number) => boolean): BufferGeometry {
  const P = g.getAttribute('position').array, N = g.getAttribute('normal').array, C = g.getAttribute('color').array, I = g.index!.array;
  const B = g.getAttribute('bevel')?.array; // rounded corners (voxel/rounded.ts), when on
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [], bev: number[] = [];
  for (let f = 0; f < I.length / 6; f++) {
    const b = f * 4;
    const minY = Math.min(P[b * 3 + 1], P[b * 3 + 4], P[b * 3 + 7], P[b * 3 + 10]);
    if (drop(N[b * 3 + 1], minY)) continue;
    const nb = pos.length / 3;
    for (let k = 0; k < 12; k++) pos.push(P[b * 3 + k]), nor.push(N[b * 3 + k]), col.push(C[b * 3 + k]);
    if (B) for (let k = 0; k < 12; k++) bev.push(B[b * 3 + k]);
    for (let k = 0; k < 6; k++) idx.push(I[f * 6 + k] - b + nb);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  if (B) out.setAttribute('bevel', new Float32BufferAttribute(bev, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  g.dispose();
  return out;
}
