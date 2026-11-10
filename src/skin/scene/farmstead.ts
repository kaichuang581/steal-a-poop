import type { BufferGeometry } from 'three';
import { buildGeometry, triangles } from '../voxel/mesher';
import { detailed } from '../voxel/refine';
import { lin, pick, T } from '../voxel/palette';
import { snowAt, snowPaint } from '../voxel/snow';
import type { Tone } from '../voxel/palette';
import { ellipsoid, Grid, hash3, line, rng } from '../voxel/primitives';
import type { Paint, V3 } from '../voxel/primitives';
import { backHillHeight } from './distance';
import { BARN, YARD } from './layout';
import { ChunkMap, dropFaces } from './yard';

/**
 * The working farm around the barn, seen only from the start screen. The barn itself is a stage set for the game's
 * table camera: no front wall, a roof over the back third, gaps in the back boards. This file finishes it from the
 * outside and fills the land around it, in meshes the table never mounts, so nothing here touches the game's view.
 * Fine work is on the 0.10 m grid, buildings and props on the 0.20 m grid, the land on the 1 m grid (plan V3 Part 4.1).
 */
const F = 0.1;
const S = 0.2;
const CHUNK = 8;

/** Where everything stands, in metres. The shot list in FarmBackdrop frames these. */
export const FARM = {
  silo: { x: 9.7, z: -0.8, r: 1.9, h: 10.5 },
  coop: { x: -12, z: 1.5 },
  tractor: { x: 9.6, z: 8.6 },
  paddock: { minX: 12, maxX: 22, minZ: -14, maxZ: 7 },
  run: { minX: -19, maxX: -8.6, minZ: -5, maxZ: 8 },
  orchard: { minX: -36, minZ: -13, cols: 3, rows: 5, gap: 5.5 },
  field: { minX: -26, maxX: 30, minZ: -27, maxZ: -16 },
};

const tone = (t: Tone, seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);
const snow = snowPaint(F, 3);
const white = tone(T.trim, 5, [0.6, 0.95]);

/** Top of the barn's own roof boards at column x (0.1 m index), as in barn.ts. */
const barnRoofY = (x: number) => 42 + Math.floor(22 * Math.max(0, 1 - Math.abs(x + 0.5) / 60));

class Builder {
  constructor(readonly g: Grid) {}
  ix = (m: number) => Math.round(m / this.g.size);
  set(x: number, y: number, z: number, p: Paint) {
    // Snow takes this builder's own cell size, so the roof's 0.2 m grid and the yard's 0.1 m grid get the same marks.
    const c = p === snow ? snowAt(x, y, z, this.g.size, 3) : p(x, y, z);
    if (c) this.g.set(x, y, z, c);
  }
  /** An inclusive box of cells, by index. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, p);
  }
  /** Snow on a cell's upper face, unless something sits there. */
  cap(x: number, y: number, z: number) {
    if (!this.g.has(x, y + 1, z)) this.set(x, y + 1, z, snow);
  }
  /** Caps the top of everything in this box of columns. */
  capAll(x0: number, x1: number, y1: number, z0: number, z1: number, chance = 0.8) {
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (let y = y1; y >= 0; y--)
          if (this.g.has(x, y, z)) {
            if (hash3(x, y, z, 9) < chance) this.cap(x, y, z);
            break;
          }
  }
}

/** The barn's missing outside on the 0.10 m grid: front wall, solid boards, trim, loft door, windows, foundation. */
function barnShell(): BufferGeometry {
  const b = new Builder(new Grid(F));
  const seam = lin(T.barn[2]);
  const board = (i: number, seed: number): Paint => () => pick(T.barn, hash3(i, seed, 7, 41));
  const stone: Paint = (x, y, z) => pick(T.stone, hash3(x >> 1, y >> 1, z >> 1, 51), [0.3, 0.8]);

  // The gaps between the back boards, closed from just inside the outer face.
  for (let xa = -62; xa <= 61; xa += 3) {
    const x = xa + 2;
    if (x > 61) break;
    for (let y = 0; y < barnRoofY(x); y++) {
      if (x >= -18 && x < 18 && y < 34) continue;
      b.set(x, y, 70, () => seam);
    }
  }

  // Front wall: the side walls' boards, up into the gable, with big closed doors in the middle.
  for (let i = 0, xa = -62; xa <= 61; i++, xa += 3) {
    for (let x = xa; x <= Math.min(61, xa + 2); x++)
      for (let y = 0; y < barnRoofY(x) + 2; y++)
        for (const z of [-44, -43]) b.set(x, y, z, x === xa + 2 ? () => seam : board(i, 8));
  }
  const frame = (x0: number, x1: number, y0: number, y1: number, z: number, w = 2) => {
    b.box(x0, x1, y0, y0 + w - 1, z, z, white);
    b.box(x0, x1, y1 - w + 1, y1, z, z, white);
    b.box(x0, x0 + w - 1, y0, y1, z, z, white);
    b.box(x1 - w + 1, x1, y0, y1, z, z, white);
  };
  const cross = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    for (let t = 0; t <= 80; t++) {
      const x = Math.round(x0 + (x1 - x0) * (t / 80)), y = Math.round(y0 + (y1 - y0) * (t / 80));
      for (const [px, py] of [[x, y], [x, y + 1], [x0 + x1 - x, y], [x0 + x1 - x, y + 1]]) b.set(px, py, z, white);
    }
  };
  for (const [x0, x1] of [[-20, -1], [0, 19]]) {
    frame(x0, x1, 4, 34, -45);
    cross(x0 + 1, x1 - 1, 5, 32, -45);
  }

  // Foundation: a course of stone round the foot of the walls.
  b.box(-63, 62, 0, 3, -45, -45, stone);
  b.box(-63, -63, 0, 3, -45, 72, stone);
  b.box(62, 62, 0, 3, -45, 72, stone);
  b.box(-63, -21, 0, 3, 72, 72, stone);
  b.box(20, 62, 0, 3, 72, 72, stone);

  // The wolf's side door, boarded up properly from outside.
  const SD = { z0: 17, z1: 30, y1: 23 };
  b.box(-63, -63, 4, SD.y1, SD.z0, SD.z1, (_x, _y, z) => pick(T.barn, hash3(0, 0, z >> 1, 44)));
  frame2z(b, -63, SD.z0 - 2, SD.z1 + 2, 4, SD.y1 + 2);

  // Windows along both sides: white frame, dark panes, a sill with snow.
  for (const x of [-63, 62])
    for (const zc of x < 0 ? [-24, 50] : [-24, 12, 50]) {
      b.box(x, x, 20, 33, zc - 6, zc + 6, white);
      b.box(x, x, 22, 26, zc - 4, zc - 1, () => lin('#2C3644'));
      b.box(x, x, 22, 26, zc + 1, zc + 4, () => lin('#2C3644'));
      b.box(x, x, 28, 31, zc - 4, zc - 1, () => lin('#39465A'));
      b.box(x, x, 28, 31, zc + 1, zc + 4, () => lin('#39465A'));
      const out = x < 0 ? x - 1 : x + 1;
      b.box(out, out, 19, 19, zc - 7, zc + 7, white);
      b.box(out, out, 20, 20, zc - 7, zc + 7, snow);
    }

  // Trim: corner boards, the rake under the roof on both gables, and the frame of the open doors.
  for (const x of [-64, -63, 62, 63]) { b.box(x, x, 4, 42, -46, -43, white); b.box(x, x, 4, 42, 70, 73, white); }
  for (const z of [-45, 72]) {
    b.box(-62, -60, 4, 42, z, z, white);
    b.box(59, 61, 4, 42, z, z, white);
    for (let x = -62; x <= 61; x++) for (let k = 0; k < 3; k++) b.set(x, barnRoofY(x) - k, z, white);
  }
  b.box(-20, -19, 0, 35, 72, 72, white);
  b.box(18, 19, 0, 35, 72, 72, white);
  b.box(-20, 19, 34, 36, 72, 72, white);

  // Hay loft over the open doors: a white-framed door with a cross, and the hoist beam above it.
  b.box(-9, 8, 39, 55, 72, 72, (x, _y, z) => pick(T.barn, hash3(x >> 2, 3, z, 45)));
  frame(-9, 8, 39, 55, 73);
  cross(-8, 7, 40, 53, 73);
  b.box(-1, 0, 58, 59, 72, 84, tone(T.beam, 46));
  b.box(-1, 0, 56, 57, 83, 83, () => lin(T.stone[2]));
  b.box(-1, 0, 60, 60, 74, 84, snow);
  // Round vent high on the front gable.
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) {
    const r = Math.hypot(x, y);
    if (r <= 6.4) b.set(x, 50 + y, -45, () => lin(r > 4.6 ? T.trim[0] : T.barn[2]));
  }
  return buildGeometry(b.g.map, F);
}

/** A white frame on an x-facing wall. */
function frame2z(b: Builder, x: number, z0: number, z1: number, y0: number, y1: number) {
  b.box(x, x, y0, y0 + 1, z0, z1, white);
  b.box(x, x, y1 - 1, y1, z0, z1, white);
  b.box(x, x, y0, y1, z0, z0 + 1, white);
  b.box(x, x, y0, y1, z1 - 1, z1, white);
}

/** The whole roof on the 0.20 m grid, over the barn's own, with eaves, snow, icicles and a cupola. */
function barnRoof(b: Builder) {
  const X0 = b.ix(-6.8), X1 = b.ix(6.8) - 1, Z0 = b.ix(-4.8), Z1 = b.ix(7.8) - 1;
  const rise = (xi: number) => {
    const ax = Math.abs((xi + 0.5) * S);
    return Math.ceil((4.42 + 2.2 * (1 - ax / 6)) / S);
  };
  const ice = tone(T.ice, 7);
  for (let x = X0; x <= X1; x++) {
    const y = rise(x);
    for (let z = Z0; z <= Z1; z++) {
      const course = lin(T.shingle[(y + (((z >> 1) + y) & 1)) % 3]);
      b.set(x, y, z, () => course);
      b.set(x, y + 1, z, () => course);
      const end = z === Z0 || z === Z1;
      const eave = x <= X0 + 3 || x >= X1 - 3;
      if (end || eave) b.set(x, y - 1, z, white); // fascia and soffit, so nothing shows under the roof
      // One unbroken blanket of snow, thinning only along the eaves, where the roof has shed it.
      const edge = Math.min(x - X0, X1 - x, z - Z0, Z1 - z);
      if (edge >= 3 || hash3(x, y, z >> 1, 11) < 0.25 + edge * 0.22) b.set(x, y + 2, z, snow);
    }
  }
  for (let z = Z0; z <= Z1; z++)
    for (const x of [X0, X1]) {
      const n = hash3(x, 0, z, 13);
      if (n < 0.68) continue;
      for (let k = 2; k < 2 + Math.round((n - 0.68) * 9) + 1; k++) b.set(x, rise(x) - k, z, ice);
    }
  // Cupola on the ridge: white louvred box, little pitched roof, weathervane.
  const zc = b.ix(1.4), base = rise(0) + 2, h = 6;
  for (let y = base; y < base + h; y++)
    for (let x = -4; x <= 3; x++)
      for (let z = zc - 4; z <= zc + 3; z++) {
        const rim = x === -4 || x === 3 || z === zc - 4 || z === zc + 3;
        if (!rim) continue;
        const corner = (x === -4 || x === 3) && (z === zc - 4 || z === zc + 3);
        b.set(x, y, z, () => lin(corner || y === base || y === base + h - 1 || (y - base) % 2 === 0 ? T.trim[0] : T.shingle[2]));
      }
  for (let k = 0; k < 4; k++) {
    const y = base + h + k;
    for (let x = -6 + k; x <= 5 - k; x++) for (let z = zc - 6; z <= zc + 5; z++) b.set(x, y, z, () => lin(T.shingle[1]));
    for (let z = zc - 6; z <= zc + 5; z++) for (const x of [-6 + k, 5 - k]) b.cap(x, y, z);
  }
  const top = base + h + 4;
  for (let z = zc - 6; z <= zc + 5; z++) b.box(-2, 1, top, top, z, z, snow);
  const iron = () => lin(T.face[1]);
  b.box(0, 0, top + 1, top + 4, zc, zc, iron);
  b.box(-4, 4, top + 5, top + 5, zc, zc, iron);
  b.box(3, 3, top + 4, top + 6, zc, zc, iron);
  b.box(-4, -4, top + 4, top + 6, zc, zc, iron), b.box(-5, -5, top + 4, top + 6, zc, zc, iron);
}

function silo(b: Builder) {
  const { x, z, r, h } = FARM.silo;
  const cx = b.ix(x), cz = b.ix(z), R = Math.round(r / S), H = b.ix(h);
  for (let dx = -R - 1; dx <= R + 1; dx++)
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const d = Math.hypot(dx + 0.5, dz + 0.5);
      if (d > R || d < R - 1.6) continue;
      for (let y = 0; y < H; y++) {
        const a = Math.floor((Math.atan2(dz + 0.5, dx + 0.5) + Math.PI) * 7);
        const band = y % 8 === 0;
        b.set(cx + dx, y, cz + dz, () => lin(band ? T.stone[2] : a % 2 ? T.trim[1] : T.trim[2]));
      }
    }
  ellipsoid(b.g, [x + S / 2, h, z + S / 2], [r + 0.1, r * 0.8, r + 0.1], (px, py, pz) => (py < H ? null : pick(T.stone, hash3(px, py, pz, 21), [0.25, 0.7])));
  b.capAll(cx - R - 2, cx + R + 2, H + 12, cz - R - 2, cz + R + 2, 0.95);
  // Ladder and chute down the side that faces the yard.
  const iron = () => lin(T.stone[2]);
  const lz = cz + R + 1;
  for (let y = 0; y < H + 3; y++) {
    b.set(cx - 2, y, lz, iron), b.set(cx + 1, y, lz, iron);
    if (y % 3 === 0) b.box(cx - 1, cx, y, y, lz, lz, iron);
  }
}

/** A straight rail fence along x or z from a to b, with posts every 2 m, two rails and snow on top. */
function fenceRun(b: Builder, a: [number, number], c: [number, number], skip?: (x: number, z: number) => boolean) {
  const wood = tone(T.beam, 31, [0.45, 0.85]);
  const along = a[0] === c[0] ? 'z' : 'x';
  const n = Math.round(Math.abs(along === 'x' ? c[0] - a[0] : c[1] - a[1]) / S);
  const sx = Math.sign(c[0] - a[0]), sz = Math.sign(c[1] - a[1]);
  for (let i = 0; i <= n; i++) {
    const x = b.ix(a[0]) + sx * i, z = b.ix(a[1]) + sz * i;
    if (skip?.(x * S, z * S)) continue;
    for (const y of [2, 4]) {
      b.set(x, y, z, wood);
      if (hash3(x, y, z, 32) > 0.3) b.cap(x, y, z);
    }
    if (i % 10 === 0) {
      b.box(x, x, 0, 5, z, z, wood);
      b.cap(x, 5, z);
    }
  }
}

function paddock(b: Builder) {
  const P = FARM.paddock;
  fenceRun(b, [P.minX, P.minZ], [P.maxX, P.minZ]);
  fenceRun(b, [P.maxX, P.minZ], [P.maxX, P.maxZ]);
  fenceRun(b, [P.minX, P.maxZ], [P.maxX, P.maxZ], (x) => x > 15.6 && x < 18);
  fenceRun(b, [P.minX, P.minZ], [P.minX, P.maxZ]);
  // Run-in shed along the back: three plank walls, a roof sloping to the rear, the open side toward the yard.
  const x0 = b.ix(13), x1 = b.ix(20.4), z0 = b.ix(-13.4), z1 = b.ix(-10.2);
  const plank: Paint = (x, _y, z) => pick(T.barn, hash3(x >> 1, 2, z >> 1, 33));
  b.box(x0, x1, 0, 11, z0, z0, plank);
  b.box(x0, x0, 0, 13, z0, z1, plank);
  b.box(x1, x1, 0, 13, z0, z1, plank);
  b.box(x0, x0, 0, 13, z1, z1, tone(T.beam, 34));
  b.box(x1, x1, 0, 13, z1, z1, tone(T.beam, 34));
  for (let z = z0 - 2; z <= z1 + 2; z++) {
    const y = 12 + Math.round(((z - z0) / (z1 - z0)) * 2);
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      b.set(x, y, z, () => lin(T.shingle[(x & 1) + 1]));
      if (hash3(x, y, z, 35) > 0.1) b.cap(x, y, z);
    }
  }
  // Hay rack in the middle of the paddock.
  const rx = b.ix(16.6), rz = b.ix(-3.4), wood = tone(T.beam, 36);
  b.box(rx - 7, rx + 7, 3, 3, rz - 2, rz + 2, wood);
  for (const x of [rx - 7, rx + 7]) for (const z of [rz - 2, rz + 2]) b.box(x, x, 0, 5, z, z, wood);
  b.box(rx - 6, rx + 6, 4, 6, rz - 1, rz + 1, tone(T.hay, 37, [0.4, 0.85]));
  b.capAll(rx - 6, rx + 6, 7, rz - 1, rz + 1, 0.6);
}

function coop(b: Builder) {
  const { x, z } = FARM.coop;
  const x0 = b.ix(x - 1.8), x1 = b.ix(x + 1.8) - 1, z0 = b.ix(z - 1.3), z1 = b.ix(z + 1.3) - 1, W = 8, y0 = 2;
  const wall: Paint = (_x, py) => lin(py % 2 ? '#E3C27A' : '#D7B368');
  const post = tone(T.beam, 41);
  for (const px of [x0, x1]) for (const pz of [z0, z1]) b.box(px, px, 0, y0 - 1, pz, pz, post);
  b.box(x0, x1, y0, y0, z0, z1, tone(T.beam, 42));
  for (let px = x0; px <= x1; px++)
    for (let pz = z0; pz <= z1; pz++) {
      if (px !== x0 && px !== x1 && pz !== z0 && pz !== z1) continue;
      b.box(px, px, y0 + 1, y0 + W, pz, pz, wall);
    }
  const zc = (z0 + z1 + 1) / 2, half = (z1 - z0 + 1) / 2;
  for (let px = x0 - 2; px <= x1 + 2; px++)
    for (let pz = z0 - 2; pz <= z1 + 2; pz++) {
      const d = Math.abs(pz + 0.5 - zc);
      const y = y0 + W + 1 + Math.floor((half + 1 - d) * 0.75);
      b.set(px, y, pz, () => lin(T.tractor[((px >> 1) + (pz >> 1)) & 1 ? 1 : 2]));
      if (px >= x0 && px <= x1) for (let f = y0 + W + 1; f < y; f++) if (px === x0 || px === x1) b.set(px, f, pz, wall);
      if (hash3(px, y, pz, 43) > 0.12) b.cap(px, y, pz);
    }
  // Pop door and ramp on the side toward the barn path, a little window, and a nest box on the end.
  const dz = z1;
  b.box(x0 + 3, x0 + 5, y0 + 1, y0 + 4, dz + 1, dz + 1, () => lin(T.roof[2]));
  for (let k = 0; k < 4; k++) b.box(x0 + 3, x0 + 5, y0 - k, y0 - k, dz + 1 + k, dz + 1 + k, tone(T.beam, 44));
  b.box(x1 - 6, x1 - 3, y0 + 4, y0 + 6, dz + 1, dz + 1, () => lin(T.trim[0]));
  b.box(x1 - 5, x1 - 4, y0 + 5, y0 + 5, dz + 1, dz + 1, () => lin(T.lantern[1]));
  // The chicken run in low fence.
  const R = FARM.run;
  fenceRun(b, [R.minX, R.minZ], [R.maxX, R.minZ]);
  fenceRun(b, [R.minX, R.minZ], [R.minX, R.maxZ]);
  fenceRun(b, [R.minX, R.maxZ], [R.maxX, R.maxZ], (px) => px > -13 && px < -11);
  fenceRun(b, [R.maxX, R.minZ], [R.maxX, R.maxZ]);
}

/**
 * What the hens actually use, on the 0.1 m grid: a bed of straw spread out from the pop door and thinning into wisps at
 * its edge, a feed trough full of grain, a water pan with a skin of ice, and a perch.
 */
function henYard(b: Builder) {
  // One flat layer: stacked bits shade each other dark, and this is meant to read as a clean, pale bed.
  const straw: Paint = (x, y, z) => pick(T.hay, hash3(x >> 1, y, z, 46), [0.55, 1.01]);
  const cx = FARM.coop.x, cz = FARM.coop.z + 3.1;
  for (let px = b.ix(cx - 5.4); px <= b.ix(cx + 3.2); px++)
    for (let pz = b.ix(cz - 1.7); pz <= b.ix(cz + 2.6); pz++) {
      const d = Math.hypot((px * F - cx + 1) / 4.2, (pz * F - cz - 0.4) / 2.1);
      const wisps = hash3(px, 0, pz >> 1, 47);
      if (d > 1.15 || wisps < (d - 0.72) * 2.4) continue;
      b.set(px, 0, pz, straw);
    }
  // The feed trough: a long open box on two trestles, heaped with grain.
  const tx = b.ix(cx - 3.8), tz = b.ix(cz + 0.5), wood = tone(T.beam, 49);
  for (const leg of [tx, tx + 15]) b.box(leg, leg + 1, 0, 2, tz - 2, tz + 3, wood);
  b.box(tx - 1, tx + 16, 3, 3, tz - 1, tz + 2, wood);
  for (const side of [tz - 2, tz + 3]) b.box(tx - 1, tx + 16, 3, 4, side, side, wood);
  for (const end of [tx - 2, tx + 17]) b.box(end, end, 3, 4, tz - 2, tz + 3, wood);
  b.box(tx - 1, tx + 16, 4, 4, tz - 1, tz + 2, (x, y, z) => lin(hash3(x, y, z, 50) > 0.5 ? T.lantern[1] : T.hay[2]));
  // The water pan: a low dark rim round a frozen middle.
  const wx = b.ix(cx + 2.2), wz = b.ix(cz + 0.6);
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++) {
      const r = Math.hypot(dx, dz);
      if (r > 4.3) continue;
      b.set(wx + dx, 0, wz + dz, () => lin(T.stone[2]));
      b.set(wx + dx, 1, wz + dz, r > 3.2 ? () => lin(T.stone[1]) : tone(T.ice, 52));
    }
  // A perch: two posts and a rail, at hen height.
  const hx = b.ix(cx - 5.4), hz = b.ix(cz + 2.0);
  for (const leg of [hx, hx + 18]) b.box(leg, leg, 0, 5, hz, hz, wood);
  b.box(hx, hx + 18, 6, 6, hz, hz, tone(T.trunk, 53));
}

/** A round bale lying with its axis along z. */
function roundBale(b: Builder, x: number, z: number, seed: number) {
  const cx = b.ix(x), cz = b.ix(z), R = 3.6, L = 3;
  const twist: Paint = (px, py, pz) => pick(T.hay, hash3(Math.round(Math.hypot(px - cx, py - R)), 0, pz >> 1, seed), [0.35, 0.85]);
  for (let px = -4; px <= 4; px++)
    for (let py = 0; py <= 8; py++)
      if (Math.hypot(px, py + 0.5 - R) <= R)
        for (let pz = -L; pz <= L; pz++) b.set(cx + px, py, cz + pz, twist);
  b.capAll(cx - 4, cx + 4, 9, cz - L, cz + L, 0.9);
}

/** A bare apple tree: forked branches, snow along the tops of the limbs. */
/** Where the orchard's branches end, for the baubles to hang from. Filled in as the trees are built. */
export const ORCHARD_TIPS: V3[] = [];

function bareTree(b: Builder, x: number, z: number, seed: number, size = 1) {
  const r = rng(seed * 31 + 7);
  const bark = tone(T.trunk, seed + 50, [0.4, 0.85]);
  const trunkH = (1.4 + r() * 0.5) * size;
  line(b.g, [x, 0, z], [x, trunkH, z], bark, true);
  line(b.g, [x + S, 0, z], [x + S, trunkH * 0.8, z], bark, true);
  line(b.g, [x, 0, z + S], [x, trunkH * 0.7, z + S], bark, true);
  const limb = (from: V3, a: number, up: number, len: number, depth: number) => {
    const to: V3 = [from[0] + Math.cos(a) * len, from[1] + up * len, from[2] + Math.sin(a) * len];
    line(b.g, from, to, bark, true);
    if (depth === 0) {
      ORCHARD_TIPS.push(to);
      return;
    }
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) limb(to, a + (r() - 0.5) * 2, 0.35 + r() * 0.5, len * (0.6 + r() * 0.2), depth - 1);
  };
  const top: V3 = [x, trunkH, z];
  for (let i = 0; i < 4; i++) limb(top, i * 1.57 + r(), 0.5 + r() * 0.4, 1.1 * size, 2);
  const cx = b.ix(x), cz = b.ix(z);
  b.capAll(cx - 18, cx + 18, 28, cz - 18, cz + 18, 0.75);
}

function fieldAndTrees(b: Builder) {
  const P = FARM.field;
  // Stubble: short rows of cut corn standing out of the snow, the plough lines running across the view.
  const stalk = tone(T.hay, 51, [0.5, 1]);
  for (let z = b.ix(P.minZ); z < b.ix(P.maxZ); z += 4)
    for (let x = b.ix(P.minX); x < b.ix(P.maxX); x++) {
      const h = hash3(x, 0, z, 52);
      if (h < 0.5) continue;
      b.set(x, 0, z, stalk);
      if (h > 0.82) b.set(x, 1, z, stalk);
    }
  fenceRun(b, [P.minX - 1, P.maxZ + 1], [P.maxX + 1, P.maxZ + 1], (x) => x > -2 && x < 2);
  [[-14, -21], [-8, -24], [-3, -19.5], [6, -23], [13, -20], [21, -24.5]].forEach(([x, z], i) => roundBale(b, x, z, 60 + i));
  roundBale(b, 24.6, 3, 70), roundBale(b, 24.8, 5.6, 71);
}

/** The orchard's bare trees, right under the tour's wide shot. */
function orchard(b: Builder) {
  const O = FARM.orchard;
  for (let i = 0; i < O.cols; i++)
    for (let k = 0; k < O.rows; k++) {
      // Old trees: planted in rows once, some long gone, the rest grown out of line and to their own size.
      if (hash3(i, k, 0, 55) > 0.84) continue;
      const x = O.minX + i * O.gap + (hash3(i, k, 1, 56) - 0.5) * 3, z = O.minZ + k * O.gap + (hash3(i, k, 2, 57) - 0.5) * 3;
      bareTree(b, x, z, i * 7 + k + 1, 0.7 + hash3(i, k, 3, 58) * 0.55);
    }
}

/** The tractor on the 0.10 m grid, parked by the barn, its nose toward -x. */
function tractor(b: Builder) {
  const X = b.ix(FARM.tractor.x), Z = b.ix(FARM.tractor.z);
  const red = tone(T.tractor, 61), iron = () => lin(T.face[1]), tyre = tone(T.face, 62), hub = () => lin(T.lantern[1]);
  const wheel = (cx: number, cy: number, z0: number, z1: number, R: number) => {
    for (let x = -R; x <= R; x++)
      for (let y = -R; y <= R; y++) {
        const d = Math.hypot(x, y);
        if (d > R) continue;
        const lug = d > R - 2 && Math.floor((Math.atan2(y, x) + Math.PI) * 5) % 2 === 0;
        const rim = d < R * 0.32;
        for (let z = z0; z <= z1; z++) {
          if (d > R - 1 && !lug) continue;
          b.set(cx + x, cy + y, z, rim ? hub : tyre);
        }
      }
  };
  // Each wheel's centre one cell under its radius: the tyre's bottom row is a gap between lugs, so a centre at the
  // radius left every tyre 0.1 m over the snow (Brian, 2026-11-09: "a lot of them are floating").
  for (const s of [-1, 1]) {
    wheel(X + 11, 7, s < 0 ? Z - 12 : Z + 8, s < 0 ? Z - 8 : Z + 12, 8);
    wheel(X - 13, 4, s < 0 ? Z - 10 : Z + 7, s < 0 ? Z - 7 : Z + 10, 5);
  }
  // Axles, and a post from the front axle up into the hood: nothing joined the wheels to the body.
  b.box(X + 10, X + 12, 6, 8, Z - 12, Z + 12, iron);
  b.box(X - 14, X - 12, 3, 5, Z - 10, Z + 10, iron);
  b.box(X - 14, X - 12, 5, 7, Z - 1, Z + 1, iron);
  b.box(X - 19, X + 6, 7, 14, Z - 4, Z + 4, red); // hood
  b.box(X - 19, X - 19, 8, 13, Z - 3, Z + 3, iron); // grille
  b.box(X - 20, X - 20, 12, 13, Z - 3, Z - 2, () => lin(T.lantern[0]));
  b.box(X - 20, X - 20, 12, 13, Z + 2, Z + 3, () => lin(T.lantern[0]));
  b.box(X + 6, X + 15, 6, 11, Z - 5, Z + 5, red); // body
  b.box(X + 7, X + 16, 12, 13, Z - 9, Z - 5, red); // fenders, run in to the body's sides
  b.box(X + 7, X + 16, 12, 13, Z + 5, Z + 9, red);
  b.box(X + 9, X + 13, 12, 13, Z - 2, Z + 2, iron); // seat
  b.box(X + 13, X + 14, 14, 18, Z - 2, Z + 2, iron);
  b.box(X + 5, X + 5, 15, 19, Z, Z, iron); // steering column
  b.box(X + 4, X + 6, 20, 20, Z - 2, Z + 2, iron);
  b.box(X - 12, X - 11, 15, 25, Z, Z + 1, iron); // exhaust
  b.capAll(X - 19, X + 6, 16, Z - 4, Z + 4, 0.85);
  b.capAll(X + 7, X + 16, 15, Z - 9, Z + 9, 0.55);
}

/** The land past the yard, on the 1 m grid: flat near the buildings, rising into the hills on every side. */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** How high the land stands at a point: flat around the farm, rising to the back hills and at the far sides. */
export function landHeight(x: number, z: number): number {
  const back = backHillHeight(x, Math.min(z, -34)) * smooth((-29 - z) / 12);
  const side = Math.max(0, Math.abs(x) - 50);
  const rise = Math.min(13, side * 0.16) * (0.65 + 0.35 * Math.sin(x / 13 + z / 17));
  return Math.max(back, rise);
}

function terrain(): BufferGeometry {
  const g = new Grid(1);
  const yardCovers = (x: number, z: number) => {
    if (x < YARD.minX + 1 || x >= YARD.maxX - 1 || z < -7 + 1 || z >= YARD.maxZ) return false;
    if (z >= BARN.minZ - 1 && z < BARN.maxZ + 1 && Math.abs(x) >= BARN.maxX + 1) return false;
    if (z < BARN.minZ && Math.abs(x) >= 13) return false;
    return true;
  };
  const paint = (x: number, y: number, z: number) => snowAt(x, y, z, 1, 71); // smooth drifts and grain (voxel/snow.ts): tones in squares drew squares on the land
  for (let x = -150; x < 150; x++)
    for (let z = -60; z < YARD.maxZ; z++) {
      if (yardCovers(x, z)) continue;
      if (z < -34 && Math.abs(x) < 100) continue; // the back hills stand there already
      const top = Math.round(landHeight(x, z));
      for (let y = Math.max(-1, top - 3); y < top; y++) g.set(x, y, z, paint(x, y, z));
      if (top <= 0) g.set(x, -1, z, paint(x, -1, z));
    }
  const land = detailed(g.map, 1, 0);
  const geo = dropFaces(buildGeometry(land.map, land.size), (ny) => ny < 0);
  geo.translate(0, -0.05, 0); // just under the yard's snow, so the two never share a plane
  return geo;
}

export function chunks(map: Grid['map'], size: number): BufferGeometry[] {
  const byChunk = new Map<string, ChunkMap>();
  for (const [k, v] of map) {
    const ck = `${Math.floor((v.x * size) / CHUNK)},${Math.floor((v.z * size) / CHUNK)}`;
    let m = byChunk.get(ck);
    if (!m) byChunk.set(ck, (m = new ChunkMap(map)));
    Map.prototype.set.call(m, k, v);
  }
  return [...byChunk.values()].map((m) => buildGeometry(m, size));
}

export interface Farmstead { fine: BufferGeometry[]; props: BufferGeometry[]; shell: BufferGeometry; terrain: BufferGeometry; triangles: number }

export function buildFarmstead(): Farmstead {
  const shell = barnShell();
  const big = new Builder(new Grid(S));
  barnRoof(big);
  silo(big);
  paddock(big);
  coop(big);
  orchard(big);
  // What the tour gets close to is refined to the barn's 0.1 m, and the tractor, seen closest of all, to 0.05 m. The field
  // and the trees past it stay on their 0.2 m grid: the camera never comes near them and the fog takes the rest.
  const near = detailed(big.g.map, S);
  const far = new Builder(new Grid(S));
  fieldAndTrees(far);
  const props = [...chunks(near.map, near.size), ...chunks(far.g.map, S)];
  const small = new Builder(new Grid(F));
  tractor(small);
  const close = detailed(small.g.map, F, 0.03);
  const litter = new Builder(new Grid(F));
  henYard(litter);
  const fine = [...chunks(close.map, close.size), ...chunks(litter.g.map, F)];
  const land = terrain();
  return { fine, props, shell, terrain: land, triangles: [shell, land, ...props, ...fine].reduce((n, g) => n + triangles(g), 0) };
}
