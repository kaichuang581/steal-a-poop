import { describe, expect, it } from 'vitest';
import { BOMB_AURA } from '../../shop/bombAura';
import { CATALOG } from '../../shop/catalog';
import { shellGrid, ICE_SHELL } from '../bomb';
import { bombSkinGrids, groundGrid } from '../bombSkins';

/**
 * Every bomb skin is its own model and does its own thing (Brian, 2026-11-13: "diamond just looks like the default
 * snowy bomb ... everything needs to be differentiated, perhaps even remodel them slightly"), and each is still the
 * bomb as far as the table is concerned: it stands on the floor, is about the ice bomb's width, and carries the fuse.
 */
describe('bomb skins', () => {
  const skins = CATALOG.filter((i) => i.kind === 'bomb').map((i) => i.id);
  const cells = (id: string) => { const { body, glow } = bombSkinGrids(id); return new Map([...body.map, ...(glow?.map ?? [])]); };

  it('the ice bomb is the ice bomb, voxel for voxel', () => {
    const now = bombSkinGrids('bomb-ice'), was = shellGrid(ICE_SHELL);
    expect(now.glow).toBeNull();
    expect([...now.body.map.entries()]).toEqual([...was.map.entries()]);
  });

  it('no two skins are the same shape', () => {
    const shapes = skins.map((id) => [...cells(id).keys()].sort().join(' '));
    expect(new Set(shapes).size).toBe(skins.length);
  });

  it('a skin stands on the floor, keeps the ice bomb\'s width, and has a neck for the fuse', () => {
    for (const id of skins) {
      const all = [...cells(id).values()];
      expect(Math.min(...all.map((v) => v.y)), `${id}: lowest row`).toBe(-5);
      expect(cells(id).has('0,6,0'), `${id}: the fuse's foot`).toBe(true);
      expect(Math.max(...all.map((v) => v.y)), `${id}: nothing above the fuse's foot but a crown`).toBeLessThanOrEqual(7);
      for (const v of all) expect(Math.hypot(v.x + 0.5, v.z + 0.5), `${id}: ${v.x},${v.y},${v.z}`).toBeLessThanOrEqual(6.6);
      expect(all.length, id).toBeLessThan(900);
    }
  });

  it('a skin is one piece: nothing floats', () => {
    for (const id of skins) {
      const map = cells(id), first = [...map.values()][0], seen = new Set([`${first.x},${first.y},${first.z}`]), todo = [first];
      while (todo.length) {
        const c = todo.pop()!;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
          const key = `${c.x + dx},${c.y + dy},${c.z + dz}`, next = map.get(key);
          if (next && !seen.has(key)) { seen.add(key); todo.push(next); }
        }
      }
      expect(seen.size, `${id}: ${map.size - seen.size} voxels float`).toBe(map.size);
    }
  });

  it('what a skin leaves on the floor is its own: only the ice bomb leaves frost', () => {
    // Brian, 2026-11-13: "all the bombs have like an ice thing on the ground which doesnt make sense for stuff like fire".
    expect(groundGrid('bomb-ice')).toBeNull(); // the ice bomb's is its own frost (voxel/bomb.ts)
    const marks = skins.filter((id) => id !== 'bomb-ice').map((id) => {
      const g = groundGrid(id);
      expect(g, id).toBeTruthy();
      const cells = [...g!.map.values()];
      expect(cells.length, id).toBeGreaterThan(20);
      // Flat on the floor and no wider than the frost was.
      for (const v of cells) { expect(v.y, id).toBe(0); expect(Math.hypot(v.x, v.z), id).toBeLessThanOrEqual(12.6); }
      return [...g!.map.keys()].sort().join(' ');
    });
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('the countdown digits stand clear of the skin, whichever way the camera looks', () => {
    // The digits are 7 rows of 0.03 m, centred on the bomb's middle: voxel rows -3 to 2. They stand `face` metres out.
    for (const id of skins) {
      const face = BOMB_AURA[id].face ?? 0.21;
      const widest = Math.max(...[...cells(id).values()].filter((v) => v.y >= -3 && v.y <= 2).map((v) => Math.hypot(v.x + 0.5, v.z + 0.5) + 0.5)) * 0.04;
      expect(face, `${id}: digits at ${face} m, shell out to ${widest.toFixed(3)} m`).toBeGreaterThanOrEqual(widest - 0.03);
      expect(face, `${id}: digits floating far off the shell`).toBeLessThanOrEqual(0.26);
    }
  });

  it('every skin has its own way of sitting there, and a skin that glows has glowing parts', () => {
    for (const id of skins) {
      const aura = BOMB_AURA[id];
      expect(aura, id).toBeTruthy();
      expect(!!bombSkinGrids(id).glow?.count, `${id}: glowing voxels`).toBe(!!aura.glow);
    }
    // What comes off it, with what glints and what glow: no two the same.
    const ways = skins.map((id) => { const a = BOMB_AURA[id]; return JSON.stringify([a.bits, a.colors, a.glints?.rate ?? 0, a.glow?.colors ?? [], a.rock ?? 0]); });
    expect(new Set(ways).size).toBe(skins.length);
    // Only the ice bomb and the peppermint breathe cold air; nothing else is "the ice bomb in another colour".
    expect(skins.filter((id) => BOMB_AURA[id].bits === 'vapour').sort()).toEqual(['bomb-ice', 'bomb-mint']);
  });
});
