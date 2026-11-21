/**
 * Home's clouds (docs/depth/DEPTH-PLAN.md, section 9.3; Brian's pick of the five mockups, 2026-11-20: the voxel style).
 * Cumulus clouds of 2.9 m cubes (the mockup's 2.5 m came to 24,000 triangles; the budget is 20,000) in a ring 280 m out, past the mountains: a tall middle lobe, two shoulders, two small
 * ends and two bumps on a long flat base, 50 to 85 m long, 14 to 22 m tall, the bottom cut flat. White tops, a pale
 * lilac base, near-white sides. Every column is solid down to the flat base, so no step has an underside: seen from
 * below, one read as a dark dash (two of them looked like a sleeping face).
 */
import { BufferGeometry, Color, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildGeometry } from '../voxel/mesher';
import { Grid, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

export const CLOUD = { count: 18, ring: 280, cube: 2.9, minElevation: 7, maxElevation: 15 } as const;

interface Lobe { t: number; y: number; r: number }
export interface CloudAt { az: number; elevation: number; L: number; H: number; lobes: Lobe[] }

/**
 * Where the clouds stand. Evenly round the ring (20 degrees apart, a little jitter), so that whatever way the slow
 * turn has carried them, every Home shot that holds sky (60 to 70 degrees across) shows three or four. High enough
 * (7 to 15 degrees) to clear the mountains, low enough that the whole cloud sits under the top of those shots.
 */
export function cloudRing(): CloudAt[] {
  const r = rng(77), out: CloudAt[] = [];
  for (let i = 0; i < CLOUD.count; i++) {
    const az = (i / CLOUD.count) * Math.PI * 2 + (r() - 0.5) * 0.1;
    const elevation = CLOUD.minElevation + r() * (CLOUD.maxElevation - CLOUD.minElevation);
    const L = 50 + r() * 35, H = 14 + r() * 8, j = () => 0.85 + r() * 0.3, sh = (r() - 0.5) * 0.15 * L;
    out.push({ az, elevation, L, H, lobes: [
      { t: sh, y: H * 0.55, r: H * 0.75 * j() },
      { t: sh - L * 0.22, y: H * 0.42, r: H * 0.55 * j() }, { t: sh + L * 0.22, y: H * 0.4, r: H * 0.52 * j() },
      { t: -L * 0.4, y: H * 0.28, r: H * 0.36 * j() }, { t: L * 0.4, y: H * 0.26, r: H * 0.34 * j() },
      { t: sh - L * 0.08, y: H * 0.98, r: H * 0.32 * j() }, { t: sh + L * 0.1, y: H * 0.9, r: H * 0.28 * j() },
    ] });
  }
  return out;
}

const srgb = (hex: string): RGB => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const TOP = srgb('#FFFFFF'), SIDE = srgb('#F7F3F5'), BASE = srgb('#E8E4F2');

/** One cloud in its own frame (x along the ring, y up, z toward the farm), in cubes. */
function cloudGrid(c: CloudAt): Grid {
  const C = CLOUD.cube, g = new Grid(C), cut = c.H * 0.12;
  const ell = [...c.lobes.map((l) => [l.t, l.y, 0, l.r * 1.15, l.r * 0.9, l.r * 0.85]), [0, c.H * 0.22, 0, c.L * 0.5, c.H * 0.24, c.H * 0.45]];
  const n = Math.ceil((c.L * 0.75) / C), h = Math.ceil((c.H * 1.6) / C), w = Math.ceil(c.H / C);
  for (let i = -n; i < n; i++) for (let k = -w; k < w; k++) for (let y = 0; y < h; y++) {
    const px = (i + 0.5) * C, py = (y + 0.5) * C + cut, pz = (k + 0.5) * C;
    if (ell.some(([ox, oy, oz, a, b, d]) => ((px - ox) / a) ** 2 + ((py - oy) / b) ** 2 + ((pz - oz) / d) ** 2 <= 1)) for (let f = 0; f <= y; f++) g.set(i, f, k, SIDE);
  }
  for (const v of g.map.values()) v.c = !g.has(v.x, v.y + 1, v.z) ? TOP : v.y === 0 ? BASE : SIDE;
  return g;
}

/** All the clouds as one geometry (one draw call), placed on the ring round the farm's middle. */
export function cloudGeometry(): BufferGeometry {
  const parts = cloudRing().map((c) => {
    const geo = buildGeometry(cloudGrid(c).map, CLOUD.cube, { ao: false, merge: true });
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
