import { describe, expect, it } from 'vitest';
import { box, Grid, line } from '../primitives';

// Brian, 2026-11-09: "a lot of them are floating". The scene-wide check is `npm run check:floating`; these pin the causes.
describe('voxel primitives that used to leave pieces floating', () => {
  it('draws a one-cell box that sits on a half cell', () => {
    const g = new Grid(0.1);
    box(g, [5.75, 3.6, -3.4], [5.85, 3.7, -3.3], () => [0, 0, 0]);
    expect(g.count).toBe(1); // it used to be empty: the wire along the barn's right wall did not exist
  });
  it('draws every box that drew before exactly as before', () => {
    const g = new Grid(0.1);
    box(g, [0, 0, 0], [0.3, 0.2, 0.1], () => [0, 0, 0]);
    expect(g.count).toBe(6);
  });
  it('joins a diagonal line face to face when asked', () => {
    const g = new Grid(0.2);
    line(g, [0, 0, 0], [1, 1.1, 0.9], () => [0, 0, 0], true);
    const cells = [...g.map.values()];
    const touches = (a: typeof cells[0]) => cells.some((b) => b !== a && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 1);
    expect(cells.every(touches)).toBe(true);
  });
});
