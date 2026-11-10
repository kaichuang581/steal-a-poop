import { BufferGeometry, Float32BufferAttribute } from 'three';
import { buildGeometry, triangles } from '../voxel/mesher';
import { detailed } from '../voxel/refine';
import type { Voxel, VoxelMap } from '../voxel/mesher';
import { lin, pick, SCARF, T } from '../voxel/palette';
import { snowPaint } from '../voxel/snow';
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
const WINDOW_FRAME = '#EDE6D6';

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
const PATH_END = 24.6;
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

export function buildYard(): { chunks: BufferGeometry[]; snowman: BufferGeometry; smokeFrom: [number, number, number]; triangles: number } {
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
  fence(g, set, boxI, capAt);
  YARD.pines.forEach(([x, z], i) => pine(g, set, x, z, i + 1));
  sled(set, boxI, capAt);
  woodpile(set, boxI, capAt);
  feeder(set, boxI, capAt);
  trough(boxI);
  cattails(set);
  const smokeFrom = farmhouse(g, set, boxI, capAt);

  // Split into 8 m chunks in x/z; each chunk's faces still cull against its neighbours. The ground stays as it is, and
  // everything standing on it is refined to the barn's 0.1 m, so the yard and the barn read as one place.
  const inChunks = (map: VoxelMap, size: number, keep: (v: Voxel) => boolean, drop: (ny: number, y: number) => boolean) => {
    const chunks = new Map<string, ChunkMap>();
    for (const [k, v] of map) {
      if (!keep(v)) continue;
      const ck = `${Math.floor((v.x * size) / CHUNK)},${Math.floor((v.z * size) / CHUNK)}`;
      let m = chunks.get(ck);
      if (!m) chunks.set(ck, (m = new ChunkMap(map)));
      Map.prototype.set.call(m, k, v);
    }
    return [...chunks.values()].map((m) => dropFaces(buildGeometry(m, size), drop));
  };
  const standing = (v: Voxel) => v.y >= 0;
  const fine = detailed(g.map, S, 0.04, standing);
  const man = new Grid(S / 2);
  snowman(man);
  const geos = [
    ...inChunks(g.map, S, (v) => !standing(v), (ny, y) => ny < 0 && y < 0),
    ...inChunks(fine.map, fine.size, () => true, (ny, y) => ny < 0 && y <= 0),
  ];
  // The snowman is its own mesh with no corner shading: on a white ball the corner shading of every little step stacks
  // into dark stripes. It takes light and shadow like the snow around it, so it never looks glazed or out of place.
  const man2 = buildGeometry(man.map, S / 2, { ao: false });
  return { chunks: geos, snowman: man2, smokeFrom, triangles: [...geos, man2].reduce((s, x) => s + triangles(x), 0) };
}

type Set = (x: number, y: number, z: number, p: Paint) => void;
type BoxI = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) => void;
type Cap = (x: number, y: number, z: number) => void;

function ground(g: Grid, set: Set) {
  const pathTone = tone(T.path, 5, [0.5, 0.85]);
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
      // 0.2 m drifts against the fence, the barn's walls and around the pond rim.
      const r = hash3(xi, 0, zi, 9);
      const fenceD = Math.abs(z - YARD.fence.z - 0.1);
      const byFence = x >= YARD.fence.minX && x <= YARD.fence.maxX && Math.abs(x) > YARD.fence.gateHalfWidth + 0.4 && (fenceD < 0.3 || (fenceD < 0.8 && r > 0.45));
      const byBarnBack = near(z, BARN.maxZ + 0.3, 0.3 + r * 0.4) && x >= BARN.minX - 0.6 && x <= BARN.maxX + 0.6;
      const byBarnSide = (near(x, BARN.minX - 0.3, 0.3 + r * 0.4) || near(x, BARN.maxX + 0.3, 0.3 + r * 0.4)) && z >= BARN.minZ && z <= BARN.maxZ + 0.6;
      const byPond = pd < 1.3 && r > 0.35;
      if ((byFence || byBarnBack || byBarnSide || byPond) && !underWalls(x, z)) set(xi, 0, zi, snow);
    }
  // Footprints (alternating hoof dents) and two sled tracks pressed into the path.
  const dent = (xi: number, zi: number) => {
    if (!g.has(xi, -1, zi)) return;
    g.del(xi, -1, zi);
    g.set(xi, -2, zi, lin(T.path[2]));
  };
  for (let z = YARD.path.fromZ + 0.5, k = 0; z < PATH_END - 0.3; z += 0.45, k++) {
    const x = pathX(z) - 0.35 + (k % 2 ? 0.2 : -0.2);
    dent(ix(x - 0.1), ix(z - 0.1));
  }
  for (let z = YARD.path.fromZ + 0.2; z < 13.0; z += 0.1) {
    const cx = 0.6 + 1.6 * smooth((z - 9) / 4);
    dent(ix(cx - 0.3), ix(z - 0.1));
    dent(ix(cx + 0.1), ix(z - 0.1));
  }
}

function fence(g: Grid, set: Set, boxI: BoxI, cap: Cap) {
  const wood = tone(T.beam, 11, [0.45, 0.85]);
  const nail = () => lin(T.stone[2]);
  const zf = ix(YARD.fence.z); // posts occupy zf..zf+1, rails sit on the near face at zf-1
  const gate = ix(YARD.fence.gateHalfWidth + 0.2); // gate posts at x = ±(1.6..2.0)
  const posts: number[] = [];
  for (let x = 4; x <= YARD.fence.maxX; x += 2) posts.push(ix(x) - 1, -ix(x) - 1);
  for (const px of posts) {
    boxI(px, px + 1, 0, 6, zf, zf + 1, wood);
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) cap(px + dx, 6, zf + dz);
    if (hash3(px, 0, 0, 4) > 0.4) set(px + (px > 0 ? 1 : 0), 8, zf, snow);
  }
  // Two rails, each 1 voxel thick, nailed to every post; snow along their tops.
  const rails = (a: number, b: number) => {
    for (const y of [2, 5])
      for (let x = a; x <= b; x++) {
        const onPost = posts.includes(x) || posts.includes(x - 1);
        set(x, y, zf - 1, onPost && posts.includes(x) ? nail : wood);
        if (hash3(x, y, 1, 8) > 0.3) cap(x, y, zf - 1);
      }
  };
  rails(ix(YARD.fence.minX) - 1, -gate - 1);
  rails(gate, ix(YARD.fence.maxX));
  // Gate posts (taller), the gate leaf swung open into the yard, hinges, latch.
  const lp = -gate, rp = gate - 2;
  boxI(lp, lp + 1, 0, 7, zf, zf + 1, wood);
  boxI(rp, rp + 1, 0, 7, zf, zf + 1, wood);
  for (let dz = 0; dz < 2; dz++) cap(lp, 7, zf + dz), cap(lp + 1, 7, zf + dz);
  const leafX = lp + 2, len = ix(YARD.fence.gateHalfWidth * 2 - 0.4);
  for (let dz = 0; dz < len; dz++) {
    for (const y of [2, 5]) {
      set(leafX, y, zf + 1 + dz, wood);
      if (hash3(dz, y, 3, 8) > 0.35) cap(leafX, y, zf + 1 + dz);
    }
    if (dz === 0 || dz === len - 1 || dz === len >> 1) boxI(leafX, leafX, 1, 6, zf + 1 + dz, zf + 1 + dz, wood);
  }
  line(g, [(leafX + 0.5) * S, 2.5 * S, (zf + 1.5) * S], [(leafX + 0.5) * S, 5.5 * S, (zf + len - 0.5) * S], wood);
  for (const y of [2, 5]) set(leafX, y, zf, nail); // hinges
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
  const mx = ix(2.8), mz = zf - 4;
  boxI(mx, mx, 0, 4, mz, mz, wood);
  boxI(mx - 1, mx + 1, 5, 6, mz - 2, mz + 1, tone(T.stone, 13));
  set(mx, 5, mz - 3, () => lin(T.stone[2]));
  boxI(mx + 2, mx + 2, 6, 7, mz, mz, () => lin(T.collar[1]));
  for (let x = mx - 1; x <= mx + 1; x++) for (let z = mz - 2; z <= mz + 1; z++) cap(x, 6, z);
}

export function pine(g: Grid, set: Set, wx: number, wz: number, seed: number, height?: number) {
  const r = rng(seed * 97);
  const drawn = 5 + r() * 4;
  const H = height ?? drawn;
  const hv = ix(H), tx = ix(wx) - 1, tz = ix(wz) - 1;
  const bark = tone(T.trunk, seed, [0.4, 0.85]);
  const ridge = () => lin(T.trunk[2]);
  const needles = tone(T.pine, seed + 50, [0.45, 0.85]);
  const trunkTop = hv - 2;
  for (let y = 0; y < trunkTop; y++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) set(tx + dx, y, tz + dz, bark);
  // Bark ridges: vertical runs of 2 voxels standing out from the trunk on every side.
  const around: [number, number][] = [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]];
  const y0 = ix(1.4);
  around.forEach(([dx, dz], k) => {
    for (let y = 0; y < y0 + 2; y += 3) if (hash3(k, y, seed, 21) > 0.45) set(tx + dx, y, tz + dz, ridge), set(tx + dx, y + 1, tz + dz, ridge);
  });
  // Bare lower branches below the needle rows.
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2, y = 3 + k * 2, L = 3 + Math.floor(r() * 2);
    // From the trunk's face out (starting two cells off the trunk's middle left a branch pointing along an axis a cell
    // clear of the bark, in the air), the tip turned up on top of its last cell rather than beside it.
    for (let i = 1; i <= L; i++) {
      const x = Math.round(tx + 1 + Math.cos(a) * i), z = Math.round(tz + 1 + Math.sin(a) * i);
      set(x, y, z, ridge);
      if (i === L) set(x, y + 1, z, ridge);
    }
  }
  // Layered rows: 1-voxel radial branches, a 1-voxel gap above the snow, slight droop at the tips.
  const rMax = (H * 0.27) / S;
  const branch: V3[] = [];
  for (let y = y0, tier = 0; y < hv - 1; y += 3, tier++) {
    const t = (y - y0) / (hv - y0);
    const R = Math.max(1.5, (1 - t) * rMax + 1);
    const dirs = Math.max(5, Math.round(R * 1.4));
    const off = tier * 2.399 + r();
    for (let d = 0; d < dirs; d++) {
      const a = off + (d / dirs) * Math.PI * 2;
      const L = R * (0.8 + hash3(d, tier, seed, 31) * 0.3);
      const bare = tier === 0 && hash3(d, 0, seed, 33) < 0.2;
      let drooped = false;
      for (let i = 1; i <= L; i += 0.6) {
        const x = Math.round(tx + 0.5 + Math.cos(a) * i), z = Math.round(tz + 0.5 + Math.sin(a) * i);
        const droop = i > L * 0.7;
        // Where the tip first drops a row it keeps a cell on the branch's own row too: dropping while stepping out
        // diagonally left the tip touching the branch at a corner only, and it hung in the air.
        const cells: V3[] = droop && !drooped ? [[x, y, z], [x, y - 1, z]] : [[x, droop ? y - 1 : y, z]];
        drooped ||= droop;
        for (const c of cells) if (bare) set(c[0], c[1], c[2], ridge); else branch.push(c);
      }
    }
  }
  for (const [x, y, z] of branch) set(x, y, z, needles);
  for (const [x, y, z] of branch) if (!g.has(x, y + 1, z)) set(x, y + 1, z, snow);
  // Leader at the top with a snow tip, standing on the trunk (which stops at hv - 3).
  set(tx, hv - 2, tz, needles);
  set(tx, hv - 1, tz, needles);
  set(tx, hv, tz, needles);
  set(tx, hv + 1, tz, snow);
}


/**
 * The snowman, on its own 0.1 m grid: three round balls, a face turned toward the start screen's camera, a scarf knotted
 * at the neck with its tail hanging over the chest, stick arms and coal buttons. Everything is placed in metres off the
 * ball it sits on, so it stays on the surface.
 */
function snowman(g: Grid) {
  const { x, z } = YARD.snowman;
  const balls = [{ y: 0.72, r: 0.78 }, { y: 1.74, r: 0.56 }, { y: 2.56, r: 0.42 }];
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
  for (const side of [-0.13, 0.13]) dot(2.64, head, side * 0.85, T.face[2], 0.0);
  line(g, [x + fx * 0.4, 2.54, z + fz * 0.4], [x + fx * 0.68, 2.5, z + fz * 0.68], () => lin(CARROT));
  for (const y of [1.48, 1.74, 2.0]) dot(y, body, 0, T.face[2], 0.0);
  // The scarf: a snug band where head meets body, and a tail hanging down over the chest.
  const red: Paint = (a, b, c) => lin(hash3(a, b, c, 41) > 0.7 ? T.collar[2] : SCARF);
  const neck = 2.2;
  for (const [y, r] of [[neck - 0.05, 0.36], [neck + 0.05, 0.33]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  for (const [y, r] of [[neck - 0.05, 0.3], [neck + 0.05, 0.28]] as const) ring(g, [x, y, z], r, r, 0.1, red);
  const tail = (t: number): V3 => [x + fx * (0.36 + t * 0.2) + sx * 0.14, neck - 0.05 - t * 0.5, z + fz * (0.36 + t * 0.2) + sz * 0.14];
  line(g, tail(0), tail(1), red);
  line(g, [tail(0)[0] + sx * 0.1, tail(0)[1], tail(0)[2] + sz * 0.1], [tail(1)[0] + sx * 0.1, tail(1)[1], tail(1)[2] + sz * 0.1], red);
  // Stick arms out of the sides of the body, one raised, with a twig each.
  const stick = tone(T.trunk, 43);
  for (const [side, rise] of [[1, 0.45], [-1, 0.15]] as const) {
    const from: V3 = [x + sx * side * 0.5, 1.86, z + sz * side * 0.5];
    const to: V3 = [x + sx * side * 1.25, 1.86 + rise, z + sz * side * 1.25];
    line(g, from, to, stick);
    line(g, [(from[0] + to[0] * 2) / 3, (from[1] + to[1] * 2) / 3, (from[2] + to[2] * 2) / 3], [to[0] + sx * side * 0.05, to[1] + 0.3, to[2] + sz * side * 0.05], stick);
  }
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
  // Lean-to beside the path past the gate: two tall back posts, two short front posts, a sloped plank roof with snow.
  const x0 = ix(2.2), x1 = ix(5.0), zf = ix(19.0), zb = ix(20.6);
  const post = tone(T.beam, 61);
  for (const x of [x0, x1]) {
    boxI(x, x, 0, 8, zf, zf, post);
    boxI(x, x, 0, 10, zb, zb, post);
  }
  for (let z = zf - 1; z <= zb + 1; z++) {
    const y = 9 + Math.round(((z - zf) / (zb - zf)) * 2);
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      set(x, y, z, (a, b, c) => pick(T.roof, ((a & 1) ? 0.7 : 0.2) + hash3(a, b, c, 62) * 0.25));
      if (hash3(x, y, z, 63) > 0.15) cap(x, y, z);
    }
  }
  // Logs stacked in a pyramid with their cut ends toward the barn.
  const bark = tone(T.trunk, 64, [0.4, 0.85]);
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < 6 - row; k++) {
      const lx = x0 + 1 + row + k * 2, ly = row * 2;
      if (lx + 1 >= x1) continue;
      boxI(lx, lx + 1, ly, ly + 1, zf + 1, zb - 1, bark);
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) set(lx + dx, ly + dy, zf + 1, () => lin(dx + dy === 1 ? T.hay[2] : T.beam[0]));
    }
}

function feeder(set: Set, boxI: BoxI, cap: Cap) {
  const fx = ix(-2.8), fz = ix(12.4);
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

function cattails(set: Set) {
  const stem: Paint = (x, y, z) => pick(['#7C8A55', '#6B7848', '#5A663C'], hash3(x, y, z, 91));
  const head: Paint = (x, y, z) => pick(T.trunk, hash3(x, y, z, 92), [0.3, 0.8]);
  const r = rng(93);
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * (0.15 + r() * 0.7) + (k % 3 === 0 ? Math.PI : 0); // mostly on the far bank
    const x = ix(YARD.pond.x + Math.cos(a) * YARD.pond.rx * 1.02), z = ix(YARD.pond.z + Math.sin(a) * YARD.pond.rz * 1.02);
    const h = 4 + Math.floor(r() * 3);
    for (let y = 0; y < h; y++) set(x, y, z, stem);
    set(x, h, z, head), set(x, h + 1, z, head);
    set(x, h + 2, z, stem);
  }
}

/** Farmhouse with shingled roof, windows, chimney, porch and bench. Returns the chimney top (smoke origin). */
function farmhouse(g: Grid, set: Set, boxI: BoxI, cap: Cap): [number, number, number] {
  const X0 = ix(YARD.farmhouse.x - 3.6), X1 = ix(YARD.farmhouse.x + 3.6) - 1;
  const Z0 = ix(YARD.farmhouse.z - 3), Z1 = ix(YARD.farmhouse.z + 3) - 1;
  const WH = 16, zc = (Z0 + Z1 + 1) / 2, half = (Z1 - Z0 + 1) / 2, pitch = 0.8;
  const wall: Paint = (x, y, z) => (y % 3 === 2 ? lin(T.house[2]) : pick(T.house, hash3(x >> 2, y >> 2, z >> 2, 101), [0.55, 1]));
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
  // Roof: alternating shingle rows down the slope, staggered seams, patchy snow; 2-voxel overhang.
  for (let x = X0 - 2; x <= X1 + 2; x++)
    for (let z = Z0 - 2; z <= Z1 + 2; z++) {
      const d = Math.abs(z + 0.5 - zc);
      const y = WH + Math.floor((half - d) * pitch);
      const row = Math.floor(d / 2);
      const seam = (x + (row % 2) * 2) % 4 === 0;
      set(x, y, z, () => lin(seam ? T.roof[2] : row % 2 ? T.roof[1] : T.roof[0]));
      if (d < 2 || (d < half - 1 && hash3(x, y, z, 102) > 0.4)) cap(x, y, z);
    }
  // Front windows: frame, mullion cross, red curtains at the sides, warm interior gradient, sill with snow.
  const glow = [T.lantern[0], T.lantern[0], T.lantern[1], T.lantern[1], T.lantern[2]];
  for (const wx of [ix(YARD.farmhouse.x - 2.3) - 3, ix(YARD.farmhouse.x + 2.3) - 4]) {
    const wy = 7;
    for (let dx = 0; dx < 7; dx++)
      for (let dy = 0; dy < 7; dy++) {
        const frame = dx === 0 || dx === 6 || dy === 0 || dy === 6 || dx === 3 || dy === 3;
        const curtain = (dx === 1 || dx === 5) && dy >= 2;
        const c = frame ? WINDOW_FRAME : curtain ? (dy % 2 ? T.collar[0] : T.collar[1]) : glow[dy - 1];
        g.set(wx + dx, wy + dy, Z0, lin(c));
      }
    for (let dx = -1; dx < 8; dx++) set(wx + dx, wy - 1, Z0 - 1, () => lin(WINDOW_FRAME)), cap(wx + dx, wy - 1, Z0 - 1);
  }
  // Door with a brass knob.
  const dx0 = ix(YARD.farmhouse.x) - 2;
  boxI(dx0, dx0 + 3, 3, 12, Z0, Z0, (x) => lin((x - dx0) % 2 ? T.roof[1] : T.roof[2]));
  set(dx0 + 3, 7, Z0 - 1, () => lin(T.brass[0]));
  // Chimney in stone with mortar courses and a wider crown.
  const cx = ix(YARD.farmhouse.x - 2.3) - 1, cz = Math.round(zc) + 1, top = 33;
  for (let y = WH - 2; y <= top; y++)
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (y === top && dx === 0 && dz === 0) continue;
        set(cx + dx, y, cz + dz, (a, b, c) => (b % 3 === 0 ? lin(T.stone[0]) : pick(T.stone, hash3(a, b, c, 103), [0.3, 0.8])));
      }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) === 2 || Math.abs(dz) === 2) set(cx + dx, top, cz + dz, () => lin(T.stone[2]));
  // Porch deck (0.6 m) with two steps, a railing and a snow-covered bench.
  const px0 = ix(YARD.farmhouse.x - 2), px1 = ix(YARD.farmhouse.x + 2) - 1, pz0 = Z0 - 8;
  const plank: Paint = (x, y, z) => ((x - px0) % 3 === 2 ? lin(T.beam[2]) : pick(T.beam, hash3(x, y, z, 104), [0.5, 0.95]));
  boxI(px0, px1, 0, 2, pz0, Z0 - 1, plank);
  const sx0 = ix(YARD.farmhouse.x - 1), sx1 = ix(YARD.farmhouse.x + 1) - 1;
  boxI(sx0, sx1, 0, 1, pz0 - 2, pz0 - 1, plank);
  boxI(sx0, sx1, 0, 0, pz0 - 4, pz0 - 3, plank);
  const rail = tone(T.beam, 105);
  for (let x = px0; x <= px1; x++) {
    const gap = x >= sx0 && x <= sx1;
    if (!gap && ((x - px0) % 3 === 0 || x === px1 || x === sx0 - 1 || x === sx1 + 1)) boxI(x, x, 3, 6, pz0, pz0, rail);
    if (!gap) set(x, 7, pz0, rail), hash3(x, 7, 0, 106) > 0.3 && cap(x, 7, pz0);
  }
  for (const x of [px0, px1])
    for (let z = pz0; z < Z0; z++) {
      if ((z - pz0) % 3 === 0) boxI(x, x, 3, 6, z, z, rail);
      set(x, 7, z, rail);
      if (hash3(x, 7, z, 107) > 0.3) cap(x, 7, z);
    }
  const bx0 = px1 - 7, bx1 = px1 - 2;
  boxI(bx0, bx1, 5, 5, Z0 - 3, Z0 - 2, rail);
  for (const x of [bx0, bx1]) boxI(x, x, 3, 4, Z0 - 3, Z0 - 2, rail);
  boxI(bx0, bx1, 6, 7, Z0 - 1, Z0 - 1, rail);
  for (let x = bx0; x <= bx1; x++) {
    cap(x, 5, Z0 - 3), cap(x, 5, Z0 - 2), cap(x, 7, Z0 - 1);
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
