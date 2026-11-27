import { describe, expect, it } from 'vitest';
import { FUSE_PIECES, fuseCentre, fusePiecesFor } from '../bomb';
import { SKINS } from '../models.gen';

describe('the bomb (T2)', () => {
  it('the fuse burns piece by piece: s = 1 gives 12, 0.34 gives 5, 0.01 gives 1', () => {
    expect(fusePiecesFor(1)).toBe(12);
    expect(fusePiecesFor(0.34)).toBe(5);
    expect(fusePiecesFor(0.01)).toBe(1);
    expect(fusePiecesFor(0)).toBe(0);
  });
  it('each fuse piece is one 2 x 2 x 2 block of the model, and the twelve hold every fuse box (ITEMS_REMODEL.md)', async () => {
    const { MODELS, PARTS } = await import('../models');
    const { fuseCube } = await import('../bomb');
    for (const s of Object.values(SKINS)) {
      const fuse = MODELS[`bomb_${s.key}`].boxes.filter((b) => b[7] === PARTS.indexOf('fuse'));
      const cubes = Array.from({ length: FUSE_PIECES }, (_, k) => fuseCube(s, k));
      for (const b of fuse) expect(cubes.some(({ at: [x, y], size }) => b[0] >= x && b[3] <= x + size && b[1] >= y && b[4] <= y + size), s.key).toBe(true);
      expect(fuseCentre(s, 0)[1], s.key).toBeGreaterThan(s.fuse_start_cells[1]);
    }
  });
});

describe('the bursts (T3)', () => {
  it('each has at most 24 pieces and three colours, and is whole at 300 ms and gone at 1,400', async () => {
    const { makeBurst } = await import('../burst');
    const { BURSTS } = await import('../models.gen');
    for (const key of Object.keys(BURSTS)) {
      const b = makeBurst(key);
      expect(BURSTS[key].pieces, key).toBeLessThanOrEqual(24);
      // Three named colours each (T3). Lantern Glow and Northern Lights also use one accent from the shared list (the data wins).
      expect(Object.keys(BURSTS[key].colours).length, key).toBeLessThanOrEqual(3);
      expect(new Set(BURSTS[key].boxes_at_fullest.map((x) => x[6])).size, key).toBeLessThanOrEqual(4);
      b.at(300);
      expect(b.group.visible).toBe(true);
      b.at(1400);
      expect(b.group.visible).toBe(false);
    }
  });
});

describe('bursts on display (ITEMS_REMODEL.md rule 7, T3 section 3)', () => {
  it('every burst fits its bench slot, Barn Book frame and Bell Shelf stand, drawn in at no more than the plan says', async () => {
    const { drawnSize } = await import('../burst');
    const { SLOT, spreadFor } = await import('../market/world');
    const { BURSTS } = await import('../models.gen');
    for (const key of Object.keys(BURSTS)) for (const slot of ['bench', 'book', 'shelf'] as const) {
      const s = spreadFor(key, slot), [w, h] = drawnSize(key, s);
      expect(s, `${key} ${slot}`).toBeLessThanOrEqual(SLOT[slot].most);
      expect(w, `${key} ${slot} width`).toBeLessThanOrEqual(SLOT[slot].w + 1e-6);
      expect(h, `${key} ${slot} height`).toBeLessThanOrEqual(SLOT[slot].h + 1e-6);
    }
  });
});

describe('the seconds on the face, in cubes (digits.ts)', () => {
  it('every number from 0 to 99 is a whole block of rows that fits the face, and no two numbers look alike', async () => {
    const { FACE_ACROSS, secondsModel, secondsRows } = await import('../digits');
    const seen = new Set<string>();
    for (let n = 0; n <= 99; n++) {
      const rows = secondsRows(n);
      expect(new Set(rows.map((r) => r.length)).size, `${n}: rows of one length`).toBe(1);
      expect(rows[0].length, `${n}: width`).toBeLessThanOrEqual(FACE_ACROSS);
      // The face's full-width rows are its middle eight; a single digit is narrow enough for the two shorter rows above and below.
      expect(rows.length, `${n}: height`).toBeLessThanOrEqual(n < 10 ? 10 : 8);
      if (n < 10) expect(rows[0].length, `${n}: a single digit clears the face's cut corners`).toBeLessThanOrEqual(8);
      seen.add(rows.join('\n'));
      const { data, w, h } = secondsModel(n, 1);
      const cubes = data.boxes.reduce((sum, b) => sum + (b[3] - b[0]) * (b[4] - b[1]), 0);
      expect(cubes, `${n}: a cube for every X`).toBe(rows.join('').split('X').length - 1);
      expect([w, h]).toEqual([rows[0].length, rows.length]);
    }
    expect(seen.size).toBe(100);
  });
});
