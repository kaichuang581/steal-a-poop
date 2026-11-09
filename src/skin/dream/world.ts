import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import type { Paint, RGB, V3 } from '../voxel/primitives';
import { letterMask } from '../voxel/table';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { dropFaces } from '../scene/yard';
import { CHUNK, FAR, ISLAND_TONES, RAFT, RAFT_TONES } from './stage';
import type { IslandKind } from './stage';

/**
 * The dream's world, built once (V4.1 Parts 5 and 6). Every object is axis-aligned voxels on the plan's grids.
 */
const S = 0.2;
const F = 0.1;

const RING = CHUNK.size * CHUNK.count;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Soft drifts on the far strip, in 0.10 m voxels: nothing on the lane or the near side, repeating with the ring. */
export function raftRise(x: number, z: number): number {
  if (z > RAFT.laneFar - 0.15) return 0;
  const fade = smooth((RAFT.laneFar - 0.15 - z) / 0.9);
  const w = (Math.PI * 2) / RING;
  const swell = 1.5 + Math.sin(x * w * 3 + z * 1.1) * 1.3 + Math.sin(x * w * 7 + 1 - z * 0.8) * 1.1;
  return Math.max(0, Math.round(swell * fade));
}

interface Lobe { x: number; y: number; z: number; r: number }
/** The near ridge's lobes along the whole ring: big ones overlapping by a third, small ones hanging below. */
function ridgeLobes(): Lobe[] {
  const r = rng(201), out: Lobe[] = [];
  for (let x = 0; x < RING; ) {
    const rad = 0.5 + r() * 0.4;
    out.push({ x, y: -0.35 - r() * 0.25, z: RAFT.nearZ + 0.1, r: rad });
    out.push({ x: x + (r() - 0.5) * 0.6, y: -1.05 - r() * 0.25, z: RAFT.nearZ + 0.15, r: 0.3 + r() * 0.1 });
    x += Math.min(1.3, Math.max(0.9, rad * 1.5));
  }
  return out;
}
/** The far edge's smaller lobes. */
function farLobes(): Lobe[] {
  const r = rng(301), out: Lobe[] = [];
  for (let x = 0; x < RING; ) {
    const rad = 0.3 + r() * 0.2;
    out.push({ x, y: -0.7 - r() * 0.15, z: RAFT.farZ - 0.2, r: rad });
    x += rad * 1.4;
  }
  return out;
}
/** Paints a set of lobes into a chunk, wrapping round the ring, and keeps them below the snow. */
function stampLobes(g: Grid, lobes: Lobe[], gx: number, top: RGB) {
  const x0 = 0, x1 = Math.round(CHUNK.size / g.size);
  for (const l of lobes) for (const wrap of [-RING, 0, RING]) {
    const cx = l.x + wrap - gx;
    if (cx < -l.r - 0.2 || cx > CHUNK.size + l.r + 0.2) continue;
    ellipsoid(g, [cx, l.y, l.z], [l.r, l.r * 0.82, l.r * 0.95], (x, y) => (x >= x0 && x < x1 && y < 0 ? top : null));
  }
}
const ridge = ridgeLobes(), farEdge = farLobes();

/**
 * One 4 m chunk of the raft (V4.1 Part 5.1), about x = 0..4: a snow top in one tone, the near ridge of cloud along the
 * bottom of the frame, the far edge dropping toward the sea. Shading comes from the light and the baked AO, not from
 * tone noise. The lane, its hoofprints and the small details (Part 5.2) are the chunk's 0.10 m mesh.
 */
export function raftChunk(index: number): BufferGeometry {
  const g = new Grid(S), f = new Grid(F);
  const gx = index * CHUNK.size;
  const snow = lin(RAFT_TONES.snow), lip = lin(RAFT_TONES.lip), cloud = lin(RAFT_TONES.ridge), crease = lin(RAFT_TONES.ridgeSide);
  const nx = Math.round(CHUNK.size / S), zNear = Math.round(RAFT.nearZ / S), zFar = Math.round(RAFT.farZ / S);
  const laneNear = Math.round(RAFT.laneNear / S), laneFar = Math.round(RAFT.laneFar / S);
  for (let x = 0; x < nx; x++) {
    for (let z = zFar; z < zNear; z++) {
      g.set(x, -2, z, snow);
      if (z < laneFar || z >= laneNear) g.set(x, -1, z, snow); // the lane's 0.10 m top sits in the gap
    }
    // The one-voxel lip where the snow meets the ridge, and a curtain of cloud behind the lobes.
    g.set(x, -1, zNear, lip);
    for (let y = -10; y < -1; y++) g.set(x, y, zNear - 1, cloud);
    // The far edge drops 0.6 m over two voxels.
    g.set(x, -2, zFar - 1, snow); g.set(x, -3, zFar - 1, snow); g.set(x, -3, zFar - 2, lip); g.set(x, -4, zFar - 2, lip);
  }
  // The lobes are on the 0.10 m grid, not the plan's 0.20 m: this close to the camera a 0.20 m voxel is 55 px, and a
  // lobe of radius 0.6 m reads as a flight of stairs.
  const lobes = new Grid(F);
  stampLobes(lobes, ridge, gx, cloud);
  stampLobes(lobes, farEdge, gx, cloud);
  // Creases: a cloud voxel with another above it and beside it takes the side tone, so the lobes read without noise.
  for (const v of lobes.map.values()) if (lobes.has(v.x, v.y + 2, v.z) && lobes.has(v.x, v.y - 1, v.z) && !lobes.has(v.x, v.y, v.z + 1)) v.c = crease;

  // ---- the 0.10 m mesh: the lane, its prints, and the far strip's details
  const lane = lin(RAFT_TONES.lane), pit = lin(RAFT_TONES.pit);
  const n = Math.round(CHUNK.size / F), lNear = Math.round(RAFT.laneNear / F), lFar = Math.round(RAFT.laneFar / F);
  for (let x = 0; x < n; x++) for (let z = lFar; z < lNear; z++) { f.set(x, -1, z, lane); f.set(x, -2, z, lane); }
  for (let x = 0, k = 0; x < n; x += 4, k++) { // a hoofprint every 0.4 m along the sheep's line
    const z = k % 2 ? 1 : -2;
    f.del(x, -1, z);
    f.set(x, -2, z, pit);
  }
  // The drifts on the far strip, one tone, stepping a voxel at a time.
  for (let x = 0; x < n; x++) for (let z = Math.round(RAFT.farZ / F); z < lFar; z++) {
    const h = raftRise(gx + (x + 0.5) * F, (z + 0.5) * F);
    for (let y = 0; y < h; y++) f.set(x, y, z, snow);
  }
  const scenery = scatter(index, gx);
  for (const [k, v] of lobes.map) if (!f.map.has(k)) f.map.set(k, v);
  // Every part goes through dropFaces so their attributes match, or the merge returns nothing.
  return mergeGeometries([dropFaces(buildGeometry(g.map, S), (ny, y) => ny < 0 && y > -1), dropFaces(buildGeometry(f.map, F), () => false), dropFaces(buildGeometry(scenery.map, D), () => false)], false)!;
}

const D = 0.05;
/** A snowy shrub: a few overlapping clumps of dark leaves, snow lying on the top of each. */
function shrub(g: Grid, x: number, y: number, z: number, r: () => number) {
  const leaf = T.pine.map(lin), snow = lin(T.snow[0]);
  for (let k = 0; k < 4; k++) {
    const rad = 0.12 + r() * 0.1, cx = x + (r() - 0.5) * 0.34, cz = z + (r() - 0.5) * 0.22, cy = y + rad * 0.7 + k * 0.03;
    ellipsoid(g, [cx, cy, cz], [rad, rad * 0.85, rad], (a, b, c) => leaf[Math.floor(hash3(a, b, c, 7) * 2.99)], 0.14, k + 3);
  }
  capSnow(g, snow);
}
/** Snow on everything facing up that has nothing above it, in this grid. */
function capSnow(g: Grid, snow: RGB, chance = 0.72) {
  const tops: [number, number, number][] = [];
  for (const v of g.map.values()) if (!g.has(v.x, v.y + 1, v.z) && hash3(v.x, v.y, v.z, 5) < chance) tops.push([v.x, v.y + 1, v.z]);
  for (const [x, y, z] of tops) g.set(x, y, z, snow);
}
/** A young pine, its branches in drooping tiers. */
function sapling(g: Grid, x: number, y: number, z: number, h: number) {
  const X = Math.round(x / D), Y = Math.round(y / D), Z = Math.round(z / D), H = Math.round(h / D);
  const bark = lin(T.trunk[1]), snow = lin(T.snow[0]), leaf = T.pine.map(lin);
  for (let i = 0; i < 3; i++) g.set(X, Y + i, Z, bark);
  for (let i = 2; i < H; i++) {
    const tier = (i - 2) % 4, r = Math.max(0, Math.round((1 - (i - 2) / (H - 2)) * (H * 0.26) - tier * 0.7));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      const edge = dx * dx + dz * dz >= (r - 1) * (r - 1);
      g.set(X + dx, Y + i - (edge && r > 1 ? 1 : 0), Z + dz, tier === 3 && hash3(dx, i, dz, 3) > 0.35 ? snow : leaf[Math.abs(dx + dz) % 3]);
    }
  }
  g.set(X, Y + H, Z, snow);
}
/** A rock with a cap of snow. */
function rock(g: Grid, x: number, y: number, z: number, r: () => number) {
  const side = lin(RAFT_TONES.rockSide), face = lin(RAFT_TONES.rock), snow = lin(T.snow[0]);
  const rad = 0.13 + r() * 0.09;
  ellipsoid(g, [x, y + rad * 0.45, z], [rad * 1.25, rad * 0.8, rad], (a, b, c) => (hash3(a >> 1, b >> 1, c >> 1, 2) > 0.5 ? face : side), 0.12, 4);
  ellipsoid(g, [x + rad * 0.9, y + rad * 0.2, z + 0.05], [rad * 0.6, rad * 0.45, rad * 0.55], () => side, 0.1, 6);
  capSnow(g, snow, 0.9);
}
/** Dry grass poking through the snow, each blade leaning its own way. */
function grass(g: Grid, x: number, y: number, z: number, r: () => number) {
  const tones = [lin('#7D8F5C'), lin(RAFT_TONES.grass), lin('#A6A36A')];
  for (let k = 0; k < 8; k++) {
    let X = Math.round((x + (r() - 0.5) * 0.3) / D), Z = Math.round((z + (r() - 0.5) * 0.2) / D);
    const Y = Math.round(y / D), h = 3 + Math.floor(r() * 3), lean = r() < 0.5 ? 1 : -1, c = tones[k % 3];
    for (let i = 0; i < h; i++) { g.set(X, Y + i, Z, c); if (i === h - 2) X += lean; }
  }
}
/** Three winter flowers on stems. */
function flowers(g: Grid, x: number, y: number, z: number, r: () => number) {
  const stem = lin(RAFT_TONES.grass), petal = lin(r() < 0.5 ? RAFT_TONES.flowerA : RAFT_TONES.flowerB), eye = lin(T.lantern[1]);
  for (let k = 0; k < 3; k++) {
    const X = Math.round((x + (k - 1) * 0.11) / D), Z = Math.round((z + (r() - 0.5) * 0.14) / D), Y = Math.round(y / D), h = 3 + (k % 2) * 2;
    for (let i = 0; i < h; i++) g.set(X, Y + i, Z, stem);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(X + dx, Y + h, Z + dz, petal);
    g.set(X, Y + h, Z, eye);
  }
}
/** An old stump, low and rounded, rings on its cut top under a little snow. */
function stump(g: Grid, x: number, y: number, z: number) {
  const X = Math.round(x / D), Y = Math.round(y / D), Z = Math.round(z / D), bark = [lin('#8A6A4C'), lin('#74563C'), lin('#5F4630')], ring = lin(T.hay[1]), snow = lin(T.snow[0]);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const d = dx * dx + dz * dz;
    if (d > 6) continue;
    const h = 2 + (d < 3 ? 1 : 0);
    for (let i = 0; i < h; i++) g.set(X + dx, Y + i, Z + dz, bark[(Math.abs(dx * 2 + dz) + (i >> 1)) % 3]);
    g.set(X + dx, Y + h, Z + dz, d > 3 ? bark[2] : ring);
    if (hash3(dx, 5, dz, 9) > 0.5) g.set(X + dx, Y + h + 1, Z + dz, snow);
  }
}
/** The far strip's planting for one chunk: a few real things, not specks. */
function scatter(index: number, gx: number): Grid {
  const g = new Grid(D), r = rng(601 + index * 7);
  const makers = ['shrub', 'grass', 'sapling', 'rock', 'grass', 'flowers', 'shrub', 'stump'] as const;
  for (let x = 0.3 + r() * 0.3; x < CHUNK.size - 0.25; x += 0.95 + r() * 0.5) {
    const z = -1.75 - r() * 1.05, y = raftRise(gx + x, z) * F;
    const what = makers[Math.floor(r() * makers.length)], one = new Grid(D);
    if (what === 'shrub') shrub(one, x, y, z, r);
    if (what === 'sapling') sapling(one, x, y, z, 0.55 + r() * 0.3);
    if (what === 'rock') rock(one, x, y, z, r);
    if (what === 'grass') grass(one, x, y, z, r);
    if (what === 'flowers') flowers(one, x, y, z, r);
    if (what === 'stump') stump(one, x, y, z);
    for (const [k, v] of one.map) g.map.set(k, v);
  }
  return g;
}

/** The cloud sea (V4.1 Part 5.1): a bank of soft lobes from behind the raft to the foot of the hills, rising as it goes. */
export const SEA = { near: -12, far: -50, period: 64, factor: 0.3 } as const;
export function cloudSea(phone = false): BufferGeometry {
  const r = rng(501);
  // A phone sees the whole bank at once, so it gets a coarser one.
  const cell = phone ? 0.4 : 0.2, far = phone ? 1 : 0.5, split = -17;
  const build = (size: number, zNear: number, zFar: number) => {
    const nx = Math.round(SEA.period / size), nz = Math.round((zNear - zFar) / size);
    const H = new Float32Array(nx * nz).fill(-9), T2 = new Uint8Array(nx * nz);
    return { size, nx, nz, zFar, H, T2 };
  };
  const parts = [build(cell, SEA.near, split), build(far, split, SEA.far)];
  const lobes: { x: number; z: number; r: number }[] = [];
  for (let z = SEA.near + 1; z > SEA.far - 2; z -= 1.7) for (let x = 0; x < SEA.period; x += 2.2 + r() * 1.3) lobes.push({ x: x + r() * 1.2, z: z + (r() - 0.5) * 1.4, r: 1.1 + r() * 1.3 });
  const rise = (z: number) => -1.2 + 2.7 * smooth((SEA.near - z) / (SEA.near - SEA.far));
  for (const p of parts) for (const l of lobes) for (const wrap of [-SEA.period, 0, SEA.period]) {
    const cx = l.x + wrap, top = rise(l.z);
    for (let i = Math.floor((cx - l.r) / p.size); i <= Math.ceil((cx + l.r) / p.size); i++) {
      if (i < 0 || i >= p.nx) continue;
      for (let k = Math.floor((l.z - l.r * 0.8 - p.zFar) / p.size); k <= Math.ceil((l.z + l.r * 0.8 - p.zFar) / p.size); k++) {
        if (k < 0 || k >= p.nz) continue;
        const dx = ((i + 0.5) * p.size - cx) / l.r, dz = (p.zFar + (k + 0.5) * p.size - l.z) / (l.r * 0.8), d = dx * dx + dz * dz;
        if (d > 1) continue;
        const h = top + Math.sqrt(1 - d) * l.r * 0.66, j = i * p.nz + k;
        if (h > p.H[j]) { p.H[j] = h; p.T2[j] = d > 0.72 ? 1 : 0; }
      }
    }
  }
  const out: BufferGeometry[] = [];
  for (const p of parts) {
    const g = new Grid(p.size), z0 = Math.round(p.zFar / p.size);
    const top = lin(RAFT_TONES.sea), side = lin(RAFT_TONES.seaSide);
    const at = (i: number, k: number) => (k < 0 || k >= p.nz ? -9 : p.H[((i + p.nx) % p.nx) * p.nz + k]);
    for (let i = 0; i < p.nx; i++) for (let k = 0; k < p.nz; k++) {
      const h = Math.round((p.H[i * p.nz + k] > -9 ? p.H[i * p.nz + k] : rise(p.zFar + k * p.size) - 0.3) / p.size);
      const lowest = Math.round(Math.min(at(i - 1, k), at(i + 1, k), at(i, k + 1), at(i, k - 1), p.H[i * p.nz + k]) / p.size) - 1;
      for (let y = Math.max(lowest, h - 6); y <= h; y++) g.set(i, y, z0 + k, y === h && !p.T2[i * p.nz + k] ? top : side);
    }
    out.push(dropFaces(buildGeometry(g.map, p.size), (ny) => ny < 0));
  }
  return mergeGeometries(out, false)!;
}

// ---------- the islands (V4.1 Part 6) ----------
export interface IslandGeo { body: BufferGeometry; props?: BufferGeometry; glow?: BufferGeometry }
/** A small snow pine on the 0.10 m grid, standing on y = 0 at (x, z). */
function littlePine(g: Grid, x: number, z: number, h: number) {
  const trunk = lin(T.trunk[1]), needles = lin(T.pine[1]), dark = lin(T.pine[2]), snow = lin(T.snow[0]);
  const X = Math.round(x / F), Z = Math.round(z / F), H = Math.round(h / F);
  for (let y = 0; y < 3; y++) g.set(X, y, Z, trunk);
  for (let y = 2; y < H; y++) {
    const r = Math.max(0, Math.round((1 - (y - 2) / (H - 2)) * (H * 0.28) * (0.75 + 0.25 * ((y % 3) / 2))));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      const bauble = hash3(dx, y, dz, 77); // the festive season's baubles (v0.3.0)
      g.set(X + dx, y, Z + dz, y % 3 === 0 ? snow : bauble > 0.9 ? lin(bauble > 0.95 ? T.collar[0] : T.lantern[0]) : (dx + dz) % 2 ? needles : dark);
    }
  }
  g.set(X, H, Z, snow);
}
/**
 * An island: a flat snow top in one tone, on a cloud underside of lobes shrinking toward the bottom, with no noise on
 * either. Built about its centre with the snow top at y = 0.
 */
export function island(kind: IslandKind, across: number, tall: number, seed: number): IslandGeo {
  const g = new Grid(F), p = new Grid(F), glow = new Grid(F);
  const r = rng(seed * 13);
  const rx = across / 2, rz = rx * 0.62;
  const snow = lin(ISLAND_TONES.snow), cloud = lin(ISLAND_TONES.cloud), crease = lin(ISLAND_TONES.crease);
  for (let x = Math.floor(-rx / F); x <= Math.ceil(rx / F); x++) for (let z = Math.floor(-rz / F); z <= Math.ceil(rz / F); z++) {
    if (((x + 0.5) * F / rx) ** 2 + ((z + 0.5) * F / rz) ** 2 <= 1) { g.set(x, -1, z, snow); g.set(x, -2, z, snow); }
  }
  const under: Paint = (_x, y) => (y >= -2 ? null : cloud);
  ellipsoid(g, [0, -tall * 0.2, 0], [rx * 0.98, tall * 0.34, rz * 0.98], under);
  const lobes = 4 + Math.floor(r() * 3);
  for (let k = 0; k < lobes; k++) {
    const a = (k / lobes) * Math.PI * 2 + r(), t = 0.4 + 0.3 * (k % 2);
    ellipsoid(g, [Math.cos(a) * rx * 0.6 * (1 - t * 0.5), -tall * t, Math.sin(a) * rz * 0.5], [rx * 0.42, tall * 0.26, rz * 0.5], under);
  }
  ellipsoid(g, [0, -tall * 0.68, 0], [rx * 0.42, tall * 0.34, rz * 0.5], under);
  for (const v of g.map.values()) if (v.y < -2 && g.has(v.x, v.y + 3, v.z) && !g.has(v.x, v.y, v.z + 1) && !g.has(v.x + 1, v.y - 1, v.z)) v.c = crease;
  const wood = lin(T.beam[1]), iron = lin(T.face[1]);
  if (kind === 'pine-lantern') {
    littlePine(p, -rx * 0.34, 0, 1.2);
    const X = Math.round((rx * 0.42) / F);
    for (let y = 0; y < 8; y++) p.set(X, y, 0, iron);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { p.set(X + dx, 11, dz, iron); p.set(X + dx, 12, dz, lin(T.snow[0])); glow.set(X + dx, 9, dz, lin('#FFB45A')); glow.set(X + dx, 10, dz, lin('#FFB45A')); }
    for (let dx = -1; dx <= 1; dx += 2) p.set(X + dx, 8, 0, iron);
    p.set(X, 8, 0, iron);
  }
  if (kind === 'bench') {
    for (let x = -4; x <= 4; x++) { p.set(x, 2, 2, wood); p.set(x, 3, 2, lin(T.snow[0])); p.set(x, 3, 1, wood); p.set(x, 4, 1, wood); p.set(x, 5, 1, lin(T.snow[0])); }
    for (const x of [-4, 4]) for (let y = 0; y < 2; y++) p.set(x, y, 2, wood);
    const X = Math.round((rx * 0.6) / F);
    for (let y = 0; y < 8; y++) p.set(X, y, -1, wood);
    for (let x = X - 2; x <= X + 2; x++) { p.set(x, 7, -1, lin(T.beam[0])); p.set(x, 6, -1, lin(T.beam[0])); p.set(x, 8, -1, lin(T.snow[0])); }
  }
  return { body: buildGeometry(g.map, F), props: p.map.size ? buildGeometry(p.map, F) : undefined, glow: glow.map.size ? buildGeometry(glow.map, F) : undefined };
}
/** A wisp: a thin lobe 2.5 x 0.3 m in one light tone. */
export function wisp(seed: number): BufferGeometry {
  const g = new Grid(F), c = lin(ISLAND_TONES.wisp), r = rng(seed * 17);
  ellipsoid(g, [0, 0, 0], [1.25, 0.15, 0.3], () => c);
  ellipsoid(g, [0.5 + r() * 0.3, 0.08, 0.1], [0.6, 0.11, 0.2], () => c);
  return buildGeometry(g.map, F);
}

// ---------- the far ranges (V4.1 Part 5.4) ----------
const TAU = Math.PI * 2;
/** The hills: 0.5 m voxels, one period of `HILLS.period` metres, so the strip can wrap without a seam. */
export const HILLS = { near: -50, far: -58, period: 160, cap: 6.2 } as const;
export function hillHeight(x: number): number {
  const p = HILLS.period;
  return 5.5 + 0.8 * Math.sin((TAU * 13 * x) / p + 0.3) + 0.5 * Math.sin((TAU * 37 * x) / p + 4.1) + 0.25 * Math.sin((TAU * 76 * x) / p);
}
/** The mountains: 1 m voxels on the same plan. */
export const MOUNTAINS = { near: -100, far: -120, period: 200, cap: 16.6 } as const;
export function mountainHeight(x: number): number {
  const p = MOUNTAINS.period;
  return 16.2 + 1.6 * Math.sin((TAU * 5 * x) / p + 1.4) + 1.1 * Math.sin((TAU * 11 * x) / p + 2) + 0.5 * Math.sin((TAU * 25 * x) / p);
}

/**
 * A closed range: each row toward the camera a little lower than the one behind, so the front climbs in terraces and
 * the crest stays on the back row. Its base sits below the cloud sea. `span` is how far it runs either side of x = 0.
 */
function range(size: number, near: number, far: number, span: number, base: number, h: (x: number) => number, paint: (y: number, top: number) => RGB, drop: number) {
  const g = new Grid(size);
  const rows = Math.round((near - far) / size);
  for (let xi = Math.round(-span / size); xi < Math.round(span / size); xi++) {
    const crest = h((xi + 0.5) * size);
    for (let row = 0; row < rows; row++) {
      const zi = Math.round(far / size) + row;
      const t = row / Math.max(1, rows - 1);
      const top = Math.round((crest - t * drop * crest) / size);
      const below = row === 0 ? Math.round(base / size) : Math.round((crest - (t - 1 / rows) * drop * crest - size * 2) / size) - 2;
      for (let y = Math.min(below, top - 1); y < top; y++) g.set(xi, y, zi, paint(y * size, top * size));
    }
  }
  return dropFaces(buildGeometry(g.map, size), (ny) => ny < 0);
}

export function hills(): BufferGeometry {
  return range(0.5, HILLS.near, HILLS.far, 120, -3, hillHeight, (y) => lin(y >= HILLS.cap ? FAR.hillCap : FAR.hillSide), 0.3);
}
export function mountains(): BufferGeometry {
  return range(1, MOUNTAINS.near, MOUNTAINS.far, 170, -3, mountainHeight, (y) => lin(y >= MOUNTAINS.cap ? FAR.mountainCap : FAR.mountain), 0.25);
}

// ---------- fences and signs (Part 7.3), on the 0.10 m grid ----------
const wood: Paint = (x, y, z) => pick(T.beam, hash3(x, y, z, 17), [0.45, 0.85]);
/** What a position looks like: the rules only know fences and bales, the night's walls and logs are for the eye. */
export type ObstacleLook = 'rail' | 'picket' | 'wall' | 'log' | 'bale';
export const FENCE_LOOKS = ['rail', 'picket', 'wall', 'log'] as const;
export function lookOf(kind: 'fence' | 'bale', index: number): ObstacleLook {
  if (kind === 'bale') return 'bale';
  return index === 0 ? 'rail' : FENCE_LOOKS[Math.floor(hash3(index, 3, 1, 77) * FENCE_LOOKS.length)];
}
const HALF = 1.1; // every obstacle crosses the whole lane
const zs = (g: Grid) => [Math.round(-HALF / g.size), Math.round(HALF / g.size)] as const;

/** A split-rail fence across the lane: rough posts, three rails each its own tone, snow along the tops. */
function railFence(): BufferGeometry {
  const g = new Grid(D), [z0, z1] = zs(g), tones = T.beam.map(lin), snow = lin(T.snow[0]);
  for (const z of [z0, 0, z1 - 1]) for (let x = -1; x <= 1; x++) for (let dz = 0; dz < 2; dz++) for (let y = 0; y < 12; y++) g.set(x, y, z + dz, tones[hash3(x, y >> 1, z, 4) > 0.5 ? 1 : 2]);
  [[3, 4], [6, 7], [9, 10]].forEach(([a, b], k) => {
    for (let z = z0; z < z1; z++) {
      const sag = Math.abs(((z - z0) % 22) - 11) < 4 && k === 1 ? -1 : 0;
      // The top rail is a candy cane, for the season (v0.3.0).
      const cane = k === 2 ? lin((z >> 2) % 2 ? T.collar[0] : T.snow[1]) : null;
      for (const y of [a, b]) for (const x of [-2, 2]) g.set(x, y + sag, z, cane ?? tones[(z >> 3) % 2 ? 0 : 1]);
    }
  });
  capSnow(g, snow, 0.85);
  return buildGeometry(g.map, D);
}
/** A white picket fence, pointed tops, two stringers behind. */
function picketFence(): BufferGeometry {
  const g = new Grid(D), [z0, z1] = zs(g), paint = [lin('#EFE8DA'), lin('#E2DAC9')], rail = lin(T.beam[1]), snow = lin(T.snow[0]);
  for (let z = z0; z < z1; z++) for (const y of [3, 8]) g.set(-1, y, z, rail);
  for (let z = z0, k = 0; z < z1; z += 3, k++) {
    const h = 10 + (k % 2);
    for (let dz = 0; dz < 2; dz++) for (let y = 0; y < h; y++) g.set(0, y, z + dz, paint[(k + dz) % 2]);
    g.set(0, h, z, paint[0]);
  }
  capSnow(g, snow, 0.8);
  return buildGeometry(g.map, D);
}
/** A dry stone wall: three courses of rounded stones, gaps in the joints, snow on the top. */
function stoneWall(): BufferGeometry {
  const g = new Grid(D), [z0, z1] = zs(g), tones = T.stone.map(lin), snow = lin(T.snow[0]);
  for (let course = 0; course < 3; course++) {
    for (let z = z0 - (course % 2) * 3, k = 0; z < z1; k++) {
      const len = 5 + Math.floor(hash3(k, course, 1, 3) * 4), h = 3 + (hash3(k, course, 2, 3) > 0.5 ? 1 : 0), c = tones[Math.floor(hash3(k, course, 3, 3) * 2.99)];
      for (let dz = 0; dz < len - 1; dz++) for (let y = 0; y < h; y++) for (let x = -2; x <= 2; x++) {
        const corner = (dz === 0 || dz === len - 2) && (y === h - 1 || Math.abs(x) === 2);
        if (corner || z + dz < z0 || z + dz >= z1) continue;
        g.set(x, course * 4 + y, z + dz, c);
      }
      z += len;
    }
  }
  capSnow(g, snow, 0.8);
  return buildGeometry(g.map, D);
}
/** A round section along z: bark or straw round the outside, and its end facing the camera. */
function roundAlongZ(g: Grid, r: number, z0: number, z1: number, side: (a: number, y: number, z: number) => RGB, end: (d: number, a: number) => RGB) {
  for (let x = -r - 1; x <= r + 1; x++) for (let y = 0; y <= r * 2 + 1; y++) {
    const d = Math.hypot(x + 0.5 - 0.5, y + 0.5 - r - 0.5);
    if (d > r + 0.3) continue;
    const a = Math.atan2(y - r, x);
    for (let z = z0; z < z1; z++) g.set(x, y, z, z === z1 - 1 || z === z0 ? end(d, a) : side(a, y, z));
  }
}
/** A fallen log across the lane, its cut end ringed, snow along its back. */
function fallenLog(): BufferGeometry {
  const g = new Grid(D), [z0, z1] = zs(g), bark = T.trunk.map(lin), cut = [lin('#D8B98A'), lin('#B9925F')], snow = lin(T.snow[0]);
  roundAlongZ(g, 5, z0, z1, (a, y, z) => bark[Math.floor(hash3(Math.round(a * 3), y >> 2, z >> 2, 8) * 2.99)], (d) => cut[Math.floor(d) % 2]);
  for (let z = -6; z < -2; z++) for (let y = 7; y < 12; y++) g.set(-6 - (y - 7), y, z, bark[1]); // a broken branch
  capSnow(g, snow, 0.9);
  return buildGeometry(g.map, D);
}
/** Two round hay bales end to end across the lane, the spiral of the roll on the end, twine round the middle. */
function roundBales(): BufferGeometry {
  const g = new Grid(D), hay = T.hay.map(lin), twine = lin(T.hay[2]), snow = lin(T.snow[0]);
  for (const [z0, z1] of [[-22, -1], [1, 22]]) {
    roundAlongZ(g, 5, z0, z1, (a, y, z) => ((z - z0) % 7 === 3 ? twine : hay[Math.floor(hash3(Math.round(a * 4), y, z >> 2, 6) * 2.2)]), (d, a) => hay[(Math.floor(d + a / (Math.PI * 2) * 2) + 3) % 2 ? 0 : 2]);
  }
  capSnow(g, snow, 0.75);
  return buildGeometry(g.map, D);
}
const OBSTACLES: Partial<Record<ObstacleLook, BufferGeometry>> = {};
export function obstacle(look: ObstacleLook): BufferGeometry {
  return (OBSTACLES[look] ??= look === 'rail' ? railFence() : look === 'picket' ? picketFence() : look === 'wall' ? stoneWall() : look === 'log' ? fallenLog() : roundBales());
}
// ---------- the fence sign (V6 Part 5.1): letters carved into a plank hung on ropes from a post and crossbar ----------
/**
 * The sign's cell (m) for `n` letters: 0.02 m, as fine as the table's letter board, so the letters are the title's own
 * face (Fraunces) cut into the plank rather than a 5 x 7 bitmap; five letters and more shrink the board a little.
 */
export const signCell = (n: number) => (n >= 5 ? 0.0175 : 0.02);
/** A letter's height in cells (0.28 m at 0.02 m, the old signs' cap height, so the readability gate holds). */
export const SIGN_GLYPH_H = 14;
/** Each letter has a slot this wide, centred in it, so a sign's width depends only on how many letters it has. */
const SIGN_SLOT = 14;
/** After the letters: a space and three dots (`GR…`: the word starts with them and goes on; Brian, 2026-11-09). */
const SIGN_TAIL = 12;
/** The letters' baseline, in cells from the board's bottom edge (the dots sit on it). */
export const SIGN_BASE = 4;
/** The board in cells: the letter slots, the gaps, and a margin each side; the letters with four cells above and below. */
export const signCells = (n: number) => ({ w: n * SIGN_SLOT + SIGN_TAIL + 12, h: SIGN_GLYPH_H + 8 });
export function signWidth(n: number): number {
  return signCells(n).w * signCell(n);
}
/**
 * Where the parts sit, in the sign's frame (the post's base at the origin, the camera at +z). The board's centre is at
 * the height the dream camera was tuned for (the old letters' 0.80 m), so the crossbar's underside is a rope's length
 * above the board: the post is 1.1 m with the crossbar on top, a little over the plan's 1.0 m.
 */
export const SIGN = { centre: 0.8, post: 11, pivot: 1.1, boardZ: 0.1, x: 0.05 } as const;
/** The letters' cap height in metres, for the readability gate (V6 Part 7.5). */
export const signCap = (n: number) => SIGN_GLYPH_H * signCell(n);

export interface FenceSignGeo {
  /** Post, crossbar, snow, icicle and the lantern's iron, about the post's base. */
  post: BufferGeometry;
  /** The plank, its rim, nails, snow and ropes, about the crossbar's underside (the swing's pivot). */
  board: BufferGeometry;
  /** The paint in the bottom of each carved letter, about the same pivot. */
  letters: BufferGeometry;
  /** The lantern's glass, lit on the active sign. */
  lantern: BufferGeometry;
  /** Where the lantern's light goes, about the post's base. */
  lanternAt: V3;
}

/** The glyph cells of a sign's letters, in board cells (x from the board's left edge, y from its bottom). */
export function signGlyphCells(letters: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let x = 6;
  letters.forEach((ch, i) => {
    const mask = letterMask(ch, SIGN_GLYPH_H), w = mask[0]?.length ?? 0;
    const x0 = x + Math.floor((SIGN_SLOT - w) / 2);
    mask.forEach((row, r) => row.forEach((on, c) => { if (on) out.push({ x: x0 + c, y: SIGN_BASE + (SIGN_GLYPH_H - 1 - r) }); }));
    x += SIGN_SLOT;
    // After the last letter, three square dots on the baseline, two cells each: the rest of the word.
    if (i === letters.length - 1) for (const dx of [1, 4, 7]) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) out.push({ x: x + dx + a, y: SIGN_BASE + b });
  });
  return out;
}

/**
 * The board's cells: `wood` front and back layers with the letters cut through the front, `ink` the floor of each cut,
 * painted cream as the table's letter board is. Two planks with a groove between them, a darker rim, bevelled top
 * corners, brass nails, snow along the top and the two ropes.
 */
export function signBoardCells(letters: readonly string[]): { wood: Grid; ink: Grid; w: number; h: number } {
  const n = Math.max(1, letters.length), c = signCell(n), { w: W, h: H } = signCells(n);
  const beam = T.beam.map(lin), snow = lin(T.snow[0]), cream = lin('#F3E7CC');
  const glyph = new Set(signGlyphCells(letters).map((v) => `${v.x},${v.y}`));
  const b = new Grid(c), ink = new Grid(c);
  const tones = [lin('#93653F'), lin('#8A5D39')];
  const seamY = Math.floor(H / 2);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const fromTop = H - 1 - y, edge = Math.min(x, W - 1 - x);
    if (fromTop + edge < 2) continue; // the top corners bevelled off
    const rim = x === 0 || y === 0 || x === W - 1 || fromTop === 0 || fromTop + edge === 2;
    // Grain along each plank: one tone per plank, each row a few percent lighter or darker.
    const base = tones[y < seamY ? 0 : 1], f = 0.94 + 0.1 * hash3(y, x >> 3, 0, 23);
    const face: RGB = rim ? beam[2] : [base[0] * f, base[1] * f, base[2] * f];
    b.set(x, y, 0, face);
    // A letter is a hole one cell deep: the front layer is left empty and its floor, in the back layer, is painted.
    if (glyph.has(`${x},${y}`)) { b.del(x, y, 0); ink.set(x, y, 0, cream); continue; }
    if (y === seamY && !rim) continue; // the groove between the planks
    b.set(x, y, 1, face);
  }
  // Two brass nails in from the rim at the top corners, standing proud.
  for (const x of [2, W - 3]) b.set(x, H - 3, 2, lin(T.brass[1]));
  // Snow along the top with gaps, and the two ropes up to the crossbar from the top corners.
  for (let x = 1; x < W - 1; x++) if (hash3(x, H, 0, 41) > 0.3) { b.set(x, H, 0, snow); b.set(x, H, 1, snow); }
  for (const x of [2, W - 3]) for (let y = H; y < H + 4; y++) b.set(x, y, 0, lin(T.hay[2]));
  return { wood: b, ink, w: W, h: H };
}

const signs = new Map<string, FenceSignGeo>();
export function fenceSign(letters: readonly string[]): FenceSignGeo {
  // A sign built before the display face loaded used the bitmap fallback; build it again once the face is in.
  const key = letters.join('') + (typeof document !== 'undefined' && document.fonts?.check('800 100px Fraunces') ? ':f' : '');
  const hit = signs.get(key);
  if (hit) return hit;
  const n = Math.max(1, letters.length), c = signCell(n);
  const { wood: b, ink, w: W, h: H } = signBoardCells(letters);
  const beam = T.beam.map(lin), snow = lin(T.snow[0]);
  // About the pivot: the board's centre at SIGN.centre, its back against the post's front.
  const shift = (g: BufferGeometry) => g.translate(SIGN.x - (W / 2) * c, SIGN.centre - (H / 2) * c - SIGN.pivot, SIGN.boardZ);
  const board = shift(buildGeometry(b.map, c));
  const letters3d = shift(buildGeometry(ink.map, c));

  // ---- the post and crossbar on the 0.10 m grid; the crossbar reaches past the board, so the ropes hang straight and the lantern hangs clear
  const p = new Grid(F);
  const k = Math.ceil((W * c) / 2 / F);
  for (let y = 0; y < SIGN.post; y++) p.set(0, y, 0, wood(0, y, 0)!);
  for (let x = -k - 1; x <= k + 2; x++) for (const z of [0, 1]) {
    p.set(x, SIGN.post, z, beam[(x & 1) || z ? 1 : 0]);
    if (hash3(x, SIGN.post, z, 9) > 0.25) p.set(x, SIGN.post + 1, z, snow);
  }
  const post = buildGeometry(p.map, F);

  // ---- the lantern off the crossbar's other end, on the 0.05 m grid: a hook, an iron cap and base, glass between
  const iron = new Grid(D), glass = new Grid(D), dark = lin(T.face[1]);
  const lx = Math.round(((k + 3) * F) / D) - 2, top = Math.round((SIGN.post * F) / D), lz = 2;
  iron.set(lx, top - 1, lz, dark);
  // An icicle off the crossbar's camera side, at the end away from the lantern.
  const ix = Math.round((-k - 1) * F / D) + 1;
  for (let y = 1; y <= 3; y++) iron.set(ix, top - y, 3, lin(T.ice[y - 1]));
  for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) {
    iron.set(lx + dx, top - 2, lz + dz, dark);
    iron.set(lx + dx, top - 6, lz + dz, dark);
    for (let y = top - 5; y <= top - 3; y++) glass.set(lx + dx, y, lz + dz, lin(T.lantern[(dx + dz + y) % 2]));
  }
  const out: FenceSignGeo = {
    post: mergeGeometries([post, buildGeometry(iron.map, D)], false)!,
    board, letters: letters3d, lantern: buildGeometry(glass.map, D),
    lanternAt: [(lx + 1) * D, (top - 4) * D, (lz + 1) * D + 0.15],
  };
  signs.set(key, out);
  return out;
}
/** A flat shadow disc 0.5 x 0.3 m on the 0.04 m grid, about its centre, for the sheep and the fences. */
export function shadowDisc(w = 0.5, d = 0.3): BufferGeometry {
  const g = new Grid(0.04);
  ellipsoid(g, [0, 0, 0], [w / 2, 0.02, d / 2], () => lin(T.hoof[2]));
  return buildGeometry(g.map, 0.04);
}

/** Three small stars for the bonk, 0.04 m voxels in the lantern tone, built about their orbit's centre. */
export function bonkStar(): BufferGeometry {
  const g = new Grid(0.04);
  for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x, y, 0, lin(T.lantern[0]));
  return buildGeometry(g.map, 0.04);
}

export type { V3 };
