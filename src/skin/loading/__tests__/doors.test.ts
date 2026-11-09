import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOOR_BOXES, DOOR_PARTS, LEAF_W } from '../doorsModel';
import type { DoorPart } from '../doorsModel';

describe('the loading screen doors', () => {
  for (const part of Object.keys(DOOR_PARTS) as DoorPart[]) {
    it(`${part}: every voxel sits inside the part's frame, so the baked images line up on screen`, () => {
      const box = DOOR_BOXES[part];
      for (const v of DOOR_PARTS[part]().map.values()) {
        expect(v.x, `${part} x`).toBeGreaterThanOrEqual(box.x0);
        expect(v.x, `${part} x`).toBeLessThan(box.x0 + box.w);
        expect(v.y, `${part} y`).toBeGreaterThanOrEqual(box.y0);
        expect(v.y, `${part} y`).toBeLessThan(box.y0 + box.h);
      }
    });

    it(`${part}: is built the same every time, and its image is baked`, () => {
      const a = [...DOOR_PARTS[part]().map.entries()].map(([k, v]) => `${k}:${v.c.map((n) => n.toFixed(4))}`);
      const b = [...DOOR_PARTS[part]().map.entries()].map(([k, v]) => `${k}:${v.c.map((n) => n.toFixed(4))}`);
      expect(a).toEqual(b);
      const file = `public/loading/doors-${part}.webp`;
      expect(existsSync(file), `${file}: run node tools/renderDoors.mjs`).toBe(true);
      expect(statSync(file).size).toBeLessThan(200 * 1024);
    });
  }

  it('the two leaves meet exactly at the middle, so the crack is the middle of the screen', () => {
    const leaves = DOOR_PARTS.leaves().map;
    for (let y = 0; y < DOOR_BOXES.leaves.h; y++) {
      expect(leaves.get(`${LEAF_W - 1},${y},0`), `left crack row ${y}`).toBeTruthy();
      expect(leaves.get(`${LEAF_W},${y},0`), `right crack row ${y}`).toBeTruthy();
      expect(leaves.has(`${LEAF_W - 1},${y},1`) || leaves.has(`${LEAF_W},${y},1`)).toBe(false);
    }
  });
});
