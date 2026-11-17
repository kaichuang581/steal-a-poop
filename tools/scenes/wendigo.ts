/**
 * The wendigo's stage of the scene checker (plan file 04, section 4.1, steps 4 to 6 and its "Check" line; file 16,
 * section 5, item 2). The wendigo is settled as not touched: its model, where it stands, the camera that catches it,
 * the pines round it. Its own files are held byte for byte by src/skin/scene/__tests__/wendigoFence.test.ts. This
 * stage holds the voxels: what stands round it, what the paddock camera sees round it, and how much of it shows
 * between the trunks.
 *
 * Four things are measured on Home's farm, at each detail level, and each must equal what is written in
 * tools/scenes/wendigo.pins.json. Any difference fails the stage, whichever way the number moved.
 *
 *   countryside   Every voxel src/skin/scene/countryside.ts builds: how many, and their hash. (Every builder there
 *                 asks `isClear` while drawing from shared random streams, so one changed answer re-plants the land.)
 *   the stand     Every voxel whose middle is within 12 m of WENDIGO_AT, measured along the ground: the
 *                 countryside's alone (the plan's 80,760) and those of every kind (the back hills it stands on too).
 *   the cone      Every voxel of the farm any part of which the paddock camera sees within 8% of the frame of the
 *                 wendigo's box, at 1280 x 800, when the camera is 0, 0.5 and 1 of the way along its push: the three
 *                 together. Counted for every kind of voxel and hashed, and counted again for the plan's six sets
 *                 (barn, yard, season, farmstead, countryside, the farm's season) to set beside the plan's figure.
 *   the rays      From the camera at those three places to 153 points on the wendigo's box (9 across by 17 up),
 *                 each walked from 0.3 m in steps of 0.05 m: a step inside a voxel blocks the ray. How many are clear.
 *
 * The wendigo's box is where it stands and how tall it is, never its model (which is not voxels, and is not this
 * tool's to open): an upright rectangle through WENDIGO_AT that faces the camera, 0.8 m to either side, from 0.05 m
 * under `groundAt` (where src/skin/table/Wendigo.tsx puts its feet) up 3.4 m (its HEIGHT there, read from that
 * file's text).
 *
 * A hash is over voxels, never bytes: each voxel is its corner and its size in tenths of a millimetre and its colour
 * in 16 bits a channel, the voxels are sorted, and the sorted list is hashed (SHA-256). So a vertex repack, dropped
 * or merged faces, another chunking or a sliced build do not count as touching; a voxel moved, added, taken away or
 * recoloured does.
 *
 * Nothing here can be excused: an entry of EXEMPT.json that names this stage fails it. Re-pinning (writing new
 * numbers into wendigo.pins.json) is a change to the wendigo's zone and needs Brian's dated words; each run writes
 * what it measured to the gate's cache (scenes/wendigo/measured.json), in the pins file's own shape, to compare.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Vector3 } from 'three';
import { boxes } from './build';
import type { Detail, Part, Scene, SceneName, StageOptions, StageResult, World } from './build';
import { bodiesOf, eyeOf, Near, project } from './lens';
import type { Body, Eye } from './lens';

export const id = 'wendigo';
export const needs = { scenes: ['farm'] as SceneName[], models: false };

/** How far round the wendigo the stand reaches, along the ground, in metres. */
const STAND = 12;
/** The picture the cone is measured in, and how far outside the wendigo's box it reaches, as a share of the frame. */
const FRAME: [number, number] = [1280, 800];
const MARGIN = 0.08;
/** The camera's places along its push. */
const TRAVEL = [0, 0.5, 1] as const;
/** The wendigo's box: half its width in metres (the plan's), and the grid of points the rays go to. */
const HALF_WIDTH = 0.8;
const GRID = { across: 9, up: 17 };
/** The rays: where each starts and how long its steps are, in metres. */
const RAY = { from: 0.3, step: 0.05 };
/** The plan's own figures for today (file 04, section 4.1; file 16, section 5), to print beside what is measured. */
const PLAN = { countryside: 487_002, stand: 80_760, cone: 75_400, coneAtStart: 75_438, rays: [134, 136, 137] };
/** The sets the plan's cone figure counts, by the first word of a part's mount; every other kind is counted too. */
const PLAN_SETS = ['barn', 'yard', 'festive', 'farmstead', 'countryside', 'farmFestive'];

const PINS_FILE = 'tools/scenes/wendigo.pins.json';

type Vec = [number, number, number];
const count = (n: number) => n.toLocaleString('en-US');
const family = (mount: string) => mount.split(/[.[ ]/)[0];

// ---------------------------------------------------------------------------------------------------------------------
// Hashing voxels
// ---------------------------------------------------------------------------------------------------------------------

/** A growing list of voxels as whole numbers, seven each: x, y, z, size (tenths of a millimetre), red, green, blue (16 bits). */
class Voxels {
  private data = new Int32Array(7 * 4096);
  count = 0;
  /** Adds voxel `i` of a part whose boxes (in the world's metres) are `B`. */
  add(part: Part, B: Float64Array, i: number): void {
    if ((this.count + 1) * 7 > this.data.length) { const more = new Int32Array(this.data.length * 2); more.set(this.data); this.data = more; }
    const at = this.count++ * 7, b = i * 6;
    this.data[at] = Math.round(B[b] * 1e4);
    this.data[at + 1] = Math.round(B[b + 1] * 1e4);
    this.data[at + 2] = Math.round(B[b + 2] * 1e4);
    this.data[at + 3] = Math.round((B[b + 3] - B[b]) * 1e4);
    for (let k = 0; k < 3; k++) this.data[at + 4 + k] = Math.round(Math.min(1, Math.max(0, part.colors[i * 3 + k])) * 65535);
  }
  /** SHA-256 of the voxels in one fixed order (by x, y, z, size, colour), whatever order they came in. */
  hash(): string {
    const d = this.data, order = Array.from({ length: this.count }, (_, k) => k * 7);
    order.sort((a, b) => {
      for (let k = 0; k < 7; k++) { const diff = d[a + k] - d[b + k]; if (diff) return diff; }
      return 0;
    });
    // Written out low byte first, so the hash is the same on any machine.
    const out = Buffer.alloc(this.count * 28);
    order.forEach((at, n) => { for (let k = 0; k < 7; k++) out.writeInt32LE(d[at + k], n * 28 + k * 4); });
    return createHash('sha256').update(out).digest('hex');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------------------------------------------------

interface Shot { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number; push: readonly [number, number, number] }
interface Stands { at: [number, number]; ground: number; sunk: number; height: number }

interface Measured {
  countryside: { voxels: number; hash: string };
  stand: { voxels: number; hash: string };
  standOfEveryKind: { voxels: number; hash: string };
  cone: { voxels: number; hash: string; ofThePlansSixSets: number };
  rays: { clear: number[]; of: number };
}
/** What is printed and not pinned: the cone's count at each place and by kind, and what blocks the rays. */
interface Detailed { coneAt: number[]; coneBy: Record<string, number>; blockers: Record<string, number>[]; box: number[][] }

/** Every part of every body with its voxels' boxes, in its body's own frame (the world's metres for the world). */
function laidOut(bodies: Body[]): { part: Part; body: Body; B: Float64Array }[] {
  const out: { part: Part; body: Body; B: Float64Array }[] = [];
  for (const body of bodies) for (const part of body.parts) { const B = boxes(part); if (B) out.push({ part, body, B }); }
  return out;
}

/** Where a point lands in an unslid picture, without making anything: x and y across the frame (-1 to 1) and the depth, left in `seen`. */
const seen = { x: 0, y: 0, z: 0 };
function look(eye: Eye, x: number, y: number, z: number): void {
  const dx = x - eye.p[0], dy = y - eye.p[1], dz = z - eye.p[2];
  const depth = dx * eye.f[0] + dy * eye.f[1] + dz * eye.f[2];
  seen.z = depth;
  seen.x = (dx * eye.r[0] + dy * eye.r[1] + dz * eye.r[2]) / (depth * eye.right);
  seen.y = (dx * eye.u[0] + dy * eye.u[1] + dz * eye.u[2]) / (depth * eye.top);
}

/** The wendigo's box as seen from one place of the camera: its four corners, and the way across it. */
function boxFrom(stands: Stands, eye: Eye): { corners: Vec[]; across: [number, number]; foot: number } {
  const dx = eye.p[0] - stands.at[0], dz = eye.p[2] - stands.at[1], length = Math.hypot(dx, dz);
  const across: [number, number] = [dz / length, -dx / length];
  const foot = stands.ground - stands.sunk;
  const corners: Vec[] = [];
  for (const s of [-HALF_WIDTH, HALF_WIDTH]) for (const y of [foot, foot + stands.height]) corners.push([stands.at[0] + across[0] * s, y, stands.at[1] + across[1] * s]);
  return { corners, across, foot };
}

function measure(scene: Scene, shot: Shot, stands: Stands): { measured: Measured; detailed: Detailed; unjudged: string[] } {
  const { bodies, unjudged } = bodiesOf(scene);
  const laid = laidOut(bodies);
  const [wx, wz] = stands.at;
  const corner = new Vector3();
  /** The middle of voxel `i`, in the world's metres, left in `corner` (a thing's voxels are carried there by its matrix). */
  const middle = (body: Body, B: Float64Array, b: number) => {
    corner.set((B[b] + B[b + 3]) / 2, (B[b + 1] + B[b + 4]) / 2, (B[b + 2] + B[b + 5]) / 2);
    if (body.out) corner.applyMatrix4(body.out);
  };

  // The countryside, and the stand. A thing a mesh sets down is not in the stand's hash: none stands there today, and
  // one that came to would be named.
  const countryside = new Voxels(), stand = new Voxels(), standAll = new Voxels();
  for (const { part, body, B } of laid) {
    const own = part.mount.startsWith('countryside.');
    let thingInside = false;
    for (let i = 0; i < part.count; i++) {
      if (own) countryside.add(part, B, i);
      middle(body, B, i * 6);
      const dx = corner.x - wx, dz = corner.z - wz;
      if (dx * dx + dz * dz >= STAND * STAND) continue;
      if (body.out) { thingInside = true; continue; }
      standAll.add(part, B, i);
      if (own) stand.add(part, B, i);
    }
    if (thingInside) unjudged.push(`"${body.name}" (${part.mount}) is set down by a mesh inside the stand: its voxels are not in the stand's hash`);
  }

  // The cone: the three places of the camera together.
  const eyes = TRAVEL.map((t) => eyeOf({ position: [shot.position[0] + shot.push[0] * t, shot.position[1] + shot.push[1] * t, shot.position[2] + shot.push[2] * t], target: shot.target, fov: shot.fov, aspect: FRAME[0] / FRAME[1] }));
  const windows = eyes.map((eye) => {
    const at = boxFrom(stands, eye).corners.map((c) => project(eye, c));
    return [Math.min(...at.map((v) => v[0])) - MARGIN * 2, Math.max(...at.map((v) => v[0])) + MARGIN * 2, Math.min(...at.map((v) => v[1])) - MARGIN * 2, Math.max(...at.map((v) => v[1])) + MARGIN * 2];
  });
  const cone = new Voxels(), coneAt = TRAVEL.map(() => 0), coneBy: Record<string, number> = {};
  let six = 0;
  for (const { part, body, B } of laid) {
    const kind = body.out ? `${family(part.mount)} (set down by a mesh)` : family(part.mount);
    const reach = part.size * part.scale * body.scale * 0.8661; // from a voxel's middle to its corner
    let counted = 0;
    for (let i = 0; i < part.count; i++) {
      const b = i * 6;
      let any = false;
      for (let e = 0; e < eyes.length; e++) {
        const eye = eyes[e], w = windows[e];
        middle(body, B, b);
        look(eye, corner.x, corner.y, corner.z);
        if (seen.z <= 0.1) continue; // behind the camera
        // Far outside the window: no corner of it can reach in. (Its corners are within `reach` of its middle.)
        const near = seen.z - reach;
        if (near > 0.1) {
          const mx = reach / (near * eye.right), my = reach / (near * eye.top);
          if (seen.x + mx < w[0] || seen.x - mx > w[1] || seen.y + my < w[2] || seen.y - my > w[3]) continue;
        }
        // The frame-box round the voxel's eight corners, each in front of the camera.
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          corner.set(B[b + (k & 1 ? 3 : 0)], B[b + 1 + (k & 2 ? 3 : 0)], B[b + 2 + (k & 4 ? 3 : 0)]);
          if (body.out) corner.applyMatrix4(body.out);
          look(eye, corner.x, corner.y, corner.z);
          if (seen.z <= 0.1) continue;
          if (seen.x < x0) x0 = seen.x; if (seen.x > x1) x1 = seen.x; if (seen.y < y0) y0 = seen.y; if (seen.y > y1) y1 = seen.y;
        }
        if (x1 < w[0] || x0 > w[1] || y1 < w[2] || y0 > w[3]) continue;
        coneAt[e]++;
        any = true;
      }
      if (!any) continue;
      counted++;
      if (body.out) continue; // a thing's voxels are counted and named, never hashed
      cone.add(part, B, i);
      if (PLAN_SETS.includes(family(part.mount))) six++;
    }
    if (counted) coneBy[kind] = (coneBy[kind] ?? 0) + counted;
    if (counted && body.out) unjudged.push(`"${body.name}" (${part.mount}) is set down by a mesh inside the cone: ${count(counted)} of its voxels are counted and not in the cone's hash`);
  }

  // The rays. Every body is asked whether it holds each step, in its own frame.
  const lo: Vec = [Infinity, Infinity, Infinity], hi: Vec = [-Infinity, -Infinity, -Infinity];
  const grids = eyes.map((eye) => {
    const { across, foot } = boxFrom(stands, eye), points: Vec[] = [];
    for (let i = 0; i < GRID.across; i++) for (let j = 0; j < GRID.up; j++) {
      const s = -HALF_WIDTH + (i * 2 * HALF_WIDTH) / (GRID.across - 1);
      points.push([wx + across[0] * s, foot + (j * stands.height) / (GRID.up - 1), wz + across[1] * s]);
    }
    for (const p of [eye.p, ...points]) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
    return points;
  });
  const solids = bodies.map((body) => {
    // The corridor's box in this body's frame: the box round its eight corners carried there.
    const l: Vec = [Infinity, Infinity, Infinity], h: Vec = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 8; k++) {
      corner.set(k & 1 ? hi[0] + 0.5 : lo[0] - 0.5, k & 2 ? hi[1] + 0.5 : lo[1] - 0.5, k & 4 ? hi[2] + 0.5 : lo[2] - 0.5);
      if (body.into) corner.applyMatrix4(body.into);
      l[0] = Math.min(l[0], corner.x); l[1] = Math.min(l[1], corner.y); l[2] = Math.min(l[2], corner.z);
      h[0] = Math.max(h[0], corner.x); h[1] = Math.max(h[1], corner.y); h[2] = Math.max(h[2], corner.z);
    }
    return { body, near: new Near(body.parts, l, h) };
  }).filter((s) => s.near.owner.length);
  const clear: number[] = [], blockers: Record<string, number>[] = [];
  eyes.forEach((eye, e) => {
    let open = 0;
    const by: Record<string, number> = {};
    for (const p of grids[e]) {
      const d: Vec = [p[0] - eye.p[0], p[1] - eye.p[1], p[2] - eye.p[2]], length = Math.hypot(d[0], d[1], d[2]);
      let blockedBy: string | null = null;
      for (let n = 0; blockedBy === null; n++) {
        const t = RAY.from + n * RAY.step;
        if (t > length) break;
        const x = eye.p[0] + (d[0] / length) * t, y = eye.p[1] + (d[1] / length) * t, z = eye.p[2] + (d[2] / length) * t;
        for (const s of solids) {
          corner.set(x, y, z);
          if (s.body.into) corner.applyMatrix4(s.body.into);
          const box = s.near.holds(corner.x, corner.y, corner.z);
          if (box >= 0) { blockedBy = family(s.near.parts[s.near.owner[box]].mount) + '.' + (s.near.parts[s.near.owner[box]].mount.split(/[.[ ]/)[1] ?? ''); break; }
        }
      }
      if (blockedBy === null) open++; else by[blockedBy] = (by[blockedBy] ?? 0) + 1;
    }
    clear.push(open);
    blockers.push(by);
  });

  return {
    measured: {
      countryside: { voxels: countryside.count, hash: countryside.hash() },
      stand: { voxels: stand.count, hash: stand.hash() },
      standOfEveryKind: { voxels: standAll.count, hash: standAll.hash() },
      cone: { voxels: cone.count, hash: cone.hash(), ofThePlansSixSets: six },
      rays: { clear, of: GRID.across * GRID.up },
    },
    detailed: { coneAt, coneBy, blockers, box: windows.map((w) => [((w[0] + MARGIN * 2 + 1) / 2) * FRAME[0], ((w[1] - MARGIN * 2 + 1) / 2) * FRAME[0], ((1 - (w[3] - MARGIN * 2)) / 2) * FRAME[1], ((1 - (w[2] + MARGIN * 2)) / 2) * FRAME[1]].map((v) => Math.round(v))) },
    unjudged,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The pins
// ---------------------------------------------------------------------------------------------------------------------

interface Setup {
  camera: { position: number[]; target: number[]; fov: number; push: number[]; frame: number[]; travel: number[] };
  wendigo: { at: number[]; ground: number; sunk: number; height: number; halfWidth: number };
  measure: { standMetres: number; coneMargin: number; grid: number[]; rayFrom: number; rayStep: number };
}
interface Pins extends Setup { about?: string[]; fine?: Measured; coarse?: Measured }

/** Every leaf of a tree as "a.b.c" and its value, so two trees can be compared leaf by leaf. */
function leaves(tree: unknown, path = '', out = new Map<string, string>()): Map<string, string> {
  if (tree !== null && typeof tree === 'object' && !Array.isArray(tree)) for (const [k, v] of Object.entries(tree)) leaves(v, path ? `${path}.${k}` : k, out);
  else out.set(path, JSON.stringify(tree));
  return out;
}

/** Where two trees differ: a leaf with another value, a leaf only one of them has. */
function differences(pinned: unknown, now: unknown, under: string): string[] {
  if (pinned === undefined) return [...leaves(now, under)].map(([key, value]) => `${key}: not pinned (measured ${value})`);
  const a = leaves(pinned, under), b = leaves(now, under), out: string[] = [];
  for (const [key, value] of b) {
    if (!a.has(key)) out.push(`${key}: not pinned (measured ${value})`);
    else if (a.get(key) !== value) out.push(`${key}: pinned ${a.get(key)}, measured ${value}`);
  }
  for (const key of a.keys()) if (!b.has(key)) out.push(`${key}: pinned ${a.get(key)}, and no longer measured`);
  return out;
}

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const lines: string[] = [];
  const fail = (summary: string, more: string[] = []): StageResult => ({ ok: false, summary, lines: [...lines, ...more], measured: {}, failures: [], data: null });
  if (options.exempt.length) return fail('an entry of EXEMPT.json names the wendigo stage: nothing about the wendigo can be excused', options.exempt.map((e) => `  EXEMPT.json: ${e.scene}, match ${e.match}`));
  if (!options.scenes.includes('farm')) {
    return { ok: true, summary: 'nothing judged in this run: the wendigo stands on Home\'s farm, and --scene left the farm out', lines: ['  The wendigo stage reads the farm. This run was told to judge other scenes only.'], measured: {}, failures: [], data: null };
  }

  // Where it stands and what catches it, from the game's own files.
  const countryside = await world.load<typeof import('../../src/skin/scene/countryside')>('src/skin/scene/countryside.ts');
  const homePov = await world.load<typeof import('../../src/skin/scene/homePov')>('src/skin/scene/homePov.ts');
  const shot = homePov.POV_SHOTS.desktop[2];
  let source = '';
  try { source = readFileSync(resolve(options.root, 'src/skin/table/Wendigo.tsx'), 'utf8').replace(/\s+/g, ' '); } catch { /* said below */ }
  const height = /const HEIGHT = ([\d.]+);/.exec(source);
  const sunk = /<group ref=\{root\} position=\{\[WENDIGO_AT\[0\], ground - ([\d.]+), WENDIGO_AT\[1\]\]\}/.exec(source);
  if (!height || !sunk || !source.includes('const ground = groundAt(WENDIGO_AT[0], WENDIGO_AT[1]);')) {
    return fail('NOT RUN: cannot read how tall the wendigo is and where its feet go from src/skin/table/Wendigo.tsx', ['  tools/scenes/wendigo.ts reads `const HEIGHT`, `const ground = groundAt(...)` and the group\'s `ground - 0.05` from that file\'s text, and one of them is not there.']);
  }
  const stands: Stands = { at: [countryside.WENDIGO_AT[0], countryside.WENDIGO_AT[1]], ground: countryside.groundAt(countryside.WENDIGO_AT[0], countryside.WENDIGO_AT[1]), sunk: +sunk[1], height: +height[1] };
  const setup: Setup = {
    camera: { position: [...shot.position], target: [...shot.target], fov: shot.fov, push: [...shot.push], frame: FRAME, travel: [...TRAVEL] },
    wendigo: { at: stands.at, ground: stands.ground, sunk: stands.sunk, height: stands.height, halfWidth: HALF_WIDTH },
    measure: { standMetres: STAND, coneMargin: MARGIN, grid: [GRID.across, GRID.up], rayFrom: RAY.from, rayStep: RAY.step },
  };

  const details = world.details.filter((d) => options.details.includes(d));
  const now: Partial<Record<Detail, Measured>> = {}, more: Partial<Record<Detail, Detailed>> = {}, notes: string[] = [];
  for (const detail of details) {
    const t0 = performance.now();
    const got = measure(world.scene('farm', detail), shot, stands);
    now[detail] = got.measured;
    more[detail] = got.detailed;
    for (const n of got.unjudged) notes.push(`${detail}: ${n}`);
    options.log(`farm (${detail}): measured in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }

  // What this run measured, in the pins file's own shape, for a person to compare. Never into the repo.
  const measuredFile = join(options.cache, 'measured.json');
  try { writeFileSync(measuredFile, `${JSON.stringify({ ...setup, ...now }, null, 2)}\n`); } catch { /* the cache is a convenience */ }

  // The pins.
  const file = resolve(options.root, PINS_FILE);
  let pins: Pins | null = null, pinsProblem = '';
  if (!existsSync(file)) pinsProblem = `${PINS_FILE} does not exist`;
  else try { pins = JSON.parse(readFileSync(file, 'utf8')) as Pins; } catch (e) { pinsProblem = `${PINS_FILE} is not JSON: ${String((e as Error).message)}`; }

  const diffs: string[] = [];
  if (pins) {
    for (const key of ['camera', 'wendigo', 'measure'] as const) diffs.push(...differences(pins[key], setup[key], key));
    for (const detail of details) diffs.push(...differences(pins[detail], now[detail], detail));
  }

  const beside = (plan: number, got: number) => (plan === got ? `the plan's ${count(plan)} too` : `THE PLAN SAYS ${count(plan)}`);
  for (const detail of details) {
    const m = now[detail]!, d = more[detail]!, p = pins?.[detail];
    const same = (a: unknown, b: unknown) => (p === undefined ? 'NOT PINNED' : JSON.stringify(a) === JSON.stringify(b) ? 'as pinned' : `PINNED ${JSON.stringify(a)}`);
    lines.push('', `### farm (${detail})`);
    lines.push(`  countryside   ${count(m.countryside.voxels).padStart(9)} voxels   ${same(p?.countryside, m.countryside)}   (${detail === 'fine' ? beside(PLAN.countryside, m.countryside.voxels) : `the plan's ${count(PLAN.countryside)} is the fine level's`})   hash ${m.countryside.hash.slice(0, 16)}`);
    lines.push(`  the stand     ${count(m.stand.voxels).padStart(9)} countryside voxels within ${STAND} m   ${same(p?.stand, m.stand)}   (${detail === 'fine' ? beside(PLAN.stand, m.stand.voxels) : `the plan's ${count(PLAN.stand)} is the fine level's`})   hash ${m.stand.hash.slice(0, 16)}`);
    lines.push(`                ${count(m.standOfEveryKind.voxels).padStart(9)} voxels of every kind within ${STAND} m   ${same(p?.standOfEveryKind, m.standOfEveryKind)}   hash ${m.standOfEveryKind.hash.slice(0, 16)}`);
    lines.push(`  the cone      ${count(m.cone.voxels).padStart(9)} voxels of every kind   ${same(p?.cone, m.cone)}   hash ${m.cone.hash.slice(0, 16)}`);
    lines.push(`                ${count(m.cone.ofThePlansSixSets).padStart(9)} of them in the plan's six sets   (the plan: about ${count(PLAN.cone)}, and ${count(PLAN.coneAtStart)} at the start of the push)`);
    lines.push(`                at ${TRAVEL.map((t, i) => `${t} of the push ${count(d.coneAt[i])}`).join(', ')}; by kind: ${Object.entries(d.coneBy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${count(n)}`).join(', ')}`);
    lines.push(`                the wendigo's box in the ${FRAME[0]} x ${FRAME[1]} picture: ${TRAVEL.map((t, i) => `at ${t}, x ${d.box[i][0]} to ${d.box[i][1]}, y ${d.box[i][2]} to ${d.box[i][3]}`).join('; ')}`);
    lines.push(`  the rays      ${m.rays.clear.join(', ')} clear of ${m.rays.of} at ${TRAVEL.join(', ')} of the push   ${same(p?.rays, m.rays)}   (${JSON.stringify(m.rays.clear) === JSON.stringify(PLAN.rays) ? `the plan's ${PLAN.rays.join(', ')} too` : `THE PLAN SAYS ${PLAN.rays.join(', ')}`})`);
    lines.push(`                blocked by: ${d.blockers.map((by, i) => `at ${TRAVEL[i]}, ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' and ') || 'nothing'}`).join('; ')}`);
  }
  lines.push('', `Where it stands: WENDIGO_AT (${stands.at.join(', ')}), the ground there ${stands.ground} m, its feet ${stands.sunk} m under that, ${stands.height} m tall. The paddock camera: (${shot.position.join(', ')}) looking at (${shot.target.join(', ')}), a ${shot.fov} degree lens, pushed (${shot.push.join(', ')}).`);
  for (const n of [...new Set(notes)]) lines.push(`Not in a hash: ${n}`);
  lines.push(`What this run measured is in the gate's cache as scenes/wendigo/measured.json, in the shape of ${PINS_FILE}.`);

  const data = { setup, measured: now, detailed: more, pinned: pins ? Object.fromEntries(details.map((d) => [d, pins![d] ?? null])) : null, differences: diffs };
  if (pinsProblem) return { ok: false, summary: `NOT RUN: ${pinsProblem}: there is nothing to hold the wendigo's voxels to`, lines, measured: {}, failures: [], data };
  if (diffs.length) {
    lines.push('', `${diffs.length === 1 ? 'One number is' : `${diffs.length} numbers are`} not what ${PINS_FILE} holds:`, ...diffs.map((d) => `    ${d}`));
    lines.push('  The wendigo zone is frozen (CLAUDE.md, "The visual overhaul", Wendigo zone; plan file 04, section 4.1). Put the', '  scenery back as it was. If it truly has to change, stop and ask Brian first: the pins change only with his dated words.');
  } else lines.push('', 'Every number is what the pins hold.');
  return {
    ok: diffs.length === 0,
    summary: diffs.length
      ? `the wendigo's voxels are not what ${PINS_FILE} holds: ${diffs.slice(0, 3).join('; ')}${diffs.length > 3 ? `; and ${diffs.length - 3} more` : ''}`
      : `as pinned over ${details.join(' and ')}: countryside ${details.map((d) => count(now[d]!.countryside.voxels)).join(' / ')} voxels, the stand ${details.map((d) => count(now[d]!.stand.voxels)).join(' / ')}, the cone ${details.map((d) => count(now[d]!.cone.voxels)).join(' / ')}, rays ${details.map((d) => now[d]!.rays.clear.join(', ')).join(' / ')} clear of ${GRID.across * GRID.up}`,
    lines,
    measured: { differences: diffs.length },
    failures: diffs.map((d) => ({ scene: 'farm', detail: (d.startsWith('coarse') ? 'coarse' : d.startsWith('fine') ? 'fine' : 'both') as Detail | 'both', what: `not what the pins hold: ${d}`, where: `WENDIGO_AT (${stands.at.join(', ')})`, source: PINS_FILE })),
    data,
  };
}
