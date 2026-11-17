/**
 * Builds every scene and model of the painted game the way the game builds them, catches every voxel set the mesher
 * is given (the `__voxelHook` in src/skin/voxel/mesher.ts) and lays each one where the game draws it. The scene
 * checker's stages (plan file 18, section 4.2) all read the result. README.md beside this file is the interface in
 * full; the types below are the same thing for the compiler.
 *
 * How it works, in short:
 *   - The game's builders run in their own module graphs, one for each detail level, inside this one process
 *     (vite-node's own server and runner, made here). `coarse()` in src/skin/voxel/refine.ts reads
 *     matchMedia('(pointer: coarse)'), so globalThis.matchMedia is set before a coarse graph imports anything and for
 *     as long as it builds. Builders keep what they built (pen, duel, countryside, festive, bedroom), which is why one
 *     graph cannot build both.
 *   - The hook hands over the voxels before the mesher has made a geometry. Which geometry came of which voxels, and
 *     how far the builder moved it afterwards (`.translate`), is followed on three's BufferGeometry itself: see `tap`.
 *   - Where the game then draws each geometry is written down here, scene by scene, from the component that mounts it
 *     (`SCENES_BUILT`). The lines of the component each list copies are pinned (`mirrors`): a line that is no longer
 *     in the file stops the build, so the copy cannot drift quietly. A voxel set no list places stops it too.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { ViteNodeRunner } from 'vite-node/client';
import { ViteNodeServer } from 'vite-node/server';
import { installSourcemapsSupport } from 'vite-node/source-map';

// ---------------------------------------------------------------------------------------------------------------------
// What the stages get
// ---------------------------------------------------------------------------------------------------------------------

export type V3 = [number, number, number];
/** `fine` is what a computer builds; `coarse` what a touch device builds (and, for the dream, a narrow screen). */
export type Detail = 'fine' | 'coarse';
export const DETAILS: readonly Detail[] = ['fine', 'coarse'];
/** The scenes, in the order they are built and reported. */
export const SCENE_NAMES = ['table', 'farm', 'duel', 'pen', 'bedroom', 'dream', 'podium'] as const;
export type SceneName = (typeof SCENE_NAMES)[number];

/**
 * One voxel set where the game draws it: what one call of the mesher was given, on one mesh. A set drawn twice (the
 * mountains behind the barn and, turned round, in front of it; one hay bale twelve times) is two parts that share
 * their arrays.
 */
export interface Part {
  /** The scene, or the model's id for a part of a model. */
  scene: string;
  detail: Detail;
  /** Its place in `scene.parts` (or `model.parts`). */
  index: number;
  /** The code that built it, as tools/floatingVoxels.ts wrote it: "ground scene/pen.ts:107 < make scene/pen.ts:64". */
  label: string;
  /**
   * What the game calls the geometry it is drawn from: "pen.ground", "barn.doorLeaves[0]"; in a model, where it is in
   * what the builder returned ("wools.2", "legs[0]"), or the model's id when the builder returned the one geometry.
   */
  mount: string;
  /** Parts merged into one geometry share this number: one mesh, one draw. */
  mesh: number;
  /**
   * 'world' when the game draws it with a transform that never changes and keeps its voxels on the world's axes
   * (none at all, a move, a quarter or half turn about y, one scale): `boxes(part)` are world metres. Anything else is
   * the name of the thing a mesh transform sets down or moves ("cat", "raft", "island B"): see `Thing`.
   */
  body: string;
  /** The cell size in metres. */
  size: number;
  /** How many voxels. */
  count: number;
  /** x, y, z of every voxel in whole cells, three numbers each. */
  cells: Int32Array;
  /** Linear red, green, blue of every voxel, 0 to 1, three numbers each (the mesher's `c`). */
  colors: Float32Array;
  /** Where the builder moved the geometry after meshing it (`.translate`), in metres. */
  offset: V3;
  /** Where its mesh sits in its body's frame (the world's, or its thing's), in metres, after `turns` and `scale`. */
  local: V3;
  /** Quarter turns about y in its body's frame, 0 to 3 (three's sense: one turn takes +z to +x). */
  turns: number;
  /** One scale for all three axes in its body's frame. */
  scale: number;
  /** False when its mesh is turned off the axes inside its body, so it has no boxes. */
  aligned: boolean;
  /** The number of the mesher call it came from, the same for every part that draws that set. */
  set: number;
}

/**
 * Something a mesh transform sets down in a scene or moves about in it: the cat, a door leaf standing open, the
 * dream's raft. Its parts are laid out in its own frame; `at` is where that frame rests in the world.
 */
export interface Thing {
  name: string;
  scene: string;
  detail: Detail;
  /** Where it rests: position in metres, rotation as three's Euler angles in the order 'YXZ' (so a turn about y alone reads [0, turn, 0]), scale. */
  at: { position: V3; rotation: V3; scale: V3 };
  /** What moves it, in the component's own words, or null when it is only set down. */
  moves: string | null;
  /** True when it rests on the world's axes (a move, quarter turns about y, one scale): `restBoxes` can place it. */
  aligned: boolean;
  parts: Part[];
}

export interface Scene {
  name: SceneName;
  detail: Detail;
  /** Every part, in the order the game mounts them. */
  parts: Part[];
  /** The parts whose body is 'world'. */
  world: Part[];
  things: Thing[];
  /** Voxels over all parts. */
  voxels: number;
  /** SHA-256 over every part's mount, body, cell size, placement, cells and colours: the scene as built. */
  hash: string;
  /** What was built and is not drawn at rest, or is not what the game shows, each with why. */
  notes: string[];
}

/** A model that stands alone (an animal, a bomb skin, a prop), in its own frame. */
export interface Model {
  id: string;
  /** 'animal', 'bomb', 'burst', 'tick', 'sack', 'prop'. */
  kind: string;
  detail: Detail;
  parts: Part[];
  /** What the game's builder returned (an `AnimalModel`, a `BombLook`, a `Grid`...), from the graph it was built in. */
  built: unknown;
  /** The parts drawn from one of the builder's geometries. */
  partsOf(geometry: BufferGeometry): Part[];
  hash: string;
  /** Voxel sets the builder meshed while building this and did not hand back (the goat's fringe, drawn with its body). */
  notes: string[];
}

export interface World {
  /** The detail levels built in this run. */
  details: Detail[];
  /** Every scene built, at every detail level built, in order. */
  scenes: Scene[];
  /** One scene; throws when this run did not build it (`--scene`, `--details`). */
  scene(name: SceneName, detail: Detail): Scene;
  /** The standing models (`MODEL_IDS`), built at the fine level. Empty when this run built none. */
  models: Model[];
  /** One model by id; throws when there is none. */
  model(id: string): Model;
  /**
   * Imports a game file from the module graph a detail level was built in, so what it exports is what the world was
   * built with (its own kept models and constants), not a second copy. The path is from the repo's root.
   */
  load<T = Record<string, unknown>>(path: string, detail?: Detail): Promise<T>;
  /**
   * Builds something more, catching its voxels the same way: `build` is given `load` and returns what the game's
   * builder returned; every geometry and Grid in it becomes a part of the model handed back.
   */
  capture(id: string, kind: string, build: (load: World['load']) => unknown | Promise<unknown>, detail?: Detail): Promise<Model>;
  /** Seconds each build took, for the report: scene:detail and "models". */
  seconds: Record<string, number>;
  /** Stops the module server. The world's data stays; `load` and `capture` no longer work. */
  close(): Promise<void>;
}

/** One entry of docs/visual-overhaul/EXEMPT.json (plan file 18, section 4.6). */
export interface Exemption {
  check: string;
  scene: string;
  match: string;
  reason: string;
  /** 'pending' while Brian has not answered; absent once his words are in. */
  status?: 'pending';
  brian: { date: string | null; words: string | null };
}

/** One thing a stage found wrong, named so a person can find it. */
export interface Failure {
  scene: string;
  detail: Detail | 'both';
  /** What is wrong, in a sentence. */
  what: string;
  /** Where, in metres, or a name: "(1.20, 4.10, 2.05)", "x -2.00..3.00 y 0.50..1.00 z 4.00..4.50". */
  where: string;
  /** The code that built it: a part's `mount` and `label`. */
  source: string;
  /** Set when an entry of EXEMPT.json excuses it: the entry's match. Excused failures are still listed and counted. */
  excusedBy?: string;
}

export interface StageOptions {
  /** The repo, an absolute path. */
  root: string;
  /** The scenes this run is about (all seven unless `--scene` named some). */
  scenes: SceneName[];
  details: Detail[];
  /** The entries of EXEMPT.json whose `check` is this stage's id. */
  exempt: Exemption[];
  /** This stage's stored ratchets (the `scenes.<id>` part of RATCHETS.json), or undefined when nothing is stored. */
  stored: unknown;
  /** Flags check.ts does not know itself, for a stage's own use: `--show=pine` is { show: 'pine' }, `--all` is { all: true }. */
  flags: Record<string, string | true>;
  /** A directory this stage may write into (under the gate's cache). Never write into the repo. */
  cache: string;
  /** Prints a line as the stage runs. */
  log(line: string): void;
}

export interface StageResult {
  /**
   * False only for what no stored number can allow: the stage could not do its work, or found something that must
   * never be. A known failure does not make it false: it is one entry of `failures` and one count in `measured`, and
   * the stored ratchet decides whether that count may stand.
   */
  ok: boolean;
  /** One line. Starts "NOT RUN:" when the stage could not do its work. */
  summary: string;
  /** The report, as lines. */
  lines: string[];
  /** Numbers that may only fall, any depth. Hand in a zero too: a number that is always there cannot be seeded later. */
  measured: Record<string, unknown>;
  /** Every failure, known or new, excused or not, by name. */
  failures: Failure[];
  /** Anything else, for the JSON. No times, no absolute paths. */
  data: unknown;
}

/** A stage is tools/scenes/<id>.ts exporting these. */
export interface Stage {
  id: string;
  run(world: World, options: StageOptions): StageResult | Promise<StageResult>;
  /** What it reads, so a run of this stage alone need not build the rest. Left out, everything is built. */
  needs?: { scenes?: SceneName[] | 'all' | 'none'; models?: boolean };
}

/** The stages, in the order they run. */
export const STAGE_IDS = ['connect', 'place', 'lights', 'coplanar', 'lens', 'models', 'wendigo', 'baked'] as const;

// ---------------------------------------------------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------------------------------------------------

const boxCache = new WeakMap<Part, Float64Array>();

/**
 * Every voxel of a part as a box in its body's frame, six numbers each (x0, y0, z0, x1, y1, z1), in metres: world
 * metres for a part whose body is 'world', the thing's own frame otherwise. Null when the part is turned off the axes
 * inside its body. Kept once made.
 */
export function boxes(part: Part): Float64Array | null {
  if (!part.aligned) return null;
  let out = boxCache.get(part);
  if (out) return out;
  out = new Float64Array(part.count * 6);
  const { cells, size, offset, local, turns, scale } = part;
  for (let i = 0; i < part.count; i++) {
    const a: V3 = [(cells[i * 3] * size + offset[0]) * scale, (cells[i * 3 + 1] * size + offset[1]) * scale, (cells[i * 3 + 2] * size + offset[2]) * scale];
    const s = size * scale;
    place(out, i * 6, a, [a[0] + s, a[1] + s, a[2] + s], turns, local);
  }
  boxCache.set(part, out);
  return out;
}

/** Writes the box a..b, turned `turns` quarter turns about y and moved by `move`, at `at` in `out`. */
function place(out: Float64Array, at: number, a: V3, b: V3, turns: number, move: V3) {
  let x0 = a[0], z0 = a[2], x1 = b[0], z1 = b[2];
  for (let k = 0; k < turns; k++) {
    // One quarter turn about y, three's sense: x' = z, z' = -x.
    [x0, z0, x1, z1] = [z0, -x1, z1, -x0];
  }
  out[at] = x0 + move[0]; out[at + 1] = a[1] + move[1]; out[at + 2] = z0 + move[2];
  out[at + 3] = x1 + move[0]; out[at + 4] = b[1] + move[1]; out[at + 5] = z1 + move[2];
}

/** How many quarter turns about y a rotation is (0 to 3), or null when it is anything else. */
export function quarterTurns(rotation: V3): number | null {
  if (Math.abs(rotation[0]) > 1e-9 || Math.abs(rotation[2]) > 1e-9) return null;
  const q = rotation[1] / (Math.PI / 2);
  if (Math.abs(q - Math.round(q)) > 1e-9) return null;
  return ((Math.round(q) % 4) + 4) % 4;
}

/**
 * Every voxel of a part as a box in world metres, where the game draws it at rest. For a part whose body is 'world'
 * this is `boxes(part)`. For a part of a thing it is that box carried by the thing's resting transform, or null when
 * the thing rests turned off the axes (a door leaf standing open) or the part does inside it.
 */
export function restBoxes(part: Part, thing?: Thing): Float64Array | null {
  const own = boxes(part);
  if (!own || part.body === 'world') return own;
  if (!thing) throw new Error(`restBoxes: "${part.mount}" is part of the thing "${part.body}": pass that thing`);
  if (!thing.aligned) return null;
  const turns = quarterTurns(thing.at.rotation) ?? 0, s = thing.at.scale[0];
  const out = new Float64Array(own.length);
  for (let i = 0; i < own.length; i += 6) {
    place(out, i, [own[i] * s, own[i + 1] * s, own[i + 2] * s], [own[i + 3] * s, own[i + 4] * s, own[i + 5] * s], turns, thing.at.position);
  }
  return out;
}

/** The thing a part belongs to, or null for a part of the world. */
export function thingOf(scene: Scene, part: Part): Thing | null {
  return part.body === 'world' ? null : scene.things.find((t) => t.name === part.body) ?? null;
}

/**
 * A scene as it stands at rest: every part that has world boxes, with them. The world's parts always do; a thing's
 * parts do when the thing rests on the axes. `things: false` leaves the things out (the static scene alone, which is
 * what a ray cast down to find the floor wants); what could not be laid out is in `turned`.
 */
export function atRest(scene: Scene, { things = true } = {}): { laid: { part: Part; thing: Thing | null; boxes: Float64Array }[]; turned: Part[] } {
  const laid: { part: Part; thing: Thing | null; boxes: Float64Array }[] = [], turned: Part[] = [];
  for (const part of scene.parts) {
    const thing = thingOf(scene, part);
    if (thing && !things) continue;
    const b = restBoxes(part, thing ?? undefined);
    if (b) laid.push({ part, thing, boxes: b }); else turned.push(part);
  }
  return { laid, turned };
}

// ---------------------------------------------------------------------------------------------------------------------
// The tap: which geometry came of which voxels
// ---------------------------------------------------------------------------------------------------------------------

type VoxelMapLike = Map<string, { x: number; y: number; z: number; c: [number, number, number] }>;
interface Capture { id: number; label: string; size: number; count: number; cells: Int32Array; colors: Float32Array; uses: number; skipped: string | null }
/** One voxel set inside a geometry, and how the geometry has been moved since the mesher made it. */
interface Entry { capture: Capture; m: Matrix4 }

/** What one detail level's graph has built so far. */
interface Session {
  detail: Detail;
  captures: Capture[];
  /** Set by the hook, taken by the next geometry the mesher finishes. */
  pending: Capture | null;
  /** A finished geometry with no voxels of its own yet: what `dropFaces` is about to hand back. */
  orphan: BufferGeometry | null;
  lineage: WeakMap<BufferGeometry, Entry[]>;
  /** Geometries that hold voxels and that no list has placed yet, in the order they were made. */
  fresh: Set<BufferGeometry>;
  meshes: number;
}

interface Tap { session: Session | null; installed: boolean }
const tap: Tap = ((globalThis as { __sceneTap?: Tap }).__sceneTap ??= { session: null, installed: false });

/** The code that asked for a geometry, read off the stack exactly as tools/floatingVoxels.ts reads it. */
function caller(): string {
  const lines = (new Error().stack ?? '').split('\n').slice(3);
  const own = lines.filter((l) => /src\/skin/.test(l) && !/mesher\.ts|refine\.ts|primitives\.ts/.test(l)).slice(0, 2);
  // "Module.buildBarn" is the same function called through its module, which is how this tool calls every builder.
  return own.map((l) => l.trim().replace(/^at /, '').replace(/^Module\./, '').replace(/\(?\/.*\/src\/skin\//, '').replace(/\)$/, '').replace(/:\d+$/, '')).join(' < ');
}

function record(session: Session, label: string, vox: VoxelMapLike, size: number): Capture {
  const count = vox.size, cells = new Int32Array(count * 3), colors = new Float32Array(count * 3);
  let i = 0;
  for (const v of vox.values()) {
    cells[i] = v.x; cells[i + 1] = v.y; cells[i + 2] = v.z;
    colors[i] = v.c[0]; colors[i + 1] = v.c[1]; colors[i + 2] = v.c[2];
    i += 3;
  }
  const capture: Capture = { id: session.captures.length, label, size, count, cells, colors, uses: 0, skipped: null };
  session.captures.push(capture);
  return capture;
}

/** True when `small` starts with a face that is also somewhere in `big` (the mesher writes four corners a face). */
function sharesFirstFace(small: BufferGeometry, big: BufferGeometry): boolean {
  const a = small.getAttribute('position')?.array, b = big.getAttribute('position')?.array;
  if (!a || !b) return false;
  if (a.length === 0) return true; // every face was dropped
  if (a.length > b.length) return false;
  for (let at = 0; at + 12 <= b.length; at += 12) {
    let same = true;
    for (let k = 0; k < 12 && same; k++) same = a[k] === b[at + k];
    if (same) return true;
  }
  return false;
}

/**
 * Follows a geometry from the mesher to the mesh, by wrapping four methods of three's BufferGeometry for as long as
 * this process lives. Only this tool does it, and only in the process that runs it.
 *   computeBoundingSphere   the mesher's last step: the geometry takes the voxels the hook has just been given;
 *   applyMatrix4            `.translate()` and its kin: the move is added to every voxel set in the geometry;
 *   copy                    `.clone()`: the copy holds what the original held;
 *   dispose                 `dropFaces` (src/skin/scene/yard.ts) makes a new geometry from the kept faces and
 *                           disposes of the old one: the new one takes over what the old one held.
 * A geometry made by `mergeGeometries` is recognised when it is placed: `cover`.
 */
function install() {
  if (tap.installed) return;
  tap.installed = true;
  const P = BufferGeometry.prototype as unknown as Record<string, (this: BufferGeometry, ...args: never[]) => unknown>;
  const { computeBoundingSphere, applyMatrix4, copy, dispose } = P;
  P.computeBoundingSphere = function (this: BufferGeometry) {
    const s = tap.session;
    if (s) {
      if (s.pending) {
        s.lineage.set(this, [{ capture: s.pending, m: new Matrix4() }]);
        s.fresh.add(this);
        s.pending = null;
      } else if (!s.lineage.has(this)) s.orphan = this;
    }
    return computeBoundingSphere.call(this);
  };
  P.applyMatrix4 = function (this: BufferGeometry, m: Matrix4) {
    for (const e of tap.session?.lineage.get(this) ?? []) e.m.premultiply(m);
    return applyMatrix4.call(this, m as never);
  } as never;
  P.copy = function (this: BufferGeometry, source: BufferGeometry) {
    const out = copy.call(this, source as never);
    const s = tap.session, held = s?.lineage.get(source);
    if (s && held) {
      s.lineage.set(this, held.map((e) => ({ capture: e.capture, m: e.m.clone() })));
      s.fresh.add(this);
    }
    return out;
  } as never;
  P.dispose = function (this: BufferGeometry) {
    const s = tap.session;
    if (s) {
      const held = s.lineage.get(this), heir = s.orphan;
      if (held && heir && heir !== this && !s.lineage.has(heir) && sharesFirstFace(heir, this)) {
        s.lineage.set(heir, held);
        s.fresh.add(heir);
        s.lineage.delete(this);
        s.fresh.delete(this);
      }
      s.orphan = null;
    }
    return dispose.call(this);
  };
  (globalThis as { __voxelHook?: (vox: VoxelMapLike, size: number) => void }).__voxelHook = (vox, size) => {
    const s = tap.session;
    if (!s) return;
    if (s.pending) throw new Error(`tools/scenes/build.ts: the mesher was given "${s.pending.label}" and never finished a geometry for it`);
    if (vox.size === 0) return; // an empty set makes an empty geometry: nothing to place
    s.pending = record(s, caller(), vox, size);
  };
}

/** The voxel sets a geometry holds. A merged geometry (no record of its own) is matched to what it was merged from. */
function held(s: Session, geometry: BufferGeometry, name: string): Entry[] {
  const known = s.lineage.get(geometry);
  if (known) return known;
  const P = geometry.getAttribute('position')?.array;
  if (!P) throw new Error(`tools/scenes/build.ts: "${name}" has no positions: it is not a geometry the mesher made`);
  // mergeGeometries writes its inputs' positions one after another: find them among the geometries not yet placed.
  const out: Entry[] = [], used: BufferGeometry[] = [];
  let at = 0;
  while (at < P.length) {
    let found: BufferGeometry | null = null;
    for (const g of s.fresh) {
      if (used.includes(g)) continue;
      const Q = g.getAttribute('position').array;
      if (Q.length === 0 || at + Q.length > P.length) continue;
      let same = true;
      for (let k = 0; k < Q.length && same; k++) same = P[at + k] === Q[k];
      if (same) { found = g; break; }
    }
    if (!found) throw new Error(`tools/scenes/build.ts: cannot tell which voxels "${name}" is made of (it is not a geometry the mesher made, nor a merge of ones it made)`);
    out.push(...s.lineage.get(found)!.map((e) => ({ capture: e.capture, m: e.m.clone() })));
    used.push(found);
    at += found.getAttribute('position').array.length;
  }
  for (const g of used) s.fresh.delete(g);
  s.lineage.set(geometry, out);
  return out;
}

/** The move in a matrix that is nothing but a move; throws for anything else (no builder turns a geometry today). */
function moveOf(m: Matrix4, name: string): V3 {
  const e = m.elements, id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  for (let i = 0; i < 12; i++) if (Math.abs(e[i] - id[i]) > 1e-9) throw new Error(`tools/scenes/build.ts: the builder of "${name}" turned or scaled its geometry; only moves can be laid out`);
  return [e[12], e[13], e[14]];
}

// ---------------------------------------------------------------------------------------------------------------------
// Laying a scene out
// ---------------------------------------------------------------------------------------------------------------------

/** How a mesh is set, as the JSX says it: `at` a position, a `rotation` (three's default Euler, as in JSX), a `scale`; `moves` says what moves it, if anything does. */
interface How { at?: readonly [number, number, number]; rotation?: readonly [number, number, number]; scale?: number; moves?: string }

const matrixOf = (how: How | undefined): Matrix4 => new Matrix4().compose(
  new Vector3(...(how?.at ?? [0, 0, 0])),
  new Quaternion().setFromEuler(new Euler(...(how?.rotation ?? [0, 0, 0]))),
  new Vector3().setScalar(how?.scale ?? 1),
);

/** A transform as { position, rotation, scale }, and as quarter turns with one scale when that is all it is. */
function read(m: Matrix4) {
  const p = new Vector3(), q = new Quaternion(), s = new Vector3();
  m.decompose(p, q, s);
  const e = new Euler().setFromQuaternion(q, 'YXZ');
  const rotation: V3 = [e.x, e.y, e.z];
  const turns = quarterTurns(rotation);
  const even = Math.abs(s.x - s.y) < 1e-9 && Math.abs(s.x - s.z) < 1e-9 && s.x > 0;
  const round = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  return { position: [round(p.x), round(p.y), round(p.z)] as V3, rotation: [round(e.x), round(e.y), round(e.z)] as V3, scale: [s.x, s.y, s.z] as V3, turns, even };
}

class Layout {
  parts: Part[] = [];
  things: Thing[] = [];
  notes: string[] = [];
  constructor(private s: Session, readonly scene: string) {}

  private add(geometry: BufferGeometry, mount: string, body: string, m: Matrix4): Part[] {
    const entries = held(this.s, geometry, mount);
    this.s.fresh.delete(geometry);
    const mesh = this.s.meshes++;
    const t = read(m);
    const aligned = t.turns !== null && t.even;
    return entries.map((e) => {
      e.capture.uses++;
      const part: Part = {
        scene: this.scene, detail: this.s.detail, index: this.parts.length, label: e.capture.label, mount, mesh, body,
        size: e.capture.size, count: e.capture.count, cells: e.capture.cells, colors: e.capture.colors,
        offset: moveOf(e.m, mount), local: t.position, turns: t.turns ?? 0, scale: t.scale[0], aligned, set: e.capture.id,
      };
      this.parts.push(part);
      return part;
    });
  }

  /**
   * One mesh. Drawn where it was built, or with a transform that never changes: if that keeps its voxels on the
   * world's axes it is part of the world; if it does not (a door leaf standing open), or if something moves it
   * (`moves`), it is a thing of its own, named by its mount.
   */
  put(geometry: BufferGeometry, mount: string, how?: How): void {
    const m = matrixOf(how), t = read(m);
    if (!how?.moves && t.turns !== null && t.even) { this.add(geometry, mount, 'world', m); return; }
    this.thing(mount, how ?? {}, (thing) => thing.put(geometry, mount));
  }

  /** A group the game sets down or moves as one: its meshes are laid out inside it. `how` may be a chain of nested groups. */
  thing(name: string, how: How | How[], fill: (thing: { put(geometry: BufferGeometry, mount: string, how?: How): void }) => void): void {
    const chain = Array.isArray(how) ? how : [how];
    const m = chain.reduce((acc, h) => acc.multiply(matrixOf(h)), new Matrix4());
    const t = read(m);
    if (this.things.some((x) => x.name === name)) throw new Error(`tools/scenes/build.ts: two things are called "${name}" in ${this.scene}`);
    const thing: Thing = {
      name, scene: this.scene, detail: this.s.detail, at: { position: t.position, rotation: t.rotation, scale: t.scale },
      moves: chain.map((h) => h.moves).filter(Boolean).join('; ') || null, aligned: t.turns !== null && t.even, parts: [],
    };
    fill({ put: (geometry, mount, inside) => { thing.parts.push(...this.add(geometry, mount, name, matrixOf(inside))); } });
    this.things.push(thing);
  }

  /** Built by the game and not laid out: `why` goes into the scene's notes. */
  skip(geometry: BufferGeometry | null | undefined, mount: string, why: string): void {
    if (!geometry) return;
    for (const e of held(this.s, geometry, mount)) e.capture.skipped = why;
    this.s.fresh.delete(geometry);
    this.notes.push(`${mount}: not laid out: ${why}`);
  }
}

function hashParts(parts: Part[]): string {
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(JSON.stringify([p.mount, p.body, p.size, p.count, p.offset, p.local, p.turns, p.scale, p.aligned]));
    h.update(new Uint8Array(p.cells.buffer, p.cells.byteOffset, p.cells.byteLength));
    h.update(new Uint8Array(p.colors.buffer, p.colors.byteOffset, p.colors.byteLength));
  }
  return h.digest('hex');
}

// ---------------------------------------------------------------------------------------------------------------------
// The component lines each list below copies
// ---------------------------------------------------------------------------------------------------------------------

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const sources = new Map<string, string>();
const checkedPins = new Set<string>();

/**
 * Stops the build when a line this file copies is no longer in the component it was copied from. The lists below say
 * where each mesh is drawn because the game says it in JSX, which cannot be imported: this is what keeps them honest.
 */
function mirrors(file: string, lines: string[]): void {
  let text = sources.get(file);
  if (text === undefined) sources.set(file, (text = squash(readFileSync(resolve(ROOT, file), 'utf8'))));
  for (const line of lines) {
    const key = `${file}\n${line}`;
    if (checkedPins.has(key)) continue;
    if (!text.includes(squash(line))) {
      throw new Error(`tools/scenes/build.ts copies where ${file} draws its meshes, and this line of it is gone or changed:\n    ${line}\n  Read the component again and bring the scene's list in build.ts up to date with it.`);
    }
    checkedPins.add(key);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The scenes
// ---------------------------------------------------------------------------------------------------------------------

type Load = <T = Record<string, unknown>>(path: string) => Promise<T>;
type Barn = typeof import('../../src/skin/scene/barn');
type Yard = typeof import('../../src/skin/scene/yard');
type Distance = typeof import('../../src/skin/scene/distance');
type Festive = typeof import('../../src/skin/scene/festive');
type FestiveGeo = import('../../src/skin/scene/festive').FestiveGeometry;

/** What a detail level's graph keeps between scenes: the world the table and Home share, built once as the game does. */
interface Shared { farm?: { barn: ReturnType<Barn['buildBarn']>; yard: ReturnType<Yard['buildYard']>; distance: ReturnType<Distance['buildDistance']>; festive: FestiveGeo; CAT_SPOT: V3; ROBIN_SPOT: V3 } }

function putFestive(L: Layout, geo: FestiveGeo, name: string) {
  mirrors('src/skin/table/Festive.tsx', [
    '<mesh geometry={geo.decor} material={mat} castShadow receiveShadow />',
    '<mesh geometry={geo.star} material={star} />',
    '{geo.bulbs.map((g, i) => <mesh key={i} geometry={g} material={glow[i].mat} />)}',
  ]);
  L.put(geo.decor, `${name}.decor`);
  L.put(geo.star, `${name}.star`);
  geo.bulbs.forEach((g, i) => L.put(g, `${name}.bulbs[${i}]`));
}

/** The barn, the yard, the distance and the season: `Farm` in src/skin/table/BarnTable.tsx, built in `buildWorld`'s order. */
async function putFarm(L: Layout, load: Load, shared: Shared) {
  mirrors('src/skin/table/BarnTable.tsx', [
    'const barn = buildBarn(); const yard = buildYard(); const distance = buildDistance(); const festive = buildFestive();',
    '{barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}',
    '{barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}',
    '<mesh geometry={barn.lanterns} material={glowMat} />',
    '<mesh geometry={barn.tarp} material={voxMat} />',
    '<mesh geometry={barn.front} material={voxMat} receiveShadow />',
    '{yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}',
    '<mesh geometry={yard.snowman} material={voxMat} castShadow receiveShadow />',
    '<mesh geometry={distance.hills} material={voxMat} receiveShadow />',
    '<mesh geometry={distance.backHills} material={voxMat} receiveShadow />',
    '<mesh geometry={distance.mountains} material={voxMat} />',
    '<Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />',
    '<group position={CAT_SPOT}>',
    '<mesh ref={body} geometry={geo.body} material={mat} castShadow />',
    '<mesh ref={tail} geometry={geo.tail} material={mat} position={geo.tailPivot} castShadow />',
    'return <mesh ref={r} geometry={geo} material={mat} position={ROBIN_SPOT} castShadow />;',
  ]);
  mirrors('src/skin/scene/Sky.tsx', [
    '<mesh geometry={body} material={mat} castShadow receiveShadow />',
    '<group ref={ref} position={hub}>',
    '<mesh geometry={blades} material={mat} castShadow />',
  ]);
  if (!shared.farm) {
    const barnM = await load<Barn>('src/skin/scene/barn.ts'), yardM = await load<Yard>('src/skin/scene/yard.ts');
    const distanceM = await load<Distance>('src/skin/scene/distance.ts'), festiveM = await load<Festive>('src/skin/scene/festive.ts');
    const barn = barnM.buildBarn(), yard = yardM.buildYard(), distance = distanceM.buildDistance(), festive = festiveM.buildFestive();
    shared.farm = { barn, yard, distance, festive, CAT_SPOT: barnM.CAT_SPOT, ROBIN_SPOT: barnM.ROBIN_SPOT };
  }
  const { barn, yard, distance, festive, CAT_SPOT, ROBIN_SPOT } = shared.farm;
  barn.static.forEach((g, i) => L.put(g, `barn.static[${i}]`));
  barn.doorLeaves.forEach((d, i) => L.put(d.geo, `barn.doorLeaves[${i}]`, { at: d.hinge, rotation: [0, d.openYaw, 0] }));
  L.put(barn.lanterns, 'barn.lanterns');
  L.put(barn.tarp, 'barn.tarp');
  L.put(barn.front, 'barn.front');
  L.thing('cat', { at: CAT_SPOT, moves: 'its body breathes and its tail sways' }, (t) => {
    t.put(barn.cat.body, 'barn.cat.body');
    t.put(barn.cat.tail, 'barn.cat.tail', { at: barn.cat.tailPivot });
  });
  L.put(barn.robin, 'barn.robin', { at: ROBIN_SPOT, moves: 'it hops along its beam' });
  yard.chunks.forEach((g, i) => L.put(g, `yard.chunks[${i}]`));
  L.put(yard.snowman, 'yard.snowman');
  L.put(distance.hills, 'distance.hills');
  L.put(distance.backHills, 'distance.backHills');
  L.put(distance.mountains, 'distance.mountains');
  L.put(distance.windmillBody, 'distance.windmillBody');
  L.put(distance.windmillBlades, 'distance.windmillBlades', { at: distance.bladesHub, moves: 'the blades turn' });
  putFestive(L, festive, 'festive');
}

/** The letter board, hung from its hook: `LetterBoard` in src/skin/table/BarnTable.tsx. Under Node it is cut in the 5 x 7 fallback letters. */
async function putLetterBoard(L: Layout, load: Load, beamY: number, hook: readonly [number, number, number]) {
  mirrors('src/skin/table/BarnTable.tsx', [
    'const geo = useMemo(() => letterBoardGeometry(letter, isTrap, beamY), [letter, isTrap, beamY, fontReady]);',
    '<group ref={g} position={[hook[0], hook[1], hook[2]]}>',
    '<mesh geometry={geo} material={boardMat} castShadow />',
  ]);
  const table = await load<typeof import('../../src/skin/voxel/table')>('src/skin/voxel/table.ts');
  L.put(table.letterBoardGeometry('A', false, beamY), 'letterBoard', { at: hook, moves: 'it swings from its hook' });
}

const SCENES_BUILT: Record<SceneName, (L: Layout, load: Load, shared: Shared, detail: Detail) => Promise<void>> = {
  /** The barn table: `Scene` in src/skin/table/BarnTable.tsx. Animals, the bomb and the wool pile are models, not scenery. */
  async table(L, load, shared) {
    await putFarm(L, load, shared);
    mirrors('src/skin/table/BarnTable.tsx', [
      '<group position={[HEAP[0], 0, HEAP[2]]}>',
      '<mesh geometry={platform} material={mat} castShadow receiveShadow />',
      "export function LetterBoard({ letter, isTrap, reduced, beamY = BARN.beamY, hook = [HEAP[0], BARN.beamY - 0.15, 1.0] }: {",
    ]);
    const layout = await load<typeof import('../../src/skin/scene/layout')>('src/skin/scene/layout.ts');
    const table = await load<typeof import('../../src/skin/voxel/table')>('src/skin/voxel/table.ts');
    L.put(table.platformGeometry(), 'table.platform', { at: [layout.HEAP[0], 0, layout.HEAP[2]] });
    await putLetterBoard(L, load, layout.BARN.beamY, [layout.HEAP[0], layout.BARN.beamY - 0.15, 1.0]);
    L.notes.push('table.pile: not laid out: the wool pile changes with the game (pileGeometry)');
  },

  /** Home: the same farm, and everything src/skin/table/Farmstead.tsx adds to it, built in the order it builds them. */
  async farm(L, load, shared) {
    await putFarm(L, load, shared);
    mirrors('src/skin/table/Farmstead.tsx', [
      '<mesh geometry={world.distance.mountains} material={mat} rotation={[0, Math.PI, 0]} />',
      '<mesh geometry={farm.shell} material={mat} castShadow receiveShadow />',
      '{farm.props.map((g, i) => <mesh key={`p${i}`} geometry={g} material={mat} castShadow receiveShadow />)}',
      '{farm.fine.map((g, i) => <mesh key={`f${i}`} geometry={g} material={mat} castShadow receiveShadow />)}',
      '<mesh geometry={farm.terrain} material={mat} receiveShadow />',
      '<Festive geo={buildFarmFestive()} reduced={reduced} />',
      '{[...country.woods, ...country.scrub].map((g, i) => <mesh key={`c${i}`} geometry={g} material={mat} castShadow receiveShadow />)}',
      '{country.forest.map((g, i) => <mesh key={`w${i}`} geometry={g} material={mat} receiveShadow />)}',
      '{country.drifts.map((g, i) => <mesh key={`d${i}`} geometry={g} material={mat} receiveShadow />)}',
      '<mesh geometry={country.tracks} material={mat} receiveShadow />',
    ]);
    const farmstead = await load<typeof import('../../src/skin/scene/farmstead')>('src/skin/scene/farmstead.ts');
    const festive = await load<Festive>('src/skin/scene/festive.ts');
    const countryside = await load<typeof import('../../src/skin/scene/countryside')>('src/skin/scene/countryside.ts');
    L.put(shared.farm!.distance.mountains, 'distance.mountains (turned round)', { rotation: [0, Math.PI, 0] });
    const farm = farmstead.buildFarmstead();
    L.put(farm.shell, 'farmstead.shell');
    farm.props.forEach((g, i) => L.put(g, `farmstead.props[${i}]`));
    farm.fine.forEach((g, i) => L.put(g, `farmstead.fine[${i}]`));
    L.put(farm.terrain, 'farmstead.terrain');
    putFestive(L, festive.buildFarmFestive(), 'farmFestive');
    const country = countryside.buildCountryside();
    country.woods.forEach((g, i) => L.put(g, `countryside.woods[${i}]`));
    country.scrub.forEach((g, i) => L.put(g, `countryside.scrub[${i}]`));
    country.forest.forEach((g, i) => L.put(g, `countryside.forest[${i}]`));
    country.drifts.forEach((g, i) => L.put(g, `countryside.drifts[${i}]`));
    L.put(country.tracks, 'countryside.tracks');
    L.notes.push('the wendigo is not voxels and is not laid out; the livestock, the hero and the doorway sheep are models');
  },

  /** Practice: the ice. `Duel` and `DuelTable` in src/skin/table/DuelTable.tsx. */
  async duel(L, load) {
    mirrors('src/skin/table/DuelTable.tsx', [
      '<mesh geometry={w.ice} material={mat} castShadow receiveShadow />',
      '<mesh geometry={w.water} material={mat} position={[0, DUEL.waterY, 0]} receiveShadow />',
      '<mesh geometry={w.floes} material={mat} receiveShadow />',
      '<mesh geometry={w.shore} material={mat} />',
      '<mesh geometry={w.pines} material={mat} />',
      '<mesh geometry={w.posts} material={mat} castShadow />',
      '<mesh geometry={w.glow} material={glow} />',
      '<Festive geo={buildDuelFestive()} reduced={reduced} />',
      'const DUEL_BEAM = DUEL.hook[1] + 0.65;',
      '<LetterBoard letter={letter} isTrap={isTrap} reduced={reduced} beamY={DUEL_BEAM} hook={DUEL.hook} />',
    ]);
    const duel = await load<typeof import('../../src/skin/scene/duel')>('src/skin/scene/duel.ts');
    const festive = await load<Festive>('src/skin/scene/festive.ts');
    const w = duel.buildDuel();
    L.put(w.ice, 'duel.ice');
    L.put(w.water, 'duel.water', { at: [0, duel.DUEL.waterY, 0] });
    L.put(w.floes, 'duel.floes');
    L.put(w.shore, 'duel.shore');
    L.put(w.pines, 'duel.pines');
    L.put(w.posts, 'duel.posts');
    L.put(w.glow, 'duel.glow');
    putFestive(L, festive.buildDuelFestive(), 'duelFestive');
    await putLetterBoard(L, load, duel.DUEL.hook[1] + 0.65, duel.DUEL.hook);
  },

  /** The lobby's pen: `Place` in src/skin/rooms/PenStage.tsx. Every mesh is drawn where it was built. */
  async pen(L, load) {
    mirrors('src/skin/rooms/PenStage.tsx', [
      '<mesh geometry={w.ground} material={mat} receiveShadow />',
      '<mesh geometry={w.land} material={mat} receiveShadow />',
      '<mesh geometry={w.trees} material={mat} castShadow receiveShadow />',
      '<mesh geometry={w.wood} material={mat} />',
      '<mesh geometry={w.nature} material={mat} castShadow receiveShadow />',
      '<mesh geometry={w.mountains} material={mat} />',
      '<mesh geometry={w.fence} material={mat} castShadow receiveShadow />',
      '<mesh geometry={w.glow} material={glow} />',
    ]);
    const pen = await load<typeof import('../../src/skin/scene/pen')>('src/skin/scene/pen.ts');
    const w = pen.buildPen();
    L.put(w.ground, 'pen.ground');
    L.put(w.land, 'pen.land');
    L.put(w.trees, 'pen.trees');
    L.put(w.wood, 'pen.wood');
    L.put(w.nature, 'pen.nature');
    L.put(w.mountains, 'pen.mountains');
    L.put(w.fence, 'pen.fence');
    L.put(w.glow, 'pen.glow');
  },

  /** The farmer's bedroom, asleep: src/skin/dream/BedroomBubble.tsx. */
  async bedroom(L, load) {
    mirrors('src/skin/dream/BedroomBubble.tsx', [
      '<mesh geometry={b.room} material={vox} />',
      '<mesh geometry={b.glow} material={selfLit} />',
      '<mesh geometry={b.lampGlass} material={glassMat} />',
      '<group ref={clock} position={[CLOCK.x, CLOCK.y + 0.025, CLOCK.z]} rotation={[0, CLOCK.turn, 0]}>',
      '<mesh geometry={b.clock} material={vox} />',
      '<mesh ref={ring} geometry={b.ring} material={selfLit} visible={false} />',
      '<group ref={bump} position={[0, BED.mattress.top, 0]}><mesh geometry={b.quiltBump} material={vox} position={[0, -BED.mattress.top, 0]} /></group>',
      '<group position={[0.34, BED.pillowTop + 0.05, -0.02]} rotation={[0.3, -0.35, -0.95]}>',
      '<group rotation={[0, Math.PI / 2, 0]}>',
      '<group rotation={[-Math.PI / 2, 0, 0]}>',
      '<group ref={lieBody}><mesh geometry={f.body} material={vox} /></group>',
      '<group ref={lieHead} position={[0, HEAD_PIVOT, 0]}>',
      '<group position={[0, -HEAD_PIVOT, 0]}>',
      '<mesh ref={asleep} geometry={f.asleep} material={vox} />',
      '<mesh ref={awake} geometry={f.awake} material={vox} visible={false} />',
      '<mesh ref={lidA} geometry={f.lidA} material={vox} position={[0, EYE_TOP, 0]} visible={false} />',
      '<mesh ref={lidB} geometry={f.lidB} material={vox} position={[0, EYE_TOP, 0]} visible={false} />',
      '<mesh geometry={f.cap} material={vox} />',
    ]);
    const bedroom = await load<typeof import('../../src/skin/dream/bedroom')>('src/skin/dream/bedroom.ts');
    const b = bedroom.bedroomGeometry(), f = bedroom.farmerGeometry();
    const { CLOCK, BED } = bedroom;
    L.put(b.room, 'bedroom.room');
    L.put(b.glow, 'bedroom.glow');
    L.put(b.lampGlass, 'bedroom.lampGlass');
    L.thing('clock', { at: [CLOCK.x, CLOCK.y + 0.025, CLOCK.z], rotation: [0, CLOCK.turn, 0], moves: 'it shakes when it rings' }, (t) => {
      t.put(b.clock, 'bedroom.clock');
      t.put(b.ring, 'bedroom.ring');
    });
    L.thing('quilt', { at: [0, BED.mattress.top, 0], moves: 'it rises and falls with his breath' }, (t) => t.put(b.quiltBump, 'bedroom.quiltBump', { at: [0, -BED.mattress.top, 0] }));
    L.thing('farmer', [{ at: [0.34, BED.pillowTop + 0.05, -0.02], rotation: [0.3, -0.35, -0.95], moves: 'he breathes, stirs and sits up' }, { rotation: [0, Math.PI / 2, 0] }, { rotation: [-Math.PI / 2, 0, 0] }], (t) => {
      t.put(f.body, 'farmer.body');
      t.put(f.asleep, 'farmer.asleep');
      t.put(f.cap, 'farmer.cap');
    });
    L.skip(f.awake, 'farmer.awake', 'drawn in place of the sleeping head once he wakes');
    L.skip(f.lidA, 'farmer.lidA', 'drawn only once he wakes');
    L.skip(f.lidB, 'farmer.lidB', 'drawn only once he wakes');
    L.notes.push('the ring lines (bedroom.ring) are laid out with the clock, though the game shows them only while it rings');
    L.notes.push('the farmer sitting up, his folded quilt and his rubbing arm (shown on the results) are not built');
  },

  /**
   * Counting Sheep, before the first key (nothing has scrolled): `World` in src/skin/dream/DreamStage.tsx. Everything
   * in the dream is moved by its group every frame, so everything here is a thing. The dream does not read the
   * pointer: its other build is for a narrow screen (`phone`), and that is what the coarse level builds.
   */
  async dream(L, load, shared, detail) {
    mirrors('src/skin/dream/DreamStage.tsx', [
      'chunks: Array.from({ length: CHUNK.count }, (_, i) => raftChunk(i)),',
      'islands: ISLANDS.map((it, i) => { const p = islandPlace(it, phone); return { ...p, ...islandGeometry(it.kind, p.across, p.tall, i + 1) }; }),',
      "wisps: WISPS.map((w, i) => ({ geo: wispGeometry(i + 1), at: atFrame(phone ? PHONE_SHOT : DESKTOP_SHOT, phone ? 390 / 844 : 16 / 9, w.frame[0], w.frame[1], w.z) })),",
      'sea: cloudSea(phone), hills: hillsGeometry(), mountains: mountainsGeometry(),',
      'for (const p of chunkPlacements(scroll)) { const g = chunks.current[p.index]; if (g) g.position.x = p.x; }',
      'g.position.x = islandX(it, scroll, p.x, p.across);',
      'seaBank.current.position.x = -((scroll * SEA.factor) % SEA.period) - 30;',
      '{[0, 1].map((i) => <mesh key={i} geometry={geo.sea} material={voxMat} position={[i * SEA.period, 0, 0]} />)}',
      '<group key={it.id} ref={(el) => { islandRefs.current[i] = el; }} position={[p.x, p.y, it.z]}>',
      '<mesh geometry={p.body} material={islandMat} />',
      '{p.props && <mesh geometry={p.props} material={voxMat} />}',
      '{p.glow && <mesh geometry={p.glow} material={glowMat} />}',
      "{it.kind === 'windmill' && <IslandWindmill />}",
      '{geo.wisps.map((w, i) => <group key={i} ref={(el) => { wispRefs.current[i] = el; }} position={w.at}><mesh geometry={w.geo} material={voxMat} /></group>)}',
      '<group ref={hillRange}><mesh geometry={geo.hills} material={voxMat} /></group>',
      '<group ref={mountainRange}><mesh geometry={geo.mountains} material={voxMat} /></group>',
      '<mesh geometry={g} material={voxMat} receiveShadow />',
      'return { body: w.distance.windmillBody.clone().translate(-x - 0.5, -baseY, -z - 0.5), blades: w.distance.windmillBlades, hub: [0, 9.5, h[2] - z - 0.5] as [number, number, number] };',
      'return <group rotation={[0, Math.PI, 0]} scale={0.062}><Windmill body={parts.body} blades={parts.blades} hub={parts.hub} /></group>;',
    ]);
    const phone = detail === 'coarse';
    const stage = await load<typeof import('../../src/skin/dream/stage')>('src/skin/dream/stage.ts');
    const world = await load<typeof import('../../src/skin/dream/world')>('src/skin/dream/world.ts');
    const distanceM = await load<Distance>('src/skin/scene/distance.ts');
    const { DISTANCE } = await load<typeof import('../../src/skin/scene/layout')>('src/skin/scene/layout.ts');
    const { CHUNK, ISLANDS, WISPS, DESKTOP_SHOT, PHONE_SHOT } = stage;
    const raft = Array.from({ length: CHUNK.count }, (_, i) => world.raftChunk(i));
    L.thing('raft', { moves: 'the lane scrolls under the sheep, chunk by chunk round a ring' }, (t) => {
      for (const p of stage.chunkPlacements(0)) t.put(raft[p.index], `raft.chunk[${p.index}]`, { at: [p.x, 0, 0] });
    });
    const sea = world.cloudSea(phone);
    L.thing('cloud sea', { at: [-30, 0, 0], moves: 'it scrolls slower than the lane and rises and falls' }, (t) => {
      for (const i of [0, 1]) t.put(sea, `sea[${i}]`, { at: [i * world.SEA.period, 0, 0] });
    });
    // The dream draws the table world's windmill on island B. In a run that builds the table that world is there
    // already (the page builds it once, too); a run of the dream alone builds the distance for the windmill only.
    const distance = shared.farm?.distance ?? distanceM.buildDistance();
    if (!shared.farm) {
      for (const key of ['hills', 'backHills', 'mountains'] as const) L.skip(distance[key], `distance.${key}`, 'built here only because the windmill comes with it; it is laid out in the table and the farm');
      L.skip(distance.windmillBody, 'distance.windmillBody', 'the dream draws a moved copy of it, laid out with island B');
    }
    ISLANDS.forEach((it, i) => {
      const p = stage.islandPlace(it, phone), g = world.island(it.kind, p.across, p.tall, i + 1);
      const at: V3 = [stage.islandX(it, 0, p.x, p.across), p.y, it.z];
      L.thing(`island ${it.id}`, { at, moves: 'it drifts past and bobs' }, (t) => {
        t.put(g.body, `island[${it.id}].body`);
        if (g.props) t.put(g.props, `island[${it.id}].props`);
        if (g.glow) t.put(g.glow, `island[${it.id}].glow`);
        if (it.kind === 'windmill') {
          const { x, z } = DISTANCE.windmill, h = distance.bladesHub, baseY = h[1] - 9.5;
          t.put(distance.windmillBody.clone().translate(-x - 0.5, -baseY, -z - 0.5), `island[${it.id}].windmillBody`, { rotation: [0, Math.PI, 0], scale: 0.062 });
        }
      });
      if (it.kind === 'windmill') {
        const { z } = DISTANCE.windmill, h = distance.bladesHub;
        L.thing(`island ${it.id} windmill blades`, [{ at, moves: 'they turn, and drift with their island' }, { rotation: [0, Math.PI, 0], scale: 0.062 }, { at: [0, 9.5, h[2] - z - 0.5] }], (t) => t.put(distance.windmillBlades, `island[${it.id}].windmillBlades`));
      }
    });
    WISPS.forEach((w, i) => {
      const at = stage.atFrame(phone ? PHONE_SHOT : DESKTOP_SHOT, phone ? 390 / 844 : 16 / 9, w.frame[0], w.frame[1], w.z);
      L.put(world.wisp(i + 1), `wisp[${i}]`, { at, moves: 'it drifts across the sky' });
    });
    L.put(world.hills(), 'dream.hills', { moves: 'the range scrolls slower than the lane' });
    L.put(world.mountains(), 'dream.mountains', { moves: 'the range scrolls slower than the lane' });
    L.notes.push(`built for ${phone ? 'a narrow screen (phone = true): the phone\'s sea and island boxes' : 'a computer (phone = false)'}`);
    L.notes.push('the fences, bales and signs come and go with the night: they are models (fence:rail, bale, sign post...)');
    L.notes.push('the sheep, its shadow disc, the bonk stars and the dust are not laid out');
  },

  /**
   * The winning screen with a full table of ten: `Scene` in src/skin/table/Podium.tsx. Where things stand is written
   * in that file's own constants and JSX, which are not exported: they are copied here and pinned.
   */
  async podium(L, load) {
    mirrors('src/skin/table/Podium.tsx', [
      'const S = 0.1;',
      'const STEP = { w: 1.4, d: 1.2 };',
      'const HEIGHT = [1.5, 1.1, 0.8];',
      'const CRATE = 0.55;',
      'const heightOf = (place: number) => (place <= 3 ? HEIGHT[place - 1] : CRATE);',
      'if (place === 1) return [0, HEIGHT[0], 0];',
      'if (place === 2) return [-STEP.w - 0.06, HEIGHT[1], 0];',
      'if (place === 3) return [STEP.w + 0.06, HEIGHT[2], 0];',
      'const k = place - 4, side = k % 2 ? 1 : -1;',
      'return [side * (3.05 + Math.floor(k / 2) * 1.3), CRATE, 0.5];',
      'const boardHeight = (place: number) => Math.min(heightOf(place) - 0.14, place <= 3 ? 0.66 : 0.4);',
      '[-6.6, 0, -1.6, 0], [-5.55, 0, -1.6, 0], [-6.1, 0.5, -1.6, 0.05], [-7.2, 0, -0.6, 1.57], [-6.6, 1, -1.6, -0.04],',
      '[6.6, 0, -1.6, 0], [5.55, 0, -1.6, 0], [6.1, 0.5, -1.6, -0.06], [7.2, 0, -0.6, 1.57], [6.6, 1, -1.6, 0.03],',
      '[-4.9, 0, 1.6, 0.4], [5.1, 0, 1.4, -0.3],',
      '<mesh geometry={floor} material={mat} receiveShadow />',
      '<mesh geometry={wall} material={mat} position={[0, 0, -3.2]} />',
      '<mesh geometry={doors} material={mat} position={[0, 0, -2.94]} />',
      '{BALES.map(([x, y, z, r], i) => <mesh key={i} geometry={bale} material={mat} position={[x, y, z]} rotation={[0, r, 0]} castShadow receiveShadow />)}',
      'const [x, , z] = spot(e.place);',
      'const front = (e.place <= 3 ? STEP.d : 0.9) / 2;',
      'const boardY = (heightOf(e.place) - boardHeight(e.place)) / 2;',
      '<group key={e.key} position={[x, 0, z]}>',
      '<mesh geometry={blocks[i]} material={mat} castShadow receiveShadow />',
      '<mesh geometry={carved[i]} material={mat} position={[0, boardY, front + 0.005]} />',
    ]);
    const podium = await load<typeof import('../../src/skin/table/Podium')>('src/skin/table/Podium.tsx');
    const STEP = { w: 1.4, d: 1.2 }, HEIGHT = [1.5, 1.1, 0.8], CRATE = 0.55;
    const heightOf = (place: number) => (place <= 3 ? HEIGHT[place - 1] : CRATE);
    const spot = (place: number): V3 => {
      if (place === 1) return [0, HEIGHT[0], 0];
      if (place === 2) return [-STEP.w - 0.06, HEIGHT[1], 0];
      if (place === 3) return [STEP.w + 0.06, HEIGHT[2], 0];
      const k = place - 4, side = k % 2 ? 1 : -1;
      return [side * (3.05 + Math.floor(k / 2) * 1.3), CRATE, 0.5];
    };
    const boardHeight = (place: number) => Math.min(heightOf(place) - 0.14, place <= 3 ? 0.66 : 0.4);
    const BALES: [number, number, number, number][] = [
      [-6.6, 0, -1.6, 0], [-5.55, 0, -1.6, 0], [-6.1, 0.5, -1.6, 0.05], [-7.2, 0, -0.6, 1.57], [-6.6, 1, -1.6, -0.04],
      [6.6, 0, -1.6, 0], [5.55, 0, -1.6, 0], [6.1, 0.5, -1.6, -0.06], [7.2, 0, -0.6, 1.57], [6.6, 1, -1.6, 0.03],
      [-4.9, 0, 1.6, 0.4], [5.1, 0, 1.4, -0.3],
    ];
    L.put(podium.floorGeometry(), 'podium.floor');
    L.put(podium.wallGeometry(), 'podium.wall', { at: [0, 0, -3.2] });
    L.put(podium.doorsGeometry(), 'podium.doors', { at: [0, 0, -2.94] });
    const bale = podium.baleGeometry();
    BALES.forEach(([x, y, z, r], i) => L.put(bale, `podium.bale[${i}]`, { at: [x, y, z], rotation: [0, r, 0] }));
    for (let place = 1; place <= 10; place++) {
      const [x, , z] = spot(place), front = (place <= 3 ? STEP.d : 0.9) / 2, boardY = (heightOf(place) - boardHeight(place)) / 2;
      L.put(podium.blockGeometry(place), `podium.block[${place}]`, { at: [x, 0, z] });
      L.put(podium.carvedGeometry(place), `podium.carved[${place}]`, { at: [x, boardY, z + front + 0.005] });
    }
    L.notes.push('built for ten places; the numbers are carved in the 5 x 7 fallback letters under Node, not the display face');
    L.notes.push('the hayloft beam, its lanterns and lights are three.js boxes, not voxels, and are not laid out; the dancers and the trophy are models');
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// The models
// ---------------------------------------------------------------------------------------------------------------------

/** A Grid, as the game's own (src/skin/voxel/primitives.ts): a builder that hands back voxels and no geometry. */
const isGrid = (v: unknown): v is { map: VoxelMapLike; size: number } =>
  !!v && typeof v === 'object' && (v as { map?: unknown }).map instanceof Map && typeof (v as { size?: unknown }).size === 'number';

/** Lays out everything a builder returned: each geometry and Grid in it becomes a part, named by where it was found. */
function adopt(s: Session, id: string, kind: string, built: unknown): Model {
  const parts: Part[] = [], byGeometry = new Map<BufferGeometry, Part[]>(), seen = new Set<unknown>();
  const add = (capture: Capture, mount: string, offset: V3, local: V3, mesh: number) => {
    capture.uses++;
    const part: Part = {
      scene: id, detail: s.detail, index: parts.length, label: capture.label, mount, mesh, body: id, size: capture.size, count: capture.count,
      cells: capture.cells, colors: capture.colors, offset, local, turns: 0, scale: 1, aligned: true, set: capture.id,
    };
    parts.push(part);
    return part;
  };
  const walk = (value: unknown, path: string, depth: number, pivot: V3 | null) => {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 6) return;
    if (value instanceof BufferGeometry) {
      seen.add(value);
      if (!s.lineage.has(value) && !value.getAttribute('position')) return;
      let entries: Entry[];
      try { entries = held(s, value, `${id} ${path}`); } catch { return; } // not the mesher's: a three.js shape
      s.fresh.delete(value);
      const mesh = s.meshes++;
      byGeometry.set(value, entries.map((e) => add(e.capture, path, moveOf(e.m, `${id} ${path}`), pivot ?? MODEL_AT[id]?.(path, built) ?? [0, 0, 0], mesh)));
      return;
    }
    if (value instanceof Map || value instanceof Set || ArrayBuffer.isView(value)) return;
    seen.add(value);
    if (isGrid(value)) {
      if (value.map.size) add(record(s, `${path === id ? id : `${id} ${path}`} (a Grid, handed back unmeshed)`, value.map, value.size), path, [0, 0, 0], [0, 0, 0], s.meshes++);
      return;
    }
    // The animals' parts: a geometry built about `pivot`, which the game puts back at `pivot`.
    const own = value as Record<string, unknown>;
    const p = own.geo instanceof BufferGeometry && Array.isArray(own.pivot) && own.pivot.length === 3 ? (own.pivot as V3) : null;
    for (const key of Object.keys(own)) {
      const next = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
      walk(own[key], p && key === 'geo' ? path : next, depth + 1, key === 'geo' ? p : null);
    }
  };
  walk(built, built instanceof BufferGeometry || isGrid(built) ? id : '', 0, null);
  return { id, kind, detail: s.detail, parts, built, partsOf: (geometry) => byGeometry.get(geometry) ?? [], hash: hashParts(parts), notes: [] };
}

type ModelSpec = { id: string; kind: string; build: (load: Load) => unknown | Promise<unknown> };

/** Where a model's own component sets a mesh, for the few whose builder does not say it with a pivot. */
const MODEL_AT: Record<string, (mount: string, built: unknown) => V3 | null> = {};

/** The models every run builds: what the plan's models stage and the old tool's `--props` need. */
async function modelSpecs(load: Load): Promise<ModelSpec[]> {
  const catalog = await load<typeof import('../../src/skin/shop/catalog')>('src/skin/shop/catalog.ts');
  const specs: ModelSpec[] = [];
  for (const animal of ['sheep', 'pig', 'cow', 'goat', 'horse', 'chicken'] as const) {
    specs.push({ id: `animal:${animal}`, kind: 'animal', build: async (l) => (await l<typeof import('../../src/skin/voxel/animals/index')>('src/skin/voxel/animals/index.ts')).animalModel(animal) });
  }
  for (const item of catalog.CATALOG.filter((i) => i.kind === 'bomb')) {
    specs.push({ id: `bomb:${item.id}`, kind: 'bomb', build: async (l) => (await l<typeof import('../../src/skin/voxel/bombSkins')>('src/skin/voxel/bombSkins.ts')).bombLook(item.id) });
  }
  for (const item of catalog.CATALOG.filter((i) => i.kind === 'blast')) {
    const shape = catalog.BURST_SHAPE[item.id] ?? 'ball';
    specs.push({ id: `burst:${item.id}`, kind: 'burst', build: async (l) => (await l<typeof import('../../src/skin/voxel/burstProps')>('src/skin/voxel/burstProps.ts')).propGrid(shape, catalog.BLAST_PALETTE[item.id] ?? catalog.BLAST_PALETTE['blast-frost']) });
  }
  for (const item of catalog.CATALOG.filter((i) => i.kind === 'tick')) {
    specs.push({ id: `tick:${item.id}`, kind: 'tick', build: async (l) => (await l<typeof import('../../src/skin/shop/thumbModels')>('src/skin/shop/thumbModels.ts')).soundGrid(item.id) });
  }
  for (const sack of ['bomb', 'blast', 'tick'] as const) {
    specs.push({ id: `sack:${sack}`, kind: 'sack', build: async (l) => (await l<typeof import('../../src/skin/shop/thumbModels')>('src/skin/shop/thumbModels.ts')).sackGrid(sack) });
  }
  specs.push({ id: 'sheepdog', kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/voxel/characters')>('src/skin/voxel/characters.ts')).sheepdogModel() });
  specs.push({ id: 'trophy', kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/voxel/trophy')>('src/skin/voxel/trophy.ts')).trophyGeometry() });
  specs.push({ id: 'hat', kind: 'prop', build: async (l) => (await l<Festive>('src/skin/scene/festive.ts')).santaHat() });
  specs.push({
    id: 'ice', kind: 'prop', build: async (l) => {
      // The block's size is a constant of Sheep.tsx that is not exported: read from its text, so it cannot drift.
      const size = /const BLOCK: \[number, number, number\] = \[([\d.]+), ([\d.]+), ([\d.]+)\];/.exec(readFileSync(resolve(ROOT, 'src/skin/table/Sheep.tsx'), 'utf8'));
      if (!size) throw new Error('tools/scenes/build.ts: cannot find the ice block\'s size (const BLOCK) in src/skin/table/Sheep.tsx');
      return (await l<typeof import('../../src/skin/voxel/sheep')>('src/skin/voxel/sheep.ts')).iceBlock([+size[1], +size[2], +size[3]]);
    },
  });
  // The old tool's own props (tools/floatingVoxels.ts --props), under the names it gave them.
  specs.push({ id: 'bomb', kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/voxel/bomb')>('src/skin/voxel/bomb.ts')).bombModel() });
  // Each fence by its own look. (The old tool asked `lookOf('fence', index)`, which deals the looks in another order,
  // so what it called fence:wall was the log and what it called fence:log was the wall.)
  for (const look of ['rail', 'picket', 'wall', 'log'] as const) {
    specs.push({ id: `fence:${look}`, kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/dream/world')>('src/skin/dream/world.ts')).obstacle(look) });
  }
  specs.push({ id: 'bale', kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/dream/world')>('src/skin/dream/world.ts')).obstacle('bale') });
  // The sign: its board and letters are built about the board's pivot and hung there by `Sign` in DreamStage.tsx.
  mirrors('src/skin/dream/DreamStage.tsx', [
    '<mesh geometry={geo.post} material={wood} castShadow />',
    '<mesh geometry={geo.lantern} material={glass[view?.hot ? 1 : 0]} />',
    '<group ref={boardRef} position={[SIGN.x, SIGN.pivot, 0]}>',
    '<mesh geometry={geo.board} material={wood} castShadow />',
    '<mesh geometry={geo.letters} material={ink} />',
  ]);
  const { SIGN } = await load<typeof import('../../src/skin/dream/world')>('src/skin/dream/world.ts');
  MODEL_AT['sign post'] = (mount) => (mount === 'board' || mount === 'letters' ? [SIGN.x, SIGN.pivot, 0] : null);
  specs.push({ id: 'sign post', kind: 'prop', build: async (l) => (await l<typeof import('../../src/skin/dream/world')>('src/skin/dream/world.ts')).fenceSign(['G', 'R']) });
  return specs;
}

/** The ids of the models every run builds (the bomb, burst and fuse-sound ids are the shop catalogue's). */
export const MODEL_KINDS = ['animal', 'bomb', 'burst', 'tick', 'sack', 'prop'] as const;

// ---------------------------------------------------------------------------------------------------------------------
// Building the world
// ---------------------------------------------------------------------------------------------------------------------

export interface BuildOptions {
  /** The scenes to build; all seven when left out. */
  scenes?: readonly SceneName[];
  /** The detail levels to build; both when left out. */
  details?: readonly Detail[];
  /** False to build no models. */
  models?: boolean;
  /** Told each step as it starts and ends. */
  log?: (line: string) => void;
}

const COARSE = '(pointer: coarse)';
/** What a touch device answers; set before a coarse graph imports anything, as plan file 18 asks. */
function setPointer(detail: Detail) {
  const g = globalThis as { matchMedia?: unknown };
  if (detail === 'coarse') g.matchMedia = (query: string) => ({ matches: query === COARSE, media: query, addEventListener() {}, removeEventListener() {} });
  else delete g.matchMedia;
}

/** Builds the scenes and the models, once. Close it when the stages are done. */
export async function buildWorld(options: BuildOptions = {}): Promise<World> {
  const names = SCENE_NAMES.filter((n) => !options.scenes || options.scenes.includes(n));
  const details = DETAILS.filter((d) => !options.details || options.details.includes(d));
  const log = options.log ?? (() => {});
  if ((globalThis as { __voxelHook?: unknown }).__voxelHook && !tap.installed) throw new Error('tools/scenes/build.ts: something else has set __voxelHook');
  for (const file of ['src/skin/voxel/mesher.ts', 'src/skin/voxel/refine.ts']) if (!existsSync(resolve(ROOT, file))) throw new Error(`tools/scenes/build.ts: ${file} is gone`);
  mirrors('src/skin/voxel/mesher.ts', ['(globalThis as { __voxelHook?: (vox: VoxelMap, size: number) => void }).__voxelHook?.(vox, size);', 'g.computeBoundingSphere();']);
  mirrors('src/skin/voxel/refine.ts', ["const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;"]);
  mirrors('src/skin/scene/yard.ts', ['out.computeBoundingSphere(); g.dispose(); return out;']);
  install();

  const server: ViteDevServer = await createServer({ root: ROOT, logLevel: 'error', server: { hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  await server.environments.client.pluginContainer.buildStart({});
  const node = new ViteNodeServer(server);
  installSourcemapsSupport({ getSourceMap: (source) => node.getSourceMap(source) });

  const graphs = new Map<Detail, { runner: ViteNodeRunner; session: Session; shared: Shared }>();
  const graph = async (detail: Detail) => {
    let g = graphs.get(detail);
    if (!g) {
      setPointer(detail);
      const runner = new ViteNodeRunner({ root: server.config.root, base: server.config.base, fetchModule: (id) => node.fetchModule(id), resolveId: (id, importer) => node.resolveId(id, importer) });
      await runner.executeId('/@vite/env');
      g = { runner, session: { detail, captures: [], pending: null, orphan: null, lineage: new WeakMap(), fresh: new Set(), meshes: 0 }, shared: {} };
      graphs.set(detail, g);
    }
    return g;
  };
  let open = true;
  /** Runs `work` with one detail level's graph listening: its pointer answer set, its session taking the voxels. */
  const within = async <T>(detail: Detail, work: (g: { runner: ViteNodeRunner; session: Session; shared: Shared }, load: Load) => Promise<T>): Promise<T> => {
    if (!open) throw new Error('tools/scenes/build.ts: the world is closed');
    const g = await graph(detail);
    if (tap.session) throw new Error('tools/scenes/build.ts: two builds at once');
    setPointer(detail);
    tap.session = g.session;
    try {
      return await work(g, (path) => g.runner.executeFile(resolve(ROOT, path)));
    } finally {
      tap.session = null;
      setPointer('fine');
    }
  };

  const scenes: Scene[] = [], models: Model[] = [], seconds: Record<string, number> = {};
  // Coarse first: nothing a fine build has kept can then be standing in for a coarse one, and the other way round the
  // graphs are separate anyway.
  for (const detail of [...details].reverse()) {
    for (const name of names) {
      const t0 = performance.now();
      const scene = await within(detail, async (g, load) => {
        const L = new Layout(g.session, name);
        await SCENES_BUILT[name](L, load, g.shared, detail);
        const parts = L.parts;
        return { name, detail, parts, world: parts.filter((p) => p.body === 'world'), things: L.things, voxels: parts.reduce((n, p) => n + p.count, 0), hash: hashParts(parts), notes: L.notes } satisfies Scene;
      });
      seconds[`${name}:${detail}`] = (performance.now() - t0) / 1000;
      log(`built ${name} (${detail}): ${scene.voxels.toLocaleString('en-US')} voxels in ${scene.parts.length} parts, ${scene.things.length} things, ${seconds[`${name}:${detail}`].toFixed(1)} s`);
      scenes.push(scene);
    }
  }
  scenes.sort((a, b) => SCENE_NAMES.indexOf(a.name) - SCENE_NAMES.indexOf(b.name) || DETAILS.indexOf(a.detail) - DETAILS.indexOf(b.detail));

  const capture: World['capture'] = (id, kind, build, detail = 'fine') => within(detail, async (g, load) => {
    const before = g.session.captures.length;
    const model = adopt(g.session, id, kind, await build((path) => load(path)));
    // A builder may mesh more than it hands back: named on the model, never an error.
    for (const c of g.session.captures.slice(before)) {
      if (c.uses > 0 || c.skipped !== null) continue;
      c.skipped = `meshed while building ${id} and not in what the builder returned`;
      model.notes.push(`${c.count} voxels at ${c.size} m were meshed and not handed back: ${c.label}`);
    }
    for (const geometry of [...g.session.fresh]) if ((g.session.lineage.get(geometry) ?? []).every((e) => e.capture.skipped !== null)) g.session.fresh.delete(geometry);
    return model;
  });
  if (options.models !== false) {
    const t0 = performance.now();
    const specs = await within('fine', (_g, load) => modelSpecs(load));
    for (const spec of specs) models.push(await capture(spec.id, spec.kind, spec.build as never));
    seconds.models = (performance.now() - t0) / 1000;
    log(`built ${models.length} models: ${models.reduce((n, m) => n + m.parts.reduce((k, p) => k + p.count, 0), 0).toLocaleString('en-US')} voxels, ${seconds.models.toFixed(1)} s`);
  }

  // Every voxel set the mesher was given has to be somewhere: laid out, or set aside with a reason.
  for (const [detail, g] of graphs) {
    const lost = g.session.captures.filter((c) => c.uses === 0 && c.skipped === null);
    if (lost.length) {
      throw new Error(`tools/scenes/build.ts does not say where the game draws ${lost.length} voxel set${lost.length === 1 ? '' : 's'} it built (${detail}):\n${lost.slice(0, 12).map((c) => `    ${c.count} voxels at ${c.size} m: ${c.label}`).join('\n')}\n  Add each to its scene's list in build.ts (Layout.put), or set it aside with a reason (Layout.skip).`);
    }
  }

  return {
    details: [...details],
    scenes,
    scene(name, detail) {
      const found = scenes.find((s) => s.name === name && s.detail === detail);
      if (!found) throw new Error(`the scene "${name}" (${detail}) was not built in this run`);
      return found;
    },
    models,
    model(id) {
      const found = models.find((m) => m.id === id);
      if (!found) throw new Error(`there is no model "${id}" (there are: ${models.map((m) => m.id).join(', ') || 'none: this run built no models'})`);
      return found;
    },
    load: (path, detail = 'fine') => within(detail, (_g, load) => load(path)),
    capture,
    seconds,
    async close() {
      if (!open) return;
      open = false;
      await server.close();
    },
  };
}
