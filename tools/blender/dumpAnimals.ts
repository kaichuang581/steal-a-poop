// Writes every animal's voxels, as the game builds them, for tools/blender/lineup.py to render in Blender.
//   npx vite-node tools/blender/dumpAnimals.ts -- [--out <file.json>] [--level 0..4]
// Each species: its draw scale, the head's pivot and resting pitch, and its cells (grid x, y, z and linear r, g, b) in
// two groups, the body and the head (which Blender turns by the pitch about the pivot). Non-sheep species at level 0
// show their bare body; the sheep always shows its fleece (level 2 unless asked).
import { writeFileSync } from 'node:fs';
import { animalModel } from '../../src/skin/voxel/animals';
import type { AnimalModel } from '../../src/skin/voxel/animals';
import type { VoxelMap } from '../../src/skin/voxel/mesher';
import { S } from '../../src/skin/voxel/animals/rig';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'animals.json');
const level = Number(arg('level', '0')) as 0 | 1 | 2 | 3 | 4;
const SPECIES = ['cow', 'sheep', 'chicken', 'horse', 'pig', 'goat'] as const;

type Cell = [number, number, number, number, number, number];
const cellsOf = (m: VoxelMap | undefined): Cell[] => [...(m?.values() ?? [])].map((v) => [v.x, v.y, v.z, v.c[0], v.c[1], v.c[2]]);
const result: Record<string, unknown> = {};
for (const sp of SPECIES) {
  const m = animalModel(sp) as AnimalModel;
  const lv = sp === 'sheep' && level === 0 ? 2 : level;
  const body = lv === 0 ? m.sheared : m.wools[lv as 1 | 2 | 3 | 4];
  const bodyParts = [body, m.neck, m.tail, ...m.legs, ...m.signature.filter((p) => p.where === 'body')];
  const headParts = [m.head, m.hood, ...m.eyes, ...m.ears, ...m.signature.filter((p) => p.where === 'head')];
  const join = (ps: ({ cells?: VoxelMap } | undefined)[]) => ps.flatMap((p) => cellsOf(p?.cells));
  result[sp] = { size: S, drawScale: m.drawScale, headPivot: m.head.pivot, headPitch: m.headPitch ?? 0, body: join(bodyParts), head: join(headParts) };
}
writeFileSync(out, JSON.stringify(result));
console.log(out);
