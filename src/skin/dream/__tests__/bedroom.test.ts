import { describe, expect, it } from 'vitest';
import { bedroomGeometry, quiltSat } from '../bedroom';

const tris = (g: { index: { count: number } | null }) => (g.index?.count ?? 0) / 3;

describe("the farmer's bedroom", () => {
  it('builds every piece, and the room keeps to its triangle budget once the unseen faces are culled', () => {
    const b = bedroomGeometry();
    for (const g of Object.values(b)) expect(tris(g)).toBeGreaterThan(0);
    // The whole room is one mesh; with the walls' backs and the floor's underside dropped it stays well under 100k.
    expect(tris(b.room)).toBeLessThan(70_000);
    expect(tris(b.room) + tris(b.glow)).toBeLessThan(100_000);
  });
  it('builds the quilt he sits up out of', () => {
    expect(tris(quiltSat())).toBeGreaterThan(0);
  });
});
