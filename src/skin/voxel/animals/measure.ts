import type { VoxelMap } from '../mesher';
import { S } from './rig';
import type { AnimalModel, Species } from './rig';

/**
 * The measurements of V5.1 Part 7, as plain functions over a model's cells (0.04 m voxels, model space, +z forward,
 * +y up). The tests range-check them; tools/animalReport.ts prints them. Nothing here changes a model.
 */
export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; w: number; h: number; l: number }
export function bbox(...maps: (VoxelMap | undefined)[]): Box {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const m of maps) if (m) for (const v of m.values()) {
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  return { x0, x1, y0, y1, z0, z1, w: x1 - x0 + 1, h: y1 - y0 + 1, l: z1 - z0 + 1 };
}
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

// ---------- 4.1 the proportion sheet ----------
export type Ratio = 'torsoLH' | 'torsoWH' | 'headHT' | 'headWT' | 'headLW' | 'headHW' | 'legT' | 'headTop' | 'muzzle' | 'eyeH';
export const RATIO_NAMES: Record<Ratio, string> = {
  torsoLH: 'Torso L / H', torsoWH: 'Torso W / H', headHT: 'Head H / torso H', headWT: 'Head W / torso W', headLW: 'Head L / head W',
  headHW: 'Head H / head W', legT: 'Leg height / torso H', headTop: 'Head top / back line', muzzle: 'Muzzle ahead of chest / head L', eyeH: 'Eye height / head H',
};
type Range = [number, number];
// Brian's six-view sheets (2026-11-18) replace the V5.1 proportion sheet: "completely change them to be one-to-one,
// disregard all old rules about the animal modeling". Each range is the rebuilt model's own ratio within 8%, so a
// model that drifts from its sheet fails.
export const SHEET: Record<Species, Record<Ratio, Range>> = {
  sheep: { torsoLH: [1.13, 1.33], torsoWH: [0.78, 0.92], headHT: [0.35, 0.41], headWT: [0.59, 0.7], headLW: [0.79, 0.93], headHW: [0.66, 0.77], legT: [0.46, 0.55], headTop: [0.75, 0.88], muzzle: [0.62, 0.72], eyeH: [0.2, 0.24] }, // the sheet's own cells: a small face set into the wool (2026-11-19)
  pig: { torsoLH: [1.19, 1.41], torsoWH: [1.01, 1.19], headHT: [0.92, 1.08], headWT: [0.92, 1.08], headLW: [0.33, 0.4], headHW: [0.83, 0.99], legT: [0.36, 0.44], headTop: [0.92, 1.08], muzzle: [0.92, 1.08], eyeH: [0.09, 0.11] },
  cow: { torsoLH: [1.5, 1.77], torsoWH: [1.08, 1.28], headHT: [0.66, 0.79], headWT: [0.63, 0.75], headLW: [0.81, 0.97], headHW: [0.81, 0.97], legT: [0.58, 0.69], headTop: [1.02, 1.2], muzzle: [0.92, 1.08], eyeH: [0.11, 0.14] },
  horse: { torsoLH: [2.04, 2.4], torsoWH: [1.12, 1.32], headHT: [0.83, 0.97], headWT: [0.58, 0.69], headLW: [1.57, 1.86], headHW: [1.05, 1.25], legT: [0.92, 1.08], headTop: [1.53, 1.81], muzzle: [0.69, 0.82], eyeH: [0.12, 0.14] }, // the snout flush with the head's bottom (2026-11-18)
  goat: { torsoLH: [1.53, 1.81], torsoWH: [1.12, 1.32], headHT: [0.81, 0.97], headWT: [0.75, 0.89], headLW: [0.81, 0.97], headHW: [0.81, 0.97], legT: [0.61, 0.73], headTop: [1.22, 1.44], muzzle: [0.69, 0.82], eyeH: [0.11, 0.14] },
  chicken: { torsoLH: [1.38, 1.62], torsoWH: [1.38, 1.62], headHT: [0.76, 0.9], headWT: [0.92, 1.08], headLW: [1.12, 1.32], headHW: [0.51, 0.61], legT: [0.3, 0.36], headTop: [1.43, 1.69], muzzle: [0.16, 0.2], eyeH: [0.18, 0.22] },
};

/** The head as the sheet measures it: the head part (and for the chicken its beak, the "muzzle tip"). Horns, combs and ears are not head. */
function headCells(m: AnimalModel): VoxelMap[] {
  const c = m.cells;
  return [c.head, ...(m.species === 'chicken' ? [c.beak] : [])].filter(Boolean) as VoxelMap[];
}
export function proportions(m: AnimalModel): Record<Ratio, number> {
  const c = m.cells;
  const t = bbox(c.body), hd = bbox(...headCells(m)), hdNoBeak = bbox(c.head), eye = bbox(c.eye0);
  // Visible leg: from the ground to the torso's lowest voxel over that leg's footprint.
  const lg = bbox(c.leg0);
  let under = Infinity;
  for (const v of c.body.values()) if (v.x >= lg.x0 && v.x <= lg.x1 && v.z >= lg.z0 && v.z <= lg.z1) under = Math.min(under, v.y);
  if (!Number.isFinite(under)) under = t.y0;
  return {
    torsoLH: t.l / t.h, torsoWH: t.w / t.h, headHT: hdNoBeak.h / t.h, headWT: hdNoBeak.w / t.w, headLW: hd.l / hdNoBeak.w, headHW: hdNoBeak.h / hdNoBeak.w,
    legT: under / t.h, headTop: (hdNoBeak.y1 + 1) / (t.y1 + 1), muzzle: (hd.z1 - t.z1) / hd.l, eyeH: eye.h / hdNoBeak.h,
  };
}
export function ratioFails(m: AnimalModel): Ratio[] {
  const r = proportions(m), sheet = SHEET[m.species];
  return (Object.keys(sheet) as Ratio[]).filter((k) => r[k] < sheet[k][0] - 1e-9 || r[k] > sheet[k][1] + 1e-9);
}

// ---------- 4.2.5 the notch test ----------
export interface Notch { from: number; to: number; dip: number; spike: number; ok: boolean }
export function notch(m: AnimalModel): Notch {
  const c = m.cells;
  const top = new Map<number, number>();
  for (const map of [c.body, c.neck, c.head, c.hood]) if (map) for (const v of map.values()) top.set(v.z, Math.max(top.get(v.z) ?? -Infinity, v.y));
  const highestZ = (map: VoxelMap) => { let best = -Infinity, z = 0; for (const v of map.values()) if (v.y > best || (v.y === best && v.z > z)) { best = v.y; z = v.z; } return z; };
  const withers = highestZ(c.body), crown = highestZ(c.head);
  const [from, to] = withers < crown ? [withers, crown] : [crown, withers];
  const ends = Math.min(top.get(from) ?? 0, top.get(to) ?? 0);
  let dip = 0, spike = 0;
  for (let z = from; z <= to; z++) {
    const y = top.get(z) ?? -Infinity;
    dip = Math.max(dip, ends - y);
    if (z > from && z < to) spike = Math.max(spike, Math.min((top.get(z - 1) ?? y) - y, (top.get(z + 1) ?? y) - y));
  }
  return { from, to, dip, spike, ok: dip <= 2 && spike <= 2 };
}

// ---------- 4.2.4 roots ----------
const ROOTS: Record<string, 'head' | 'body'> = { ear0: 'head', ear1: 'head', horn0: 'head', horn1: 'head', comb: 'head', beard: 'head', tail: 'body', wing0: 'body', wing1: 'body' };
export interface Root { part: string; contact: number; spans: number[]; ok: boolean }
/**
 * A part is rooted when its cells that are inside or face-touching its parent number at least four and that patch
 * spans at least two voxels in two axes: a thin root (one voxel, or a one-voxel line) fails, a real join passes.
 */
export function roots(m: AnimalModel): Root[] {
  const c = m.cells, out: Root[] = [];
  for (const [name, parentName] of Object.entries(ROOTS)) {
    const p = c[name];
    if (!p || p.size === 0) continue;
    const parents = [c[parentName], parentName === 'head' ? c.hood : c.neck].filter(Boolean) as VoxelMap[];
    const touching = [...p.values()].filter((v) => parents.some((par) => par.has(key(v.x, v.y, v.z)) || N6.some(([dx, dy, dz]) => par.has(key(v.x + dx, v.y + dy, v.z + dz)))));
    const b = bbox(new Map(touching.map((v) => [key(v.x, v.y, v.z), v])));
    const spans = touching.length ? [b.w, b.h, b.l] : [0, 0, 0];
    out.push({ part: name, contact: touching.length, spans, ok: touching.length >= 4 && spans.filter((s) => s >= 2).length >= 2 });
  }
  return out;
}

// ---------- 4.4 the face rule ----------
export interface FaceCheck { part: string; off: number; belowChin: number; ok: boolean }
/** Every mouth, lid and brow voxel has a head (or muzzle) voxel directly behind it, toward the head's middle. */
export function faceRule(m: AnimalModel): FaceCheck[] {
  const c = m.cells, head = [c.head, c.muzzle, c.beak, c.snout, c.hood].filter(Boolean) as VoxelMap[];
  const hb = bbox(c.head);
  const centreX = (hb.x0 + hb.x1) / 2;
  // Lids lie on the eye plate (4.4: "lids cover the eye plate exactly"), so for them the eye is the face behind.
  const eyes = [c.eye0, c.eye1].filter(Boolean) as VoxelMap[];
  const behind = (x: number, y: number, z: number, onEye: boolean) => {
    const sx = x > centreX + 0.5 ? -1 : x < centreX - 0.5 ? 1 : 0;
    const spots = [[x, y, z - 1], ...(sx ? [[x + sx, y, z]] : [])];
    return spots.some(([a, b, d]) => [...head, ...(onEye ? eyes : [])].some((h) => h.has(key(a, b, d))));
  };
  const out: FaceCheck[] = [];
  const parts: [string, VoxelMap | undefined][] = [
    ...Object.entries(m.mouths).map(([k, p]) => [`mouth ${k}`, (p as { cells?: VoxelMap }).cells] as [string, VoxelMap | undefined]),
    ...Object.entries(m.lids).map(([k, p]) => [`lid ${k}`, (p as { cells?: VoxelMap }).cells] as [string, VoxelMap | undefined]),
    ...Object.entries(m.brows).map(([k, p]) => [`brow ${k}`, (p as { cells?: VoxelMap }).cells] as [string, VoxelMap | undefined]),
  ];
  for (const [name, cells] of parts) {
    if (!cells) continue;
    let off = 0, belowChin = 0;
    for (const v of cells.values()) { if (!behind(v.x, v.y, v.z, name.startsWith('lid'))) off++; if (v.y < hb.y0) belowChin++; }
    const chickenMouth = m.species === 'chicken' && name.startsWith('mouth') && name !== 'mouth o' && cells.size > 0;
    out.push({ part: name, off, belowChin, ok: off === 0 && belowChin === 0 && !chickenMouth });
  }
  return out;
}

// ---------- the chicken's shape (Brian's sheet, 2026-11-18) ----------
/** One tall box: the head as wide as the body and standing on it, flush at the front, the beak ahead of the face, the
 * tail lower than the head's top and behind the body. */
export function chickenOrientation(m: AnimalModel): { sameWidth: boolean; headOnTop: boolean; flushFront: boolean; beakAhead: boolean; tailLow: boolean; ok: boolean } {
  const c = m.cells, t = bbox(c.body), h = bbox(c.head), b = bbox(c.beak), tl = bbox(c.tail);
  const sameWidth = h.w === t.w, headOnTop = h.y0 === t.y1 + 1, flushFront = h.z1 === t.z1, beakAhead = b.z0 > h.z1, tailLow = tl.y1 < h.y1 && tl.z0 < t.z0;
  return { sameWidth, headOnTop, flushFront, beakAhead, tailLow, ok: sameWidth && headOnTop && flushFront && beakAhead && tailLow };
}

// ---------- the sheep's head (Brian's sheet, 2026-11-18) ----------
/** A face wider than tall, set into the fleece and standing proud of its front, under the fleece's top, ears out to the
 * sides three cells or more. */
export function sheepHead(m: AnimalModel): { wider: boolean; faceProud: boolean; underFleece: boolean; earsOut: boolean; ok: boolean } {
  const c = m.cells, h = bbox(c.head), t = bbox(c.body), e = bbox(c.ear0);
  const wider = h.w > h.h, faceProud = h.z1 > t.z1, underFleece = h.y1 <= bbox(c.body, c.hood).y1, earsOut = e.w >= 2;
  return { wider, faceProud, underFleece, earsOut, ok: wider && faceProud && underFleece && earsOut };
}

// ---------- 4.5 garments ----------
export interface GarmentCheck { missing: number; bare: number; bareMin: number; band: number; needsBand: boolean; nearHead: number; ok: boolean }
/**
 * The level-2 garment (V5.1 Part 4.5): the shell covers every exposed face of the torso in its zone above the belly
 * line (except where it would come within two voxels of the head or ears); the belly line leaves a third (pig, goat)
 * or a quarter (cow, horse) of the torso bare; the sweater and the vest have a neck band; no shell voxel within two
 * voxels of the head or ears. The sheep has no garment (its fleece is its lives).
 */
export function garmentCheck(m: AnimalModel): GarmentCheck | null {
  const g = m.garment;
  if (!g) return null;
  const body = m.cells.body, t = bbox(body);
  const z0 = Math.round(g.zFrom / S), z1 = Math.round(g.zTo / S), yb = Math.round(g.bellyY / S);
  const near = (x: number, y: number, z: number) => g.avoid.some((a) => { for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (a.has(key(x + dx, y + dy, z + dz))) return true; return false; });
  let missing = 0;
  const zc = (z0 + z1) / 2, zh = (z1 - z0) / 2;
  for (const v of body.values()) {
    if (v.z < z0 || v.z > z1 || v.y < yb) continue;
    if (g.kind === 'blanket-saddle' && Math.abs(v.z - zc) > zh - 2 && v.y < yb + 4) continue; // the saddle pad's rounded corners
    for (const [dx, dy, dz] of N6) {
      const x = v.x + dx, y = v.y + dy, z = v.z + dz;
      if (y < yb || body.has(key(x, y, z)) || g.shell.has(key(x, y, z)) || g.clear.some((c) => c.has(key(x, y, z)))) continue;
      if (!near(x, y, z)) missing++;
    }
  }
  let nearHead = 0;
  for (const v of g.shell.values()) if (near(v.x, v.y, v.z)) nearHead++;
  const bare = (yb - t.y0) / t.h;
  const bareMin = m.species === 'pig' || m.species === 'goat' ? 1 / 3 : m.species === 'chicken' ? 0 : 1 / 4;
  const needsBand = g.kind === 'sweater' || g.kind === 'vest';
  const ok = missing === 0 && bare >= bareMin - 1e-9 && (!needsBand || g.band.size > 0) && nearHead === 0;
  return { missing, bare, bareMin, band: g.band.size, needsBand, nearHead, ok };
}
