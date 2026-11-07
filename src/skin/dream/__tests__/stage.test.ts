import { describe, expect, it } from 'vitest';
import { FIELD } from '../../../dream/dream';
import { atFrame, CHUNK, chunkPlacements, DESKTOP_SHOT, frameOf, islandPlace, ISLANDS, islandX, PHONE_SHOT, PUFFS, PX, scrollOf, worldX } from '../stage';
import { cloudSea, FENCE_LOOKS, hillHeight, hills, island, lookOf, mountainHeight, mountains, obstacle, raftChunk, raftRise } from '../world';

describe('the dream stage (V4 Part 4)', () => {
  it('maps logical pixels to metres: the sheep at 0, the spawn and type windows ahead', () => {
    expect(worldX(FIELD.sheepX)).toBeCloseTo(0, 6);
    expect(PX).toBe(0.036);
    expect(worldX(320 + 24)).toBeCloseTo((320 + 24 - 78) * 0.036, 6);
    expect(worldX(320 + 70)).toBeCloseTo((320 + 70 - 78) * 0.036, 6);
    expect(FIELD.sheepW * PX).toBeCloseTo(0.72, 6);
    expect(scrollOf(100)).toBeCloseTo(3.6, 6);
  });
  it('keeps the chunk ring whole: after one ring of scroll every chunk has gone round exactly once and none overlap', () => {
    const span = CHUNK.size * CHUNK.count;
    for (const scroll of [0, 3, 11, span, span + 1.5]) {
      const xs = chunkPlacements(scroll).map((p) => p.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(CHUNK.size, 6);
      expect(xs[0]).toBeGreaterThanOrEqual(CHUNK.from);
      expect(xs[xs.length - 1]).toBeLessThan(CHUNK.from + span);
    }
    for (const p of chunkPlacements(span)) expect(p.gen).toBe(1);
  });
  it('frames the plan\'s positions: horizon, sheep, first fence and raft edges (V4.1 Part 3)', () => {
    const at = (p: readonly [number, number, number]) => frameOf(DESKTOP_SHOT, 16 / 9, p);
    expect(at([0, 0, 0])[0]).toBeCloseTo(22.5, 0);
    expect(at([5.4, 0, 0])[0]).toBeCloseTo(82, 0);
    expect(at([0, 0, 0])[1]).toBeGreaterThan(64);
    expect(at([0, 0, 2])[1]).toBeCloseTo(75, 0);
    expect(at([0, 0, -3])[1]).toBeCloseTo(58, 0);
    expect(at([2.5, 1.6, -5000])[1]).toBeCloseTo(34.7, 0);
    expect(DESKTOP_SHOT.fov).toBe(32);
    expect(PHONE_SHOT.fov).toBe(44);
  });
  it('puts the phone\'s sheep at (30, 58) with the first fence in view', () => {
    const at = (p: readonly [number, number, number]) => frameOf(PHONE_SHOT, 390 / 844, p);
    expect(at([0, 0, 0])[0]).toBeCloseTo(30, 0);
    expect(at([0, 0, 0])[1]).toBeCloseTo(58, 0);
    expect(at([5.4, 0, 0])[0]).toBeLessThan(92);
  });
  it('keeps the islands to the plan\'s rules: in frame with a margin, clear of the lane, none too wide', () => {
    for (const it of ISLANDS) {
      const [x0, x1, y0, y1] = it.box;
      expect(x1 - x0).toBeLessThanOrEqual(16);
      expect(x0).toBeGreaterThanOrEqual(4);
      expect(x1).toBeLessThanOrEqual(96);
      expect(y0).toBeGreaterThanOrEqual(4);
      expect(y1).toBeLessThan(58);
      expect(it.z).toBeLessThanOrEqual(-10);
      const p = islandPlace(it);
      expect(frameOf(DESKTOP_SHOT, 16 / 9, [p.x, p.y, it.z])[1]).toBeCloseTo(y0, 3);
      expect(islandX(it, 0, p.x, p.across)).toBeCloseTo(p.x, 6);
    }
  });
  it('sends an island off the left and back in on the right, at its own pace', () => {
    const it = ISLANDS[0], p = islandPlace(it);
    let wrapped = false;
    for (let s = 0; s < 800; s += 2) if (islandX(it, s + 2, p.x, p.across) > islandX(it, s, p.x, p.across)) wrapped = true;
    expect(wrapped).toBe(true);
  });
  it('keeps the thought trail off the sheep and ends it on the near ridge', () => {
    const [hooves] = [frameOf(DESKTOP_SHOT, 16 / 9, [0, 0, 0])];
    for (const [x, y, w] of PUFFS) expect(y > hooves[1] + 2 || x - w / 2 > hooves[0] + 6).toBe(true);
    expect(PUFFS[2][1]).toBeGreaterThanOrEqual(73);
  });
  it('turns a frame position back into a world point', () => {
    const p = atFrame(DESKTOP_SHOT, 16 / 9, 88, 10, -150);
    const [x, y] = frameOf(DESKTOP_SHOT, 16 / 9, p);
    expect(x).toBeCloseTo(88, 4);
    expect(y).toBeCloseTo(10, 4);
    expect(p[2]).toBe(-150);
  });
});

describe('the dream\'s world (V4.1 Parts 5 and 6)', () => {
  const tris = (g: { index: { count: number } | null }) => (g.index?.count ?? 0) / 3;
  it('builds every raft chunk, its two grids merged into one mesh', () => {
    for (let i = 0; i < CHUNK.count; i++) expect(tris(raftChunk(i))).toBeGreaterThan(1000);
  });
  it('keeps the lane and the near side flat, and lets the far strip drifts rise a voxel at a time', () => {
    for (let x = 0; x < 24; x += 0.1) for (let z = -3; z < 2; z += 0.1) {
      const r = raftRise(x, z);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(5);
      if (z > -1.15) expect(r).toBe(0);
      expect(Math.abs(r - raftRise(x + 0.1, z))).toBeLessThanOrEqual(1);
    }
  });
  it('builds every obstacle across the whole lane, none taller than the jump clears', () => {
    for (const look of [...FENCE_LOOKS, 'bale'] as const) {
      const g = obstacle(look);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.y).toBeLessThanOrEqual(0.72);
      expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeGreaterThan(2);
    }
    expect(lookOf('fence', 0)).toBe('rail');
    expect(lookOf('bale', 12)).toBe('bale');
    expect(new Set(Array.from({ length: 30 }, (_, i) => lookOf('fence', i))).size).toBe(4);
  });
  it('holds the far voxels under 1.6% of the frame\'s height (Part 5.3)', () => {
    const frameHeight = (z: number) => 2 * Math.tan((16 * Math.PI) / 180) * (DESKTOP_SHOT.position[2] - z);
    expect(0.5 / frameHeight(-50)).toBeLessThanOrEqual(0.016);
    expect(1 / frameHeight(-100)).toBeLessThanOrEqual(0.0161);
  });
  it('shapes the ranges inside the plan\'s heights, repeating without a seam', () => {
    for (let x = -80; x < 80; x += 0.5) {
      const h = hillHeight(x), m = mountainHeight(x);
      expect(h).toBeGreaterThan(3.5);
      expect(h).toBeLessThan(7.2);
      expect(m).toBeGreaterThan(12);
      expect(m).toBeLessThan(20);
      expect(hillHeight(x + 160)).toBeCloseTo(h, 6);
      expect(mountainHeight(x + 200)).toBeCloseTo(m, 6);
    }
  });
  it('builds the sea, the ranges and the three islands', () => {
    for (const g of [cloudSea(), cloudSea(true), hills(), mountains()]) expect(tris(g)).toBeGreaterThan(1000);
    expect(tris(cloudSea(true))).toBeLessThan(tris(cloudSea()));
    for (const it of ISLANDS) { const p = islandPlace(it); expect(tris(island(it.kind, p.across, p.tall, 1).body)).toBeGreaterThan(200); }
  });
});
