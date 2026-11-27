import { Group, Mesh } from 'three';
import type { BufferGeometry, Material } from 'three';
import { meshModel, toGeometry } from '../dream/models';
import { secondsModel } from './digits';
import type { ModelData } from './models.gen';
import { COLOURS, MODELS, PARTS, flatGlow, flatLit, partBit } from './models';
import { GLOW, SKINS } from './models.gen';
import type { SkinData } from './models.gen';

/**
 * The bomb (docs/trading-post-practice/T2): one anatomy, eight skins, loaded from the pack. Built once per skin as a
 * mesh per part, so the game can burn the fuse piece by piece and move the spark without rebuilding. The seconds are
 * cubes too (digits.ts): half the bomb's cube, standing half a cube proud of the face, one small mesh a number.
 */

/** A catalogue id (shop/catalog.ts) to the pack's skin key. */
export const SKIN_OF: Record<string, string> = {
  'bomb-ice': 'ice', 'bomb-ember': 'ember', 'bomb-mint': 'peppermint', 'bomb-plum': 'plum',
  'bomb-gold': 'gold', 'bomb-diamond': 'diamond', 'bomb-brass': 'brassBell', 'bomb-aurora': 'aurora',
};
export const skinOf = (itemId: string): SkinData => SKINS[SKIN_OF[itemId] ?? 'ice'] ?? SKINS.ice;

/** The bomb's cube: 16 across (the packer's `BOMB_CELL`; Brian, 2026-11-25: the pack's 20 were "a tad bit too high voxelrate"). */
export const CELL = 0.03125;
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

/** The seconds' cube: half the bomb's, so two digits fit the face's six cubes. */
const SUB = CELL / 2;
/** A number in a colour, meshed once for every bomb that shows it. A colour that gives light ("lit:#hex") comes back as `glow`. */
const seconds = new Map<string, { lit?: BufferGeometry; glow?: BufferGeometry; w: number; h: number }>();
function secondsGeometry(n: number, colour: string) {
  const key = `${n}|${colour}`;
  let made = seconds.get(key);
  if (!made) {
    const { data, w, h } = secondsModel(n, SUB);
    const mm = meshModel(`tpd:${key}`, data, [colour], GLOW, { festive: true });
    made = { lit: mm.lit.idx.length ? toGeometry(mm.lit) : undefined, glow: mm.glow.idx.length ? toGeometry(mm.glow) : undefined, w, h };
    seconds.set(key, made);
  }
  return made;
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
  const mesh = (key: string, data: ModelData, parts: number, ao = true) => {
    const mm = meshModel(`tpb:${skin.key}:${key}`, data, COLOURS, GLOW, { festive: true, back: true, parts, ao });
    const g = new Group();
    if (mm.lit.idx.length) g.add(new Mesh(toGeometry(mm.lit), lit));
    if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), flatGlow));
    group.add(g);
    return g;
  };
  mesh('body', m, partBit('shell', 'detail', 'cap'));
  // The face is meshed by itself and without corner shade: the shade of its rim, spread over so small a plate, read as
  // an airbrushed glow behind the number. It is a flat plate in its own colour, as Ember's lit one always was.
  mesh('face', m, partBit('face'), false);
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

  // The seconds: a number's cubes, centred on the face and standing on it. Each number is meshed the first time it
  // is shown and kept; only the one showing is visible.
  const face = skin.face, numbers = new Map<string, Group>();
  let showing: Group | null = null;
  const draw = (n: number, danger: boolean) => {
    const key = `${n}|${danger ? 1 : 0}`;
    let g = numbers.get(key);
    if (!g) {
      const { lit: a, glow: c, w, h } = secondsGeometry(n, danger ? skin.danger_digit : skin.digit);
      g = new Group();
      if (a) g.add(new Mesh(a, lit));
      if (c) g.add(new Mesh(c, flatGlow));
      g.position.set(face.centre_cells[0] * CELL - (w * SUB) / 2, face.centre_cells[1] * CELL - (h * SUB) / 2, face.centre_cells[2] * CELL);
      numbers.set(key, g);
      group.add(g);
    }
    if (showing && showing !== g) showing.visible = false;
    g.visible = true;
    showing = g;
  };
  const hide = () => { if (showing) showing.visible = false; showing = null; };

  const api: BombObject = {
    group, skin, centreY: 8 * CELL,
    setSeconds(n, danger = false) {
      if (n === null) { if (o.rest) draw(10, false); else hide(); return; }
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
