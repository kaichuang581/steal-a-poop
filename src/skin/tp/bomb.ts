import { CanvasTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { meshModel, toGeometry } from '../dream/models';
import type { ModelData } from './models.gen';
import { COLOURS, MODELS, PARTS, flatGlow, flatLit, partBit } from './models';
import { FUSE_STEPS, GLOW, SKINS } from './models.gen';
import type { SkinData } from './models.gen';

/**
 * The bomb (docs/trading-post-practice/T2): one anatomy, eight skins, loaded from the pack. Built once per skin as a
 * mesh per part, so the game can hide the maker's mark, burn the fuse piece by piece and move the spark without
 * rebuilding. The seconds are a texture on the flat face, redrawn only when the number changes.
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

/** The centre of fuse piece k, in cells: from the cap's top, one step of the path per piece. */
export function fuseCentre(skin: SkinData, k: number): [number, number] {
  let x = 0, y = skin.cap_top_cells;
  for (let i = 0; i <= k; i++) { x += FUSE_STEPS[i][0]; y += FUSE_STEPS[i][1]; }
  return [x, y];
}

/** A model of only some boxes of another, under a new name: one fuse piece, the spark. */
function subModel(m: ModelData, keep: (b: readonly number[]) => boolean): ModelData {
  return { ...m, boxes: m.boxes.filter(keep) };
}

/** Each fuse cell goes to the piece nearest the cap whose 2-cell cube holds it, so a piece stays whole until it burns. */
function fusePieces(id: string, skin: SkinData): ModelData[] {
  const m = MODELS[id], fuse = PARTS.indexOf('fuse');
  const centres = Array.from({ length: FUSE_PIECES }, (_, k) => fuseCentre(skin, k));
  const out: number[][][] = centres.map(() => []);
  for (const b of m.boxes) {
    if (b[7] !== fuse) continue;
    for (let x = b[0]; x < b[3]; x++) for (let y = b[1]; y < b[4]; y++) for (let z = b[2]; z < b[5]; z++) {
      let k = centres.findIndex(([cx, cy]) => x >= cx - 1 && x < cx + 1 && y >= cy - 1 && y < cy + 1);
      if (k < 0) k = nearest(centres, x + 0.5, y + 0.5);
      out[k].push([x, y, z, x + 1, y + 1, z + 1, b[6], b[7], b[8]]);
    }
  }
  return out.map((boxes) => ({ ...m, boxes }));
}
const nearest = (c: [number, number][], x: number, y: number) => c.reduce((best, [cx, cy], k) => (Math.hypot(cx - x, cy - y) < Math.hypot(c[best][0] - x, c[best][1] - y) ? k : best), 0);

export interface BombObject {
  group: Group;
  /** The seconds on the face, or null for the maker's mark (the Trading Post) or nothing. */
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
 * A bomb of a skin. `emblem` shows the maker's mark (the Trading Post, the Barn Book); in a game it is hidden and the
 * face shows the seconds. `lit` lets a scene with real lights pass its own material for the shaded parts.
 */
export function makeBomb(skinKey: string, o: { emblem?: boolean; lit?: Material } = {}): BombObject {
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
  const emblem = mesh('emblem', m, partBit('emblem'));
  // Under the mark, the face itself: the mark's cells in the face's colour, shown when the mark is hidden (in a game).
  const faceTok = skin.face_colour, ci = COLOURS.indexOf(faceTok) >= 0 ? COLOURS.indexOf(faceTok) : COLOURS.length;
  const blankColours = ci === COLOURS.length ? [...COLOURS, faceTok] : COLOURS;
  const em = PARTS.indexOf('emblem');
  const blankData = { ...m, boxes: m.boxes.filter((b) => b[7] === em).map((b) => [b[0], b[1], b[2], b[3], b[4], b[5], ci, b[7], b[8]]) };
  const blankMm = meshModel(`tpb:${skin.key}:blank`, blankData, blankColours, GLOW, { festive: true, back: true });
  const blank = new Group();
  if (blankMm.lit.idx.length) blank.add(new Mesh(toGeometry(blankMm.lit), lit));
  if (blankMm.glow.idx.length) blank.add(new Mesh(toGeometry(blankMm.glow), flatGlow));
  group.add(blank);
  const pieces = fusePieces(id, skin).map((p, k) => mesh(`fuse${k}`, p, 0));
  const spark = new Group();
  const sparkBody = mesh('spark', subModel(m, (b) => b[7] === PARTS.indexOf('spark')), 0);
  group.remove(sparkBody);
  // The spark's boxes sit round the fuse's end (piece 12): carry them in a group whose origin is that end.
  const [tx, ty] = fuseCentre(skin, FUSE_PIECES - 1);
  sparkBody.position.set(-tx * CELL, -ty * CELL, 0);
  spark.add(sparkBody);
  group.add(spark);

  // The seconds: a square of canvas over the face, as wide as the face.
  const face = skin.face, r = face.radius_cells * CELL;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex: CanvasTexture | null = null;
  let digits: Mesh | null = null;
  if (canvas) {
    canvas.width = canvas.height = 128;
    tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    digits = new Mesh(new PlaneGeometry(r * 2, r * 2), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    digits.position.set(face.centre_cells[0] * CELL, face.centre_cells[1] * CELL, (face.centre_cells[2] + 0.05) * CELL);
    digits.visible = false;
    group.add(digits);
  }
  let shown = '';
  const showEmblem = o.emblem ?? false;
  emblem.visible = showEmblem;
  blank.visible = !showEmblem;

  const api: BombObject = {
    group, skin, centreY: 10 * CELL,
    setSeconds(n, danger = false) {
      const text = n === null ? '' : `${Math.max(0, Math.ceil(n))}|${danger ? 1 : 0}`;
      emblem.visible = n === null && showEmblem;
      blank.visible = !emblem.visible;
      if (!digits || !canvas || !tex) return;
      digits.visible = n !== null;
      if (text === shown || n === null) { shown = text; return; }
      shown = text;
      const s = String(Math.max(0, Math.ceil(n)));
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 128);
      // 74% of the face's height for one digit, 60% for two (T2, section 1).
      ctx.font = `800 ${Math.round(128 * (s.length > 1 ? 0.6 : 0.74))}px Fraunces, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = (danger ? skin.danger_digit : skin.digit).replace(/^lit:/, '');
      ctx.fillText(s, 64, 70);
      tex.needsUpdate = true;
    },
    setFuse(share) {
      const n = fusePiecesFor(share);
      pieces.forEach((p, k) => { p.visible = k < n; });
      spark.visible = n > 0;
      if (n > 0) { const [x, y] = fuseCentre(skin, n - 1); spark.position.set(x * CELL, y * CELL, 0); }
    },
    setSpark(scale) { spark.scale.setScalar(scale); },
  };
  api.setFuse(1);
  return api;
}
