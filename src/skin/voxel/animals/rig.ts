import { Color } from 'three';
import type { BufferGeometry } from 'three';
import type { Character } from '../../avatars/catalog';
import { buildGeometry, triangles } from '../mesher';
import type { VoxelMap } from '../mesher';
import { lin } from '../palette';
import { box, ellipsoid, Grid, hash3 } from '../primitives';
import type { Paint, RGB, V3 } from '../primitives';
import { CHAR } from '../sheep';
import type { Brows, Lids, Mouth, Part, SheepModel } from '../sheep';

/**
 * The shared animal rig (V5 Part 4.1): one interface every species builds to, so `Animal.tsx` animates them all with
 * the sheep's state machine. It extends `SheepModel` (so `wools` are the coats and `sheared` is the bare body) with a
 * neck, the species' signature parts, an optional worn item and the stats the tests check.
 */
export type Species = Character['animal'];
export type Lean = 'head' | 'body';
export interface SigPart extends Part { name: string; where: Lean; anim?: 'snout' | 'wingL' | 'wingR' | 'beard' | 'comb'; cells: VoxelMap }
export interface AnimalModel extends SheepModel {
  species: Species;
  /** Drawn at every level (the coats are garments over it); false only for the sheep, whose fleece is the body. */
  bodyAlways: boolean;
  neck?: Part;
  signature: SigPart[];
  worn?: Part;
  /** The model's bounding height and length at scale 1, and how it is drawn at the table. */
  height: number;
  length: number;
  drawScale: number;
  stats: { voxels: number; triangles: number; colours: number; parts: number };
  /** The cells of every part at level 2 in model space, for the connectivity test. */
  cells: Record<string, VoxelMap>;
  coatCells: Record<0 | 1 | 2 | 3 | 4, VoxelMap>;
}

export const S = CHAR;
export const DARKEST = '#1C1919';

/** A part whose grid cells are kept (every part the species builders make). */
export type CPart = Part & { cells: VoxelMap };

/** A part from a grid, its geometry built about `pivot`; the grid's cells are kept for the tests. */
export function part(g: Grid, pivot: V3): CPart {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count, cells: g.map };
}

// ---------- colour (Part 4.10): three tones per material, saturation caps, no pure black ----------
const c = new Color();
const hsl = { h: 0, s: 0, l: 0 };
function clampHex(hex: string, satCap: number): string {
  c.set(hex).getHSL(hsl);
  const floor = new Color(DARKEST).getHSL({ h: 0, s: 0, l: 0 }).l;
  c.setHSL(hsl.h, Math.min(hsl.s, satCap), Math.max(hsl.l, floor));
  return `#${c.getHexString()}`;
}
/** [light, base, dark] from a base colour: lightened 8%, as is, darkened 20%; saturation capped; nothing under #1C1919. */
export function tones(hex: string, satCap = 0.55): [string, string, string] {
  c.set(hex).getHSL(hsl);
  const l = (dl: number) => { c.setHSL(hsl.h, Math.min(hsl.s, satCap), Math.max(0, Math.min(1, hsl.l + dl))); return `#${c.getHexString()}`; };
  return [clampHex(l(0.08), satCap), clampHex(l(0), satCap), clampHex(l(-0.2), satCap)];
}
export type Tones = [string, string, string];
/** A paint in a material's base tone, with the light tone on top faces and the dark tone underneath, by shape not noise. */
export const flat = (t: Tones, which: 0 | 1 | 2 = 1): Paint => () => lin(t[which]);
/** Base everywhere; the light tone on the upper third of a shape and the dark on the lower fifth (a soft gradient by height). */
export function shaded(t: Tones, yTop: number, yBottom: number): Paint {
  return (_x, y) => { const k = (y - yBottom) / Math.max(1, yTop - yBottom); return lin(k > 0.72 ? t[0] : k < 0.2 ? t[2] : t[1]); };
}

// ---------- shapes ----------
/** A chamfered box blended with an ellipsoid at each end along z: a smooth barrel (Part 4.5). */
export function barrel(g: Grid, centre: V3, size: V3, chamfer: number, paint: Paint, rounder = 1) {
  const [w, h, l] = size;
  box(g, [centre[0] - w / 2, centre[1] - h / 2, centre[2] - l / 2 + (w / 4) * rounder], [centre[0] + w / 2, centre[1] + h / 2, centre[2] + l / 2 - (w / 4) * rounder], paint, chamfer);
  ellipsoid(g, [centre[0], centre[1], centre[2] + l / 2 - (w / 4) * rounder], [w / 2, h / 2, (w / 4) * rounder + S], paint);
  ellipsoid(g, [centre[0], centre[1], centre[2] - l / 2 + (w / 4) * rounder], [w / 2, h / 2, (w / 4) * rounder + S], paint);
}

/**
 * A wedge head (Part 4.4): slices along z from the back to the front, the width narrowing linearly, the height
 * constant, each slice's corners knocked off. `back` is the back-bottom-centre.
 */
export function wedge(g: Grid, back: V3, length: number, wBack: number, wFront: number, height: number, paint: Paint, bump = 0) {
  const n = Math.round(length / S), h = Math.round(height / S);
  const bz = Math.round(back[2] / S), by = Math.round(back[1] / S);
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1);
    let w = Math.round((wBack + (wFront - wBack) * t) / S);
    if (w % 2 === 0) w += 1; // odd widths: symmetric about the centre column
    const half = Math.floor(w / 2);
    const lift = bump && t > 0.6 ? 1 : 0; // a Roman bump: the top line rises a voxel at the front third
    for (let x = -half; x <= half; x++) for (let y = 0; y < h + lift; y++) {
      const corner = (x === -half || x === half) && (y === 0 || y === h + lift - 1);
      if (corner) continue;
      const c = paint(x, by + y, bz + k);
      if (c) g.set(x, by + y, bz + k, c);
    }
  }
}

/** A neck or limb as square sections stepped along a segment from `from` to `to`, the section shrinking from sFrom to sTo. */
export function segment(g: Grid, from: V3, to: V3, sFrom: number, sTo: number, paint: Paint) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const n = Math.max(2, Math.ceil(d / S));
  for (let i = 0; i <= n; i++) {
    const t = i / n, sec = sFrom + (sTo - sFrom) * t;
    const c: V3 = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
    box(g, [c[0] - sec / 2, c[1] - sec / 2, c[2] - sec / 2], [c[0] + sec / 2, c[1] + sec / 2, c[2] + sec / 2], paint, 1);
  }
}

/** A marking: voxels of `g` inside the mask ellipsoids take `colour`; the one-voxel edge takes `edge` (the mid tone). */
export function mask(g: Grid, blobs: { c: V3; r: V3 }[], colour: RGB, edge: RGB) {
  const inside = (x: number, y: number, z: number, grow: number) => blobs.some(({ c: cc, r }) => ((x + 0.5) * S - cc[0]) ** 2 / (r[0] + grow) ** 2 + ((y + 0.5) * S - cc[1]) ** 2 / (r[1] + grow) ** 2 + ((z + 0.5) * S - cc[2]) ** 2 / (r[2] + grow) ** 2 <= 1);
  for (const v of g.map.values()) {
    if (inside(v.x, v.y, v.z, 0)) g.set(v.x, v.y, v.z, colour);
    else if (inside(v.x, v.y, v.z, S)) g.set(v.x, v.y, v.z, edge);
  }
}

/** A leg: a square column with hooves (the bottom 2 voxels, a groove at the front), an optional knee ring and sock. */
export function leg(g: Grid, cx: number, cz: number, w: number, h: number, body: Tones, hoof: Tones, opts: { knee?: boolean; sock?: string; splay?: number; toes?: boolean } = {}) {
  const half = Math.floor(w / 2);
  const x0 = Math.round(cx / S) - half, z0 = Math.round(cz / S) - half;
  for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    const outer = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
    if (y < 2) { if (y === 0 && z === z0 + w - 1 && x === x0 + half) continue; g.set(x, y, z, lin(hoof[y === 0 ? 2 : 1])); continue; }
    if (opts.sock && y < 5) { g.set(x, y, z, lin(opts.sock)); continue; }
    if (opts.knee && y === 4 && outer) { g.set(x, y, z, lin(body[0])); continue; }
    g.set(x, y, z, lin(outer && z === z0 ? body[2] : body[1]));
  }
  // Three toes forward and one back, centred on the leg whatever its width.
  if (opts.toes) for (let x = x0 - 1; x <= x0 + w; x++) for (let k = 1; k <= 3; k++) if (k === 1 || x === x0 - 1 || x === x0 + w || x === x0 + half) g.set(x, 0, z0 + w - 1 + k, lin(hoof[1]));
  if (opts.toes) for (let x = x0; x < x0 + w; x++) for (let k = 1; k <= 2; k++) g.set(x, 0, z0 - k, lin(hoof[1]));
}

// ---------- the eye standard (Part 4.3) ----------
export const EYE_WHITE_HEX = '#F4F1EA';
export type EyeVariant = 5 | 4 | 'goat';
/** Where an eye's cell (column across the plate, row from the top, `out` voxels proud of the face) sits in the grid. */
export type EyePlace = (col: number, row: number, out: number) => V3;
export const eyeSize = (v: EyeVariant) => (v === 4 ? 4 : 5);

/** An eye on a flat face looking +z: `origin` is the plate's bottom-left cell, one voxel proud of the face. */
export function frontEye(origin: V3, n: number): EyePlace {
  return (col, row, out) => [origin[0] + col, origin[1] + (n - 1 - row), origin[2] + out - 1];
}
/**
 * An eye on a long head's side at the front third (Part 4.3): its front two columns wrap onto the front face, the
 * rest run back along the side, each column against the head's own width at that slice, so the eye shows from the
 * three-quarter camera. `sign` is the side (+1 the animal's right, which the camera's left sees as... both show).
 */
export function wrapEye(head: Grid, sign: 1 | -1, rowY: number, zf: number, n: number): EyePlace {
  // Each row follows the head's own outline at that height: the front-most slice there, and the side's width per slice.
  const frontAt = (y: number) => { let best = -99; for (const v of head.map.values()) if (v.y === y && v.z > best) best = v.z; return best === -99 ? zf : best; };
  const sideRow = (y: number, z: number) => { let best = 0; for (const v of head.map.values()) if (v.y === y && v.z === z && v.x * sign > best) best = v.x * sign; return best * sign; };
  return (col, row, out) => {
    const y = rowY + (n - 1 - row);
    const zfy = frontAt(y);
    if (col < 2) return [sideRow(y, zfy) - sign * col, y, zfy + out];
    const z = zfy - (col - 1);
    return [sideRow(y, z) + sign * out, y, z];
  };
}

/** The plate: rounded corners, whites round an iris with one catchlight at the upper-left as the camera sees it. */
export function eyePlate(g: Grid, place: EyePlace, variant: EyeVariant, iris: string) {
  const n = eyeSize(variant);
  const white = lin(EYE_WHITE_HEX), ink = lin(clampHex(iris, 1)), light = lin('#FFFFFF');
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const corner = n === 5 ? ((r === 0 || r === 4) && (col === 0 || col === 4)) : ((r === 0 || r === 3) && (col === 0 || col === 3));
    if (corner) continue;
    let inIris: boolean;
    if (variant === 'goat') inIris = (r === 2 || r === 3) && col >= 1 && col <= 3;
    else if (variant === 4) inIris = r >= 1 && r <= 2 && col >= 1 && col <= 2;
    else inIris = r >= 1 && r <= 3 && col >= 1 && col <= 3;
    const catch_ = variant === 4 ? (r === 1 && col === 1) : variant === 'goat' ? (r === 2 && col === 1) : (r === 1 && col === 1);
    const [x, y, z] = place(col, r, 1);
    g.set(x, y, z, inIris ? (catch_ ? light : ink) : white);
  }
}

/** The lids (closed line at the middle row, an arc for happy) and the brows (a 4-bar one row above), over the eyes. */
export function lidsAndBrows(eyes: { place: EyePlace; n: number }[], face: Tones, pivot: V3): { lids: Record<Lids, Part>; brows: Record<Brows, Part> } {
  const lids = {} as Record<Lids, Part>;
  for (const kind of ['closed', 'arc'] as Lids[]) {
    const g = new Grid(S);
    for (const e of eyes) for (let col = 0; col < e.n; col++) {
      if (kind === 'closed') { const [x, y, z] = e.place(col, Math.floor(e.n / 2), 2); g.set(x, y, z, lin(face[1])); }
      else {
        const r = col === 0 || col === e.n - 1 ? 2 : 3;
        const [x, y, z] = e.place(col, r, 2); g.set(x, y, z, lin(face[1]));
        if (col > 0 && col < e.n - 1) { const [x2, y2, z2] = e.place(col, r - 1, 2); g.set(x2, y2, z2, lin(face[1])); }
      }
    }
    lids[kind] = part(g, pivot);
  }
  const brows = {} as Record<Brows, Part>;
  const tilt: Record<Brows, number[] | null> = { neutral: null, up: [1, 1, 1, 1], worried: [0, 0, 1, 1] };
  for (const kind of ['neutral', 'up', 'worried'] as Brows[]) {
    const g = new Grid(S);
    const rows = tilt[kind];
    if (rows) for (const e of eyes) for (let col = 0; col < 4; col++) { const [x, y, z] = e.place(col, -1 - rows[col], 2); g.set(x, y, z, lin(face[2])); }
    brows[kind] = part(g, pivot);
  }
  return { lids, brows };
}

/** Mouths on a face: a line of `width` at `row` (the bottom), a smile curling up at the ends, an `o`, and chew frames. */
export function mouths(origin: V3, width: number, facing: 'z' | 'x', tone: string, pivot: V3): Record<Mouth, Part> {
  const put = (g: Grid, col: number, dy: number, colour: RGB) => {
    if (facing === 'z') g.set(origin[0] + col, origin[1] + dy, origin[2] + 1, colour);
    else g.set(origin[0] + 1, origin[1] + dy, origin[2] - col, colour);
  };
  const ink = lin(tone);
  const specs: Record<Mouth, [number, number][]> = {
    flat: Array.from({ length: width }, (_, i) => [i, 0]),
    smile: Array.from({ length: width }, (_, i) => [i, i === 0 || i === width - 1 ? 1 : 0]),
    o: [[Math.floor(width / 2) - 1, 0], [Math.floor(width / 2), 0], [Math.floor(width / 2) - 1, -1], [Math.floor(width / 2), -1], [Math.floor(width / 2) - 1, 1], [Math.floor(width / 2), 1]],
    chewL: Array.from({ length: width - 1 }, (_, i) => [i, 0]),
    chewDown: Array.from({ length: width }, (_, i) => [i, -1]),
    chewR: Array.from({ length: width - 1 }, (_, i) => [i + 1, 0]),
  };
  const out = {} as Record<Mouth, Part>;
  for (const kind of Object.keys(specs) as Mouth[]) {
    const g = new Grid(S);
    for (const [col, dy] of specs[kind]) put(g, col, dy, ink);
    out[kind] = part(g, pivot);
  }
  return out;
}

// ---------- frost, breath, collar ----------
/** Frost on a coat's upper faces: a snow voxel over every third exposed top. */
export function frostOf(coat: VoxelMap, pivot: V3): Part {
  const g = new Grid(S);
  const has = (x: number, y: number, z: number) => coat.has(`${x},${y},${z}`);
  for (const v of coat.values()) if (!has(v.x, v.y + 1, v.z) && hash3(v.x, v.y, v.z, 57) < 0.4) g.set(v.x, v.y + 1, v.z, lin('#D9EEF8'));
  return part(g, pivot);
}
export function breathAt(nose: V3): Part {
  const g = new Grid(S);
  const n = nose.map((v) => Math.round(v / S));
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) g.set(n[0] + x, n[1] + y, n[2] + z, lin('#FBFBF8'));
  return part(g, nose);
}
/** A collar: a ring one voxel thick hugging the neck at `centre`, radii rx (across) and ry (tall), in `colour`. */
export function collarRing(centre: V3, rx: number, ry: number, colour: string): CPart {
  const g = new Grid(S);
  for (let k = 0; k < 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    g.set(Math.round((centre[0] + Math.cos(a) * rx) / S), Math.round((centre[1] + Math.sin(a) * ry) / S), Math.round(centre[2] / S), lin(colour));
  }
  return part(g, [0, 0, 0]);
}

/** Removes the voxels no face of which can ever show (all six neighbours present): the budget counts voxels, the mesher does not. */
export function hollow(g: Grid) {
  // A one-voxel shell, then a repair: wherever two shell voxels meet only along an edge, the interior voxel between
  // them is put back, so the shell stays 6-connected and the budget stays low.
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
  const deep = (x: number, y: number, z: number) => DIRS.every(([dx, dy, dz]) => g.has(x + dx, y + dy, z + dz));
  const removed = new Map<string, RGB>();
  for (const v of g.map.values()) if (deep(v.x, v.y, v.z)) removed.set(`${v.x},${v.y},${v.z}`, v.c);
  for (const k of removed.keys()) { const [x, y, z] = k.split(',').map(Number); g.del(x, y, z); }
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const;
  for (const v of [...g.map.values()]) {
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of [1, -1]) for (const sb of [1, -1]) {
      const d: [number, number, number] = [0, 0, 0];
      d[a] = sa; d[b] = sb;
      if (!g.has(v.x + d[0], v.y + d[1], v.z + d[2])) continue;
      const p: [number, number, number] = [v.x, v.y, v.z]; p[a] += sa;
      const q: [number, number, number] = [v.x, v.y, v.z]; q[b] += sb;
      if (g.has(...p) || g.has(...q)) continue;
      const kp = p.join(','), kq = q.join(',');
      if (removed.has(kp)) g.set(p[0], p[1], p[2], removed.get(kp)!);
      else if (removed.has(kq)) g.set(q[0], q[1], q[2], removed.get(kq)!);
    }
    // Corner-to-corner neighbours: put back one of the six voxels between them if any was removed.
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      if (!g.has(v.x + sx, v.y + sy, v.z + sz)) continue;
      const between: [number, number, number][] = [[v.x + sx, v.y, v.z], [v.x, v.y + sy, v.z], [v.x, v.y, v.z + sz], [v.x + sx, v.y + sy, v.z], [v.x + sx, v.y, v.z + sz], [v.x, v.y + sy, v.z + sz]];
      if (between.some(([x, y, z]) => g.has(x, y, z))) continue;
      const back = between.find(([x, y, z]) => removed.has(`${x},${y},${z}`));
      if (back) g.set(back[0], back[1], back[2], removed.get(back.join(','))!);
    }
  }
  void axes;
}

/** The widest x of a grid's cells inside a z range: where a side-face eye must sit to touch the head. */
export function sideAt(g: Grid, z0: number, z1: number, sign: 1 | -1): number {
  let best = 0;
  for (const v of g.map.values()) if (v.z >= z0 && v.z <= z1 && v.x * sign > best) best = v.x * sign;
  return best * sign;
}

/** The empty part (a slot a species does not use). */
export function none(pivot: V3 = [0, 0, 0]): CPart { return part(new Grid(S), pivot); }

/** The cells of named parts, for the connectivity test. */
export function cellsOf(named: Record<string, CPart | CPart[]>): Record<string, VoxelMap> {
  const out: Record<string, VoxelMap> = {};
  for (const [k, v] of Object.entries(named)) { if (Array.isArray(v)) v.forEach((p, i) => { out[`${k}${i}`] = p.cells; }); else out[k] = v.cells; }
  return out;
}

/** Stats for the budgets: voxels before culling, triangles after meshing, distinct colours and parts, at level 2. */
export function statsOf(parts: (Part | undefined)[], extra: VoxelMap[]): AnimalModel['stats'] {
  const cols = new Set<string>();
  let voxels = 0, tris = 0, count = 0;
  for (const p of parts) {
    if (!p) continue;
    count++;
    voxels += p.voxels;
    tris += triangles(p.geo);
    const cells = (p as Part & { cells?: VoxelMap }).cells;
    if (cells) for (const v of cells.values()) cols.add(v.c.map((x) => x.toFixed(3)).join(','));
  }
  for (const m of extra) for (const v of m.values()) cols.add(v.c.map((x) => x.toFixed(3)).join(','));
  return { voxels, triangles: tris, colours: cols.size, parts: count };
}

export type { BufferGeometry, Part, SheepModel };
