import { describe, expect, it } from 'vitest';
import type { VoxelMap } from '../mesher';
import { refine } from '../refine';

const model = (cells: [number, number, number][]): VoxelMap =>
  new Map(cells.map(([x, y, z]) => [`${x},${y},${z}`, { x, y, z, c: [0.5, 0.5, 0.5] as [number, number, number] }]));

describe('refine', () => {
  it('takes the corners off a lone cell but keeps its heart', () => {
    expect(refine(model([[0, 0, 0]])).size).toBe(0);
    const rail = refine(model([[0, 0, 0], [1, 0, 0], [2, 0, 0]]));
    expect(rail.has('2,0,0')).toBe(true);
  });
  it('leaves a one-cell rail whole along its length', () => {
    const rail = refine(model([[0, 0, 0], [1, 0, 0], [2, 0, 0]]));
    for (const k of ['2,0,0', '2,1,0', '2,0,1', '2,1,1', '3,0,0', '3,1,1']) expect(rail.has(k)).toBe(true);
  });
  it('softens a solid block\'s outer edge and keeps its middle', () => {
    const cells: [number, number, number][] = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) cells.push([x, y, z]);
    const block = refine(model(cells));
    expect(block.has('5,5,2')).toBe(false); // on the top edge
    expect(block.has('2,5,2')).toBe(true); // on the top face
    expect(block.has('2,2,2')).toBe(true); // inside
  });
  it('leaves out cells it is told to, while they still hold up their neighbours', () => {
    const out = refine(model([[0, -1, 0], [0, 0, 0]]), 0, (v) => v.y >= 0);
    expect([...out.values()].every((v) => v.y >= 0)).toBe(true);
    expect(out.has('0,0,0')).toBe(true);
  });
  it('keeps the colour exactly when there is no grain', () => {
    expect([...refine(model([[0, 0, 0], [1, 0, 0]]), 0).values()][0].c).toEqual([0.5, 0.5, 0.5]);
  });
});
