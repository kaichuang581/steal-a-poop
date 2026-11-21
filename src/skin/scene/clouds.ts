/**
 * Home's clouds (docs/depth/DEPTH-PLAN.md, section 9.3; Brian's pick of the five mockups, 2026-11-20: the voxel style;
 * 2026-11-21: "too unnatural ... insane blocks", so finer and softer). Cumulus of 1.7 m cubes in a ring 280 m out, past
 * the mountains: each a heap of round puffs on a long flat base, edges billowed by noise, drawn unlit in one colour (Sky.tsx).
 * Every column is solid down to the flat base, so no step shows an underside (one read as a dark dash).
 * The tops and the far faces are never seen from the farm and are not drawn, which keeps it under 20,000 triangles.
 */
import { BufferGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGeometry } from '../voxel/mesher';
import { Grid, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

export const CLOUD = { count: 18, ring: 280, cube: 1.7, minElevation: 7, maxElevation: 15 } as const;

interface Lobe { t: number; y: number; z: number; r: number; long?: number }
export interface CloudAt { az: number; elevation: number; L: number; H: number; seed: number; lobes: Lobe[] }

/**
 * Where the clouds stand. Evenly round the ring (20 degrees apart, a little jitter), so that whatever way the slow
 * turn has carried them, every Home shot that holds sky (60 to 70 degrees across) shows three or four. High enough
 * (7 to 15 degrees) to clear the mountains, low enough that the whole cloud sits under the top of those shots.
 * Each is its own heap of puffs: a few big ones along a flat base, smaller ones piled on their tops (cauliflower),
 * so no two share an outline.
 */
export function cloudRing(): CloudAt[] {
  const r = rng(77), out: CloudAt[] = [];
  for (let i = 0; i < CLOUD.count; i++) {
    const az = (i / CLOUD.count) * Math.PI * 2 + (r() - 0.5) * 0.1;
    const elevation = CLOUD.minElevation + r() * (CLOUD.maxElevation - CLOUD.minElevation);
    const L = 40 + r() * 45, H = 12 + r() * 10, lobes: Lobe[] = [];
    // The body: 3 to 5 big puffs along the base, the tallest near the middle.
    const nb = 3 + Math.floor(r() * 3);
    for (let k = 0; k < nb; k++) {
      const t = (k / (nb - 1) - 0.5) * L * 0.7 + (r() - 0.5) * L * 0.08, mid = 1 - Math.abs(t) / (L * 0.5);
      const rad = H * (0.32 + 0.3 * mid) * (0.85 + r() * 0.3);
      lobes.push({ t, y: rad * 0.55, z: (r() - 0.5) * H * 0.3, r: rad });
    }
    // The puffs on top: each sits on the upper surface of one already placed, a little smaller.
    for (let k = 0; k < 9; k++) {
      const p = lobes[Math.floor(r() * lobes.length)], a = (0.15 + r() * 0.7) * Math.PI, rad = p.r * (0.38 + r() * 0.25);
      if (p.y + Math.sin(a) * p.r > H) continue;
      lobes.push({ t: p.t + Math.cos(a) * p.r * 0.8, y: p.y + Math.sin(a) * p.r * 0.75, z: p.z + (r() - 0.5) * p.r * 0.6, r: rad });
    }
    // A long low base under them all, so the heap reads as one cloud, never as loose puffs.
    lobes.push({ t: 0, y: H * 0.16, z: 0, r: H * 0.3, long: L * 0.42 } as Lobe);
    out.push({ az, elevation, L, H, seed: Math.floor(r() * 1e6), lobes });
  }
  return out;
}

const WHITE: RGB = [1, 1, 1]; // one colour: the material draws them unlit (Sky.tsx)

/** Smooth value noise, about -1 to 1: billows on the puffs so no edge is a clean stepped circle. */
function billow(x: number, y: number, z: number, s: number): number {
  return Math.sin(x * 0.23 + s) * Math.sin(y * 0.29 + s * 1.7) * Math.sin(z * 0.21 + s * 2.3) + 0.5 * Math.sin(x * 0.51 + y * 0.43 + s * 3.1) * Math.sin(z * 0.47 - y * 0.37 + s);
}

/** One cloud in its own frame (x along the ring, y up, z toward the farm), in cubes. */
function cloudGrid(c: CloudAt): Grid {
  const C = CLOUD.cube, g = new Grid(C), s = c.seed % 100;
  const n = Math.ceil((c.L * 0.8) / C), h = Math.ceil((c.H * 1.4) / C), w = Math.ceil((c.H * 0.9) / C);
  for (let i = -n; i < n; i++) for (let k = -w; k < w; k++) for (let y = 0; y < h; y++) {
    const px = (i + 0.5) * C, py = (y + 0.5) * C, pz = (k + 0.5) * C, wob = 1 + 0.16 * billow(px, py, pz, s);
    if (c.lobes.some((l) => ((px - l.t) / (l.long ?? l.r * 1.12)) ** 2 + ((py - l.y) / l.r) ** 2 + ((pz - l.z) / (l.r * 0.85)) ** 2 <= wob)) {
      for (let f = 0; f <= y; f++) g.set(i, f, k, WHITE); // solid down to the flat base: no step shows an underside
    }
  }
  return g;
}

// Seen only from below and from the farm's side of the ring: the tops and the far faces are never drawn.
const unseen = (axis: 0 | 1 | 2, sign: 1 | -1) => (axis === 1 && sign === 1) || (axis === 2 && sign === -1);

/** All the clouds as one geometry (one draw call), placed on the ring round the farm's middle. */
export function cloudGeometry(): BufferGeometry {
  const parts = cloudRing().map((c) => {
    const geo = buildGeometry(cloudGrid(c).map, CLOUD.cube, { ao: false, merge: true, unseen });
    geo.deleteAttribute('bevel');
    const x = Math.cos(c.az) * CLOUD.ring, z = Math.sin(c.az) * CLOUD.ring, y = Math.tan((c.elevation * Math.PI) / 180) * CLOUD.ring;
    // Its long side square to the farm: local x along the ring, local z toward the middle (a turn, never a mirror).
    const along = [-Math.sin(c.az), 0, Math.cos(c.az)], toward = [-Math.cos(c.az), 0, -Math.sin(c.az)];
    geo.applyMatrix4(new Matrix4().set(along[0], 0, toward[0], x, along[1], 1, toward[1], y, along[2], 0, toward[2], z, 0, 0, 0, 1));
    return geo;
  });
  const geo = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return geo;
}
