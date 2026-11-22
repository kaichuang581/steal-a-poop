import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { shade, solid } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { CELL, CRATE, FINE } from './island';

/**
 * The leaderboards' podiums as festival stages (Brian, 2026-11-22: "make the podiums look more exciting", then "the
 * podiums look sloppy ... go more for the vibe of like those anime festivals while still being somewhat cohesive").
 * They replace the timber crates on this screen; the victory screen keeps its own. Each has the crate's footprint and
 * height, so every pose, plate and drift still fits:
 * - four dark corner posts, the full height, standing a cell proud of the walls between them;
 * - a plinth of dark wood with a band of the place's metal (gold, silver, bronze);
 * - walls of upright boards, a darker seam every third cell (the barn's own make);
 * - a red-and-white striped curtain hung round the top, proud of the boards, its hem straight;
 * - a twisted rope of the place's metal over the curtain, a tassel at each front post;
 * - the deck, and on it a red carpet edged in the metal;
 * - on the front, under the curtain, a lacquered sign framed in the metal with the number in it;
 * - a red paper lantern hanging at each front corner, lit from within (the stage draws its paper glowing).
 * Every colour is a palette step or the metal's three; nothing random. Pure: voxels.
 */

/** Each place's metal: [lit, middle, shaded]. */
export const METALS: Record<1 | 2 | 3, [string, string, string]> = {
  1: ['#FFD38F', '#EFBA64', '#C98A2E'],
  2: ['#EEF2F7', '#C9D2DE', '#97A5B8'],
  3: ['#EDB083', '#C98352', '#94592F'],
};
const LACQUER = '#4E1A22', CARPET = '#A8323A';
/** The bold 5 x 7 numbers, drawn for the sign (each reads crisply at the size it is drawn). */
const DIGITS: Record<1 | 2 | 3, string[]> = {
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
};

/** Rows of the build, counted down from the top (M cells): carpet, deck, rope, then the curtain. */
const CURTAIN = 4;

export interface PodiumVoxels {
  /** The podium on M cells, its foot at y = 0, centred on x and z. */
  body: Grid;
  /** The sign and the rope's tassels, on S cells. */
  trim: Grid;
  /** The lanterns: their iron caps and cords (`frame`) and their paper (`paper`, drawn lit), on S cells. */
  frame: Grid;
  paper: Grid;
  /** Where the number's sign is on the front, from the top (metres): its top, its bottom, its half width. */
  numeral: { top: number; bottom: number; half: number };
  /** Each lantern's box (metres, from the podium's foot): x, y and z ranges. */
  lanterns: { x: [number, number]; y: [number, number]; z: [number, number] }[];
}

/** A podium `height` metres tall for `place`. */
export function podiumVoxels(place: 1 | 2 | 3, height: number): PodiumVoxels {
  const body = new Grid(CELL);
  const [hiH, midH, loH] = METALS[place];
  const hi = shade(hiH), mid = shade(midH), lo = shade(loH);
  const post = solid('darkWood', -1), plinth = solid('darkWood', 0), board = solid('wood', 0);
  const red = solid('barnRed', 0), white = solid('trimWhite', 1), deck = solid('darkWood', 1), carpet = shade(CARPET);
  const W = Math.round(CRATE.w / CELL), D = Math.round(CRATE.d / CELL), H = Math.round(height / CELL);
  const x0 = -W / 2, z0 = -D / 2;
  const put = (x: number, y: number, z: number, c: RGB) => body.set(x0 + x, y, z0 + z, c);
  const top = H - 1, deckRow = H - 2, rope = H - 3, hem = rope - CURTAIN;   // the curtain is rows hem .. rope - 1
  const rail = Math.round((3 + hem) / 2), rail0 = solid('wood', 1), gap = solid('darkWood', -2);   // a rail halfway up the slats
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const edgeX = x === 0 || x === W - 1, edgeZ = z === 0 || z === D - 1, outer = edgeX || edgeZ, corner = edgeX && edgeZ;
    // Along each face, the cell's place across it (x on the front and back, z on the sides), and the curtain's stripe
    // there: two cells wide, laid out from the face's middle so both ends match (red, white, red ... out to the posts).
    const across = edgeZ ? x : z, n = edgeZ ? W - 2 : D - 2;
    const stripe = Math.floor((Math.abs(across - (n + 1) / 2) + 0.5) / 2) % 2;
    const ring2 = !outer && (x === 1 || x === W - 2 || z === 1 || z === D - 2);
    const ring3 = !outer && !ring2 && (x === 2 || x === W - 3 || z === 2 || z === D - 3);
    const across2 = x === 1 || x === W - 2 ? z : x, slat = across2 % 2 === 0;
    for (let y = 0; y < H; y++) {
      let c: RGB | null = null;
      if (y === top) c = outer ? mid : carpet;                       // the carpet, edged in the metal
      else if (y === deckRow) c = deck;                              // the deck's edge
      else if (y < 2) c = plinth;                                    // the plinth
      else if (y === 2) c = outer ? lo : plinth;                     // its band of the metal
      else if (corner) c = post;                                     // the posts
      else if (outer && y === rope) c = null;                        // the rope (S cells, below)
      else if (outer && y >= hem) c = stripe ? white : red;          // the curtain
      else if (outer) c = y === rail ? rail0 : null;                 // a rail round the slats, flush with the posts
      else if (ring2) c = y >= hem || slat ? board : null;           // upright slats, a gap between each two
      else if (ring3 && y < hem) c = gap;                            // the shadow behind the gaps
      else if (y < rope) c = gap;                                    // the inside, solid, so none of its faces is drawn
      if (c) put(x, y, z, c);
    }
  }
  // (The boards are the second ring in, every third cell a seam; the inside stays hollow, unseen.)
  const trim = new Grid(FINE), frame = new Grid(FINE), paper = new Grid(FINE);
  const S = CELL / FINE;                                             // S cells to an M cell
  const front = (D / 2 - 1) * S;                                     // the boards' front face (S cells), a cell behind the curtain's
  // The sign: lacquer in a frame of the metal, the number in the metal's light, each a cell proud.
  // It hangs over the curtain from the rope, so no name plate ever covers it, whatever the podium's height.
  const sw = 9, sh = 11, signTop = rope * S - 1, sx0 = -Math.floor(sw / 2), signZ = front + S;
  for (let i = 0; i < sw; i++) for (let j = 0; j < sh; j++) {
    const rim = i === 0 || i === sw - 1 || j === 0 || j === sh - 1;
    trim.set(sx0 + i, signTop - j, signZ, rim ? mid : shade(LACQUER));
  }
  DIGITS[place].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') trim.set(sx0 + 2 + i, signTop - 2 - j, signZ + 1, hi); }));
  // The rope: round all four faces in the outer ring at its row, two S cells thick, its twist a diagonal stripe of the
  // metal's light every two cells.
  const fz = (D / 2) * S;                                            // the front face (S cells)
  const ox = (W / 2) * S, oz = (D / 2) * S;
  for (let i = -ox; i < ox; i++) for (let k = -oz; k < oz; k++) {
    if (i >= -ox + S && i < ox - S && k >= -oz + S && k < oz - S) continue;   // only the outer ring
    if ((i < -ox + S || i >= ox - S) && (k < -oz + S || k >= oz - S)) continue; // not through the posts
    if (k < -oz + S) continue;                                                   // not along the back, never seen
    for (let j = 0; j < S; j++) trim.set(i, rope * S + j, k, (i + k + j + 64) % 4 < 2 ? hi : mid);
  }
  // Tassels: under the rope on each front post, two S cells wide, hanging 0.25 m, the knot in the metal's light.
  for (const tx of [-ox, ox - S]) for (let j = 0; j < 5; j++) for (let i = 0; i < 2; i++) trim.set(tx + i, rope * S - 1 - j, fz, j === 0 ? hi : j === 4 ? lo : mid);
  // Lanterns: one at each front corner, hanging from the deck on a cord, a hand's width in front of the post.
  const lanterns: PodiumVoxels['lanterns'] = [];
  const profile = [2, 3, 3.5, 3.5, 3.5, 3, 2];                       // radius by row, top to bottom (S cells)
  for (const side of [-1, 1]) {
    const cx = side * ((W / 2) * S - 2), cz = fz + 4, capTop = deckRow * S - 3;
    // An iron arm out of the deck's front, and the cord down from its end.
    for (let k = fz; k < cz; k++) frame.set(cx - 1, deckRow * S, k, solid('iron', 0));
    for (let j = 1; j < 3; j++) frame.set(cx - 1, deckRow * S - j, cz - 1, solid('iron', 0));
    const ring = (y: number, r: number) => { for (let i = -r; i < r; i++) for (let k = -r; k < r; k++) frame.set(cx + i, y, cz + k, solid('iron', 1)); };
    ring(capTop, 2);
    profile.forEach((r, j) => {
      const y = capTop - 1 - j;
      for (let i = -4; i < 4; i++) for (let k = -4; k < 4; k++) {
        if (Math.hypot(i + 0.5, k + 0.5) > r) continue;
        paper.set(cx + i, y, cz + k, j === 3 ? white : red);       // a white band round its middle
      }
    });
    ring(capTop - 1 - profile.length, 2);
    lanterns.push({
      x: [(cx - 4) * FINE, (cx + 4) * FINE],
      y: [(capTop - 1 - profile.length) * FINE, (deckRow * S) * FINE],
      z: [(cz - 4) * FINE, (cz + 4) * FINE],
    });
  }
  return {
    body, trim, frame, paper, lanterns,
    numeral: { top: -(height - (signTop + 1) * FINE), bottom: -(height - (signTop + 1 - sh) * FINE), half: (sw / 2) * FINE },
  };
}

export interface PodiumGeo { body: BufferGeometry; trim: BufferGeometry; paper: BufferGeometry }
const cache = new Map<string, PodiumGeo>();
/** The podium as meshes (cached by place and height). */
export function podiumGeometry(place: 1 | 2 | 3, height: number): PodiumGeo {
  const key = `${place}|${height}`;
  let hit = cache.get(key);
  if (!hit) {
    const v = podiumVoxels(place, height);
    // The trim and the lanterns' iron share a grid size and a material: one mesh.
    const fine = new Grid(FINE);
    for (const c of [...v.trim.map.values(), ...v.frame.map.values()]) fine.set(c.x, c.y, c.z, c.c);
    cache.set(key, (hit = { body: buildGeometry(v.body.map, CELL, { merge: true }), trim: buildGeometry(fine.map, FINE, { merge: true }), paper: buildGeometry(v.paper.map, FINE, { merge: true }) }));
  }
  return hit;
}
