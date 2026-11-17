/**
 * Stage 4 of the scene checker: coplanar (plan file 18, section 4.2 c, the scenes' half). Two meshes that each draw a
 * face on the same plane, turned the same way, over the same ground, flicker: the graphics chip cannot tell which is
 * in front. This stage measures how much of that each scene holds, in square metres.
 *
 * How it is measured:
 *
 *   - A voxel's face is drawn when no voxel of its own set stands against it (the mesher's rule, src/skin/voxel/
 *     mesher.ts). Faces the game then takes off again are left out: `DROPPED` below copies those few places, pinned
 *     to the game's own lines.
 *   - Every part lies where the game draws it (tools/scenes/build.ts): the world, and every thing a mesh sets down,
 *     where it rests. A thing that rests turned off the axes (a door leaf standing open, a hay bale turned a little)
 *     shares no plane with the world; its parts are judged against each other in its own frame.
 *   - Each drawn face is laid on its plane (the same plane means the same to a tenth of a millimetre) and sampled at the
 *     middles of 0.05 m cells. A cell that two different parts both cover, facing the same way, counts 0.0025 m2, once,
 *     however many parts meet there. Two parts are two different meshes, or two voxel sets merged into one mesh: the
 *     merge does not stop their faces from fighting, and the report says how much of each kind there is.
 *
 * Nothing found here fails the run by itself. Two numbers for each scene at each detail level are handed in, in square
 * metres, and may only fall:
 *
 *   area.<scene>.<detail>    every such cell, whichever way it faces;
 *   seen.<scene>.<detail>    those on a side a camera of that scene can stand in front of: a face that looks +x counts
 *                            when some place of some camera path lies further toward +x than its plane (the paths are
 *                            the lens stage's, tools/scenes/lens.ts). A face no camera can be in front of cannot be
 *                            seen to flicker; it is still in `area`.
 *
 * Every pair of sources that fights is one entry of `failures`, and the report lists the largest by the code that
 * built them. Only docs/visual-overhaul/EXEMPT.json takes a pair out of the two numbers, and then its area is handed in
 * as excused (`excused.<scene>.<detail>`), which may only fall too: an entry matches the text
 * `<mount>: <label> | <mount>: <label>` of a pair as the report prints it.
 *
 * Known to add area that is not there: a face on the join between two chunks of one builder is taken as drawn (the
 * game culls it against the neighbouring chunk), so a third part buried across that join counts a little more than it
 * shows.
 *
 * The other half of 4.2 c, coincident faces between an animal's rigid parts, is the models stage's.
 *
 *   npm run check:scenes -- --only coplanar --show=festive     every pair whose name matches, with where it is
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { boxes, restBoxes } from './build';
import type { Failure, Part, Scene, StageOptions, StageResult, World } from './build';
import { bodiesOf, cameraPlaces } from './lens';

export const id = 'coplanar';
export const needs = { scenes: 'all' as const, models: false };

/** The side of a sampling cell, in metres (the plan's). */
const CELL = 0.05;
/** Planes nearer than this are one plane, in metres. */
const SAME = 1e-4;
/** Cells along one side of a sorting bucket: buckets of 2 m. */
const BUCKET = 40;

// ---------------------------------------------------------------------------------------------------------------------
// Faces the game builds and then takes off again
// ---------------------------------------------------------------------------------------------------------------------

/** The six ways a face can look, as bits: -x, +x, -y, +y, -z, +z. */
const FACING = ['-x', '+x', '-y', '+y', '-z', '+z'] as const;
const ALL = 63;

/**
 * Where the game drops whole faces after meshing, by the mount of the part: the facings (in the part's own cells)
 * that are never drawn. Each is copied from one line of the game, pinned in `PINS`; a line that is gone or changed
 * stops the stage, because the copy may then be wrong. A drop that depends on where the face is (the yard's ground,
 * the bedroom's walls, the dream's raft) is not copied: those faces are counted as drawn, which can only add area.
 */
const DROPPED: { mount: RegExp; never: number; why: string }[] = [
  { mount: /^barn\.front$/, never: ALL & ~(1 << 5), why: 'the front wall is drawn from inside only: its +z faces (frontInside, src/skin/scene/barn.ts)' },
  { mount: /^farmstead\.terrain$/, never: 1 << 2, why: 'the land\'s undersides are dropped (src/skin/scene/farmstead.ts)' },
  { mount: /^distance\.(hills|backHills|mountains)( \(turned round\))?$/, never: 1 << 2, why: 'the hills\' and the range\'s undersides are dropped (src/skin/scene/distance.ts)' },
];
const PINS: Record<string, string[]> = {
  'src/skin/scene/barn.ts': [
    'for (let t = 0; t < idx.count; t += 3) if (nor.getZ(idx.getX(t)) > 0.5) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));',
    'const front = frontInside();',
  ],
  'src/skin/scene/farmstead.ts': ['const geo = dropFaces(buildGeometry(land.map, land.size), (ny) => ny < 0);'],
  'src/skin/scene/distance.ts': [
    'const hills = dropFaces(buildGeometry(hillsG.map, 1), (ny) => ny < 0);',
    'const backHills = dropFaces(buildGeometry(back.map, back.size), (ny) => ny < 0);',
    'const mountains = dropFaces(buildGeometry(mG.map, 3), (ny) => ny < 0);',
  ],
  'src/skin/voxel/mesher.ts': ['if (has(outside)) continue;'],
};

function lostPins(root: string): string[] {
  const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
  const lost: string[] = [];
  for (const [file, lines] of Object.entries(PINS)) {
    let text = '';
    try { text = squash(readFileSync(resolve(root, file), 'utf8')); } catch { lost.push(`${file} cannot be read`); continue; }
    for (const line of lines) if (!text.includes(squash(line))) lost.push(`${file}: ${line}`);
  }
  return lost;
}

// ---------------------------------------------------------------------------------------------------------------------
// Which faces a voxel set draws
// ---------------------------------------------------------------------------------------------------------------------

const drawnCache = new WeakMap<Int32Array, Uint8Array>();
// Three whole numbers of 17 bits each make one of 51, which a double still holds exactly.
const OFF = 1 << 16, SPAN = 1 << 17;

/**
 * For every voxel of a set, the faces the mesher draws, as six bits (`FACING`): a face is drawn when the cell beyond
 * it is empty in the same set. A set drawn twice shares the answer.
 */
function drawn(part: Part): Uint8Array {
  let out = drawnCache.get(part.cells);
  if (out) return out;
  const { cells, count } = part;
  // The cells, packed into whole numbers and sorted, so a neighbour is found by halving.
  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const x = cells[i * 3] + OFF, y = cells[i * 3 + 1] + OFF, z = cells[i * 3 + 2] + OFF;
    if (x < 0 || y < 0 || z < 0 || x >= SPAN || y >= SPAN || z >= SPAN) throw new Error(`tools/scenes/coplanar.ts: a cell of "${part.mount}" is further out than this stage can pack`);
    keys[i] = (x * SPAN + y) * SPAN + z;
  }
  const sorted = keys.slice().sort();
  const has = (key: number): boolean => {
    let lo = 0, hi = count - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < key) lo = mid + 1; else if (sorted[mid] > key) hi = mid - 1; else return true; }
    return false;
  };
  const STEPS = [-SPAN * SPAN, SPAN * SPAN, -SPAN, SPAN, -1, 1];
  out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    let bits = 0;
    for (let f = 0; f < 6; f++) if (!has(keys[i] + STEPS[f])) bits |= 1 << f;
    out[i] = bits;
  }
  drawnCache.set(part.cells, out);
  return out;
}

/** Where a facing of the part's own cells points once the part is turned `turns` quarter turns about y (three's sense: +z goes to +x). */
function turned(facing: number, turns: number): number {
  let f = facing;
  for (let k = 0; k < (((turns % 4) + 4) % 4); k++) f = [5, 4, 2, 3, 0, 1][f]; // -x to +z, +x to -z, -z to -x, +z to +x
  return f;
}

// ---------------------------------------------------------------------------------------------------------------------
// One frame: parts whose faces can share a plane
// ---------------------------------------------------------------------------------------------------------------------

/** A part laid in a frame: its boxes there, and how many quarter turns its own cells have been given on the way. */
interface Laid { part: Part; boxes: Float64Array; turns: number; never: number; name: string }

/** An open-addressed table from whole numbers to whole numbers: the plane-and-bucket keys run to millions. */
class Table {
  private keys = new Float64Array(1 << 16).fill(-1);
  private values = new Int32Array(1 << 16);
  private used = 0;
  private slot(key: number): number {
    const mask = this.keys.length - 1;
    // Mixes the high and low halves, so keys that differ only far up still spread.
    let h = ((key % 4294967296) ^ Math.floor(key / 4294967296) * 0x9E3779B1) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B) >>> 0;
    let at = (h ^ (h >>> 13)) & mask;
    while (this.keys[at] !== -1 && this.keys[at] !== key) at = (at + 1) & mask;
    return at;
  }
  get(key: number): number | undefined { const at = this.slot(key); return this.keys[at] === key ? this.values[at] : undefined; }
  set(key: number, value: number): void {
    let at = this.slot(key);
    if (this.keys[at] !== key) {
      if (++this.used > this.keys.length * 0.6) {
        const k = this.keys, v = this.values;
        this.keys = new Float64Array(k.length * 2).fill(-1);
        this.values = new Int32Array(k.length * 2);
        for (let i = 0; i < k.length; i++) if (k[i] !== -1) { const s = this.slot(k[i]); this.keys[s] = k[i]; this.values[s] = v[i]; }
        at = this.slot(key);
      }
      this.keys[at] = key;
    }
    this.values[at] = value;
  }
}

interface Pair { a: Laid; b: Laid; cells: number; seen: number; box: [number, number, number, number, number, number]; facings: number }
interface FrameResult { cells: number; seen: number; byFacing: number[]; seenByFacing: number[]; pairs: Pair[]; faces: number }
/** The box round every place a camera of the scene stands, in a frame's own axes. */
interface Cameras { lo: [number, number, number]; hi: [number, number, number] }

const PLANE_OFF = 15_000_000, UV_OFF = 1024, UV_SPAN = 2048;

/** Every face of a laid part that is drawn: `visit(facing, plane, u0, u1, v0, v1)` with the plane's place and the face's two spans across it. */
function eachFace(l: Laid, visit: (facing: number, plane: number, u0: number, u1: number, v0: number, v1: number) => void): void {
  const bits = drawn(l.part), B = l.boxes, n = l.part.count;
  const to = [0, 1, 2, 3, 4, 5].map((f) => turned(f, l.turns));
  for (let i = 0; i < n; i++) {
    const b = bits[i];
    if (!b) continue;
    const at = i * 6;
    for (let f = 0; f < 6; f++) {
      if (!(b & (1 << f)) || (l.never & (1 << f))) continue;
      const w = to[f], axis = w >> 1, a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
      visit(w, B[at + axis + (w & 1 ? 3 : 0)], B[at + a1], B[at + a1 + 3], B[at + a2], B[at + a2 + 3]);
    }
  }
}

/** The whole cells whose middles a span covers: from, and to (inclusive; to < from when it covers none). */
const cellsOf = (lo: number, hi: number): [number, number] => [Math.ceil(lo / CELL - 0.5 - 1e-6), Math.ceil(hi / CELL - 0.5 - 1e-6) - 1];

function judgeFrame(laid: Laid[], cameras: Cameras): FrameResult {
  const result: FrameResult = { cells: 0, seen: 0, byFacing: [0, 0, 0, 0, 0, 0], seenByFacing: [0, 0, 0, 0, 0, 0], pairs: [], faces: 0 };
  if (laid.length < 2) return result;
  const keyOf = (facing: number, plane: number, bu: number, bv: number) => {
    const q = Math.round(plane / SAME) + PLANE_OFF;
    if (q < 0 || q >= 2 * PLANE_OFF || bu + UV_OFF < 0 || bu + UV_OFF >= UV_SPAN || bv + UV_OFF < 0 || bv + UV_OFF >= UV_SPAN) throw new Error('tools/scenes/coplanar.ts: a face lies further out than this stage can sort');
    return ((q * 6 + facing) * UV_SPAN + (bu + UV_OFF)) * UV_SPAN + (bv + UV_OFF);
  };
  // First: which buckets hold faces of two parts. A bucket's value is the one part seen there, or -1 for more.
  const seen = new Table();
  laid.forEach((l, li) => eachFace(l, (facing, plane, u0, u1, v0, v1) => {
    const [i0, i1] = cellsOf(u0, u1), [j0, j1] = cellsOf(v0, v1);
    if (i1 < i0 || j1 < j0) return;
    result.faces++;
    for (let bu = Math.floor(i0 / BUCKET); bu <= Math.floor(i1 / BUCKET); bu++) for (let bv = Math.floor(j0 / BUCKET); bv <= Math.floor(j1 / BUCKET); bv++) {
      const key = keyOf(facing, plane, bu, bv), was = seen.get(key);
      if (was === undefined) seen.set(key, li); else if (was !== li && was !== -1) seen.set(key, -1);
    }
  }));
  // Then: the faces in those buckets, kept by bucket.
  const shared = new Map<number, number[]>();
  laid.forEach((l, li) => eachFace(l, (facing, plane, u0, u1, v0, v1) => {
    const [i0, i1] = cellsOf(u0, u1), [j0, j1] = cellsOf(v0, v1);
    if (i1 < i0 || j1 < j0) return;
    for (let bu = Math.floor(i0 / BUCKET); bu <= Math.floor(i1 / BUCKET); bu++) for (let bv = Math.floor(j0 / BUCKET); bv <= Math.floor(j1 / BUCKET); bv++) {
      const key = keyOf(facing, plane, bu, bv);
      if (seen.get(key) !== -1) continue;
      let list = shared.get(key);
      if (!list) shared.set(key, (list = [facing, plane, bu, bv]));
      list.push(li, Math.max(i0, bu * BUCKET) - bu * BUCKET, Math.min(i1, bu * BUCKET + BUCKET - 1) - bu * BUCKET, Math.max(j0, bv * BUCKET) - bv * BUCKET, Math.min(j1, bv * BUCKET + BUCKET - 1) - bv * BUCKET);
    }
  }));
  // Last: each such bucket, cell by cell. A cell two parts cover is counted once, and once for each pair of them.
  const pairs = new Map<number, Pair>();
  const owner = new Int32Array(BUCKET * BUCKET), more = new Map<number, number[]>();
  for (const list of shared.values()) {
    const facing = list[0], plane = list[1], bu = list[2], bv = list[3];
    // Can a camera stand in front of this plane, on the side these faces look to?
    const inFront = facing & 1 ? cameras.hi[facing >> 1] > plane + SAME : cameras.lo[facing >> 1] < plane - SAME;
    owner.fill(-1);
    more.clear();
    for (let k = 4; k < list.length; k += 5) {
      const li = list[k];
      for (let i = list[k + 1]; i <= list[k + 2]; i++) for (let j = list[k + 3]; j <= list[k + 4]; j++) {
        const cell = i * BUCKET + j, first = owner[cell];
        if (first === -1) owner[cell] = li;
        else if (first !== li) { const others = more.get(cell); if (!others) more.set(cell, [li]); else if (!others.includes(li)) others.push(li); }
      }
    }
    for (const [cell, others] of more) {
      result.cells++;
      result.byFacing[facing]++;
      if (inFront) { result.seen++; result.seenByFacing[facing]++; }
      const all = [owner[cell], ...others];
      const i = Math.floor(cell / BUCKET), j = cell % BUCKET;
      const u = (bu * BUCKET + i + 0.5) * CELL, v = (bv * BUCKET + j + 0.5) * CELL;
      const axis = facing >> 1, at: [number, number, number] = [0, 0, 0];
      at[axis] = plane; at[(axis + 1) % 3] = u; at[(axis + 2) % 3] = v;
      for (let x = 0; x < all.length; x++) for (let y = x + 1; y < all.length; y++) {
        const lo = Math.min(all[x], all[y]), hi = Math.max(all[x], all[y]);
        let pair = pairs.get(lo * 65536 + hi);
        if (!pair) pairs.set(lo * 65536 + hi, (pair = { a: laid[lo], b: laid[hi], cells: 0, seen: 0, box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], facings: 0 }));
        pair.cells++;
        if (inFront) pair.seen++;
        pair.facings |= 1 << facing;
        for (let k = 0; k < 3; k++) { if (at[k] < pair.box[k]) pair.box[k] = at[k]; if (at[k] > pair.box[k + 3]) pair.box[k + 3] = at[k]; }
      }
    }
  }
  result.pairs = [...pairs.values()];
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------------------------------

const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
/** Cells to square metres: whole cells of 0.0025 m2, so the figure is exact to four places. */
const metres = (cells: number) => Math.round(cells * 25) / 10000;
const m2 = (cells: number) => metres(cells).toFixed(metres(cells) >= 10 ? 1 : 2);
const f2 = (v: number) => v.toFixed(2);
/** A mount without its numbers: the chunks of one builder are one line of a report. */
const family = (text: string) => text.replace(/\[\d+\]/g, '[*]');
const neverOf = (mount: string) => DROPPED.find((d) => d.mount.test(mount))?.never ?? 0;

/** The frames of a scene: everything that rests on the world's axes together, and each thing that does not, alone. */
function framesOf(scene: Scene): { frames: { name: string; thing: string | null; laid: Laid[] }[]; unjudged: string[] } {
  const rest: Laid[] = [], frames: { name: string; thing: string | null; laid: Laid[] }[] = [{ name: 'at rest', thing: null, laid: rest }];
  const unjudged: string[] = [];
  for (const part of scene.world) {
    const B = boxes(part);
    if (B) rest.push({ part, boxes: B, turns: part.turns, never: neverOf(part.mount), name: `${part.mount}: ${part.label}` }); else unjudged.push(part.mount);
  }
  for (const thing of scene.things) {
    const own: Laid[] = [];
    for (const part of thing.parts) {
      const world = thing.aligned ? restBoxes(part, thing) : null;
      // A thing's own quarter turns: its resting rotation is a turn about y alone when it is aligned.
      const q = thing.aligned ? Math.round(thing.at.rotation[1] / (Math.PI / 2)) : 0;
      const name = `thing "${thing.name}": ${part.mount}: ${part.label}`;
      if (world) rest.push({ part, boxes: world, turns: part.turns + q, never: neverOf(part.mount), name });
      else { const B = boxes(part); if (B) own.push({ part, boxes: B, turns: part.turns, never: neverOf(part.mount), name }); else unjudged.push(part.mount); }
    }
    if (own.length) frames.push({ name: `thing "${thing.name}"`, thing: thing.name, laid: own });
  }
  return { frames, unjudged };
}

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const lost = lostPins(options.root);
  if (lost.length) {
    return {
      ok: false, summary: `NOT RUN: tools/scenes/coplanar.ts copies which faces the game drops, and ${plural(lost.length, 'line')} of that ${lost.length === 1 ? 'is' : 'are'} gone or changed`,
      lines: ['tools/scenes/coplanar.ts copies which faces the game drops from these lines, which are gone or changed:', ...lost.map((l) => `    ${l}`), 'Read the builder again and bring `DROPPED` and `PINS` in coplanar.ts up to date with it.'],
      measured: {}, failures: [], data: { lost },
    };
  }
  const lines: string[] = [], failures: Failure[] = [];
  const show = typeof options.flags.show === 'string' ? options.flags.show : null;
  const measured = { area: {} as Record<string, Record<string, number>>, seen: {} as Record<string, Record<string, number>>, excused: {} as Record<string, Record<string, number>> };
  const data: { scenes: unknown[] } = { scenes: [] };
  const total = { cells: 0, seen: 0, excused: 0, pairs: 0 };
  const notJudged: string[] = [];

  for (const scene of world.scenes.filter((s) => options.scenes.includes(s.name))) {
    const t0 = performance.now();
    // Where this scene's cameras stand: the lens stage's paths.
    const cams = await cameraPlaces(world, options.root, scene.name, scene.detail);
    if (cams.lost.length || !cams.places.length) {
      const why = cams.lost.length ? `tools/scenes/lens.ts copies how the game moves its cameras, and ${plural(cams.lost.length, 'line')} of that ${cams.lost.length === 1 ? 'is' : 'are'} gone or changed` : `tools/scenes/lens.ts knows no camera for the scene "${scene.name}"`;
      return { ok: false, summary: `NOT RUN: which faces a camera can stand in front of is not known: ${why}`, lines: [why, ...cams.lost.map((l) => `    ${l}`)], measured: {}, failures: [], data: { lost: cams.lost } };
    }
    const { bodies } = bodiesOf(scene);
    const camerasIn = (thing: string | null): Cameras => {
      const into = thing === null ? null : bodies.find((b) => b.name === thing)?.into ?? null;
      const box: Cameras = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }, v = new Vector3();
      for (const p of cams.places) {
        v.set(p[0], p[1], p[2]);
        if (into) v.applyMatrix4(into);
        box.lo[0] = Math.min(box.lo[0], v.x); box.lo[1] = Math.min(box.lo[1], v.y); box.lo[2] = Math.min(box.lo[2], v.z);
        box.hi[0] = Math.max(box.hi[0], v.x); box.hi[1] = Math.max(box.hi[1], v.y); box.hi[2] = Math.max(box.hi[2], v.z);
      }
      return box;
    };

    let cells = 0, seen = 0, faces = 0;
    const byFacing = [0, 0, 0, 0, 0, 0], seenByFacing = [0, 0, 0, 0, 0, 0];
    const pairs: Pair[] = [];
    const { frames, unjudged } = framesOf(scene);
    for (const mount of unjudged) notJudged.push(`${scene.name} (${scene.detail}): "${mount}" is turned off the axes inside its own body and has no faces to lay out`);
    for (const frame of frames) {
      if (frame.thing !== null && !bodies.some((b) => b.name === frame.thing)) { notJudged.push(`${scene.name} (${scene.detail}): ${frame.name} is scaled unevenly: its faces are counted, and none as seen`); }
      const r = judgeFrame(frame.laid, frame.thing !== null && !bodies.some((b) => b.name === frame.thing) ? { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] } : camerasIn(frame.thing));
      cells += r.cells; seen += r.seen; faces += r.faces;
      r.byFacing.forEach((n, f) => { byFacing[f] += n; });
      r.seenByFacing.forEach((n, f) => { seenByFacing[f] += n; });
      pairs.push(...r.pairs);
    }
    // The pairs, gathered by the code that built each side: the chunks of one builder are one line.
    interface Group { source: string; cells: number; seen: number; pairs: number; within: number; box: Pair['box']; facings: number; excusedBy: string | null }
    const groups = new Map<string, Group>();
    for (const p of pairs) {
      const source = [family(p.a.name), family(p.b.name)].sort().join(' | ');
      const entry = options.exempt.find((e) => e.scene === scene.name && (source.includes(e.match) || `${p.a.name} | ${p.b.name}`.includes(e.match)));
      let g = groups.get(source);
      if (!g) groups.set(source, (g = { source, cells: 0, seen: 0, pairs: 0, within: 0, box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], facings: 0, excusedBy: entry ? entry.match : null }));
      g.cells += p.cells; g.seen += p.seen; g.pairs++; g.facings |= p.facings;
      if (p.a.part.mesh === p.b.part.mesh) g.within += p.cells;
      for (let k = 0; k < 3; k++) { g.box[k] = Math.min(g.box[k], p.box[k]); g.box[k + 3] = Math.max(g.box[k + 3], p.box[k + 3]); }
    }
    const sorted = [...groups.values()].sort((a, b) => b.cells - a.cells || (a.source < b.source ? -1 : 1));
    // A cell where three parts meet is in three pairs and counted once in the scene: the excused share is taken pair by
    // pair, and never more than the scene holds.
    const excused = sorted.filter((g) => g.excusedBy);
    const excusedCells = Math.min(cells, excused.reduce((n, g) => n + g.cells, 0)), excusedSeen = Math.min(seen, excused.reduce((n, g) => n + g.seen, 0));
    const within = Math.min(cells, sorted.reduce((n, g) => n + g.within, 0));
    const facingsOf = (counts: number[]) => counts.map((n, f) => (n ? `${FACING[f]} ${m2(n)}` : '')).filter(Boolean).join(', ') || 'none';
    lines.push('', `### ${scene.name} (${scene.detail}): ${m2(cells)} m2 of faces on one plane, facing one way, from two parts; ${m2(seen)} m2 of it on a side a camera can stand in front of (${count(faces)} drawn faces, ${plural(pairs.length, 'pair')} of parts)`);
    if (cells) {
      lines.push(`  by the way they face: ${facingsOf(byFacing)}; where a camera can stand in front: ${facingsOf(seenByFacing)}`);
      lines.push(`  between two meshes ${m2(cells - within)} m2; between two voxel sets merged into one mesh ${m2(within)} m2`);
      lines.push('        all       seen');
    }
    const top = show !== null ? sorted.filter((g) => g.source.includes(show)) : sorted.slice(0, 8);
    for (const g of top) {
      const facings = FACING.filter((_, f) => g.facings & (1 << f)).join(' ');
      lines.push(`  ${m2(g.cells).padStart(8)} ${m2(g.seen).padStart(8)} m2  ${g.source}   x ${f2(g.box[0])}..${f2(g.box[3])} y ${f2(g.box[1])}..${f2(g.box[4])} z ${f2(g.box[2])}..${f2(g.box[5])}   facing ${facings}${g.excusedBy ? `   [excused by EXEMPT.json: ${g.excusedBy}]` : ''}`);
    }
    if (show === null && sorted.length > top.length) lines.push(`                       and ${plural(sorted.length - top.length, 'smaller pair of sources', 'smaller pairs of sources')}, ${m2(sorted.slice(top.length).reduce((n, g) => n + g.cells, 0))} m2 between them (--show=<text> lists every one that matches)`);
    if (sorted.length > 1) lines.push('  (a cell where three parts meet is in three of these lines and counted once in the scene\'s figure)');
    for (const g of sorted) {
      failures.push({
        scene: scene.name, detail: scene.detail,
        what: `${m2(g.cells)} m2 of faces on one plane facing one way (${FACING.filter((_, f) => g.facings & (1 << f)).join(' ')}) between two parts, ${m2(g.seen)} m2 of it on a side a camera can stand in front of`,
        where: `x ${f2(g.box[0])}..${f2(g.box[3])} y ${f2(g.box[1])}..${f2(g.box[4])} z ${f2(g.box[2])}..${f2(g.box[5])}`,
        source: g.source,
        ...(g.excusedBy ? { excusedBy: g.excusedBy } : {}),
      });
    }
    (measured.area[scene.name] ??= {})[scene.detail] = metres(cells - excusedCells);
    (measured.seen[scene.name] ??= {})[scene.detail] = metres(seen - excusedSeen);
    (measured.excused[scene.name] ??= {})[scene.detail] = metres(excusedCells);
    total.cells += cells - excusedCells; total.seen += seen - excusedSeen; total.excused += excusedCells; total.pairs += sorted.length;
    data.scenes.push({
      scene: scene.name, detail: scene.detail, area: metres(cells - excusedCells), seen: metres(seen - excusedSeen), excused: metres(excusedCells), faces,
      byFacing: Object.fromEntries(FACING.map((name, f) => [name, metres(byFacing[f])])), seenByFacing: Object.fromEntries(FACING.map((name, f) => [name, metres(seenByFacing[f])])),
      betweenMeshes: metres(cells - within), withinOneMesh: metres(within),
      sources: sorted.map((g) => ({ source: g.source, area: metres(g.cells), seen: metres(g.seen), pairs: g.pairs, facing: FACING.filter((_, f) => g.facings & (1 << f)), excusedBy: g.excusedBy })),
    });
    options.log(`${scene.name} (${scene.detail}): ${count(faces)} faces in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }

  lines.push('', 'Faces left out because the game takes them off after meshing:');
  for (const d of DROPPED) lines.push(`  ${d.why}`);
  lines.push('  (where the game drops a face by where it lies, the yard\'s ground, the bedroom\'s walls and the dream\'s raft, the face is counted as drawn)');
  if (notJudged.length) lines.push('', 'Not judged:', ...[...new Set(notJudged)].map((n) => `  ${n}`));
  for (const e of options.exempt) lines.push('', `EXEMPT.json, ${e.scene}, match ${e.match}${e.status === 'pending' ? ' (PENDING: Brian has not answered)' : ''}`);

  const summary = `${m2(total.cells)} m2 of faces on one plane facing one way between two parts, ${m2(total.seen)} m2 of it where a camera can stand in front, in ${plural(total.pairs, 'pair of sources', 'pairs of sources')} over ${world.details.join(' and ')}; ${m2(total.excused)} m2 more excused by EXEMPT.json`;
  lines.push('', total.cells || total.excused ? `${m2(total.cells)} m2 in all. The largest are named above with the code that built them.` : 'No two parts share a face.');
  return { ok: true, summary, lines, measured, failures, data };
}
