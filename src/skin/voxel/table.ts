import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, T } from './palette';
import { box, ellipsoid, Grid, hash3, helix, line, norm, rng } from './primitives';
import type { Paint, V3 } from './primitives';

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

const boards = new Map<string, BufferGeometry>();
/**
 * The letter board: 0.9 by 0.6 m hanging on two ropes, with the letter carved 0.5 m tall on its face toward the
 * camera (-z). Built around the ropes' attachment on the beam, so the whole thing swings from there. The trap
 * version carves the letter for an ice block (the block itself is a transparent box the component adds).
 */
export function letterBoardGeometry(letter: string, trap: boolean, beamY: number): BufferGeometry {
  const key = `${letter}:${trap ? 'ice' : 'wood'}:${beamY}`;
  const hit = boards.get(key);
  if (hit) return hit;
  const s = 0.04;
  const g = new Grid(s);
  const top = BOARD.bottom + BOARD.height;
  const pivotY = beamY - 0.15;
  const dy = (m: number) => m - pivotY; // local y: the pivot is the origin
  if (!trap) {
    const plank: Paint = (_x, y) => pick(T.beam, hash3(Math.floor(y / 4), 0, 0, 77), [0.35, 0.9]);
    box(g, [-BOARD.width / 2, dy(BOARD.bottom), -BOARD.thick / 2], [BOARD.width / 2, dy(top), BOARD.thick / 2], plank);
    // A darker rim, two nail heads where the ropes meet the board.
    for (const sx of [-1, 1]) line(g, [sx * (BOARD.width / 2 - 0.02), dy(top) - 0.02, -BOARD.thick / 2 - 0.02], [sx * (BOARD.width / 2 - 0.02), dy(top) - 0.02, -BOARD.thick / 2 - 0.02], () => lin(T.stone[2]));
  }
  // Ropes from the board's top corners up to the beam.
  const rope: Paint = () => lin(T.hay[2]);
  for (const sx of [-1, 1]) line(g, [sx * 0.35, dy(top), 0], [sx * 0.35, 0, 0], rope);
  // The letter, carved one voxel proud of the face toward the camera.
  const rows = FONT[letter.toUpperCase()] ?? FONT.A;
  const cell = 0.07;
  const ink = trap ? lin(T.ice[2]) : lin('#5B3A1E');
  // One voxel proud of the face toward the camera (the board spans z -0.04..0.04; the letter sits at -0.08..-0.04).
  const zFront = -BOARD.thick / 2 - s;
  const x0 = -(5 * cell) / 2, y0 = dy(BOARD.bottom) + (BOARD.height - 7 * cell) / 2;
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 5; c++) {
      if (rows[r][c] !== '#') continue;
      // The camera reads the face from -z, where +x runs right to left, so the columns are laid out mirrored.
      const col = 4 - c;
      box(g, [x0 + col * cell, y0 + (6 - r) * cell, zFront], [x0 + (col + 1) * cell, y0 + (7 - r) * cell, zFront + s], () => ink);
    }
  const geo = buildGeometry(g.map, s);
  boards.set(key, geo);
  return geo;
}
