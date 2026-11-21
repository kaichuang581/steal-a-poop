import type { BufferGeometry } from 'three';
import { buildGeometry, packGeometry, triangles as tris } from '../voxel/mesher';
import { each, finish } from './slices';
import type { Steps } from './slices';
import { IRIS, lin, T } from '../voxel/palette';
import { noteShade } from '../voxel/groundShade';
import { byPart, paint, seededPart, shade, solid } from '../voxel/paint';
import { ellipsoid, cone, Grid, hash3, line, ring, rng } from '../voxel/primitives';
import type { Paint, RGB, V3 } from '../voxel/primitives';
import { BARN, HEAP, SEAT_RING, seatPosition } from './layout';

/**
 * The winter barn interior (plan V3 Part 7.1) on the 0.10 m grid; the cat and the robin on the 0.04 m grid.
 * Everything below works in voxel indices: index i spans i*S .. (i+1)*S metres. Interior x -60..59, z -40..69,
 * left wall x -62..-61, right wall x 60..61, back wall z 70..71, floor planks at y -1 (their top is y = 0).
 */
const S = 0.1;
const C = 0.04;

/** Cat lies on the top bale of the back-left stack; robin sits on top of the cross beam. Both are world positions. */
export const CAT_SPOT: V3 = [-4.9, 1.5, 6.1];
export const ROBIN_SPOT: V3 = [1.2, 4.6, 1.05]; // on the cross beam's top (y 4.6), over its middle (z 0.9 to 1.2)

/** The steps the wall boards take, by board number (docs/miniature/01, section 5): the same in `barnShell` (farmstead.ts), whose boards continue these. */
const BOARD_STEPS = [0, -1, 0, 1] as const;
const I = (m: number) => Math.round(m / S);

/** Inclusive index box; `chamfer` names the long axis whose four edges lose one voxel. */
function fill(g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint, chamfer?: 0 | 1 | 2) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        if (chamfer !== undefined) {
          const e = [x === x0 || x === x1, y === y0 || y === y1, z === z0 || z === z1];
          e[chamfer] = false;
          if (e.filter(Boolean).length >= 2) continue;
        }
        const c = p(x, y, z);
        if (c) g.set(x, y, z, c);
      }
}

/** First voxel index above the rafters at column x: wall top (42) at the side walls up to the ridge (64). */
const roofY = (x: number) => 42 + Math.floor(22 * Math.max(0, 1 - Math.abs(x + 0.5) / 60));

const inBackDoor = (x: number, y: number) => x >= I(BARN.backDoor.minX) && x < I(BARN.backDoor.maxX) && y < I(BARN.backDoor.height);
const SD = { z0: I(BARN.sideDoor.z - BARN.sideDoor.width / 2), z1: I(BARN.sideDoor.z + BARN.sideDoor.width / 2) - 1, y1: I(BARN.sideDoor.height) - 1 };
const inSideDoor = (y: number, z: number) => z >= SD.z0 && z <= SD.z1 && y <= SD.y1;

/** The barn's own walls as cubes, for the review page (scene/farmstead.ts, `farmPiece`). */
export const barnWalls = (): Grid => walls();

function walls(): Grid {
  const g = new Grid(S);
  // One red a board, in a rhythm of four, the same on its inner and its outer face; no knots or nails (they were single
  // cubes of another colour: the fittings are the micro layer's, docs/miniature/04).
  const board = (b: number) => solid('barnRed', BOARD_STEPS[b % 4]);

  // Back wall: boards 3 wide, 2 thick, no gaps or seams (thin lines of light and of dark crawled as the camera moved;
  // Brian, 2026-11-20: "a lot of glitchy textures"); gable up to the roof.
  for (let b = 0, xa = -62; xa <= 61; b++, xa += 3) {
    const cols = [xa, xa + 1, xa + 2].filter((x) => x <= 61);
    const top = Math.min(...cols.map(roofY));
    const c = board(b);
    for (const x of cols) for (let y = 0; y < top; y++) if (!inBackDoor(x, y)) for (const z of [70, 71]) g.set(x, y, z, c);
  }
  // Outside rails behind the gaps (stop short of the door so the open leaves clear them).
  for (const y0 of [9, 30]) fill(g, -62, 61, y0, y0 + 1, 72, 72, (x) => (x >= -21 && x <= 20 ? null : solid('wood', -1)));

  // Side walls: boards 3 wide along z, no gaps; the left one has the wolf's side door.
  for (const [xs, left] of [[[-62, -61], true], [[60, 61], false]] as const) {
    for (let b = 0, za = -40; za <= 69; b++, za += 3) {
      const zs = [za, za + 1, za + 2].filter((z) => z <= 69);
      for (const z of zs)
        for (let y = 0; y < 42; y++) {
          if (left && inSideDoor(y, z)) continue;
          // The top 0.4 m under the eave a step darker (rule R7.3): Home sees these walls from outside.
          const c = solid('barnRed', BOARD_STEPS[b % 4] - (y >= 38 ? 1 : 0));
          for (const x of xs) g.set(x, y, z, c);
        }
    }
  }
  return g;
}

/**
 * The front wall, seen only from inside: the same boards as the side walls, but only the faces that point into the
 * barn are kept. The fixed table camera stands outside the cut-away front and sees straight through it (its faces
 * point away and are culled); the speaker camera, inside and looking toward the front, sees a wall instead of the
 * open yard. It casts no shadow, so the sun still reaches the floor.
 */
function frontInside(): BufferGeometry {
  const g = new Grid(S);
  for (let b = 0, xa = -62; xa <= 61; b++, xa += 3) {
    const c = solid('barnRed', BOARD_STEPS[b % 4]);
    for (let x = xa; x <= Math.min(61, xa + 2); x++) for (let y = 0; y < 42; y++) for (const z of [-42, -41]) g.set(x, y, z, c);
  }
  const geo = buildGeometry(g.map, S);
  const idx = geo.index!, nor = geo.getAttribute('normal');
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) if (nor.getZ(idx.getX(t)) > 0.5) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  geo.setIndex(keep);
  return geo;
}

function beams(): Grid {
  const g = new Grid(S);
  // Posts a step under the plates and rafters, the cross beam and the ridge a step over them, pegs two over.
  const upright = paint('wood', -1), wood = paint('wood', 0), cross = paint('wood', 1);
  const peg = solid('wood', 2);
  const post = (x0: number, z0: number, at: [number, number]) => {
    fill(g, x0, x0 + 2, 0, 38, z0, z0 + 2, upright, 1);
    g.set(at[0], 36, at[1], peg);
    g.set(at[0], 37, at[1], peg);
  };
  for (const z0 of [-40, -5, 12, 33, 67]) post(-60, z0, [-57, z0 + 1]); // left wall, flanking the side door
  for (const z0 of [-40, -5, 19, 44, 67]) post(57, z0, [56, z0 + 1]); // right wall; z 19 carries the cross beam
  for (const x0 of [-41, -21, 18, 39]) post(x0, 67, [x0 + 1, 66]); // back wall, two flanking the door

  // top plates, cross beam, headers (0.3 m square, chamfered along their length)
  fill(g, -60, -58, 39, 41, -40, 69, wood, 2);
  fill(g, 57, 59, 39, 41, -40, 69, wood, 2);
  fill(g, -60, 59, 39, 41, 67, 69, wood, 0);
  const bz = I(BARN.lanterns[0][2]);
  // The cross beam runs wall to wall over the plates and stands on a post at each end (Brian, 2026-11-09: "a lot of
  // them are floating"): it moved to the lanterns' z long ago and was left hanging between the walls, 0.1 m over the
  // plates and clear of every post, with its two pegs in the air below it. The pegs are in the posts now.
  fill(g, -60, 59, I(BARN.beamY) - 1, I(BARN.beamY) + 1, bz - 1, bz + 1, cross, 0);
  for (const x0 of [-60, 57]) fill(g, x0, x0 + 2, 0, I(BARN.beamY) - 2, bz - 1, bz + 1, upright, 1);
  for (const x of [-57, 56]) for (const y of [36, 37]) g.set(x, y, bz, peg);
  fill(g, -21, 20, 34, 36, 67, 69, wood, 0); // back door header
  fill(g, -60, -59, SD.y1 + 1, SD.y1 + 3, SD.z0 - 2, SD.z1 + 2, wood, 2); // side door header

  // rafters toward the ridge, back half only; roof boards only over z >= 4.0 so the camera's view stays open
  for (const z0 of [19, 35, 51, 67]) for (let x = -60; x <= 59; x++) fill(g, x, x, roofY(x) - 3, roofY(x) - 1, z0, z0 + 2, wood);
  fill(g, -1, 1, roofY(0) - 3, roofY(0) - 1, 19, 69, cross, 2);
  const roof = byPart('roofBrown', [0, -1], (x) => Math.floor((x + 62) / 3)); // roof boards 0.3 m wide, seen from below
  for (let x = -62; x <= 61; x++) fill(g, x, x, roofY(x), roofY(x) + 1, 40, 71, roof);

  // rope coil hung on the right wall post at z -0.35
  const rope: Paint = (x, y, z) => (x >= 57 && x <= 59 && z >= -5 && z <= -3) || x >= 60 ? null : g.has(x, y, z) ? null : solid('straw', -2);
  ring(g, [5.85, 1.45, -0.35], 0.25, 0.25, 0.1, rope);
  ring(g, [5.85, 1.65, -0.35], 0.28, 0.28, 0.1, rope);
  line(g, [5.6, 1.4, -0.6], [5.58, 0.95, -0.4], rope);
  line(g, [5.58, 0.95, -0.4], [5.6, 1.4, -0.1], rope);
  return g;
}

function bale(g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, seed: number, blocked: (x: number, y: number, z: number) => boolean) {
  // Body, the two end faces a step under it, the twine bands two under; its loose straws a step over.
  const body = solid('hay', 0), ends = solid('hay', -1), twine = solid('hay', -2), loose = solid('hay', 1);
  const len = x1 - x0 + 1;
  const bands = [0.2, 0.5, 0.8].map((f) => x0 + Math.round(len * f) - 1);
  for (let x = x0 - 1; x <= x1 + 1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        const h = hash3(x, y, z, seed);
        if ((x === x0 - 1 || x === x1 + 1) && h > 0.22) continue; // uneven, bulging ends
        if ((x === x0 || x === x1) && h < 0.15) continue; // ragged end
        if (blocked(x, y, z)) continue;
        const surface = y === y0 || y === y1 || z === z0 || z === z1;
        g.set(x, y, z, surface && bands.some((b) => x === b || x === b + 1) ? twine : x <= x0 || x >= x1 ? ends : body);
      }
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const end = r() < 0.6;
    const dir = end ? (r() < 0.5 ? -1 : 1) : 0;
    let x = end ? (dir < 0 ? x0 - 1 : x1 + 1) : x0 + 1 + Math.floor(r() * (len - 2));
    let y = y0 + Math.floor(r() * (y1 - y0 + 1));
    let z = end ? z0 + 1 + Math.floor(r() * (z1 - z0 - 1)) : z0 - 1;
    r(); // the draw that chose a straw's tone: kept, so every straw lies where it lay
    const c = loose;
    for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) {
      if (!blocked(x, y, z)) g.set(x, y, z, c);
      if (end) x += dir;
      else z -= 1;
      if (r() < 0.4) y += r() < 0.5 ? 1 : -1;
      y = Math.max(y0, y);
    }
  }
}

function props(): Grid {
  const g = new Grid(S);
  const metal = paint('stone', 0), handle = paint('wood', 1), iron = solid('iron', 0);
  // rake and pitchfork leaning on the left wall
  line(g, [-5.3, 0.0, -1.0], [-5.95, 1.9, -1.0], handle);
  line(g, [-5.92, 1.95, -1.3], [-5.92, 1.95, -0.7], metal);
  for (const z of [-1.3, -1.1, -0.9, -0.7]) line(g, [-5.92, 1.95, z], [-5.75, 1.9, z], metal);
  line(g, [-5.35, 0.0, -2.2], [-5.95, 1.6, -2.2], handle);
  line(g, [-5.95, 1.65, -2.4], [-5.95, 1.65, -2.0], metal);
  for (const z of [-2.4, -2.2, -2.0]) line(g, [-5.95, 1.65, z], [-5.95, 2.05, z], metal);

  // bucket: open ring with a bottom and a wire handle
  {
    const cx = 44, cz = 46;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > 2.3) continue;
        for (let y = 0; y <= 2; y++) if (y === 0 || d > 1.3) g.set(cx + dx, y, cz + dz, metal(cx + dx, y, cz + dz)!);
      }
    for (const [dx, y] of [[-2, 3], [-1, 4], [0, 4], [1, 4], [2, 3]]) g.set(cx + dx, y, cz, iron);
  }
  // milk can: body, shoulder, neck, lid, two side handles
  {
    const cx = -33, cz = 54;
    const disc = (y: number, r: number, c: Paint) => {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dx, dz) <= r) g.set(cx + dx, y, cz + dz, c(cx + dx, y, cz + dz)!);
    };
    const light = paint('stone', 1);
    for (let y = 0; y <= 4; y++) disc(y, 2.2, light);
    disc(5, 1.5, light);
    disc(6, 1.0, light);
    disc(7, 1.5, paint('stone', -1));
    g.set(cx - 3, 5, cz, iron);
    g.set(cx + 3, 5, cz, iron);
  }
  // wheelbarrow in the right back corner: hollow tray, wheel, two legs, two handles
  {
    const rim = solid('wood', -1), tray = solid('wood', 0);
    fill(g, 26, 34, 3, 6, 57, 64, (x, y, z) => {
      const wall = x === 26 || x === 34 || z === 57 || z === 64 || y === 3;
      return wall ? (y === 6 ? rim : tray) : null;
    });
    for (let y = 0; y <= 4; y++) for (let z = 53; z <= 57; z++) if (Math.hypot(y - 2, z - 55) <= 2.2) for (const x of [29, 30]) g.set(x, y, z, Math.hypot(y - 2, z - 55) < 1 ? solid('stone', 0) : iron);
    for (const x of [27, 33]) {
      fill(g, x, x, 0, 2, 63, 63, handle);
      line(g, [x * S + 0.05, 0.55, 6.45], [x * S + 0.05, 0.45, 6.85], handle);
    }
  }
  // feed sack with a 3-voxel patch and a tied neck
  {
    const sack = solid('straw', -1);
    ellipsoid(g, [-2.7, 0.0, 6.35], [0.3, 0.6, 0.25], (_x, y) => (y < 0 ? null : sack), 0.1, 4);
    fill(g, -28, -27, 6, 6, 62, 63, paint('straw', -2));
    g.set(-28, 7, 63, solid('straw', -2));
    const patch = solid('wood', 2);
    for (const [x, y] of [[-28, 2], [-27, 2], [-28, 3]]) {
      for (let z = 55; z <= 70; z++)
        if (g.has(x, y, z)) {
          g.set(x, y, z, patch);
          break;
        }
    }
  }
  // horseshoe on the door header, open end up
  {
    const shoe = solid('stone', 0);
    for (const [x, y] of [[-2, 35], [-2, 36], [-2, 37], [2, 35], [2, 36], [2, 37], [-1, 34], [0, 34], [1, 34]]) g.set(x, y, 66, shoe);
  }
  return g;
}

/**
 * The floor's calm zone round the seats (plan file 06, section 4.5): every seat of every table size (2 to 10), at rest
 * and stepped `SPEAKER_CAMERA.step` (0.35 m) toward the pile. `FLOOR_CALM.foot` is the biggest animal's footprint at
 * the table (the cow, 0.56 x 0.72 m at SHEEP_SCALE 1.3 times its drawScale 1.2), so any avatar's hooves are inside it.
 */
export const FLOOR_CALM = { foot: [0.56 * 1.56, 0.72 * 1.56] as const, step: 0.35, clear: 0.6, straws: 120, wall: 1.0 };
const SEATS_AND_STEPS = (() => {
  const out: { x: number; z: number; yaw: number }[] = [];
  for (let n = 2; n <= 10; n++)
    for (let i = 0; i < n; i++) {
      const p = seatPosition(i, n), dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
      out.push(p, { x: p.x + (dx / len) * FLOOR_CALM.step, z: p.z + (dz / len) * FLOOR_CALM.step, yaw: p.yaw });
    }
  return out;
})();
/** How far (m) a floor point is from the nearest seat's footprint, at rest or stepped in: 0 under one. */
export function seatDistance(mx: number, mz: number): number {
  const [w, d] = FLOOR_CALM.foot;
  let best = Infinity;
  for (const s of SEATS_AND_STEPS) {
    const px = mx - s.x, pz = mz - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const u = Math.abs(px * c - pz * sn) - w / 2, v = Math.abs(px * sn + pz * c) - d / 2; // across, along the model
    best = Math.min(best, Math.hypot(Math.max(u, 0), Math.max(v, 0)));
    if (best === 0) break;
  }
  return best;
}

function floor(blocked: (x: number, y: number, z: number) => boolean): Grid {
  const g = new Grid(S);
  // Each cell's distance from the seats, once: under a seat the hay is level (one layer, y 0), within `clear` of one
  // there is no tuft and no loose straw, so every hoof stands 0.00 to 0.10 m over the planks' top.
  const near = new Map<number, number>();
  const seatGap = (x: number, z: number) => {
    const k = (x + 60) * 1000 + (z + 40);
    let v = near.get(k);
    if (v === undefined) near.set(k, (v = seatDistance((x + 0.5) * S, (z + 0.5) * S)));
    return v;
  };
  // Planks: 0.3 m wide along the barn, their ends staggered, a value step or two between neighbours (one tone a plank).
  const plankTone = seededPart('wood', 51, (x, _y, z) => Math.floor((x + 60) / 3) * 64 + Math.floor((z + 40 + ((x + 60) % 9) * 4) / 25));
  // The straw: one mat over the middle of the floor, under every seat and out a metre past them, its edge wandering a
  // little; the planks show round it, along the walls and in the corners. Two planned zones and no more
  // (docs/miniature/07, section 2): open straw, and a step darker the ring the animals have trodden round the seats.
  const open = solid('straw', 0), trod = solid('straw', -1);
  const matEdge = (mx: number, mz: number) => {
    const dx = mx - SEAT_RING.cx, dz = mz - SEAT_RING.cz, a = Math.atan2(dz, dx);
    return 5.05 + 0.3 * Math.sin(a * 3 + 1) + 0.2 * Math.sin(a * 7 + 2.3) - Math.hypot(dx, dz); // metres inside the mat's edge
  };
  for (let x = -60; x <= 59; x++)
    for (let z = -40; z <= 69; z++) {
      g.set(x, -1, z, plankTone(x, -1, z)!);
      if (blocked(x, 0, z)) continue;
      const mx = (x + 0.5) * S, mz = (z + 0.5) * S;
      const h2 = hash3(x >> 1, 0, z >> 1, 54);
      if (Math.hypot(mx - HEAP[0], mz - HEAP[2]) < 1.45 + (h2 - 0.5) * 0.2) continue; // bare boards under the platform
      const seatAt = seatGap(x, z), inside = matEdge(mx, mz);
      if (inside < 0 && seatAt > 0.3) continue; // bare planks
      // Trodden (darker) where the animals stand and walk round the ring; fresh (lighter) in patches elsewhere.
      const e = Math.hypot((mx - SEAT_RING.cx) / SEAT_RING.rx, (mz - SEAT_RING.cz) / SEAT_RING.rz);
      g.set(x, 0, z, Math.abs(e - 1) < 0.2 ? trod : open);
    }

  // snow drifts blown in through the back doorway
  const snow: Paint = (x, y, z) => (z >= 70 || y < 0 || !inBackDoor(x, 0) || blocked(x, y, z) ? null : solid('snow', 0));
  for (const [x, rx, ry, rz] of [[-1.3, 0.7, 0.35, 0.7], [-0.4, 0.8, 0.28, 0.55], [0.5, 0.7, 0.4, 0.8], [1.35, 0.6, 0.3, 0.6]]) ellipsoid(g, [x, 0, 7.0], [rx, ry, rz], snow, 0.15, 6);

  const topY = (x: number, z: number) => {
    for (let y = 4; y >= -1; y--) if (g.has(x, y, z)) return y;
    return -1;
  };
  // Loose straws on top of the floor, following its surface: a few, swept to the walls and into the corners, none near a
  // seat (they were 300 over the whole floor, the noisiest thing behind every turn).
  const r = rng(57);
  const wall = FLOOR_CALM.wall / S;
  const byWall = (x: number, z: number) => Math.min(x + 60, 59 - x, z + 40, 69 - z) < wall;
  for (let n = 0, tries = 0; n < FLOOR_CALM.straws && tries < 5000; tries++) {
    const x0 = -58 + r() * 116, z0 = -38 + r() * 106;
    const a = r() * Math.PI * 2, len = 4 + Math.floor(r() * 5);
    r(); // the draw that chose a straw's tone: kept, so every straw lies where it lay
    const c = solid('straw', 1);
    if (Math.hypot(x0 * S - HEAP[0], z0 * S - HEAP[2]) < 1.3 || !byWall(x0, z0)) continue;
    const cells: [number, number][] = [];
    for (let k = 0; k < len; k++) cells.push([Math.round(x0 + Math.cos(a) * k), Math.round(z0 + Math.sin(a) * k)]);
    if (cells.some(([x, z]) => x < -60 || x > 59 || z < -40 || z > 69 || seatGap(x, z) <= FLOOR_CALM.clear)) continue;
    n++;
    for (const [x, z] of cells) {
      const y = topY(x, z) + 1;
      if (!blocked(x, y, z)) g.set(x, y, z, c);
    }
  }
  return g;
}

function lanterns(): Grid {
  const g = new Grid(S);
  const wire = solid('iron', 0);
  for (const L of BARN.lanterns) {
    const cx = I(L[0]), cy = I(L[1]), cz = I(L[2]);
    for (let x = cx - 1; x <= cx; x++)
      for (let z = cz - 1; z <= cz; z++)
        for (let y = cy - 2; y <= cy + 1; y++) g.set(x, y, z, lin(y === cy - 2 ? T.lantern[2] : y === cy + 1 ? T.lantern[1] : T.lantern[0]));
    for (const x of [cx - 2, cx + 1]) for (const z of [cz - 2, cz + 1]) for (let y = cy - 2; y <= cy + 1; y++) g.set(x, y, z, wire);
    for (let x = cx - 2; x <= cx + 1; x++)
      for (let z = cz - 2; z <= cz + 1; z++) {
        g.set(x, cy - 3, z, wire);
        if (x === cx - 2 || x === cx + 1 || z === cz - 2 || z === cz + 1) g.set(x, cy + 2, z, wire);
      }
    for (let y = cy + 3; y < I(BARN.beamY) - 1; y++) g.set(cx, y, cz, wire); // hook up to the beam's underside
  }
  return g;
}

/** A back door leaf built around its hinge (local +x or -x along the leaf, local +z is the outer face). */
function leaf(side: -1 | 1): BufferGeometry {
  const g = new Grid(S);
  const X = (i: number) => (side < 0 ? i : -1 - i);
  const w = I(BARN.backDoor.maxX), h = I(BARN.backDoor.height);
  const brace = paint('wood', -1), iron = solid('iron', 0), snowC = paint('snow', 1);
  for (let i = 0; i < w; i++)
    for (let y = 0; y < h; y++)
      for (const z of [0, 1]) g.set(X(i), y, z, solid('barnRed', BOARD_STEPS[Math.floor(i / 3) % 4]));
  // Z brace on the inner face
  for (const y0 of [3, h - 5]) for (let i = 1; i < w - 1; i++) for (const y of [y0, y0 + 1]) g.set(X(i), y, -1, brace(i, y, -1)!);
  for (let t = 0; t <= 40; t++) {
    const i = Math.round(2 + (w - 5) * (t / 40)), y = Math.round(5 + (h - 12) * (t / 40));
    g.set(X(i), y, -1, brace(i, y, -1)!);
    g.set(X(i), y + 1, -1, brace(i, y + 1, -1)!);
  }
  // three strap hinges on the outer face, snow on top of each, banked snow at the foot and flecks
  for (const hy of [4, Math.floor(h / 2), h - 6]) {
    for (let i = 0; i < 8; i++) g.set(X(i), hy, 2, iron);
    for (const y of [hy - 1, hy + 1]) g.set(X(0), y, 2, iron);
    for (let i = 1; i < 8; i++) g.set(X(i), hy + 1, 2, snowC(i, hy + 1, 2)!);
  }
  for (let i = 0; i < w; i++) {
    const top = 2 + Math.floor(hash3(i, 0, 0, 67) * 4);
    for (let y = 0; y < top; y++) if (!g.has(X(i), y, 2)) g.set(X(i), y, 2, snowC(i, y, 2)!);
    for (const z of [0, 1]) g.set(X(i), h, z, snowC(i, h, z)!);
  }
  // The outer face's white frame and cross, the way a farm barn's doors are painted.
  const white = solid('trimWhite', 0);
  const whiten = (i: number, y: number) => { if (!g.has(X(i), y, 2)) g.set(X(i), y, 2, white); };
  for (let i = 0; i < w; i++) for (const y of [8, 9, h - 2, h - 1]) whiten(i, y);
  for (let y = 8; y < h; y++) for (const i of [0, 1, w - 2, w - 1]) whiten(i, y);
  for (let t = 0; t <= 60; t++) {
    const i = Math.round(1 + (w - 3) * (t / 60)), y = Math.round(9 + (h - 11) * (t / 60));
    for (const [a, b] of [[i, y], [i, y + 1], [w - 1 - i, y], [w - 1 - i, y + 1]]) whiten(a, b);
  }
  if (side < 0) {
    const y = Math.floor(h / 2) - 1;
    for (let i = w - 7; i < w; i++) g.set(X(i), y, -1, solid('iron', 1));
    g.set(X(w - 4), y + 1, -1, iron);
  }
  return buildGeometry(g.map, S);
}

function tarp(): Grid {
  const g = new Grid(S);
  for (let z = SD.z0; z <= SD.z1; z++) {
    const torn = 2 + Math.floor(hash3(z, 0, 0, 71) * 5) + (hash3(z >> 1, 0, 0, 72) < 0.2 ? 4 : 0);
    const fold = (z - SD.z0) % 3 === 0;
    for (let y = torn; y <= SD.y1; y++) {
      const h = hash3(z, y, 0, 73);
      if (h < 0.025 && y < SD.y1 - 2) continue; // small holes
      g.set(-61, y, z, fold ? solid('darkWood', 0) : solid('stone', 0));
    }
  }
  return g;
}

/** Sleeping grey tabby around its own origin (belly on y = 0, head toward -z and +x); tail built about its pivot. */
function cat(): { body: BufferGeometry; tail: BufferGeometry; tailPivot: V3 } {
  const g = new Grid(C);
  const stripe = solid('stone', -2), grey = solid('stone', 0);
  const fur: Paint = (x) => (((x % 3) + 3) % 3 === 0 ? stripe : grey); // a stripe every third column
  const up = (p: Paint): Paint => (x, y, z) => (y < 0 ? null : p(x, y, z));
  ellipsoid(g, [0, 0.09, 0], [0.2, 0.09, 0.12], up(fur), 0.05, 83);
  ellipsoid(g, [-0.1, 0.1, 0.03], [0.1, 0.09, 0.1], up(fur), 0.05, 84);
  ellipsoid(g, [0.16, 0.09, -0.07], [0.075, 0.065, 0.07], up(fur), 0, 85);
  for (const ex of [0.13, 0.19]) cone(g, [ex, 0.14, -0.1], 0.025, 0.06, 1, () => shade(T.stone[1]));
  const front = (x: number, y: number) => {
    for (let z = -8; z <= 4; z++) if (g.has(x, y, z)) return z;
    return null;
  };
  const face = (xm: number, ym: number, c: RGB) => {
    const x = Math.round(xm / C), y = Math.round(ym / C), z = front(x, y);
    if (z !== null) g.set(x, y, z, c);
  };
  for (const ex of [0.12, 0.2]) {
    face(ex, 0.1, shade(T.face[2])); // closed eyes: short dark lines
    face(ex + 0.04, 0.1, shade(T.face[2]));
  }
  face(0.16, 0.06, shade(T.pink[2]));

  const t = new Grid(C);
  const path: V3[] = [[-0.18, 0.05, -0.1], [-0.2, 0.02, -0.24], [-0.2, 0.0, -0.34], [-0.2, -0.12, -0.37], [-0.19, -0.27, -0.36]];
  let k = 0;
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s], b = path[s + 1];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (C * 0.5));
    for (let i = 0; i < n; i++, k++) {
      const f = i / n;
      const x = Math.round((a[0] + (b[0] - a[0]) * f) / C), y = Math.round((a[1] + (b[1] - a[1]) * f) / C), z = Math.round((a[2] + (b[2] - a[2]) * f) / C);
      const c = Math.floor(k / 2) % 3 === 0 || (s === path.length - 2 && f > 0.6) ? stripe : grey;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (!t.has(x + dx, y, z + dz)) t.set(x + dx, y, z + dz, c);
    }
  }
  const tailPivot = path[0];
  const tail = buildGeometry(t.map, C);
  tail.translate(-tailPivot[0], -tailPivot[1], -tailPivot[2]);
  return { body: buildGeometry(g.map, C), tail, tailPivot };
}

/** Robin around its own origin (feet on y = 0, facing +z). */
function robin(): BufferGeometry {
  const g = new Grid(C);
  const breast = shade('#D9653B');
  const back = paint('wood', -1);
  const body: Paint = (x, y, z) => (z * C > -0.005 && y * C < 0.085 ? breast : back(x, y, z));
  ellipsoid(g, [0, 0.055, 0], [0.035, 0.035, 0.055], body);
  ellipsoid(g, [0, 0.095, 0.035], [0.028, 0.026, 0.028], body);
  // beak: two voxels out from the face; eyes on the head sides
  let fz = 0;
  for (let z = 4; z >= 0; z--)
    if (g.has(0, 2, z)) {
      fz = z;
      break;
    }
  g.set(0, 2, fz + 1, lin(T.trunk[2]));
  g.set(0, 2, fz + 2, lin(T.trunk[1]));
  for (const xs of [[3, 2, 1, 0], [-4, -3, -2, -1]])
    for (const x of xs)
      if (g.has(x, 2, 1)) {
        g.set(x, 2, 1, lin(IRIS));
        break;
      }
  line(g, [0, 0.07, -0.05], [0, 0.09, -0.09], back);
  line(g, [-0.03, 0.07, -0.05], [-0.03, 0.09, -0.09], back);
  for (const lx of [-1, 0]) {
    g.set(lx, 0, 0, lin(T.trunk[0]));
  }
  return buildGeometry(g.map, C);
}

export interface Barn {
  static: BufferGeometry[];
  /** Each leaf is built around its hinge: place the mesh at `hinge` and set rotation.y = openYaw. */
  doorLeaves: { geo: BufferGeometry; hinge: [number, number, number]; openYaw: number }[];
  lanterns: BufferGeometry;
  /** Built around the cat's own origin (place at CAT_SPOT); the tail is built about tailPivot (cat-local). */
  cat: { body: BufferGeometry; tail: BufferGeometry; tailPivot: [number, number, number] };
  robin: BufferGeometry;
  robinSpot: [number, number, number];
  tarp: BufferGeometry;
  /** The front wall's inside faces (see frontInside). */
  front: BufferGeometry;
  triangles: number;
}

/** The barn, built in steps (scene/slices.ts). */
export function buildBarn(): Barn {
  return finish(buildBarnSteps());
}

export function* buildBarnSteps(): Steps<Barn> {
  const b = beams();
  yield;
  const bl = new Grid(S), p = props();
  yield;
  const blockedByBeamsProps = (x: number, y: number, z: number) => b.has(x, y, z) || p.has(x, y, z);
  const stacks: [number, number, number, number, number, number][] = [
    [-57, -48, 0, 4, 61, 66], [-47, -38, 0, 4, 61, 66], [-57, -48, 0, 4, 55, 60], [-55, -46, 5, 9, 58, 63], [-54, -45, 10, 14, 58, 63],
    [47, 56, 0, 4, 61, 66], [47, 56, 0, 4, 55, 60], [46, 55, 5, 9, 57, 63], [48, 55, 10, 14, 59, 64],
  ];
  stacks.forEach((s, i) => bale(bl, ...s, 200 + i, blockedByBeamsProps));
  const blocked = (x: number, y: number, z: number) => blockedByBeamsProps(x, y, z) || bl.has(x, y, z);
  const f = floor(blocked);
  yield;
  const w = walls();
  noteShade(w.map.values(), S); // the walls' feet, for the ground's shade map (Home and the yard seen from the table)
  yield;
  const statics = yield* each([w, b, f, bl, p], (g) => buildGeometry(g.map, S));
  const leaves = yield* each([-1, 1] as const, (side) => ({
    geo: leaf(side),
    hinge: [side * BARN.backDoor.maxX, 0, BARN.maxZ + 0.25] as [number, number, number],
    openYaw: side * 1.75,
  }));
  const lant = buildGeometry(lanterns().map, S);
  const c = cat();
  const rb = robin();
  const tp = buildGeometry(tarp().map, S);
  yield;
  const front = frontInside();
  yield;
  const all = [...statics, ...leaves.map((l) => l.geo), lant, c.body, c.tail, rb, tp, front];
  for (const g of all) packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
  return {
    static: statics,
    doorLeaves: leaves,
    lanterns: lant,
    cat: c,
    robin: rb,
    robinSpot: ROBIN_SPOT,
    tarp: tp,
    front,
    triangles: all.reduce((s, g) => s + tris(g), 0),
  };
}
