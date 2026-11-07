import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import type { Paint, RGB, V3 } from '../voxel/primitives';
import { GLYPH, paintGlyph } from '../voxel/table';
import { CHUNK, HILLS, LANE, MOUNTAINS, SEA } from './stage';

/**
 * The dream's world, built once (V4 Parts 5.3 and 6): lane chunks on a ring, the cloud ridge and sea, hills and
 * mountains, six islands, wisps, the fence and its sign. Every object is axis-aligned voxels on the plan's grids:
 * 0.10 m for fences and signs, 0.20 m for the lane, the ridge and the islands, 1 m for hills, 3 m for mountains.
 */
const S = 0.2;
const cloud: Paint = (x, y, z) => pick(T.cloud, hash3(x >> 1, y >> 1, z >> 1, 9), [0.6, 0.92]);
const snowTone: Paint = (x, y, z) => pick(T.snow, hash3(x >> 2, y, z >> 2, 2), [0.6, 0.97]);
const pathTone: Paint = (x, y, z) => pick(T.path, hash3(x, y, z, 5), [0.5, 0.85]);

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smooth 2D value noise in 0..1 (the distance layer's). */
function vnoise(x: number, z: number, seed: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = smooth(x - xi), w = smooth(z - zi);
  const h = (a: number, b: number) => hash3(a, 0, b, seed);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), w);
}

/** Cloud lobes along a line, overlapping by a third, drawn so a tile of `period` metres repeats without a seam. */
function lobeRow(g: Grid, seed: number, x0: number, x1: number, z: number, y: [number, number], r: [number, number], period: number, keep: (xi: number) => boolean) {
  const rr = rng(seed);
  for (let x = x0; x < x1; ) {
    const rad = r[0] + rr() * (r[1] - r[0]);
    const cy = y[0] + rr() * (y[1] - y[0]);
    const cz = z + (rr() - 0.5) * 0.4;
    for (const dx of [-period, 0, period]) {
      const tmp = new Grid(g.size);
      ellipsoid(tmp, [x + dx, cy, cz], [rad, rad * 0.75, rad * 0.9], cloud, 0.12, seed + Math.round(x * 10));
      for (const v of tmp.map.values()) if (keep(v.x) && v.y < 0 && !g.has(v.x, v.y, v.z)) g.set(v.x, v.y, v.z, v.c);
    }
    // Smaller lobes hang under the big ones.
    const under = rad * 0.4;
    for (const dx of [-period, 0, period]) {
      const tmp = new Grid(g.size);
      ellipsoid(tmp, [x + dx + (rr() - 0.5) * rad, cy - rad * 0.7, cz + (rr() - 0.5) * 0.3], [under, under * 0.8, under], cloud, 0.1, seed + 7);
      for (const v of tmp.map.values()) if (keep(v.x) && v.y < 0 && !g.has(v.x, v.y, v.z)) g.set(v.x, v.y, v.z, v.c);
    }
    x += rad * 1.33;
  }
}

/**
 * One 4 m chunk of the island top (Part 6.3): snow rolling 0.25 m over a 6 m period, a flat trampled lane with
 * hoofprints, tufts, flowers, rocks and sparkle, the near edge lipped and ridged with cloud. Built about x = 0..4.
 */
export function laneChunk(index: number): BufferGeometry {
  const g = new Grid(S);
  const seed = 101 + index;
  const x0 = 0, x1 = CHUNK.size;
  const gx = index * CHUNK.size; // the chunk's place on the ring, so the noise continues across chunks
  const xi0 = Math.round(x0 / S), xi1 = Math.round(x1 / S), zi0 = Math.round(LANE.farZ / S), zi1 = Math.round(LANE.nearZ / S);
  const half = LANE.width / 2;
  for (let xi = xi0; xi < xi1; xi++) for (let zi = zi0; zi < zi1; zi++) {
    const xm = gx + (xi + 0.5) * S, zm = (zi + 0.5) * S;
    const onLane = Math.abs(zm) < half;
    const h = onLane ? 0 : (vnoise(xm / 6, zm / 6, 3) - 0.5) * 0.12;
    const top = Math.round(h / S); // the top voxel's index + 1
    for (let y = top - 3; y < top; y++) g.set(xi, y, zi, (onLane ? pathTone : snowTone)(xi, y, zi)!);
    if (onLane && Math.abs(zm) < 0.3 && Math.round(xm / 0.4) * 0.4 > xm - S / 2 && Math.round(xm / 0.4) * 0.4 <= xm + S / 2 && (Math.round(xm / 0.4) % 2 === 0) === (zm > 0)) {
      g.del(xi, top - 1, zi);
      g.set(xi, top - 2, zi, lin(T.path[2]));
    }
    // The near edge's one-voxel lip.
    if (zi === zi1 - 1) g.set(xi, top - 1, zi, lin(T.snow[2]));
  }
  // Tufts every 1.5 m, a flower every 4 m, a rock every 9 m, sparkle.
  const r = rng(seed * 3);
  const put = (xm: number, zm: number, c: RGB, up = 0) => {
    const xi = Math.round(xm / S), zi = Math.round(zm / S);
    let y = 3; while (y > -6 && !g.has(xi, y, zi)) y--;
    g.set(xi, y + 1 + up, zi, c);
  };
  for (let k = 0; k < 3; k++) {
    const xm = (k * 1.5 + ((gx / 1.5) % 1.5) + r() * 0.3) % x1, zm = (r() < 0.5 ? 1 : -1) * (half + 0.3 + r() * 1.4);
    if (Math.abs(zm) < -LANE.farZ - 0.4) for (let i = 0; i < 3; i++) put(xm + (i - 1) * S, zm, lin(T.pine[i % 2]), i === 1 ? 1 : 0);
  }
  if (index % 1 === 0 && (gx % 4) === 0) put(1.2 + r() * 1.5, -(half + 0.6 + r() * 1.2), lin(r() < 0.5 ? T.pink[0] : T.lantern[0]));
  if (index % 2 === 1) { const xm = 1 + r() * 2, zm = -(half + 0.8); ellipsoid(g, [xm, 0.1, zm], [0.2, 0.18, 0.2], (x, y, z) => pick(T.stone, hash3(x, y, z, 4), [0.5, 0.85]), 0.2, seed); }
  for (let k = 0; k < 4; k++) put(r() * x1, (r() - 0.5) * (LANE.nearZ - LANE.farZ) * 0.8, lin('#FFFFFF'), -1);
  // The near face: a ridge of cloud lobes along the edge, hanging down, the chunk's part of a 24 m tile.
  const xiKeep = (xi: number) => xi >= xi0 && xi < xi1;
  lobeRow(g, seed, -CHUNK.size, CHUNK.size * 2, LANE.nearZ - 0.4, [-0.9, -0.5], [0.6, 1.1], CHUNK.size * CHUNK.count, xiKeep);
  return buildGeometry(g.map, S);
}

/** The cloud sea beyond the far edge: lobes 1.5 to 2.5 m across on the lighter tones, one 28 m tile. */
export function cloudSea(): BufferGeometry {
  const g = new Grid(S);
  const light: Paint = (x, y, z) => pick(T.cloud, hash3(x >> 1, y >> 1, z >> 1, 11), [0.7, 1]);
  const r = rng(77);
  const keep = (xi: number) => xi >= 0 && xi < Math.round(SEA.period / S);
  for (let x = 0; x < SEA.period; x += 2.2 + r() * 1.2) {
    const rad = 1.5 + r() * 1.0, z = SEA.fromZ - r() * (SEA.fromZ - SEA.toZ);
    for (const dx of [-SEA.period, 0, SEA.period]) {
      const tmp = new Grid(S);
      ellipsoid(tmp, [x + dx, SEA.y, z], [rad, rad * 0.45, rad * 0.8], light, 0.1, 50 + Math.round(x));
      for (const v of tmp.map.values()) if (keep(v.x) && !g.has(v.x, v.y, v.z)) g.set(v.x, v.y, v.z, v.c);
    }
  }
  return buildGeometry(g.map, S);
}

/** Hills on the 1 m grid, two ranges, periodic over 48 m, lavender-grey, their bases in the sea. */
export function hills(): BufferGeometry {
  const g = new Grid(1);
  const tones = ['#B9B0E0', '#A89DD4', '#8F84C4'] as const;
  const P = HILLS.period;
  HILLS.ranges.forEach(([z0, z1], line) => {
    for (let x = 0; x < P; x++) for (let z = z1; z <= z0; z++) {
      const u = (x / P) * Math.PI * 2;
      // Low and rolling: the hills' feet are in the cloud sea at y -1.5 and their crests reach no higher than 1 m.
      const h = 0.4 + Math.sin(u * 2 + line) * 0.9 + Math.sin(u * 5 + line * 2) * 0.5 + Math.cos(u * 3 + z * 0.5) * 0.3 - Math.abs(z - (z0 + z1) / 2) * 0.25;
      for (let y = -2; y < Math.round(h); y++) g.set(x, y, z, lin(tones[y >= Math.round(h) - 1 ? 0 : y >= 0 ? 1 : 2]));
    }
  });
  return buildGeometry(g.map, 1);
}

/** Mountains on the 3 m grid: three peaks 18 to 26 m, periodic over 96 m, snow-capped. */
export function mountains(): BufferGeometry {
  const g = new Grid(3);
  const P = MOUNTAINS.period / 3;
  const peaks = [[4, 26], [14, 20], [24, 23]] as const;
  for (let x = 0; x < P; x++) for (let z = Math.round(MOUNTAINS.toZ / 3); z <= Math.round(MOUNTAINS.fromZ / 3); z++) {
    let h = 0;
    for (const [px, ph] of peaks) { const d = Math.min(Math.abs(x - px), P - Math.abs(x - px)); h = Math.max(h, ph - d * 2.4 - Math.abs(z - (MOUNTAINS.fromZ + MOUNTAINS.toZ) / 6) * 1.5); }
    for (let y = -1; y < Math.round(h / 3); y++) g.set(x, y, z, lin(y >= Math.round(h / 3) - 2 ? T.snow[1] : '#9B92D0'));
  }
  return buildGeometry(g.map, 3);
}

/** A snowy pine on the 0.20 m grid, 1.2 to 2.4 m tall, snow on the upper tiers. Base at (wx, wy, wz). */
function pine(g: Grid, wx: number, wy: number, wz: number, seed: number) {
  const r = rng(seed * 97);
  const H = 1.2 + r() * 1.2;
  const tx = Math.round(wx / S), ty = Math.round(wy / S), tz = Math.round(wz / S), hv = Math.round(H / S);
  for (let y = 0; y < hv - 1; y++) g.set(tx, ty + y, tz, pick(T.trunk, hash3(tx, y, tz, seed), [0.4, 0.85]));
  for (let y = 2, tier = 0; y < hv; y += 2, tier++) {
    const R = Math.max(1, Math.round((1 - y / hv) * 2.2));
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > R + (R > 1 ? 1 : 0) || (dx === 0 && dz === 0)) continue;
      g.set(tx + dx, ty + y, tz + dz, pick(T.pine, hash3(dx, y, dz, seed + 50), [0.45, 0.85]));
      if (y >= hv / 2 && !g.has(tx + dx, ty + y + 1, tz + dz)) g.set(tx + dx, ty + y + 1, tz + dz, snowTone(dx, y, dz)!);
    }
  }
  g.set(tx, ty + hv - 1, tz, lin(T.pine[0]));
  g.set(tx, ty + hv, tz, lin(T.snow[0]));
}

export interface IslandGeo { body: BufferGeometry; glow?: BufferGeometry }
/**
 * An island (Part 6.2): a flat snow top on a cloud underside of 4 to 7 lobes shrinking toward the bottom, and what
 * it carries. Built about its centre with the snow top at y = 0.
 */
export function island(kind: string, across: number, tall: number, seed: number): IslandGeo {
  const g = new Grid(S);
  const r = rng(seed * 13);
  const rx = across / 2, rz = across / 2 * 0.7;
  const top: Paint = (x, y, z) => (y >= 0 ? null : cloud(x, y, z));
  // Snow top, 2% noise.
  for (let xi = Math.floor(-rx / S) - 1; xi <= Math.ceil(rx / S) + 1; xi++) for (let zi = Math.floor(-rz / S) - 1; zi <= Math.ceil(rz / S) + 1; zi++) {
    const d = ((xi + 0.5) * S / rx) ** 2 + ((zi + 0.5) * S / rz) ** 2;
    if (d <= 1 + (hash3(xi >> 1, 0, zi >> 1, seed) - 0.5) * 0.12) g.set(xi, -1, zi, snowTone(xi, -1, zi)!);
  }
  const lobes = 4 + Math.floor(r() * 4);
  for (let k = 0; k < lobes; k++) {
    const t = k / lobes, a = t * Math.PI * 2 + r();
    const depth = 0.25 + t * 0.6;
    const rad = rx * (0.55 - t * 0.3) + r() * 0.3;
    ellipsoid(g, [Math.cos(a) * rx * 0.45 * (1 - t * 0.6), -tall * depth * 0.8, Math.sin(a) * rz * 0.45 * (1 - t * 0.6)], [rad, rad * 0.6, rad * 0.8], top, 0.1, seed + k);
  }
  ellipsoid(g, [0, -tall * 0.25, 0], [rx * 0.9, tall * 0.3, rz * 0.9], top, 0.08, seed + 20);
  let glow: BufferGeometry | undefined;
  const hay: Paint = (x, y, z) => pick(T.hay, hash3(x, y, z, 6), [0.5, 0.9]);
  switch (kind) {
    case 'pines-bench':
      pine(g, -rx * 0.45, 0, -0.3, seed + 1); pine(g, rx * 0.3, 0, 0.4, seed + 2);
      box(g, [-0.5, 0, 0.9], [0.5, 0.4, 1.2], (x, y, z) => pick(T.beam, hash3(x, y, z, 3), [0.5, 0.9]));
      box(g, [-0.5, 0.4, 0.9], [0.5, 0.6, 1.2], snowTone);
      break;
    case 'pine-lantern': {
      pine(g, -rx * 0.35, 0, 0, seed + 1);
      box(g, [0.6, 0, 0.2], [0.8, 1.6, 0.4], (x, y, z) => pick(T.beam, hash3(x, y, z, 3), [0.5, 0.9]));
      const gl = new Grid(S);
      box(gl, [0.4, 1.6, 0], [1.0, 2.0, 0.6], () => lin(T.lantern[0]));
      glow = buildGeometry(gl.map, S);
      box(g, [0.3, 2.0, -0.1], [1.1, 2.2, 0.7], (x, y, z) => pick(T.beam, hash3(x, y, z, 8), [0.4, 0.8]));
      break;
    }
    case 'barn': {
      // A tiny red barn, 1.6 m long, with a snow gable roof.
      const red: Paint = (x, y, z) => pick(T.barn, hash3(x >> 1, y, z, 21), [0.55, 0.9]);
      box(g, [-0.8, 0, -0.5], [0.8, 1.0, 0.5], red);
      for (let k = 0; k < 4; k++) box(g, [-0.9 + k * 0.1, 1.0 + k * 0.2, -0.55 + k * 0.14], [0.9 - k * 0.1, 1.2 + k * 0.2, 0.55 - k * 0.14], snowTone);
      box(g, [-0.2, 0, 0.5], [0.2, 0.6, 0.6], () => lin(T.beam[2]));
      pine(g, rx * 0.5, 0, 0.6, seed + 3);
      break;
    }
    case 'pines': pine(g, -rx * 0.5, 0, 0.2, seed + 1); pine(g, 0, 0, -0.5, seed + 2); pine(g, rx * 0.45, 0, 0.5, seed + 3); break;
    case 'windmill': pine(g, -rx * 0.6, 0, 0.4, seed + 1); break; // the mill itself is the yard's, placed by the stage
    case 'haystack':
      pine(g, -rx * 0.4, 0, -0.3, seed + 1); pine(g, -rx * 0.6, 0, 0.6, seed + 2);
      ellipsoid(g, [rx * 0.35, 0.5, 0.2], [0.7, 0.6, 0.6], hay, 0.1, seed + 4);
      box(g, [rx * 0.35 - 0.4, 1.0, -0.2], [rx * 0.35 + 0.4, 1.2, 0.6], snowTone);
      break;
    default: break;
  }
  return { body: buildGeometry(g.map, S), glow };
}

/** A cloud wisp: a thin lobe 2 to 3 m long in the lightest tone. */
export function wisp(seed: number): BufferGeometry {
  const g = new Grid(S);
  const r = rng(seed * 17);
  ellipsoid(g, [0, 0, 0], [1 + r() * 0.5, 0.15, 0.4], () => lin(T.cloud[0]), 0.15, seed);
  ellipsoid(g, [0.9 + r() * 0.6, 0.05, 0.1], [0.6 + r() * 0.3, 0.12, 0.3], () => lin(T.cloud[0]), 0.15, seed + 1);
  return buildGeometry(g.map, S);
}

// ---------- fences and signs (Part 7.3), on the 0.10 m grid ----------
const F = 0.1;
const wood: Paint = (x, y, z) => pick(T.beam, hash3(x, y, z, 17), [0.45, 0.85]);
/** The fence: two posts 0.58 m tall 0.4 m apart, two rails, snow caps. Built about the fence's centre at ground level. */
export function fence(): BufferGeometry {
  const g = new Grid(F);
  for (const px of [-2, 2]) {
    for (let y = 0; y < 6; y++) g.set(px, y, 0, wood(px, y, 0)!);
    g.set(px, 6, 0, lin(T.snow[0])); g.set(px, 7, 0, lin(T.snow[1]));
  }
  for (const y of [2, 5]) for (let x = -2; x <= 2; x++) { g.set(x, y, 0, wood(x, y, 0)!); if (y === 5 && x !== -2 && x !== 2) g.set(x, y + 1, 0, lin(T.snow[0])); }
  for (let x = -2; x <= 2; x++) g.set(x, 5, 0, lin(T.beam[0]));
  return buildGeometry(g.map, F);
}
/** The sign post 0.3 m to the +x side of a fence: a post and a board with a snow cap, about the post's base. */
export function signPost(letters: number): BufferGeometry {
  const g = new Grid(F);
  for (let y = 0; y < 9; y++) g.set(0, y, 0, wood(0, y, 0)!);
  const w = signWidth(letters);
  const hw = Math.round(w / 2 / F);
  for (let x = -hw; x <= hw; x++) for (let y = 7; y <= 9; y++) { g.set(x, y, 0, lin(T.beam[0])); g.set(x, y, -1, lin(T.beam[2])); }
  for (let x = -hw; x <= hw; x++) if (hash3(x, 1, 0, 8) > 0.25) g.set(x, 10, 0, lin(T.snow[0]));
  return buildGeometry(g.map, F);
}
/** The cream rim marking the active fence's sign. */
export function signRim(letters: number): BufferGeometry {
  const g = new Grid(F);
  const hw = Math.round(signWidth(letters) / 2 / F);
  for (let x = -hw - 1; x <= hw + 1; x++) for (const y of [6, 10]) g.set(x, y, 1, lin(T.snow[0]));
  for (const x of [-hw - 1, hw + 1]) for (let y = 7; y <= 9; y++) g.set(x, y, 1, lin(T.snow[0]));
  return buildGeometry(g.map, F);
}
/** The letter cell (m) for a sign of `n` letters, and the board's width. */
export const signCell = (n: number) => (n >= 5 ? 0.035 : 0.04);
export function signWidth(n: number): number {
  const cell = signCell(n);
  return Math.max(0.5, n * GLYPH.w * cell + (n - 1) * 2 * cell + 4 * cell);
}
const carved = new Map<string, BufferGeometry>();
/** The letters carved on a sign, `S·P`, one voxel proud of the board's front, centred on the board at y = 0.8 m. */
export function signLetters(letters: readonly string[]): BufferGeometry {
  const key = letters.join('');
  const hit = carved.get(key);
  if (hit) return hit;
  const cell = signCell(letters.length);
  const g = new Grid(cell);
  const ink = lin('#2A1E14');
  const total = letters.length * GLYPH.w + (letters.length - 1) * 2;
  let x = -Math.floor(total / 2);
  letters.forEach((ch, i) => {
    paintGlyph(g, ch, x, 0, 0, ink);
    x += GLYPH.w;
    if (i < letters.length - 1) { g.set(x, 3, 0, ink); x += 2; }
  });
  const geo = buildGeometry(g.map, cell);
  geo.translate(0, 0.8 - (GLYPH.h / 2) * cell, F / 2 + cell / 2);
  carved.set(key, geo);
  return geo;
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
