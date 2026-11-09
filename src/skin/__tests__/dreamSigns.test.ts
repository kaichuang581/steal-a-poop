import { describe, expect, it } from 'vitest';
import { foldedQuilt, roomOn } from '../dream/bedroom';
import { fenceSign, SIGN_BASE, signBoardCells, signCell, signCells, signGlyphCells, signWidth } from '../dream/world';
import { Grid } from '../voxel/primitives';

/** Every voxel reaches every other through shared faces (V5 Part 4.13's connectivity test). */
function connected(cells: Iterable<{ x: number; y: number; z: number }>): boolean {
  const all = new Set<string>(), list = [...cells];
  for (const c of list) all.add(`${c.x},${c.y},${c.z}`);
  if (!list.length) return false;
  const seen = new Set([`${list[0].x},${list[0].y},${list[0].z}`]), todo = [list[0]];
  while (todo.length) {
    const c = todo.pop()!;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
      if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push({ x: c.x + dx, y: c.y + dy, z: c.z + dz }); }
    }
  }
  return seen.size === all.size;
}

/** The fence sign and the folded quilts (docs/REDESIGN_PLAN_V6_UI.md Part 7.4). */
describe('the fence sign', () => {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  it('carves every glyph cell: the front layer empty, ink in the back layer, for A to Z', () => {
    for (const ch of ABC) {
      const { wood, ink } = signBoardCells([ch]);
      const cells = signGlyphCells([ch]);
      expect(cells.length, ch).toBeGreaterThan(4);
      for (const { x, y } of cells) {
        expect(wood.has(x, y, 1), `${ch} front ${x},${y}`).toBe(false);
        expect(ink.has(x, y, 0), `${ch} ink ${x},${y}`).toBe(true);
      }
    }
  });
  it('carves one, three and five letters, side by side with the dots after them', () => {
    for (const letters of [['r'], ['r', 'a', 'n'], ['s', 't', 'o', 'n', 'e']]) {
      const { wood, ink, w } = signBoardCells(letters);
      // Each glyph's cells plus three dots after the last.
      expect(ink.count).toBe(signGlyphCells(letters).length);
      expect(signGlyphCells(letters).filter((c) => c.y === SIGN_BASE).length).toBeGreaterThanOrEqual(6);
      for (const { x, y } of signGlyphCells(letters)) expect(wood.has(x, y, 1)).toBe(false);
      // The board is as wide as signWidth says, within one cell.
      expect(Math.abs(w * signCell(letters.length) - signWidth(letters.length))).toBeLessThanOrEqual(signCell(letters.length));
      expect(w).toBe(signCells(letters.length).w);
    }
  });
  it('hangs together: board, rim, nails, snow and ropes are one piece with the ink in its cuts', () => {
    for (const letters of [['k'], ['b', 'o', 't']]) {
      const { wood, ink } = signBoardCells(letters);
      const all = new Grid(1);
      for (const v of [...wood.map.values(), ...ink.map.values()]) all.set(v.x, v.y, v.z, v.c);
      expect(connected(all.map.values())).toBe(true);
    }
  });
  it('builds geometry for every part, the lantern included', () => {
    const g = fenceSign(['r', 'n']);
    for (const part of [g.post, g.board, g.letters, g.lantern]) expect(part.getAttribute('position').count).toBeGreaterThan(0);
  });
});

describe('the results room', () => {
  it('shows the walls only once the dream is over', () => {
    for (const p of ['ready', 'running', 'crashed', 'drifting']) expect(roomOn(p)).toBe(false);
    expect(roomOn('results')).toBe(true);
  });
  it('folds each Warm Blanket into one piece', () => {
    for (const seed of [0, 1]) {
      const pos = foldedQuilt(seed).getAttribute('position');
      expect(pos.count).toBeGreaterThan(0);
    }
  });
});
