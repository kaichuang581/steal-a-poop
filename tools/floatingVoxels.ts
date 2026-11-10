/**
 * Finds voxels that float: pieces of a scene that touch nothing else (no shared face or edge with any voxel of any grid
 * in that scene, the ground included). Builds each scene the way the game does, catching every voxel model the mesher
 * is given (the `__voxelHook` in mesher.ts), lays all of them in world space and joins touching voxels. Every piece not
 * joined to the scene's biggest one (the ground) is listed with the code that built it.
 *
 *   npx vite-node tools/floatingVoxels.ts -- [scene] [--all] [--props] [--detail=<file>] [--strict]
 *   npm run check:floating   (every scene, --strict: exits 1 if anything floats)
 *
 * Placed by their meshes, not in world space, so they are known to stand apart: the distant hills and mountains
 * (`buildDistance`) and the bedroom's clock, ring and glowing window view.
 */
import { readFileSync } from 'node:fs';
let loose = 0;
/** Pieces placed by their own meshes: the distance, and every bedroom part but the room itself (read off the source line). */
function placed(label: string): boolean {
  if (/buildDistance/.test(label)) return true;
  const m = /dream\/bedroom\.ts:(\d+)/.exec(label);
  if (!m) return false;
  const line = readFileSync(new URL('../src/skin/dream/bedroom.ts', import.meta.url), 'utf8').split('\n')[+m[1] - 1] ?? '';
  return !/\broom:/.test(line);
}
import type { VoxelMap } from '../src/skin/voxel/mesher';

interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; src: number; c: [number, number, number] }
const sources: string[] = [];
let boxes: Box[] = [];
let srcOf = new Map<string, number>();

function caller(): string {
  const lines = (new Error().stack ?? '').split('\n').slice(3);
  const own = lines.filter((l) => /src\/skin/.test(l) && !/mesher\.ts|refine\.ts|primitives\.ts/.test(l)).slice(0, 2);
  return own.map((l) => l.trim().replace(/^at /, '').replace(/\(?\/.*\/src\/skin\//, '').replace(/\)$/, '').replace(/:\d+$/, '')).join(' < ');
}

(globalThis as { __voxelHook?: (vox: VoxelMap, size: number) => void }).__voxelHook = (vox, size) => {
  const label = caller();
  let id = srcOf.get(label);
  if (id === undefined) { id = sources.length; sources.push(label); srcOf.set(label, id); }
  for (const v of vox.values()) boxes.push({ x0: v.x * size, y0: v.y * size, z0: v.z * size, x1: (v.x + 1) * size, y1: (v.y + 1) * size, z1: (v.z + 1) * size, src: id, c: v.c });
};

const EPS = 1e-4;
/** Two voxels touch when they share a face or an edge (overlap on at least one axis, meet or overlap on the others). */
function touch(a: Box, b: Box): boolean {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  if (ox < -EPS || oy < -EPS || oz < -EPS) return false;
  return (ox > EPS ? 1 : 0) + (oy > EPS ? 1 : 0) + (oz > EPS ? 1 : 0) >= 1;
}

function analyse(scene: string, showAll: boolean) {
  const n = boxes.length;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const C = 0.5;
  const hash = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    for (let x = Math.floor((b.x0 - EPS) / C); x <= Math.floor((b.x1 + EPS) / C); x++)
      for (let y = Math.floor((b.y0 - EPS) / C); y <= Math.floor((b.y1 + EPS) / C); y++)
        for (let z = Math.floor((b.z0 - EPS) / C); z <= Math.floor((b.z1 + EPS) / C); z++) {
          const k = `${x},${y},${z}`;
          let cell = hash.get(k);
          if (!cell) hash.set(k, (cell = []));
          for (const j of cell) if (find(i) !== find(j) && touch(b, boxes[j])) union(i, j);
          cell.push(i);
        }
  }
  const comps = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = find(i); let c = comps.get(r); if (!c) comps.set(r, (c = [])); c.push(i); }
  const list = [...comps.values()].sort((a, b) => b.length - a.length);
  const main = list[0];
  console.log(`\n### ${scene}: ${n} voxels, ${list.length} pieces; the ground piece has ${main.length}`);
  const bySrc = new Map<number, { pieces: number; voxels: number; at: string[] }>();
  for (const c of list.slice(1)) {
    const srcs = new Map<number, number>();
    for (const i of c) srcs.set(boxes[i].src, (srcs.get(boxes[i].src) ?? 0) + 1);
    const top = [...srcs].sort((a, b) => b[1] - a[1])[0][0];
    const e = bySrc.get(top) ?? { pieces: 0, voxels: 0, at: [] };
    e.pieces++; e.voxels += c.length;
    const b = boxes[c[0]];
    if (e.at.length < 4) e.at.push(`(${b.x0.toFixed(2)}, ${b.y0.toFixed(2)}, ${b.z0.toFixed(2)})×${c.length}`);
    bySrc.set(top, e);
  }
  const detail = process.argv.find((a) => a.startsWith('--detail='))?.slice(9);
  if (detail) {
    for (const c of list.slice(1)) {
      if (!c.some((i) => sources[boxes[i].src].includes(detail))) continue;
      const bb = c.reduce((m, i) => { const b = boxes[i]; return { x0: Math.min(m.x0, b.x0), y0: Math.min(m.y0, b.y0), z0: Math.min(m.z0, b.z0), x1: Math.max(m.x1, b.x1), y1: Math.max(m.y1, b.y1), z1: Math.max(m.z1, b.z1) }; }, { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 });
      // The gap under the piece: the highest top of any other voxel under its footprint, below its bottom.
      let below = -Infinity;
      const mine = new Set(c);
      for (let i = 0; i < n; i++) {
        if (mine.has(i)) continue;
        const b = boxes[i];
        if (b.x1 <= bb.x0 || b.x0 >= bb.x1 || b.z1 <= bb.z0 || b.z0 >= bb.z1 || b.y1 > bb.y0 + EPS) continue;
        below = Math.max(below, b.y1);
      }
      const size = boxes[c[0]].x1 - boxes[c[0]].x0;
      const avg = [0, 1, 2].map((k) => c.reduce((t, i) => t + boxes[i].c[k], 0) / c.length);
      const hex = '#' + avg.map((v) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('');
      console.log(`    ${c.length} vox @${size.toFixed(2)}  x ${bb.x0.toFixed(2)}..${bb.x1.toFixed(2)}  y ${bb.y0.toFixed(2)}..${bb.y1.toFixed(2)}  z ${bb.z0.toFixed(2)}..${bb.z1.toFixed(2)}  gap below ${(bb.y0 - below).toFixed(2)}  ${hex}  ${sources[boxes[c[0]].src]}`);
    }
  }
  // A piece whose foot is at y = 0 stands on the floor (the bomb's ice bits, the second of two round bales).
  for (const c of list.slice(1)) {
    const src = boxes[c[0]].src;
    const low = c.reduce((m, i) => Math.min(m, boxes[i].y0), Infinity);
    if (!placed(sources[src]) && low > EPS) loose++;
  }
  for (const [src, e] of [...bySrc].sort((a, b) => b[1].pieces - a[1].pieces)) {
    if (!showAll && e.pieces < 1) continue;
    console.log(`  ${String(e.pieces).padStart(5)} pieces ${String(e.voxels).padStart(6)} vox  ${sources[src]}   e.g. ${e.at.join(' ')}`);
  }
}

async function run(scene: string, build: () => unknown | Promise<unknown>, all: boolean) {
  boxes = []; srcOf = new Map(); sources.length = 0;
  await build();
  analyse(scene, all);
}

const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = process.argv.includes('--all');
const scenes: Record<string, () => Promise<unknown>> = {
  table: async () => {
    const [{ buildBarn }, { buildYard }, { buildFestive }, { buildDistance }] = await Promise.all([import('../src/skin/scene/barn'), import('../src/skin/scene/yard'), import('../src/skin/scene/festive'), import('../src/skin/scene/distance')]);
    buildBarn(); buildYard(); buildFestive(); buildDistance();
  },
  farm: async () => {
    const [{ buildBarn }, { buildYard }, { buildFestive, buildFarmFestive }, { buildFarmstead }, { buildCountryside }, { buildDistance }] = await Promise.all([
      import('../src/skin/scene/barn'), import('../src/skin/scene/yard'), import('../src/skin/scene/festive'), import('../src/skin/scene/farmstead'), import('../src/skin/scene/countryside'), import('../src/skin/scene/distance')]);
    buildBarn(); buildYard(); buildFestive(); buildFarmstead(); buildCountryside(); buildFarmFestive(); buildDistance();
  },
  duel: async () => {
    const [{ buildDuel }, { buildDuelFestive }] = await Promise.all([import('../src/skin/scene/duel'), import('../src/skin/scene/festive')]);
    buildDuel(); buildDuelFestive();
  },
  bedroom: async () => { const { bedroomGeometry } = await import('../src/skin/dream/bedroom'); bedroomGeometry(); },
};
// Props that stand alone: each should be a single piece.
const props: Record<string, () => Promise<unknown>> = {
  ...Object.fromEntries((['rail', 'picket', 'wall', 'log'] as const).map((look) => [`fence:${look}`, async () => { const w = await import('../src/skin/dream/world'); w.obstacle(w.lookOf('fence', ['rail', 'picket', 'wall', 'log'].indexOf(look))); }])),
  'bale': async () => { const w = await import('../src/skin/dream/world'); w.obstacle(w.lookOf('bale', 0)); },
  'sign post': async () => { const w = await import('../src/skin/dream/world'); w.fenceSign(['G', 'R']); },
  'bomb': async () => { const b = await import('../src/skin/voxel/bomb'); b.bombModel(); },
  'trophy': async () => { const t = await import('../src/skin/voxel/trophy'); t.trophyGeometry(); },
};
if (process.argv.includes('--props')) for (const [name, build] of Object.entries(props)) await run(name, build, all);
for (const [name, build] of Object.entries(scenes)) if (!want.length || want.includes(name)) await run(name, build, all);
if (process.argv.includes('--strict')) {
  console.log(loose ? `\n${loose} floating piece(s).` : '\nNothing floats.');
  process.exit(loose ? 1 : 0);
}
