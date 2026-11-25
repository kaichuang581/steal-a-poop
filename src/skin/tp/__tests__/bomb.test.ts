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
  it("the fuse's last piece ends where each skin's spark glow is", () => {
    for (const s of Object.values(SKINS)) {
      const [x, y] = fuseCentre(s, FUSE_PIECES - 1);
      expect(x).toBe(9);
      expect(y).toBe(s.cap_top_cells + 4); // the tip's cube spans y-1 to y+1; the glow sits on its top
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
