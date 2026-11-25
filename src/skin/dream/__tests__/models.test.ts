import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error the packer is a plain script
import { OUT, render } from '../../../../tools/dream/packModels.mjs';
import { cellCounts, meshModel } from '../models';
import { COLOURS, GLOW, MODELS, WORLDS } from '../models.gen';
import { LADDER } from '../../voxel/paint';

const DIR = 'docs/dream/v3/data/models';
const json = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')));

describe('the dream models (docs/dream/v3/03)', () => {
  it('models.gen.ts is exactly what the packer makes from the pack', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(render());
  });
  it('holds all 69 models and 2,491 boxes, and every colour is LADDER or a named glow', () => {
    expect(Object.keys(MODELS)).toHaveLength(69);
    expect(Object.values(MODELS).reduce((n, m) => n + m.boxes.length, 0)).toBe(2491);
    for (const c of COLOURS) {
      const [mat, step] = c.split(':');
      if (mat === 'glow') expect(GLOW[step]).toBeTruthy();
      else { expect(mat in LADDER).toBe(true); expect(Math.abs(Number(step))).toBeLessThanOrEqual(2); }
    }
  });
  it('every model built has the cells, bounds and colours its JSON gives', () => {
    for (const j of json) {
      const m = MODELS[j.id];
      expect(m.bounds).toEqual(j.bounds_cells);
      const want: Record<string, number> = {};
      const seen = new Set<string>();
      for (const b of j.boxes) for (let x = b.b[0]; x < b.b[3]; x++) for (let y = b.b[1]; y < b.b[4]; y++) for (let z = b.b[2]; z < b.b[5]; z++) {
        const k = `${x},${y},${z}`;
        if (seen.has(k)) continue;
        seen.add(k); want[b.c] = (want[b.c] ?? 0) + 1;
      }
      const got = cellCounts(m, COLOURS);
      expect(got.cells, j.id).toBe(seen.size);
      expect(got.byColour, j.id).toEqual(want);
      expect(meshModel(j.id, m, COLOURS, GLOW, { festive: true, back: true }).cells, j.id).toBe(seen.size);
    }
  });
  it('places only models it has', () => {
    for (const w of Object.values(WORLDS)) for (const p of w.placed) expect(MODELS[p[0] as string], String(p[0])).toBeTruthy();
  });
});
