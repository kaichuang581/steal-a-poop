import { Color } from 'three';
import type { BurstShape } from '../shop/catalog';
import { lin } from './palette';
import { Grid, hash3 } from './primitives';
import type { RGB } from './primitives';

/**
 * The things a Trading Post burst puts where the bomb was (table/Blast.tsx), instead of every burst being an explosion
 * (Brian, 2026-11-12: "the burst doesnt literally have to be an explosion every single time, maybe something pops up ...
 * it feels weird for an aurora to be exploding"): a haystack, a snow cloud, a balloon, a campfire, a clump of heather, a
 * little sun, a paper lantern, a star. All axis-aligned voxels, coloured from the burst's own palette. The thumbnails
 * (shop/thumbModels.ts) are made of the same models, so the picture is the thing.
 */
export const PROP_VOXEL = 0.06;
export interface BurstPalette { flame: string[]; spark: string[] }

/** A colour at full strength, for the things that glow (`lin` takes 30% of the saturation off). */
const raw = (hex: string): RGB => { const c = new Color(hex); return [c.r, c.g, c.b]; };
type Paint = RGB | ((x: number, y: number, z: number) => RGB);
const tone = (c: Paint, x: number, y: number, z: number) => (typeof c === 'function' ? c(x, y, z) : c);
function fill(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Paint) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) g.set(x, y, z, tone(c, x, y, z));
}
function ball(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: Paint) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) g.set(x, y, z, tone(c, x, y, z));
  }
}

/** A haystack: a mound of straw with a few stalks sticking out. Stands on y = 0. */
export function haystackGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), straw = [p.flame[1], p.flame[1], p.flame[2], p.flame[2], p.flame[3]].map(raw);
  for (let y = 0; y <= 8; y++) {
    const r = 8.5 * Math.sqrt(Math.max(0, 1 - (y / 9) ** 2));
    for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
      if (Math.hypot(x, z) > r + (hash3(x, y, z, 3) - 0.5) * 1.6) continue;
      g.set(x, y, z, y >= 7 ? straw[0] : straw[Math.floor(hash3(x, y, z, 9) * straw.length)]);
    }
  }
  for (const [x, z, h] of [[2, 1, 4], [-3, 2, 3], [0, -3, 3], [-1, 0, 5], [4, -2, 2]] as [number, number, number][]) for (let y = 8; y < 8 + h; y++) g.set(x, y, z, straw[0]);
  return g;
}

/** A snow cloud: three soft lumps, white on top and grey underneath. Centred on the origin. */
export function cloudGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), top = lin(p.flame[0]), mid = lin(p.flame[1]), under = lin(p.flame[3]);
  const paint = (_x: number, y: number) => (y >= 2 ? top : y >= -1 ? mid : under);
  ball(g, 0, 0, 0, 10, 5.4, 6.5, paint);
  ball(g, -8, -1, 1, 6.5, 4.2, 5, paint);
  ball(g, 8, -1, -1, 6.5, 4.2, 5, paint);
  ball(g, 2, 4, 0, 5.5, 4, 4.5, paint);
  ball(g, -4, 3, -1, 4.5, 3.4, 4, paint);
  return g;
}

/** A balloon, in white: each one takes its colour as it is drawn. Its knot is at the origin, the string hangs below. */
export function balloonGrid(): Grid {
  const g = new Grid(PROP_VOXEL), white: RGB = [1, 1, 1], shade: RGB = [0.72, 0.72, 0.72], shine: RGB = [1.25, 1.25, 1.25];
  ball(g, 0, 6.5, 0, 4.6, 5.6, 4.6, (x, y, z) => (-x + y - 6.5 + z > 4.5 ? shine : x - z > 2.5 || y < 3 ? shade : white));
  fill(g, 0, 0, 0, 0, 1, 0, shade);
  for (let y = -1; y >= -9; y--) g.set(y % 4 === 0 ? 1 : 0, y, 0, [0.9, 0.9, 0.9]);
  return g;
}

/** A campfire: two crossed logs over embers on a bed of ash, ringed with stones. Stands on y = 0. */
export function campfireGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), bark = lin('#5a3a22'), end = lin('#9a7248'), char = lin('#2b1c12'), stone = lin('#8a8478'), stoneDark = lin('#6a655c');
  const ash = [lin('#3a302a'), lin('#4a3f38'), lin('#2e2622')], ember = [p.flame[1], p.flame[2], p.flame[3]].map(raw);
  for (let x = -11; x <= 11; x++) for (let z = -11; z <= 11; z++) if (Math.hypot(x, z) <= 10.6) g.set(x, 0, z, ash[Math.floor(hash3(x, 0, z, 2) * 3)]);
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (Math.hypot(x, z) < 4.6 && hash3(x, 1, z, 4) < 0.7) g.set(x, 1, z, ember[Math.floor(hash3(x, 2, z, 6) * 3)]);
  fill(g, -8, 1, -1, 8, 2, 0, (x, y) => (Math.abs(x) === 8 ? end : Math.abs(x) < 3 && y === 2 ? char : bark));
  fill(g, -1, 3, -8, 0, 4, 8, (_x, y, z) => (Math.abs(z) === 8 ? end : Math.abs(z) < 3 && y === 4 ? char : bark));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, x = Math.round(Math.cos(a) * 9), z = Math.round(Math.sin(a) * 9);
    fill(g, x - 1, 1, z - 1, x, 2, z, i % 2 ? stone : stoneDark);
  }
  return g;
}

/** A clump of heather: a low green mound and five spikes of small flowers leaning apart. Stands on y = 0. */
export function heatherGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), stem = lin('#4c7a3a'), leaf = [lin('#4c7a3a'), lin('#6a9a4a'), lin('#3f6a34')], bloom = [p.flame[1], p.flame[2], p.flame[3]].map(raw);
  [4.2, 3.6, 2.7].forEach((r, y) => { for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (Math.hypot(x, z) <= r) g.set(x, y, z, leaf[Math.floor(hash3(x, y, z, 7) * 3)]); });
  const spikes: [number, number, number, number, number][] = [[0, 0, 0, 0, 12], [-2, -1, -1, 0, 9], [2, 1, 1, 0, 10], [1, -2, 0, -1, 8], [-1, 2, 0, 1, 9]];
  spikes.forEach(([x0, z0, lx, lz, h], n) => {
    for (let y = 2; y <= h; y++) {
      const x = x0 + Math.round((lx * (y - 2)) / 5), z = z0 + Math.round((lz * (y - 2)) / 5);
      if (y < 5) { g.set(x, y, z, stem); continue; }
      g.set(x, y, z, y === h ? bloom[0] : bloom[(y + n) % 3]);
      if (y < h) { g.set(x + (y % 2 ? 1 : -1), y, z, bloom[(y + n + 1) % 3]); g.set(x, y, z + (y % 2 ? -1 : 1), bloom[(y + n + 2) % 3]); }
    }
  });
  return g;
}

/** A small sun: white at the heart, gold at the rim, with short rays all round. Centred on the origin. */
export function sunGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), f = p.flame.map(raw);
  ball(g, 0, 0, 0, 7, 7, 7, (x, y, z) => { const d = Math.hypot(x, y, z); return d < 3.6 ? f[0] : d < 5.6 ? f[1] : f[2]; });
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const n = Math.abs(x) + Math.abs(y) + Math.abs(z);
    if (n === 0 || n === 3) continue;
    const len = Math.hypot(x, y, z), from = n === 1 ? 8 : 7, to = n === 1 ? 12 : 10;
    for (let i = from; i <= to; i++) g.set(Math.round((x / len) * i), Math.round((y / len) * i), Math.round((z / len) * i), i > to - 2 ? f[3] : f[2]);
  }
  return g;
}

/** A paper lantern: a warm glowing shade between two dark caps, with a loop to hold it by. Its foot is at y = 0. */
export function lanternGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), f = p.flame.map(raw), cap = lin('#5a3a22');
  for (let y = 1; y <= 9; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    if (Math.abs(x) === 3 && Math.abs(z) === 3) continue;
    const bulge = y === 1 || y === 9 ? 2 : 3;
    if (Math.abs(x) > bulge || Math.abs(z) > bulge) continue;
    const rib = (Math.abs(x) === bulge || Math.abs(z) === bulge) && (x + z) % 2 === 0;
    g.set(x, y, z, rib ? f[3] : y >= 4 && y <= 6 ? f[1] : f[2]);
  }
  fill(g, -2, 0, -2, 2, 0, 2, cap);
  fill(g, -2, 10, -2, 2, 10, 2, cap);
  g.set(-1, 11, 0, cap); g.set(1, 11, 0, cap); g.set(-1, 12, 0, cap); g.set(1, 12, 0, cap); g.set(0, 13, 0, cap);
  return g;
}

/** A star: a bright heart with six long points and twelve short ones. Centred on the origin. */
export function starGrid(p: BurstPalette): Grid {
  const g = new Grid(PROP_VOXEL), f = p.flame.map(raw);
  fill(g, -1, -1, -1, 1, 1, 1, f[0]);
  for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    for (let i = 2; i <= 6; i++) {
      g.set(x * i, y * i, z * i, i < 4 ? f[1] : f[2]);
      if (i < 4) for (const [a, b, c] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (a * x + b * y + c * z === 0) g.set(x * i + a, y * i + b, z * i + c, f[1]);
    }
  }
  for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let i = 2; i <= 3; i++) g.set(x * i, y * i, 0, f[2]);
  return g;
}

/** Copies a model's voxels into another grid at an offset, optionally tinted (a white balloon into its colour). */
export function stamp(dst: Grid, src: Grid, ox = 0, oy = 0, oz = 0, tint?: RGB) {
  for (const v of src.map.values()) dst.set(v.x + ox, v.y + oy, v.z + oz, tint ? [v.c[0] * tint[0], v.c[1] * tint[1], v.c[2] * tint[2]] : v.c);
}

/** The thing a burst puts where the bomb was, in the burst's own colours; none for the frost ball and the aurora, which are light alone. */
export function propGrid(shape: BurstShape, p: BurstPalette): Grid | null {
  switch (shape) {
    case 'haystack': return haystackGrid(p);
    case 'snowcloud': return cloudGrid(p);
    case 'balloons': return balloonGrid();
    case 'campfire': return campfireGrid(p);
    case 'heather': return heatherGrid(p);
    case 'sun': return sunGrid(p);
    case 'lanterns': return lanternGrid(p);
    case 'stars': return starGrid(p);
    default: return null;
  }
}
