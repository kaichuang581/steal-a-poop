import { CanvasTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { meshModel, toGeometry } from '../dream/models';
import type { ModelData } from './models.gen';
import { COLOURS, MODELS, PARTS, flatGlow, flatLit, partBit } from './models';
import { GLOW, SKINS } from './models.gen';
import type { SkinData } from './models.gen';

/**
 * The bomb (docs/trading-post-practice/T2): one anatomy, eight skins, loaded from the pack. Built once per skin as a
 * mesh per part, so the game can burn the fuse piece by piece and move the spark without rebuilding. The seconds are a texture on the flat face, redrawn only when the number changes.
 */

/** A catalogue id (shop/catalog.ts) to the pack's skin key. */
export const SKIN_OF: Record<string, string> = {
  'bomb-ice': 'ice', 'bomb-ember': 'ember', 'bomb-mint': 'peppermint', 'bomb-plum': 'plum',
  'bomb-gold': 'gold', 'bomb-diamond': 'diamond', 'bomb-brass': 'brassBell', 'bomb-aurora': 'aurora',
};
export const skinOf = (itemId: string): SkinData => SKINS[SKIN_OF[itemId] ?? 'ice'] ?? SKINS.ice;

export const CELL = 0.025;
export const FUSE_PIECES = 12;
/** The share of a turn left to the fuse pieces shown (T2 section 1): ceil(12 s), at least 1 while any is left. */
export const fusePiecesFor = (share: number): number => Math.max(share > 0 ? 1 : 0, Math.min(FUSE_PIECES, Math.ceil(FUSE_PIECES * share - 1e-9)));

/** Fuse piece k's cube, in cells: its low corner (the first piece's corner plus k's step, in 2-cell units) and size. */
export function fuseCube(skin: SkinData, k: number): { at: [number, number, number]; size: number } {
  const n = skin.fuse_piece_cells, [sx, sy, sz] = skin.fuse_start_cells, [dx, dy] = skin.fuse_pieces[k];
  return { at: [sx + dx * n, sy + dy * n, sz], size: n };
}
/** The middle of fuse piece k, in cells. */
export function fuseCentre(skin: SkinData, k: number): [number, number] {
  const { at, size } = fuseCube(skin, k);
  return [at[0] + size / 2, at[1] + size / 2];
}

/** Each fuse box goes to the piece whose cube holds it (ITEMS_REMODEL.md: every piece one 2 x 2 x 2 block). */
function fusePieces(id: string, skin: SkinData): ModelData[] {
  const m = MODELS[id], fuse = PARTS.indexOf('fuse');
  const cubes = Array.from({ length: FUSE_PIECES }, (_, k) => fuseCube(skin, k));
  const out: number[][][] = cubes.map(() => []);
  for (const b of m.boxes) {
    if (b[7] !== fuse) continue;
    const k = cubes.findIndex(({ at: [x, y], size }) => b[0] >= x && b[3] <= x + size && b[1] >= y && b[4] <= y + size);
    out[k < 0 ? FUSE_PIECES - 1 : k].push([...b]);
  }
  return out.map((boxes) => ({ ...m, boxes }));
}

/** A model of only some boxes of another: the spark. */
function subModel(m: ModelData, keep: (b: readonly number[]) => boolean): ModelData {
  return { ...m, boxes: m.boxes.filter(keep) };
}

export interface BombObject {
  group: Group;
  /** The seconds on the face, or null: 10 for a bomb at rest, nothing in a game between turns. */
  setSeconds(n: number | null, danger?: boolean): void;
  /** The share of the turn left: shows ceil(12 s) fuse pieces and puts the spark on the last. */
  setFuse(share: number): void;
  /** The spark's size (1.6 in the last 3 seconds). */
  setSpark(scale: number): void;
  skin: SkinData;
  /** The shell's middle above the ground, metres. */
  centreY: number;
}

/**
 * A bomb of a skin. In a game its face shows the seconds; outside one (`rest`: the Trading Post, the Barn Book, the
 * lobby) it shows 10, the bomb as a turn starts (T2, ITEMS_REMODEL.md: there is no maker's mark). `lit` lets a scene
 * with real lights pass its own material for the shaded parts.
 */
export function makeBomb(skinKey: string, o: { rest?: boolean; lit?: Material } = {}): BombObject {
  const skin = SKINS[skinKey] ?? SKINS.ice, id = `bomb_${skin.key}`, m = MODELS[id];
  const lit = o.lit ?? flatLit;
  const group = new Group();
  group.name = id;
  const mesh = (key: string, data: ModelData, parts: number) => {
    const mm = meshModel(`tpb:${skin.key}:${key}`, data, COLOURS, GLOW, { festive: true, back: true, parts });
    const g = new Group();
    if (mm.lit.idx.length) g.add(new Mesh(toGeometry(mm.lit), lit));
    if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), flatGlow));
    group.add(g);
    return g;
  };
  mesh('body', m, partBit('shell', 'detail', 'face', 'cap'));
  const pieces = fusePieces(id, skin).map((p, k) => mesh(`fuse${k}`, p, 0));
  // The spark is the burning tip: it replaces the last piece shown. Its boxes sit round the last piece in the data,
  // so they ride in a group whose origin is that piece's middle.
  const spark = new Group();
  const sparkBody = mesh('spark', subModel(m, (b) => b[7] === PARTS.indexOf('spark')), 0);
  group.remove(sparkBody);
  const [tx, ty] = fuseCentre(skin, FUSE_PIECES - 1);
  sparkBody.position.set(-tx * CELL, -ty * CELL, 0);
  spark.add(sparkBody);
  group.add(spark);

  // The seconds: a square of canvas over the face disc, as wide as the disc.
  const face = skin.face, r = face.size_m / 2;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex: CanvasTexture | null = null;
  let digits: Mesh | null = null;
  if (canvas) {
    canvas.width = canvas.height = 128;
    tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    digits = new Mesh(new PlaneGeometry(r * 2, r * 2), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    digits.position.set(face.centre_cells[0] * CELL, face.centre_cells[1] * CELL, face.centre_cells[2] * CELL + 0.002);
    digits.visible = false;
    group.add(digits);
  }
  let shown = '';
  const draw = (n: number, danger: boolean) => {
    const text = `${n}|${danger ? 1 : 0}`;
    if (!digits || !canvas || !tex) return;
    digits.visible = true;
    if (text === shown) return;
    shown = text;
    const s = String(n);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    // 74% of the face's height for one digit, 60% for two (T2, section 1).
    ctx.font = `800 ${Math.round(128 * (s.length > 1 ? 0.6 : 0.74))}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = (danger ? skin.danger_digit : skin.digit).replace(/^lit:/, '');
    ctx.fillText(s, 64, 70);
    tex.needsUpdate = true;
  };

  const api: BombObject = {
    group, skin, centreY: 10 * CELL,
    setSeconds(n, danger = false) {
      if (n === null) { if (o.rest) draw(10, false); else if (digits) digits.visible = false; return; }
      draw(Math.max(0, Math.ceil(n)), danger);
    },
    setFuse(share) {
      const n = fusePiecesFor(share);
      pieces.forEach((p, k) => { p.visible = k < n - 1; });
      spark.visible = n > 0;
      if (n > 0) { const [x, y] = fuseCentre(skin, n - 1); spark.position.set(x * CELL, y * CELL, 0); }
    },
    setSpark(scale) { spark.scale.setScalar(scale); },
  };
  api.setSeconds(null);
  api.setFuse(1);
  return api;
}
