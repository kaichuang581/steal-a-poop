import { BufferGeometry, Float32BufferAttribute } from 'three';
import { buildGeometry, packGeometry, triangles } from '../voxel/mesher';
import { detailedSteps } from '../voxel/refine';
import { each, finish } from './slices';
import type { Steps } from './slices';
import type { Voxel, VoxelMap } from '../voxel/mesher';
import { lin, pick, pickBy, SCARF, T } from '../voxel/palette';
import { snowPaint } from '../voxel/snow';
import { banded, course, patches } from '../voxel/texture';
import { tieredPine } from './style/pine';
import type { Tone } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, line, ring, rng } from '../voxel/primitives';
import type { Paint, V3 } from '../voxel/primitives';
import { BARN, YARD } from './layout';

/** The yard is built on the 0.20 m grid (plan V3 Part 4.1, 7.2). */
const S = 0.2;
const CHUNK = 8;
const ix = (m: number) => Math.round(m / S);
const tone = (t: Tone, seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);
const snow = snowPaint(S, 3);
const groundSnow = snowPaint(S, 2);
const CARROT = '#E8873A';
const SKATE = '#EEF8FC';
/** The pale ends of split logs, a value step apart log to log. */
const CUT_ENDS = ['#D8B581', '#CBA672', '#BD9865'] as const;

/** A chunk's own voxels, but face culling and AO look at the whole yard so chunk borders stay seamless. */
export class ChunkMap extends Map<string, Voxel> {
  constructor(readonly all: VoxelMap) {
    super();
  }
  override has(k: string) {
    return this.all.has(k);
  }
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Path centre line: straight from the back door through the gate, then a bend to the farmhouse steps. */
const PATH_END = 25.6;
const pathX = (z: number) => YARD.farmhouse.x * smooth((z - YARD.fence.z) / 8);
const onPath = (x: number, z: number) => z >= YARD.path.fromZ && z <= PATH_END + 0.2 && Math.abs(x - pathX(z)) <= YARD.path.halfWidth;
const inBarn = (x: number, z: number) => x >= BARN.minX && x <= BARN.maxX && z >= BARN.minZ && z <= BARN.maxZ;
/**
 * The barn's walls stand on the 0.2 m just outside the floor (side walls at |x| 6.0 to 6.2, back wall at z 7.0 to 7.2).
 * Nothing in the yard may share those cells: a drift voxel inside a wall board puts two faces in one plane, and they
 * flicker against each other (z-fighting) as a crawling line along the foot of every wall.
 */
const underWalls = (x: number, z: number) => x >= BARN.minX - 0.2 && x <= BARN.maxX + 0.2 && z >= BARN.minZ && z <= BARN.maxZ + 0.2;
const pondD = (x: number, z: number) => ((x - YARD.pond.x) / YARD.pond.rx) ** 2 + ((z - YARD.pond.z) / YARD.pond.rz) ** 2;

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
export function buildYard(): Yard {
  return finish(buildYardSteps());
}

export function* buildYardSteps(): Steps<Yard> {
  const g = new Grid(S);
  const set = (x: number, y: number, z: number, p: Paint) => {
    const c = p(x, y, z);
    if (c) g.set(x, y, z, c);
  };
  const boxI = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, p);
  };
  /** Snow on the upper face of a voxel, only where nothing sits there already. */
  const capAt = (x: number, y: number, z: number) => {
    if (!g.has(x, y + 1, z)) set(x, y + 1, z, snow);
  };

  ground(g, set);
  yield;
  fence(g, set, boxI, capAt);
  yield;
  YARD.pines.forEach(([x, z, h], i) => pine(g, set, x, z, i + 1, h));
  yield;
  sled(set, boxI, capAt);
  woodpile(set, boxI, capAt);
  feeder(set, boxI, capAt);
  trough(boxI);
  baleStack(boxI, capAt);
  const panes = new Grid(S);
  const smokeFrom = farmhouse(g, panes, set, boxI, capAt);
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
  const fine = yield* detailedSteps(g.map, S, 0, standing);
  yield;
  const man = snowmanGrid();
  const geos = [
    ...(yield* inChunks(g.map, S, (v) => !standing(v), (ny, y) => ny < 0 && y < 0)),
    ...(yield* inChunks(fine.map, fine.size, () => true, (ny, y) => ny < 0 && y <= 0)),
  ];
  // The snowman is its own mesh with no corner shading: on a white ball the corner shading of every little step stacks
  // into dark stripes. It takes light and shadow like the snow around it, so it never looks glazed or out of place.
  const man2 = buildGeometry(man.map, S / 2, { ao: false });
  const glass = buildGeometry(panes.map, S, { ao: false });
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

type Set = (x: number, y: number, z: number, p: Paint) => void;
type BoxI = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) => void;
type Cap = (x: number, y: number, z: number) => void;

function ground(_g: Grid, set: Set) {
  // The path: packed snow, a step cooler than the yard's, in broad soft patches of two close tones.
  const PACKED = [lin(T.path[0]), lin(T.path[1])] as const;
  const pathTone: Paint = (xi, _y, zi) => banded(PACKED, patches(xi * S, zi * S, 2.2, 5), [0.55]);
  const ice = tone(T.ice, 6, [0.5, 0.85]);
  const skate = lin(SKATE);
  const skateMark = (x: number, z: number) => {
    const a = Math.hypot(x - (YARD.pond.x - 1.4), z - YARD.pond.z), b = Math.hypot(x - (YARD.pond.x + 1.4), z - YARD.pond.z);
    const arc = Math.abs(((x - YARD.pond.x) / 3.6) ** 2 + ((z - YARD.pond.z - 0.4) / 2.2) ** 2 - 1);
    return Math.abs(a - 1.3) < 0.1 || Math.abs(b - 1.3) < 0.1 || arc < 0.05;
  };
  const near = (v: number, edge: number, w: number) => Math.abs(v - edge) < w;
  for (let xi = ix(YARD.minX); xi < ix(YARD.maxX); xi++)
    for (let zi = ix(-7); zi < ix(YARD.maxZ); zi++) {
      const x = (xi + 0.5) * S, z = (zi + 0.5) * S;
      if (inBarn(x, z)) continue; // the barn floor covers this
      // Never visible: beside the barn (hidden by its side walls) and the far front corners below the frame.
      if (z < BARN.maxZ && z > BARN.minZ && Math.abs(x) > BARN.maxX + 1) continue;
      if (z < BARN.minZ && Math.abs(x) > 14) continue;
      const pd = pondD(x, z);
      if (pd < 1) {
        set(xi, -1, zi, skateMark(x, z) ? () => skate : ice);
        continue;
      }
      const path = onPath(x, z);
      // Snow with soft drifts, ripples and grain (voxel/snow.ts), never the square patches it used to have.
      set(xi, -1, zi, path ? pathTone : groundSnow);
      if (path) continue;
      // A low bank of shovelled snow along each side of the path, so it reads as a path and not as a shadow.
      const offPath = Math.abs(x - pathX(z)) - YARD.path.halfWidth;
      if (z >= YARD.path.fromZ + 0.6 && z <= PATH_END - 0.4 && offPath > 0 && offPath <= 0.4 && !underWalls(x, z)) { set(xi, 0, zi, snow); continue; }
      // 0.2 m drifts against the fence, the barn's walls and round the pond: even bands, one step high, clean edges.
      const fenceD = Math.abs(z - YARD.fence.z - 0.1);
      const byFence = x >= YARD.fence.minX && x <= YARD.fence.maxX && Math.abs(x) > YARD.fence.gateHalfWidth + 0.4 && fenceD < 0.5;
      const byBarnBack = near(z, BARN.maxZ + 0.3, 0.5) && x >= BARN.minX - 0.6 && x <= BARN.maxX + 0.6;
      const byBarnSide = (near(x, BARN.minX - 0.3, 0.5) || near(x, BARN.maxX + 0.3, 0.5)) && z >= BARN.minZ && z <= BARN.maxZ + 0.6;
      const byPond = pd < 1.25;
      if ((byFence || byBarnBack || byBarnSide || byPond) && !underWalls(x, z)) set(xi, 0, zi, snow);
    }
  // No hoof dents or sled ruts in the path: square holes in the ground read as a fault (Brian, 2026-11-19).
}

function fence(g: Grid, set: Set, boxI: BoxI, cap: Cap) {
  const wood = tone(T.beam, 11, [0.45, 0.85]);
  const F = YARD.fence;
  const zf = ix(F.z); // the rails' row of cells; the gate posts stand on zf and zf + 1
  const gate = ix(F.gateHalfWidth + 0.2); // gate posts at x = ±(1.6..2.0)
  const nail = () => lin(T.stone[2]);
  /**
   * A run of rail fence from one cell to another, in the make of the pens' fences (`fenceRun` in farmstead.ts): two
   * rails with an even line of snow on the upper, a post every 2 m counted back from where it ends, a cap of snow on each.
   */
  const run = (x0: number, z0: number, x1: number, z1: number, endPost = true) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)), sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    for (let i = 0; i <= n; i++) {
      const x = x0 + sx * i, z = z0 + sz * i;
      for (const y of [2, 4]) set(x, y, z, wood);
      cap(x, 4, z);
      if ((n - i) % 10 === 0 && (i > 3 || n < 4) && (endPost || i < n)) {
        boxI(x, x, 0, 5, z, z, wood);
        cap(x, 5, z);
      }
    }
  };
  // Along the front, out from each gate post to the forecourt's corners; then back from each corner to the pens.
  run(-gate - 1, zf, ix(F.minX), zf);
  run(gate, zf, ix(F.maxX), zf);
  run(ix(F.minX), zf - 1, ix(F.minX), ix(F.sidesTo[0]), false);
  run(ix(F.maxX), zf - 1, ix(F.maxX), ix(F.sidesTo[1]), false);
  // Gate posts (taller), the gate leaf swung open into the yard, hinges, latch.
  const lp = -gate, rp = gate - 2;
  boxI(lp, lp + 1, 0, 7, zf, zf + 1, wood);
  boxI(rp, rp + 1, 0, 7, zf, zf + 1, wood);
  for (let dz = 0; dz < 2; dz++) cap(lp, 7, zf + dz), cap(lp + 1, 7, zf + dz);
  const leafX = lp + 2, len = ix(YARD.fence.gateHalfWidth * 2 - 0.4);
  for (let dz = 0; dz < len; dz++) {
    for (const y of [2, 4]) {
      set(leafX, y, zf + 1 + dz, wood);
      if (y === 4) cap(leafX, y, zf + 1 + dz);
    }
    if (dz === 0 || dz === len - 1 || dz === len >> 1) boxI(leafX, leafX, 1, 5, zf + 1 + dz, zf + 1 + dz, wood);
  }
  line(g, [(leafX + 0.5) * S, 2.5 * S, (zf + 1.5) * S], [(leafX + 0.5) * S, 4.5 * S, (zf + len - 0.5) * S], wood);
  for (const y of [2, 4]) set(leafX, y, zf, nail); // hinges
  set(rp - 1, 4, zf + 1, () => lin(T.brass[1])); // latch
  set(rp - 1, 4, zf, () => lin(T.brass[2]));
  // A small lantern on the right gate post: dark base, glow in three tones, dark hood, a pinch of snow.
  const dark = tone(T.face, 12);
  boxI(rp, rp + 1, 8, 8, zf, zf + 1, dark);
  boxI(rp, rp + 1, 9, 9, zf, zf + 1, () => lin(T.lantern[1]));
  boxI(rp, rp + 1, 10, 10, zf, zf + 1, () => lin(T.lantern[0]));
  boxI(rp, rp + 1, 11, 11, zf, zf + 1, dark);
  set(rp, 12, zf, dark);
  cap(rp, 12, zf);
  // Mailbox by the gate: post, grey box, red flag, snow on top.
  const mx = ix(2.8), mz = zf + 7; // outside the gate, where the post would be left
  boxI(mx, mx, 0, 4, mz, mz, wood);
  boxI(mx - 1, mx + 1, 5, 6, mz - 2, mz + 1, tone(T.stone, 13));
  set(mx, 5, mz - 3, () => lin(T.stone[2]));
  boxI(mx + 2, mx + 2, 6, 7, mz, mz, () => lin(T.collar[1]));
  for (let x = mx - 1; x <= mx + 1; x++) for (let z = mz - 2; z <= mz + 1; z++) cap(x, 6, z);
}

/** A yard pine: the diorama's tiered pine (style/pine.ts), 5 to 9 m tall unless `height` says. */
export function pine(g: Grid, set: Set, wx: number, wz: number, seed: number, height?: number) {
  const r = rng(seed * 97);
  const drawn = 5 + r() * 4;
  tieredPine((x, y, z, c) => set(x, y, z, () => c), (x, y, z) => g.has(x, y, z), ix(wx), ix(wz), 0, height ?? drawn, S);
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
  const white: Paint = (a, b, c) => pick(T.snow, hash3(a >> 1, b >> 1, c >> 1, 44), [0.55, 1.01]);
  for (const b of balls) ellipsoid(g, [x, b.y, z], [b.r, b.r * 0.96, b.r], white);
  // Facing: toward the home camera, which looks at the yard from the -x, +z side.
  const fx = -0.82, fz = 0.58, sx = -fz, sz = fx;
  const radiusAt = (b: { y: number; r: number }, y: number) => b.r * Math.sqrt(Math.max(0, 1 - ((y - b.y) / (b.r * 0.96)) ** 2));
  const dot = (y: number, b: { y: number; r: number }, side: number, colour: string, out = 0.05) => {
    const r = radiusAt(b, y) + out;
    const px = x + fx * r + sx * side, pz = z + fz * r + sz * side;
    box(g, [px - 0.05, y - 0.05, pz - 0.05], [px + 0.05, y + 0.05, pz + 0.05], () => lin(colour));
  };
  const head = balls[2], body = balls[1];
  for (const side of [-0.13, 0.13]) dot(2.64 * k, head, side * 0.85 * k, T.face[2], 0.0);
  line(g, [x + fx * 0.4 * k, 2.54 * k, z + fz * 0.4 * k], [x + fx * 0.68 * k, 2.5 * k, z + fz * 0.68 * k], () => lin(CARROT));
  for (const y of [1.48, 1.74, 2.0]) dot(y * k, body, 0, T.face[2], 0.0);
  // The scarf: a snug band where head meets body, and a tail hanging down over the chest.
  const red: Paint = () => lin(SCARF);
  const neck = 2.2 * k;
  for (const [y, r] of [[neck - 0.05, 0.36 * k], [neck + 0.05, 0.33 * k]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  for (const [y, r] of [[neck - 0.05, 0.3 * k], [neck + 0.05, 0.28 * k]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  const tail = (t: number): V3 => [x + fx * (0.36 + t * 0.2) * k + sx * 0.14 * k, neck - 0.05 - t * 0.5 * k, z + fz * (0.36 + t * 0.2) * k + sz * 0.14 * k];
  line(g, tail(0), tail(1), red);
  line(g, [tail(0)[0] + sx * 0.1, tail(0)[1], tail(0)[2] + sz * 0.1], [tail(1)[0] + sx * 0.1, tail(1)[1], tail(1)[2] + sz * 0.1], red);
  // Stick arms out of the sides of the body, one raised, with a twig each.
  const stick = tone(T.trunk, 43);
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
  // Beside the path near the gate, at the end of the sled tracks.
  const x0 = ix(2.0), z0 = ix(13.0), len = 7;
  const runner = tone(T.stone, 51);
  const board = tone(T.collar, 52);
  for (const x of [x0, x0 + 2]) {
    boxI(x, x, 0, 0, z0, z0 + len - 1, runner);
    set(x, 1, z0 - 1, runner);
    set(x, 2, z0 - 1, runner);
  }
  boxI(x0, x0 + 2, 1, 1, z0, z0 + len - 1, board);
  for (let z = z0 + 2; z < z0 + len - 1; z++) if (hash3(z, 1, 0, 53) > 0.4) cap(x0 + 1, 1, z);
  set(x0 + 1, 2, z0 - 2, () => lin(T.trunk[1])); // tow rope knot
}

function woodpile(set: Set, boxI: BoxI, cap: Cap) {
  // A lean-to against the farmhouse's end wall, the logs within reach of its door: two tall back posts, two short front
  // posts, a sloped plank roof with snow.
  const x0 = ix(YARD.farmhouse.x + 4.2), x1 = ix(YARD.farmhouse.x + 7.0), zf = ix(YARD.farmhouse.z - 1.0), zb = ix(YARD.farmhouse.z + 0.6);
  const post = tone(T.beam, 61);
  for (const x of [x0, x1]) {
    boxI(x, x, 0, 8, zf, zf, post);
    boxI(x, x, 0, 10, zb, zb, post);
  }
  for (let z = zf - 1; z <= zb + 1; z++) {
    const y = 9 + Math.round(((z - zf) / (zb - zf)) * 2);
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      set(x, y, z, (a) => pickBy(T.roof, (a & 1) ? 0.7 : 0.2)); // alternate courses, a value step apart
      cap(x, y, z); // an even cap of snow
    }
  }
  // Logs stacked in a pyramid with their cut ends toward the barn.
  const bark = tone(T.trunk, 64, [0.4, 0.85]);
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < 6 - row; k++) {
      const lx = x0 + 1 + row + k * 2, ly = row * 2;
      if (lx + 1 >= x1) continue;
      boxI(lx, lx + 1, ly, ly + 1, zf + 1, zb - 1, bark);
      const end = lin(CUT_ENDS[Math.floor(hash3(row, k, 0, 65) * CUT_ENDS.length) % CUT_ENDS.length]); // one tone a log
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) set(lx + dx, ly + dy, zf + 1, () => end);
    }
}

function feeder(set: Set, boxI: BoxI, cap: Cap) {
  // In the farmhouse's front garden, under its window (it stood in the forecourt, in front of the avatar in Home's opening shot).
  const fx = ix(YARD.farmhouse.x - 4.6), fz = ix(YARD.farmhouse.z - 5.2);
  const wood = tone(T.beam, 71);
  boxI(fx, fx, 0, 6, fz, fz, wood);
  boxI(fx - 1, fx + 1, 7, 7, fz - 1, fz + 1, wood);
  set(fx - 1, 8, fz - 1, wood), set(fx + 1, 8, fz + 1, wood);
  set(fx, 8, fz, () => lin(T.hay[1]));
  set(fx + 1, 8, fz - 1, () => lin(T.hay[2]));
  boxI(fx - 2, fx + 2, 9, 9, fz - 1, fz + 1, tone(T.roof, 72));
  boxI(fx - 1, fx + 1, 10, 10, fz - 1, fz + 1, tone(T.roof, 73));
  for (let x = fx - 2; x <= fx + 2; x++) for (let z = fz - 1; z <= fz + 1; z++) cap(x, Math.abs(x - fx) <= 1 ? 10 : 9, z);
}

/**
 * Square bales stacked in the forecourt, as in Brian's farm picture: three in a row and two behind them, two across
 * those, one on top. Each bale is one tone of straw with its two twine bands a step darker; snow on the ones open to
 * the sky.
 */
function baleStack(boxI: BoxI, cap: Cap) {
  const x0 = ix(8.2), z0 = ix(10.4), L = 5, W = 3, H = 3; // a bale: 1.0 x 0.6 x 0.6 m, its length along x
  const bale = (bx: number, by: number, bz: number, n: number) => {
    const straw = pickBy(T.hay, hash3(n, 0, 0, 87)), twine = lin(T.hay[2]);
    boxI(bx, bx + L - 1, by, by + H - 1, bz, bz + W - 1, (x) => (x === bx + 1 || x === bx + L - 2 ? twine : straw));
    for (let x = bx; x < bx + L; x++) for (let z = bz; z < bz + W; z++) cap(x, by + H - 1, z); // a bale set on top takes its place
  };
  for (let i = 0; i < 3; i++) bale(x0 + i * L, 0, z0 + W, i);
  for (let i = 0; i < 2; i++) bale(x0 + i * L, 0, z0, 3 + i);
  bale(x0, H, z0 + 1, 5), bale(x0 + L, H, z0 + 1, 6);
  bale(x0 + 2, H * 2, z0 + 1, 7);
}

function trough(boxI: BoxI) {
  // Wooden water trough near the fence, frozen over.
  const x0 = ix(5.8), x1 = ix(7.6) - 1, z0 = ix(13.6), z1 = ix(14.4) - 1;
  const wood = tone(T.beam, 81, [0.4, 0.85]);
  boxI(x0, x1, 0, 0, z0, z1, wood);
  boxI(x0, x1, 1, 3, z0, z0, wood), boxI(x0, x1, 1, 3, z1, z1, wood);
  boxI(x0, x0, 1, 3, z0, z1, wood), boxI(x1, x1, 1, 3, z0, z1, wood);
  boxI(x0 + 1, x1 - 1, 1, 2, z0 + 1, z1 - 1, tone(T.ice, 82, [0.4, 0.8]));
  boxI(x0, x1, 4, 4, z0, z0, snow);
}

/**
 * The farmhouse's own paint (Brian's farm picture, docs/diorama/reference/farm-34.png): warm clapboard a value step
 * apart board to board, dark timber at the corners and round every opening, panes lit from inside.
 */
const HOUSE = { board: ['#DCC299', '#CFB389'], timber: '#6B4832', pane: ['#FFE28C', '#FFCB5C'], door: ['#8C4A3A', '#7B3F32'] } as const;

/**
 * The farmhouse: a stone footing, clapboard walls with timber corners, lit windows on all four sides, a plank door on a
 * stone step, a shingled roof under one blanket of snow, a stone chimney. Returns the chimney top (smoke origin).
 */
function farmhouse(g: Grid, panes: Grid, set: Set, boxI: BoxI, cap: Cap): [number, number, number] {
  const X0 = ix(YARD.farmhouse.x - 3.6), X1 = ix(YARD.farmhouse.x + 3.6) - 1;
  const Z0 = ix(YARD.farmhouse.z - 3), Z1 = ix(YARD.farmhouse.z + 3) - 1;
  const WH = 16, zc = (Z0 + Z1 + 1) / 2, half = (Z1 - Z0 + 1) / 2, pitch = 0.8;
  const timber: Paint = () => lin(HOUSE.timber);
  const wall: Paint = (_x, y) => (y < 2 ? lin(T.stone[1]) : lin(HOUSE.board[(y >> 1) & 1]));
  // Walls (one voxel shell) and the gable ends.
  for (let x = X0; x <= X1; x++)
    for (let z = Z0; z <= Z1; z++) {
      const edgeX = x === X0 || x === X1, edgeZ = z === Z0 || z === Z1;
      if (!edgeX && !edgeZ) continue;
      for (let y = 0; y < WH; y++) set(x, y, z, wall);
      if (edgeX) {
        const top = WH + Math.floor((half - Math.abs(z + 0.5 - zc)) * pitch);
        for (let y = WH; y < top; y++) set(x, y, z, wall);
      }
    }
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) boxI(x, x, 2, WH - 1, z, z, timber);
  // Roof: alternating shingle rows down the slope, staggered seams, a blanket of snow; 2-voxel overhang.
  for (let x = X0 - 2; x <= X1 + 2; x++)
    for (let z = Z0 - 2; z <= Z1 + 2; z++) {
      const d = Math.abs(z + 0.5 - zc);
      const y = WH + Math.floor((half - d) * pitch);
      const row = Math.floor(d / 2);
      const seam = (x + (row % 2) * 2) % 4 === 0;
      set(x, y, z, () => lin(seam ? T.roof[2] : row % 2 ? T.roof[1] : T.roof[0]));
      if (d < half - 1) cap(x, y, z); // one blanket of snow, the roof showing along the eaves
    }
  /**
   * A lit window in a wall: a timber frame and cross, warm panes (brighter at the top), a timber sill.
   * `at(i, j, out)` gives the cell `i` along the wall, `j` up and `out` cells proud of it.
   */
  const lit = (at: (i: number, j: number, out: number) => [number, number, number], w: number, h: number) => {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < h; j++) {
        const frame = i === 0 || i === w - 1 || j === 0 || j === h - 1 || (w > 4 && i === w >> 1) || (h > 4 && j === h >> 1);
        const [x, y, z] = at(i, j, 0);
        if (frame) { g.set(x, y, z, lin(HOUSE.timber)); continue; }
        // A pane is taken out of the wall and set in the panes' own grid, which is drawn glowing.
        g.del(x, y, z);
        panes.set(x, y, z, lin(HOUSE.pane[j > h >> 1 ? 0 : 1]));
      }
    for (let i = -1; i <= w; i++) set(...at(i, -1, 1), timber); // the sill
  };
  const wl = X0 + 4, wr = X1 - 10, wy = 6, gz = Math.round(zc) - 3;
  for (const wx of [wl, wr]) {
    lit((i, j, out) => [wx + i, wy + j, Z0 - out], 7, 7); // the front
    lit((i, j, out) => [wx + i, wy + j, Z1 + out], 7, 7); // the back
  }
  for (const [x, out] of [[X0, -1], [X1, 1]] as const) {
    lit((i, j, o) => [x + out * o, wy + j, gz + i], 7, 7); // each gable end
    lit((i, j, o) => [x + out * o, 19 + j, gz + 2 + i], 3, 3); // and the loft's small window over it
  }
  // The door: planks in a timber frame, a brass knob, on a stone step with a lower one in front.
  const dx0 = ix(YARD.farmhouse.x) - 2;
  boxI(dx0 - 1, dx0 + 4, 2, 13, Z0, Z0, timber);
  boxI(dx0, dx0 + 3, 2, 12, Z0, Z0, (x) => lin(HOUSE.door[(x - dx0) >> 1 & 1]));
  set(dx0 + 3, 7, Z0 - 1, () => lin(T.brass[0]));
  const flag: Paint = (x, y, z) => lin(T.stone[course(x, z, 4, 3, 2, 104 + y)]);
  boxI(dx0 - 2, dx0 + 5, 0, 1, Z0 - 5, Z0 - 1, flag);
  boxI(dx0 - 1, dx0 + 4, 0, 0, Z0 - 7, Z0 - 6, flag);
  // Chimney in stone with mortar courses and a wider crown, snow on the crown.
  const cx = ix(YARD.farmhouse.x - 2.3) - 1, cz = Math.round(zc) + 1, top = 33;
  for (let y = WH - 2; y <= top; y++)
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (y === top && dx === 0 && dz === 0) continue;
        set(cx + dx, y, cz + dz, (_a, b) => lin(b % 3 === 0 ? T.stone[0] : T.stone[1]));
      }
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
        set(cx + dx, top, cz + dz, () => lin(T.stone[2]));
        cap(cx + dx, top, cz + dz);
      }
  return [(cx + 0.5) * S, (top + 1) * S, (cz + 0.5) * S];
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
