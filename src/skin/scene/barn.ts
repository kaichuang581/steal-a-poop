import type { BufferGeometry } from 'three';
import { buildGeometry, triangles as tris } from '../voxel/mesher';
import { IRIS, lin, pick, T } from '../voxel/palette';
import type { Tone } from '../voxel/palette';
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
export const ROBIN_SPOT: V3 = [1.2, 4.1, 2.05];

const tone = (t: Tone, seed: number, w?: readonly [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);
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

function walls(): Grid {
  const g = new Grid(S);
  const knot = lin(T.beam[2]), nail = lin(T.stone[2]), seam = lin(T.barn[2]);
  // One tone per board: coplanar faces of a plank share a colour, so a wall is a wall, not a grid of tiles.
  const board = (b: number, seed: number): Paint => () => pick(T.barn, hash3(b, seed, 7, 41));
  const r = rng(101);
  let next = 2;
  const knotAt = (pts: [number, number, number][]) => {
    for (const [x, y, z] of pts) if (g.has(x, y, z)) g.set(x, y, z, knot);
  };

  // Back wall: boards 2 wide, 2 thick, 1-voxel gaps left empty so outside light shows through; gable up to the roof.
  for (let b = 0, xa = -62; xa <= 61; b++, xa += 3) {
    const cols = [xa, xa + 1].filter((x) => x <= 61);
    const top = Math.min(...cols.map(roofY));
    const p = board(b, 1);
    for (const x of cols) for (let y = 0; y < top; y++) if (!inBackDoor(x, y)) for (const z of [70, 71]) g.set(x, y, z, p(x, y, z)!);
    const bottom = inBackDoor(xa, 0) ? I(BARN.backDoor.height) : 0;
    if (top - bottom < 4) continue;
    g.set(xa, bottom + 1, 70, nail);
    g.set(xa, top - 2, 70, nail);
    if (b >= next) {
      next = b + 2 + Math.floor(r() * 3);
      const y = bottom + 3 + Math.floor(r() * Math.max(1, top - bottom - 8));
      knotAt([[xa, y, 70], [xa, y + 1, 70], [cols[cols.length - 1], y, 70]]);
    }
  }
  // Outside rails behind the gaps (stop short of the door so the open leaves clear them).
  for (const y0 of [9, 30]) fill(g, -62, 61, y0, y0 + 1, 72, 72, (x, y, z) => (x >= -21 && x <= 20 ? null : pick(T.beam, hash3(x, y, z, 9))));

  // Side walls: boards 3 wide along z, no gaps; the left one has the wolf's side door.
  for (const [xs, inner, left] of [[[-62, -61], -61, true], [[60, 61], 60, false]] as const) {
    next = 1;
    for (let b = 0, za = -40; za <= 69; b++, za += 3) {
      const zs = [za, za + 1, za + 2].filter((z) => z <= 69);
      const p = board(b, left ? 2 : 3);
      for (const z of zs)
        for (let y = 0; y < 42; y++) {
          if (left && inSideDoor(y, z)) continue;
          for (const x of xs) g.set(x, y, z, x === inner && z === za + 2 ? seam : p(x, y, z)!);
        }
      const bottom = left && inSideDoor(0, za + 1) ? SD.y1 + 1 : 0;
      g.set(inner, bottom + 1, za + 1, nail);
      g.set(inner, 40, za + 1, nail);
      if (b >= next) {
        next = b + 2 + Math.floor(r() * 3);
        const y = bottom + 3 + Math.floor(r() * (38 - bottom - 6));
        knotAt([[inner, y, za], [inner, y, za + 1], [inner, y + 1, za]]);
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
    const c = pick(T.barn, hash3(b, 4, 7, 41));
    for (let x = xa; x <= Math.min(61, xa + 2); x++) for (let y = 0; y < 42; y++) for (const z of [-42, -41]) g.set(x, y, z, x === xa + 2 ? lin(T.barn[2]) : c);
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
  const wood = tone(T.beam, 21, [0.45, 0.9]);
  const peg = lin(T.beam[0]);
  const post = (x0: number, z0: number, peg: [number, number]) => {
    fill(g, x0, x0 + 2, 0, 38, z0, z0 + 2, wood, 1);
    g.set(peg[0], 36, peg[1], lin(T.beam[0]));
    g.set(peg[0], 37, peg[1], lin(T.beam[0]));
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
  fill(g, -60, 59, I(BARN.beamY) - 1, I(BARN.beamY) + 1, bz - 1, bz + 1, wood, 0);
  for (const x0 of [-60, 57]) fill(g, x0, x0 + 2, 0, I(BARN.beamY) - 2, bz - 1, bz + 1, wood, 1);
  for (const x of [-57, 56]) for (const y of [36, 37]) g.set(x, y, bz, peg);
  fill(g, -21, 20, 34, 36, 67, 69, wood, 0); // back door header
  fill(g, -60, -59, SD.y1 + 1, SD.y1 + 3, SD.z0 - 2, SD.z1 + 2, wood, 2); // side door header

  // rafters toward the ridge, back half only; roof boards only over z >= 4.0 so the camera's view stays open
  for (const z0 of [19, 35, 51, 67]) for (let x = -60; x <= 59; x++) fill(g, x, x, roofY(x) - 3, roofY(x) - 1, z0, z0 + 2, wood);
  fill(g, -1, 1, roofY(0) - 3, roofY(0) - 1, 19, 69, wood, 2);
  const roof = tone(T.roof, 23);
  for (let x = -62; x <= 61; x++) fill(g, x, x, roofY(x), roofY(x) + 1, 40, 71, roof);

  // rope coil hung on the right wall post at z -0.35
  const rope: Paint = (x, y, z) => (x >= 57 && x <= 59 && z >= -5 && z <= -3) || x >= 60 ? null : g.has(x, y, z) ? null : pick(T.hay, 0.7 + hash3(x, y, z, 5) * 0.3);
  ring(g, [5.85, 1.45, -0.35], 0.25, 0.25, 0.1, rope);
  ring(g, [5.85, 1.65, -0.35], 0.28, 0.28, 0.1, rope);
  line(g, [5.6, 1.4, -0.6], [5.58, 0.95, -0.4], rope);
  line(g, [5.58, 0.95, -0.4], [5.6, 1.4, -0.1], rope);
  return g;
}

function bale(g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, seed: number, blocked: (x: number, y: number, z: number) => boolean) {
  const twine = lin(T.beam[2]);
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
        g.set(x, y, z, surface && bands.some((b) => x === b || x === b + 1) ? twine : pick(T.hay, h));
      }
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const end = r() < 0.6;
    const dir = end ? (r() < 0.5 ? -1 : 1) : 0;
    let x = end ? (dir < 0 ? x0 - 1 : x1 + 1) : x0 + 1 + Math.floor(r() * (len - 2));
    let y = y0 + Math.floor(r() * (y1 - y0 + 1));
    let z = end ? z0 + 1 + Math.floor(r() * (z1 - z0 - 1)) : z0 - 1;
    const c = pick(T.hay, r() * 0.5);
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
  const metal = tone(T.stone, 31), handle = tone(T.beam, 33, [0.3, 0.9]);
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
    for (const [dx, y] of [[-2, 3], [-1, 4], [0, 4], [1, 4], [2, 3]]) g.set(cx + dx, y, cz, lin(T.stone[2]));
  }
  // milk can: body, shoulder, neck, lid, two side handles
  {
    const cx = -33, cz = 54;
    const disc = (y: number, r: number, c: Paint) => {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dx, dz) <= r) g.set(cx + dx, y, cz + dz, c(cx + dx, y, cz + dz)!);
    };
    const light = tone(T.stone, 35, [0.8, 0.95]);
    for (let y = 0; y <= 4; y++) disc(y, 2.2, light);
    disc(5, 1.5, light);
    disc(6, 1.0, light);
    disc(7, 1.5, () => lin(T.stone[2]));
    g.set(cx - 3, 5, cz, lin(T.stone[2]));
    g.set(cx + 3, 5, cz, lin(T.stone[2]));
  }
  // wheelbarrow in the right back corner: hollow tray, wheel, two legs, two handles
  {
    const rim = lin(T.beam[2]);
    fill(g, 26, 34, 3, 6, 57, 64, (x, y, z) => {
      const wall = x === 26 || x === 34 || z === 57 || z === 64 || y === 3;
      return wall ? (y === 6 ? rim : pick(T.beam, hash3(x, y, z, 37))) : null;
    });
    for (let y = 0; y <= 4; y++) for (let z = 53; z <= 57; z++) if (Math.hypot(y - 2, z - 55) <= 2.2) for (const x of [29, 30]) g.set(x, y, z, Math.hypot(y - 2, z - 55) < 1 ? lin(T.stone[0]) : lin(T.stone[2]));
    for (const x of [27, 33]) {
      fill(g, x, x, 0, 2, 63, 63, handle);
      line(g, [x * S + 0.05, 0.55, 6.45], [x * S + 0.05, 0.45, 6.85], handle);
    }
  }
  // feed sack with a 3-voxel patch and a tied neck
  {
    const sack = tone(T.house, 39);
    ellipsoid(g, [-2.7, 0.0, 6.35], [0.3, 0.6, 0.25], (x, y, z) => (y < 0 ? null : sack(x, y, z)), 0.1, 4);
    fill(g, -28, -27, 6, 6, 62, 63, () => lin(T.house[2]));
    g.set(-28, 7, 63, lin(T.hay[2]));
    const patch = lin(T.beam[0]);
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
    const shoe = lin(T.stone[1]);
    for (const [x, y] of [[-2, 35], [-2, 36], [-2, 37], [2, 35], [2, 36], [2, 37], [-1, 34], [0, 34], [1, 34]]) g.set(x, y, 66, shoe);
  }
  return g;
}

function floor(blocked: (x: number, y: number, z: number) => boolean): Grid {
  const g = new Grid(S);
  const plankTone = (x: number, z: number) => pick(T.beam, hash3(Math.floor((x + 60) / 3), 0, Math.floor((z + 40 + ((x + 60) % 9) * 4) / 25), 51), [0.5, 0.95]);
  const rr = (SEAT_RING.rx + SEAT_RING.rz) / 2;
  for (let x = -60; x <= 59; x++)
    for (let z = -40; z <= 69; z++) {
      g.set(x, -1, z, plankTone(x, z));
      if (blocked(x, 0, z)) continue;
      const mx = (x + 0.5) * S, mz = (z + 0.5) * S;
      const h = hash3(x, 0, z, 53), h2 = hash3(x >> 1, 0, z >> 1, 54);
      if (Math.hypot(mx - HEAP[0], mz - HEAP[2]) < 1.45 + (h2 - 0.5) * 0.2) continue; // bare boards under the platform
      const e = Math.hypot((mx - SEAT_RING.cx) / SEAT_RING.rx, (mz - SEAT_RING.cz) / SEAT_RING.rz);
      if (Math.abs(e - 1) * rr < 0.4) {
        if (h < 0.7) g.set(x, 0, z, h < 0.08 ? lin(T.beam[0]) : pick(T.hay, 0.6 + hash3(x >> 2, 0, z >> 2, 57) * 0.4)); // trampled, darker
        continue;
      }
      // Broad hay is one tone with the occasional lighter patch: the texture comes from the straws, not from noise.
      if (h < 0.92) g.set(x, 0, z, pick(T.hay, hash3(x >> 3, 0, z >> 3, 56) < 0.12 ? 0.1 : 0.7));
      if (h2 < 0.09 && h < 0.5 && !blocked(x, 1, z)) g.set(x, 1, z, pick(T.hay, h * 1.6)); // tufts
    }

  // snow drifts blown in through the back doorway
  const snow: Paint = (x, y, z) => (z >= 70 || y < 0 || !inBackDoor(x, 0) || blocked(x, y, z) ? null : pick(T.snow, hash3(x >> 2, y >> 2, z >> 2, 55), [0.6, 0.97]));
  for (const [x, rx, ry, rz] of [[-1.3, 0.7, 0.35, 0.7], [-0.4, 0.8, 0.28, 0.55], [0.5, 0.7, 0.4, 0.8], [1.35, 0.6, 0.3, 0.6]]) ellipsoid(g, [x, 0, 7.0], [rx, ry, rz], snow, 0.15, 6);

  const topY = (x: number, z: number) => {
    for (let y = 4; y >= -1; y--) if (g.has(x, y, z)) return y;
    return -1;
  };
  // two-toe sheep footprints from the door to seat 0
  const seat = seatPosition(0, 6);
  const pressed = lin(T.path[2]);
  for (let i = 0, zf = 6.8; zf > seat.z + 0.4; i++, zf -= 0.3) {
    const xc = I(seat.x + (i % 2 ? 0.15 : -0.15)), zc = I(zf);
    for (const dx of [-1, 1])
      for (const dz of [0, 1]) {
        const x = xc + dx, z = zc + dz, y = topY(x, z);
        if (y > 0) g.del(x, y, z);
        g.set(x, Math.max(0, y - 1), z, pressed);
      }
  }
  // loose straws on top of the floor, following its surface
  const r = rng(57);
  for (let n = 0; n < 300; ) {
    const x0 = -58 + r() * 116, z0 = -38 + r() * 106;
    const a = r() * Math.PI * 2, len = 4 + Math.floor(r() * 5);
    const c = lin(r() < 0.6 ? T.hay[0] : T.hay[2]);
    if (Math.hypot(x0 * S - HEAP[0], z0 * S - HEAP[2]) < 1.3) continue;
    n++;
    for (let k = 0; k < len; k++) {
      const x = Math.round(x0 + Math.cos(a) * k), z = Math.round(z0 + Math.sin(a) * k);
      if (x < -60 || x > 59 || z < -40 || z > 69) break;
      const y = topY(x, z) + 1;
      if (!blocked(x, y, z)) g.set(x, y, z, c);
    }
  }
  return g;
}

function lanterns(): Grid {
  const g = new Grid(S);
  const wire = lin(T.hoof[0]);
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
  const seam = lin(T.barn[2]), brace = tone(T.beam, 61), iron = lin(T.stone[2]), snowC = tone(T.snow, 63, [0.5, 0.85]);
  for (let i = 0; i < w; i++)
    for (let y = 0; y < h; y++)
      for (const z of [0, 1]) g.set(X(i), y, z, i % 3 === 2 ? seam : pick(T.barn, hash3(Math.floor(i / 3), side, 0, 65)));
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
  const white = lin(T.trim[0]);
  const paint = (i: number, y: number) => { if (!g.has(X(i), y, 2)) g.set(X(i), y, 2, white); };
  for (let i = 0; i < w; i++) for (const y of [8, 9, h - 2, h - 1]) paint(i, y);
  for (let y = 8; y < h; y++) for (const i of [0, 1, w - 2, w - 1]) paint(i, y);
  for (let t = 0; t <= 60; t++) {
    const i = Math.round(1 + (w - 3) * (t / 60)), y = Math.round(9 + (h - 11) * (t / 60));
    for (const [a, b] of [[i, y], [i, y + 1], [w - 1 - i, y], [w - 1 - i, y + 1]]) paint(a, b);
  }
  if (side < 0) {
    const y = Math.floor(h / 2) - 1;
    for (let i = w - 7; i < w; i++) g.set(X(i), y, -1, lin(T.stone[1]));
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
      g.set(-61, y, z, fold ? lin(T.beam[2]) : h < 0.3 ? lin(T.stone[2]) : pick(T.stone, 0.3 + h * 0.7));
    }
  }
  return g;
}

/** Sleeping grey tabby around its own origin (belly on y = 0, head toward -z and +x); tail built about its pivot. */
function cat(): { body: BufferGeometry; tail: BufferGeometry; tailPivot: V3 } {
  const g = new Grid(C);
  const stripe = lin(T.stone[2]);
  const fur: Paint = (x, y, z) => (((x % 3) + 3) % 3 === 0 && hash3(x, y, z, 81) < 0.85 ? stripe : pick(T.stone, hash3(x, y, z, 82) * 0.85));
  const up = (p: Paint): Paint => (x, y, z) => (y < 0 ? null : p(x, y, z));
  ellipsoid(g, [0, 0.09, 0], [0.2, 0.09, 0.12], up(fur), 0.05, 83);
  ellipsoid(g, [-0.1, 0.1, 0.03], [0.1, 0.09, 0.1], up(fur), 0.05, 84);
  ellipsoid(g, [0.16, 0.09, -0.07], [0.075, 0.065, 0.07], up(fur), 0, 85);
  for (const ex of [0.13, 0.19]) cone(g, [ex, 0.14, -0.1], 0.025, 0.06, 1, () => lin(T.stone[1]));
  const front = (x: number, y: number) => {
    for (let z = -8; z <= 4; z++) if (g.has(x, y, z)) return z;
    return null;
  };
  const face = (xm: number, ym: number, c: RGB) => {
    const x = Math.round(xm / C), y = Math.round(ym / C), z = front(x, y);
    if (z !== null) g.set(x, y, z, c);
  };
  for (const ex of [0.12, 0.2]) {
    face(ex, 0.1, lin(T.face[2])); // closed eyes: short dark lines
    face(ex + 0.04, 0.1, lin(T.face[2]));
  }
  face(0.16, 0.06, lin(T.pink[2]));

  const t = new Grid(C);
  const path: V3[] = [[-0.18, 0.05, -0.1], [-0.2, 0.02, -0.24], [-0.2, 0.0, -0.34], [-0.2, -0.12, -0.37], [-0.19, -0.27, -0.36]];
  let k = 0;
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s], b = path[s + 1];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (C * 0.5));
    for (let i = 0; i < n; i++, k++) {
      const f = i / n;
      const x = Math.round((a[0] + (b[0] - a[0]) * f) / C), y = Math.round((a[1] + (b[1] - a[1]) * f) / C), z = Math.round((a[2] + (b[2] - a[2]) * f) / C);
      const c = Math.floor(k / 2) % 3 === 0 || (s === path.length - 2 && f > 0.6) ? stripe : pick(T.stone, hash3(x, y, z, 86) * 0.85);
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
  const breast = lin('#D9653B');
  const back = tone(T.beam, 91, [0.4, 0.9]);
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

export function buildBarn(): Barn {
  const b = beams(), bl = new Grid(S), p = props();
  const blockedByBeamsProps = (x: number, y: number, z: number) => b.has(x, y, z) || p.has(x, y, z);
  const stacks: [number, number, number, number, number, number][] = [
    [-57, -48, 0, 4, 61, 66], [-47, -38, 0, 4, 61, 66], [-57, -48, 0, 4, 55, 60], [-55, -46, 5, 9, 58, 63], [-54, -45, 10, 14, 58, 63],
    [47, 56, 0, 4, 61, 66], [47, 56, 0, 4, 55, 60], [46, 55, 5, 9, 57, 63], [48, 55, 10, 14, 59, 64],
  ];
  stacks.forEach((s, i) => bale(bl, ...s, 200 + i, blockedByBeamsProps));
  const blocked = (x: number, y: number, z: number) => blockedByBeamsProps(x, y, z) || bl.has(x, y, z);
  const f = floor(blocked);
  const statics = [walls(), b, f, bl, p].map((g) => buildGeometry(g.map, S));
  const leaves = ([-1, 1] as const).map((side) => ({
    geo: leaf(side),
    hinge: [side * BARN.backDoor.maxX, 0, BARN.maxZ + 0.25] as [number, number, number],
    openYaw: side * 1.75,
  }));
  const lant = buildGeometry(lanterns().map, S);
  const c = cat();
  const rb = robin();
  const tp = buildGeometry(tarp().map, S);
  const front = frontInside();
  const all = [...statics, ...leaves.map((l) => l.geo), lant, c.body, c.tail, rb, tp, front];
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
