/**
 * Stage 5 of the scene checker: lens (plan file 18, section 4.2 d; file 04, section 4.3). Nothing presses against the
 * lens.
 *
 * On every camera path of the painted game, no voxel may lie inside the view within 1.0 m of the lens, and the lens
 * may never be inside a voxel. "Inside the view" is the plan's own word (file 00, known points): a post that stands
 * 0.30 m behind the camera is not in the picture and is not judged; how near it is all the same is printed beside
 * each shot, because the plan's own table (file 04) gave that distance.
 *
 * The paths. Each shot is read from the game's own file, through the world, where the game exports it:
 *
 *   farm     POV_SHOTS (src/skin/scene/homePov.ts), eight computer shots and six phone shots: every place the camera
 *            reaches over its push, alone and with the drift (0.25 m by 0.12 m, sixteen places round it).
 *   table    speakerShot (src/skin/scene/layout.ts) for tables of 2 to 10 and every seat, with the camera's 0.05 m
 *            breath and aimed at the lowest, the sheep's and the tallest head; homeShot; and the swing between every
 *            two shots of one table.
 *   duel     duelShot (src/skin/scene/duel.ts): the opening shot, your turn at every pressure, the bot's turn, the
 *            moves between them, and the shake of the last moments.
 *   pen      penShot (src/skin/scene/pen.ts), with the slide the room gives the picture.
 *   podium   the rig in src/skin/table/Podium.tsx, from the middle to where it rests beside the scoreboard.
 *   dream    the side view, dreamView (src/skin/dream/stage.ts): an orthographic camera looking along -z. A computer
 *            and a phone on its side at the fine level, a phone upright at the coarse one (which is the build the game
 *            makes for it), each with the 0.03 m shake.
 *   bedroom  the bubble's shot and its way down to the results shot (src/skin/dream/BedroomBubble.tsx).
 *
 * How a camera moves along a path, and the podium's and the bedroom's shots themselves, are written in components,
 * which cannot be imported: the lines this file copies are pinned (`PINS`), and one that is gone or changed stops the
 * stage as NOT RUN. A computer's picture is taken as 16:9 and a phone's as 390 x 844, the plan's two sizes; a wider
 * window sees more to the sides.
 *
 * Every scene is judged at both detail levels and with both devices' cameras, because the two are separate in the game
 * (detail follows the pointer, the camera follows the window's width).
 *
 * What is handed in, and may only fall:
 *   short.<scene>.<detail>.<device>.<shot>    millimetres short of 1.0 m at the worst place on that path (0: clear).
 *                                             For the table, one number for each size of table: the sum over its
 *                                             seats.
 *   swings.table.<detail>.<device>.<size>     how many of that table's swings (from one shot to another) come within
 *                                             1.0 m of something in view, or pass through a voxel.
 *   inside.<scene>.<detail>                   paths on which the lens is inside a voxel somewhere.
 *   excused.<scene>.<detail>                  paths an entry of EXEMPT.json excuses (it matches the path's name or the
 *                                             code that built the nearest voxel).
 *
 * In, on and behind: a lens is inside a voxel when the solid is all round it (eight points a tenth of a millimetre
 * off it are all in voxels of one body). A lens that only touches a face is judged like any other: the voxel counts
 * if the camera looks into it and not if it is behind. A part the game draws from one side only (the barn's front
 * wall, `ONE_SIDED`) is seen from that side only and is never something to be inside of.
 *
 * Not judged, and said in the report: animals, the bomb and anything else that is a model and not scenery (the
 * harness lays out scenery); things that move are judged where they rest, except the dream, whose scenery scrolls
 * sideways: there the least distance with the sideways axis left out is printed too.
 *
 *   npm run check:scenes -- --only lens --show=computer     every place of the paths whose name matches
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Euler, Matrix4, Vector3 } from 'three';
import { atRest, boxes } from './build';
import type { Detail, Exemption, Failure, Part, Scene, SceneName, StageOptions, StageResult, Thing, World } from './build';

export const id = 'lens';
export const needs = { scenes: ['table', 'farm', 'duel', 'pen', 'bedroom', 'dream', 'podium'] as SceneName[], models: false };

/** The rule: nothing in view nearer than this, in metres. */
export const NEED = 1.0;
/** How far round the lens the report looks at a path's stops, to say how much room there is. */
const LOOK = 2.5;
/** The pictures the plan judges: a computer at 16:9, a phone upright at 390 x 844. */
export const ASPECT = { computer: 16 / 9, phone: 390 / 844 } as const;
type Device = keyof typeof ASPECT;
const DEVICES: readonly Device[] = ['computer', 'phone'];
/** The longest step between two places on a path, in metres. */
const STEP = 0.05;

export type Vec = [number, number, number];
type V = readonly [number, number, number];

// ---------------------------------------------------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One place of a camera: where it stands, what it looks at, its lens, the picture's shape, and the slide of the picture
 * if any. `ortho` is an orthographic camera's picture in metres (width, height); its `fov` is not read.
 */
export interface View { position: V; target: V; fov: number; aspect: number; shift?: readonly [number, number]; ortho?: readonly [number, number] }

/**
 * A view worked out: the lens, its three axes, and the tangents of the picture's four sides; for an orthographic
 * camera (`ortho`), the sides' offsets from the lens in metres.
 */
export interface Eye { p: Vec; f: Vec; r: Vec; u: Vec; left: number; right: number; bottom: number; top: number; ortho?: boolean }

const sub = (a: V, b: V): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): Vec => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * three.js's own camera, in numbers: `lookAt` with +y up, a vertical field of view, and `setViewOffset` for a picture
 * slid by a share of its width and height (src/skin/rooms/PenStage.tsx: `shift`).
 */
export function eyeOf(view: View): Eye {
  const f = unit(sub(view.target, view.position)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f);
  if (view.ortho) {
    const [w, h] = view.ortho;
    return { p: [view.position[0], view.position[1], view.position[2]], f, r, u, left: -w / 2, right: w / 2, bottom: -h / 2, top: h / 2, ortho: true };
  }
  const t = Math.tan((view.fov * Math.PI) / 360), w = t * view.aspect;
  const sx = view.shift?.[0] ?? 0, sy = view.shift?.[1] ?? 0;
  const left = -w * (1 + 2 * sx), top = t * (1 + 2 * sy);
  return { p: [view.position[0], view.position[1], view.position[2]], f, r, u, left, right: left + 2 * w, bottom: top - 2 * t, top };
}

/** Where a point lands in the picture: x and y from -1 to 1 across it (left to right, bottom to top), and its depth in metres. */
export function project(eye: Eye, point: V): Vec {
  const d = sub(point, eye.p), z = dot(d, eye.f);
  if (eye.ortho) return [((dot(d, eye.r) - eye.left) / (eye.right - eye.left)) * 2 - 1, ((dot(d, eye.u) - eye.bottom) / (eye.top - eye.bottom)) * 2 - 1, z];
  return [((dot(d, eye.r) / z - eye.left) / (eye.right - eye.left)) * 2 - 1, ((dot(d, eye.u) / z - eye.bottom) / (eye.top - eye.bottom)) * 2 - 1, z];
}

// ---------------------------------------------------------------------------------------------------------------------
// How near a voxel is, inside the view
// ---------------------------------------------------------------------------------------------------------------------

/**
 * An eye in the frame of the body it is asked about: the lens, and the inward normals of the picture's sides, each with
 * its offset from the lens (`o`, in the body's units). A perspective view has four sides through the lens; an
 * orthographic one has four parallel to its line of sight and a fifth, the lens's own plane, so only what is in front
 * counts. `sides` says how many.
 */
interface LocalEye { x: number; y: number; z: number; n: Float64Array; o: Float64Array; sides: number; fx: number; fy: number; fz: number }

function localEye(eye: Eye, into: Matrix4 | null): LocalEye {
  const turn = (v: V): Vec => {
    if (!into) return [v[0], v[1], v[2]];
    const e = into.elements; // a rotation and one scale: the direction, turned, at its own length
    return unit([e[0] * v[0] + e[4] * v[1] + e[8] * v[2], e[1] * v[0] + e[5] * v[1] + e[9] * v[2], e[2] * v[0] + e[6] * v[1] + e[10] * v[2]]);
  };
  const p = into ? new Vector3(eye.p[0], eye.p[1], eye.p[2]).applyMatrix4(into) : null;
  const f = turn(eye.f), r = turn(eye.r), u = turn(eye.u);
  const n = new Float64Array(15), o = new Float64Array(5);
  if (eye.ortho) {
    // The picture's sides in the body's units: its frame scales the world's metres by one factor.
    const k0 = into ? Math.cbrt(Math.abs(into.determinant())) : 1;
    for (let k = 0; k < 3; k++) { n[k] = r[k]; n[3 + k] = -r[k]; n[6 + k] = u[k]; n[9 + k] = -u[k]; n[12 + k] = f[k]; }
    o[0] = eye.left * k0; o[1] = -eye.right * k0; o[2] = eye.bottom * k0; o[3] = -eye.top * k0; o[4] = 0;
  } else {
    for (let k = 0; k < 3; k++) {
      n[k] = r[k] - eye.left * f[k];
      n[3 + k] = eye.right * f[k] - r[k];
      n[6 + k] = u[k] - eye.bottom * f[k];
      n[9 + k] = eye.top * f[k] - u[k];
    }
  }
  const sides = eye.ortho ? 5 : 4;
  return p ? { x: p.x, y: p.y, z: p.z, n, o, sides, fx: f[0], fy: f[1], fz: f[2] } : { x: eye.p[0], y: eye.p[1], z: eye.p[2], n, o, sides, fx: f[0], fy: f[1], fz: f[2] };
}

const POLY_A = new Float64Array(48), POLY_B = new Float64Array(48);

/** Cuts a polygon by one side of the picture (Sutherland and Hodgman): what is left of `src` on the inner side goes to `dst`. */
function clip(src: Float64Array, count: number, dst: Float64Array, e: LocalEye, k: number): number {
  const nx = e.n[k * 3], ny = e.n[k * 3 + 1], nz = e.n[k * 3 + 2], ok = e.o[k];
  let m = 0;
  let ax = src[(count - 1) * 3], ay = src[(count - 1) * 3 + 1], az = src[(count - 1) * 3 + 2];
  let da = nx * (ax - e.x) + ny * (ay - e.y) + nz * (az - e.z) - ok;
  for (let i = 0; i < count; i++) {
    const bx = src[i * 3], by = src[i * 3 + 1], bz = src[i * 3 + 2];
    const db = nx * (bx - e.x) + ny * (by - e.y) + nz * (bz - e.z) - ok;
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      dst[m * 3] = ax + (bx - ax) * t; dst[m * 3 + 1] = ay + (by - ay) * t; dst[m * 3 + 2] = az + (bz - az) * t;
      m++;
    }
    if (db >= 0) { dst[m * 3] = bx; dst[m * 3 + 1] = by; dst[m * 3 + 2] = bz; m++; }
    ax = bx; ay = by; az = bz; da = db;
  }
  return m;
}

/** How far a point is from the stretch a..b. */
function toStretch(px: number, py: number, pz: number, P: Float64Array, a: number, b: number): number {
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const dx = P[b * 3] - ax, dy = P[b * 3 + 1] - ay, dz = P[b * 3 + 2] - az;
  const len = dx * dx + dy * dy + dz * dz;
  const t = len > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / len)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t, pz - az - dz * t);
}

/**
 * How far the lens is from the part of one box that is inside the view, if that is under `limit`; else `limit`. The
 * view is a cone with its point at the lens, so the nearest point of the box inside it lies on a face of the box that
 * faces the lens: each such face is cut by the picture's four sides and what is left is measured. `faces` says which
 * of the box's six faces the game draws (bits: -x, +x, -y, +y, -z, +z); a face it does not draw is not there to see.
 * A lens inside the box sees none of its faces.
 */
function inView(e: LocalEye, B: Float64Array, i: number, limit: number, faces: number): number {
  let best = limit;
  for (let axis = 0; axis < 3; axis++) {
    const pa = axis === 0 ? e.x : axis === 1 ? e.y : e.z;
    let c: number;
    if (pa < B[i + axis]) { if (!(faces & (1 << (axis * 2)))) continue; c = B[i + axis]; }
    else if (pa > B[i + 3 + axis]) { if (!(faces & (2 << (axis * 2)))) continue; c = B[i + 3 + axis]; }
    else continue;
    const off = Math.abs(pa - c);
    if (off >= best) continue;
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
    for (let k = 0; k < 4; k++) {
      POLY_A[k * 3 + axis] = c;
      POLY_A[k * 3 + a1] = B[i + a1 + (k === 1 || k === 2 ? 3 : 0)];
      POLY_A[k * 3 + a2] = B[i + a2 + (k >= 2 ? 3 : 0)];
    }
    let P = POLY_A, Q = POLY_B, count = 4;
    for (let k = 0; k < e.sides && count > 0; k++) { count = clip(P, count, Q, e, k); [P, Q] = [Q, P]; }
    if (count === 0) continue;
    // Straight in front of the face: the foot of the lens on its plane, if that is on what is left of the face.
    const foot: Vec = [e.x, e.y, e.z];
    foot[axis] = c;
    let on = foot[a1] >= B[i + a1] && foot[a1] <= B[i + 3 + a1] && foot[a2] >= B[i + a2] && foot[a2] <= B[i + 3 + a2];
    for (let k = 0; k < e.sides && on; k++) on = e.n[k * 3] * (foot[0] - e.x) + e.n[k * 3 + 1] * (foot[1] - e.y) + e.n[k * 3 + 2] * (foot[2] - e.z) - e.o[k] >= 0;
    if (on) { best = off; continue; }
    for (let k = 0; k < count; k++) {
      const d = toStretch(e.x, e.y, e.z, P, k, (k + 1) % count);
      if (d < best) best = d;
    }
  }
  return best;
}

/** The six faces of a box as bits: -x, +x, -y, +y, -z, +z. */
const ALL_FACES = 63;
/**
 * Parts the game draws from one side only. The barn's front wall keeps only the faces that point into the barn
 * (`frontInside` in src/skin/scene/barn.ts): the table's camera stands outside it and looks straight through.
 */
const ONE_SIDED: { mount: RegExp; faces: number }[] = [{ mount: /^barn\.front$/, faces: 1 << 5 }];
const facesOf = (part: Part): number => ONE_SIDED.find((o) => o.mount.test(part.mount))?.faces ?? ALL_FACES;

// ---------------------------------------------------------------------------------------------------------------------
// What is near a path
// ---------------------------------------------------------------------------------------------------------------------

/** A scene's world, or one thing in it, with the way from the world's metres into its own frame. */
export interface Body { name: string; thing: Thing | null; parts: Part[]; into: Matrix4 | null; out: Matrix4 | null; scale: number }

export function bodiesOf(scene: Scene): { bodies: Body[]; unjudged: string[] } {
  const bodies: Body[] = [{ name: 'world', thing: null, parts: scene.world, into: null, out: null, scale: 1 }];
  const unjudged: string[] = [];
  for (const thing of scene.things) {
    const s = thing.at.scale;
    if (Math.abs(s[0] - s[1]) > 1e-9 || Math.abs(s[0] - s[2]) > 1e-9 || s[0] <= 0 || thing.parts.some((p) => !p.aligned)) { unjudged.push(thing.name); continue; }
    // Into the world's metres: the thing's own turn (three's angles in the order 'YXZ', as build.ts reads them), its
    // one scale, then where it rests.
    const out = new Matrix4().makeRotationFromEuler(new Euler(thing.at.rotation[0], thing.at.rotation[1], thing.at.rotation[2], 'YXZ'));
    out.scale(new Vector3(s[0], s[0], s[0]));
    out.setPosition(thing.at.position[0], thing.at.position[1], thing.at.position[2]);
    bodies.push({ name: thing.name, thing, parts: thing.parts, into: out.clone().invert(), out, scale: s[0] });
  }
  return { bodies, unjudged };
}

/** The voxels of one body near one group of camera places, sorted into buckets so each place asks only for what is round it. */
export class Near {
  boxes: Float64Array;
  /** The part each box came from, as an index into `parts`. */
  owner: Int32Array;
  private start: Int32Array;
  private items: Int32Array;
  /** The faces each part draws, by its index in `parts`. */
  faces: Uint8Array;
  /** The box round every box kept. */
  private min: Vec = [Infinity, Infinity, Infinity];
  private max: Vec = [-Infinity, -Infinity, -Infinity];
  private stamp: Int32Array;
  private tick = 0;
  private lo: Vec;
  private n: Vec;
  private side: number;

  constructor(readonly parts: Part[], lo: Vec, hi: Vec) {
    // The boxes that reach into lo..hi.
    const kept: number[] = [], owner: number[] = [];
    parts.forEach((part, pi) => {
      const B = boxes(part);
      if (!B) return;
      for (let i = 0; i < B.length; i += 6) {
        if (B[i + 3] < lo[0] || B[i] > hi[0] || B[i + 4] < lo[1] || B[i + 1] > hi[1] || B[i + 5] < lo[2] || B[i + 2] > hi[2]) continue;
        kept.push(B[i], B[i + 1], B[i + 2], B[i + 3], B[i + 4], B[i + 5]);
        owner.push(pi);
      }
    });
    for (let i = 0; i < kept.length; i += 6) for (let k = 0; k < 3; k++) { if (kept[i + k] < this.min[k]) this.min[k] = kept[i + k]; if (kept[i + 3 + k] > this.max[k]) this.max[k] = kept[i + 3 + k]; }
    this.boxes = Float64Array.from(kept);
    this.owner = Int32Array.from(owner);
    this.faces = Uint8Array.from(parts, facesOf);
    const count = owner.length;
    this.stamp = new Int32Array(count);
    this.lo = lo;
    // Buckets of a metre or so, wider when the stretch is long, so there are never more than a few million of them.
    let side = Math.max(0.5, (hi[0] - lo[0]) / 160, (hi[1] - lo[1]) / 160, (hi[2] - lo[2]) / 160);
    if (!(side > 0) || !Number.isFinite(side)) side = 1;
    this.side = side;
    this.n = [Math.max(1, Math.ceil((hi[0] - lo[0]) / side)), Math.max(1, Math.ceil((hi[1] - lo[1]) / side)), Math.max(1, Math.ceil((hi[2] - lo[2]) / side))];
    const cells = this.n[0] * this.n[1] * this.n[2];
    const counts = new Int32Array(cells + 1);
    const each = (visit: (cell: number, box: number) => void) => {
      for (let b = 0; b < count; b++) {
        const r = this.range(this.boxes, b * 6);
        for (let x = r[0]; x <= r[3]; x++) for (let y = r[1]; y <= r[4]; y++) for (let z = r[2]; z <= r[5]; z++) visit((x * this.n[1] + y) * this.n[2] + z, b);
      }
    };
    each((cell) => { counts[cell + 1]++; });
    for (let c = 0; c < cells; c++) counts[c + 1] += counts[c];
    this.start = counts;
    this.items = new Int32Array(counts[cells]);
    const fill = counts.slice(0, cells);
    each((cell, box) => { this.items[fill[cell]++] = box; });
  }

  private range(B: ArrayLike<number>, i: number): [number, number, number, number, number, number] {
    const at = (v: number, k: number) => Math.min(this.n[k] - 1, Math.max(0, Math.floor((v - this.lo[k]) / this.side)));
    return [at(B[i], 0), at(B[i + 1], 1), at(B[i + 2], 2), at(B[i + 3], 0), at(B[i + 4], 1), at(B[i + 5], 2)];
  }

  /** False when no box can be within `reach` of the point: it is further than that from the box round them all. */
  within(x: number, y: number, z: number, reach: number): boolean {
    return x > this.min[0] - reach && x < this.max[0] + reach && y > this.min[1] - reach && y < this.max[1] + reach && z > this.min[2] - reach && z < this.max[2] + reach;
  }

  /** The first box that holds a point (its number), or -1 when none does. */
  holds(x: number, y: number, z: number): number {
    if (!this.owner.length || !this.within(x, y, z, 0)) return -1;
    const r = this.range([x, y, z, x, y, z], 0), B = this.boxes;
    const cell = (r[0] * this.n[1] + r[1]) * this.n[2] + r[2];
    for (let k = this.start[cell]; k < this.start[cell + 1]; k++) {
      const i = this.items[k] * 6;
      if (x >= B[i] && x < B[i + 3] && y >= B[i + 1] && y < B[i + 4] && z >= B[i + 2] && z < B[i + 5]) return this.items[k];
    }
    return -1;
  }

  /** Every box within `reach` of a point, once each: its number and its distance (0 for a point in or on it). */
  round(x: number, y: number, z: number, reach: number, visit: (box: number, distance: number) => void): void {
    if (!this.owner.length) return;
    const r = this.range([x - reach, y - reach, z - reach, x + reach, y + reach, z + reach], 0);
    const B = this.boxes, tick = ++this.tick;
    for (let a = r[0]; a <= r[3]; a++) for (let b = r[1]; b <= r[4]; b++) for (let c = r[2]; c <= r[5]; c++) {
      const cell = (a * this.n[1] + b) * this.n[2] + c;
      for (let k = this.start[cell]; k < this.start[cell + 1]; k++) {
        const box = this.items[k];
        if (this.stamp[box] === tick) continue;
        this.stamp[box] = tick;
        const i = box * 6;
        const dx = Math.max(B[i] - x, 0, x - B[i + 3]), dy = Math.max(B[i + 1] - y, 0, y - B[i + 4]), dz = Math.max(B[i + 2] - z, 0, z - B[i + 5]);
        const d = Math.hypot(dx, dy, dz);
        if (d < reach) visit(box, d);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The paths
// ---------------------------------------------------------------------------------------------------------------------

/** One place on a path. A stop is a place the report looks further round (the start, the middle, the end). */
interface Place { view: View; note: string; stop: boolean; /** The swing this place is on, where a path is many swings: "the wide shot to seat 1". */ leg?: string }

/** One camera path: a shot of the tour over its push, a seat's close shot, the podium's ease to the side. */
interface Path {
  scene: SceneName;
  /** The levels it is judged at; both, but for the dream, whose two builds are a computer's and a phone's. */
  details: readonly Detail[];
  device: Device;
  /** Its place in `measured.short.<scene>.<detail>.<device>`: paths that share a key are summed. */
  key: string;
  /** For a person: "computer 4, the hens' run". */
  name: string;
  places: Place[];
  /** True for a table's swings: its places are sorted by `leg`, and what is counted is the swings that fail. */
  swings?: boolean;
}

interface Game {
  homePov: typeof import('../../src/skin/scene/homePov');
  layout: typeof import('../../src/skin/scene/layout');
  duel: typeof import('../../src/skin/scene/duel');
  pen: typeof import('../../src/skin/scene/pen');
  stage: typeof import('../../src/skin/dream/stage');
  /** How tall each animal stands against the sheep, lowest first: the speaker camera aims at the speaker's head. */
  heads: { animal: string; ratio: number }[];
}

/** The lines of the game this file copies a camera's movement from. A line that is gone or changed stops the stage. */
const PINS: Record<string, string[]> = {
  'src/skin/scene/barn.ts': [
    'for (let t = 0; t < idx.count; t += 3) if (nor.getZ(idx.getX(t)) > 0.5) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));',
    'const front = frontInside();',
  ],
  'src/skin/table/FarmBackdrop.tsx': [
    '<Drift shots={phone ? POV_SHOTS.phone : POV_SHOTS.desktop} veil={veil} spot={spot} bounce={bounce} reduced={reduced} ready={ready} hour={hour} />',
    'const dx = reduced ? 0 : Math.cos(t) * 0.25;',
    'const dy = reduced ? 0 : Math.sin(t) * 0.12;',
    'camera.position.set(shot.position[0] + dx + shot.push[0] * k, shot.position[1] + dy + shot.push[1] * k, shot.position[2] + shot.push[2] * k);',
    'camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);',
  ],
  'src/skin/table/BarnTable.tsx': [
    'const polar = (p: readonly number[]) => ({ a: Math.atan2(p[0] - SEAT_RING.cx, -(p[2] - SEAT_RING.cz)), r: Math.hypot(p[0] - SEAT_RING.cx, p[2] - SEAT_RING.cz), y: p[1] });',
    'return SPEAKER_CAMERA.headY * (c ? heightRatio(c.animal) : 1);',
    'const to = home ? homeShot(phone) : speakerShot(seat!, n, phone, headY);',
    'const u = easeInOut(Math.min(1, (t - st.at) / 0.65));',
    'da = Math.atan2(Math.sin(da), Math.cos(da)); // the short way round',
    'const ang = p0.a + da * u, r = p0.r + (p1.r - p0.r) * u, y = p0.y + (p1.y - p0.y) * u;',
    'position: [SEAT_RING.cx + Math.sin(ang) * r, y, SEAT_RING.cz - Math.cos(ang) * r],',
    'fov: from.fov + (to.fov - from.fov) * u,',
    'const drift = !reduced && !home && u >= 1 ? 0.05 : 0;',
    'camera.position.set(st.cur.position[0] + Math.cos(w) * drift, st.cur.position[1] + Math.sin(w) * drift * 0.5, st.cur.position[2]);',
  ],
  'src/skin/table/DuelTable.tsx': [
    'const pressureOf = (speaker: number | null, fraction: number) => (speaker === 0 ? Math.min(1, Math.max(0, 1 - fraction)) : 0);',
    'const open = duelShot(null, 0, phone);',
    'const shot = duelShot(speaker, reduced ? 0 : pressure, phone);',
    'camera.position.lerp(aim, k);',
    'seen.target.lerp(aim, k);',
    'const shake = reduced ? 0 : Math.max(0, pressure - 0.7) * 0.09;',
    'camera.lookAt(seen.target.x + Math.sin(t) * shake, seen.target.y + Math.cos(t * 1.3) * shake, seen.target.z);',
  ],
  'src/skin/rooms/PenStage.tsx': [
    'const shot = penShot(phone);',
    'camera.setViewOffset(size.width, size.height, -shift[0] * size.width, -shift[1] * size.height, size.width, size.height);',
  ],
  'src/skin/rooms/PaintedRoom.tsx': [
    '<PenStage guests={guests} farmSheep={0} reduced={reduced} phone={phone} shift={phone ? [0, -0.16] : [0, -0.2]} />',
  ],
  'src/skin/table/Podium.tsx': [
    'const tx = aside && !phone ? 2.7 : 0, ty = aside && phone ? -2.4 : 0;',
    'if (phone) camera.position.set(at.x, 3.4 + at.y, 14.5); else camera.position.set(at.x, 3.0, 11.8);',
    'look.set(at.x, 1.6 + at.y, 0);',
    'camera={{ fov: phone ? 58 : 40, position: phone ? [0, 3.4, 14.5] : [0, 3.0, 11.8], near: 0.1, far: 60 }}',
  ],
  'src/skin/dream/DreamStage.tsx': [
    'orthographic camera={{ position: [0, 0, CAMERA_Z], near: 0.1, far: 900, zoom: 100 }}',
    'const view = useMemo(() => dreamView(Math.max(1, size.width), Math.max(1, size.height), phone), [size.width, size.height, phone]);',
    'camera.zoom = view.zoom;',
    'camera.position.set(view.camX, view.camY, CAMERA_Z);',
    'camera.rotation.set(0, 0, 0);',
    'const sh = !reduced && since < WAKE.shakeMs ? WAKE.shake : 0;',
    'camera.position.set(view.camX + (Math.random() - 0.5) * 2 * sh, view.camY + (Math.random() - 0.5) * 2 * sh, CAMERA_Z);',
  ],
  'src/skin/dream/BedroomBubble.tsx': [
    'const CAMERA = { position: [2.3, 1.4, 1.05] as const, target: [0.35, 1.0, -0.4] as const, fov: 29 };',
    'desktop: { position: [3.4, 1.65, 3.1] as const, target: [1.0, 1.05, -0.4] as const, fov: 40 },',
    'phone: { position: [2.8, 1.8, 1.9] as const, target: [0.3, 1.85, -0.45] as const, fov: 58 },',
    'camera.position.lerpVectors(cam.from, cam.p.set(shot.position[0], shot.position[1], shot.position[2]), k);',
    'cam.look.set(CAMERA.target[0] + (shot.target[0] - CAMERA.target[0]) * k, CAMERA.target[1] + (shot.target[1] - CAMERA.target[1]) * k, CAMERA.target[2] + (shot.target[2] - CAMERA.target[2]) * k);',
    'if (camera.fov !== shot.fov) { camera.fov = CAMERA.fov + (shot.fov - CAMERA.fov) * k; camera.updateProjectionMatrix(); }',
  ],
  'src/skin/dream/dream.css': [
    'width: var(--dr-bub-w, min(26%, 420px)); aspect-ratio: 3 / 2;',
  ],
};

/** The copied lines that are no longer in the game, each with its file. */
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

const TOUR_NAMES: Record<Device, string[]> = {
  computer: ['the avatar in the doorway', 'the whole farm', 'the paddock (the wendigo\'s shot: never moved)', 'over the avatar\'s shoulder', 'the hens\' run', 'the tractor', 'down the path', 'across the pond'],
  phone: ['the avatar in the doorway', 'the whole farm', 'the paddock (the wendigo\'s shot: never moved)', 'through the barn', 'the hens\' run', 'down the path'],
};

const lerp = (a: V, b: V, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const far = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** 0 to 1 in steps no longer than STEP over `length` metres. */
const steps = (length: number): number[] => { const n = Math.max(1, Math.ceil(length / STEP)); return Array.from({ length: n + 1 }, (_, i) => i / n); };
const f2 = (v: number) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

/** Every camera path of the painted game. */
function pathsOf(game: Game): Path[] {
  const paths: Path[] = [];
  const BOTH: readonly Detail[] = ['fine', 'coarse'];

  // Home's tour: `Drift` in src/skin/table/FarmBackdrop.tsx.
  for (const device of DEVICES) {
    const shots = device === 'phone' ? game.homePov.POV_SHOTS.phone : game.homePov.POV_SHOTS.desktop;
    shots.forEach((shot, index) => {
      const places: Place[] = [];
      const ks = steps(Math.hypot(...shot.push));
      for (const k of ks) {
        const stop = k === 0 || k === 1 || k === ks[Math.floor(ks.length / 2)];
        const at: Vec = [shot.position[0] + shot.push[0] * k, shot.position[1] + shot.push[1] * k, shot.position[2] + shot.push[2] * k];
        places.push({ view: { position: at, target: shot.target, fov: shot.fov, aspect: ASPECT[device] }, note: `${f2(k)} of the way along its push, no drift`, stop });
        for (let i = 0; i < 16; i++) {
          const t = (i / 16) * Math.PI * 2;
          places.push({ view: { position: [at[0] + Math.cos(t) * 0.25, at[1] + Math.sin(t) * 0.12, at[2]], target: shot.target, fov: shot.fov, aspect: ASPECT[device] }, note: `${f2(k)} of the way along its push, drifted ${f2(Math.cos(t) * 0.25)} m across and ${f2(Math.sin(t) * 0.12)} m up`, stop: false });
        }
      }
      paths.push({ scene: 'farm', details: BOTH, device, key: String(index), name: `${device} ${index}, ${TOUR_NAMES[device][index] ?? 'a shot the tour has gained'}`, places });
    });
  }

  // The barn table: `SpeakerCamera` in src/skin/table/BarnTable.tsx.
  const { speakerShot, homeShot, SEAT_RING, SPEAKER_CAMERA } = game.layout;
  const polar = (p: V) => ({ a: Math.atan2(p[0] - SEAT_RING.cx, -(p[2] - SEAT_RING.cz)), r: Math.hypot(p[0] - SEAT_RING.cx, p[2] - SEAT_RING.cz), y: p[1] });
  const heads = [game.heads[0], { animal: 'sheep', ratio: 1 }, game.heads[game.heads.length - 1]].filter((h, i, all) => all.findIndex((o) => o.ratio === h.ratio) === i);
  for (const device of DEVICES) {
    const phone = device === 'phone', aspect = ASPECT[device];
    const home = homeShot(phone);
    paths.push({ scene: 'table', details: BOTH, device, key: 'home', name: `${device}, the wide shot of the whole ring`, places: [{ view: { ...home, aspect }, note: 'where it holds', stop: true }] });
    for (let n = 2; n <= 10; n++) {
      const seats = Array.from({ length: n }, (_, seat) => speakerShot(seat, n, phone));
      seats.forEach((_, seat) => {
        const places: Place[] = [];
        for (const head of heads) {
          const shot = speakerShot(seat, n, phone, SPEAKER_CAMERA.headY * head.ratio);
          places.push({ view: { ...shot, aspect }, note: `holding, aimed at ${head.animal === 'sheep' ? 'a sheep\'s' : `the ${head.animal}'s`} head`, stop: head.ratio === 1 });
          for (let i = 0; i < 8; i++) {
            const w = (i / 8) * Math.PI * 2;
            places.push({ view: { position: [shot.position[0] + Math.cos(w) * 0.05, shot.position[1] + Math.sin(w) * 0.025, shot.position[2]], target: shot.target, fov: shot.fov, aspect }, note: `breathing, ${f2(Math.cos(w) * 0.05)} m across and ${f2(Math.sin(w) * 0.025)} m up, aimed at ${head.animal === 'sheep' ? 'a sheep\'s' : `the ${head.animal}'s`} head`, stop: false });
          }
        }
        paths.push({ scene: 'table', details: BOTH, device, key: `n${n}`, name: `${device}, a table of ${n}, the close shot of seat ${seat}`, places });
      });
      // The swing from each shot of this table to each other, the wide shot among them.
      const all = [{ shot: home, name: 'the wide shot' }, ...seats.map((shot, seat) => ({ shot, name: `seat ${seat}` }))];
      const places: Place[] = [];
      for (const from of all) for (const to of all) {
        if (from === to) continue;
        const p0 = polar(from.shot.position), p1 = polar(to.shot.position);
        let da = p1.a - p0.a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        // Its length, near enough: the arc at the wider radius, the change of radius and the change of height.
        const length = Math.abs(da) * Math.max(p0.r, p1.r) + Math.abs(p1.r - p0.r) + Math.abs(p1.y - p0.y);
        // A place every 0.2 m of the way, evenly: the game eases along this same line (`easeInOut`), which changes
        // when the camera is at each place and not where it goes. Both ends are judged as shots.
        for (const u of steps(length / 4).slice(1, -1)) {
          const ang = p0.a + da * u, r = p0.r + (p1.r - p0.r) * u, y = p0.y + (p1.y - p0.y) * u;
          places.push({
            view: { position: [SEAT_RING.cx + Math.sin(ang) * r, y, SEAT_RING.cz - Math.cos(ang) * r], target: lerp(from.shot.target, to.shot.target, u), fov: from.shot.fov + (to.shot.fov - from.shot.fov) * u, aspect },
            note: `${f2(u)} of the way from ${from.name} to ${to.name}`, stop: false, leg: `${from.name} to ${to.name}`,
          });
        }
      }
      paths.push({ scene: 'table', details: BOTH, device, key: `n${n}`, swings: true, name: `${device}, a table of ${n}, the swings between its shots`, places });
    }
  }

  // Practice, on the ice: `DuelCamera` in src/skin/table/DuelTable.tsx.
  for (const device of DEVICES) {
    const phone = device === 'phone', aspect = ASPECT[device];
    const { duelShot } = game.duel;
    const open = duelShot(null, 0, phone), bot = duelShot(1, 0, phone);
    const hold = (shot: { position: V; target: V; fov: number }, note: string, stop = true): Place => ({ view: { ...shot, aspect }, note, stop });
    const move = (a: { position: V; target: V; fov: number }, b: { position: V; target: V; fov: number }, note: string): Place[] =>
      steps(far(a.position, b.position)).slice(1, -1).map((t) => ({ view: { position: lerp(a.position, b.position, t), target: lerp(a.target, b.target, t), fov: b.fov, aspect }, note: `${f2(t)} of the way ${note}`, stop: false }));
    const yours: Place[] = [];
    for (let i = 0; i <= 20; i++) {
      const pressure = i / 20, shot = duelShot(0, pressure, phone);
      yours.push(hold(shot, `your turn, pressure ${f2(pressure)}`, i === 0 || i === 20));
      const shake = Math.max(0, pressure - 0.7) * 0.09;
      if (shake > 0) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) yours.push({ view: { position: shot.position, target: [shot.target[0] + sx * shake, shot.target[1] + sy * shake, shot.target[2]], fov: shot.fov, aspect }, note: `your turn, pressure ${f2(pressure)}, shaken`, stop: false });
    }
    const you0 = duelShot(0, 0, phone), you1 = duelShot(0, 1, phone);
    paths.push({ scene: 'duel', details: BOTH, device, key: 'open', name: `${device}, the opening shot`, places: [hold(open, 'where it holds')] });
    paths.push({ scene: 'duel', details: BOTH, device, key: 'you', name: `${device}, your turn, from a full clock to none`, places: [...yours, ...move(open, you0, 'from the opening shot to your turn'), ...move(bot, you0, 'from the bot\'s turn to yours')] });
    paths.push({ scene: 'duel', details: BOTH, device, key: 'bot', name: `${device}, the bot's turn`, places: [hold(bot, 'where it holds'), ...move(open, bot, 'from the opening shot to the bot\'s turn'), ...move(you0, bot, 'from your turn to the bot\'s'), ...move(you1, bot, 'from your last moment to the bot\'s turn')] });
  }

  // The lobby's pen: `Frame` in src/skin/rooms/PenStage.tsx, with the slide src/skin/rooms/PaintedRoom.tsx gives it.
  for (const device of DEVICES) {
    const phone = device === 'phone';
    const shift: [number, number] = phone ? [0, -0.16] : [0, -0.2];
    paths.push({ scene: 'pen', details: BOTH, device, key: 'pen', name: `${device}, the pen's one shot`, places: [{ view: { ...game.pen.penShot(phone), aspect: ASPECT[device], shift }, note: 'where it holds', stop: true }] });
  }

  // The winning screen: `Rig` in src/skin/table/Podium.tsx.
  for (const device of DEVICES) {
    const phone = device === 'phone';
    const places: Place[] = steps(phone ? 2.4 : 2.7).map((t, i, all) => {
      const x = phone ? 0 : 2.7 * t, y = phone ? -2.4 * t : 0;
      return { view: { position: phone ? [x, 3.4 + y, 14.5] : [x, 3.0, 11.8], target: [x, 1.6 + y, 0], fov: phone ? 58 : 40, aspect: ASPECT[device] }, note: `${f2(t)} of the way from the middle to beside the scoreboard`, stop: i === 0 || i === all.length - 1 };
    });
    paths.push({ scene: 'podium', details: BOTH, device, key: 'podium', name: `${device}, from the middle to beside the scoreboard`, places });
  }

  // Counting Sheep: `DreamCamera` in src/skin/dream/DreamStage.tsx, the side view: an orthographic camera at CAMERA_Z
  // looking along -z, its picture the frame in metres (dreamView), shaken sideways and up on a bump. The fine level is
  // the build for a wide screen and the coarse one the build for a phone upright (tools/scenes/build.ts), so each shot
  // is judged in its own build. The sizes are the plan's: 1920 x 1080, a phone on its side at 844 x 390 (wider than 640,
  // so the game draws it as a computer), and a phone upright at 390 x 844.
  const { dreamView, CAMERA_Z, WAKE } = game.stage;
  const shaken = (w: number, h: number, phone: boolean): Place[] => {
    const v = dreamView(w, h, phone), ortho: [number, number] = [w / v.zoom, h / v.zoom];
    const at = (dx: number, dy: number): View => ({ position: [v.camX + dx, v.camY + dy, CAMERA_Z], target: [v.camX + dx, v.camY + dy, CAMERA_Z - 1], fov: 0, aspect: w / h, ortho });
    return [
      { view: at(0, 0), note: 'where it holds', stop: true },
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]): Place => ({ view: at(sx * WAKE.shake, sy * WAKE.shake), note: 'shaken by a bump', stop: false })),
    ];
  };
  paths.push({ scene: 'dream', details: ['fine'], device: 'computer', key: 'computer', name: 'a computer', places: shaken(1920, 1080, false) });
  paths.push({ scene: 'dream', details: ['fine'], device: 'phone', key: 'sideways', name: 'a phone on its side', places: shaken(844, 390, false) });
  paths.push({ scene: 'dream', details: ['coarse'], device: 'phone', key: 'upright', name: 'a phone upright', places: shaken(390, 844, true) });

  // The farmer's bedroom: the bubble (3 by 2), and its way down to the results shot once the night is over.
  const BUBBLE = { position: [2.3, 1.4, 1.05], target: [0.35, 1.0, -0.4], fov: 29 } as const;
  const RESULTS = { computer: { position: [3.4, 1.65, 3.1], target: [1.0, 1.05, -0.4], fov: 40 }, phone: { position: [2.8, 1.8, 1.9], target: [0.3, 1.85, -0.45], fov: 58 } } as const;
  for (const device of DEVICES) {
    const to = RESULTS[device];
    paths.push({ scene: 'bedroom', details: BOTH, device, key: 'bubble', name: `${device}, the bubble over the dream`, places: [{ view: { ...BUBBLE, aspect: 3 / 2 }, note: 'where it holds', stop: true }] });
    const places: Place[] = steps(far(BUBBLE.position, to.position)).slice(1).map((t, i, all) => ({
      view: { position: lerp(BUBBLE.position, to.position, t), target: lerp(BUBBLE.target, to.target, t), fov: BUBBLE.fov + (to.fov - BUBBLE.fov) * t, aspect: ASPECT[device] },
      note: i === all.length - 1 ? 'the results shot' : `${f2(t)} of the way down to the results shot`, stop: i === all.length - 1,
    }));
    paths.push({ scene: 'bedroom', details: BOTH, device, key: 'results', name: `${device}, down to the results shot`, places });
  }
  return paths;
}

// ---------------------------------------------------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------------------------------------------------

/** A voxel the stage names: the part it is of, the thing it is in (or the world), and its middle in the world's metres. */
interface Hit { part: Part; body: string; at: Vec }
interface Seen { distance: number; place: Place; hit: Hit }

/** What one path came to. */
interface Found {
  path: Path;
  /** The least distance to a voxel inside the view over the whole path, when that is under NEED; else null. */
  short: Seen | null;
  /** The least distance inside the view at the path's stops, looked for out to LOOK; null when nothing is that near. */
  room: Seen | null;
  /** The least distance to any voxel, in view or not, over the whole path, when under NEED; else null. */
  around: Seen | null;
  /** Places where the lens is inside a voxel, and the first of them. */
  inside: number;
  insideAt: { place: Place; hit: Hit } | null;
  /** For a table's swings: every swing that fails, with its worst place, and how many swings there are. */
  legs: Map<string, { worst: Seen; inside: boolean }>;
  legCount: number;
  /** Every place and what it found, kept only for --show. */
  log: string[] | null;
}

/** How far off the lens the eight points are that say whether it is inside a solid, in metres. */
const SKIN = 1e-4;

function judge(bodies: Body[], group: Path[], keepLog: (path: Path) => boolean): Found[] {
  // One set of buckets for each body, round every place of the group.
  const nears: { body: Body; index: Near }[] = [];
  const v = new Vector3();
  for (const body of bodies) {
    const lo: Vec = [Infinity, Infinity, Infinity], hi: Vec = [-Infinity, -Infinity, -Infinity];
    for (const path of group) for (const place of path.places) {
      v.set(place.view.position[0], place.view.position[1], place.view.position[2]);
      if (body.into) v.applyMatrix4(body.into);
      lo[0] = Math.min(lo[0], v.x); lo[1] = Math.min(lo[1], v.y); lo[2] = Math.min(lo[2], v.z);
      hi[0] = Math.max(hi[0], v.x); hi[1] = Math.max(hi[1], v.y); hi[2] = Math.max(hi[2], v.z);
    }
    const pad = (LOOK + 0.01) / body.scale;
    const index = new Near(body.parts, [lo[0] - pad, lo[1] - pad, lo[2] - pad], [hi[0] + pad, hi[1] + pad, hi[2] + pad]);
    if (index.owner.length) nears.push({ body, index });
  }
  const hitOf = (body: Body, index: Near, box: number): Hit => {
    const B = index.boxes, i = box * 6;
    const at = new Vector3((B[i] + B[i + 3]) / 2, (B[i + 1] + B[i + 4]) / 2, (B[i + 2] + B[i + 5]) / 2);
    if (body.out) at.applyMatrix4(body.out);
    return { part: index.parts[index.owner[box]], body: body.name, at: [at.x, at.y, at.z] };
  };

  const close: { box: number; d: number }[] = [];
  return group.map((path) => {
    const found: Found = { path, short: null, room: null, around: null, inside: 0, insideAt: null, legs: new Map(), legCount: new Set(path.places.map((p) => p.leg)).size, log: keepLog(path) ? [] : null };
    for (const place of path.places) {
      const eye = eyeOf(place.view);
      const reach = place.stop ? LOOK : NEED;
      let seen = reach, seenHit: Hit | null = null, any = reach, anyHit: Hit | null = null, within: Hit | null = null;
      for (const { body, index } of nears) {
        const s = body.scale, B = index.boxes;
        v.set(eye.p[0], eye.p[1], eye.p[2]);
        if (body.into) v.applyMatrix4(body.into);
        if (!index.within(v.x, v.y, v.z, reach / s)) continue;
        const e = localEye(eye, body.into);
        close.length = 0;
        index.round(e.x, e.y, e.z, reach / s, (box, d) => { close.push({ box, d: d * s }); });
        if (!close.length) continue;
        close.sort((a, b) => a.d - b.d || a.box - b.box);
        if (close[0].d < any) { any = close[0].d; anyHit = hitOf(body, index, close[0].box); }
        // Inside a solid: the lens touches a voxel, and eight points just off it are every one in a voxel of this body.
        if (close[0].d < SKIN && !within) {
          let all = true;
          for (let k = 0; k < 8 && all; k++) {
            const x = e.x + (k & 1 ? SKIN : -SKIN) / s, y = e.y + (k & 2 ? SKIN : -SKIN) / s, z = e.z + (k & 4 ? SKIN : -SKIN) / s;
            let inOne = false;
            for (const c of close) {
              if (c.d > 3 * SKIN) break;
              const i = c.box * 6;
              if (index.faces[index.owner[c.box]] === ALL_FACES && x > B[i] && x < B[i + 3] && y > B[i + 1] && y < B[i + 4] && z > B[i + 2] && z < B[i + 5]) { inOne = true; break; }
            }
            all = inOne;
          }
          if (all) { within = hitOf(body, index, close[0].box); seen = 0; seenHit = within; }
        }
        // A lens that touches a voxel is looked at from a hair further back along its own line of sight. If that
        // point is inside the solid, what it touches is behind the camera and is not in the picture; if it is not,
        // a face the camera looks into lies a hair in front of it.
        const back: LocalEye = { ...e, x: e.x - (e.fx * SKIN) / s, y: e.y - (e.fy * SKIN) / s, z: e.z - (e.fz * SKIN) / s };
        let backInside = false;
        for (const c of close) {
          if (c.d > 3 * SKIN) break;
          const i = c.box * 6;
          if (index.faces[index.owner[c.box]] === ALL_FACES && back.x > B[i] && back.x < B[i + 3] && back.y > B[i + 1] && back.y < B[i + 4] && back.z > B[i + 2] && back.z < B[i + 5]) { backInside = true; break; }
        }
        for (const c of close) {
          if (c.d >= seen) break; // sorted: nothing further on can be nearer in view than what is found
          const faces = index.faces[index.owner[c.box]];
          let d: number;
          if (c.d < SKIN) {
            if (backInside) continue;
            d = Math.max(0, inView(back, B, c.box * 6, (seen + SKIN) / s, faces) * s - SKIN);
          } else d = inView(e, B, c.box * 6, seen / s, faces) * s;
          if (d < seen) { seen = d; seenHit = hitOf(body, index, c.box); }
        }
      }
      if (within) { found.inside++; found.insideAt ??= { place, hit: within }; }
      const fails = seenHit !== null && seen < NEED - 1e-6;
      if (fails && (!found.short || seen < found.short.distance)) found.short = { distance: seen, place, hit: seenHit! };
      if (place.stop && seenHit && (!found.room || seen < found.room.distance)) found.room = { distance: seen, place, hit: seenHit };
      if (anyHit && any < NEED - 1e-6 && (!found.around || any < found.around.distance)) found.around = { distance: any, place, hit: anyHit };
      if (place.leg && fails) {
        const leg = found.legs.get(place.leg);
        if (!leg) found.legs.set(place.leg, { worst: { distance: seen, place, hit: seenHit! }, inside: !!within });
        else { if (seen < leg.worst.distance) leg.worst = { distance: seen, place, hit: seenHit! }; leg.inside ||= !!within; }
      }
      found.log?.push(`        ${place.note}: lens at (${place.view.position.map(f2).join(', ')}), in view ${seenHit ? `${seen.toFixed(3)} m to ${seenHit.part.mount}` : `nothing within ${f2(reach)} m`}${within ? ' (THE LENS IS INSIDE IT)' : ''}; all round ${anyHit ? `${any.toFixed(3)} m to ${anyHit.part.mount}` : `nothing within ${f2(reach)} m`}`);
    }
    return found;
  });
}

const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
const sourceOf = (hit: Hit) => `${hit.body === 'world' ? '' : `thing "${hit.body}": `}${hit.part.mount}: ${hit.part.label}`;
const whereOf = (hit: Hit) => `(${hit.at.map(f2).join(', ')})`;
/** Millimetres short of the rule: never 0 for a path that fails. */
const shortOf = (distance: number) => Math.max(1, Math.round((NEED - distance) * 1000));

/** The game's cameras, read once for each world: the paths, or the copied lines that are gone. */
const read = new WeakMap<World, Promise<{ paths: Path[]; lost: string[]; heads: Game['heads'] }>>();

/**
 * Every camera path of the painted game, from the game's own files in the graph the world was built in. `lost` names
 * the copied lines that are gone or changed: with any, there are no paths.
 */
export function cameraPaths(world: World, root: string): Promise<{ paths: Path[]; lost: string[]; heads: Game['heads'] }> {
  let made = read.get(world);
  if (!made) {
    made = (async () => {
      const lost = lostPins(root);
      if (lost.length) return { paths: [], lost, heads: [] };
      // How tall each animal stands against the sheep: the world's own models when this run built them.
      const names = ['sheep', 'pig', 'cow', 'goat', 'horse', 'chicken'] as const;
      const heights: { animal: string; height: number }[] = [];
      for (const animal of names) {
        const model = world.models.find((m) => m.id === `animal:${animal}`)
          ?? await world.capture(`animal:${animal}`, 'animal', async (load) => (await load<typeof import('../../src/skin/voxel/animals/index')>('src/skin/voxel/animals/index.ts')).animalModel(animal));
        heights.push({ animal, height: (model.built as { height: number }).height });
      }
      const heads = heights.map((h) => ({ animal: h.animal, ratio: h.height / heights[0].height })).sort((a, b) => a.ratio - b.ratio);
      const game: Game = {
        homePov: await world.load('src/skin/scene/homePov.ts'),
        layout: await world.load('src/skin/scene/layout.ts'),
        duel: await world.load('src/skin/scene/duel.ts'),
        pen: await world.load('src/skin/scene/pen.ts'),
        stage: await world.load('src/skin/dream/stage.ts'),
        heads,
      };
      return { paths: pathsOf(game), lost: [], heads };
    })();
    read.set(world, made);
  }
  return made;
}

/** Where the cameras of one scene stand, at one detail level: every place of every path, in the world's metres. */
export async function cameraPlaces(world: World, root: string, scene: SceneName, detail: Detail): Promise<{ places: V[]; lost: string[] }> {
  const { paths, lost } = await cameraPaths(world, root);
  return { places: paths.filter((p) => p.scene === scene && p.details.includes(detail)).flatMap((p) => p.places.map((place) => place.view.position)), lost };
}

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const lines: string[] = [], failures: Failure[] = [];
  const { paths, lost, heads } = await cameraPaths(world, options.root);
  if (lost.length) {
    return {
      ok: false, summary: `NOT RUN: tools/scenes/lens.ts copies how the game moves its cameras, and ${plural(lost.length, 'line')} of that ${lost.length === 1 ? 'is' : 'are'} gone or changed`,
      lines: ['tools/scenes/lens.ts copies how the game moves its cameras from these lines, which are gone or changed:', ...lost.map((l) => `    ${l}`), 'Read the component again, bring the paths in lens.ts (`pathsOf`) up to date with it, and pin the new lines (`PINS`).'],
      measured: {}, failures: [], data: { lost },
    };
  }
  const show = typeof options.flags.show === 'string' ? options.flags.show : null;

  type Leaves = Record<string, Record<string, Record<string, Record<string, number>>>>;
  const measured = { short: {} as Leaves, swings: { table: {} } as Leaves, inside: {} as Record<string, Record<string, number>>, excused: {} as Record<string, Record<string, number>> };
  const data: { scenes: unknown[]; paths: number; places: number; heads: Game['heads'] } = { scenes: [], paths: 0, places: 0, heads };
  const total = { paths: 0, places: 0, failing: 0, inside: 0, excused: 0, swings: 0, swingsFailing: 0 };
  const notJudged = new Set<string>();

  for (const scene of world.scenes.filter((s) => options.scenes.includes(s.name) && (needs.scenes as string[]).includes(s.name))) {
    const t0 = performance.now();
    const mine = paths.filter((p) => p.scene === scene.name && p.details.includes(scene.detail));
    const { bodies, unjudged } = bodiesOf(scene);
    for (const name of unjudged) notJudged.add(`${scene.name}: the thing "${name}" is scaled unevenly or holds a part turned off its axes, and is not judged`);
    // The tour's shots are far apart, so each is its own group; every other scene's cameras stand close together.
    const groups = scene.name === 'farm' ? mine.map((p) => [p]) : [mine];
    const found = groups.flatMap((g) => judge(bodies, g, (p) => show !== null && `${scene.name} ${p.name}`.includes(show)));
    const places = found.reduce((n, f) => n + f.path.places.length, 0);

    lines.push('', `### ${scene.name} (${scene.detail}): ${plural(found.length, 'camera path')}, ${plural(places, 'place')} judged against ${count(scene.voxels)} voxels`);
    const sceneData: unknown[] = [];
    let insidePaths = 0, excusedPaths = 0, clearShots = 0;
    const leaves: Record<string, Record<string, number>> = {}, swingLeaves: Record<string, Record<string, number>> = {};
    for (const device of DEVICES) if (mine.some((p) => p.device === device)) leaves[device] = {};
    for (const f of found) {
      const { path } = f;
      const name = `${scene.name}, ${path.name}`;
      const worst: Seen | null = f.short ?? (f.insideAt ? { distance: 0, place: f.insideAt.place, hit: f.insideAt.hit } : null);
      const source = worst ? `${name}: ${sourceOf(worst.hit)}` : name;
      const entry: Exemption | undefined = worst ? options.exempt.find((e) => e.scene === scene.name && source.includes(e.match)) : undefined;
      const room = f.room ? `${f2(f.room.distance)} m` : `over ${f2(LOOK)} m`;
      const behind = f.around && (!f.short || f.around.distance < f.short.distance - 1e-6)
        ? `(out of view, not judged: ${f.around.distance.toFixed(3)} m to ${f.around.hit.part.mount} at ${whereOf(f.around.hit)}, ${f.around.place.note})` : '';
      if (path.swings) {
        // A table's swings: what is counted is how many of them fail.
        const failing = [...f.legs].sort((a, b) => a[1].worst.distance - b[1].worst.distance || (a[0] < b[0] ? -1 : 1));
        ((swingLeaves[path.device] ??= {})[path.key]) = entry ? 0 : failing.length;
        total.swings += f.legCount; total.swingsFailing += failing.length;
        if (failing.length) {
          total.failing++;
          if (entry) excusedPaths++;
          if (f.inside) insidePaths++;
          const through = failing.filter(([, l]) => l.inside).length;
          // One line for a table's swings; --show lists each with where it is worst.
          const named = failing.slice(0, 4).map(([leg, l]) => `${leg} (${l.worst.distance.toFixed(2)} m${l.inside ? `, through ${l.worst.hit.part.mount}` : ` to ${l.worst.hit.part.mount}`})`).join('; ');
          lines.push(`  FAILS  ${path.name}: ${count(failing.length)} of ${count(f.legCount)} come within ${f2(NEED)} m of something in view${through ? `, ${count(through)} of them THROUGH A VOXEL` : ''}: ${named}${failing.length > 4 ? `; and ${count(failing.length - 4)} more` : ''}${entry ? `   [excused by EXEMPT.json: ${entry.match}]` : ''}`);
          if (f.log) for (const [leg, l] of failing) lines.push(`         ${leg}: ${l.worst.distance.toFixed(3)} m${l.inside ? ', through a voxel' : ''}, worst ${l.worst.place.note.replace(/ of the way.*/, ' of the way')}, lens at (${l.worst.place.view.position.map(f2).join(', ')}): ${sourceOf(l.worst.hit)}`);
          failures.push({
            scene: scene.name, detail: scene.detail,
            what: `${count(failing.length)} of the ${count(f.legCount)} swings of "${path.name}" come within ${f2(NEED)} m of something in view${through ? `, ${count(through)} of them through a voxel` : ''}: ${failing.map(([leg, l]) => `${leg} (${l.worst.distance.toFixed(2)} m${l.inside ? ', through' : ''})`).join('; ')}`,
            where: `worst on ${failing[0][0]}: lens (${failing[0][1].worst.place.view.position.map(f2).join(', ')}), voxel ${whereOf(failing[0][1].worst.hit)}`,
            source,
            ...(entry ? { excusedBy: entry.match } : {}),
          });
        } else if (f.log) lines.push(`  clear  ${path.name}: none of ${count(f.legCount)} comes within ${f2(NEED)} m of anything in view`);
        if (f.log) lines.push(...f.log);
        sceneData.push({ path: path.name, device: path.device, key: path.key, places: path.places.length, swings: f.legCount, failing: failing.map(([leg, l]) => ({ swing: leg, metres: +l.worst.distance.toFixed(3), through: l.inside, nearest: l.worst.hit.part.mount })), excusedBy: entry?.match ?? null });
        continue;
      }
      leaves[path.device][path.key] ??= 0;
      if (worst) {
        total.failing++;
        const mm = shortOf(worst.distance);
        if (entry) excusedPaths++; else leaves[path.device][path.key] += mm;
        if (f.inside) insidePaths++;
        lines.push(`  FAILS  ${path.name}: ${worst.distance.toFixed(3)} m in view, ${count(mm)} mm short of ${f2(NEED)} m${f.inside ? `; THE LENS IS INSIDE A VOXEL at ${plural(f.inside, 'place')}` : ''}${entry ? `   [excused by EXEMPT.json: ${entry.match}]` : ''}`);
        lines.push(`         worst ${worst.place.note}, lens at (${worst.place.view.position.map(f2).join(', ')}); the voxel is at ${whereOf(worst.hit)}: ${sourceOf(worst.hit)}`);
        if (behind) lines.push(`         ${behind}`);
        failures.push({
          scene: scene.name, detail: scene.detail,
          what: f.inside
            ? `the lens is inside a voxel at ${plural(f.inside, 'place')} of the path "${path.name}"`
            : `a voxel in view ${worst.distance.toFixed(3)} m from the lens on the path "${path.name}" (${count(mm)} mm short of ${f2(NEED)} m), worst ${worst.place.note}`,
          where: `lens (${worst.place.view.position.map(f2).join(', ')}), voxel ${whereOf(worst.hit)}`,
          source,
          ...(entry ? { excusedBy: entry.match } : {}),
        });
      } else if (scene.name !== 'table' || f.log) {
        // The table has hundreds of paths: only the failures and what --show asks for get a line of their own.
        lines.push(`  clear  ${path.name}: nothing in view within ${f2(NEED)} m anywhere on it; at its stops the nearest in view is ${room}${f.room ? ` (${f.room.hit.part.mount})` : ''}${behind ? `   ${behind}` : ''}`);
      }
      if (f.log) lines.push(...f.log);
      if (scene.name === 'table' && !worst) { clearShots++; continue; } // a hundred clear shots are one number in the data
      sceneData.push({
        path: path.name, device: path.device, key: path.key, places: path.places.length,
        inView: f.short ? { metres: +f.short.distance.toFixed(4), at: f.short.place.note, lens: f.short.place.view.position, voxel: f.short.hit.at.map((x) => +x.toFixed(3)), source: sourceOf(f.short.hit) } : null,
        atStops: f.room ? +f.room.distance.toFixed(4) : null,
        allRound: f.around ? { metres: +f.around.distance.toFixed(4), at: f.around.place.note, source: sourceOf(f.around.hit) } : null,
        inside: f.inside, excusedBy: entry?.match ?? null,
      });
    }
    if (scene.name === 'table') {
      const shots = found.filter((f) => !f.path.swings), clear = shots.filter((f) => !f.short && !f.inside);
      const rooms = clear.map((f) => f.room?.distance ?? Infinity), nearest = rooms.length ? Math.min(...rooms) : Infinity;
      lines.push(`  clear  ${count(clear.length)} of ${plural(shots.length, 'shot')} (the wide shot and every seat's close shot over tables of 2 to 10, for a computer and a phone); the nearest thing in view at any of their stops is ${nearest === Infinity ? `over ${f2(LOOK)} m` : `${f2(nearest)} m`} away`);
      measured.swings.table[scene.detail] = swingLeaves;
    }
    // Scenery that scrolls sideways: how near it could come whatever it has scrolled to.
    if (scene.name === 'dream') {
      const rest = atRest(scene);
      for (const part of rest.turned) notJudged.add(`dream: "${part.mount}" rests turned off the axes and is left out of the sideways measure`);
      for (const f of found) {
        let least = Infinity;
        const p = f.path.places[0].view.position;
        for (const { boxes: B } of rest.laid) {
          for (let i = 0; i < B.length; i += 6) {
            const d = Math.hypot(Math.max(B[i + 1] - p[1], 0, p[1] - B[i + 4]), Math.max(B[i + 2] - p[2], 0, p[2] - B[i + 5]));
            if (d < least) least = d;
          }
        }
        lines.push(`         ${f.path.name}: the dream's scenery scrolls sideways, and with the sideways axis left out nothing comes within ${f2(least)} m of the lens${least < NEED ? ': UNDER THE RULE at some scroll' : ''}`);
        if (least < NEED) notJudged.add(`dream, ${f.path.name}: something could scroll to within ${f2(least)} m of the lens; the stage judges the dream only where it rests`);
      }
    }
    ((measured.short[scene.name] ??= {})[scene.detail]) = leaves;
    (measured.inside[scene.name] ??= {})[scene.detail] = insidePaths;
    (measured.excused[scene.name] ??= {})[scene.detail] = excusedPaths;
    total.paths += found.length; total.places += places; total.inside += insidePaths; total.excused += excusedPaths;
    data.scenes.push({ scene: scene.name, detail: scene.detail, paths: sceneData, ...(scene.name === 'table' ? { clearShots } : {}), notJudged: unjudged });
    options.log(`${scene.name} (${scene.detail}): ${count(places)} places in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  data.paths = total.paths; data.places = total.places;
  if (!Object.keys(measured.swings.table).length) delete (measured as { swings?: unknown }).swings; // a run that left the table out

  lines.push('', 'Not judged by this stage:');
  lines.push('  animals, the bomb and every other model a mesh sets down: the scene checker lays out scenery, and the models are judged alone');
  lines.push('  things that move (the cat, the letter board, the windmill\'s blades, the door leaves) anywhere but where they rest');
  for (const n of notJudged) lines.push(`  ${n}`);
  for (const e of options.exempt) lines.push('', `EXEMPT.json, ${e.scene}, match ${e.match}${e.status === 'pending' ? ' (PENDING: Brian has not answered)' : ''}`);

  const summary = `${plural(total.failing, 'camera path')} of ${count(total.paths)} ${total.failing === 1 ? 'has' : 'have'} a voxel in view within ${f2(NEED)} m of the lens${total.swings ? `, ${count(total.swingsFailing)} of ${count(total.swings)} swings of the table's camera among them` : ''} (${count(total.places)} places judged over ${world.details.join(' and ')}); the lens is inside a voxel on ${count(total.inside)}; ${count(total.excused)} excused by EXEMPT.json`;
  lines.push('', total.failing
    ? `${plural(total.failing, 'camera path')} ${total.failing === 1 ? 'comes' : 'come'} too near something. Every one is named above with the code that built what it comes near.`
    : `Nothing in view within ${f2(NEED)} m of any lens.`);
  return { ok: true, summary, lines, measured, failures, data };
}
