import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3 } from '../voxel/primitives';
import type { Paint, RGB, V3 } from '../voxel/primitives';
import { CHAR } from '../voxel/sheep';

/**
 * The farmer's bedroom on Christmas night (V4.1 Part 7, V6 Part 6.4), the real world under the dream, drawn in its own
 * small canvas. One room serves the bubble and the results: honey pine planks over a sage wainscot, a walnut bed with a
 * patchwork quilt, a nightstand with an oil lamp and a red alarm clock, a window over it with snow banked outside, a
 * candle and holly on the sill and the moon beyond, gingham curtains, lights along the headboard, a knitted stocking on
 * the bedpost, a rag rug and slippers, a shelf, a framed sheep, a second window toward the foot of the bed and the beam
 * the results hang from (the bubble's camera sees only the corner by the bed; the results see the room). Grids: 0.05 m for the room and its furniture (the plan's 0.10 m made the board seams and trim a hand wide), 0.10 m
 * for the ceiling and beam, 0.025 m for the small things on the nightstand, the sill and the post, 0.04 m for the farmer's
 * body and 0.02 m for his head. All in the room's own frame: the bed runs along +x with the headboard at x = 0, the
 * nightstand and the window on the -z side, the floor at y = 0.
 */
export const BED = {
  /** The quilt's patches: barn red, cream, holly green, mustard and navy wool. */
  quilt: ['#B5443C', '#F3EAD6', '#4F7A55', '#D9A84A', '#3D5A8A'] as const,
  cap: ['#C24E45', '#F3EAD6'] as const,
  mattress: { w: 1.1, h: 0.3, l: 2.0, top: 0.55 },
  pillowTop: 0.7,
};
const D = 0.05, B = 0.1, S = 0.025;
const PINE = ['#BE9670', '#AF8862', '#987452'] as const;
const SEAM = '#8A6342';
/** Each patch's own colour a shade darker, for the stitched seams between them. */
const QUILT_SEAM = ['#8E342E', '#CBBE9F', '#3B5E41', '#B48A38', '#2C4369'] as const;
const SAGE = ['#86A27F', '#789672', '#617D5D'] as const;
const TRIM = ['#F1E8D4', '#E3D8C0', '#CBBE9F'] as const;
const FLOOR = ['#7E5636', '#704B2E', '#5C3D25'] as const;
const WALNUT = T.bedwood;
const INLAY = '#8C6443';
const GLOW = { red: '#FF5A48', green: '#5BE27A', gold: '#FFD25E', flame: '#FFD98A', core: '#FFF4D0', ember: '#FF9A3C' } as const;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const c = (hex: string): Paint => () => lin(hex);

/** The two walls' planes and the room's far reaches. */
const SIDE_X = -0.5, BACK_Z = -1.3;
const ROOM_X1 = 4.6, ROOM_Z1 = 2.4, ROOM_H = 2.7;
/** The window over the nightstand (in the back wall, z = BACK_Z), x and y extents. The bubble looks out of it. */
const WINDOW = { x0: 0.1, x1: 0.8, y0: 1.0, y1: 1.65 } as const;
/** The window in the back wall toward the foot of the bed, beside the hanging board: only the desktop results see it. */
const ROOM_WINDOW = { x0: 2.35, x1: 3.15, y0: 1.3, y1: 2.3 } as const;
/** The nightstand on the window side of the bed, and what stands on it. */
const STAND = { x0: 0.1, x1: 0.5, z0: -1.1, z1: -0.75, top: 0.6 } as const;
export const LAMP = { x: 0.2, y: 0.6, z: -0.98 } as const;
export const CLOCK = { x: 0.4, y: 0.6, z: -0.84, turn: 0.75 } as const;
/** The candle on the window sill. */
export const CANDLE = { x: 0.62, y: WINDOW.y0 - 0.05, z: -1.2 } as const;
/** The beam across the room and the hook the results board hangs from. */
export const BEAM = { y: 2.2, z: 0.4, hookX: 2.15 } as const;

/** The dream is over: the bubble opens to the whole room and the camera comes down to the bed. */
export const roomOn = (phase: string) => phase === 'results';

/**
 * Drops the faces no camera can ever see, which is half the room's triangles (the walls' backs, the floor's underside):
 * every camera, and every point on the way between them, stands above the floor, under the ceiling, inside the side wall
 * and at z > 1, so a face turned down below the floor, up above the ceiling, out through the side wall or toward -z short
 * of z = 0.9 always faces away. Only the index is rewritten.
 */
function cullUnseen(g: BufferGeometry): BufferGeometry {
  const P = g.getAttribute('position').array, N = g.getAttribute('normal').array, I = g.index!.array, keep: number[] = [];
  for (let f = 0; f < I.length; f += 6) {
    const v = [0, 1, 2, 5].map((k) => I[f + k] * 3), n = v[0];
    const max = (a: number) => Math.max(...v.map((j) => P[j + a])), min = (a: number) => Math.min(...v.map((j) => P[j + a]));
    if ((N[n + 2] < 0 && max(2) <= 0.9) || (N[n + 1] < 0 && max(1) <= 0) || (N[n + 1] > 0 && min(1) >= ROOM_H) || (N[n] < 0 && max(0) <= SIDE_X)) continue;
    for (let k = 0; k < 6; k++) keep.push(I[f + k]);
  }
  g.setIndex(keep);
  return g;
}

/** A point on a wall: `u` runs along it, `d` is depth into the room (0 is the wall's own layer), in cells. */
type Wall = (u: number, y: number, d: number) => V3;
const sideWall: Wall = (u, y, d) => [Math.round(SIDE_X / D) - 1 + d, y, u];
const backWall: Wall = (u, y, d) => [u, y, Math.round(BACK_Z / D) - 1 + d];
interface Hole { u0: number; u1: number; y0: number; y1: number }

/** Baseboard, a sage wainscot of upright boards, a cream chair rail, then honey planks with staggered joints. */
function wallTone(u: number, y: number, seed: number): RGB {
  if (y <= 2) return lin(TRIM[y === 2 ? 0 : 1]);
  if (y <= 16) return mod(u, 4) === 0 ? lin(SAGE[2]) : lin(SAGE[hash3(Math.floor(u / 4), 0, seed, 41) < 0.55 ? 0 : 1]);
  if (y <= 18) return lin(TRIM[y === 18 ? 0 : 2]);
  const row = Math.floor((y - 19) / 5), off = mod(row * 17, 44);
  if (mod(y - 19, 5) === 0 || mod(u + off, 44) === 0) return lin(SEAM);
  const r = hash3(Math.floor((u + off) / 44), row, seed, 43);
  return lin(PINE[r < 0.45 ? 0 : r < 0.85 ? 1 : 2]);
}

function buildWall(g: Grid, at: Wall, u0: number, u1: number, seed: number, holes: Hole[]) {
  const top = Math.round(ROOM_H / D);
  for (let u = u0; u <= u1; u++) for (let y = 0; y < top; y++) {
    if (holes.some((h) => u >= h.u0 && u < h.u1 && y >= h.y0 && y < h.y1)) continue;
    g.set(...at(u, y, 0), wallTone(u, y, seed));
    // The baseboard and the chair rail stand proud of the boards.
    if (y <= 1 || y === 17) g.set(...at(u, y, 1), lin(TRIM[1]));
  }
}

/** Night sky behind a window, self-lit: deep blue to the hills, snow on them, a few pines, stars, and a moon if asked. */
/** `lift` raises the hills: the window over the nightstand keeps them low, so its lower panes stay night blue. */
function sky(glow: Grid, at: Wall, h: Hole, moon: [number, number] | null, seed: number, lift: number) {
  const m = 26;
  for (let u = h.u0 - m; u < h.u1 + m; u++) {
    const hill = h.y0 + lift + Math.round(1.6 * Math.sin(u * 0.21 + seed) + 1.1 * Math.sin(u * 0.53 + seed * 2));
    const pine = hash3(Math.floor(u / 5), 0, seed, 61) < 0.35 ? 5 - Math.abs(mod(u, 5) - 2) * 2 : 0;
    for (let y = h.y0 - m; y < h.y1 + m; y++) {
      let col: string;
      if (y <= hill) col = y === hill ? '#D7E0F4' : hash3(u, y, seed, 63) < 0.2 ? '#AEBBE0' : '#BFCBEA';
      else if (pine > 0 && y <= hill + pine) col = '#22314A';
      else if (moon && (u - moon[0]) ** 2 + (y - moon[1]) ** 2 <= 10 && (u - moon[0] + 2) ** 2 + (y - moon[1] - 1) ** 2 > 8) col = '#F6F0CC';
      else if (hash3(u, y, seed, 67) < 0.025 && y > Math.max(hill + 7, h.y0 + 9)) col = hash3(u, y, seed, 69) < 0.5 ? '#FFF6D8' : '#CFDBFF';
      else { const k = (y - hill) / (h.y1 + m - hill); col = k > 0.6 ? '#121530' : k > 0.3 ? '#171D42' : '#1B234A'; }
      glow.set(...at(u, y, -12), lin(col));
    }
  }
}

/** A window cut in a wall: cream frame and cross bar, a deep sill, snow banked outside, frost in the pane corners. */
function windowIn(g: Grid, glow: Grid, at: Wall, h: Hole, seed: number) {
  const trim = (u: number, y: number) => lin(TRIM[hash3(u, y, seed, 71) < 0.8 ? 0 : 1]);
  const mu = Math.floor((h.u0 + h.u1) / 2), my = h.y0 + Math.round((h.y1 - h.y0) * 0.6);
  for (let u = h.u0 - 1; u <= h.u1; u++) for (let y = h.y0 - 1; y <= h.y1; y++) {
    const edge = u === h.u0 - 1 || u === h.u1 || y === h.y0 - 1 || y === h.y1;
    if (edge) { g.set(...at(u, y, 0), trim(u, y)); g.set(...at(u, y, 1), trim(u, y)); }
    else if (u === mu || y === my) g.set(...at(u, y, 0), trim(u, y));
  }
  // The sill: three cells deep, wider than the frame, an apron under it.
  for (let u = h.u0 - 3; u <= h.u1 + 2; u++) for (let d = 0; d <= 3; d++) g.set(...at(u, h.y0 - 2, d), lin(TRIM[d === 3 ? 1 : 0]));
  for (let u = h.u0 - 1; u <= h.u1; u++) g.set(...at(u, h.y0 - 3, 1), lin(TRIM[2]));
  // Snow banked against the glass outside, deeper in the corners.
  for (let u = h.u0; u < h.u1; u++) {
    const k = Math.min(u - h.u0, h.u1 - 1 - u), deep = k < 2 ? 3 : 1 + (hash3(u, 0, seed, 73) < 0.4 ? 1 : 0);
    for (let y = h.y0; y < h.y0 + deep; y++) for (const d of [-1, -2]) glow.set(...at(u, y, d), lin(y === h.y0 + deep - 1 ? '#F4F7FF' : '#DCE5F7'));
  }
  // Gingham curtains on a rod, tied back at the sides.
  const rodY = h.y1 + 2;
  for (let u = h.u0 - 4; u <= h.u1 + 3; u++) g.set(...at(u, rodY, 2), lin(WALNUT[0]));
  for (const side of [-1, 1]) {
    for (let y = h.y0 - 4; y < rodY; y++) {
      const tie = y === Math.round(h.y0 + (h.y1 - h.y0) * 0.35);
      const width = tie ? 2 : y >= h.y1 - 2 ? 4 : 3;
      for (let w = 0; w < width; w++) {
        const u = side < 0 ? h.u0 - 3 + w : h.u1 + 2 - w;
        const fold = mod(u + y * 0, 2) === 0 ? 2 : 3;
        const check = (Math.floor(mod(u, 4) / 2) + Math.floor(mod(y, 4) / 2)) % 2;
        const col = tie ? lin(T.brass[1]) : lin(check ? '#C24E45' : mod(u + y, 2) ? '#F3EAD6' : '#E2A49C');
        g.set(...at(u, y, fold), col);
      }
    }
  }
}

export interface BedroomGeo {
  /** Everything that stands still, at every grid, merged. */
  room: BufferGeometry;
  /** The sky, moon and snow behind the windows, the candle flame and the headboard's lights: lit by themselves. */
  glow: BufferGeometry;
  /** The lamp's chimney and flame, turned low while he sleeps and up when he wakes. */
  lampGlass: BufferGeometry;
  /** The quilt over him, which breathes. */
  quiltBump: BufferGeometry;
  /** The alarm clock about its own base, face toward +z, and the ring lines it throws when it goes off. */
  clock: BufferGeometry;
  ring: BufferGeometry;
}

const quiltPaint = (cell: number, z0: number): Paint => (x, _y, z) => {
  const n = Math.round(0.3 / cell), px = Math.floor(x / n), pz = Math.floor((z - z0) / n);
  const onSeam = mod(x, n) === 0 || mod(z - z0, n) === 0;
  const k = mod(px * 2 + pz * 3 + (px * pz) % 2, BED.quilt.length);
  return lin(onSeam ? QUILT_SEAM[k] : BED.quilt[k]);
};

let bedroomCache: BedroomGeo | null = null;
export function bedroomGeometry(): BedroomGeo {
  if (bedroomCache) return bedroomCache;
  const g = new Grid(D), big = new Grid(B), fine = new Grid(S), glow = new Grid(D), glowFine = new Grid(S);
  const wood = (seed: number): Paint => (x, y, z) => pick(WALNUT, hash3(x >> 1, y >> 2, z >> 1, seed), [0.55, 0.92]);
  const i = (m: number) => Math.round(m / D);

  // ---- the walls, the floor, the ceiling and the beam
  const nightHole: Hole = { u0: i(WINDOW.x0), u1: i(WINDOW.x1), y0: i(WINDOW.y0), y1: i(WINDOW.y1) };
  const backHole: Hole = { u0: i(ROOM_WINDOW.x0), u1: i(ROOM_WINDOW.x1), y0: i(ROOM_WINDOW.y0), y1: i(ROOM_WINDOW.y1) };
  buildWall(g, sideWall, i(BACK_Z) - 1, i(ROOM_Z1), 3, []);
  buildWall(g, backWall, i(SIDE_X) - 1, i(ROOM_X1), 5, [nightHole, backHole]);
  windowIn(g, glow, backWall, nightHole, 1);
  windowIn(g, glow, backWall, backHole, 2);
  // The moon sits where every camera sees it through the window over the nightstand; the back window has only stars.
  sky(glow, backWall, nightHole, [nightHole.u0 - 2, nightHole.y1 - 2], 1, -2);
  sky(glow, backWall, backHole, null, 2, 2);
  // Floorboards 0.15 m wide along the bed, butt joints staggered.
  for (let x = i(SIDE_X); x < i(ROOM_X1); x++) for (let z = i(BACK_Z); z < i(ROOM_Z1); z++) {
    const row = Math.floor(z / 3), off = mod(row * 17, 40);
    const seam = mod(z, 3) === 0 || mod(x + off, 40) === 0;
    g.set(x, -1, z, seam ? lin(FLOOR[2]) : pick(FLOOR, hash3(Math.floor((x + off) / 40), row, 0, 7), [0.5, 0.95]));
  }
  for (let x = Math.round(SIDE_X / B) - 1; x < Math.round(ROOM_X1 / B); x++) for (let z = Math.round(BACK_Z / B) - 1; z < Math.round(ROOM_Z1 / B); z++) {
    big.set(x, Math.round(ROOM_H / B), z, lin(PINE[mod(z, 3) === 0 ? 2 : 1]));
  }
  const by = Math.round(BEAM.y / B), bz = Math.round(BEAM.z / B);
  for (let x = Math.round(SIDE_X / B); x < Math.round(ROOM_X1 / B); x++) for (let y = by; y < by + 2; y++) for (let z = bz; z < bz + 2; z++) big.set(x, y, z, pick(WALNUT, hash3(x >> 2, y, z, 8), [0.3, 0.85]));
  for (let y = by * 4 - 3; y < by * 4; y++) fine.set(Math.round(BEAM.hookX / S), y, Math.round(BEAM.z / S) + 1, lin(T.brass[y === by * 4 - 3 ? 2 : 1]));

  // ---- the bed: a walnut headboard with an arched, inlaid panel and knobbed posts, a lower footboard, rails, mattress
  const m = BED.mattress, hw = i(m.w / 2); // 11 cells each side
  for (const sz of [-1, 1]) {
    const z0 = sz > 0 ? hw : -hw - 2;
    for (const [x0, h] of [[-2, 24], [i(m.l), 18]] as const) {
      box(g, [x0 * D, 0, z0 * D], [(x0 + 2) * D, h * D, (z0 + 2) * D], wood(11));
      box(g, [(x0 - 1) * D, h * D, (z0 - 1) * D], [(x0 + 3) * D, (h + 3) * D, (z0 + 3) * D], c(WALNUT[0]), 1);
    }
  }
  for (let z = -hw; z < hw; z++) {
    const top = 20 + Math.round(2.4 * (1 - ((z + 0.5) / hw) ** 2));
    for (let y = 6; y <= top; y++) for (const x of [-2, -1]) {
      const inset = x === -1 && y >= 8 && y <= top - 2 && z >= -hw + 2 && z < hw - 2;
      const border = inset && (y === 8 || y === top - 2 || z === -hw + 2 || z === hw - 3);
      g.set(x, y, z, border ? lin(INLAY) : wood(13)(x, y, z)!);
    }
    for (const x of [-3, -2, -1, 0]) g.set(x, top + 1, z, lin(WALNUT[2]));
    for (let y = 6; y <= 15; y++) for (const x of [i(m.l), i(m.l) + 1]) g.set(x, y, z, wood(17)(x, y, z)!);
    for (const x of [i(m.l) - 1, i(m.l), i(m.l) + 1, i(m.l) + 2]) g.set(x, 16, z, lin(WALNUT[2]));
  }
  for (const sz of [-1, 1]) box(g, [0, 0.2, sz > 0 ? m.w / 2 - D : -m.w / 2], [m.l, 0.35, sz > 0 ? m.w / 2 : -m.w / 2 + D], wood(19));
  box(g, [0, 0.35, -m.w / 2 + D], [m.l, m.top, m.w / 2 - D], (_x, y, z) => lin(mod(z, 3) === 0 ? '#C9D4E8' : TRIM[y === 10 ? 0 : 1]));
  // The pillow, a pale ticking with a blue stripe, chamfered.
  box(g, [0.05, m.top, -0.25], [0.65, BED.pillowTop, 0.25], (_x, y, z) => lin(y >= i(BED.pillowTop) - 1 && mod(z, 3) === 0 ? '#C9D4E8' : '#EEF1F6'), 1);
  // The quilt from his waist to the foot, draped over the sides, and the sheet turned down over its top edge.
  const qz0 = -hw - 1, qPaint = quiltPaint(D, qz0);
  box(g, [0.95, m.top, qz0 * D], [m.l, m.top + D, (hw + 1) * D], qPaint);
  for (const sz of [-1, 1]) box(g, [0.65, 0.3, sz > 0 ? hw * D : qz0 * D], [m.l, m.top, sz > 0 ? (hw + 1) * D : (qz0 + 1) * D], (x, y, z) => (y === 6 ? lin(TRIM[1]) : qPaint(x, y, z)));

  // ---- the nightstand: walnut, legs, a drawer with a brass knob, an overhanging top
  const s = STAND;
  for (const [lx, lz] of [[s.x0, s.z0], [s.x1 - D, s.z0], [s.x0, s.z1 - D], [s.x1 - D, s.z1 - D]]) box(g, [lx, 0, lz], [lx + D, 0.15, lz + D], c(WALNUT[2]));
  box(g, [s.x0, 0.15, s.z0], [s.x1, s.top - D, s.z1], wood(23));
  box(g, [s.x0 - D, s.top - D, s.z0 - D], [s.x1 + D, s.top, s.z1 + D], c(WALNUT[0]));
  for (let z = i(s.z0) + 1; z < i(s.z1) - 1; z++) for (let y = 6; y <= 10; y++) {
    const edge = y === 6 || y === 10 || z === i(s.z0) + 1 || z === i(s.z1) - 2;
    if (edge) g.set(i(s.x1), y, z, lin(WALNUT[2]));
  }
  fine.set(Math.round(s.x1 / S) + 2, 16, Math.round(((s.z0 + s.z1) / 2) / S), lin(T.brass[0]));
  fine.set(Math.round(s.x1 / S) + 2, 16, Math.round(((s.z0 + s.z1) / 2) / S) - 1, lin(T.brass[1]));

  // ---- the oil lamp: a brass foot and collar, an amber oil font (the chimney and flame are `lampGlass`)
  const lamp = new Grid(S), lampGlass = new Grid(S);
  const lx = Math.round(LAMP.x / S), ly = Math.round(LAMP.y / S), lz = Math.round(LAMP.z / S);
  box(lamp, [(lx - 2) * S, LAMP.y, (lz - 2) * S], [(lx + 2) * S, LAMP.y + S, (lz + 2) * S], c(T.brass[1]));
  box(lamp, [(lx - 1) * S, LAMP.y + S, (lz - 1) * S], [(lx + 1) * S, LAMP.y + 2 * S, (lz + 1) * S], c(T.brass[2]));
  ellipsoid(lamp, [(lx) * S, LAMP.y + 3.5 * S, lz * S], [0.06, 0.04, 0.06], (x, y, z) => lin(hash3(x, y, z, 5) < 0.3 ? '#B46F2E' : '#C98A3A'));
  box(lamp, [(lx - 2) * S, LAMP.y + 5 * S, (lz - 2) * S], [(lx + 2) * S, LAMP.y + 6 * S, (lz + 2) * S], c(T.brass[0]));
  for (let y = ly + 6; y < ly + 13; y++) {
    const r = y < ly + 9 ? 1 : 0;
    for (let x = lx - 1 - r; x < lx + 1 + r; x++) for (let z = lz - 1 - r; z < lz + 1 + r; z++) {
      const inner = x >= lx - 1 && x < lx + 1 && z >= lz - 1 && z < lz + 1 && y >= ly + 7 && y < ly + 9;
      lampGlass.set(x, y, z, lin(inner ? GLOW.core : y < ly + 9 ? '#FFC870' : '#F2C890'));
    }
  }

  // ---- the alarm clock: a red drum, a cream face, two brass bells and a hammer, on brass feet
  const clock = new Grid(S), ring = new Grid(S);
  ellipsoid(clock, [0, 0.085, 0], [0.07, 0.07, 0.035], (x, y, z) => lin(T.collar[hash3(x, y, z, 9) < 0.7 ? 0 : 1]));
  for (let x = -3; x <= 2; x++) for (let y = 1; y <= 6; y++) if ((x + 0.5) ** 2 + (y - 3.5) ** 2 <= 7.5) clock.set(x, y, 2, lin(TRIM[0]));
  clock.set(-1, 3, 3, lin(T.hoof[1])); clock.set(-1, 4, 3, lin(T.hoof[1])); clock.set(-1, 5, 3, lin(T.hoof[1])); clock.set(0, 3, 3, lin(T.hoof[1]));
  for (const dx of [-0.045, 0.045]) ellipsoid(clock, [dx, 0.165, 0], [0.03, 0.026, 0.026], c(T.brass[0]));
  clock.set(-1, 7, 0, lin(T.brass[2])); clock.set(-1, 8, 0, lin(T.brass[2]));
  for (const fx of [-2, 1]) clock.set(fx, -1, 0, lin(T.brass[2]));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { ring.set(sx * (5 + k) + (sx < 0 ? -1 : 0), 7 + k, 0, lin(GLOW.gold)); ring.set(sx * (6 + k) + (sx < 0 ? -1 : 0), 4 + k, 0, lin(GLOW.gold)); }

  // ---- on the sill: a red candle in a brass dish, ringed with holly
  const cx = Math.round(CANDLE.x / S), cy = Math.round(CANDLE.y / S), cz = Math.round(CANDLE.z / S);
  for (let x = cx - 2; x < cx + 2; x++) for (let z = cz - 2; z < cz + 2; z++) fine.set(x, cy, z, lin(T.brass[1]));
  for (let x = cx - 1; x < cx + 1; x++) for (let z = cz - 1; z < cz + 1; z++) for (let y = cy + 1; y < cy + 7; y++) fine.set(x, y, z, lin(y === cy + 6 ? '#E07068' : '#C8342E'));
  fine.set(cx, cy + 7, cz - 1, lin(T.hoof[0]));
  glowFine.set(cx, cy + 8, cz - 1, lin(GLOW.flame)); glowFine.set(cx, cy + 9, cz - 1, lin(GLOW.core)); glowFine.set(cx - 1, cy + 8, cz - 1, lin(GLOW.ember));
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2, x = cx - 0.5 + Math.cos(ang) * 2.2, z = cz - 0.5 + Math.sin(ang) * 2.2;
    fine.set(Math.round(x), cy + 1, Math.round(z), lin(a % 4 === 0 ? '#D8342C' : a % 2 ? T.pine[0] : T.pine[2]));
    if (a % 3 === 1) fine.set(Math.round(x), cy + 2, Math.round(z), lin(T.pine[1]));
  }

  // ---- lights along the headboard's top, sagging between the posts and the middle
  const hbTop = (z: number) => (20 + 2.4 * (1 - (z / (hw * D)) ** 2)) * D;
  const zA = -m.w / 2 - 0.02, zB = m.w / 2 + 0.02;
  for (let k = 0; k <= 88; k++) {
    const t = k / 88, z = zA + (zB - zA) * t, seg = (t * 3) % 1;
    const y = hbTop(Math.max(-0.5, Math.min(0.5, z))) + 0.03 - 0.07 * Math.sin(seg * Math.PI);
    fine.set(0, Math.round(y / S), Math.round(z / S), lin(T.pine[2]));
    if (k % 8 === 4) {
      const col = [GLOW.red, GLOW.green, GLOW.gold][(k / 8 | 0) % 3];
      for (const [dx, dy] of [[0, -1], [0, -2], [1, -1], [1, -2]]) glowFine.set(dx, Math.round(y / S) + dy, Math.round(z / S), lin(col));
    }
  }

  // ---- a knitted stocking hanging from the near headboard post: red, a cream cuff and stripe, green heel and toe
  const sz0 = Math.round((hw + 2) * D / S);
  const STOCK = [
    '..cccccc....',
    '..cccccc....',
    '..rrrrrr....',
    '..rrrrrr....',
    '..wwwwww....',
    '..rrrrrr....',
    '..rrrrrr....',
    '..rrrrrr....',
    '.grrrrrrrr..',
    '.ggrrrrrrrr.',
    '..ggrrrrrrgg',
    '....rrrrrggg',
  ];
  STOCK.forEach((row, r) => [...row].forEach((ch, k) => {
    if (ch === '.') return;
    const col = ch === 'c' || ch === 'w' ? TRIM[ch === 'c' ? 0 : 1] : ch === 'g' ? '#4F7A55' : mod(k + r, 3) === 0 ? '#A83A33' : '#C24E45';
    for (const dz of [0, 1]) fine.set(-6 + k, 46 - r, sz0 + dz, lin(col));
  }));
  fine.set(-3, 47, sz0, lin(TRIM[1])); fine.set(-2, 48, sz0, lin(TRIM[1]));

  // ---- the rag rug by the bed, braided rings, and his slippers on it
  for (let x = i(0.55); x < i(1.75); x++) for (let z = i(0.7); z < i(1.45); z++) {
    const d = Math.hypot((x + 0.5 - i(1.15)) / 12, (z + 0.5 - i(1.07)) / 7.5);
    if (d > 1) continue;
    const band = Math.min(4, Math.floor(d * 5));
    const tone = ['#C24E45', '#E3D8C0', '#4F7A55', '#D9A84A', '#3D5A8A'][band];
    g.set(x, 0, z, lin(mod(x + z, 2) && hash3(x, 0, z, 79) < 0.35 ? TRIM[2] : tone));
  }
  for (const sx of [0.78, 0.94]) {
    const x0 = Math.round(sx / S), z0 = Math.round(0.62 / S);
    for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 10; z++) for (let y = 2; y < 5; y++) {
      if (y === 4 && z < z0 + 4) continue;
      const cuff = y === 4 || (y === 3 && z < z0 + 4 && (x === x0 || x === x0 + 3 || z === z0));
      if (y === 3 && z < z0 + 4 && !cuff) continue;
      if ((x === x0 || x === x0 + 3) && z === z0 + 9) continue;
      fine.set(x, y, z, lin(cuff ? TRIM[0] : y === 2 ? '#7A2A26' : '#B5443C'));
    }
  }

  // ---- the shelf over the window: a knitted sheep, two jars of preserves, a stack of books
  const shy = i(1.95), sx0 = i(SIDE_X), sx1 = i(0.5), wz = i(BACK_Z);
  for (let x = sx0; x < sx1; x++) for (const d of [0, 1, 2]) g.set(x, shy, wz + d, lin(WALNUT[0]));
  for (const x of [sx0 + 2, sx1 - 3]) for (const y of [shy - 1, shy - 2]) g.set(x, y, wz, lin(WALNUT[2]));
  const fy = Math.round((shy + 1) * D / S), fz = Math.round((BACK_Z + 0.08) / S);
  const sheepX = Math.round(-0.38 / S);
  ellipsoid(fine, [(sheepX + 2) * S, (fy + 2.5) * S, fz * S], [0.07, 0.055, 0.05], (x, y, z) => lin(T.wool[hash3(x, y, z, 81) < 0.6 ? 0 : 1]));
  box(fine, [(sheepX + 4) * S, (fy + 2) * S, (fz - 1) * S], [(sheepX + 7) * S, (fy + 5) * S, (fz + 1) * S], c(T.face[0]));
  for (const lxx of [sheepX, sheepX + 3]) box(fine, [lxx * S, fy * S, (fz - 1) * S], [(lxx + 1) * S, (fy + 1) * S, (fz + 1) * S], c(T.face[1]));
  for (const [jx, col] of [[-0.12, '#9C2F3A'], [-0.01, '#D9A84A']] as const) {
    const x0 = Math.round(jx / S);
    box(fine, [x0 * S, fy * S, (fz - 1) * S], [(x0 + 3) * S, (fy + 4) * S, (fz + 2) * S], c(col));
    box(fine, [x0 * S, (fy + 4) * S, (fz - 1) * S], [(x0 + 3) * S, (fy + 5) * S, (fz + 2) * S], c('#E9D9B8'));
  }
  for (const [k, col] of [[0, '#3D5A8A'], [1, '#B5443C'], [2, '#4F7A55']] as const) {
    const x0 = Math.round(0.14 / S) + (k === 1 ? 1 : 0);
    box(fine, [x0 * S, (fy + k * 1.5) * S, (fz - 2) * S], [(x0 + 7) * S, (fy + k * 1.5 + 1.5) * S, (fz + 2) * S], c(col));
  }
  // A framed sheep on the side wall: a cream fleece on a night-blue ground, read from the room (its right is -z).
  const SHEEP = ['..........', '...####...', '..######h.', '.#######hh', '..######..', '...#..#...', '..........'];
  const px = Math.round((SIDE_X + 0.01) / S), py = Math.round(1.45 / S), pz = Math.round(1.25 / S);
  for (let x = -1; x <= 10; x++) for (let y = -1; y <= 7; y++) {
    const edge = x === -1 || x === 10 || y === -1 || y === 7;
    const ch = edge ? 'F' : SHEEP[6 - y][x];
    fine.set(px, py + y, pz - x, lin(ch === 'F' ? T.brass[2] : ch === '#' ? TRIM[0] : ch === 'h' ? '#3A2E2A' : y < 2 ? '#4F7A55' : '#2A3366'));
  }

  bedroomCache = {
    room: cullUnseen(mergeGeometries([buildGeometry(g.map, D), buildGeometry(big.map, B), buildGeometry(fine.map, S), buildGeometry(lamp.map, S)], false)!),
    glow: cullUnseen(mergeGeometries([buildGeometry(glow.map, D, { ao: false }), buildGeometry(glowFine.map, S, { ao: false })], false)!),
    lampGlass: buildGeometry(lampGlass.map, S, { ao: false }),
    quiltBump: quiltBumpGeometry(qPaint),
    clock: buildGeometry(clock.map, S),
    ring: buildGeometry(ring.map, S, { ao: false }),
  };
  return bedroomCache;
}

/** The quilt over his chest and legs, which rises and falls about the mattress top; a cream sheet turned down at his chin. */
function quiltBumpGeometry(qPaint: Paint): BufferGeometry {
  const m = BED.mattress, g = new Grid(D), hw = Math.round(m.w / 2 / D);
  ellipsoid(g, [1.2, m.top, 0], [0.55, 0.15, 0.27], (x, y, z) => (y * D < m.top ? null : qPaint(x, y, z)), 0, 4);
  box(g, [0.65, m.top, (-hw - 1) * D], [0.95, m.top + D, (hw + 1) * D], (x, y, z) => (x < 14 ? lin(TRIM[0]) : qPaint(x, y, z)));
  box(g, [0.65, m.top + D, -0.32], [0.7, m.top + 2 * D, 0.32], () => lin(TRIM[0]));
  return buildGeometry(g.map, D);
}

// ---------- the farmer ----------

const SKIN = ['#F6CDB4', '#EDBCA2', '#DBA68A'] as const;
const WHISKER = ['#F4F1EA', '#E2DDD3', '#C9C3B8'] as const;
const LID = '#4A322C';
export interface FarmerGeo { asleep: BufferGeometry; awake: BufferGeometry; cap: BufferGeometry; body: BufferGeometry }
let farmerCache: FarmerGeo | null = null;
/**
 * The farmer, built standing (face toward +z, crown at +y) about the base of his neck; the stage lays him down on the
 * pillow. Two heads (asleep, awake) swap on the bump and blink on the results; the nightcap and the body are shared.
 * 0.02 m, not the plan's 0.04 m: a face that reads at bubble size needs a head 15 voxels wide, and at 0.04 m it is 7.
 */
export function farmerGeometry(): FarmerGeo {
  if (farmerCache) return farmerCache;
  const s = 0.02;
  const skin: Paint = (x, y, z) => pick(SKIN, hash3(x >> 2, y >> 2, z >> 2, 5), [0.75, 0.97]);
  const white = (x: number, y: number, z: number) => pick(WHISKER, hash3(x, y, z, 7), [0.6, 0.92]);
  const head = (awake: boolean) => {
    const g = new Grid(s);
    box(g, [-0.15, 0, -0.13], [0.15, 0.28, 0.13], skin, 2);
    for (const sx of [-1, 1]) box(g, [sx * 0.16 - 0.02, 0.1, -0.03], [sx * 0.16 + 0.02, 0.18, 0.03], (_x, y) => lin(y === 6 ? SKIN[2] : SKIN[1])); // ears
    const zf = 7; // one cell proud of the face
    // A round, rosy nose.
    for (let x = -1; x <= 1; x++) for (let y = 4; y <= 6; y++) for (const z of [zf, zf + 1]) if (!(z === zf + 1 && Math.abs(x) === 1 && y !== 5)) g.set(x, y, z, lin(z === zf + 1 && y === 6 ? '#F2C2AE' : '#E3A28C'));
    for (const sx of [-1, 1]) {
      const ex = sx * 3;
      if (awake) {
        // Wide open: white, a dark iris with a glint, brows up in surprise.
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.set(ex + dx, 8 + dy, zf, lin('#FBFBF8'));
        g.set(ex, 8, zf, lin('#3B2E2A')); g.set(ex, 7, zf, lin('#3B2E2A')); g.set(ex + sx, 7, zf, lin('#3B2E2A')); g.set(ex, 8, zf + 1, lin('#5A463E'));
        for (let dx = -2; dx <= 1; dx++) for (const z of [zf, zf + 1]) g.set(ex + (sx > 0 ? dx + 1 : dx), 11, z, white(ex + dx, 11, z));
      } else {
        // Closed: a lid line curving down at the ends, lashes, and heavy brows resting low.
        for (let dx = -1; dx <= 1; dx++) g.set(ex + dx, 7, zf, lin(LID));
        g.set(ex - 2, 8, zf, lin(LID)); g.set(ex + 2, 8, zf, lin(LID));
        for (let dx = -2; dx <= 1; dx++) for (const z of [zf, zf + 1]) g.set(ex + (sx > 0 ? dx + 1 : dx), 10, z, white(ex + dx, 10, z));
      }
      // Rosy cheeks.
      for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) g.set(sx * 5 + (sx > 0 ? dx - 1 : -dx + 1), 4 + dy, zf - 1 + (Math.abs(sx * 5) > 5 ? 0 : 1), lin('#EE9C90'));
      // Grey tufts at the temples, sticking out from under the cap.
      for (let dy = 0; dy < 3; dy++) g.set(sx * 8, 9 + dy, 1 - dy, white(sx, dy, 0));
    }
    // A big white moustache under the nose, drooping at the ends, over the mouth.
    for (let dx = -5; dx <= 5; dx++) for (let dy = 0; dy < 3; dy++) {
      const droop = Math.abs(dx) >= 4 ? -1 - (Math.abs(dx) === 5 ? 1 : 0) : 0;
      if (Math.abs(dx) === 5 && dy === 2) continue;
      g.set(dx, 2 + dy + droop, zf, white(dx, dy, 0));
      if (dy === 1 && Math.abs(dx) <= 3) g.set(dx, 3, zf + 1, white(dx, dy, 1));
    }
    if (awake) for (let dx = -1; dx <= 1; dx++) for (const dy of [-1, 0]) g.set(dx, dy + 1, zf, lin(dy === 0 && dx === 0 ? '#3A1C1C' : '#6A2E2E'));
    return buildGeometry(g.map, s);
  };
  // The nightcap: a cream cuff round his head under the brim of the crown, then a long striped cone that flops over to
  // the +x side and down, a fluffy pom at its end.
  const cap = new Grid(s);
  const path = (t: number): V3 => {
    const a = Math.min(1, t * 1.6), u = Math.max(0, t * 1.6 - 0.6);
    return [0.02 + 0.2 * a ** 2 + 0.12 * u, 0.28 + 0.16 * Math.sin(a * Math.PI * 0.6) - 0.22 * u ** 1.3, 0];
  };
  const N = 40, along = Array.from({ length: N + 1 }, (_, k) => path(k / N));
  for (let k = 0; k <= N; k++) {
    const r = 0.15 * (1 - k / N) + 0.025;
    ellipsoid(cap, along[k], [r, Math.max(0.03, r * 0.75), r], (_x, y) => (y < 15 && k < 12 ? null : [0, 0, 0]));
  }
  // Each cell takes the stripe of the nearest point along the cap, so the bands run round it cleanly.
  for (const v of cap.map.values()) {
    let best = 0, bd = Infinity;
    along.forEach((p, k) => { const d = ((v.x + 0.5) * s - p[0]) ** 2 + ((v.y + 0.5) * s - p[1]) ** 2 + ((v.z + 0.5) * s - p[2]) ** 2; if (d < bd) { bd = d; best = k; } });
    v.c = lin(BED.cap[Math.floor((best / N) * 7) % 2]);
  }
  box(cap, [-0.17, 0.24, -0.16], [0.17, 0.3, 0.16], (x, y, z) => pick(WHISKER, hash3(x, y, z, 11), [0.7, 0.95]), 1);
  const tip = path(1);
  ellipsoid(cap, [tip[0] + 0.02, tip[1] - 0.04, 0], [0.05, 0.05, 0.05], (x, y, z) => pick(WHISKER, hash3(x, y, z, 13), [0.7, 0.95]), 0.25, 8);
  // Shoulders in a striped flannel nightshirt under the turned-down sheet, one hand out on the quilt.
  const body = new Grid(s);
  const flannel: Paint = (x) => lin(mod(x, 3) === 0 ? '#F3EAD6' : '#7F9CC9');
  for (const sx of [-1, 1]) ellipsoid(body, [sx * 0.2, -0.1, 0], [0.14, 0.08, 0.1], flannel, 0.05, 2);
  box(body, [-0.1, -0.06, -0.06], [0.1, 0.0, 0.08], skin);
  box(body, [0.14, -0.24, 0.08], [0.26, -0.18, 0.18], skin);
  box(body, [0.12, -0.2, -0.02], [0.28, -0.1, 0.1], flannel);
  farmerCache = { asleep: head(false), awake: head(true), cap: buildGeometry(cap.map, s), body: buildGeometry(body.map, s) };
  return farmerCache;
}

/** Where the farmer sits up: the base of his neck, his torso turned this far toward the camera. */
export const SITTING = { x: 0.42, y: 1.08, z: 0.02, turn: 0.55 } as const;
let sitCache: BufferGeometry | null = null;
/**
 * The farmer sitting up against the headboard, about the base of his neck like the heads: a striped flannel nightshirt
 * with a placket of buttons, one arm down with the hand on the quilt, the other up scratching the side of his head.
 * 0.04 m voxels.
 */
export function farmerSitting(): BufferGeometry {
  if (sitCache) return sitCache;
  const g = new Grid(CHAR);
  const shirt: Paint = (x, y, z) => lin(mod(x, 2) === 0 ? '#F3EAD6' : hash3(x, y, z, 6) < 0.15 ? '#6F8DBB' : '#7F9CC9');
  const skin: Paint = (x, y, z) => pick(SKIN, hash3(x, y, z, 5), [0.75, 0.97]);
  box(g, [-0.2, -0.52, -0.12], [0.2, -0.02, 0.12], shirt, 1);
  // The collar and placket, cream, with three brass buttons.
  for (let y = -12; y <= -1; y++) g.set(0, y, 3, lin(TRIM[1]));
  for (const y of [-3, -6, -9]) g.set(0, y, 4, lin(T.brass[0]));
  for (const x of [-2, -1, 1, 2]) g.set(x, -1, 3, lin(TRIM[0]));
  box(g, [-0.08, -0.04, -0.06], [0.08, 0.02, 0.06], skin);
  const limb = (pts: V3[], r: number, paint: Paint) => {
    for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j <= 6; j++) {
      const t = j / 6, p = [0, 1, 2].map((n) => pts[k][n] + (pts[k + 1][n] - pts[k][n]) * t) as V3;
      ellipsoid(g, p, [r, r, r], paint);
    }
  };
  limb([[-0.22, -0.08, 0], [-0.25, -0.24, 0.04], [-0.24, -0.4, 0.1]], 0.05, shirt);
  ellipsoid(g, [-0.24, -0.46, 0.13], [0.04, 0.035, 0.05], skin);
  // The other arm up, elbow out, the hand at the side of his head above the ear.
  limb([[0.22, -0.08, 0], [0.34, -0.06, 0.04], [0.3, 0.1, 0.02]], 0.05, shirt);
  limb([[0.3, 0.1, 0.02], [0.22, 0.2, 0.0]], 0.035, skin);
  ellipsoid(g, [0.2, 0.22, 0.0], [0.04, 0.045, 0.04], skin);
  return (sitCache = buildGeometry(g.map, CHAR));
}

let quiltSatCache: BufferGeometry | null = null;
/** The quilt pushed down to his waist: a fold along the bed at the waist and his legs under the rest. */
export function quiltSat(): BufferGeometry {
  if (quiltSatCache) return quiltSatCache;
  const m = BED.mattress, g = new Grid(D), hw = Math.round(m.w / 2 / D), qPaint = quiltPaint(D, -hw - 1);
  box(g, [0.5, m.top, (-hw - 1) * D], [0.95, m.top + D, (hw + 1) * D], qPaint);
  box(g, [0.55, m.top + D, (-hw - 1) * D], [0.8, m.top + 3 * D, (hw + 1) * D], (x, y, z) => (y === 12 ? lin(TRIM[0]) : qPaint(x, y, z)), 1);
  ellipsoid(g, [1.4, m.top + 0.05, 0], [0.55, 0.1, 0.22], (x, y, z) => (y * D < m.top + 0.05 ? null : qPaint(x, y, z)));
  return (quiltSatCache = buildGeometry(g.map, D));
}

const folded = new Map<number, BufferGeometry>();
/**
 * A Warm Blanket folded (Part 6.4.6): 0.48 x 0.12 x 0.4 m, three layers of the quilt's patches with a cream stitch line
 * along the folded edge and the middle layer hanging a cell over one side. On 0.04 m voxels: the plan's 0.10 m cannot
 * make a 0.12 m fold. About the middle of its base.
 */
export function foldedQuilt(seed: number): BufferGeometry {
  const hit = folded.get(seed);
  if (hit) return hit;
  const g = new Grid(CHAR);
  for (let y = 0; y < 3; y++) for (let x = -6; x < 6 + (y === 1 ? 1 : 0); x++) for (let z = -5; z < 5; z++) {
    const stitch = y === 2 && z === 4 && x % 2 === 0;
    const tone = BED.quilt[(Math.floor((x + 6) / 4) + Math.floor((z + 5) / 5) * 2 + y + seed) % BED.quilt.length];
    g.set(x, y, z, lin(stitch ? T.linen[0] : tone));
  }
  const geo = buildGeometry(g.map, CHAR);
  folded.set(seed, geo);
  return geo;
}

export type { RGB };
