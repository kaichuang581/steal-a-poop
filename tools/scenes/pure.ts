/**
 * The scene checker's arithmetic: rectangles, rays through voxel boxes, the distance to a box, the shared area of two
 * faces, a model's anchors, and the two one-line rules of plan file 03 (the tail, and "visible only if it has
 * triangles"); and, last in the file, the three helpers that read the game's source for a line. The stages (place,
 * lights, and any other that wants one) import from here, and src/skin/__tests__/integrity.test.ts tests every one of
 * them on hand-made data inside `npm test` (plan file 18, section 4.1). Because that test imports this file,
 * `npx tsc --noEmit` reads it too. It imports nothing but node's own fs and path, and must stay so: nothing here may
 * build a scene, or `npm test` would.
 *
 * A voxel is a box: six numbers (x0, y0, z0, x1, y1, z1) in metres, as `boxes` in tools/scenes/build.ts hands them
 * out. +y is up. A turn about y is three.js's: a point (x, z) turned by `yaw` lands at
 * (x cos + z sin, -x sin + z cos).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export type V3 = readonly [number, number, number];

/** How far a placed thing may stand over or under its support, in metres (plan file 18, section 4.2 b). */
export const GAP_TOLERANCE = 0.02;
/** How far the footprint box is raised off the support before it is searched for another prop's voxels. */
export const BOX_RAISE = 0.02;
/** How far a light may be from its lamp's voxels (plan file 18, section 4.2 e). */
export const LAMP_REACH = 0.35;
/** A ray is cast this far inside each corner of a footprint, so it never runs along the seam between two voxels. */
export const CORNER_INSET = 0.001;
/** Two boxes that only touch do not overlap: they must reach into each other by more than this. */
export const TOUCH = 0.001;

// ---------------------------------------------------------------------------------------------------------------------
// Rectangles on the ground, and boxes standing on them
// ---------------------------------------------------------------------------------------------------------------------

/** A rectangle on the ground: its middle, its width along its own x and depth along its own z, turned by `yaw`. */
export interface Rect { x: number; z: number; w: number; d: number; yaw: number }
/** A rectangle with a height: from y0 up to y1. */
export interface Box extends Rect { y0: number; y1: number }

/** A point of a rectangle's own frame (metres from its middle) in the world. */
export function turned(r: Rect, lx: number, lz: number): [number, number] {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  return [r.x + lx * c + lz * s, r.z - lx * s + lz * c];
}

/** The four corners of a rectangle, each pulled `inset` metres in along both sides, then its middle: five points. */
export function rayPoints(r: Rect, inset = CORNER_INSET): [number, number][] {
  const hw = Math.max(0, r.w / 2 - inset), hd = Math.max(0, r.d / 2 - inset);
  return [turned(r, -hw, -hd), turned(r, hw, -hd), turned(r, hw, hd), turned(r, -hw, hd), [r.x, r.z]];
}

/** True when two rectangles reach into each other by more than `touch` (a shared edge is not an overlap). */
export function rectsOverlap(a: Rect, b: Rect, touch = TOUCH): boolean {
  const axes: [number, number][] = [];
  for (const r of [a, b]) {
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    axes.push([c, -s], [s, c]);
  }
  const dx = b.x - a.x, dz = b.z - a.z;
  const reach = (r: Rect, ax: number, az: number) => {
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    return (r.w / 2) * Math.abs(c * ax - s * az) + (r.d / 2) * Math.abs(s * ax + c * az);
  };
  for (const [ax, az] of axes) {
    if (Math.abs(dx * ax + dz * az) >= reach(a, ax, az) + reach(b, ax, az) - touch) return false;
  }
  return true;
}

/** True when two boxes reach into each other by more than `touch` on the ground and in height. */
export function boxesOverlap(a: Box, b: Box, touch = TOUCH): boolean {
  if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) <= touch) return false;
  return rectsOverlap(a, b, touch);
}

// ---------------------------------------------------------------------------------------------------------------------
// Rays straight down and straight up through voxel boxes
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Cell 61 of a 0.1 m grid starts at 6.1000000000000005 and cell 60 ends at 6.1: a line at 6.1 would fall between
 * them. So a line this close to a voxel's side runs through the voxel.
 */
const SEAM = 1e-9;
/** True when the upright line at (x, z) runs through voxel `i` of `boxes`. A line on the seam between two voxels runs through both. */
const over = (boxes: ArrayLike<number>, i: number, x: number, z: number) =>
  x >= boxes[i] - SEAM && x <= boxes[i + 3] + SEAM && z >= boxes[i + 2] - SEAM && z <= boxes[i + 5] + SEAM;

/**
 * A ray cast straight down at (x, z) from the height `from`: the top of the first voxel it meets, or null when there
 * is none under it. A ray that starts inside a voxel has met that voxel, so the answer may be above `from`.
 */
export function topBelow(boxes: ArrayLike<number>, x: number, z: number, from: number): number | null {
  let top: number | null = null;
  for (let i = 0; i < boxes.length; i += 6) {
    if (!over(boxes, i, x, z) || boxes[i + 1] >= from) continue;
    if (top === null || boxes[i + 4] > top) top = boxes[i + 4];
  }
  return top;
}

/** The same ray cast straight up: the underside of the first voxel it meets, or null. */
export function undersideAbove(boxes: ArrayLike<number>, x: number, z: number, from: number): number | null {
  let under: number | null = null;
  for (let i = 0; i < boxes.length; i += 6) {
    if (!over(boxes, i, x, z) || boxes[i + 4] <= from) continue;
    if (under === null || boxes[i + 1] < under) under = boxes[i + 1];
  }
  return under;
}

/**
 * The gap under something that stands at height `y` and is `height` tall, at (x, z): `y` minus the top of the first
 * voxel under a ray cast down from its own top. 0 is standing on it; over 0, in the air by that much; under 0, sunk in
 * by that much (a hen 0.10 m deep in straw reads -0.10). Null when nothing at all is under it.
 */
export function gapBelow(boxes: ArrayLike<number>, x: number, z: number, y: number, height: number): number | null {
  const top = topBelow(boxes, x, z, y + height);
  return top === null ? null : y - top;
}

/** The gap over something hung at height `y` that hangs down `height`: the underside of the first voxel over it, minus `y`. */
export function gapAbove(boxes: ArrayLike<number>, x: number, z: number, y: number, height: number): number | null {
  const under = undersideAbove(boxes, x, z, y - height);
  return under === null ? null : under - y;
}

/** Whether a gap is one a placed thing may have: within `tolerance` of nothing. No support at all (null) never is. */
export const gapPasses = (gap: number | null, tolerance = GAP_TOLERANCE) => gap !== null && Math.abs(gap) <= tolerance + 1e-9;

/** How far a point is from voxel `i` of `boxes` (0 inside it). */
export function distanceToBox(p: V3, boxes: ArrayLike<number>, i: number): number {
  const dx = Math.max(boxes[i] - p[0], 0, p[0] - boxes[i + 3]);
  const dy = Math.max(boxes[i + 1] - p[1], 0, p[1] - boxes[i + 4]);
  const dz = Math.max(boxes[i + 2] - p[2], 0, p[2] - boxes[i + 5]);
  return Math.hypot(dx, dy, dz);
}

/** How far a point is from the nearest of `boxes`; Infinity when there are none. */
export function distanceToBoxes(p: V3, boxes: ArrayLike<number>): number {
  let best = Infinity;
  for (let i = 0; i < boxes.length; i += 6) {
    const d = distanceToBox(p, boxes, i);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Many voxel boxes sorted by the ground under them, so a ray or a box is tried only against what stands near it. Each
 * array added gets a number (its "set", in the order added) and every answer says which set it came from. The answers
 * are those of `topBelow`, `undersideAbove` and `distanceToBoxes` over everything added.
 */
export class Columns {
  private readonly sets: ArrayLike<number>[] = [];
  private readonly cells = new Map<number, number[]>();
  /** Voxels kept, over all sets. */
  count = 0;
  constructor(readonly side = 0.5) {}

  private key(cx: number, cz: number) { return (cx + 32768) * 65536 + (cz + 32768); }

  /** Adds an array of boxes and hands back its set number. `keep` may leave out voxels nobody will ask about. */
  add(boxes: ArrayLike<number>, keep?: (x0: number, z0: number, x1: number, z1: number) => boolean): number {
    const set = this.sets.length, s = this.side;
    this.sets.push(boxes);
    for (let i = 0; i < boxes.length; i += 6) {
      if (keep && !keep(boxes[i], boxes[i + 2], boxes[i + 3], boxes[i + 5])) continue;
      this.count++;
      const ref = set * 67108864 + i / 6;
      // A line on a voxel's side runs through it (see `over`), so a voxel that ends on a cell's edge is in the next cell too.
      const x1 = Math.floor((boxes[i + 3] + SEAM) / s), z1 = Math.floor((boxes[i + 5] + SEAM) / s);
      for (let cx = Math.floor((boxes[i] - SEAM) / s); cx <= x1; cx++) for (let cz = Math.floor((boxes[i + 2] - SEAM) / s); cz <= z1; cz++) {
        const k = this.key(cx, cz);
        const cell = this.cells.get(k);
        if (cell) cell.push(ref); else this.cells.set(k, [ref]);
      }
    }
    return set;
  }

  private at(x: number, z: number): number[] | undefined {
    return this.cells.get(this.key(Math.floor(x / this.side), Math.floor(z / this.side)));
  }

  /** `topBelow` over every set `skip` does not leave out. */
  down(x: number, z: number, from: number, skip?: (set: number) => boolean): { y: number; set: number } | null {
    let best: { y: number; set: number } | null = null;
    for (const ref of this.at(x, z) ?? []) {
      const set = Math.floor(ref / 67108864), i = (ref % 67108864) * 6, b = this.sets[set];
      if (!over(b, i, x, z) || b[i + 1] >= from || (skip && skip(set))) continue;
      if (!best || b[i + 4] > best.y) best = { y: b[i + 4], set };
    }
    return best;
  }

  /** `undersideAbove` over every set `skip` does not leave out. */
  up(x: number, z: number, from: number, skip?: (set: number) => boolean): { y: number; set: number } | null {
    let best: { y: number; set: number } | null = null;
    for (const ref of this.at(x, z) ?? []) {
      const set = Math.floor(ref / 67108864), i = (ref % 67108864) * 6, b = this.sets[set];
      if (!over(b, i, x, z) || b[i + 4] <= from || (skip && skip(set))) continue;
      if (!best || b[i + 1] < best.y) best = { y: b[i + 1], set };
    }
    return best;
  }

  /** The voxels that reach more than `touch` into a box, counted by set. */
  inside(box: Box, skip?: (set: number) => boolean, touch = TOUCH): Map<number, number> {
    const found = new Map<number, number>(), seen = new Set<number>(), s = this.side;
    const reach = Math.hypot(box.w, box.d) / 2;
    for (let cx = Math.floor((box.x - reach) / s); cx <= Math.floor((box.x + reach) / s); cx++) {
      for (let cz = Math.floor((box.z - reach) / s); cz <= Math.floor((box.z + reach) / s); cz++) {
        for (const ref of this.cells.get(this.key(cx, cz)) ?? []) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          const set = Math.floor(ref / 67108864), i = (ref % 67108864) * 6, b = this.sets[set];
          if (skip && skip(set)) continue;
          if (Math.min(box.y1, b[i + 4]) - Math.max(box.y0, b[i + 1]) <= touch) continue;
          const voxel: Rect = { x: (b[i] + b[i + 3]) / 2, z: (b[i + 2] + b[i + 5]) / 2, w: b[i + 3] - b[i], d: b[i + 5] - b[i + 2], yaw: 0 };
          if (rectsOverlap(box, voxel, touch)) found.set(set, (found.get(set) ?? 0) + 1);
        }
      }
    }
    return found;
  }

  /** The nearest voxel to a point within `reach` metres of it, or null. */
  nearest(p: V3, reach: number, skip?: (set: number) => boolean): { distance: number; set: number } | null {
    let best: { distance: number; set: number } | null = null;
    const s = this.side, seen = new Set<number>();
    for (let cx = Math.floor((p[0] - reach) / s); cx <= Math.floor((p[0] + reach) / s); cx++) {
      for (let cz = Math.floor((p[2] - reach) / s); cz <= Math.floor((p[2] + reach) / s); cz++) {
        for (const ref of this.cells.get(this.key(cx, cz)) ?? []) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          const set = Math.floor(ref / 67108864);
          if (skip && skip(set)) continue;
          const d = distanceToBox(p, this.sets[set], (ref % 67108864) * 6);
          if (d <= reach && (!best || d < best.distance)) best = { distance: d, set };
        }
      }
    }
    return best;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Faces in one plane
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One flat face on the grid's axes: it lies in the plane `axis` = `at`, looks along +axis or -axis (`facing`), and
 * spans a0..a1 and b0..b1 on the two other axes, taken in the order x, y, z (for axis 1: a is x, b is z).
 */
export interface Quad { axis: 0 | 1 | 2; at: number; facing: 1 | -1; a0: number; a1: number; b0: number; b1: number }

/**
 * The area two faces share when they lie in the same plane and look the same way: what flickers when two meshes draw
 * it. 0 for faces in different planes, back to back, or only touching along an edge.
 */
export function coplanarArea(p: Quad, q: Quad, eps = 1e-6): number {
  if (p.axis !== q.axis || p.facing !== q.facing || Math.abs(p.at - q.at) > eps) return 0;
  const a = Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0), b = Math.min(p.b1, q.b1) - Math.max(p.b0, q.b0);
  return a > eps && b > eps ? a * b : 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// A model's anchors
// ---------------------------------------------------------------------------------------------------------------------

export interface Anchors {
  /** The box round every cell, in metres. */
  bounds: { min: V3; max: V3 };
  /** The middle of the top face of the highest row of cells: where a hat sits. */
  crown: V3;
  /** Where a name plate hangs: over the crown, `plateGap` metres up. */
  plate: V3;
  /** The middle of the underside of the lowest row of cells: what stands on the floor. */
  feet: V3;
  /** The middle of the box. */
  centre: V3;
  /** How many cells the highest row has, and the lowest. */
  crownCells: number;
  feetCells: number;
}

/**
 * The anchors of a set of cells (whole numbers; cell i spans i * size to (i + 1) * size metres), measured from the
 * cells themselves and not typed in by hand (plan file 03, section 4.7). `plateGap` is how far over the highest voxel
 * a plate hangs: the middle of the plan's 0.02 to 0.12 m.
 */
export function anchorsOf(cells: Iterable<readonly [number, number, number]>, size: number, plateGap = 0.07): Anchors {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const list: (readonly [number, number, number])[] = [];
  for (const c of cells) {
    list.push(c);
    for (let k = 0; k < 3; k++) { if (c[k] < min[k]) min[k] = c[k]; if (c[k] + 1 > max[k]) max[k] = c[k] + 1; }
  }
  if (!list.length) throw new Error('anchorsOf: no cells');
  const mid = (row: number): [number, number, number] => {
    let x = 0, z = 0, n = 0;
    for (const c of list) if (c[1] === row) { x += c[0] + 0.5; z += c[2] + 0.5; n++; }
    return [(x / n) * size, n, (z / n) * size];
  };
  const top = mid(max[1] - 1), bottom = mid(min[1]);
  const crown: V3 = [top[0], max[1] * size, top[2]];
  return {
    bounds: { min: [min[0] * size, min[1] * size, min[2] * size], max: [max[0] * size, max[1] * size, max[2] * size] },
    crown,
    plate: [crown[0], crown[1] + plateGap, crown[2]],
    feet: [bottom[0], min[1] * size, bottom[2]],
    centre: [((min[0] + max[0]) / 2) * size, ((min[1] + max[1]) / 2) * size, ((min[2] + max[2]) / 2) * size],
    crownCells: top[1],
    feetCells: bottom[1],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Two rules of plan file 03
// ---------------------------------------------------------------------------------------------------------------------

/** The tail rule (plan file 03, section 4.1): a shorn sheep has no tail by design; every other animal keeps its tail at every coat level. */
export const tailShown = (level: number, species: string): boolean => level > 0 || species !== 'sheep';

/** What a geometry needs for the next two: three.js's own fields, and nothing of three.js imported. */
export interface GeometryLike { index?: { count: number } | null; attributes?: { position?: { count: number } | null } }

/** How many triangles a geometry draws: its index when it has one, else a third of its corners. */
export function triangleCount(geometry: GeometryLike | null | undefined): number {
  if (!geometry) return 0;
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  return Math.floor((geometry.attributes?.position?.count ?? 0) / 3);
}

/** "Visible only if it has triangles" (plan file 03, section 4.6): three.js still draws a visible mesh that has none. */
export const visibleWithTriangles = (visible: boolean, geometry: GeometryLike | null | undefined): boolean => visible && triangleCount(geometry) > 0;

// ---------------------------------------------------------------------------------------------------------------------
// Reading the game's source: the only part of this file that touches the disk
// ---------------------------------------------------------------------------------------------------------------------

/** A line of the game a manifest works a number out from: the file, from the repo's root, and the line's words. */
export interface SourceLine { file: string; text: string }

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The lines that are no longer in their file, each as a sentence (spaces and line breaks are not compared). This is
 * what keeps a copied number honest: when the game's line changes, whoever reads the copy is told.
 */
export function goneLines(root: string, lines: readonly SourceLine[]): string[] {
  const gone: string[] = [], texts = new Map<string, string>(), seen = new Set<string>();
  for (const c of lines) {
    const key = `${c.file}\n${c.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let text = texts.get(c.file);
    if (text === undefined) {
      try { text = squash(readFileSync(join(root, c.file), 'utf8')); } catch { text = ''; }
      texts.set(c.file, text);
    }
    if (!text.includes(squash(c.text))) gone.push(`${c.file} no longer has the line: ${c.text}`);
  }
  return gone;
}

/** One `<pointLight` or `<spotLight` in the game's source: where it is, and the source from its `<` on. */
export interface LightElement { file: string; line: number; kind: 'point' | 'spot'; text: string }

/** Every `<pointLight` and `<spotLight` in the .tsx files under `dir` (test folders aside), in the order of their paths. */
export function lightElements(root: string, dir = 'src/skin'): LightElement[] {
  const out: LightElement[] = [];
  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(path); continue; }
      if (!entry.name.endsWith('.tsx')) continue;
      const source = readFileSync(path, 'utf8');
      for (const hit of source.matchAll(/<(pointLight|spotLight)\b/g)) {
        out.push({
          file: relative(root, path).split(sep).join('/'), line: source.slice(0, hit.index).split('\n').length,
          kind: hit[1] === 'pointLight' ? 'point' : 'spot', text: source.slice(hit.index, hit.index + 400),
        });
      }
    }
  };
  walk(join(root, dir));
  return out;
}

/** What `unlistedLights` needs of an entry of LIGHTS (src/skin/scene/placed.ts). */
export interface ListedLight { id: string; kind: 'point' | 'spot'; element: SourceLine }

/**
 * The elements no entry is on (an entry is on an element of its file whose source starts with the entry's words), the
 * entries on no element, and the entries that say they are another kind of light than their element.
 */
export function unlistedLights(elements: readonly LightElement[], lights: readonly ListedLight[]): { unlisted: LightElement[]; orphans: string[]; wrongKind: string[] } {
  const on = (l: ListedLight, e: LightElement) => l.element.file === e.file && e.text.startsWith(l.element.text);
  return {
    unlisted: elements.filter((e) => !lights.some((l) => on(l, e))),
    orphans: lights.filter((l) => !elements.some((e) => on(l, e))).map((l) => l.id),
    wrongKind: lights.filter((l) => !l.element.text.startsWith(l.kind === 'point' ? '<pointLight' : '<spotLight')).map((l) => l.id),
  };
}
