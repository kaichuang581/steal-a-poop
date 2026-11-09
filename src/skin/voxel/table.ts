import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, T } from './palette';
import { ellipsoid, Grid, hash3, helix, norm, rng } from './primitives';
import type { Paint, RGB, V3 } from './primitives';

/** Pieces of the table itself (plan V3.2 Parts 3 and 4): the platform, the wool pile, the letter board and its ropes. */

export const PLATFORM_RADIUS = 1.3;
export const PLATFORM_HEIGHT = 0.15;

let platform: BufferGeometry | null = null;
/** A round platform of dark boards with 1-voxel gaps, 2.6 m across and 0.15 m high, on the 0.05 m grid. */
export function platformGeometry(): BufferGeometry {
  if (platform) return platform;
  const s = 0.05;
  const g = new Grid(s);
  const R = PLATFORM_RADIUS / s, H = Math.round(PLATFORM_HEIGHT / s);
  for (let x = Math.floor(-R); x <= Math.ceil(R); x++)
    for (let z = Math.floor(-R); z <= Math.ceil(R); z++) {
      if ((x + 0.5) ** 2 + (z + 0.5) ** 2 > R * R) continue;
      const board = Math.floor((z + 100) / 5); // boards four voxels wide along x, one voxel gap between them
      const gap = ((z + 100) % 5) === 4;
      const tone = pick(T.beam, hash3(board, 0, 0, 3), [0.1, 0.45]); // dark wood, one tone per board
      for (let y = 0; y < H; y++) {
        if (gap && y === H - 1) continue; // the gap only shows on top; the rim stays solid
        g.set(x, y, z, y === H - 1 ? tone : lin(T.beam[2]));
      }
    }
  platform = buildGeometry(g.map, s);
  return platform;
}

const piles = new Map<number, BufferGeometry>();
/** The mound of wool: `width` across (0.9 to 2.2 m), built from the wool primitives with locks and curls, resting at y = 0. */
export function pileGeometry(width: number): BufferGeometry {
  const w = Math.round(Math.max(0.9, Math.min(2.2, width)) * 10) / 10;
  const hit = piles.get(w);
  if (hit) return hit;
  const s = 0.04;
  const g = new Grid(s);
  const h = 0.3 + ((w - 0.9) / 1.3) * 0.5;
  const wool: Paint = (x, y, z) => (y < 0 ? null : pick(T.wool, hash3(x >> 2, y >> 2, z >> 2, 71)));
  const rx = w / 2, rz = w / 2 * 0.9;
  ellipsoid(g, [0, h * 0.25, 0], [rx, h * 0.85, rz], wool);
  // Locks: evenly spread bumps over the mound, each one tone.
  const r = rng(73);
  const n = Math.round(w * 22);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.92;
    const px = Math.cos(a) * rx * d, pz = Math.sin(a) * rz * d;
    const py = h * 0.25 + h * 0.85 * Math.sqrt(Math.max(0, 1 - (px / rx) ** 2 - (pz / rz) ** 2));
    const toneR = hash3(i, 0, 0, 75);
    const c = lin(toneR < 0.55 ? T.wool[0] : toneR < 0.9 ? T.wool[1] : T.wool[2]);
    ellipsoid(g, [px, py, pz], [0.09, 0.075, 0.09], (_x, y) => (y < 0 ? null : c));
  }
  // A few curls on top.
  for (let i = 0; i < Math.round(w * 4); i++) {
    const a = r() * Math.PI * 2, d = r() * 0.6;
    const p: V3 = [Math.cos(a) * rx * d, h * 1.05, Math.sin(a) * rz * d];
    helix(g, p, norm([Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3]), () => lin(T.wool[0]), 0.035, 0.025, 1.5);
  }
  const geo = buildGeometry(g.map, s);
  piles.set(w, geo);
  return geo;
}

/** The mound's width for a pile of `points` (plan V3.2 Part 3: 0.9 m at 0 to 9 points, 2.2 m at 80). */
export function pileWidth(points: number): number {
  if (points < 10) return 0.9;
  return 0.9 + Math.min(1, (points - 10) / 70) * 1.3;
}

/** The classic 5 x 7 capitals, one string per row. */
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['....#', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};

export const BOARD = { width: 0.9, height: 0.6, thick: 0.08, bottom: 2.6 };

/** The font's glyph size, in cells. */
export const GLYPH = { w: 5, h: 7 };

/** Paints one glyph of the board font into `g` with its bottom-left cell at (x0, y0, z) (cells of the grid). */
export function paintGlyph(g: Grid, ch: string, x0: number, y0: number, z: number, c: RGB) {
  const rows = FONT[ch.toUpperCase()];
  if (!rows) return;
  rows.forEach((row, r) => [...row].forEach((px, col) => { if (px === '#') g.set(x0 + col, y0 + (GLYPH.h - 1 - r), z, c); }));
}

const glyphs = new Map<string, BufferGeometry>();
/** One letter of the board font as a flat voxel glyph, 1 voxel thick, built about its centre at `cell` m per cell. */
export function letterGeometry(ch: string, cell: number, hex = '#5B3A1E'): BufferGeometry {
  const key = `${ch}:${cell}:${hex}`;
  const hit = glyphs.get(key);
  if (hit) return hit;
  const g = new Grid(cell);
  paintGlyph(g, ch, 0, 0, 0, lin(hex));
  const geo = buildGeometry(g.map, cell);
  geo.translate(-(GLYPH.w / 2) * cell, -(GLYPH.h / 2) * cell, -cell / 2);
  glyphs.set(key, geo);
  return geo;
}

const boards = new Map<string, BufferGeometry>();

const PLANK_TONES: RGB[] = [lin('#93653F'), lin('#8A5D39'), lin('#986A44')];

/** The board's letters are cut from the title's carved face, so the sign over the table matches the title on Home. */
const BOARD_FONT = "800 100px Fraunces";

/** Resolves once the display face is loaded (at once where there is no document, as in tests). */
export function boardFontReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return document.fonts.load(BOARD_FONT).then(() => undefined, () => undefined);
}

/**
 * The letter as a mask of cells, `h` cells tall: drawn in the display face at 6x and averaged down, so every stroke
 * and serif lands on whole cells instead of a small bitmap stretched over a grid it does not divide. Where there is
 * no canvas or the face has not loaded, the 5 x 7 board font scaled by a whole number of cells.
 */
export function letterMask(ch: string, h: number): boolean[][] {
  const up = ch.toUpperCase();
  // The fallback scales the 5 x 7 font by a whole number, so it still divides evenly.
  const k = Math.max(1, Math.round(h / GLYPH.h));
  const fromFont = () => (FONT[up] ?? FONT.A).flatMap((row) => {
    const line = [...row].flatMap((px) => Array<boolean>(k).fill(px === '#'));
    return Array.from({ length: k }, () => line);
  });
  if (typeof document === 'undefined' || !document.fonts?.check(BOARD_FONT)) return fromFont();
  const K = 6;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fromFont();
  ctx.font = BOARD_FONT;
  const m100 = ctx.measureText(up);
  const tall100 = m100.actualBoundingBoxAscent + m100.actualBoundingBoxDescent;
  const size = (100 * h * K) / tall100;
  ctx.font = `800 ${size}px Fraunces`;
  const m = ctx.measureText(up);
  const wPx = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  const w = Math.max(1, Math.ceil(wPx / K));
  c.width = w * K;
  c.height = h * K;
  ctx.font = `800 ${size}px Fraunces`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  // The face's hairlines (where a bowl meets its stem) are thinner than a cell; a stroke round the glyph thickens every
  // line by about a cell so none drops out, while the heavy strokes stay heavy.
  const tx = (c.width - wPx) / 2 + m.actualBoundingBoxLeft, ty = m.actualBoundingBoxAscent;
  ctx.fillText(up, tx, ty);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = K * 0.9;
  ctx.lineJoin = 'round';
  ctx.strokeText(up, tx, ty);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const mask: boolean[][] = [];
  for (let r = 0; r < h; r++) {
    const row: boolean[] = [];
    for (let col = 0; col < w; col++) {
      let sum = 0;
      for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) sum += px[((r * K + y) * c.width + col * K + x) * 4 + 3];
      row.push(sum / (K * K * 255) > 0.4);
    }
    mask.push(row);
  }
  return mask;
}

/**
 * The letter board: three planks 0.9 by 0.6 m on the 0.02 m grid, hung on two ropes, with the chain letter cut into
 * the face toward the camera (-z) and painted cream, in the title's display face (V6 Part 5.2). The planks have dark
 * seams, a darker rim, bevelled top corners and two brass nails. Built around the ropes' hook on the beam, so the
 * whole thing swings from there. The trap version is the letter alone, in ice, for the ice block the component adds.
 */
export function letterBoardGeometry(letter: string, trap: boolean, beamY: number): BufferGeometry {
  const fontReady = typeof document !== 'undefined' && !!document.fonts?.check(BOARD_FONT);
  const key = `${letter}:${trap ? 'ice' : 'wood'}:${beamY}:${fontReady}`;
  const hit = boards.get(key);
  if (hit) return hit;
  const s = 0.02;
  const g = new Grid(s);
  const pivotY = beamY - 0.15;
  const W = Math.round(BOARD.width / s), H = Math.round(BOARD.height / s), D = Math.round(BOARD.thick / s);
  const x0 = -Math.floor(W / 2), y0 = Math.round((BOARD.bottom - pivotY) / s), z0 = -Math.floor(D / 2);
  const front = z0; // the camera reads the board from -z
  const seamEvery = H / 3;
  if (!trap) {
    const dark = lin(T.beam[2]), seam = lin('#4A3120');
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) {
        const fromTop = H - 1 - y;
        // Bevel the two top corners off.
        if (fromTop + Math.min(x, W - 1 - x) < 2) continue;
        const plank = Math.floor(y / seamEvery);
        const isSeam = y > 0 && y % seamEvery === 0;
        const rim = x === 0 || x === W - 1 || y === 0 || fromTop === 0 || fromTop + Math.min(x, W - 1 - x) === 2;
        // Grain runs along each plank: one warm tone per plank, each row a few percent lighter or darker, so it reads as
        // wood grain and not as stripes.
        const base = PLANK_TONES[plank % PLANK_TONES.length];
        const f = 0.94 + 0.1 * (hash3(y, plank, Math.floor(x / 9), 31) % 1);
        const grain: RGB = [base[0] * f, base[1] * f, base[2] * f];
        for (let z = 0; z < D; z++) {
          if (isSeam && z === 0) continue; // the seam is a groove between planks
          g.set(x0 + x, y0 + y, z0 + z, isSeam ? seam : rim && z === 0 ? dark : grain);
        }
      }
    // Brass nails, one in each top corner of the face.
    for (const x of [3, W - 4]) g.set(x0 + x, y0 + H - 4, front - 1, lin(T.brass[1]));
  }
  // Ropes, two cells thick and twisted, from the board's top corners up to the hook.
  for (const sx of [-1, 1]) {
    const rx = Math.round((sx * 0.35) / s);
    for (let y = y0 + H; y <= 0; y++) for (const dx of [0, 1]) g.set(rx + dx, y, -1 + dx, lin(T.hay[(y + dx) % 3 === 0 ? 2 : 1]));
  }
  // The letter: cut one cell into the face and painted cream (or, on the trap, standing proud in ice).
  const lh = Math.round(0.46 / s);
  const mask = letterMask(letter, lh);
  const lw = mask[0]?.length ?? 0;
  const lx0 = -Math.floor(lw / 2), ly0 = y0 + Math.round((H - lh) / 2);
  const paint = trap ? lin(T.ice[2]) : lin('#F3E7CC');
  mask.forEach((row, r) => row.forEach((on, c) => {
    if (!on) return;
    // The camera reads the face from -z, where +x runs right to left, so the columns are laid out mirrored.
    const x = lx0 + (lw - 1 - c), y = ly0 + (lh - 1 - r);
    if (trap) { for (let z = front - 1; z <= front; z++) g.set(x, y, z, paint); return; }
    g.del(x, y, front);
    g.set(x, y, front + 1, paint);
  }));
  const geo = buildGeometry(g.map, s);
  boards.set(key, geo);
  return geo;
}
