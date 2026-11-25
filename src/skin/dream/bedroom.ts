import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, pickBy, T } from '../voxel/palette';
import { meanOf, solid } from '../voxel/paint';
import { box, ellipsoid, Grid, hash3 } from '../voxel/primitives';
import type { Paint, RGB, V3 } from '../voxel/primitives';
import { CHAR } from '../voxel/sheep';
import { Matrix4, Vector3 } from 'three';
import { blendPose, farmerCells, IN_BED, lyingAt, PIVOT, POSES, UNIT, worldOf } from './farmer';
import type { Piece, Pose } from './farmer';

/**
 * The farmer's bedroom on Christmas night (V4.1 Part 7, V6 Part 6.4), the real world under the dream, drawn in its own
 * small canvas. One room serves the bubble and the results: honey pine planks over a sage wainscot, a walnut bed with a
 * patchwork quilt, a nightstand with an oil lamp and a red alarm clock, a window over it with snow banked outside, a
 * candle and holly on the sill and the moon beyond, gingham curtains, lights along the headboard, a knitted stocking on
 * the bedpost, a rag rug and slippers, a shelf, a framed sheep, a second window toward the foot of the bed and the beam
 * the results hang from (the bubble's camera sees only the corner by the bed; the results see the room). Grids: 0.05 m for the room and its furniture (the plan's 0.10 m made the board seams and trim a hand wide), 0.10 m
 * for the ceiling and beam, 0.025 m for the small things on the nightstand, the sill and the post, 0.02 m for the farmer
 * (farmer.ts). All in the room's own frame: the bed runs along +x with the headboard at x = 0, the
 * nightstand and the window on the -z side, the floor at y = 0.
 */
export const BED = {
  cap: ['#C24E45', '#F3EAD6'] as const,
  mattress: { w: 1.1, h: 0.3, l: 2.0, top: 0.55 },
  pillowTop: 0.7,
};
const D = 0.05, B = 0.1, S = 0.025;
const PINE = ['#BE9670', '#AF8862', '#987452'] as const;
const SEAM = '#8A6342';
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
/**
 * The window in the back wall toward the foot of the bed, beside the hanging board, the moon in it. The window that was
 * behind his pillow is gone (the bed strip, 2026-11-24): seen from the bed's side it stood right behind his head, and
 * his face, the bubble's tail and his z's need a plain wall behind them.
 */
const ROOM_WINDOW = { x0: 2.35, x1: 3.15, y0: 1.3, y1: 2.3 } as const;
/**
 * The nightstand, against the back wall past the foot of the bed, and what stands on it: the oil lamp, the candle and
 * the alarm clock. It stood by his pillow until the bed strip (docs/dream/01-farmer.md, section 4): seen from the bed's
 * side, everything the dream is made of has to stand clear of the bed.
 */
const STAND = { x0: 3.1, x1: 3.55, z0: -1.1, z1: -0.75, top: 0.6 } as const;
export const LAMP = { x: 3.2, y: 0.6, z: -0.98 } as const;
export const CLOCK = { x: 3.45, y: 0.6, z: -0.84, turn: -0.2 } as const;
/** The candle on the nightstand, between the lamp and the clock. */
export const CANDLE = { x: 3.34, y: 0.6, z: -1.0 } as const;
/** The knitting basket on the floor beside the nightstand: its middle. */
export const BASKET = { x: 3.86, z: -0.92 } as const;
/** The low shelf on the wall over the basket: his five books stand on it. */
const BOOKSHELF = { x0: 3.3, x1: 4.05, y: 0.75 } as const; // 0.75 (was 1.0): the books clear the dream window's straight rim from 1280 wide (v3/09, check 4)
/** The low window the bed strip ends on (the strip sees further along the wall than the room is long). */
export const STRIP_WINDOW = { w: 0.8, y0: 0.9, y1: 1.45 } as const;
/** The beam across the room and the hook the results board hangs from. */
export const BEAM = { y: 2.2, z: 0.4, hookX: 2.15 } as const;
/**
 * The pillow, across the bed: under his head where he lies (farmer.ts `IN_BED`: its middle is his), with room for the
 * cap's tail beside it, and reaching under his neck.
 */
const PILLOW = { x0: 0.05, x1: 0.7, z0: -0.3, z1: 0.5 } as const;
/** The poses in which his head lies on the pillow: the pillow gives under his head in each (`pillowDent`). */
const ON_PILLOW: readonly Pose[] = [POSES.bedSleep, POSES.bedDeep, POSES.bedStir];

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

function buildWall(g: Grid, at: Wall, u0: number, u1: number, seed: number, holes: Hole[], top = Math.round(ROOM_H / D)) {
  for (let u = u0; u <= u1; u++) for (let y = 0; y < top; y++) {
    if (holes.some((h) => u >= h.u0 && u < h.u1 && y >= h.y0 && y < h.y1)) continue;
    g.set(...at(u, y, 0), wallTone(u, y, seed));
    // The baseboard and the chair rail stand proud of the boards.
    if (y <= 1 || y === 17) g.set(...at(u, y, 1), lin(TRIM[1]));
  }
}

/** Night sky behind a window, self-lit: deep blue to the hills, snow on them, a few pines, stars, and a moon if asked. */
/** `lift` raises the hills: the window over the nightstand keeps them low, so its lower panes stay night blue. */
function sky(glow: Grid, at: Wall, h: Hole, moon: [number, number] | null, seed: number, lift: number, depth = -12, m = 26) {
  for (let u = h.u0 - m; u < h.u1 + m; u++) {
    const hill = h.y0 + lift + Math.round(1.6 * Math.sin(u * 0.21 + seed) + 1.1 * Math.sin(u * 0.53 + seed * 2));
    const pine = hash3(Math.floor(u / 5), 0, seed, 61) < 0.35 ? 5 - Math.abs(mod(u, 5) - 2) * 2 : 0;
    for (let y = h.y0 - m; y < h.y1 + m; y++) {
      let col: string;
      if (y <= hill) col = y === hill ? '#D7E0F4' : '#BCC8E8'; // one tone: the average of its paler and its darker cubes, four to one
      else if (pine > 0 && y <= hill + pine) col = '#22314A';
      else if (moon && (u - moon[0]) ** 2 + (y - moon[1]) ** 2 <= 10 && (u - moon[0] + 2) ** 2 + (y - moon[1] - 1) ** 2 > 8) col = '#F6F0CC';
      else if (hash3(u, y, seed, 67) < 0.025 && y > Math.max(hill + 7, h.y0 + 9)) col = hash3(u, y, seed, 69) < 0.5 ? '#FFF6D8' : '#CFDBFF';
      else { const k = (y - hill) / (h.y1 + m - hill); col = k > 0.6 ? '#121530' : k > 0.3 ? '#171D42' : '#1B234A'; }
      glow.set(...at(u, y, depth), lin(col));
    }
  }
}

/** A window cut in a wall: cream frame and cross bar, a deep sill, snow banked outside, frost in the pane corners. */
function windowIn(g: Grid, glow: Grid, at: Wall, h: Hole, seed: number) {
  const TRIMMED = meanOf([TRIM[0], TRIM[0], TRIM[0], TRIM[0], TRIM[1]]);
  const trim = (_u: number, _y: number) => TRIMMED; // one colour: four cubes in five were the paler
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
  /** The quilt over him, which breathes: the part over his chest (it lifts with him) and the part over his legs. */
  quiltChest: BufferGeometry;
  quiltLegs: BufferGeometry;
  /** The alarm clock about its own base, face toward +z, and the ring lines it throws when it goes off. */
  clock: BufferGeometry;
  ring: BufferGeometry;
}

let bedroomCache: BedroomGeo | null = null;
export function bedroomGeometry(): BedroomGeo {
  if (bedroomCache) return bedroomCache;
  const g = new Grid(D), big = new Grid(B), fine = new Grid(S), glow = new Grid(D), glowFine = new Grid(S);
  const wood = (seed: number): Paint => (x, y, z) => pick(WALNUT, hash3(x >> 1, y >> 2, z >> 1, seed), [0.55, 0.92]);
  const i = (m: number) => Math.round(m / D);

  // ---- the walls, the floor, the ceiling and the beam
  const backHole: Hole = { u0: i(ROOM_WINDOW.x0), u1: i(ROOM_WINDOW.x1), y0: i(ROOM_WINDOW.y0), y1: i(ROOM_WINDOW.y1) };
  buildWall(g, sideWall, i(BACK_Z) - 1, i(ROOM_Z1), 3, []);
  buildWall(g, backWall, i(SIDE_X) - 1, i(ROOM_X1), 5, [backHole]);
  windowIn(g, glow, backWall, backHole, 2);
  // The moon sits toward the window's left, where the results' camera, off to the right, sees it through the glass.
  sky(glow, backWall, backHole, [backHole.u0 + 1, backHole.y1 - 5], 2, 2);
  // Floorboards 0.15 m wide along the bed, butt joints staggered.
  for (let x = i(SIDE_X); x < i(ROOM_X1); x++) for (let z = i(BACK_Z); z < i(ROOM_Z1); z++) {
    const row = Math.floor(z / 3), off = mod(row * 17, 40);
    const seam = mod(z, 3) === 0 || mod(x + off, 40) === 0;
    g.set(x, -1, z, seam ? lin(FLOOR[2]) : pickBy(FLOOR, hash3(Math.floor((x + off) / 40), row, 0, 7), [0.5, 0.95]));
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
  // The pillow, a pale ticking with a blue stripe, chamfered, pressed down a cell where his head lies.
  box(g, [PILLOW.x0, m.top, PILLOW.z0], [PILLOW.x1, BED.pillowTop, PILLOW.z1], (_x, y, z) => lin(y >= i(BED.pillowTop) - 1 && mod(z, 3) === 0 ? '#C9D4E8' : '#EEF1F6'), 1);
  for (const key of pillowDent()) { const [x, z] = key.split(',').map(Number); g.del(x, i(BED.pillowTop) - 1, z); }

  // ---- the nightstand: walnut, legs, a drawer with a brass knob, an overhanging top
  const s = STAND;
  for (const [lx, lz] of [[s.x0, s.z0], [s.x1 - D, s.z0], [s.x0, s.z1 - D], [s.x1 - D, s.z1 - D]]) box(g, [lx, 0, lz], [lx + D, 0.15, lz + D], c(WALNUT[2]));
  box(g, [s.x0, 0.15, s.z0], [s.x1, s.top - D, s.z1], wood(23));
  box(g, [s.x0 - D, s.top - D, s.z0 - D], [s.x1 + D, s.top, s.z1 + D], c(WALNUT[0]));
  // The drawer is on the stand's front, toward the room.
  for (let x = i(s.x0) + 1; x < i(s.x1) - 1; x++) for (let y = 6; y <= 10; y++) {
    const edge = y === 6 || y === 10 || x === i(s.x0) + 1 || x === i(s.x1) - 2;
    if (edge) g.set(x, y, i(s.z1), lin(WALNUT[2]));
  }
  // The knob runs back to the stand's face: the drawer is only an outline frame, and a knob at the frame's face hung in
  // the air in front of it (Brian, 2026-11-09: "a lot of them are floating").
  for (let dz = 0; dz <= 2; dz++) {
    fine.set(Math.round(((s.x0 + s.x1) / 2) / S), 16, Math.round(s.z1 / S) + dz, lin(T.brass[0]));
    fine.set(Math.round(((s.x0 + s.x1) / 2) / S) - 1, 16, Math.round(s.z1 / S) + dz, lin(T.brass[1]));
  }

  // ---- the oil lamp: a brass foot and collar, an amber oil font (the chimney and flame are `lampGlass`)
  const lamp = new Grid(S), lampGlass = new Grid(S);
  const lx = Math.round(LAMP.x / S), ly = Math.round(LAMP.y / S), lz = Math.round(LAMP.z / S);
  box(lamp, [(lx - 2) * S, LAMP.y, (lz - 2) * S], [(lx + 2) * S, LAMP.y + S, (lz + 2) * S], c(T.brass[1]));
  box(lamp, [(lx - 1) * S, LAMP.y + S, (lz - 1) * S], [(lx + 1) * S, LAMP.y + 2 * S, (lz + 1) * S], c(T.brass[2]));
  ellipsoid(lamp, [(lx) * S, LAMP.y + 3.5 * S, lz * S], [0.06, 0.04, 0.06], () => meanOf(['#B46F2E', '#B46F2E', '#B46F2E', '#C98A3A', '#C98A3A', '#C98A3A', '#C98A3A', '#C98A3A', '#C98A3A', '#C98A3A']));
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
  ellipsoid(clock, [0, 0.085, 0], [0.07, 0.07, 0.035], () => meanOf([...Array(7).fill(T.collar[0]), ...Array(3).fill(T.collar[1])]));
  for (let x = -3; x <= 2; x++) for (let y = 1; y <= 6; y++) if ((x + 0.5) ** 2 + (y - 3.5) ** 2 <= 7.5) clock.set(x, y, 2, lin(TRIM[0]));
  clock.set(-1, 3, 3, lin(T.hoof[1])); clock.set(-1, 4, 3, lin(T.hoof[1])); clock.set(-1, 5, 3, lin(T.hoof[1])); clock.set(0, 3, 3, lin(T.hoof[1]));
  for (const dx of [-0.045, 0.045]) ellipsoid(clock, [dx, 0.165, 0], [0.03, 0.026, 0.026], c(T.brass[0]));
  clock.set(-1, 7, 0, lin(T.brass[2])); clock.set(-1, 8, 0, lin(T.brass[2]));
  for (const fx of [-2, 1]) clock.set(fx, -1, 0, lin(T.brass[2]));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { ring.set(sx * (5 + k) + (sx < 0 ? -1 : 0), 7 + k, 0, lin(GLOW.gold)); ring.set(sx * (6 + k) + (sx < 0 ? -1 : 0), 4 + k, 0, lin(GLOW.gold)); }

  // ---- on the nightstand: a cream candle in a brass dish. The dream's third world has it as a lighthouse.
  const cx = Math.round(CANDLE.x / S), cy = Math.round(CANDLE.y / S), cz = Math.round(CANDLE.z / S);
  for (let x = cx - 2; x < cx + 2; x++) for (let z = cz - 2; z < cz + 2; z++) fine.set(x, cy, z, lin(T.brass[1]));
  for (let x = cx - 1; x < cx + 1; x++) for (let z = cz - 1; z < cz + 1; z++) for (let y = cy + 1; y < cy + 7; y++) fine.set(x, y, z, lin(y === cy + 6 ? '#FFFDF4' : '#F4F0EA'));
  fine.set(cx, cy + 7, cz - 1, lin(T.hoof[0]));
  glowFine.set(cx, cy + 8, cz - 1, lin(GLOW.flame)); glowFine.set(cx, cy + 9, cz - 1, lin(GLOW.core)); glowFine.set(cx - 1, cy + 8, cz - 1, lin(GLOW.ember));

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

  // ---- the rag rug before the nightstand, braided rings, and his slippers on it, side on to the room
  for (let x = i(2.55); x < i(3.85); x++) for (let z = i(-0.72); z < i(0.03); z++) {
    const d = Math.hypot((x + 0.5 - i(3.2)) / 13, (z + 0.5 - i(-0.35)) / 7.5);
    if (d > 1) continue;
    const band = Math.min(4, Math.floor(d * 5));
    const tone = ['#C24E45', '#E3D8C0', '#4F7A55', '#D9A84A', '#3D5A8A'][band];
    g.set(x, 0, z, lin(tone));
  }
  for (const sz of [-0.5, -0.34]) {
    const x0 = Math.round(2.74 / S), z0 = Math.round(sz / S);
    // `k` runs from the heel to the toe; the toes point at the bed.
    for (let k = 0; k < 10; k++) for (let z = z0; z < z0 + 4; z++) for (let y = 2; y < 5; y++) {
      if (y === 4 && k < 4) continue;
      const cuff = y === 4 || (y === 3 && k < 4 && (z === z0 || z === z0 + 3 || k === 0));
      if (y === 3 && k < 4 && !cuff) continue;
      if ((z === z0 || z === z0 + 3) && k === 9) continue;
      fine.set(x0 + 9 - k, y, z, lin(cuff ? '#C9C1B6' : y === 2 ? '#9E968C' : '#B8B0A6'));
    }
  }

  // ---- the knitting basket on the floor beside the nightstand: 0.3 m of wicker, and in it the three things the dream's
  // third world is made of (docs/dream/v3/09, section 3): a ball of the game's red yarn, two knitting needles standing
  // crossed, brass with cream knobs, and a spool of mauve thread on a wooden spool.
  {
    const kx = Math.round(BASKET.x / S), kz = Math.round(BASKET.z / S), r = 6;
    const WICKER = ['#B98B52', '#A0733F', '#8A6034'] as const;
    for (let y = 0; y < 7; y++) for (let dx = -r; dx < r; dx++) for (let dz = -r; dz < r; dz++) {
      const d = Math.max(Math.abs(dx + 0.5), Math.abs(dz + 0.5)), round = Math.hypot(dx + 0.5, dz + 0.5);
      if (round > r + 0.3 - (y === 0 ? 1 : 0)) continue;
      const wall = round > r - 1.4 - (y === 0 ? 1 : 0) || d > r - 1;
      if (y > 0 && !wall) continue; // hollow above its floor
      // A weave: bands that step every other row; a darker rim on top.
      fine.set(kx + dx, y, kz + dz, lin(y === 6 ? WICKER[2] : WICKER[(Math.floor((dx + dz + 40) / 2) + y) % 2]));
    }
    const yarn = solid('scarfRed', 0), needle = solid('brass', 0), knob = solid('trimWhite', 0);
    ellipsoid(fine, [(kx - 1) * S, 0.17, (kz + 0.5) * S], [0.085, 0.08, 0.085], () => yarn);
    // The needles: crossed, leaning out of the yarn, each with a cream knob on its top end.
    for (const [x0, z0, dx, dz] of [[3, -2, -0.3, 0.22], [-4, -1, 0.3, 0.12]] as const) {
      for (let k = 0; k < 13; k++) fine.set(kx + x0 + Math.round(k * dx), 5 + k, kz + z0 + Math.round(k * dz), needle);
      const tx = kx + x0 + Math.round(12 * dx), tz = kz + z0 + Math.round(12 * dz);
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) for (const y of [18, 19]) fine.set(tx + ox - (dx < 0 ? 1 : 0), y, tz + oz, knob);
    }
    // The spool, at the basket's front corner toward the room, standing on its rim against the yarn: wooden ends, the
    // mauve thread wound between them.
    const spool = solid('wood', 1), thread = solid('slate', 0), sx = kx + 3, sz = kz + 3;
    for (let y = 6; y < 11; y++) for (let ox = -2; ox < 2; ox++) for (let oz = -2; oz < 2; oz++) {
      const end = y === 6 || y === 10, r2 = (ox + 0.5) ** 2 + (oz + 0.5) ** 2;
      if (end ? r2 <= 4.5 : r2 <= 2) fine.set(sx + ox, y, sz + oz, end ? spool : thread);
    }
  }

  // ---- the shelf high on the wall by the headboard: a knitted sheep and two jars of preserves
  const shy = i(1.95), sx0 = i(SIDE_X), sx1 = i(0.5), wz = i(BACK_Z);
  for (let x = sx0; x < sx1; x++) for (const d of [0, 1, 2]) g.set(x, shy, wz + d, lin(WALNUT[0]));
  for (const x of [sx0 + 2, sx1 - 3]) for (const y of [shy - 1, shy - 2]) g.set(x, y, wz, lin(WALNUT[2]));
  const fy = Math.round((shy + 1) * D / S), fz = Math.round((BACK_Z + 0.08) / S);
  const sheepX = Math.round(-0.38 / S);
  ellipsoid(fine, [(sheepX + 2) * S, (fy + 2.5) * S, fz * S], [0.07, 0.055, 0.05], () => meanOf([T.wool[0], T.wool[0], T.wool[0], T.wool[1], T.wool[1]]));
  box(fine, [(sheepX + 4) * S, (fy + 2) * S, (fz - 1) * S], [(sheepX + 7) * S, (fy + 5) * S, (fz + 1) * S], c(T.face[0]));
  for (const lxx of [sheepX, sheepX + 3]) box(fine, [lxx * S, fy * S, (fz - 1) * S], [(lxx + 1) * S, (fy + 1) * S, (fz + 1) * S], c(T.face[1]));
  for (const [jx, col] of [[-0.12, '#9C2F3A'], [-0.01, '#D9A84A']] as const) {
    const x0 = Math.round(jx / S);
    box(fine, [x0 * S, fy * S, (fz - 1) * S], [(x0 + 3) * S, (fy + 4) * S, (fz + 2) * S], c(col));
    box(fine, [x0 * S, (fy + 4) * S, (fz - 1) * S], [(x0 + 3) * S, (fy + 5) * S, (fz + 2) * S], c('#E9D9B8'));
  }
  // ---- the low shelf over the basket, and five books standing on it in the quilt's five colours
  // (docs/dream/01-farmer.md, section 4): red, mustard, green, navy, cream. Each its own height and thickness, a pale
  // band across its spine. The dream's third world has them as obstacles.
  const by0 = i(BOOKSHELF.y);
  for (let x = i(BOOKSHELF.x0); x < i(BOOKSHELF.x1); x++) for (const d of [0, 1, 2]) g.set(x, by0, wz + d, lin(WALNUT[0]));
  for (const x of [i(BOOKSHELF.x0) + 1, i(BOOKSHELF.x1) - 2]) for (const y of [by0 - 1, by0 - 2]) g.set(x, y, wz, lin(WALNUT[2]));
  const bfy = Math.round((by0 + 1) * D / S);
  let bx = Math.round((BOOKSHELF.x0 + 0.14) / S);
  for (const [col, w, h] of [['#A84A42', 3, 9], ['#C99A4A', 2, 8], ['#3F6B4A', 3, 10], ['#2B3A66', 2, 9], ['#E6DCC6', 3, 8]] as const) {
    box(fine, [bx * S, bfy * S, (fz - 2) * S], [(bx + w) * S, (bfy + h) * S, (fz + 3) * S], (_x, y) => lin(y === bfy + h - 2 ? (col === '#E6DCC6' ? '#C99A4A' : '#E6DCC6') : col));
    bx += w + (col === '#3F6B4A' ? 1 : 0);
  }
  // A framed sheep on the side wall: a cream fleece on a night-blue ground, read from the room (its right is -z).
  const SHEEP = ['..........', '...####...', '..######h.', '.#######hh', '..######..', '...#..#...', '..........'];
  const px = Math.round((SIDE_X + 0.01) / S), py = Math.round(1.45 / S), pz = Math.round(1.25 / S);
  for (let x = -1; x <= 10; x++) for (let y = -1; y <= 7; y++) {
    const edge = x === -1 || x === 10 || y === -1 || y === 7;
    const ch = edge ? 'F' : SHEEP[6 - y][x];
    fine.set(px, py + y, pz - x, lin(ch === 'F' ? T.brass[2] : ch === '#' ? TRIM[0] : ch === 'h' ? '#3A2E2A' : y < 2 ? '#4F7A55' : '#2A3366'));
  }

  const over = quiltOverGeometry();
  bedroomCache = {
    room: cullUnseen(mergeGeometries([buildGeometry(g.map, D), buildGeometry(big.map, B), buildGeometry(fine.map, S), buildGeometry(lamp.map, S), quiltSides()], false)!),
    glow: cullUnseen(mergeGeometries([buildGeometry(glow.map, D, { ao: false }), buildGeometry(glowFine.map, S, { ao: false })], false)!),
    lampGlass: buildGeometry(lampGlass.map, S, { ao: false }),
    quiltChest: over.chest,
    quiltLegs: over.legs,
    clock: buildGeometry(clock.map, S),
    ring: buildGeometry(ring.map, S, { ao: false }),
  };
  return bedroomCache;
}

const stripWalls = new Map<string, { solid: BufferGeometry; glow: BufferGeometry }>();
/**
 * More of the back wall and the floor past the room's end, to `x1`, for the bed strip, which sees further along the
 * wall than the room is long (docs/dream/01-farmer.md, section 4: "extend their meshes if they are too short"); and,
 * with `windowX` (its left side), the low window the strip ends on, snow on its sill and the moon in it. The wall only
 * as high as the strip sees, the floor only as far forward.
 */
export function stripWall(x1: number, windowX: number | null): { solid: BufferGeometry; glow: BufferGeometry } {
  const i = (m: number) => Math.round(m / D), key = `${i(x1)}:${windowX === null ? '' : i(windowX)}`;
  const hit = stripWalls.get(key);
  if (hit) return hit;
  for (const old of stripWalls.values()) { old.solid.dispose(); old.glow.dispose(); }
  stripWalls.clear();
  const g = new Grid(D), glow = new Grid(D), u0 = i(ROOM_X1) + 1, u1 = Math.max(u0, i(x1));
  const hole: Hole | null = windowX === null ? null : { u0: i(windowX), u1: i(windowX + STRIP_WINDOW.w), y0: i(STRIP_WINDOW.y0), y1: i(STRIP_WINDOW.y1) };
  buildWall(g, backWall, u0, u1, 5, hole ? [hole] : [], i(1.9));
  if (hole) {
    // The sky right behind the glass: the strip looks along this wall at a slant, and a sky set back would slide away.
    sky(glow, backWall, hole, [Math.round((hole.u0 + hole.u1) / 2) + 3, hole.y1 - 4], 3, -1, -1, 1);
    windowIn(g, glow, backWall, hole, 3);
  }
  for (let x = i(ROOM_X1); x <= u1; x++) for (let z = i(BACK_Z); z < i(0.8); z++) {
    const row = Math.floor(z / 3), off = mod(row * 17, 40);
    const seam = mod(z, 3) === 0 || mod(x + off, 40) === 0;
    g.set(x, -1, z, seam ? lin(FLOOR[2]) : pickBy(FLOOR, hash3(Math.floor((x + off) / 40), row, 0, 7), [0.5, 0.95]));
  }
  const out = { solid: buildGeometry(g.map, D), glow: buildGeometry(glow.map, D, { ao: false }) };
  stripWalls.set(key, out);
  return out;
}

/** Where his waist is along the bed: the quilt over his chest lifts with him from here. */
export const WAIST_X = IN_BED.neckX + (PIVOT.head[1] - PIVOT.torso[1]) * UNIT;
/**
 * The quilt over him (docs/dream/v3/09, section 3), on a grid of its own, 0.02 m (the farmer's unit), so that its
 * 0.2 m squares, the 0.12 m sheet and the stitch every 0.06 m all land on whole cells. Its cells are counted from the
 * mattress's top (y) and from 0.01 m along z (`Z0`), so the bed's sides (z = ±0.55) and the 0.1 m margins fall on
 * cell edges too.
 *
 * - `edge`: its top edge lies across his chest at his armpits, so his neck, collar and both shoulders are out of it.
 * - `band`: the sheet turned down over that edge, `trimWhite +2`, with red blanket stitch (`scarfRed 0`) along the
 *   band's lower edge, one stitch every `stitch`.
 * - `inset`: each step runs the bed's width less this at each side, where the quilt falls to the mattress, and down
 *   each side it hangs `hang` (0.24: the grid's nearest to the plan's 0.25).
 * - `over`: how thick it lies on him. Where his body stands higher than the plan's step (his chest, his belly, his
 *   legs: the model is 0.28 m deep, the steps 0.06 to 0.16), it lies on him, this much over him.
 */
export const QUILT = { cell: 0.02, edge: 0.88, band: 0.12, stitch: 0.06, square: 0.2, inset: 0.1, side: 0.55, hang: 0.24, over: 0.04, foot: 2.0 } as const;
const Q = QUILT.cell, Z0 = 0.01;
/** The plan's steps along his length, from the armpits: each `to` this x, `h` above the mattress. */
const STEPS = [{ to: WAIST_X, h: 0.08 }, { to: 1.46, h: 0.1 }, { to: 1.56, h: 0.08 }, { to: 1.7, h: 0.06 }, { to: QUILT.foot, h: 0.1 }] as const;
/** The two toes' bump at the foot: over each foot (the legs' middles), this high. */
const TOES = { x0: 1.76, x1: 1.86, half: 0.05, h: 0.16 } as const;
/** The quilt's colours (docs/dream/v3/03, section 5): cream between, then these in turn. */
const SQUARES = ['scarfRed', 'coopYellow', 'giftGreen', 'slate'] as const;
const CREAM = solid('trimWhite', 0), SHEET = solid('trimWhite', 2), STITCH = solid('scarfRed', 0);
/**
 * One square's colour. `u` is how far the cloth runs from the near side's top edge across the bed and on down the far
 * side (the side hanging down the near side runs on below 0): the squares carry on over the edge as one cloth does.
 */
function squareAt(x: number, u: number): RGB {
  return patch(Math.floor((x - QUILT.edge - QUILT.band + 1e-6) / QUILT.square), Math.floor(u / QUILT.square + 1e-6));
}
/** The quilt's rule for the square in column `ix`, row `iz`: cream when ix + iz is even, else the four in turn. */
const patch = (ix: number, iz: number): RGB => (mod(ix + iz, 2) === 0 ? CREAM : solid(SQUARES[mod(Math.floor((ix + 3 * iz) / 2), 4)], 0));
/** The quilt's paint at a cell's middle (x, z in metres, `u` the cloth's run there): the sheet's band, its stitch, a square. */
export function quiltColour(x: number, u: number): RGB {
  const into = x - QUILT.edge;
  if (into < QUILT.band) {
    // A stitch: two cells long, reaching from the band's lower edge into it, one every `stitch` along the edge.
    const k = Math.floor(u / Q + 1e-6);
    return into >= QUILT.band - 2 * Q && mod(k, Math.round(QUILT.stitch / Q)) === 1 ? STITCH : SHEET;
  }
  return squareAt(x, u);
}

/**
 * Where some of his pieces are, as he lies in a pose on the bed: for each column of a grid (`cell` m square, the
 * key "i,k", z counted from `-z0`), the lowest and highest point of those pieces over it, in the room's metres.
 */
export function farmerColumns(pose: Pose, pieces: readonly Piece[], cell: number, z0 = 0): Map<string, { lo: number; hi: number }> {
  const out = new Map<string, { lo: number; hi: number }>();
  const lying = lyingAt(BED.mattress.top), at = new Matrix4().compose(new Vector3(...lying.position), lying.quaternion, new Vector3(1, 1, 1));
  const world = worldOf(pose), cells = farmerCells(), half = new Vector3(), c = new Vector3();
  for (const p of pieces) {
    const m = at.clone().multiply(world[p]), e = m.elements;
    // A voxel turned with its piece: its box in the room is its middle, give or take half of each turned edge.
    half.set(Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8]), Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9]), Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])).multiplyScalar(UNIT / 2);
    for (const v of cells.get(p)!.map.values()) {
      c.set((v.x - PIVOT[p][0]) * UNIT, (v.y + 0.5 - PIVOT[p][1]) * UNIT, (v.z - PIVOT[p][2]) * UNIT).applyMatrix4(m);
      // Columns it covers, less a hair: a voxel tipped a few degrees reaches a hair past its own column.
      for (let i = Math.floor((c.x - half.x + 0.003) / cell); i <= Math.floor((c.x + half.x - 0.003) / cell); i++) {
        for (let k = Math.floor((c.z - half.z + z0 + 0.003) / cell); k <= Math.floor((c.z + half.z + z0 - 0.003) / cell); k++) {
          const key = `${i},${k}`, was = out.get(key);
          out.set(key, { lo: Math.min(was?.lo ?? Infinity, c.y - half.y), hi: Math.max(was?.hi ?? -Infinity, c.y + half.y) });
        }
      }
    }
  }
  return out;
}

/** The pillow's top cells (the room's grid, "x,z") that his head or cap would pass through as he lies: pressed down. */
export function pillowDent(): string[] {
  const out = new Set<string>(), top = BED.pillowTop;
  for (const pose of ON_PILLOW) for (const [key, { lo }] of farmerColumns(pose, ['head', 'cap', 'capTail'], D)) if (lo < top) out.add(key);
  return [...out];
}

/** What of him lies under the quilt: all but the near arm, which lies on it. */
const UNDER: readonly Piece[] = ['lap', 'torso', 'legL', 'legR', 'armL', 'foreL', 'handL'];
/** His turn at gate 3 goes through the quilt in steps of this many degrees of his roll (`quiltCells`). */
export const TURN_STEP = 10;
const heights = new Map<number, (i: number, k: number) => number>();
/**
 * How many cells high the quilt stands over a column (cell `i` along x, `k` along z), above the mattress: the plan's
 * step, or where he lies higher, his body and `over` on top. His body is read from the model as he sleeps
 * (`bedSleep`); for `step` 1 to 4, as he turns over at gate 3, rolled from `step - 1` to `step` times `TURN_STEP`
 * degrees, so the quilt is pushed up over his near side as he turns under it. 0 off the quilt.
 */
export function quiltCells(step = 0): (i: number, k: number) => number {
  const hit = heights.get(step);
  if (hit) return hit;
  const top = BED.mattress.top, body = new Map<string, number>();
  // Turning, he is on the way from `bedSleep` to `bedTurn`, as far as his roll has gone; the quilt rides over his near
  // arm too as it slides down to his side.
  const turns = [step - 1, step - 0.5, step].map((n) => blendPose(POSES.bedSleep, POSES.bedTurn, (n * TURN_STEP * Math.PI) / 180 / POSES.bedTurn.roll));
  // At rest it lies over him asleep and deep asleep both: shaped for `bedSleep` alone, his chest came through it in
  // the deep pose, which the results room sees from above.
  for (const pose of step ? turns : [POSES.bedSleep, POSES.bedDeep]) {
    for (const [key, { hi }] of farmerColumns(pose, step ? [...UNDER, 'armR', 'foreR', 'handR'] : UNDER, Q, Z0)) body.set(key, Math.max(body.get(key) ?? 0, hi - top));
  }
  const legs = [-1, 1].map((s) => IN_BED.z + s * PIVOT.legL[0] * UNIT);
  const h = (i: number, k: number) => {
    const x = (i + 0.5) * Q, z = (k + 0.5) * Q - Z0;
    if (x < QUILT.edge || x > QUILT.foot || Math.abs(z) > QUILT.side + Q) return 0;
    if (Math.abs(z) > QUILT.side - QUILT.inset) return 1;
    const plan = x >= TOES.x0 && x < TOES.x1 && legs.some((lz) => Math.abs(z - lz) <= TOES.half) ? TOES.h : STEPS.find((s) => x < s.to)?.h ?? 0;
    // One cell of room round him: with none, the quilt's sides stood in the plane of his own and his nightshirt
    // flickered through them, seen from the room.
    let him: number | undefined;
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) { const b = body.get(`${i + di},${k + dk}`); if (b !== undefined) him = Math.max(him ?? b, b); }
    return Math.round(Math.max(plan, him === undefined ? 0 : him + QUILT.over) / Q);
  };
  heights.set(step, h);
  return h;
}
/** How high the quilt's top lies above the mattress at a point of the bed, metres (0 off the quilt). */
export const quiltTop = (x: number, z: number): number => quiltCells()(Math.floor(x / Q), Math.floor((z + Z0) / Q)) * Q;

/**
 * The quilt over him, in two pieces that rise and fall about the mattress top: the part over his chest (from his
 * armpits to his waist, with the sheet turned down along its top edge), which lifts with him when he starts up, and
 * the part over his legs. Where he is under it only its top two rows are built (under them is him), closed at its
 * sides. The parts hanging down the bed's sides are the room's (`quiltSides`): they never move.
 */
function quiltOverGeometry(step = 0): { chest: BufferGeometry; legs: BufferGeometry } {
  const h = quiltCells(step), chest = new Grid(Q), legs = new Grid(Q);
  const i0 = Math.floor(QUILT.edge / Q), iw = Math.round(WAIST_X / Q), i1 = Math.round(QUILT.foot / Q), kk = Math.round((QUILT.side + Z0) / Q);
  for (let i = i0; i < i1; i++) for (let k = -kk; k < kk + 1; k++) {
    const rows = h(i, k);
    if (rows <= 0) continue;
    const low = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dk]) => h(i + di, k + dk)));
    const from = rows > 5 ? Math.min(rows - 2, low) : 0;
    const x = (i + 0.5) * Q, u = QUILT.side - ((k + 0.5) * Q - Z0);
    for (let r = Math.max(0, from); r < rows; r++) (i < iw ? chest : legs).set(i, r, k, quiltColour(x, u));
  }
  const place = (g: Grid) => buildGeometry(g.map, Q).translate(0, BED.mattress.top, -Z0);
  return { chest: place(chest), legs: place(legs) };
}
const turned = new Map<number, { chest: BufferGeometry; legs: BufferGeometry }>();
/**
 * The quilt over him as he turns over at gate 3, rolled up to `step` times `TURN_STEP` degrees (1 to 4; `quiltCells`):
 * each built the first time it is asked for.
 */
export function quiltTurned(step: number): { chest: BufferGeometry; legs: BufferGeometry } {
  let hit = turned.get(step);
  if (!hit) turned.set(step, (hit = quiltOverGeometry(step)));
  return hit;
}
/** The quilt hanging down both sides of the bed from its edge to the foot, `hang` deep, the squares running on. */
function quiltSides(): BufferGeometry {
  const g = new Grid(Q), kk = Math.round((QUILT.side + Z0) / Q), drop = Math.round(QUILT.hang / Q);
  for (let i = Math.floor(QUILT.edge / Q); i < Math.round(QUILT.foot / Q); i++) for (const k of [kk, -kk]) for (let r = -drop; r < 0; r++) {
    // The cloth's run: past the near side's edge it goes on below 0; down the far side, on past the bed's width.
    const u = k > 0 ? (r + 0.5) * Q : 2 * QUILT.side - (r + 0.5) * Q;
    g.set(i, r, k, quiltColour((i + 0.5) * Q, u));
  }
  return buildGeometry(g.map, Q).translate(0, BED.mattress.top, -Z0);
}

// ---------- how he moves ----------

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Cubic ease in and out: every move starts and lands at rest, so nothing snaps. */
export const smooth = (t: number) => { const u = clamp01(t); return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2; };

let quiltSatCache: BufferGeometry | null = null;
/**
 * The quilt once he has sat up, pushed down to his waist: a thick roll of it across his lap with the cream sheet on
 * top, then his legs under the rest, one step lower. Three plain shapes, each a body part. Built where he sleeps; the
 * bed slides it up with him as he shuffles toward the headboard (`Pose.scoot`).
 */
export function quiltSat(): BufferGeometry {
  if (quiltSatCache) return quiltSatCache;
  const m = BED.mattress, g = new Grid(D), hw = Math.round(m.w / 2 / D);
  const x0 = Math.round((WAIST_X + 0.2) / D), y0 = Math.round(m.top / D);
  const roll = x0 + 4, legs = roll + 8, feet = legs + 6;
  for (let x = x0; x < feet; x++) for (let z = -hw; z < hw; z++) {
    const u = Math.abs((z + 0.5) * D - IN_BED.z);
    if (u > 0.33) continue;
    const full = x < roll ? 7 : x < legs ? 5 : 3, rows = u > 0.27 || x === feet - 1 ? full - 1 : full;
    for (let r = 0; r < rows; r++) g.set(x, y0 + r, z, x < roll && r >= rows - 2 ? SHEET : squareAt((x + 0.5) * D, QUILT.side - (z + 0.5) * D));
  }
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
    const ix = Math.floor((x + 6) / 4) + y + seed, iz = Math.floor((z + 5) / 5);
    g.set(x, y, z, stitch ? lin(T.linen[0]) : patch(ix, iz));
  }
  const geo = buildGeometry(g.map, CHAR);
  folded.set(seed, geo);
  return geo;
}

export type { RGB };
