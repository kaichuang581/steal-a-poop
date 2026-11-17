/**
 * Stage 6 of the scene checker: models (plan file 18, section 4.2 f, and the per-animal half of 4.2 c; file 03).
 *
 * The six animals are judged AS THE GAME DRAWS THEM. `Sheep` in src/skin/table/Sheep.tsx is mounted for real, with
 * @react-three/fiber and a renderer that draws nothing, and its own frame loop is run to fixed moments of every state
 * in ALL_STATES at every coat level. What is read is its scene graph: which meshes are visible, where each one is and
 * which voxels it is made of (the voxels are the ones the mesher was given, caught by tools/scenes/build.ts). Nothing
 * of the component's frame loop is copied here, so a change to how it shows or moves a part is judged the next time
 * this runs. Math.random answers 0 while it is mounted, which starts its idle clock at 0: every idle touch (the ear
 * twitch, the chew, the pig's sniff, the cow's ear flick, the horse's head toss) begins as each state begins, and two
 * runs see the same frames. Each state is mounted fresh, from rest, and its frames are 0.05 s apart for the first
 * second, then 0.25 s apart to the state's end (6 s for the ones that do not end); `run` is run at pace 0 and at 1.
 *
 * Where `Sheep` draws one geometry joined from several of the model's parts (milestone 2's bundles: the head with all
 * that is fixed to it, the legs at rest, the eyes at rest; `bundlesOf` in table/Sheep.tsx), the bundle is one draw and
 * is counted as one; its voxels are judged as the parts it was joined from, each where the bundle puts it, by every
 * check that reads voxels, exactly as when each part was a mesh of its own.
 *
 * What is judged, for six species at coat levels 0 to 4:
 *
 *   pieces      At rest, every part where it is mounted and no part turned: one piece by face and edge.
 *   roots       Every state. A joint is a part the component moves (a leg, the tail, the neck, the head, an ear, a
 *               snout, a wing, a beard, a comb, the bell). Its root is the cells it joins its parent with at rest, as
 *               the animal is laid out at that level: the cells inside the parent's solid, or touching it by a face.
 *               In every state every one of them stays inside the parent's solid grown by one voxel, measured from the
 *               cell's middle in the parent's own frame. Counted once for each joint and state; and, apart, the joints
 *               that come off whole (every joining cell out at one moment, or none to begin with).
 *   riders      Not in the plan: a part mounted on the body that lies on the neck or the head (a collar, a mane) is
 *               left behind when they move. Judged as a joint is, against the neck and the head.
 *   empty       No visible mesh with zero triangles, in any state (three.js draws an empty mesh like any other).
 *   draws       At idle at most 14 meshes drawn in colour and 2 into the shadow map: the visible meshes on the
 *               camera's layer, and the visible ones that cast. Counted from the scene graph, not from a renderer.
 *   tails       A species other than the sheep shows its tail at level 0.
 *   ice         Frozen: at least 99% of the animal's own cells inside the ice block's slab (the hat is not counted:
 *               the plan fits the block to the animal's bounds). And every glint, crack and cap cell of the block
 *               touches its slab: shares a face with it, or lies on a cell of its own part that does.
 *   plate       The name plate (`nameplateY` in table/BarnTable.tsx) 0.02 to 0.12 m above the highest voxel drawn at
 *               rest, hat included, at the scale the table draws the animal at.
 *   hat         The hat's band (its two lowest rows) within one voxel of the crown (the top of the head and its hood).
 *   scarf       The winner's scarf joined to the animal.
 *   coincident  Faces two parts both draw on one plane, facing the same way, over some of the same area, as the animal
 *               stands at rest (an ear that droops shares a plane with the head only where it turns in one).
 *   terraces    On the torso as it is dressed at each level, and on the head: the surface is read as heights from
 *               each of its six sides, and a row or column of it with a run of three or more one-voxel steps, all one
 *               way and one voxel apart, is a failing line. (Necks, tails, manes, horns, ears and the hat are parts
 *               of their own and are not read.) At level 2 this gives the plan's own six numbers.
 *
 * And the props, each one piece by face and edge: the eight bomb skins standing at rest on their floor marks as `Bomb`
 * sets them down, the burst props, the fuse sounds' models, the sacks, the sheepdog with its hat on, the trophy, the
 * hat, the ice block as `Sheep` mounts it and its thaw shards.
 *
 * Much of this fails today and is milestone 3's and milestone 5's work. Nothing found here fails the run by itself:
 * every failing item is one entry of `failures`, named (species, level, state, part, the number measured), and one in
 * a count handed in as a ratchet, which may only fall. A check that could not be made is NOT RUN, and the stage with it.
 *
 * Not judged here, and said so that nobody takes it for judged: the head turned to look at the speaker or the camera
 * (`lookAt`, `headYaw`: up to 0.6 rad more); a state entered from another state instead of from rest; the fleece
 * settling for half a second when the level changes; worn items (none is built).
 *
 * Flags: `--show=<text>` lists every failing item whose name holds the text (`--show=horse`, `--show="roots: head"`).
 */
import { createElement, Fragment } from 'react';
import type { ReactElement } from 'react';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { Matrix4, Vector3 } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { boxes } from './build';
import type { Failure, Model, Part, StageOptions, StageResult, World } from './build';
import { pieces } from './connect';

export const id = 'models';
export const needs = { scenes: 'none' as const, models: true };

type SheepModule = typeof import('../../src/skin/table/Sheep');
type SheepState = import('../../src/skin/table/Sheep').SheepState;
type AnimalModel = import('../../src/skin/voxel/animals/rig').AnimalModel;
type RigModule = typeof import('../../src/skin/voxel/animals/rig');
type VoxelMap = import('../../src/skin/voxel/mesher').VoxelMap;

const SPECIES = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'] as const;
type Species = (typeof SPECIES)[number];
const LEVELS = [0, 1, 2, 3, 4] as const;

/** The limits the plan sets (file 18, section 4.2 f; file 03, sections 4.7 and 4.13). */
const LIMIT = { colour: 14, shadow: 2, inside: 0.99, plate: [0.02, 0.12] as const, runOfSteps: 3 };
/** What the plan says it found, to print beside what is measured here. */
const PLAN = {
  coincident: { sheep: 2, pig: 8, cow: 58, horse: 31, goat: 14, chicken: 14 } as Record<Species, number>,
  terraces: { sheep: 34, pig: 37, cow: 77, horse: 71, goat: 55, chicken: 6 } as Record<Species, number>,
  outsideAtRest: { sheep: null, pig: 8, cow: 17, horse: 26, goat: 10, chicken: 4 } as Record<Species, number | null>,
  plateOverHat: { sheep: null, pig: null, cow: 0.34, horse: 0.37, goat: 0.23, chicken: 0.20 } as Record<Species, number | null>,
};

/**
 * A cell joins a parent when its middle is within half a voxel of the parent's solid: inside it, or touching it by a
 * face. (A hundredth of a voxel more, because a part that breathes is never exactly where it was built.)
 */
const JOINS = 0.51;
/** A check that could not be made: the stage ends NOT RUN with these words. */
class NotRun extends Error {}

const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Stops the stage when a line it relies on is no longer in the component it was read from. Only the few things a
 * scene graph cannot say are read this way (the order the ice block's parts are added in, how the bomb sits at rest).
 */
function pinned(root: string, file: string, lines: string[]): void {
  const text = squash(readFileSync(resolve(root, file), 'utf8'));
  for (const line of lines) {
    if (!text.includes(squash(line))) throw new NotRun(`tools/scenes/models.ts reads how ${file} sets its meshes down, and this line of it is gone or changed: ${line}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The bench: the game's own components, mounted with a renderer that draws nothing
// ---------------------------------------------------------------------------------------------------------------------

interface Bench {
  /** Takes down what was mounted, mounts `element`, and hands back the group it hangs in. */
  show(element: ReactElement): Promise<Object3D>;
  /** Runs every frame callback at `t` seconds, then brings every matrix up to date. */
  frame(t: number): void;
  close(): void;
  mounts: number;
  frames: number;
}

type Fiber = typeof import('@react-three/fiber');

/**
 * Opens the bench. @react-three/fiber is taken from the module graph the world was built in, because the component's
 * `useFrame` must find the store of the root it is mounted in, and a second copy of the library would not share it.
 * `probe` is an element that uses `useFrame`: if it does not mount, the copy is the wrong one and the next is tried.
 */
async function openBench(world: World, root: string, probe: () => ReactElement): Promise<Bench> {
  const pkgFile = resolve(root, 'node_modules/@react-three/fiber/package.json');
  if (!existsSync(pkgFile)) throw new NotRun('@react-three/fiber is not installed: the animals cannot be mounted');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { module?: string; main?: string };
  const entries = [...new Set([pkg.module, pkg.main].filter((e): e is string => typeof e === 'string'))];
  const said: string[] = [];
  let why = '';
  for (const entry of entries) {
    let fiber: Fiber;
    // By its real path, which is how the game's own import of it is resolved (node_modules may be a link).
    try { fiber = await world.load<Fiber>(realpathSync(resolve(root, 'node_modules/@react-three/fiber', entry))); } catch (e) { why = String((e as Error)?.message ?? e).split('\n')[0]; continue; }
    if (typeof fiber.createRoot !== 'function' || typeof fiber.extend !== 'function') { why = `${entry} has no createRoot`; continue; }
    fiber.extend(THREE as never);
    // A canvas and a renderer that are neither: nothing here draws. The frame loop is run by hand (`frameloop: 'never'`).
    const canvas = { style: {}, width: 300, height: 150, parentElement: null, addEventListener() {}, removeEventListener() {}, getContext: () => null };
    const gl = {
      domElement: canvas, shadowMap: {}, info: { render: {} }, render() {}, setSize() {}, setPixelRatio() {}, getPixelRatio: () => 1, setAnimationLoop() {}, dispose() {},
      xr: { addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} },
    };
    /**
     * While the component mounts or runs a frame, Math.random answers 0 and what the libraries print is kept instead.
     * `Sheep` draws its idle timers from Math.random: at 0 its idle clock starts at 0, so every idle touch (the ear
     * twitch, the chew, the pig's sniff, the cow's ear flick, the horse's head toss) begins as the state begins, and
     * every run of this stage sees the same frames.
     */
    const hush = (): (() => void) => {
      const keep = { random: Math.random, error: console.error, warn: console.warn };
      Math.random = () => 0;
      console.error = (...args: unknown[]) => { said.push(args.map(String).join(' ').split('\n')[0]); };
      console.warn = () => {};
      return () => { Math.random = keep.random; console.error = keep.error; console.warn = keep.warn; };
    };
    const quietly = <T>(work: () => T): T => { const back = hush(); try { return work(); } finally { back(); } };
    const flush = typeof fiber.flushSync === 'function' ? fiber.flushSync : <T>(work: () => T): T => work();
    const r3f = quietly(() => fiber.createRoot(canvas as never));
    await quietly(() => r3f.configure({ gl: gl as never, frameloop: 'never', size: { width: 300, height: 150, top: 0, left: 0 }, dpr: 1 }));
    const live = { state: null as ReturnType<ReturnType<typeof r3f.render>['getState']> | null };
    const tick = () => new Promise<void>((done) => { setImmediate(done); });
    const bench: Bench = {
      mounts: 0, frames: 0,
      async show(element) {
        let holder: Object3D | null = null;
        said.length = 0;
        const back = hush();
        try {
          const store = flush(() => r3f.render(null));
          const state = (live.state = store.getState());
          for (let i = 0; i < 200 && (state.scene.children.length > 0 || state.internal.subscribers.length > 0); i++) await tick();
          // Beside it, a light that casts with layer 1 on its shadow camera, as every casting light where animals stand
          // has (SHADOW_LAYERS in table/Rendering.tsx): with it, `Sheep` casts through its two shadow stand-ins.
          flush(() => r3f.render(createElement(Fragment, null,
            createElement('directionalLight', { castShadow: true, 'shadow-camera-layers-mask': 0b11 }),
            createElement('group', { ref: (o: Object3D | null) => { if (o) holder = o; } }, element))));
          for (let i = 0; i < 200 && !holder; i++) await tick();
          // Effects (a component's `useFrame` is one, outside a browser) may run after the commit: give them their turn.
          for (let i = 0; i < 3; i++) await tick();
        } finally { back(); }
        if (!holder) throw new NotRun(`the component could not be mounted without a renderer: ${said[0] ?? 'it never came up'}`);
        bench.mounts++;
        return holder;
      },
      frame(t) {
        const s = live.state;
        if (!s) throw new Error('nothing is mounted');
        quietly(() => s.advance(t));
        s.scene.updateMatrixWorld(true);
        bench.frames++;
      },
      close() { try { quietly(() => r3f.unmount()); } catch { /* the stand-in renderer has nothing to give back */ } },
    };
    try {
      await bench.show(probe());
      if (!live.state || live.state.internal.subscribers.length === 0) throw new NotRun('its frame loop never took hold');
      bench.mounts = 0;
      return bench;
    } catch (e) {
      why = String((e as Error)?.message ?? e).split('\n')[0];
      bench.close();
    }
  }
  throw new NotRun(`\`Sheep\` could not be mounted with @react-three/fiber and no renderer (${why || 'no entry of the package could be loaded'})`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading what is mounted
// ---------------------------------------------------------------------------------------------------------------------

type Drawable = Object3D & { geometry: BufferGeometry; isMesh?: boolean; isPoints?: boolean; isLine?: boolean };

/** One mesh of what is mounted. */
interface Item {
  mesh: Drawable;
  /** Everything above it, nearest first, up to the group the bench mounted it in. */
  above: Object3D[];
  /** What the model calls it ("head", "legs[0]", "sig.snout"), or "hat", "scarf", "ice.slab", or a number. */
  name: string;
  /** Its voxels; none for a mesh the mesher did not make (the gust's streaks, the snow points) and for an empty one. */
  parts: Part[];
  /** True for a mesh of the freeze effects, false for one of the animal. */
  fx: boolean;
  /**
   * A mesh `Sheep` draws one geometry joined from several of the model's parts (the head with all that is fixed to it,
   * the legs at rest, the eyes at rest: `bundlesOf` in table/Sheep.tsx). It is one draw, and counted as one; its voxels
   * are judged as the parts it was joined from, each an item of its own (`virtual`), where the bundle puts it.
   */
  bundle?: boolean;
  /** One part of a bundle: a stand-in mesh hung under the bundle's mesh where the bundle puts that part. Never a draw. */
  virtual?: boolean;
}

const drawable = (o: Object3D): o is Drawable => { const d = o as Drawable; return !!(d.isMesh || d.isPoints || d.isLine) && !!d.geometry; };
const isShown = (item: Item) => item.mesh.visible && item.above.every((o) => o.visible);
/** Triangles a mesh hands the renderer; points and lines count as one, so they are never "empty". */
function trianglesOf(mesh: Drawable): number {
  if (!mesh.isMesh) return 1;
  const g = mesh.geometry;
  return (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3;
}
/** Where an item lies with every turn above it left out: its place in the model as it is laid out, not as it is posed. */
function unturned(item: Item): Matrix4 {
  const m = new Matrix4();
  for (const o of [item.mesh, ...item.above]) {
    m.premultiply(new Matrix4().makeScale(o.scale.x, o.scale.y, o.scale.z)).premultiply(new Matrix4().makeTranslation(o.position.x, o.position.y, o.position.z));
  }
  return m;
}

const OFF = 512;
/** One number for a cell, for sets and maps (cells within 512 of the origin each way). */
const cellKey = (x: number, y: number, z: number) => ((x + OFF) * 1024 + (y + OFF)) * 1024 + (z + OFF);
const NEAR6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/**
 * How far a point is from a solid, in cells (0 inside it). `q` is in the solid's own cell coordinates. Farther than
 * `reach` cells comes back as Infinity.
 */
function distanceTo(solid: Set<number>, qx: number, qy: number, qz: number, reach = 12): number {
  const cx = Math.floor(qx), cy = Math.floor(qy), cz = Math.floor(qz);
  if (solid.has(cellKey(cx, cy, cz))) return 0;
  let best = Infinity;
  for (let r = 1; r <= reach; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      const edge = Math.abs(dx) === r || Math.abs(dy) === r;
      for (let dz = -r; dz <= r; dz += edge ? 1 : 2 * r) {
        if (!solid.has(cellKey(cx + dx, cy + dy, cz + dz))) continue;
        const x0 = cx + dx, y0 = cy + dy, z0 = cz + dz;
        const ex = Math.max(x0 - qx, 0, qx - x0 - 1), ey = Math.max(y0 - qy, 0, qy - y0 - 1), ez = Math.max(z0 - qz, 0, qz - z0 - 1);
        const d = Math.hypot(ex, ey, ez);
        if (d < best) best = d;
      }
    }
    // A cell r + 1 away is at least r from the point: once something is that near, nothing farther out is nearer.
    if (best <= r) break;
  }
  return best;
}

/** Every voxel of some parts as boxes in metres, each part carried by its matrix (a move and a scale, no turn). */
function laidBoxes(parts: Part[], m: Matrix4): Float64Array[] {
  const e = m.elements;
  if (Math.abs(e[1]) + Math.abs(e[2]) + Math.abs(e[4]) + Math.abs(e[6]) + Math.abs(e[8]) + Math.abs(e[9]) > 1e-9) throw new Error('laidBoxes: the matrix turns');
  return parts.map((p) => {
    const out = new Float64Array(p.count * 6);
    for (let i = 0; i < p.count; i++) {
      const x = p.cells[i * 3] * p.size + p.offset[0], y = p.cells[i * 3 + 1] * p.size + p.offset[1], z = p.cells[i * 3 + 2] * p.size + p.offset[2];
      out[i * 6] = x * e[0] + e[12]; out[i * 6 + 1] = y * e[5] + e[13]; out[i * 6 + 2] = z * e[10] + e[14];
      out[i * 6 + 3] = (x + p.size) * e[0] + e[12]; out[i * 6 + 4] = (y + p.size) * e[5] + e[13]; out[i * 6 + 5] = (z + p.size) * e[10] + e[14];
    }
    return out;
  });
}

/** A named pile of boxes for `pieces`: what one mesh draws, where it lies. */
interface Laid { name: string; part: Part; box: Float64Array }
/** Joins boxes by face and edge (`pieces` in connect.ts) and hands back the pieces that are not the biggest. */
function loosePieces(laid: Laid[]): { pieces: number; voxels: number; loose: { voxels: number; from: string; names: string[]; box: number[] }[]; main: Set<string> } {
  const byPart = new Map<Part, Laid>();
  // Each mesh gets a part of its own to be told apart by: one voxel set drawn twice would otherwise be one name.
  const parts = laid.map((l) => { const p = { ...l.part }; byPart.set(p, l); return p; });
  const found = pieces(parts, (p) => byPart.get(p)!.box, false);
  const main = new Set((found.pieces[0]?.from ?? []).map((f) => byPart.get(f.part)!.name));
  const loose = found.pieces.slice(1).map((piece) => ({ voxels: piece.voxels, from: byPart.get(piece.from[0].part)!.name, names: piece.from.map((f) => byPart.get(f.part)!.name), box: piece.box }));
  return { pieces: found.pieces.length, voxels: found.voxels, loose, main };
}

/** The ice block's slab as a solid, and how much of some meshes' voxels (by their centres) lies inside it. */
function insideOf(slab: Item) {
  const sp0 = slab.parts[0];
  const slabSolid = new Set<number>();
  for (let i = 0; i < sp0.count; i++) slabSolid.add(cellKey(sp0.cells[i * 3], sp0.cells[i * 3 + 1], sp0.cells[i * 3 + 2]));
  const toSlab = new Matrix4().copy(slab.mesh.matrixWorld).invert();
  const share = (list: Item[]) => {
    let inside = 0, all = 0;
    const p = new Vector3();
    for (const it of list) {
      const rel = new Matrix4().multiplyMatrices(toSlab, it.mesh.matrixWorld);
      for (const part of it.parts) for (let i = 0; i < part.count; i++) {
        p.set((part.cells[i * 3] + 0.5) * part.size + part.offset[0], (part.cells[i * 3 + 1] + 0.5) * part.size + part.offset[1], (part.cells[i * 3 + 2] + 0.5) * part.size + part.offset[2]).applyMatrix4(rel);
        all++;
        if (slabSolid.has(cellKey(Math.floor((p.x - sp0.offset[0]) / sp0.size), Math.floor((p.y - sp0.offset[1]) / sp0.size), Math.floor((p.z - sp0.offset[2]) / sp0.size)))) inside++;
      }
    }
    return { inside, all };
  };
  return { sp0, slabSolid, toSlab, share };
}

/** The animal's own cells: not the frost that settles on it, its breath, its hat or a scarf. */
const OWN = (it: Item) => !/^(frosts\.|breath$|hat$|scarf$)/.test(it.name);

// ---------------------------------------------------------------------------------------------------------------------
// Coincident faces and terrace lines
// ---------------------------------------------------------------------------------------------------------------------

/** The area two convex polygons share, each a ring of [u, v] going the same way round (Sutherland and Hodgman). */
function sharedArea(a: number[][], b: number[][]): number {
  let out = a;
  for (let i = 0; i < b.length && out.length; i++) {
    const [x0, y0] = b[i], [x1, y1] = b[(i + 1) % b.length];
    const side = (p: number[]) => (x1 - x0) * (p[1] - y0) - (y1 - y0) * (p[0] - x0);
    const next: number[][] = [];
    for (let k = 0; k < out.length; k++) {
      const p = out[k], q = out[(k + 1) % out.length], sp = side(p), sq = side(q);
      if (sp >= 0) next.push(p);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    out = next;
  }
  let area = 0;
  for (let k = 0; k < out.length; k++) { const p = out[k], q = out[(k + 1) % out.length]; area += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(area) / 2;
}

/**
 * Faces two meshes both draw on one plane, facing the same way, over some of the same area: what flickers. `drawn`
 * are meshes with the matrix each is drawn with, turns included, so this is the animal as it stands, not as it was
 * built: an ear that droops shares no plane with the head it was built flush with, but for the faces it turns in.
 * Counted for each two meshes as the faces of the one that has fewer in it.
 */
function coincidentFaces(drawn: { name: string; as: string; geometry: BufferGeometry; m: Matrix4 }[]): { faces: number; by: Map<string, number>; keys: string[] } {
  interface Face { mesh: number; id: number; key: string; ring: number[][]; u0: number; u1: number; v0: number; v1: number }
  const planes = new Map<string, Face[]>();
  const n = new Vector3(), c = new Vector3(), U = new Vector3(), V = new Vector3();
  let ids = 0;
  drawn.forEach((d, mesh) => {
    const pos = d.geometry.getAttribute('position'), nor = d.geometry.getAttribute('normal');
    if (!pos || !nor) return;
    for (let f = 0; f + 3 < pos.count; f += 4) {
      n.set(nor.getX(f), nor.getY(f), nor.getZ(f)).transformDirection(d.m);
      // The plane's own two axes, the same for every face on it: from whichever world axis the normal leans on least.
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      U.set(ax <= ay && ax <= az ? 1 : 0, ay < ax && ay <= az ? 1 : 0, az < ax && az < ay ? 1 : 0).cross(n).normalize();
      V.crossVectors(n, U);
      const ring: number[][] = [];
      let depth = 0;
      for (let k = 0; k < 4; k++) { c.set(pos.getX(f + k), pos.getY(f + k), pos.getZ(f + k)).applyMatrix4(d.m); ring.push([c.dot(U), c.dot(V)]); depth = c.dot(n); }
      let turn = 0;
      for (let k = 0; k < 4; k++) turn += ring[k][0] * ring[(k + 1) % 4][1] - ring[(k + 1) % 4][0] * ring[k][1];
      if (turn < 0) ring.reverse();
      const key = `${Math.round(n.x * 1e3) + 0},${Math.round(n.y * 1e3) + 0},${Math.round(n.z * 1e3) + 0}:${Math.round(depth * 1e4) + 0}`;
      let list = planes.get(key);
      if (!list) planes.set(key, (list = []));
      const u0 = Math.min(...ring.map((p) => p[0])), u1 = Math.max(...ring.map((p) => p[0])), v0 = Math.min(...ring.map((p) => p[1])), v1 = Math.max(...ring.map((p) => p[1]));
      // Where the face is, to know it again at another coat level.
      list.push({ mesh, id: ids++, key: `${key}:${Math.round(u0 * 1e4) + 0},${Math.round(v0 * 1e4) + 0},${Math.round(u1 * 1e4) + 0},${Math.round(v1 * 1e4) + 0}`, ring, u0, u1, v0, v1 });
    }
  });
  const CELL = 0.04, EPS = 1e-6, AREA = 1e-5;
  const shared = new Map<string, [Set<string>, Set<string>]>();
  for (const faces of planes.values()) {
    if (new Set(faces.map((f) => f.mesh)).size < 2) continue;
    // Sorted into cells the size of a character voxel; two faces are tried once, in the first cell both reach.
    const cells = new Map<string, Face[]>();
    for (const f of faces) {
      for (let a = Math.floor((f.u0 + EPS) / CELL); a <= Math.floor((f.u1 - EPS) / CELL); a++) for (let b = Math.floor((f.v0 + EPS) / CELL); b <= Math.floor((f.v1 - EPS) / CELL); b++) {
        const key = `${a},${b}`;
        let list = cells.get(key);
        if (!list) cells.set(key, (list = []));
        for (const g of list) {
          if (g.mesh === f.mesh) continue;
          if (Math.min(f.u1, g.u1) - Math.max(f.u0, g.u0) <= EPS || Math.min(f.v1, g.v1) - Math.max(f.v0, g.v0) <= EPS) continue;
          if (Math.floor((Math.max(f.u0, g.u0) + EPS) / CELL) !== a || Math.floor((Math.max(f.v0, g.v0) + EPS) / CELL) !== b) continue;
          if (sharedArea(f.ring, g.ring) <= AREA) continue;
          const [lo, hi] = f.mesh < g.mesh ? [f, g] : [g, f];
          const pair = `${lo.mesh},${hi.mesh}`;
          let sets = shared.get(pair);
          if (!sets) shared.set(pair, (sets = [new Set(), new Set()]));
          sets[0].add(lo.key); sets[1].add(hi.key);
        }
        list.push(f);
      }
    }
  }
  let faces = 0;
  const by = new Map<string, number>(), keys: string[] = [];
  for (const [pair, sets] of shared) {
    const [i, j] = pair.split(',').map(Number), fewer = sets[0].size <= sets[1].size ? sets[0] : sets[1];
    faces += fewer.size;
    const names = [drawn[i].name, drawn[j].name].sort().join(' and ');
    by.set(names, (by.get(names) ?? 0) + fewer.size);
    for (const key of fewer) keys.push(`${[drawn[i].as, drawn[j].as].sort().join(' and ')}|${key}`);
  }
  return { faces, by, keys };
}

/**
 * Terrace lines of a solid (plan file 01, section 4.5): the surface is read from each of the six sides as heights,
 * and along every row and every column of each side, a run of three or more steps of exactly one voxel, all the same
 * way and one voxel apart, is a failing line. A line fails once however many runs it holds.
 */
function terraceLines(cells: Iterable<[number, number, number]>): { lines: number; bySide: Record<string, number>; failing: number } {
  const all = [...cells];
  const SIDES = ['+x', '-x', '+y', '-y', '+z', '-z'];
  const bySide: Record<string, number> = {};
  let lines = 0, failing = 0;
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const hi = new Map<number, number>(), lo = new Map<number, number>();
    for (const c of all) {
      const key = (c[u] + OFF) * 1024 + (c[v] + OFF);
      if ((hi.get(key) ?? -Infinity) < c[axis]) hi.set(key, c[axis]);
      if ((lo.get(key) ?? Infinity) > c[axis]) lo.set(key, c[axis]);
    }
    for (const [side, height] of [[SIDES[axis * 2], hi], [SIDES[axis * 2 + 1], lo]] as const) {
      let bad = 0;
      // Along u for each v, then along v for each u.
      for (const along of [0, 1]) {
        const rows = new Map<number, [number, number][]>();
        for (const [key, h] of height) {
          const a = Math.floor(key / 1024) - OFF, b = (key % 1024) - OFF;
          const fixed = along === 0 ? b : a, moving = along === 0 ? a : b;
          let row = rows.get(fixed);
          if (!row) rows.set(fixed, (row = []));
          row.push([moving, h]);
        }
        for (const row of rows.values()) {
          row.sort((p, q) => p[0] - q[0]);
          lines++;
          let run = 0, way = 0, fails = false;
          for (let i = 1; i < row.length && !fails; i++) {
            const step = row[i][0] === row[i - 1][0] + 1 ? row[i][1] - row[i - 1][1] : 0;
            if (Math.abs(step) === 1) { run = step === way ? run + 1 : 1; way = step; } else { run = 0; way = 0; }
            if (run >= LIMIT.runOfSteps) fails = true;
          }
          if (fails) bad++;
        }
      }
      bySide[side] = bad;
      failing += bad;
    }
  }
  return { lines, bySide, failing };
}

// ---------------------------------------------------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What is handed in: one number for each species and check. A thing that fails is counted once however many coat
 * levels it shows at (a loose part, a joint in a state, an empty mesh, a face two parts both draw), so that a tail
 * shown at one more level brings nothing new with it, and a new failure at any level does. The levels are in the
 * report and in `failures`.
 */
interface Tally {
  pieces: Record<Species, number>;
  roots: { leave: Record<Species, number>; lost: Record<Species, number> };
  riders: Record<Species, number>;
  empty: Record<Species, number>;
  draws: { colour: Record<Species, number>; shadow: Record<Species, number>; over: Record<Species, number> };
  tails: Record<Species, number>;
  ice: { outside: Record<Species, number>; loose: Record<Species, number> };
  plate: Record<Species, number>;
  hat: Record<Species, number>;
  scarf: Record<Species, number>;
  coincident: Record<Species, number>;
  terraces: { torso: Record<Species, Record<string, number>>; head: Record<Species, number> };
  props: Record<string, number>;
}

const perSpecies = <T>(make: () => T): Record<Species, T> => Object.fromEntries(SPECIES.map((s) => [s, make()])) as Record<Species, T>;
const perLevel = (): Record<string, number> => Object.fromEntries(LEVELS.map((l) => [String(l), 0]));

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const lines: string[] = [], failures: Failure[] = [];
  const measured: Tally = {
    pieces: perSpecies(() => 0), roots: { leave: perSpecies(() => 0), lost: perSpecies(() => 0) }, riders: perSpecies(() => 0), empty: perSpecies(() => 0),
    draws: { colour: perSpecies(() => 0), shadow: perSpecies(() => 0), over: perSpecies(() => 0) },
    tails: perSpecies(() => 0), ice: { outside: perSpecies(() => 0), loose: perSpecies(() => 0) },
    plate: perSpecies(() => 0), hat: perSpecies(() => 0), scarf: perSpecies(() => 0),
    coincident: perSpecies(() => 0), terraces: { torso: perSpecies(perLevel), head: perSpecies(() => 0) }, props: {},
  };
  const data: Record<string, unknown> = {};
  let bench: Bench | null = null;
  try {
    bench = await judge(world, options, measured, lines, failures, data);
  } catch (e) {
    bench?.close();
    if (e instanceof NotRun) return { ok: false, summary: `NOT RUN: ${e.message}`, lines, measured: {}, failures: [], data: null };
    throw e;
  }
  bench.close();

  const show = typeof options.flags.show === 'string' ? options.flags.show : typeof options.flags.detail === 'string' ? options.flags.detail : null;
  if (show !== null) {
    const hits = failures.filter((f) => `${f.scene} ${f.source} ${f.what} ${f.where}`.includes(show));
    lines.push('', `--show=${show}: ${plural(hits.length, 'failing item')}`);
    for (const f of hits) lines.push(`    ${f.scene}  ${f.source}  ${f.where}: ${f.what}`);
  }
  const animals = failures.filter((f) => f.scene.startsWith('animal:')).length, props = failures.length - animals;
  return {
    ok: true,
    summary: `${plural(failures.length, 'failing item')} (${count(animals)} on the six animals over five coat levels and ${(data.states as string[]).length} states, ${count(props)} loose pieces in props); every one named and counted`,
    lines, measured: measured as unknown as Record<string, unknown>, failures, data,
  };
}

async function judge(world: World, options: StageOptions, measured: Tally, lines: string[], failures: Failure[], data: Record<string, unknown>): Promise<Bench> {
  const { root } = options;
  for (const sp of SPECIES) if (!world.models.some((m) => m.id === `animal:${sp}`)) throw new NotRun(`the model "animal:${sp}" was not built in this run`);

  // ---- The game's own modules, from the graph the world was built in.
  const sheepMod = await world.load<SheepModule>('src/skin/table/Sheep.tsx');
  const rig = await world.load<RigModule>('src/skin/voxel/animals/rig.ts');
  const festive = await world.load<typeof import('../../src/skin/scene/festive')>('src/skin/scene/festive.ts');
  const barn = await world.load<typeof import('../../src/skin/table/BarnTable')>('src/skin/table/BarnTable.tsx');
  const layout = await world.load<typeof import('../../src/skin/scene/layout')>('src/skin/scene/layout.ts');
  const bombMod = await world.load<typeof import('../../src/skin/voxel/bomb')>('src/skin/voxel/bomb.ts');
  const states: readonly SheepState[] | undefined = sheepMod.ALL_STATES;
  if (!states || typeof states.length !== 'number') throw new NotRun('src/skin/table/Sheep.tsx does not export ALL_STATES');
  if (new Set(states).size !== states.length || states.length < 20) throw new NotRun(`ALL_STATES in src/skin/table/Sheep.tsx lists ${states.length} states, ${new Set(states).size} of them different: the plan's 20 are not all there`);
  const S = rig.S;
  const { Sheep, SantaHat, __rig } = sheepMod;
  const hatGeometry = festive.santaHat();
  const model = (sp: Species) => world.model(`animal:${sp}`).built as AnimalModel;

  const bench = await openBench(world, root, () => createElement(Sheep, { level: 2, state: 'idle', model: model('sheep') }));

  // The bundles `Sheep` joins, built here (outside any capture) so that every species' are made the same way, and
  // judged as the parts they join (`read`).
  if (typeof sheepMod.bundlesOf !== 'function') throw new NotRun('src/skin/table/Sheep.tsx does not export bundlesOf: the meshes it joins cannot be told apart');
  const bundles = new Map<BufferGeometry, { geo: BufferGeometry; at: number[]; scale: number }[]>();
  for (const sp of SPECIES) for (const b of sheepMod.bundlesOf(model(sp))) bundles.set(b.geo, b.sources as never);

  // ---- Which voxels each mounted geometry is made of: every level of every species is mounted once while the world
  // listens, so that what the component builds for itself (the winner's scarf, the ice block) is caught as well.
  const drawn = {} as Record<Species, Model>;
  for (const sp of SPECIES) {
    drawn[sp] = await world.capture(`animal:${sp} as drawn`, 'animal', async () => {
      const seen = new Set<BufferGeometry>();
      for (const level of LEVELS) {
        const holder = await bench.show(createElement(Sheep, { level, state: 'frozen', scarf: true, model: model(sp) }));
        for (const t of [0, 0.001, 1]) bench.frame(t);
        holder.traverse((o) => { if (drawable(o)) seen.add(o.geometry); });
      }
      return { geometries: [...seen] };
    });
  }

  /** The model's own name for each of its geometries. */
  const namesOf = (m: AnimalModel): Map<BufferGeometry, string> => {
    const names = new Map<BufferGeometry, string>();
    const put = (p: { geo?: BufferGeometry } | undefined, name: string) => { if (p?.geo && !names.has(p.geo)) names.set(p.geo, name); };
    for (const l of [1, 2, 3, 4] as const) { put(m.wools[l], `wools.${l}`); put(m.frosts[l], `frosts.${l}`); }
    put(m.sheared, 'sheared'); put(m.head, 'head'); put(m.hood, 'hood'); put(m.tail, 'tail'); put(m.neck, 'neck');
    m.eyes.forEach((p, i) => put(p, `eyes[${i}]`)); m.ears.forEach((p, i) => put(p, `ears[${i}]`)); m.legs.forEach((p, i) => put(p, `legs[${i}]`));
    for (const [k, p] of Object.entries(m.lids)) put(p, `lids.${k}`);
    for (const [k, p] of Object.entries(m.brows)) put(p, `brows.${k}`);
    for (const [k, p] of Object.entries(m.mouths)) put(p, `mouths.${k}`);
    put(m.collar, 'collar'); put(m.bell, 'bell'); put(m.breath, 'breath'); put(m.worn, 'worn');
    for (const p of m.signature) put(p, `sig.${p.name}`);
    names.set(hatGeometry, 'hat');
    return names;
  };
  /** The cells each of the model's geometries was built from, for the cells its hollowing took out (`cavityOf`). */
  const builtCells = (m: AnimalModel): Map<BufferGeometry, VoxelMap> => {
    const out = new Map<BufferGeometry, VoxelMap>();
    const put = (p: { geo?: BufferGeometry; cells?: VoxelMap } | undefined) => { if (p?.geo && p.cells) out.set(p.geo, p.cells); };
    for (const l of [1, 2, 3, 4] as const) put(m.wools[l]);
    put(m.sheared); put(m.head); put(m.hood); put(m.neck);
    return out;
  };

  /** What is mounted under `holder`, as items. The animal's root holds its body group and, beside it, its freeze effects. */
  const read = (holder: Object3D, sp: Species, what: string): { items: Item[]; block: Object3D | null; shadowOnly: Item[] } => {
    const sheepRoot = holder.children[0];
    const m = model(sp), names = namesOf(m);
    const bodyGeos = new Set<BufferGeometry>([m.sheared.geo, ...([1, 2, 3, 4] as const).map((l) => m.wools[l].geo)]);
    const holdsBody = (o: Object3D) => { let found = false; o.traverse((c) => { if (drawable(c) && bodyGeos.has(c.geometry)) found = true; }); return found; };
    if (!sheepRoot || sheepRoot.children.length !== 2 || !holdsBody(sheepRoot.children[0]) || holdsBody(sheepRoot.children[1])) {
      throw new NotRun(`${what}: \`Sheep\` no longer mounts one group for the animal and, beside it, one for its freeze effects: tools/scenes/models.ts must be brought up to date`);
    }
    const fxRoot = sheepRoot.children[1];
    const blocks = fxRoot.children.filter((c) => (c as { isGroup?: boolean }).isGroup);
    const block = blocks.length === 1 ? blocks[0] : null;
    const iceNames = ['ice.base', 'ice.icicles', 'ice.cap', 'ice.glints', 'ice.cracks', 'ice.slab'];
    const items: Item[] = [], virtual: Item[] = [], shadowOnly: Item[] = [];
    let n = 0;
    const walk = (o: Object3D, above: Object3D[], fx: boolean) => {
      // A shadow stand-in (change 4.13): on no layer a camera draws, so it is drawn into the shadow map alone. It is
      // the same cells as the parts it stands in for, so it is judged as nothing but a draw into the shadow map.
      if (drawable(o) && !o.layers.test(new THREE.Layers())) { shadowOnly.push({ mesh: o, above, name: `shadow stand-in ${shadowOnly.length}`, parts: [], fx }); return; }
      const sources = drawable(o) && !fx ? bundles.get(o.geometry) : undefined;
      if (sources) {
        // A bundle: one draw, judged as the parts it joins. Each part is a stand-in mesh hung under it where the bundle
        // puts it, so the scene graph carries it with the bundle as the frame loop moves it.
        const bundleMesh = o as Drawable;
        items.push({ mesh: bundleMesh, above, name: `bundle ${n}`, parts: [], fx, bundle: true });
        n++;
        let stand = bundleMesh.userData.standIns as Drawable[] | undefined;
        if (!stand) {
          stand = sources.map((src) => {
            const mm = new THREE.Mesh(src.geo) as unknown as Drawable;
            mm.position.set(src.at[0], src.at[1], src.at[2]);
            mm.scale.setScalar(src.scale);
            mm.userData.source = src;
            return mm;
          });
          bundleMesh.userData.standIns = stand;
          bundleMesh.add(...(stand as unknown as Object3D[]));
          bundleMesh.updateMatrixWorld(true);
        }
        for (const mm of stand) {
          const geo = mm.geometry, name = names.get(geo);
          if (!name) throw new NotRun(`${what}: a bundle joins a geometry that is no part of the ${sp}'s model this stage knows`);
          const parts = geo === hatGeometry ? world.model('hat').partsOf(geo) : world.model(`animal:${sp}`).partsOf(geo);
          if (!parts.length) throw new NotRun(`${what}: "${name}" in a bundle is not made of voxels the mesher was given`);
          virtual.push({ mesh: mm, above: [bundleMesh, ...above], name, parts, fx, virtual: true });
        }
        return;
      }
      if (drawable(o)) {
        const parts = drawn[sp].partsOf(o.geometry);
        const k = block ? block.children.indexOf(o) : -1;
        const name = names.get(o.geometry) ?? (k >= 0 && block!.children.length === 6 ? iceNames[k] : fx ? `freeze effect ${n}` : parts.length ? 'scarf' : `mesh ${n}`);
        items.push({ mesh: o, above, name, parts, fx });
        n++;
      }
      for (const c of o.children) walk(c, [o, ...above], fx || c === fxRoot);
    };
    walk(holder, [], false);
    // The stand-ins first: where a part is also mounted as its own mesh (a leg, an eye, shown while it moves), that mesh
    // is the one found by its name.
    return { items: [...virtual, ...items], block, shadowOnly };
  };

  const fail = (sp: Species, check: string, part: string, where: string, what: string) => {
    failures.push({ scene: `animal:${sp}`, detail: 'fine', what, where, source: `${check}: ${part}` });
  };

  // ---- Solids, in the cells the model was built in.
  const solids = new WeakMap<BufferGeometry, Set<number>>();
  const solidOf = (sp: Species, item: Item): Set<number> => {
    let set = solids.get(item.mesh.geometry);
    if (set) return set;
    set = new Set<number>();
    for (const p of item.parts) for (let i = 0; i < p.count; i++) set.add(cellKey(p.cells[i * 3], p.cells[i * 3 + 1], p.cells[i * 3 + 2]));
    const cells = builtCells(model(sp)).get(item.mesh.geometry);
    const cavity = cells ? rig.cavityOf(cells) : undefined;
    if (cavity) for (const v of cavity.values()) set.add(cellKey(v.x, v.y, v.z));
    solids.set(item.mesh.geometry, set);
    return set;
  };

  const per = {
    draws: perSpecies(() => [] as { colour: number; shadow: number; empty: number; emptyShadow: number }[]),
    tail: perSpecies(() => ''),
    inside: perSpecies(() => [] as number[]), insideRest: perSpecies(() => [] as number[]), insideHat: perSpecies(() => [] as number[]),
    iceLoose: perSpecies(() => ({ glints: 0, cracks: 0, cap: 0, of: { glints: 0, cracks: 0, cap: 0 }, apart: { glints: 0, cracks: 0, cap: 0 }, first: { glints: 0, cracks: 0, cap: 0 } })),
    plate: perSpecies(() => [] as { gap: number; units: number; top: string }[]),
    hat: perSpecies(() => null as null | { under: number; top: number; off: number }),
    scarf: perSpecies(() => [] as { voxels: number; loose: number }[]),
    emptyNames: perSpecies(() => new Map<string, Set<string>>()),
    rootNames: perSpecies(() => new Map<string, { levels: Set<number>; states: Set<string>; worst: number; cells: number; of: number; rootless: Set<number>; rider: boolean; lost: Set<string> }>()),
    riders: perSpecies(() => new Set<string>()),
    joints: perSpecies(() => new Set<string>()),
    hatAtRest: perSpecies(() => 0),
    terraceSides: perSpecies(() => ({} as Record<string, number>)),
    coincidentBy: perSpecies(() => new Map<string, number>()),
    coincidentWithin: perSpecies(() => 0),
    // The distinct failing things, and how many there are at each level.
    distinct: perSpecies(() => ({ pieces: new Set<string>(), leave: new Set<string>(), lost: new Set<string>(), riders: new Set<string>(), empty: new Set<string>(), coincident: new Set<string>() })),
    byLevel: perSpecies(() => ({ pieces: perLevel(), leave: perLevel(), lost: perLevel(), riders: perLevel(), empty: perLevel(), coincident: perLevel() })),
  };

  /** Root failures already counted: `run` is one state at two paces, and fails once. */
  const counted = new Set<string>();

  pinned(root, 'src/skin/table/Sheep.tsx', ['block.add(base, icicles, cap, glints, cracks, slab);']);
  pinned(root, 'src/skin/table/BarnTable.tsx', ['return <group ref={g} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE * drawScale}>{children}</group>;']);

  let iceProp: { laid: Laid[] } | null = null;

  for (const sp of SPECIES) {
    const m = model(sp);
    const animalParts = (items: Item[]) => items.filter((it) => !it.fx && it.parts.length > 0 && isShown(it));
    const strange = (items: Item[], where: string) => {
      const odd = items.find((it) => !it.fx && !it.bundle && isShown(it) && it.parts.length === 0 && trianglesOf(it.mesh) > 0);
      if (odd) throw new NotRun(`${sp} ${where}: "${odd.name}" is drawn and is not made of voxels the mesher was given, so it cannot be judged`);
    };

    /**
     * The joints of the animal as it stands at rest at one level, and the cells each joins its parent with: as the
     * component lays the animal out, no part turned, the cells that are inside a parent or touch it.
     */
    const layOut = (items: Item[], level: number) => {
      const byName = new Map(items.map((it) => [it.name, it]));
      const has = (name: string) => (byName.get(name)?.parts.length ?? 0) > 0;
      // The body is what is drawn of it at this level: the coat (the body is meshed with it), or the bare body.
      const bodyNames = [`wools.${Math.max(1, level)}`, 'sheared'].filter((n) => has(n) && isShown(byName.get(n)!));
      if (!bodyNames.length) throw new NotRun(`${sp} level ${level}: neither a coat nor the bare body is drawn`);
      const sig = (where: 'head' | 'body') => m.signature.filter((q) => q.where === where && q.anim && has(`sig.${q.name}`)).map((q) => `sig.${q.name}`);
      const headMeshes = ['head', 'hood'].filter(has);
      const list: { name: string; child: string[]; parents: string[]; rider?: boolean }[] = [
        ...[0, 1, 2, 3].filter((i) => has(`legs[${i}]`)).map((i) => ({ name: `legs[${i}]`, child: [`legs[${i}]`], parents: bodyNames })),
        ...(has('tail') ? [{ name: 'tail', child: ['tail'], parents: bodyNames }] : []),
        ...(has('neck') ? [{ name: 'neck', child: ['neck'], parents: bodyNames }] : []),
        { name: 'head', child: headMeshes, parents: has('neck') ? ['neck'] : bodyNames },
        ...[0, 1].filter((i) => has(`ears[${i}]`)).map((i) => ({ name: `ears[${i}]`, child: [`ears[${i}]`], parents: headMeshes })),
        ...sig('head').map((n) => ({ name: n, child: [n], parents: headMeshes })),
        ...sig('body').map((n) => ({ name: n, child: [n], parents: bodyNames })),
        ...(has('bell') ? [{ name: 'bell', child: ['bell'], parents: ['collar', ...bodyNames, 'neck'].filter(has) }] : []),
        // Not joints, and judged the same way: the parts that are mounted on the body and lie on the neck or the head
        // (a collar, a mane), which move without them. Each is a rider only if more of its cells join the neck and
        // the head than join the bare body it is mounted on.
        ...['collar', ...m.signature.filter((q) => q.where === 'body' && !q.anim).map((q) => `sig.${q.name}`)].filter(has).map((n) => ({ name: n, child: [n], parents: ['neck', ...headMeshes].filter(has), rider: true })),
      ];
      const point = new Vector3();
      const joining = (childNames: string[], parentNames: string[]) => {
        const parents = parentNames.map((n) => byName.get(n)!), solid = parents.map((q) => solidOf(sp, q));
        for (const q of parents) if (q.parts.length !== 1) throw new NotRun(`${sp}: "${q.name}" is drawn from ${q.parts.length} voxel sets, and a parent must be one`);
        const laidInv = parents.map((q) => unturned(q).invert());
        const children = childNames.flatMap((n) => {
          const it = byName.get(n)!, laid = unturned(it);
          const rels = laidInv.map((inv) => new Matrix4().multiplyMatrices(inv, laid));
          return it.parts.map((part, index) => {
            const cells: number[] = [];
            for (let i = 0; i < part.count; i++) {
              const x = part.cells[i * 3], y = part.cells[i * 3 + 1], z = part.cells[i * 3 + 2];
              for (let k = 0; k < parents.length; k++) {
                const pp = parents[k].parts[0];
                point.set((x + 0.5) * part.size + part.offset[0], (y + 0.5) * part.size + part.offset[1], (z + 0.5) * part.size + part.offset[2]).applyMatrix4(rels[k]);
                if (distanceTo(solid[k], (point.x - pp.offset[0]) / pp.size, (point.y - pp.offset[1]) / pp.size, (point.z - pp.offset[2]) / pp.size, 1) <= JOINS) { cells.push(x, y, z); break; }
              }
            }
            return { name: n, part: index, cells };
          });
        });
        return { children, of: children.reduce((k, c) => k + c.cells.length / 3, 0) };
      };
      const bare = has('sheared') ? ['sheared'] : bodyNames;
      return list.map((j) => {
        const joined = joining(j.child, j.parents);
        const rides = !j.rider || joined.of > joining(j.child, bare).of;
        return { name: j.name, parents: j.parents, rider: j.rider === true, children: joined.children, of: rides ? joined.of : 0 };
      });
    };

    for (const level of LEVELS) {
      const L = String(level), at = `level ${level}`;
      let joints: ReturnType<typeof layOut> = [];

      // ============ At rest: nothing moving, idle.
      {
        const holder = await bench.show(createElement(Sheep, { level, state: 'idle', still: true, model: m }));
        for (const t of [0, 0.001, 0.002]) bench.frame(t);
        const { items } = read(holder, sp, `${sp} ${at}`);
        strange(items, at);
        const shown = items.filter((it) => isShown(it) && !it.virtual);
        joints = layOut(items, level);

        // Tail at level 0.
        if (level === 0) {
          const tail = items.find((it) => it.name === 'tail');
          const showsIt = !!tail && isShown(tail) && trianglesOf(tail.mesh) > 0;
          per.tail[sp] = !tail || tail.parts.length === 0 ? 'has none' : showsIt ? 'shown' : sp === 'sheep' ? 'hidden by design' : 'HIDDEN';
          if (sp !== 'sheep' && tail && tail.parts.length > 0 && !showsIt) {
            measured.tails[sp] = 1;
            fail(sp, 'tails', 'tail', `${at}, idle`, `the tail (${plural(tail.parts.reduce((k, p) => k + p.count, 0), 'voxel')}) is not drawn at coat level 0`);
          }
        }

        // One piece, as laid out.
        const laid: Laid[] = animalParts(items).flatMap((it) => { const b = laidBoxes(it.parts, unturned(it)); return it.parts.map((part, i) => ({ name: it.name, part, box: b[i] })); });
        const found = loosePieces(laid);
        per.byLevel[sp].pieces[L] = found.loose.length;
        for (const l of found.loose) {
          per.distinct[sp].pieces.add(l.names.join(' + '));
          fail(sp, 'pieces', l.from, at, `${plural(l.voxels, 'voxel')} of ${l.names.join(' + ')} touch the rest of the animal nowhere as it is drawn (x ${f2(l.box[0])}..${f2(l.box[3])} y ${f2(l.box[1])}..${f2(l.box[4])} z ${f2(l.box[2])}..${f2(l.box[5])})`);
        }

        // The name plate over the highest thing drawn.
        let top = -Infinity, topOf = '';
        const v = new Vector3();
        for (const it of animalParts(items)) {
          const pos = it.mesh.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(it.mesh.matrixWorld); if (v.y > top) { top = v.y; topOf = it.name; } }
        }
        const seatScale = layout.SHEEP_SCALE * m.drawScale, plateY = barn.nameplateY(sp);
        const gap = plateY - top * seatScale;
        per.plate[sp].push({ gap, units: plateY / seatScale - top, top: topOf });
        if (gap < LIMIT.plate[0] - 1e-9 || gap > LIMIT.plate[1] + 1e-9) {
          measured.plate[sp]++;
          fail(sp, 'plate', 'name plate', at, `the plate stands ${f3(Math.abs(gap))} m ${gap < 0 ? 'under' : 'over'} the highest voxel drawn, which is the ${topOf}'s (plate at ${f3(plateY)} m, the top at ${f3(top * seatScale)} m, at the table's scale of ${f2(seatScale)}); the plan asks ${LIMIT.plate[0]} to ${LIMIT.plate[1]} m over it`);
        }

        // The hat's band and the crown. Both hang in the head's group, so they are compared in the hat's own frame.
        const hat = items.find((it) => it.name === 'hat' && isShown(it));
        if (hat && level === 2) {
          const heads = items.filter((it) => (it.name === 'head' || it.name === 'hood') && it.parts.length > 0);
          const toHat = new Matrix4().copy(hat.mesh.matrixWorld).invert();
          let crown = -Infinity;
          for (const h of heads) {
            const rel = new Matrix4().multiplyMatrices(toHat, h.mesh.matrixWorld);
            const pos = h.mesh.geometry.getAttribute('position');
            for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(rel); if (v.y > crown) crown = v.y; }
          }
          // The band is the hat's brim: its two lowest rows (`santaHat` in scene/festive.ts: "brim at y = 0").
          const hp = hat.parts[0];
          let low = Infinity;
          for (let i = 0; i < hp.count; i++) low = Math.min(low, hp.cells[i * 3 + 1]);
          const k = hat.mesh.scale.y;
          const under = (low * hp.size + hp.offset[1] - crown) * k, over = ((low + 2) * hp.size + hp.offset[1] - crown) * k;
          const off = under > 0 ? under : over < 0 ? -over : 0;
          per.hat[sp] = { under, top: over, off };
          if (off > S + 1e-9) {
            measured.hat[sp] = 1;
            fail(sp, 'hat', 'hat', at, `the hat's band is ${f3(off)} m ${under > 0 ? 'over' : 'under'} the crown: more than one voxel (${S} m)`);
          }
        }

        // Faces two parts both draw.
        // The body is one thing to share a face with, whichever coat it is meshed with.
        const co = coincidentFaces(animalParts(items).map((it) => ({ name: it.name, as: /^(wools\.\d|sheared)$/.test(it.name) ? 'body' : it.name, geometry: it.mesh.geometry, m: it.mesh.matrixWorld })));
        per.byLevel[sp].coincident[L] = co.faces;
        for (const key of co.keys) per.distinct[sp].coincident.add(key);
        const headGroup = items.find((it) => it.name === 'head')?.above[0];
        const onHead = (name: string) => { const it = items.find((x) => x.name === name); return !!it && !!headGroup && it.above.includes(headGroup); };
        for (const [names, n] of co.by) {
          // Named with "body" for whichever coat the body is meshed with, so one pair is one name at every level.
          const pair = names.replace(/\b(wools\.\d|sheared)\b/g, 'body');
          fail(sp, 'coincident', pair, at, `${plural(n, 'face')} that both draw on one plane, facing the same way, as the animal stands`);
          if (level !== 2) continue;
          per.coincidentBy[sp].set(pair, n);
          const [a, b] = names.split(' and ');
          if (onHead(a) === onHead(b) && !a.startsWith('ears') && !b.startsWith('ears')) per.coincidentWithin[sp] += n;
        }

        // The same animal against the ice block where the frozen one has it: the plan's own figure is taken at rest.
        const slabAtRest = items.find((it) => it.name === 'ice.slab');
        if (slabAtRest && slabAtRest.parts.length === 1) {
          const ice = insideOf(slabAtRest), r = ice.share(animalParts(items).filter(OWN));
          per.insideRest[sp].push(r.inside / r.all);
          if (level === 2) { const h = ice.share(animalParts(items).filter((it) => OWN(it) || it.name === 'hat')); per.hatAtRest[sp] = h.inside / h.all; }
        }
      }

      // ============ Draws at idle, once the state has settled: the 200 ms blend from the rest pose it is mounted in is
      // over, so every part stands where idle holds it (the ears drooped) and the shadow stand-ins carry them.
      {
        const holder = await bench.show(createElement(Sheep, { level, state: 'idle', still: true, model: m }));
        for (const t of [0, 0.001, 0.002, 0.4]) bench.frame(t);
        const { items, shadowOnly } = read(holder, sp, `${sp} ${at} settled`);
        const shown = items.filter((it) => isShown(it) && !it.virtual);
        // Draws: every visible mesh is one draw in colour (three.js draws an empty one too), and one more into the
        // shadow map if it casts.
        // The shadow stand-ins are counted with the meshes that cast (change 4.13).
        const colour = shown.filter((it) => it.mesh.layers.test(new THREE.Layers())).length, shadow = [...shown, ...shadowOnly.filter(isShown)].filter((it) => it.mesh.castShadow).length;
        const emptyNow = shown.filter((it) => trianglesOf(it.mesh) === 0).length, emptyShadow = shown.filter((it) => trianglesOf(it.mesh) === 0 && it.mesh.castShadow).length;
        per.draws[sp].push({ colour, shadow, empty: emptyNow, emptyShadow });
        measured.draws.colour[sp] = Math.max(measured.draws.colour[sp], colour);
        measured.draws.shadow[sp] = Math.max(measured.draws.shadow[sp], shadow);
        if (colour > LIMIT.colour || shadow > LIMIT.shadow) {
          measured.draws.over[sp]++;
          fail(sp, 'draws', 'the whole animal', `${at}, idle`, `${colour} meshes drawn in colour (the limit is ${LIMIT.colour}) and ${shadow} into the shadow map (the limit is ${LIMIT.shadow}); ${emptyNow} of the ${colour} have no triangles`);
        }

      }

      // ============ The winner's scarf.
      {
        const holder = await bench.show(createElement(Sheep, { level, state: 'idle', still: true, scarf: true, model: m }));
        for (const t of [0, 0.001, 0.002]) bench.frame(t);
        const { items } = read(holder, sp, `${sp} ${at} with the scarf`);
        const scarf = items.find((it) => it.name === 'scarf' && isShown(it));
        if (!scarf) throw new NotRun(`${sp} ${at}: \`Sheep\` with \`scarf\` mounts no scarf this stage can find`);
        const laid: Laid[] = animalParts(items).flatMap((it) => { const b = laidBoxes(it.parts, unturned(it)); return it.parts.map((part, i) => ({ name: it.name, part, box: b[i] })); });
        const found = loosePieces(laid);
        const voxels = scarf.parts.reduce((k, p) => k + p.count, 0);
        const loose = found.loose.filter((l) => l.from === 'scarf').reduce((k, l) => k + l.voxels, 0);
        per.scarf[sp].push({ voxels, loose });
        if (loose > 0) {
          measured.scarf[sp]++;
          fail(sp, 'scarf', 'scarf', at, `${count(loose)} of the scarf's ${count(voxels)} voxels touch the animal nowhere`);
        }
      }

      // ============ Frozen: inside the block.
      {
        const holder = await bench.show(createElement(Sheep, { level, state: 'frozen', model: m }));
        for (const t of [0, 0.001, 0.5, 1]) bench.frame(t);
        const { items, block } = read(holder, sp, `${sp} ${at} frozen`);
        strange(items, `${at} frozen`);
        const slab = items.find((it) => it.name === 'ice.slab');
        if (!block || block.children.length !== 6 || !slab || !isShown(slab) || slab.parts.length !== 1) throw new NotRun(`${sp} ${at}: frozen, \`Sheep\` shows no ice block of six parts that this stage can find`);
        const ice = insideOf(slab);
        const { toSlab, sp0, slabSolid } = ice;
        const share = ice.share;
        const body = share(animalParts(items).filter(OWN)), withHat = share(animalParts(items).filter((it) => OWN(it) || it.name === 'hat'));
        const ratio = body.inside / body.all;
        per.inside[sp].push(ratio);
        per.insideHat[sp].push(withHat.inside / withHat.all);
        if (ratio < LIMIT.inside) {
          measured.ice.outside[sp]++;
          fail(sp, 'ice', 'the whole animal', `${at}, frozen`, `${count(body.all - body.inside)} of its ${count(body.all)} cells (${(100 * (1 - ratio)).toFixed(1)}%) are outside the ice block; the plan asks at least ${LIMIT.inside * 100}% inside`);
        }
        // The block's own parts on its slab, once for each species (one block serves every level).
        if (level === 2) {
          const tally = per.iceLoose[sp];
          for (const key of ['glints', 'cracks', 'cap'] as const) {
            const it = items.find((x) => x.name === `ice.${key}`)!;
            const rel = new Matrix4().multiplyMatrices(toSlab, it.mesh.matrixWorld);
            const p = new Vector3();
            // Each cell where it lies in the slab's own cells.
            const own = new Map<number, [number, number, number]>();
            for (const part of it.parts) for (let i = 0; i < part.count; i++) {
              p.set((part.cells[i * 3] + 0.5) * part.size + part.offset[0], (part.cells[i * 3 + 1] + 0.5) * part.size + part.offset[1], (part.cells[i * 3 + 2] + 0.5) * part.size + part.offset[2]).applyMatrix4(rel);
              const cx = Math.floor((p.x - sp0.offset[0]) / sp0.size), cy = Math.floor((p.y - sp0.offset[1]) / sp0.size), cz = Math.floor((p.z - sp0.offset[2]) / sp0.size);
              own.set(cellKey(cx, cy, cz), [cx, cy, cz]);
            }
            // A cell touches the slab when it shares a face with a slab cell, or lies on a cell of its own part that
            // does (snow lying on snow): worked out from the lowest cells up.
            const touching = new Set<number>();
            let direct = 0;
            for (const [k, [cx, cy, cz]] of [...own].sort((a, b) => a[1][1] - b[1][1])) {
              const onSlab = slabSolid.has(k) || NEAR6.some(([dx, dy, dz]) => slabSolid.has(cellKey(cx + dx, cy + dy, cz + dz)));
              if (onSlab) direct++;
              if (onSlab || touching.has(cellKey(cx, cy - 1, cz))) touching.add(k);
            }
            tally.of[key] = own.size;
            tally[key] = own.size - touching.size;
            tally.apart[key] = own.size - direct;
            // The plan's own count: the cells that have neither the slab nor a cell of their own part under them.
            tally.first[key] = [...own].filter(([k, [cx, cy, cz]]) => !touching.has(k) && !own.has(cellKey(cx, cy - 1, cz))).length;
          }
          measured.ice.loose[sp] = tally.glints + tally.cracks + tally.cap;
          for (const key of ['glints', 'cracks', 'cap'] as const) {
            if (tally[key]) fail(sp, 'ice', `ice.${key}`, `${at}, frozen`, `${count(tally[key])} of the block's ${count(tally.of[key])} ${key === 'cap' ? 'snow cap' : key.slice(0, -1)} cells neither touch its slab nor lie on a cell of the ${key === 'cap' ? 'cap' : key} that does`);
          }
          if (!iceProp) iceProp = { laid: block.children.flatMap((c) => { const it = items.find((x) => x.mesh === c)!; const b = laidBoxes(it.parts, new Matrix4().makeTranslation(c.position.x, c.position.y, c.position.z)); return it.parts.map((part, i) => ({ name: it.name, part, box: b[i] })); }) };
        }
      }

      // ============ Every state.
      for (const state of states) {
        for (const pace of state === 'run' ? [0, 1] : [0]) {
          const holder = await bench.show(createElement(Sheep, { level, state, pace, model: m }));
          bench.frame(0);
          bench.frame(0.001); // the freeze effects are drawn once, shrunk to nothing, on these two frames: not judged
          const { items } = read(holder, sp, `${sp} ${at} ${state}`);
          const byName = new Map(items.map((it) => [it.name, it]));
          // The joints and the cells each joins its parent with were worked out on the animal at rest (`layOut`).
          const rooted = joints.map((j) => ({
            ...j,
            parents: j.parents.map((n) => byName.get(n)!), solid: j.parents.map((n) => solidOf(sp, byName.get(n)!)),
            children: j.children.map((c) => ({ it: byName.get(c.name)!, part: byName.get(c.name)!.parts[c.part], cells: c.cells })),
            last: [] as number[], lastOut: { worst: 0, out: 0 },
          }));
          if (rooted.some((j) => j.parents.some((q) => !q) || j.children.some((c) => !c.it || !c.part))) throw new NotRun(`${sp} ${at} ${state}: a part that is mounted at rest is not mounted in this state`);

          const dur = __rig.DURATION[state] ?? 6;
          const times: number[] = [];
          for (let k = 1; k * 0.05 <= Math.min(1, dur) + 1e-9; k++) times.push(k * 0.05);
          for (let k = 5; k * 0.25 <= dur + 1e-9; k++) times.push(k * 0.25);
          const emptySeen = new Set<string>();
          const bad = new Map<string, { worst: number; out: number; of: number; lost: boolean }>();
          const p = new Vector3(), rel = new Matrix4(), inv = new Matrix4();
          for (const t of times) {
            bench.frame(t);
            for (const it of items) if (!it.virtual && trianglesOf(it.mesh) === 0 && isShown(it)) emptySeen.add(it.name);
            for (const j of rooted) {
              if (!j.children.every((c) => isShown(c.it)) || !j.parents.every(isShown)) continue;
              // A part that lies on nothing that moves without it is no rider.
              if (j.rider && j.of === 0) continue;
              (j.rider ? per.riders[sp] : per.joints[sp]).add(j.name);
              if (j.of === 0) { bad.set(j.name, { worst: Infinity, out: 0, of: 0, lost: true }); continue; }
              // Each child's cells in each parent's frame; the same matrices as the last frame give the same answer.
              const now: number[] = [];
              for (const c of j.children) for (const parent of j.parents) { rel.multiplyMatrices(inv.copy(parent.mesh.matrixWorld).invert(), c.it.mesh.matrixWorld); now.push(...rel.elements); }
              let same = now.length === j.last.length;
              for (let i = 0; same && i < now.length; i++) same = Math.abs(now[i] - j.last[i]) < 1e-9;
              if (!same) {
                let worst = 0, out = 0, at0 = 0;
                for (const c of j.children) {
                  const rels = j.parents.map(() => { const mm = new Matrix4().fromArray(now, at0); at0 += 16; return mm; });
                  for (let i = 0; i < c.cells.length; i += 3) {
                    let d = Infinity;
                    for (let k = 0; k < j.parents.length && d > 0; k++) {
                      const pp = j.parents[k].parts[0];
                      p.set((c.cells[i] + 0.5) * c.part.size + c.part.offset[0], (c.cells[i + 1] + 0.5) * c.part.size + c.part.offset[1], (c.cells[i + 2] + 0.5) * c.part.size + c.part.offset[2]).applyMatrix4(rels[k]);
                      d = Math.min(d, distanceTo(j.solid[k], (p.x - pp.offset[0]) / pp.size, (p.y - pp.offset[1]) / pp.size, (p.z - pp.offset[2]) / pp.size));
                    }
                    if (d > 1 + 1e-6) out++;
                    if (d > worst) worst = d;
                  }
                }
                j.last = now;
                j.lastOut = { worst, out };
              }
              if (j.lastOut.out > 0) {
                const b = bad.get(j.name);
                bad.set(j.name, { worst: Math.max(j.lastOut.worst, b?.worst ?? 0), out: Math.max(j.lastOut.out, b?.out ?? 0), of: j.of, lost: (b?.lost ?? false) || j.lastOut.out === j.of });
              }
            }
          }
          const stateName = state === 'run' ? `run at pace ${pace}` : state;
          for (const name of emptySeen) {
            let set = per.emptyNames[sp].get(`${L}\n${name}`);
            if (!set) per.emptyNames[sp].set(`${L}\n${name}`, (set = new Set()));
            set.add(stateName);
          }
          for (const [name, b] of bad) {
            // `run` is one state at two paces: it fails once.
            const key = `${sp}\n${L}\n${state}\n${name}`, rider = joints.find((j) => j.name === name)?.rider === true;
            const what = `${state}\n${name}`;
            if (!counted.has(key)) { counted.add(key); per.byLevel[sp][rider ? 'riders' : 'leave'][L]++; per.distinct[sp][rider ? 'riders' : 'leave'].add(what); }
            if (b.lost && !rider && !counted.has(`lost\n${key}`)) { counted.add(`lost\n${key}`); per.byLevel[sp].lost[L]++; per.distinct[sp].lost.add(what); }
            fail(sp, rider ? 'riders' : 'roots', name, `${at}, ${stateName}`, b.of === 0
              ? 'as it is laid out at this level, none of its cells is inside its parent or touches it: it has no root'
              : `${b.out === b.of ? `all ${count(b.of)}` : `${count(b.out)} of the ${count(b.of)}`} cells it joins its parent with leave the parent's solid grown by one voxel${b.lost && b.out !== b.of ? ', all of them at one moment' : ''} (the farthest ${Number.isFinite(b.worst) ? `${f3(b.worst * S)} m` : 'more than 0.48 m'} from it)`);
            let e = per.rootNames[sp].get(name);
            if (!e) per.rootNames[sp].set(name, (e = { levels: new Set(), states: new Set(), worst: 0, cells: 0, of: 0, rootless: new Set(), rider, lost: new Set() }));
            e.levels.add(level); e.states.add(state);
            if (b.lost) e.lost.add(`${level} ${state}`);
            if (b.of === 0) e.rootless.add(level);
            else { if (b.worst > e.worst) e.worst = b.worst; if (b.out > e.cells) { e.cells = b.out; e.of = b.of; } }
          }
        }
      }

      // ============ Terraces: the torso as it is dressed at this level, and (once) the head.
      {
        const world2 = world.model(`animal:${sp}`);
        const solidCells = (p: { geo: BufferGeometry; cells?: VoxelMap }): [number, number, number][] => {
          const out = new Map<number, [number, number, number]>();
          for (const part of world2.partsOf(p.geo)) for (let i = 0; i < part.count; i++) out.set(cellKey(part.cells[i * 3], part.cells[i * 3 + 1], part.cells[i * 3 + 2]), [part.cells[i * 3], part.cells[i * 3 + 1], part.cells[i * 3 + 2]]);
          const cavity = p.cells ? rig.cavityOf(p.cells) : undefined;
          if (cavity) for (const c of cavity.values()) out.set(cellKey(c.x, c.y, c.z), [c.x, c.y, c.z]);
          return [...out.values()];
        };
        const torso = terraceLines(solidCells(level === 0 ? m.sheared : m.wools[level as 1 | 2 | 3 | 4]));
        measured.terraces.torso[sp][L] = torso.failing;
        if (torso.failing) fail(sp, 'terraces', 'torso', at, `${plural(torso.failing, 'line')} of the ${count(torso.lines)} across the torso as dressed (${level === 0 ? 'bare' : `wools.${level}`}) hold a run of ${LIMIT.runOfSteps} or more one-voxel steps`);
        if (level === 2) {
          per.terraceSides[sp] = torso.bySide;
          const head = terraceLines(solidCells(m.head));
          measured.terraces.head[sp] = head.failing;
          if (head.failing) fail(sp, 'terraces', 'head', 'every level', `${plural(head.failing, 'line')} of the ${count(head.lines)} across the head hold a run of ${LIMIT.runOfSteps} or more one-voxel steps`);
        }
      }
    }

    // Empty meshes, by level.
    for (const [key, where] of per.emptyNames[sp]) {
      const [L, name] = key.split('\n');
      per.byLevel[sp].empty[L]++;
      per.distinct[sp].empty.add(name);
      fail(sp, 'empty', name, `level ${L}`, `visible with no triangles in ${where.size >= states.length ? 'every state' : `${where.size} of ${states.length} states (${[...where].slice(0, 6).join(', ')}${where.size > 6 ? '...' : ''})`}`);
    }
  }

  for (const sp of SPECIES) {
    const d = per.distinct[sp];
    measured.pieces[sp] = d.pieces.size; measured.roots.leave[sp] = d.leave.size; measured.roots.lost[sp] = d.lost.size;
    measured.riders[sp] = d.riders.size; measured.empty[sp] = d.empty.size; measured.coincident[sp] = d.coincident.size;
  }
  report(lines, measured, per, states.length, bench, S);
  await props(world, options, bench, measured, lines, failures, { SantaHat, bombMod, iceProp });
  data.states = [...states];
  data.mounts = bench.mounts;
  data.frames = bench.frames;
  // What the counts were counted from, for the record: one row a species.
  data.species = Object.fromEntries(SPECIES.map((sp) => [sp, {
    drawsAtIdle: per.draws[sp], tailAtLevel0: per.tail[sp],
    outsideTheIceFrozen: per.inside[sp].map((r) => +(1 - r).toFixed(4)), outsideTheIceAtRest: per.insideRest[sp].map((r) => +(1 - r).toFixed(4)),
    iceCellsOffTheSlab: per.iceLoose[sp], plate: per.plate[sp].map((q) => ({ overTheTop: +q.gap.toFixed(4), inModelUnits: +q.units.toFixed(4), top: q.top })),
    hatBand: per.hat[sp] && { fromTheCrown: +per.hat[sp]!.off.toFixed(4), underside: +per.hat[sp]!.under.toFixed(4) }, scarf: per.scarf[sp],
    joints: [...per.joints[sp]], riders: [...per.riders[sp]], coincidentAtLevel2: Object.fromEntries(per.coincidentBy[sp]), terraceSidesAtLevel2: per.terraceSides[sp],
  }]));
  data.plan = PLAN;
  return bench;
}

type Per = {
  draws: Record<Species, { colour: number; shadow: number; empty: number; emptyShadow: number }[]>;
  tail: Record<Species, string>;
  inside: Record<Species, number[]>; insideRest: Record<Species, number[]>; insideHat: Record<Species, number[]>;
  iceLoose: Record<Species, { glints: number; cracks: number; cap: number; of: { glints: number; cracks: number; cap: number }; apart: { glints: number; cracks: number; cap: number }; first: { glints: number; cracks: number; cap: number } }>;
  plate: Record<Species, { gap: number; units: number; top: string }[]>;
  hat: Record<Species, null | { under: number; top: number; off: number }>;
  scarf: Record<Species, { voxels: number; loose: number }[]>;
  emptyNames: Record<Species, Map<string, Set<string>>>;
  rootNames: Record<Species, Map<string, { levels: Set<number>; states: Set<string>; worst: number; cells: number; of: number; rootless: Set<number>; rider: boolean; lost: Set<string> }>>;
  riders: Record<Species, Set<string>>;
  joints: Record<Species, Set<string>>;
  hatAtRest: Record<Species, number>;
  terraceSides: Record<Species, Record<string, number>>;
  coincidentBy: Record<Species, Map<string, number>>;
  coincidentWithin: Record<Species, number>;
  distinct: Record<Species, Record<'pieces' | 'leave' | 'lost' | 'riders' | 'empty' | 'coincident', Set<string>>>;
  byLevel: Record<Species, Record<'pieces' | 'leave' | 'lost' | 'riders' | 'empty' | 'coincident', Record<string, number>>>;
};

function report(lines: string[], measured: Tally, per: Per, states: number, bench: Bench, voxel: number): void {
  const row = (label: string, cell: (sp: Species) => string, plan = '') => `  ${label.padEnd(46)}${SPECIES.map((sp) => cell(sp).padStart(26)).join('')}${plan ? `   ${plan}` : ''}`;
  const five = (o: Record<string, number>) => LEVELS.map((l) => o[String(l)]).join(' ');
  const both = (n: number, o: Record<string, number>) => `${n}  (${five(o)})`;
  const pc = (r: number) => { const v = 100 * (1 - r); return v >= 9.95 ? v.toFixed(0) : v.toFixed(1); };
  lines.push(
    '',
    `### the six animals as \`Sheep\` draws them: mounted ${count(bench.mounts)} times with a renderer that draws nothing, ${count(bench.frames)} frames of its own frame loop`,
    '  What fails today. Five numbers together are coat levels 0 1 2 3 4. "N  (a b c d e)": N failing things, each counted once, and how many of them show at each level.',
    '  The numbers handed in, which may only fall, are N where there is one, and otherwise as each row says. "plan" is what docs/visual-overhaul says it found.',
    row('', (sp) => sp),
    row('loose parts at rest', (sp) => both(measured.pieces[sp], per.byLevel[sp].pieces)),
    row('joints with a joining cell that leaves', (sp) => both(measured.roots.leave[sp], per.byLevel[sp].leave), `a joint in a state is one thing; ${states} states`),
    row('  of them, joints that come off whole', (sp) => both(measured.roots.lost[sp], per.byLevel[sp].lost), 'every joining cell out at one moment, or none to begin with'),
    row('riders left behind by the neck or head', (sp) => both(measured.riders[sp], per.byLevel[sp].riders), 'not in the plan: a collar or a mane mounted on the body'),
    row('meshes visible with no triangles', (sp) => both(measured.empty[sp], per.byLevel[sp].empty)),
    row(`draws at idle in colour (limit ${LIMIT.colour}), the most`, (sp) => `${measured.draws.colour[sp]}  (${per.draws[sp].map((d) => d.colour).join(' ')})`, `plan: 29 to 37 in all at level 2; here ${SPECIES.map((sp) => per.draws[sp][2].colour + per.draws[sp][2].shadow).join(' ')}`),
    row(`draws at idle into the shadow map (limit ${LIMIT.shadow})`, (sp) => `${measured.draws.shadow[sp]}  (${per.draws[sp].map((d) => d.shadow).join(' ')})`, `of them empty, plan: chicken 15; here ${SPECIES.map((sp) => { const d = per.draws[sp][2]; return d.empty + d.emptyShadow; }).join(' ')}`),
    row('tail at level 0', (sp) => per.tail[sp]),
    row('frozen: levels under 99% inside the ice', (sp) => String(measured.ice.outside[sp])),
    row('  % of its cells outside the ice, frozen', (sp) => per.inside[sp].map(pc).join(' ')),
    row('  the same at rest, level 2 (not judged)', (sp) => pc(per.insideRest[sp][2] ?? 1), `plan, at rest: ${SPECIES.map((sp) => PLAN.outsideAtRest[sp] ?? '-').join(' ')}`),
    row('  frozen with the hat, level 2 (not judged)', (sp) => pc(per.insideHat[sp][2] ?? 1), `at rest with the hat: ${SPECIES.map((sp) => pc(per.hatAtRest[sp])).join(' ')}`),
    row('ice cells off the slab: glints cracks cap', (sp) => `${measured.ice.loose[sp]}  (${per.iceLoose[sp].glints} ${per.iceLoose[sp].cracks} ${per.iceLoose[sp].cap})`, `plan: glints and cracks one voxel off, 94 cap cells over nothing; here ${per.iceLoose.sheep.first.cap} cap cells with nothing under them and ${per.iceLoose.sheep.cap - per.iceLoose.sheep.first.cap} lying on those; ${per.iceLoose.sheep.apart.cap} share no face with the slab`),
    row(`plate over the top: levels outside ${LIMIT.plate[0]} to ${LIMIT.plate[1]} m`, (sp) => `${measured.plate[sp]}  (${f3(per.plate[sp][2].gap)} m)`, `the top is: ${SPECIES.map((sp) => per.plate[sp][2].top).join(' ')}`),
    row('  the same in the model\'s own units', (sp) => f2(per.plate[sp][2].units), `plan, over the hat tip: ${SPECIES.map((sp) => PLAN.plateOverHat[sp] ?? '-').join(' ')}`),
    row('hat band over a voxel from the crown', (sp) => (per.hat[sp] ? `${measured.hat[sp]}  (${f3(per.hat[sp]!.off)} m)` : '0  (no hat)'), `the band's underside is ${SPECIES.map((sp) => (per.hat[sp] ? f3(per.hat[sp]!.under) : '-')).join(' ')} from it`),
    row('scarf: levels not joined (loose voxels)', (sp) => `${measured.scarf[sp]}  (${per.scarf[sp].map((s) => s.loose).join(' ')})`, `of ${per.scarf.sheep[0].voxels}; plan: none of 78 touches on the goat and the chicken`),
    row('coincident faces as it stands', (sp) => both(measured.coincident[sp], per.byLevel[sp].coincident)),
    row('  level 2, not across the head joint or an ear', (sp) => String(per.coincidentWithin[sp]), `plan: ${SPECIES.map((sp) => PLAN.coincident[sp]).join(' ')}`),
    row('terrace lines, torso as dressed', (sp) => five(measured.terraces.torso[sp]), `plan, dressed (level 2): ${SPECIES.map((sp) => PLAN.terraces[sp]).join(' ')}`),
    row('terrace lines, head', (sp) => String(measured.terraces.head[sp])),
  );
  lines.push('', '  roots: the joints whose joining cells leave their parent\'s solid grown by one voxel, in some state (the most cells out at one level, the farthest any goes)');
  for (const sp of SPECIES) {
    const list = [...per.rootNames[sp]].sort((a, b) => b[1].states.size * b[1].levels.size - a[1].states.size * a[1].levels.size || (a[0] < b[0] ? -1 : 1));
    lines.push(`    ${sp.padEnd(8)}judged: ${[...per.joints[sp]].join(', ')}${per.riders[sp].size ? `; riders: ${[...per.riders[sp]].join(', ')}` : ''}`);
    for (const [name, e] of list) {
      const levels = e.levels.size === LEVELS.length ? 'every level' : `level${e.levels.size === 1 ? '' : 's'} ${[...e.levels].sort().join(' ')}`;
      const moved = e.of ? `at the worst ${e.cells} of ${e.of} joining cells out, the farthest ${Number.isFinite(e.worst) ? f2(e.worst * voxel) : 'over 0.48'} m` : '';
      const rootless = e.rootless.size ? `no root at all at level${e.rootless.size === 1 ? '' : 's'} ${[...e.rootless].sort().join(' ')}` : '';
      const off = e.lost.size ? `comes off whole in ${new Set([...e.lost].map((k) => k.split(' ')[1])).size}` : '';
      lines.push(`            ${name.padEnd(12)}${String(e.states.size).padStart(2)} of ${states} states, ${levels}: ${[rootless, moved, off].filter(Boolean).join('; ')}${e.rider ? ' (a rider)' : ''}`);
    }
    if (!list.length) lines.push('            none leaves');
  }
  lines.push('', '  meshes that are visible with no triangles in some state (three.js draws an empty mesh like any other)');
  for (const sp of SPECIES) {
    const names = new Map<string, Set<string>>();
    for (const key of per.emptyNames[sp].keys()) { const [L, name] = key.split('\n'); let s = names.get(name); if (!s) names.set(name, (s = new Set())); s.add(L); }
    lines.push(`    ${sp.padEnd(8)}${names.size ? [...names].map(([name, ls]) => `${name}${ls.size === LEVELS.length ? '' : ` (levels ${[...ls].sort().join(' ')})`}`).join(', ') : 'none'}`);
  }
  lines.push('', '  coincident faces at level 2, by the two parts that draw them');
  for (const sp of SPECIES) lines.push(`    ${sp.padEnd(8)}${per.coincidentBy[sp].size ? [...per.coincidentBy[sp]].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([names, n]) => `${names} ${n}`).join('; ') : 'none'}`);
  lines.push('', '  terrace lines on the torso at level 2, by the side the surface is read from');
  for (const sp of SPECIES) lines.push(`    ${sp.padEnd(8)}${Object.entries(per.terraceSides[sp]).map(([side, n]) => `${side} ${n}`).join('  ')}`);
}

interface PropNeeds {
  SantaHat: SheepModule['SantaHat'];
  bombMod: typeof import('../../src/skin/voxel/bomb');
  iceProp: { laid: Laid[] } | null;
}

/** The props, each one piece (plan file 18, section 4.2 f). */
async function props(world: World, options: StageOptions, bench: Bench, measured: Tally, lines: string[], failures: Failure[], needs: PropNeeds): Promise<void> {
  const { root } = options;
  const out: string[] = [];
  const judge = (name: string, laid: Laid[], what: string) => {
    const found = laid.length ? loosePieces(laid) : { pieces: 0, voxels: 0, loose: [], main: new Set<string>() };
    measured.props[name] = (measured.props[name] ?? 0) + found.loose.length;
    const by = new Map<string, { n: number; voxels: number }>();
    for (const l of found.loose) {
      const e = by.get(l.from) ?? { n: 0, voxels: 0 };
      e.n++; e.voxels += l.voxels;
      by.set(l.from, e);
      failures.push({ scene: name, detail: 'fine', what: `${plural(l.voxels, 'voxel')} that touch the rest of ${what} nowhere`, where: `x ${f2(l.box[0])}..${f2(l.box[3])} y ${f2(l.box[1])}..${f2(l.box[4])} z ${f2(l.box[2])}..${f2(l.box[5])}`, source: `props: ${l.from}` });
    }
    return { found, by };
  };
  const asBuilt = (model: Model): Laid[] => model.parts.map((part) => ({ name: part.mount, part, box: boxes(part)! }));
  const whole: string[] = [];
  const said = (name: string, r: ReturnType<typeof judge>, note = '') => {
    if (r.found.loose.length === 0 && !note) { whole.push(name); return; }
    out.push(`    ${name.padEnd(22)}${count(r.found.voxels).padStart(7)} voxels  ${r.found.loose.length === 0 ? 'one piece' : `${plural(r.found.loose.length, 'loose piece')}: ${[...r.by].map(([from, e]) => `${from} ${e.n} (${e.voxels} vox)`).join(', ')}`}${note ? `   ${note}` : ''}`);
  };
  const wholeLine = () => { if (whole.length) out.push(`    one piece: ${whole.join(', ')}`); whole.length = 0; };

  // ---- The bomb skins, each standing at rest on its floor mark as `Bomb` draws it at size 1 with a whole fuse.
  pinned(root, 'src/skin/table/Bomb.tsx', [
    '<mesh key={i} ref={(mm) => { r.mesh = mm; }} geometry={look.ground} material={ringMats[i]} visible={false} renderOrder={1} />',
    '<group ref={group} scale={1.5}>',
    '<mesh geometry={look.body} material={body} castShadow />',
    '{look.glow && glowMat && <mesh geometry={look.glow} material={glowMat} />}',
    '<group ref={fuse} position={[0, BOMB_NECK_Y, 0]}>',
    '<mesh geometry={look.fuse} material={fuseMat} />',
    '<mesh ref={spark} geometry={look.spark} material={sparkMat} />',
    'const scale = 1.5 * gr.cur * (1 + gr.pop * 0.5);',
    'const r = BOMB_RADIUS * scale;',
    'const rest = new Vector3(rx, r, rz);',
    'g.scale.set(scale * sx, scale * sy, scale * sx);',
    'if (fuse.current) fuse.current.scale.y = Math.max(0.02, Math.min(1, fraction));',
    'spark.current.position.y = BOMB_FUSE_LENGTH * Math.max(0.02, Math.min(1, fraction));',
    'Object.assign(ring, { x: rest.x, z: rest.z, size: 1.1 * (rest.y / BOMB_RADIUS / 1.5), at: s.landedAt, leftAt: -99 });',
    'ring.mesh.position.set(ring.x, 0.006 + i * 0.002, ring.z);',
    'ring.mesh.scale.setScalar(ring.size * (0.3 + 0.7 * (1 - (1 - grow) ** 3)));',
  ]);
  const { BOMB_NECK_Y, BOMB_FUSE_LENGTH, BOMB_RADIUS } = needs.bombMod;
  out.push('', '  bomb skins, each at rest on its floor mark as `Bomb` sets it down (size 1, a whole fuse)');
  for (const model of world.models.filter((m) => m.kind === 'bomb')) {
    const scale = 1.5, r = BOMB_RADIUS * scale;
    const inGroup = (lift: number) => new Matrix4().makeTranslation(0, r, 0).multiply(new Matrix4().makeScale(scale, scale, scale)).multiply(new Matrix4().makeTranslation(0, lift, 0));
    const where: Record<string, Matrix4 | null> = {
      body: inGroup(0), glow: inGroup(0), fuse: inGroup(BOMB_NECK_Y), spark: inGroup(BOMB_NECK_Y + BOMB_FUSE_LENGTH),
      ground: new Matrix4().makeTranslation(0, 0.006, 0).multiply(new Matrix4().makeScale(1.1, 1.1, 1.1)), chunk: null,
    };
    const laid: Laid[] = [];
    for (const part of model.parts) {
      const m = where[part.mount];
      if (m === undefined) throw new NotRun(`${model.id}: its builder handed back "${part.mount}", which this stage does not know where \`Bomb\` draws`);
      if (m) laid.push({ name: part.mount, part, box: laidBoxes([part], m)[0] });
    }
    const standing = judge(model.id, laid, 'the bomb and its mark');
    // The piece of shell that flies out in the burst is a prop of its own.
    const chunk = judge(model.id, model.parts.filter((p) => p.mount === 'chunk').map((part) => ({ name: 'chunk', part, box: boxes(part)! })), 'the shell chunk');
    said(model.id, standing, chunk.found.loose.length ? `its chunk is in ${chunk.found.pieces} pieces` : '');
  }
  wholeLine();

  out.push('', '  burst props, fuse sounds, sacks, as their builders hand them back');
  const none: string[] = [];
  for (const model of world.models.filter((m) => m.kind === 'burst' || m.kind === 'tick' || m.kind === 'sack')) {
    const r = judge(model.id, asBuilt(model), 'the model');
    if (model.parts.length === 0) { none.push(model.id); continue; }
    said(model.id, r);
  }
  wholeLine();
  if (none.length) out.push(`    no prop to judge (the burst is light alone): ${none.join(', ')}`);

  out.push('', '  the sheepdog, the trophy, the hat, the ice');
  // The sheepdog wears the hat on its head, as `Sheepdog` in table/places.tsx mounts it.
  // (Its head and hat are one geometry, `withHat` in table/Sheep.tsx, with the hat where `SantaHat` puts it.)
  pinned(root, 'src/skin/table/places.tsx', ['<mesh ref={head} geometry={withHat(m.head.geo)} position={m.head.pivot} material={mat} castShadow />']);
  const dog = world.model('sheepdog'), hat = world.model('hat');
  const dogBuilt = dog.built as import('../../src/skin/voxel/characters').SheepdogModel;
  const holder = await bench.show(createElement('group', { position: dogBuilt.head.pivot }, createElement(needs.SantaHat, { parts: [dogBuilt.head.geo], material: new THREE.MeshBasicMaterial() })));
  let hatMesh: Drawable | null = null;
  holder.traverse((o) => { if (drawable(o)) hatMesh = o; });
  if (!hatMesh) throw new NotRun('`SantaHat` mounted no mesh for the sheepdog');
  const worn = hatMesh as Drawable;
  const hatAt = new Matrix4().makeTranslation(dogBuilt.head.pivot[0] + worn.position.x, dogBuilt.head.pivot[1] + worn.position.y, dogBuilt.head.pivot[2] + worn.position.z).multiply(new Matrix4().makeScale(worn.scale.x, worn.scale.y, worn.scale.z));
  said('sheepdog', judge('sheepdog', [...asBuilt(dog), ...hat.parts.map((part) => ({ name: 'hat', part, box: laidBoxes([part], hatAt)[0] }))], 'the sheepdog'), 'with its hat on');
  said('trophy', judge('trophy', asBuilt(world.model('trophy')), 'the trophy'));
  said('hat', judge('hat', asBuilt(hat), 'the hat'));
  if (!needs.iceProp) throw new NotRun('no ice block was mounted');
  const block = judge('ice', needs.iceProp.laid, 'the ice block');
  const ice = world.model('ice');
  const shards = ice.parts.filter((p) => p.mount.startsWith('shards')).map((part) => judge('ice', [{ name: part.mount, part, box: boxes(part)! }], 'the shard'));
  said('ice', block, `the block as \`Sheep\` mounts it; its ${shards.length} thaw shards: ${shards.map((s) => (s.found.loose.length ? `${s.found.pieces} pieces` : 'one piece')).join(', ')}`);
  wholeLine();

  const total = Object.values(measured.props).reduce((a, b) => a + b, 0);
  lines.push('', `### props, each alone: ${plural(total, 'loose piece')} in ${Object.keys(measured.props).length} props`, ...out);
}
