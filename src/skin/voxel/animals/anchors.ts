/**
 * Measured anchors (plan file 03, change 4.7): where things sit on an animal, read from its own geometry instead of
 * typed numbers. Everything is in model units (the animal at scale 1, its root at the origin, standing at rest, coat
 * level 2 unless said), cached per model. The geometry's vertices are the voxels' corners, so this is the model's
 * cells as the component lays them out: the body group at rest, the neck unturned, the head pitched by `headPitch`,
 * the ears drooped 20 degrees (as `Sheep` stands them at idle), and the hat where `hatFit` puts it.
 *
 * Read by: `nameplateY` and the daze stars (table/BarnTable.tsx), the hat's fit and the winner's scarf and the ice
 * block (table/Sheep.tsx). Nothing else is switched to it in milestone 3.
 */
import { Box3, Matrix4, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { santaHat } from '../../scene/festive';
import type { V3 } from '../primitives';
import type { Part, SheepModel } from '../sheep';
import { LEVEL_K } from '../sheep';
import type { AnimalModel } from './rig';

/** How far the name plate stands over the highest voxel, hat included, in model units (0.065 m at the sheep's table scale). */
export const PLATE_GAP = 0.05;
/** How the ears hang at rest: `DROOP` in table/Sheep.tsx. */
const DROOP = (20 * Math.PI) / 180;
/** How the frozen pose leans the body back, and swells the coat (`'frozen'` in `poseFor`, table/Sheep.tsx). */
const FROZEN_LEAN = -0.14, FROZEN_PUFF = 1.06;

export interface Bounds { min: V3; max: V3 }
export interface Anchors {
  /** The top of the head and its hood, in the middle of its width: where the hat sits. */
  crown: V3;
  /** The hat's place and size in the head group's own space (`SantaHat`, the head's bundle). */
  hat: { at: V3; scale: number };
  /** The hat's highest point. */
  hatTip: V3;
  /** The highest point of anything drawn at rest, at any coat level, the hat included. */
  top: number;
  /** Where the name plate stands: over the head, PLATE_GAP above `top`. */
  plate: V3;
  headCentre: V3;
  /** The head's lowest point, at its middle. */
  chin: V3;
  /** The front of the head, at its middle. */
  muzzle: V3;
  /** The top of the torso as dressed at level 2, at its middle. */
  back: V3;
  /** The lowest point of the legs: y 0 for every species. */
  feet: V3;
  /** The neck's section the winner's scarf hugs (in cells): the slice and every cell of the animal it may touch. */
  neckRing: { z: number; solid: Set<string>; taken: Set<string> } | null;
  /** Everything at rest at every coat level, the hat included. */
  bounds: Bounds;
  /** The same in the frozen pose: what the ice block is fitted to. */
  frozen: Bounds;
}

const cache = new WeakMap<object, Anchors>();

/** Where `SantaHat` puts the hat on a head: on the top of the head's and hood's box, sized to its width. Head-group space. */
function hatFitOf(m: SheepModel): { at: V3; scale: number; box: Box3 } {
  const box = new Box3();
  for (const g of [m.head.geo, m.hood.geo]) { g.computeBoundingBox(); if (!g.boundingBox!.isEmpty()) box.union(g.boundingBox!); }
  const c = box.getCenter(new Vector3());
  return { at: [c.x, box.max.y - 0.06, c.z - 0.02], scale: Math.min(1, Math.max(0.55, (box.max.x - box.min.x) / 0.6)), box };
}

/** Every vertex of `geo` through `m`, into `box` (and `top`, the highest y). */
function into(box: Box3, geo: BufferGeometry, m: Matrix4): void {
  const p = geo.getAttribute('position');
  if (!p) return;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
}

const at = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

/** Measures a model once. */
export function anchorsOf(model: SheepModel | AnimalModel): Anchors {
  const hit = cache.get(model);
  if (hit) return hit;
  const am = model as Partial<AnimalModel>;
  const species = am.species ?? 'sheep';
  const head = model.head.pivot;
  const fit = hatFitOf(model);
  const hat = santaHat();

  /** The body group's frame, and the head group's inside it (pitched about the head's pivot, as at rest). */
  const lay = (lean: number) => {
    const body = new Matrix4().makeRotationX(lean);
    const headM = body.clone().multiply(at(head[0], head[1], head[2])).multiply(new Matrix4().makeRotationX(am.headPitch ?? 0));
    return { body, headM };
  };
  /** Everything drawn at rest, at every coat level, into `box`; coats swollen by `puff` about the legs' tops. */
  const gather = (box: Box3, lean: number, puff: number, withHat: boolean) => {
    const { body, headM } = lay(lean);
    const onBody = (p: Part) => into(box, p.geo, body.clone().multiply(at(p.pivot[0], p.pivot[1], p.pivot[2])));
    const onHead = (p: Part, turn = new Matrix4()) => into(box, p.geo, headM.clone().multiply(at(p.pivot[0] - head[0], p.pivot[1] - head[1], p.pivot[2] - head[2])).multiply(turn));
    const legTop = model.legs[0].pivot[1];
    for (const l of [1, 2, 3, 4] as const) {
      into(box, model.wools[l].geo, body.clone().multiply(at(0, legTop * (1 - puff), 0)).multiply(new Matrix4().makeScale(puff, puff, puff)));
      // The sheep's tail moves back with its fleece (`tailZ` in table/Sheep.tsx); another species' stays where it was built.
      const tz = model.tail.pivot[2] - (species === 'sheep' ? 0.4 * (LEVEL_K[l] - 1) : 0);
      into(box, model.tail.geo, body.clone().multiply(at(model.tail.pivot[0], model.tail.pivot[1], tz)));
    }
    for (const p of [model.sheared, ...model.legs, model.collar, model.bell, ...(am.neck ? [am.neck] : []), ...(am.signature ?? []).filter((sp) => sp.where === 'body')]) onBody(p);
    into(box, model.head.geo, headM);
    into(box, model.hood.geo, headM);
    for (const p of [...model.eyes, ...(am.signature ?? []).filter((sp) => sp.where === 'head'), ...(am.worn ? [am.worn] : [])]) onHead(p);
    onHead(model.ears[0], new Matrix4().makeRotationZ(DROOP));
    onHead(model.ears[1], new Matrix4().makeRotationZ(-DROOP));
    if (withHat) into(box, hat, headM.clone().multiply(at(fit.at[0], fit.at[1], fit.at[2])).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
  };

  const all = new Box3();
  gather(all, 0, 1, true);
  const frozen = new Box3();
  gather(frozen, FROZEN_LEAN, FROZEN_PUFF, true);
  const { headM } = lay(0);
  const hatBox = new Box3();
  into(hatBox, hat, headM.clone().multiply(at(fit.at[0], fit.at[1], fit.at[2])).multiply(new Matrix4().makeScale(fit.scale, fit.scale, fit.scale)));
  const headBox = new Box3();
  into(headBox, model.head.geo, headM);
  into(headBox, model.hood.geo, headM);
  const mid = headBox.getCenter(new Vector3());
  const crown = new Vector3(mid.x, fit.box.max.y, (fit.box.min.z + fit.box.max.z) / 2).applyMatrix4(headM);
  const torso = new Box3();
  into(torso, model.wools[2].geo, new Matrix4());
  const tm = torso.getCenter(new Vector3());

  const out: Anchors = {
    crown: v3(crown),
    hat: { at: fit.at, scale: fit.scale },
    hatTip: [mid.x, hatBox.max.y, (hatBox.min.z + hatBox.max.z) / 2],
    top: all.max.y,
    plate: [mid.x, all.max.y + PLATE_GAP, mid.z],
    headCentre: v3(mid),
    chin: [mid.x, headBox.min.y, mid.z],
    muzzle: [mid.x, mid.y, headBox.max.z],
    back: [tm.x, torso.max.y, tm.z],
    feet: [0, all.min.y, 0],
    neckRing: neckRingOf(model),
    bounds: { min: v3(all.min), max: v3(all.max) },
    frozen: { min: v3(frozen.min), max: v3(frozen.max) },
  };
  cache.set(model, out);
  return out;
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * The slice the winner's scarf hugs: just ahead of the collar (toward the head), round the neck, and every cell of the
 * animal at rest that a scarf voxel may not take. Null for the sheep (whose scarf is its own) and a model whose cells
 * are not kept.
 */
function neckRingOf(model: SheepModel | AnimalModel): Anchors['neckRing'] {
  const am = model as Partial<AnimalModel>;
  if (!am.species || am.species === 'sheep' || !am.cells) return null;
  const solid = new Set<string>(), taken = new Set<string>();
  const c = am.cells;
  for (const [name, cells] of Object.entries(c)) {
    for (const v of cells.values()) {
      const k = key(v.x, v.y, v.z);
      taken.add(k);
      if (/^(body|neck|head|collar)$/.test(name)) solid.add(k);
    }
  }
  // The neck's narrowest section near the collar (or, for the hen, along its neck): two slices, neither the collar's
  // own, where the animal's outline is all free. That is where a scarf is tied.
  const collar = [...(c.collar?.values() ?? [])], neck = [...(c.neck?.values() ?? [])];
  const zc = collar.length ? Math.round(collar.reduce((k, v) => k + v.z, 0) / collar.length) : null;
  const zs = zc !== null ? [zc - 5, zc - 4, zc - 3, zc - 2, zc + 1, zc + 2, zc + 3, zc + 4] : neck.length ? [...new Set(neck.map((v) => v.z))] : [];
  const outline = (z: number) => {
    const inS = (x: number, y: number) => solid.has(key(x, y, z));
    let all = 0, free = 0;
    for (const k of solid) {
      const [x, y, zz] = k.split(',').map(Number);
      if (zz !== z) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inS(x + dx, y + dy)) { all++; if (!taken.has(key(x + dx, y + dy, z))) free++; }
    }
    return { all, free };
  };
  let z = NaN, best = Infinity;
  for (const cand of zs) {
    const a = outline(cand), b = outline(cand + 1);
    if (!a.all || !b.all || a.free < 0.9 * a.all || b.free < 0.9 * b.all) continue;
    const score = a.all + b.all + (zc !== null ? Math.abs(cand - zc) * 0.01 : 0);
    if (score < best) { best = score; z = cand; }
  }
  if (!Number.isFinite(z)) return null;
  return { z, solid, taken };
}

/**
 * The winner's scarf for a species on the rig (file 03, 4.7): a ring two slices deep hugging the neck's section at
 * `neckRing` (the outline of the animal's own solid there, every cell touching it, as `hugCollar` traces a collar),
 * and two tails hanging from the ring's lowest row, stopping where they would run into the animal. Cells as
 * [x, y, z, stripe]: stripe true for the cream rows.
 */
export function scarfCells(model: SheepModel | AnimalModel): [number, number, number, boolean][] {
  const ring = anchorsOf(model).neckRing;
  if (!ring) return [];
  const out = new Map<string, [number, number, number, boolean]>();
  const { solid, taken } = ring;
  for (const z of [ring.z, ring.z + 1]) {
    const inS = (x: number, y: number) => solid.has(key(x, y, z));
    const xs: number[] = [], ys: number[] = [];
    for (const k of solid) { const [x, y, zz] = k.split(',').map(Number); if (zz === z) { xs.push(x); ys.push(y); } }
    if (!xs.length) continue;
    for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + 1; x++) for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y++) {
      if (inS(x, y) || taken.has(key(x, y, z))) continue;
      if (inS(x + 1, y) || inS(x - 1, y) || inS(x, y + 1) || inS(x, y - 1)) out.set(key(x, y, z), [x, y, z, (x + y) % 6 >= 4]);
    }
  }
  const cells = [...out.values()];
  if (!cells.length) return [];
  // The hanging end: from the ring's lowest row at the front, two voxels wide, up to six long.
  const low = Math.min(...cells.map((v) => v[1]));
  const bottom = cells.filter((v) => v[1] === low).sort((p, q) => p[2] - q[2] || p[0] - q[0]);
  const front = bottom[bottom.length - 1];
  const x0 = front[0] >= 0 ? front[0] - 1 : front[0];
  for (let k = 1; k <= 6; k++) {
    const row = [x0, x0 + 1].map((x) => [x, low - k, front[2]] as const);
    if (row.some(([x, y, z]) => taken.has(key(x, y, z)) || y < 1)) break;
    for (const [x, y, z] of row) out.set(key(x, y, z), [x, y, z, k % 3 === 0]);
  }
  return [...out.values()];
}
