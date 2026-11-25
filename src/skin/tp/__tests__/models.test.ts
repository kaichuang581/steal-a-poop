import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error the packer is a plain script
import { OUT, OUT_MARKET, OUT_RINK, renderAll } from '../../../../tools/tp/packModels.mjs';
import { GLOW } from '../models.gen';
import { MARKET_MODELS } from '../market.gen';
import { RINK_MODELS } from '../rink.gen';
import { LADDER } from '../../voxel/paint';
import { addModels, COLOURS, MODELS, PARTS, tpMesh } from '../models';

addModels(MARKET_MODELS);
addModels(RINK_MODELS);

const index = JSON.parse(readFileSync('docs/trading-post-practice/data/models/index.json', 'utf8')).models as { id: string; size_m: number[] }[];

/** The extent of a mesh's positions, metres, per axis. */
function extent(pos: number[]): number[] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  return hi.map((h, k) => h - lo[k]);
}

describe('the Trading Post and Practice models (X2 S1)', () => {
  it('the three generated files are exactly what the packer makes from the pack', () => {
    const all = renderAll();
    expect(readFileSync(OUT, 'utf8')).toBe(all.core);
    expect(readFileSync(OUT_MARKET, 'utf8')).toBe(all.market);
    expect(readFileSync(OUT_RINK, 'utf8')).toBe(all.rink);
  });
  it('holds every model of the index, and every colour is LADDER, a named glow or a plain hex', () => {
    expect(Object.keys(MODELS).sort()).toEqual([...index.map((m) => m.id), 'fenceBay'].sort()); // plus Home's fence bay, given form
    for (const c of COLOURS) {
      const [mat, step] = c.split(':');
      if (c.startsWith('#') || mat === 'lit') expect(c).toMatch(/^(lit:)?#[0-9A-F]{6}$/i);
      else if (mat === 'glow') expect(GLOW[step], c).toBeTruthy();
      else expect(mat in LADDER, c).toBe(true);
    }
  });
  it("each built model's bounding box equals its packed size within 1 mm, and the props' form (plinths, caps) adds at most a cell a side", () => {
    for (const { id, size_m } of index) {
      const mm = tpMesh(id, { festive: true, back: true });
      const e = extent([...mm.lit.pos, ...mm.glow.pos]);
      e.forEach((v, k) => expect(Math.abs(v - MODELS[id].size[k]), `${id} axis ${k}`).toBeLessThan(0.001));
      MODELS[id].size.forEach((v, k) => expect(v - size_m[k], `${id} axis ${k} grew`).toBeLessThanOrEqual(0.1 + 1e-6));
      if (/^bomb_|^sound_/.test(id)) MODELS[id].size.forEach((v, k) => expect(Math.abs(v - size_m[k]), `${id} unchanged`).toBeLessThan(0.001));
    }
  });
  it('every bomb has shell, face, cap, fuse and spark, plus detail where the skin has one, and no mark (T2, VOXEL_GRAIN.md)', () => {
    const six = ['cap', 'detail', 'face', 'fuse', 'shell', 'spark'];
    for (const id of Object.keys(MODELS).filter((k) => k.startsWith('bomb_'))) {
      const parts = new Set(MODELS[id].boxes.map((b) => PARTS[b[7]]));
      for (const p of parts) expect(six, `${id} ${p}`).toContain(p);
      for (const p of six.filter((q) => q !== 'detail')) expect(parts.has(p), `${id} ${p}`).toBe(true);
    }
  });
});
