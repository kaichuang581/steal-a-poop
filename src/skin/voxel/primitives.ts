import type { VoxelMap } from './mesher';

export type RGB = [number, number, number];
export type V3 = [number, number, number];
/** Colour for a voxel at integer grid position (x, y, z); return null to leave it empty. */
export type Paint = (x: number, y: number, z: number) => RGB | null;

/** Deterministic random numbers (the same seed always builds the same model). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Cheap 3D hash noise in 0..1, stable per voxel. */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A voxel grid at one cell size; shapes are given in metres and snapped to the grid. */
export class Grid {
  readonly map: VoxelMap = new Map();
  constructor(readonly size: number) {}
  i(m: number) {
    return Math.round(m / this.size);
  }
  set(x: number, y: number, z: number, c: RGB) {
    this.map.set(`${x},${y},${z}`, { x, y, z, c });
  }
  has(x: number, y: number, z: number) {
    return this.map.has(`${x},${y},${z}`);
  }
  del(x: number, y: number, z: number) {
    this.map.delete(`${x},${y},${z}`);
  }
  get count() {
    return this.map.size;
  }
}

/** Solid ellipsoid; `noise` (0..1 of the radius) roughens the surface. */
export function ellipsoid(g: Grid, c: V3, r: V3, paint: Paint, noise = 0, seed = 1) {
  const [cx, cy, cz] = c.map((v) => v / g.size);
  const [rx, ry, rz] = r.map((v) => v / g.size);
  for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++)
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
        const limit = 1 + (noise ? (hash3(x >> 1, y >> 1, z >> 1, seed) - 0.5) * 2 * noise : 0);
        if (d <= limit) {
          const col = paint(x, y, z);
          if (col) g.set(x, y, z, col);
        }
      }
}

/** Axis-aligned box from min to max (metres, inclusive of min), with `chamfer` voxels cut off every edge. */
export function box(g: Grid, min: V3, max: V3, paint: Paint, chamfer = 0) {
  // A box one cell thick that sits on a half cell (x = 5.75 on a 0.1 m grid) had its near side round up and its far side
  // round down, and came out empty: that is how the lights along the barn's right wall lost their wire and floated
  // (Brian, 2026-11-09). Such a box now takes its width from its size. Every box that drew before draws as it did.
  const a = min.map((v) => Math.round(v / g.size));
  const b = max.map((v, i) => {
    const far = Math.round(v / g.size) - 1;
    return far < a[i] ? a[i] + Math.round((v - min[i]) / g.size) - 1 : far;
  });
  for (let x = a[0]; x <= b[0]; x++)
    for (let y = a[1]; y <= b[1]; y++)
      for (let z = a[2]; z <= b[2]; z++) {
        if (chamfer) {
          const ex = Math.min(x - a[0], b[0] - x), ey = Math.min(y - a[1], b[1] - y), ez = Math.min(z - a[2], b[2] - z);
          const near = [ex, ey, ez].filter((e) => e < chamfer);
          if (near.length >= 2 && near.reduce((s, e) => s + (chamfer - e), 0) > chamfer) continue;
        }
        const col = paint(x, y, z);
        if (col) g.set(x, y, z, col);
      }
}

/** Box whose x/z section shrinks linearly from `base` to `tip` scale along y (ears, tails, posts). */
export function taperedBox(g: Grid, c: V3, size: V3, tip: number, paint: Paint) {
  const [cx, cy, cz] = c.map((v) => v / g.size);
  const [sx, sy, sz] = size.map((v) => v / g.size);
  for (let y = 0; y < sy; y++) {
    const k = 1 - (1 - tip) * (y / Math.max(1, sy - 1));
    const hx = (sx * k) / 2, hz = (sz * k) / 2;
    for (let x = Math.round(cx - hx); x < Math.round(cx + hx); x++)
      for (let z = Math.round(cz - hz); z < Math.round(cz + hz); z++) {
        const col = paint(x, Math.round(cy) + y, z);
        if (col) g.set(x, Math.round(cy) + y, z, col);
      }
  }
}

/** Cone hanging down (dir -1) or standing up (dir 1) from base centre c. Icicles, carrot noses, ears. */
export function cone(g: Grid, c: V3, radius: number, length: number, dir: 1 | -1, paint: Paint) {
  const [cx, cy, cz] = c.map((v) => v / g.size);
  const r = radius / g.size, n = Math.max(1, Math.round(length / g.size));
  for (let i = 0; i < n; i++) {
    const rr = r * (1 - i / n);
    const y = Math.round(cy) + dir * i;
    for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++)
      for (let z = Math.floor(cz - rr); z <= Math.ceil(cz + rr); z++) {
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= Math.max(0.3, rr * rr)) {
          const col = paint(x, y, z);
          if (col) g.set(x, y, z, col);
        }
      }
  }
}

/** Horizontal elliptical ring (collars, hoops): centre, x/z radii and a thickness, all in metres. */
export function ring(g: Grid, c: V3, rx: number, rz: number, thickness: number, paint: Paint) {
  const steps = Math.ceil((2 * Math.PI * Math.max(rx, rz)) / (g.size * 0.5));
  const t = thickness / g.size / 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const px = (c[0] + Math.cos(a) * rx) / g.size, pz = (c[2] + Math.sin(a) * rz) / g.size, py = c[1] / g.size;
    for (let dy = -t; dy <= t; dy += 0.5) {
      const x = Math.round(px), y = Math.round(py + dy), z = Math.round(pz);
      const col = paint(x, y, z);
      if (col) g.set(x, y, z, col);
    }
  }
}

/** One-voxel line between two points in metres. */
export function line(g: Grid, a: V3, b: V3, paint: Paint, joined = false) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(1, Math.ceil((d / g.size) * 2));
  let prev: V3 | null = null;
  const put = (x: number, y: number, z: number) => { const col = paint(x, y, z); if (col) g.set(x, y, z, col); };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round((a[0] + (b[0] - a[0]) * t) / g.size), y = Math.round((a[1] + (b[1] - a[1]) * t) / g.size), z = Math.round((a[2] + (b[2] - a[2]) * t) / g.size);
    // `joined`: step one axis at a time between samples, so the line is one piece. A diagonal step that moved along all
    // three at once left two cells touching at a corner only, and a tree's limb hung in the air (Brian, 2026-11-09).
    if (joined && prev) {
      const at: V3 = [...prev];
      for (const axis of [1, 0, 2] as const) while (at[axis] !== [x, y, z][axis]) { at[axis] += Math.sign([x, y, z][axis] - at[axis]); put(at[0], at[1], at[2]); }
    }
    put(x, y, z);
    prev = [x, y, z];
  }
}

/**
 * A wool curl: a small helix of 1-voxel thickness whose axis follows `normal`, starting at `origin` (metres).
 * radius 0.03, pitch 0.02 and 1.5 turns by default (plan V3 Part 5.1).
 */
export function helix(g: Grid, origin: V3, normal: V3, paint: Paint, radius = 0.03, pitch = 0.02, turns = 1.5) {
  const n = norm(normal);
  const u = norm(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]));
  const w = cross(n, u);
  const steps = Math.ceil(turns * 24);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * Math.PI * 2;
    const h = (i / steps) * turns * pitch;
    const p: V3 = [
      origin[0] + u[0] * Math.cos(a) * radius + w[0] * Math.sin(a) * radius + n[0] * h,
      origin[1] + u[1] * Math.cos(a) * radius + w[1] * Math.sin(a) * radius + n[1] * h,
      origin[2] + u[2] * Math.cos(a) * radius + w[2] * Math.sin(a) * radius + n[2] * h,
    ];
    const x = Math.round(p[0] / g.size), y = Math.round(p[1] / g.size), z = Math.round(p[2] / g.size);
    const col = paint(x, y, z);
    if (col) g.set(x, y, z, col);
  }
}

export function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Paint helper: one colour everywhere. */
export const solid = (c: RGB): Paint => () => c;
