import { Color } from 'three';
import type { BufferGeometry } from 'three';
import type { Character } from '../../avatars/catalog';
import { buildGeometry, triangles } from '../mesher';
import type { VoxelMap } from '../mesher';
import { lin } from '../palette';
import { box, ellipsoid, Grid, hash3 } from '../primitives';
import type { Paint, RGB, V3 } from '../primitives';
import type { Brows, Lids, Mouth, Part, SheepModel } from '../sheep';
import type { GarmentCells } from './garments';

/**
 * The shared animal rig (V5 Part 4.1): one interface every species builds to, so `Animal.tsx` animates them all with
 * the sheep's state machine. It extends `SheepModel` (so `wools` are the coats and `sheared` is the bare body) with a
 * neck, the species' signature parts, an optional worn item and the stats the tests check.
 */
export type Species = Character['animal'];
export type Lean = 'head' | 'body';
/** A part's motion tag (V5.1 Part 6.1): the signature parts', plus `bell` (swings about its top) and `tailFan` (spreads by x-scale). */
export type AnimTag = 'snout' | 'wingL' | 'wingR' | 'beard' | 'comb' | 'bell' | 'tailFan';
export interface SigPart extends Part { name: string; where: Lean; anim?: AnimTag; cells: VoxelMap }
export interface AnimalModel extends SheepModel {
  species: Species;
  /** Drawn at every level (the coats are garments over it); false only for the sheep, whose fleece is the body. */
  bodyAlways: boolean;
  neck?: Part;
  /** Where the neck leaves the chest: the `neckX` channel pitches the neck and the head about it (V5.1 Part 4.6). */
  neckBase?: V3;
  signature: SigPart[];
  /** The tail's motion tag: the chicken's fan spreads (`tailFan`); every other tail wags. */
  tailAnim?: AnimTag;
  /** The head's pitch at rest, radians down (V5.1 Part 4.3: the pig 8 degrees, the cow 10). */
  headPitch?: number;
  /** The level-2 garment's pieces, for the garment test (V5.1 Part 7.5). */
  garment?: GarmentCells;
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

/** The character grid, 0.04 m (the sheep's CHAR); kept here so the sheep can build on the rig without an import cycle. */
export const S = 0.04;
export const DARKEST = '#1C1919';

/** A part whose grid cells are kept (every part the species builders make). */
export type CPart = Part & { cells: VoxelMap };

/** A part from a grid, its geometry built about `pivot`; the grid's cells are kept for the tests. */
export function part(g: Grid, pivot: V3): CPart {
  const geo = buildGeometry(withCavity(g.map), g.size);
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
export function barrel(g: Grid, centre: V3, size: V3, chamfer: number, paint: Paint, rounder: number | [number, number] = 1) {
  const [w, h, l] = size;
  // One rounder for both ends, or [chest, rump] (V5.1: the cow's chest 0.8, its rump 0.5).
  const [rf, rb] = typeof rounder === 'number' ? [rounder, rounder] : rounder;
  box(g, [centre[0] - w / 2, centre[1] - h / 2, centre[2] - l / 2 + (w / 4) * rb], [centre[0] + w / 2, centre[1] + h / 2, centre[2] + l / 2 - (w / 4) * rf], paint, chamfer);
  ellipsoid(g, [centre[0], centre[1], centre[2] + l / 2 - (w / 4) * rf], [w / 2, h / 2, (w / 4) * rf + S], paint);
  ellipsoid(g, [centre[0], centre[1], centre[2] - l / 2 + (w / 4) * rb], [w / 2, h / 2, (w / 4) * rb + S], paint);
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
export function leg(g: Grid, cx: number, cz: number, w: number, h: number, body: Tones, hoof: Tones, opts: { knee?: boolean; sock?: string; splay?: number; toes?: boolean; oneTone?: boolean } = {}) {
  const half = Math.floor(w / 2);
  const x0 = Math.round(cx / S) - half, z0 = Math.round(cz / S) - half;
  for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) {
    const outer = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + w - 1;
    if (y < 2) { if (y === 0 && z === z0 + w - 1 && x === x0 + half) continue; g.set(x, y, z, lin(hoof[y === 0 ? 2 : 1])); continue; }
    if (opts.sock && y < 5) { g.set(x, y, z, lin(opts.sock)); continue; }
    if (opts.knee && y === 4 && outer) { g.set(x, y, z, lin(body[0])); continue; }
    // The back face a shade darker, unless the sheet asks one tone (V5.1: the cow's legs, no grey fronts).
    g.set(x, y, z, lin(outer && z === z0 && !opts.oneTone ? body[2] : body[1]));
  }
  // Three toes forward and one back, centred on the leg whatever its width.
  if (opts.toes) for (let x = x0 - 1; x <= x0 + w; x++) for (let k = 1; k <= 3; k++) if (k === 1 || x === x0 - 1 || x === x0 + w || x === x0 + half) g.set(x, 0, z0 + w - 1 + k, lin(hoof[1]));
  if (opts.toes) for (let x = x0; x < x0 + w; x++) for (let k = 1; k <= 2; k++) g.set(x, 0, z0 - k, lin(hoof[1]));
}

// ---------- the eye standard (Part 4.3) ----------
export const EYE_WHITE_HEX = '#F4F1EA';
export type EyeVariant = 5 | 4 | 'goat' | 2;
/** Where an eye's cell (column across the plate, row from the top, `out` voxels proud of the face) sits in the grid. */
export type EyePlace = (col: number, row: number, out: number) => V3;
export const eyeSize = (v: EyeVariant) => (v === 4 ? 4 : v === 2 ? 2 : 5);

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
export function eyePlate(g: Grid, place: EyePlace, variant: EyeVariant, iris: string, glint = true, rows = 2, glintCol = 0, cols = 2, oval = false, glintColour = '#FFFFFF') {
  const n = eyeSize(variant);
  const white = lin(EYE_WHITE_HEX), ink = lin(clampHex(iris, 1)), light = lin(glintColour);
  if (n === 2) {
    // The small eye (Brian, 2026-11-07): 2 x 2, all dark, one glint at the top front. No whites, nothing to goggle. On a
    // pale face the glint would melt into a 2 x 2 and leave a dark L, so a pale face gets the eye plain dark, or 3 tall
    // (the cow), where five dark voxels round the glint still read as an eye.
    // The oval (the cow's, 3 x 4) holds its glint inside, at the upper middle, dark all round it:
    // the only way a glint reads on a white face.
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      const lit = glint && (oval ? r === 1 && col === Math.floor(cols / 2) : r === 0 && col === glintCol);
      const [x, y, z] = place(col, r, 1); g.set(x, y, z, lit ? light : ink);
    }
    return;
  }
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

/** A small eye on a head's side (Brian, 2026-11-07): `n` columns running back from `zFront`, each one voxel out from the
 * head's own side at its row and slice, so it never wraps onto the face or reaches back toward the ears. */
export function sideEye(head: Grid, sign: 1 | -1, rowY: number, zFront: number, n = 2): EyePlace {
  const sideAt = (y: number, z: number) => { let b = 0; for (const v of head.map.values()) if (v.y === y && v.z === z && v.x * sign > b) b = v.x * sign; return b * sign; };
  return (col, row, out) => { const y = rowY + (n - 1 - row), z = zFront - col; return [sideAt(y, z) + sign * out, y, z]; };
}
/** A small eye on the front of a face: columns x0.. at rows from rowY, each one voxel proud of the face's own front there. */
export function faceEye(head: Grid, x0: number, rowY: number, n = 2): EyePlace {
  const frontAt = (x: number, y: number) => { let z = -99; for (const v of head.map.values()) if (v.x === x && v.y === y && v.z > z) z = v.z; return z; };
  return (col, row, out) => { const x = x0 + col, y = rowY + (n - 1 - row); return [x, y, frontAt(x, y) + out]; };
}
/**
 * Two small eyes with their lids and brows; the eyes' parts pivot at each plate's centre. On the sides by default (the
 * horse, the goat), set back to `zFront`; with `front`, on the face's front either side of the bridge, `front` columns
 * out from the centre (the sheep, the cow), where they read from the table's camera.
 */
export interface SmallEyeOpts { front?: number; proud?: boolean; rows?: number; cols?: number; oval?: boolean; glint?: boolean; glintColour?: string }
export function smallEyes(head: Grid, rowY: number, zFront: number, iris: string, face: Tones, pivot: V3, opts: SmallEyeOpts = {}): { eyes: [CPart, CPart]; lids: Record<Lids, Part>; brows: Record<Brows, Part> } {
  const { front, proud = false, oval = false } = opts;
  const rows = opts.rows ?? (oval ? 4 : 2), cols = opts.cols ?? (oval ? 3 : 2);
  // The glint where it shows (a face darker than mid-tone: the sheep's, the horse's), or where asked (the cow, 3 tall).
  const glint = opts.glint ?? new Color(face[1]).getHSL({ h: 0, s: 0, l: 0 }).l < 0.55;
  const raw = front !== undefined ? [faceEye(head, -front - cols + 1, rowY, rows), faceEye(head, front, rowY, rows)] : [sideEye(head, -1, rowY, zFront, rows), sideEye(head, 1, rowY, zFront, rows)];
  // Flush and flat: on a round or tapering head the four cells sit at different depths (one hides behind the curve and
  // the eye reads as an L), so the head is filled out to one plane under the eye and the eye replaces those surface
  // voxels; nothing sticks out past the head. `proud` (the horse, the goat) keeps the flat plate one voxel out instead,
  // so eyes on the sides of a long head still show from in front of it.
  const lift = proud ? 0 : -1;
  const places = raw.map((place, i): EyePlace => {
    const cells: V3[] = [];
    for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) cells.push(place(col, row, 0));
    const colourAt = (c: V3) => head.map.get(`${c[0]},${c[1]},${c[2]}`)?.c ?? lin(face[1]);
    if (front === undefined) {
      const sign = i === 0 ? -1 : 1;
      const plane = sign < 0 ? Math.min(...cells.map((c) => c[0])) : Math.max(...cells.map((c) => c[0]));
      for (const c of cells) { const col = colourAt(c); for (let x = c[0] + sign; sign * x <= sign * plane; x += sign) head.set(x, c[1], c[2], col); }
      return (col, row, out) => { const [, y, z] = place(col, row, 0); return [plane + sign * (out + lift), y, z]; };
    }
    const plane = Math.max(...cells.map((c) => c[2]));
    for (const c of cells) { const col = colourAt(c); for (let z = c[2] + 1; z <= plane; z++) head.set(c[0], c[1], z, col); }
    return (col, row, out) => { const [x, y] = place(col, row, 0); return [x, y, plane + out + lift]; };
  });
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    // On the face's front the glint takes each eye's outer top corner, so it never sits against the pale bridge.
    eyePlate(g, place, 2, iris, glint, rows, front !== undefined && i === 1 ? cols - 1 : 0, cols, oval, opts.glintColour);
    if (!proud) for (const v of g.map.values()) head.del(v.x, v.y, v.z); // the eye takes the surface voxels' place
    const cs = [...g.map.values()];
    const c = (k: 'x' | 'y' | 'z') => (cs.reduce((a, v) => a + v[k], 0) / cs.length + 0.5) * S;
    return part(g, [c('x'), c('y'), c('z')]);
  }) as unknown as [CPart, CPart];
  return { eyes, ...lidsAndBrows(places.map((place) => ({ place, n: cols, rows, small: true })), face, pivot, head, proud ? 1 : 2) };
}

/** The lids (closed line at the middle row, an arc for happy) and the brows (a 4-bar one row above), over the eyes. */
export function lidsAndBrows(eyes: { place: EyePlace; n: number; rows?: number; small?: boolean }[], face: Tones, pivot: V3, on?: Grid, browOut = 1): { lids: Record<Lids, Part>; brows: Record<Brows, Part> } {
  const lids = {} as Record<Lids, Part>;
  for (const kind of ['closed', 'arc'] as Lids[]) {
    const g = new Grid(S);
    for (const e of eyes) for (let col = 0; col < e.n; col++) {
      if (e.small) {
        // The small eye: closed is a lid over every row (a dark lash line under it), happy covers the bottom row.
        const h = e.rows ?? 2;
        for (const r of kind === 'closed' ? Array.from({ length: h }, (_, k) => k) : [h - 1]) { const [x, y, z] = e.place(col, r, 2); g.set(x, y, z, lin(kind === 'closed' && r === h - 1 ? face[2] : face[1])); }
      } else if (kind === 'closed') { const [x, y, z] = e.place(col, Math.floor(e.n / 2), 2); g.set(x, y, z, lin(face[1])); }
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
    // On the face, above the plate (V5.1 Part 4.4): proud of the head as the plate is, never floating in front. `on` is
    // the head: a brow voxel needs a head cell behind it. Where the head has no room for the raised row (the sheep's
    // eyes sit one row under its crown), `up` drops to the row just above the plate and `worried` keeps only its raised
    // end there, so the two still read apart.
    const backed = (e: { place: EyePlace }, col: number, row: number) => !on || on.has(...e.place(col, row, browOut - 1));
    if (rows) for (const e of eyes) {
      // A brow is as long as its eye is wide when the eye is small (2 x 2); four long over the bigger plates.
      const cols = e.small ? Array.from({ length: e.n }, (_, k) => k) : [0, 1, 2, 3];
      const lift = (col: number) => (e.small ? (kind === 'up' ? 1 : col >= e.n / 2 ? 1 : 0) : rows[col]);
      const fits = cols.every((col) => backed(e, col, -1 - lift(col)));
      for (const col of cols) {
        const row = fits ? -1 - lift(col) : lift(col) === 1 ? -1 : null;
        if (row === null || !backed(e, col, row)) continue;
        const [x, y, z] = e.place(col, row, browOut); g.set(x, y, z, lin(face[2]));
      }
    }
    brows[kind] = part(g, pivot);
  }
  return { lids, brows };
}

/**
 * Mouths on a face (V5.1 Part 4.4). `origin` is the muzzle's **bottom** row; the mouth row is the one above it, so every
 * frame lies on the face: `flat`, `smile` and the side chews on the mouth row, `chewDown` on the bottom row, `o` on the
 * rows either side. `front` gives the face's front cell per (x, y) where the face is not flat. `beak` (the chicken) has
 * no mouth but `o`, one dark voxel under the beak's tip.
 */
export function mouths(origin: V3, width: number, facing: 'z' | 'x', tone: string, pivot: V3, opts: { front?: (x: number, y: number) => number; beak?: boolean } = {}): Record<Mouth, Part> {
  const put = (g: Grid, col: number, dy: number, colour: RGB) => {
    const x = origin[0] + col, y = origin[1] + dy;
    if (facing === 'z') g.set(x, y, (opts.front ? opts.front(x, y) : origin[2]) + 1, colour);
    else g.set(origin[0] + 1, y, origin[2] - col, colour);
  };
  const ink = lin(tone);
  const mid = Math.floor(width / 2);
  const specs: Record<Mouth, [number, number][]> = opts.beak
    ? { flat: [], smile: [], chewL: [], chewDown: [], chewR: [], o: [[0, 0]] }
    : {
      flat: Array.from({ length: width }, (_, i) => [i, 1]),
      smile: Array.from({ length: width }, (_, i) => [i, i === 0 || i === width - 1 ? 2 : 1]),
      o: [[mid - 1, 0], [mid, 0], [mid - 1, 1], [mid, 1], [mid - 1, 2], [mid, 2]],
      chewL: Array.from({ length: width - 1 }, (_, i) => [i, 1]),
      chewDown: Array.from({ length: width }, (_, i) => [i, 0]),
      chewR: Array.from({ length: width - 1 }, (_, i) => [i + 1, 1]),
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
  // A hollowed shell's cavity floor has nothing above it either; its cells are solid, so no frost there.
  const cav = CAVITY.get(coat);
  const has = (x: number, y: number, z: number) => coat.has(`${x},${y},${z}`) || !!cav?.has(`${x},${y},${z}`);
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

/**
 * The cells `hollow` took out of a map, kept beside it: the mesher culls against them (its `all` set), so a hollowed
 * shell draws its outside only, never the faces round its cavity (they cost a third of a hollowed part's triangles).
 */
const CAVITY = new WeakMap<VoxelMap, Map<string, { x: number; y: number; z: number; c: RGB }>>();
export function cavityOf(m: VoxelMap) { return CAVITY.get(m); }
/** Records cells as solid-but-unseen for a map (a merged coat inherits its body's cavity). */
export function addCavity(m: VoxelMap, cells: Map<string, { x: number; y: number; z: number; c: RGB }> | undefined) {
  if (!cells) return;
  const cur = CAVITY.get(m) ?? new Map();
  for (const [k, v] of cells) if (!m.has(k)) cur.set(k, v);
  CAVITY.set(m, cur);
}
function withCavity(m: VoxelMap): VoxelMap {
  const cav = CAVITY.get(m);
  if (!cav || !cav.size) return m;
  const all = new Map(m) as VoxelMap;
  for (const [k, v] of cav) if (!m.has(k)) all.set(k, v as never);
  return Object.assign(new Map(m), { all }) as VoxelMap;
}

/**
 * A collar that hugs (V5.1 Part 4.2.6): the outline, one voxel thick, of a solid's section at slice `z`, every cell of
 * it face-touching the solid, so it can never float off a sloped neck. `keep` trims it (the pig's ends at the jaw).
 */
export function hugCollar(solid: Set<string>, z: number, colour: string, keep: (x: number, y: number) => boolean = () => true): CPart {
  const g = new Grid(S);
  const inS = (x: number, y: number) => solid.has(`${x},${y},${z}`);
  const xs: number[] = [], ys: number[] = [];
  for (const k of solid) { const [x, y, zz] = k.split(',').map(Number); if (zz === z) { xs.push(x); ys.push(y); } }
  for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + 1; x++) for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y++) {
    if (inS(x, y) || !keep(x, y)) continue;
    if (inS(x + 1, y) || inS(x - 1, y) || inS(x, y + 1) || inS(x, y - 1)) g.set(x, y, z, lin(colour));
  }
  return part(g, [0, 0, 0]);
}

/** Removes the voxels no face of which can ever show (all six neighbours present): the budget counts voxels, the mesher does not. */
export function hollow(g: Grid) {
  // A one-voxel shell, then a repair: wherever two shell voxels meet only along an edge, the interior voxel between
  // them is put back, so the shell stays 6-connected and the budget stays low.
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
  // A cell already hollowed out (a body under the coat merged over it) counts as present: it is solid, only unseen.
  const cav = CAVITY.get(g.map);
  const deep = (x: number, y: number, z: number) => DIRS.every(([dx, dy, dz]) => g.has(x + dx, y + dy, z + dz) || !!cav?.has(`${x + dx},${y + dy},${z + dz}`));
  const removed = new Map<string, RGB>();
  for (const v of g.map.values()) if (deep(v.x, v.y, v.z)) removed.set(`${v.x},${v.y},${v.z}`, v.c);
  for (const k of removed.keys()) { const [x, y, z] = k.split(',').map(Number); g.del(x, y, z); }
  addCavity(g.map, new Map([...removed].map(([k, c]) => { const [x, y, z] = k.split(',').map(Number); return [k, { x, y, z, c }]; })));
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

/** The cells of a grid as a set of keys: a solid's volume, taken before `hollow`, for `bury`. */
export function solidSet(g: Grid): Set<string> { return new Set(g.map.keys()); }
/**
 * Drops the cells of `g` buried more than one voxel deep in the solids (a leg's top in the belly, a neck's ends in the
 * chest and the head): they can never show, but a separate mesh would still draw their faces against the budget.
 * The first layer inside is kept, so the part still meets its parent with no seam when it turns.
 */
export function bury(g: Grid, ...solids: Set<string>[]) {
  const inside = (x: number, y: number, z: number) => solids.some((s) => s.has(`${x},${y},${z}`));
  const N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
  const drop = [...g.map.values()].filter((v) => inside(v.x, v.y, v.z) && N.every(([dx, dy, dz]) => inside(v.x + dx, v.y + dy, v.z + dz)));
  for (const v of drop) g.del(v.x, v.y, v.z);
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
