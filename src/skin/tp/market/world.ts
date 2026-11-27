import { AdditiveBlending, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial } from 'three';
import type { Material } from 'three';
import { FESTIVE } from '../../../config';
import { Gather, meshModel, toGeometry, tokenColour } from '../../dream/models';
import type { Arrays } from '../../dream/models';
import * as DREAM from '../../dream/models.gen';
import { makeBomb, SKIN_OF } from '../bomb';
import { BURST_OF, drawIn, fitSpread, standSize } from '../burst';
import { addModels, COLOURS, MODELS, PARTS } from '../models';

addModels(MARKET_MODELS);
import { BURST_COLOURS, BURSTS } from '../models.gen';
import { MARKET, MARKET_MODELS } from '../market.gen';
import type { Item } from '../../shop/catalog';

/**
 * The market row (docs/trading-post-practice/T1): every model the pack places, merged into one mesh a stop (and one for
 * the far farm), drawn unlit with the mesher's face light, tinted by depth and hazed. What moves or changes (the sacks,
 * the bench, the big bell, the book, the items) is built apart by the screen from the helpers here.
 */
export type StopId = 'sacks' | 'bells' | 'missions' | 'book';
export const STOPS: StopId[] = ['sacks', 'bells', 'missions', 'book'];
export const STOP_X: Record<StopId, number> = MARKET.stops_x_m;

const TZ = MARKET.tint_at_z;
/** How much of its paint a thing keeps at a depth (T1 section 4): straight lines between the table's points. */
export function tintAt(z: number): number {
  const zs = TZ.z, ts = TZ.tint;
  if (z <= zs[0]) return ts[0];
  for (let i = 1; i < zs.length; i++) if (z <= zs[i]) return ts[i - 1] + ((ts[i] - ts[i - 1]) * (z - zs[i - 1])) / (zs[i] - zs[i - 1]);
  return ts[ts.length - 1];
}

/** The two materials of the row: lit faces keep the mesher's face light, glowing boxes are their own colour. */
export function rowMaterials(): { lit: MeshBasicMaterial; glow: MeshBasicMaterial } {
  // Dusk: a warm cast over everything the lanterns light (T1 section 4's face light, as a balance, not pasted in).
  return { lit: new MeshBasicMaterial({ vertexColors: true, color: new Color(1, 0.93, 0.86) }), glow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }) };
}

const tpMesh = (id: string, parts = 0) => meshModel(`tp:${id}:${parts}`, MODELS[id], COLOURS, DREAM.GLOW, { festive: FESTIVE, parts, back: true });
export const tpPart = (...names: string[]) => names.reduce((m, n) => m | (1 << PARTS.indexOf(n)), 0);
const dreamPart = (...names: string[]) => names.reduce((m, n) => m | (1 << DREAM.PARTS.indexOf(n)), 0);

/** A model's mesh at a place, from the pack or (Home's own farm) the dream's copy, scaled to a height if asked. */
const DREAM_ID: Record<string, string> = { pine_spire: 'pineSpire', pine_cone: 'pineCone', pine_round: 'pineRound', barn: 'barn', silo: 'silo', farmhouse: 'farmhouse', fenceBay: 'fenceBay' };
const PINE_H: Record<string, number> = { pine_spire: 7, pine_cone: 5.5, pine_round: 6.5 };
function placed(id: string, parts?: readonly string[]) {
  // The pack's own copy wins (the fence bay, given form by the packer); the rest of Home's farm is the dream's.
  const did = MODELS[id] ? undefined : DREAM_ID[id];
  if (!did) return { mm: tpMesh(id, parts ? tpPart(...parts) : 0), scale: 1 };
  const m = DREAM.MODELS[did];
  const mm = meshModel(`tpd:${did}:${parts?.join() ?? ''}`, m, DREAM.COLOURS, DREAM.GLOW, { festive: FESTIVE, parts: parts ? dreamPart(...parts) : 0, ao: false });
  const h = (m.bounds[4] - m.bounds[1]) * m.cell;
  return { mm, scale: PINE_H[id] ? PINE_H[id] / h : 1 };
}

/** Which stop a thing at x belongs to (for drawing only the stop on screen and its neighbours). */
export const stopAt = (x: number): StopId => (x < 3.9 ? 'sacks' : x < 9.8 ? 'bells' : x < 15.5 ? 'missions' : 'book');

/** Models the screen builds itself: the sacks and crates (they move), the bench items, the big bell, the book. */
const DYNAMIC = /^(sack_|sackCrate_|bomb_|bigBell|barnBook)/;

export interface Row { far: Group; stops: Record<StopId, Group>; sprites: Sprite[] }

/** Builds the still part of the row. */
export function buildRow(mats: { lit: Material; glow: Material }): Row {
  const far = { lit: new Gather(), glow: new Gather() };
  const stops = Object.fromEntries(STOPS.map((s) => [s, { lit: new Gather(), glow: new Gather() }])) as Record<StopId, { lit: Gather; glow: Gather }>;
  const sprites: Sprite[] = [];
  for (const it of MARKET.items) {
    if (DYNAMIC.test(it.model)) continue;
    const parts = 'parts' in it ? (it.parts as readonly string[] | null) ?? undefined : undefined;
    const { mm, scale } = placed(it.model, parts);
    const tint = it.tint ?? tintAt(it.z);
    const into = it.z < -3 ? far : stops[stopAt(it.x)];
    into.lit.add(mm.lit, it.x, it.y, it.z, tint, [scale, scale, scale]);
    if (!parts) into.glow.add(mm.glow, it.x, it.y, it.z, 1, [scale, scale, scale]);
    const m = MODELS[it.model];
    if (m) for (const l of m.lights) sprites.push(glowSprite(COLOURS[l[3]], l[4], l[5], it.x + l[0] * m.cell, it.y + l[1] * m.cell, it.z + l[2] * m.cell + 0.05));
  }
  for (const b of MARKET.raw_boxes) {
    if (/season/.test(b.note) && !FESTIVE) continue;
    const [x0, , z0] = b.b;
    const into = b.note === 'snow' ? far : stops[stopAt(x0)];
    const glowing = b.c.startsWith('glow:');
    (glowing ? into.glow : into.lit).box(b.b, tokenColour(b.c, DREAM.GLOW, FESTIVE), glowing ? 1 : b.tint ?? tintAt(z0), glowing);
  }
  const mesh = (g: { lit: Gather; glow: Gather }) => {
    const out = new Group();
    if (!g.lit.empty) out.add(new Mesh(g.lit.geometry(), mats.lit));
    if (!g.glow.empty) out.add(new Mesh(g.glow.geometry(), mats.glow));
    return out;
  };
  return { far: mesh(far), stops: Object.fromEntries(STOPS.map((s) => [s, mesh(stops[s])])) as Record<StopId, Group>, sprites };
}

let glowTex: CanvasTexture | null = null;
/** A lantern's glow: a soft additive disc, never a real light (T1 section 4). */
export function glowSprite(token: string, radius: number, strength: number, x: number, y: number, z: number): Sprite {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    glowTex = new CanvasTexture(c);
  }
  const hex = token.startsWith('glow:') ? DREAM.GLOW[token.slice(5)] : token.replace(/^lit:/, '');
  const s = new Sprite(new SpriteMaterial({ map: glowTex, color: new Color(hex ?? '#FFD38F'), blending: AdditiveBlending, transparent: true, opacity: strength, depthWrite: false, toneMapped: false, fog: false }));
  s.position.set(x, y, z);
  s.scale.setScalar(radius * 2);
  return s;
}

/** One model as a group (lit and glow meshes), tinted, or a part of it. */
export function modelGroup(id: string, mats: { lit: Material; glow: Material }, parts = 0): Group {
  const mm = tpMesh(id, parts), g = new Group();
  if (mm.lit.idx.length) g.add(new Mesh(toGeometry(mm.lit), mats.lit));
  if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), mats.glow));
  return g;
}

/** A part's rectangle in a model, metres from its origin: x0, y0, x1, y1 and its front z. */
export function partRect(id: string, part: string): { x0: number; y0: number; x1: number; y1: number; z: number } {
  const m = MODELS[id], p = PARTS.indexOf(part), r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, z: -Infinity };
  for (const b of m.boxes) if (b[7] === p) { r.x0 = Math.min(r.x0, b[0]); r.y0 = Math.min(r.y0, b[1]); r.x1 = Math.max(r.x1, b[3]); r.y1 = Math.max(r.y1, b[4]); r.z = Math.max(r.z, b[5]); }
  return { x0: r.x0 * m.cell, y0: r.y0 * m.cell, x1: r.x1 * m.cell, y1: r.y1 * m.cell, z: r.z * m.cell };
}

// ---------------------------------------------------------------- items

const SOUND_OF: Record<string, string> = {
  'tick-chime': 'iceChime', 'tick-8bit': 'eightBit', 'tick-wood': 'woodBlock', 'tick-cowbell': 'cowbell',
  'tick-sleigh': 'sleighBells', 'tick-musicbox': 'musicBox', 'tick-owl': 'owl', 'tick-lullaby': 'lullaby',
};
/** The pack's model of a catalogue item. */
export const modelOf = (item: Item): string => item.kind === 'bomb' ? `bomb_${SKIN_OF[item.id] ?? 'ice'}` : item.kind === 'tick' ? `sound_${SOUND_OF[item.id] ?? 'iceChime'}` : '';

// A step darker than the pack's `trimWhite -2`: on the book's paper that was nearly the page, and six of eight pockets
// read as blank cards (Brian, 2026-11-25).
const CUT = new Color('#B5A286');
/**
 * Where a burst is shown and the box it must fit, metres (ITEMS_REMODEL.md rule 7: drawn in, never shrunk; T3 section 3):
 * a bench slot (seven share 3.6 m), a Barn Book frame (0.5 by 0.65 m, the item at 80%), the Bell Shelf's stand (1.6 times
 * as large). `most` is the plan's draw-in; a wide or tall burst is drawn in further, to fit.
 */
export const SLOT = {
  bench: { w: 0.48, h: 0.62, most: 0.42, stand: 1 },
  book: { w: 0.6, h: 0.78, most: 0.42, stand: 1 },
  shelf: { w: 0.9, h: 0.75, most: 0.67, stand: 1.6 },
} as const;
export type Slot = keyof typeof SLOT;
export const spreadFor = (key: string, slot: Slot): number => fitSpread(key, SLOT[slot].w, SLOT[slot].h, SLOT[slot].most);
const cache = new Map<string, { lit: Arrays; glow: Arrays }>();
/** A burst at its fullest, drawn in over its stand (T3 section 3): a dark disc with a brass rim, 0.4 m across (x1.6 on the shelf). */
function burstArrays(key: string, slot: Slot): { lit: Arrays; glow: Arrays } {
  const lit = new Gather(), glow = new Gather(), k = SLOT[slot].stand, spread = spreadFor(key, slot);
  const iron = tokenColour('iron:-1', DREAM.GLOW), brass = tokenColour('brass:0', DREAM.GLOW);
  lit.box([-0.2 * k, 0, -0.2 * k, 0.2 * k, 0.03, 0.2 * k], brass);
  lit.box([-0.18 * k, 0.03, -0.18 * k, 0.18 * k, 0.045, 0.18 * k], iron);
  const data = BURSTS[key] ?? BURSTS.frost, at = drawIn(key, spread);
  for (const b of data.boxes_at_fullest) {
    const c = new Color(data.colours[b[6]] ?? BURST_COLOURS[b[6]] ?? '#FFFFFF');
    const [x, y, z] = at([b[0] + b[3] / 2, b[1] + b[4] / 2, b[2] + b[5] / 2]), [w, h, d] = [b[3], b[4], b[5]].map((v) => standSize(v, spread));
    (b[7] ? glow : lit).box([x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2], [c.r, c.g, c.b], 1, b[7]);
  }
  return { lit: lit.a, glow: glow.a };
}

/**
 * An item as it stands in the market: the real model (a burst over its stand), or a flat paper cut-out of its own shape
 * (every box `trimWhite -2`, unshaded) for one not found in the Barn Book.
 */
export function itemGroup(item: Item, mats: { lit: Material; glow: Material; flat: Material }, cut = false, slot: Slot = 'bench'): Group {
  // A bomb shows 10 on its face outside a game (T2, ITEMS_REMODEL.md): the built bomb, not the bare model.
  if (item.kind === 'bomb' && !cut) { const b = makeBomb(SKIN_OF[item.id] ?? 'ice', { rest: true, lit: mats.lit }); b.group.userData.item = item.id; return b.group; }
  const key = `${item.id}|${cut}|${slot}`;
  let a = cache.get(key);
  if (!a) {
    const full = item.kind === 'blast' ? burstArrays(BURST_OF[item.id] ?? 'frost', slot) : (() => { const mm = tpMesh(modelOf(item)); return { lit: mm.lit, glow: mm.glow }; })();
    if (cut) {
      const pos = [...full.lit.pos, ...full.glow.pos], n = full.lit.pos.length / 3;
      a = { lit: { pos, nor: [...full.lit.nor, ...full.glow.nor], col: pos.map((_, i) => [CUT.r, CUT.g, CUT.b][i % 3]), idx: [...full.lit.idx, ...full.glow.idx.map((i) => i + n)] }, glow: { pos: [], nor: [], col: [], idx: [] } };
    } else a = full;
    cache.set(key, a);
  }
  const g = new Group();
  if (a.lit.idx.length) g.add(new Mesh(toGeometry(a.lit), cut ? mats.flat : mats.lit));
  if (a.glow.idx.length) g.add(new Mesh(toGeometry(a.glow), mats.glow));
  g.userData.item = item.id;
  return g;
}

/** How tall an item stands, metres: for laying a tag or a button over it. */
export const itemHeight = (item: Item): number => item.kind === 'blast' ? 0.55 : (MODELS[modelOf(item)]?.size[1] ?? 0.5);
export const itemWidth = (item: Item): number => item.kind === 'blast' ? 0.4 : (MODELS[modelOf(item)]?.size[0] ?? 0.5);
