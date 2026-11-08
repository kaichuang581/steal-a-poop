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
export const SHEET: Record<Species, Record<Ratio, Range>> = {
  // The muzzle's range for the cow, horse and goat is the one their own sheets give (5.3 to 5.5: a neck buried three
  // voxels in the chest and three in the head puts the muzzle 1.15 to 1.25 head lengths ahead of the chest). The table's
  // 0.6 to 1.0 cannot be met with a neck at all; the conflict is written up in docs/skin/animals-v5_1 for Brian.
  // The eye-height row for the sheep, cow and goat follows Brian's small, simple eyes (2026-11-07: no whites), which
  // replace the plan's 4 x 4 and 5 x 5 plates on the sheep, cow, horse and goat: 0.20 of the head or more.
  // The chicken's head (Brian, 2026-11-07): nearer the breast and with a two-step beak, so its beak's reach is 0.6 to 1.0
  // of the head and the head with its beak 1.0 to 1.3 as long as it is wide; its eyes are the small ones too.
  sheep: { torsoLH: [1.4, 1.55], torsoWH: [1.05, 1.2], headHT: [0.5, 0.62], headWT: [0.6, 0.72], headLW: [0.8, 1.0], headHW: [0.7, 0.85], legT: [0.4, 0.55], headTop: [1.0, 1.1], muzzle: [0.55, 0.75], eyeH: [0.2, 9] },
  pig: { torsoLH: [1.4, 1.55], torsoWH: [1.0, 1.15], headHT: [0.75, 0.85], headWT: [0.72, 0.82], headLW: [0.75, 0.9], headHW: [0.95, 1.05], legT: [0.3, 0.45], headTop: [0.95, 1.08], muzzle: [0.45, 0.6], eyeH: [0.36, 9] },
  cow: { torsoLH: [1.65, 1.8], torsoWH: [0.95, 1.1], headHT: [0.55, 0.65], headWT: [0.58, 0.68], headLW: [1.1, 1.25], headHW: [0.85, 1.0], legT: [0.45, 0.6], headTop: [0.9, 1.0], muzzle: [1.1, 1.3], eyeH: [0.2, 9] },
  horse: { torsoLH: [1.85, 2.0], torsoWH: [0.8, 0.95], headHT: [0.5, 0.6], headWT: [0.5, 0.6], headLW: [1.7, 1.95], headHW: [1.1, 1.25], legT: [0.7, 0.85], headTop: [1.3, 1.45], muzzle: [1.1, 1.3], eyeH: [0.2, 9] },
  goat: { torsoLH: [1.5, 1.65], torsoWH: [0.9, 1.05], headHT: [0.5, 0.6], headWT: [0.48, 0.58], headLW: [1.25, 1.45], headHW: [1.0, 1.15], legT: [0.55, 0.7], headTop: [1.15, 1.3], muzzle: [1.1, 1.3], eyeH: [0.2, 9] },
  chicken: { torsoLH: [1.6, 1.75], torsoWH: [0.95, 1.1], headHT: [0.7, 0.85], headWT: [0.65, 0.8], headLW: [1.0, 1.3], headHW: [0.95, 1.05], legT: [0.45, 0.6], headTop: [1.2, 1.4], muzzle: [0.6, 1.0], eyeH: [0.2, 9] },
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
const ROOTS: Record<string, 'head' | 'body'> = { ear0: 'head', ear1: 'head', horn0: 'head', horn1: 'head', comb: 'head', beard: 'head', wattle: 'head', beak: 'head', tail: 'body', wing0: 'body', wing1: 'body' };
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

// ---------- 5.6 the chicken's orientation ----------
export function chickenOrientation(m: AnimalModel): { torsoLH: number; headAhead: boolean; tailHighest: boolean; ok: boolean } {
  const c = m.cells, t = bbox(c.body), h = bbox(c.head);
  const hy = Math.round((h.y0 + h.y1) / 2), hz = (h.z0 + h.z1) / 2;
  let front = -Infinity;
  for (const v of c.body.values()) if (v.y === hy) front = Math.max(front, v.z);
  if (!Number.isFinite(front)) front = t.z1;
  const tailTop = bbox(c.tail).y1;
  const others = Object.entries(c).filter(([k]) => !['tail', 'comb'].includes(k)).map(([, v]) => bbox(v).y1).filter(Number.isFinite);
  const torsoLH = t.l / t.h, headAhead = hz > front, tailHighest = others.every((y) => tailTop >= y);
  return { torsoLH, headAhead, tailHighest, ok: torsoLH >= 1.6 && headAhead && tailHighest };
}

// ---------- 7.8 the sheep's head ----------
export function sheepHead(m: AnimalModel): { wider: boolean; muzzleAbove: boolean; topNearBack: boolean; earsLong: boolean; ok: boolean } {
  const c = m.cells, h = bbox(c.head), t = bbox(c.body), e = bbox(c.ear0);
  const wider = h.w > h.h, muzzleAbove = h.y0 > (t.y0 + t.y1) / 2, topNearBack = Math.abs(h.y1 - t.y1) <= 2, earsLong = Math.max(e.w, e.l) >= 4;
  return { wider, muzzleAbove, topNearBack, earsLong, ok: wider && muzzleAbove && topNearBack && earsLong };
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
