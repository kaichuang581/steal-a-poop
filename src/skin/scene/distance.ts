import type { BufferGeometry } from 'three';
import { buildGeometry, triangles } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { Grid, hash3, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { DISTANCE, YARD } from './layout';
import { dropFaces } from './yard';

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 2D value noise in 0..1. */
function vnoise(x: number, z: number, seed: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = smooth(x - xi), w = smooth(z - zi);
  const h = (a: number, b: number) => hash3(a, 0, b, seed);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), w);
}
function fbm(x: number, z: number, seed: number) {
  return (vnoise(x, z, seed) * 4 + vnoise(x * 2, z * 2, seed + 1) * 2 + vnoise(x * 4, z * 4, seed + 2)) / 7;
}

/**
 * Fill each column only from its lowest neighbour's top to its own top, so slopes are closed but the solid interior
 * (never visible) is left empty. Columns on the grid's outer edge go down to the ground.
 */
function columns(g: Grid, nx: [number, number], nz: [number, number], h: (x: number, z: number) => number, paint: (x: number, y: number, z: number, top: number, slope: number) => RGB) {
  const W = nx[1] - nx[0] + 1, D = nz[1] - nz[0] + 1;
  const H = new Int32Array(W * D);
  for (let i = 0; i < W; i++) for (let k = 0; k < D; k++) H[i * D + k] = Math.max(1, Math.round(h(nx[0] + i, nz[0] + k)));
  const at = (i: number, k: number) => (i < 0 || k < 0 || i >= W || k >= D ? 0 : H[i * D + k]);
  for (let i = 0; i < W; i++)
    for (let k = 0; k < D; k++) {
      const top = H[i * D + k];
      const nb = [at(i - 1, k), at(i + 1, k), at(i, k - 1), at(i, k + 1)];
      const lo = Math.min(top - 1, ...nb);
      const slope = Math.max(...nb.map((n) => top - n));
      for (let y = lo; y < top; y++) g.set(nx[0] + i, y, nz[0] + k, paint(nx[0] + i, y, nz[0] + k, top, slope));
    }
  return at;
}

export function buildDistance(): {
  hills: BufferGeometry; mountains: BufferGeometry; windmillBody: BufferGeometry; windmillBlades: BufferGeometry;
  bladesHub: [number, number, number]; triangles: number;
} {
  // ---- Hills, 1 m grid. They start at the yard's far edge so no gap shows, rising to the rolling heights by fromZ.
  const hillsG = new Grid(1);
  const z0 = YARD.maxZ, z1 = DISTANCE.hills.toZ - 1;
  const raw = (x: number, z: number) => {
    const t = (z - DISTANCE.hills.fromZ) / (DISTANCE.hills.toZ - DISTANCE.hills.fromZ);
    const h = 4 + 9 * Math.max(0, t) + ((vnoise(x / 38, z / 26, 7) * 2 + vnoise(x / 19, z / 13, 8)) / 3) * 13 + Math.sin(x / 31 + z / 47) * 2;
    return Math.min(25, Math.max(4, h));
  };
  const V = DISTANCE.village, M = DISTANCE.windmill;
  const vBase = Math.round(raw(V.x, V.z)), mBase = Math.round(raw(M.x, M.z));
  const hillH = (x: number, z: number) => {
    let h = raw(x, z);
    h = lerp(h, vBase, smooth((16 - Math.hypot(x - V.x, z - V.z)) / 8));
    h = lerp(h, mBase, smooth((10 - Math.hypot(x - M.x, z - M.z)) / 5));
    return lerp(1, h, smooth((z - z0) / (DISTANCE.hills.fromZ + 6 - z0)));
  };
  columns(hillsG, [-150, 149], [z0, z1], hillH, (x, y, z, top) => pick(T.snow, hash3(x, y, z, 11), y === top - 1 ? [0.55, 0.9] : [0.1, 0.5]));
  // Tree lines of 1-voxel dots in pine dark, a few two tall.
  const pineDark = lin(T.pine[2]), pineMid = lin(T.pine[1]);
  for (let x = -150; x < 150; x++)
    for (let line = 0; line < 4; line++) {
      const zl = 62 + line * 19 + Math.sin(x / (17 + line * 5) + line) * 7 + (fbm(x / 20, line, 13) - 0.5) * 8;
      for (const z of [Math.floor(zl), Math.floor(zl) + 1]) {
        if (z < DISTANCE.hills.fromZ || z > z1 || hash3(x, line, z, 14) < 0.4) continue;
        if (Math.hypot(x - V.x, z - V.z) < 12 || Math.hypot(x - M.x, z - M.z) < 7) continue;
        const top = Math.max(1, Math.round(hillH(x, z)));
        hillsG.set(x, top, z, pineDark);
        if (hash3(x, 1, z, 15) > 0.6) hillsG.set(x, top + 1, z, pineMid);
      }
    }
  // Village: four tiny houses with lit windows, snowy roof ridges and a chimney each.
  const wall = (x: number, y: number, z: number) => pick(T.house, hash3(x, y, z, 21));
  const lot: [number, number][] = [[-7, -3], [-1, -5], [5, -2], [0, 4]];
  for (const [dx, dz] of lot) {
    const x0 = V.x + dx - 2, zz0 = V.z + dz - 1, y0 = vBase;
    for (let x = x0; x < x0 + 4; x++) for (let y = y0; y < y0 + 3; y++) for (let z = zz0; z < zz0 + 3; z++) hillsG.set(x, y, z, wall(x, y, z));
    for (let x = x0 - 1; x < x0 + 5; x++) {
      for (let z = zz0 - 1; z < zz0 + 4; z++) hillsG.set(x, y0 + 3, z, z === zz0 + 1 ? lin(T.snow[1]) : pick(T.roof, hash3(x, 3, z, 22)));
      hillsG.set(x, y0 + 4, zz0 + 1, lin(T.snow[0]));
    }
    hillsG.set(x0 + 1, y0 + 1, zz0 - 1, lin(T.lantern[0]));
    hillsG.set(x0 + 3, y0 + 1, zz0 - 1, lin(T.lantern[1]));
    hillsG.set(x0 + 2, y0, zz0 - 1, lin(T.roof[2]));
    hillsG.set(x0 + 3, y0 + 5, zz0 + 2, lin(T.stone[1]));
  }

  // ---- Windmill body (1 m), world-positioned: a tapered tower, lit window, door, dark cap.
  const bodyG = new Grid(1);
  for (let y = 0; y < 10; y++) {
    const r = y < 5 ? 2 : 1;
    for (let x = M.x - r; x <= M.x + r; x++) for (let z = M.z - r; z <= M.z + r; z++) bodyG.set(x, mBase + y, z, pick(T.house, hash3(x, y, z, 31)));
  }
  for (let x = M.x - 1; x <= M.x + 1; x++) for (let z = M.z - 1; z <= M.z + 1; z++) bodyG.set(x, mBase + 10, z, pick(T.roof, hash3(x, 10, z, 32)));
  bodyG.set(M.x, mBase + 11, M.z, lin(T.snow[0]));
  bodyG.set(M.x, mBase, M.z - 3, lin(T.roof[2]));
  bodyG.set(M.x, mBase + 1, M.z - 3, lin(T.roof[2]));
  bodyG.set(M.x, mBase + 6, M.z - 2, lin(T.lantern[0]));
  bodyG.set(M.x, mBase + 9, M.z - 2, lin(T.roof[2])); // axle stub
  const bladesHub: [number, number, number] = [M.x + 0.5, mBase + 9.5, M.z - 2.25];

  // ---- Blades (0.5 m grid), centred on the origin so the caller can place them at bladesHub and spin about z.
  const bladeG = new Grid(0.5);
  const spar = lin(T.roof[2]), sail = (x: number, y: number) => lin((x + y) % 3 === 0 ? T.roof[1] : T.house[0]);
  for (let a = 0; a < 4; a++) {
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][a];
    const [px, py] = [-dy, dx];
    for (let i = 1; i <= 14; i++) {
      bladeG.set(dx * i, dy * i, 0, spar);
      if (i >= 3) for (let w = 1; w <= 3; w++) bladeG.set(dx * i + px * w, dy * i + py * w, 0, sail(i, w));
    }
  }
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) bladeG.set(x, y, -1, spar);
  bladeG.set(0, 0, 0, spar);
  const windmillBlades = buildGeometry(bladeG.map, 0.5);
  windmillBlades.translate(-0.25, -0.25, -0.25);

  // ---- Mountains, 3 m grid: anisotropic peaks make ridges; rock shows on steep faces and crests, snow on top.
  const mG = new Grid(3);
  const r = rng(77);
  const peaks = Array.from({ length: 11 }, (_, i) => ({
    x: i === 0 ? 20 : -280 + r() * 560,
    z: i === 0 ? 215 : 180 + r() * 70,
    h: i === 0 ? 110 : 40 + r() * 60,
    rad: 50 + r() * 50,
    a: r() * Math.PI,
  }));
  const mH = (x: number, z: number) => {
    let h = 14;
    for (const p of peaks) {
      const ux = x - p.x, uz = z - p.z;
      const u = ux * Math.cos(p.a) + uz * Math.sin(p.a), v = -ux * Math.sin(p.a) + uz * Math.cos(p.a);
      const d = Math.hypot(u, v / 0.5) / p.rad;
      if (d < 1) h = Math.max(h, p.h * (1 - d) ** 1.3);
    }
    return h + (fbm(x / 30, z / 30, 41) - 0.5) * 14;
  };
  const glacier = (x: number, z: number) => {
    const p = peaks[0];
    const t = (p.z - z) / 50; // 0 at the peak, 1 at the tongue's tip toward the camera
    return t > 0.05 && t < 1 && Math.abs(x - (p.x + Math.sin(t * 3) * 6)) < 14 * (1 - t * 0.7);
  };
  const MZ0 = Math.ceil(DISTANCE.mountains.fromZ / 3), MZ1 = Math.floor(DISTANCE.mountains.toZ / 3);
  const hAt = (xi: number, zi: number) => mH(xi * 3, zi * 3) / 3;
  columns(mG, [-100, 99], [MZ0, MZ1], hAt, (x, y, z, top, slope) => {
    const m = y * 3, isTop = y === top - 1, n = hash3(x, y, z, 51);
    const snowLine = 48 + (vnoise(x / 6, z / 6, 52) - 0.5) * 20;
    if (isTop) {
      const crest = (top > Math.round(hAt(x - 1, z)) && top > Math.round(hAt(x + 1, z))) || (top > Math.round(hAt(x, z - 1)) && top > Math.round(hAt(x, z + 1)));
      if (glacier(x * 3, z * 3) && slope < 3) return pick(T.ice, n, [0.45, 0.85]);
      if (slope >= 3 || (crest && slope >= 2)) return lin(T.stone[2]);
      if (m > snowLine || (slope <= 1 && m > 30)) return pick(T.snow, n, [0.5, 0.9]);
      return pick(T.stone, n, [0.5, 0.85]);
    }
    if (m > snowLine + 6 && n > 0.4) return pick(T.snow, n, [0.1, 0.6]);
    return pick(T.stone, n, [0.2, 0.6]);
  });

  // Terrain has no overhangs, so no downward face is ever visible.
  const hills = dropFaces(buildGeometry(hillsG.map, 1), (ny) => ny < 0);
  const mountains = dropFaces(buildGeometry(mG.map, 3), (ny) => ny < 0);
  const windmillBody = buildGeometry(bodyG.map, 1);
  return {
    hills, mountains, windmillBody, windmillBlades, bladesHub,
    triangles: [hills, mountains, windmillBody, windmillBlades].reduce((s, x) => s + triangles(x), 0),
  };
}
