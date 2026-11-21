import { describe, expect, it } from 'vitest';
import { Grid } from '../primitives';
import { MICRO, place } from '../micro';
import { KIT } from '../microKit';
import { LADDER, solid } from '../paint';
import type { Mat } from '../paint';
import { noteShade, shadeValues, SHADE_AREA } from '../groundShade';

/** Every colour the ladders hold, as the kit's cubes carry them. */
const LADDER_COLOURS = new Set(Object.keys(LADDER).flatMap((m) => [-2, -1, 0, 1, 2].map((s) => solid(m as Mat, s).join())));
const OPTIONS: Record<string, Record<string, unknown>[]> = {
  crate: [{}, { snow: true }], crateOpen: [{ contents: 'apples' }, { contents: 'carrots' }], barrel: [{}, { snow: true }],
  pail: [{ contents: 'ice' }, { contents: 'hay' }, { contents: 'empty' }], squareBale: [{}, { snow: true }], bench: [{}, { snow: true }], shutter: [{}, { h: 20 }], cleat: [{}, { w: 9 }],
};
const everything = Object.keys(KIT).flatMap((kind) => (OPTIONS[kind] ?? [{}]).map((o) => [kind, o, KIT[kind](o)] as const));

describe('the micro kit (docs/miniature/04, section 6)', () => {
  it('has the plan\'s nineteen kinds (K10 and K19 are several each), each a pure function', () => {
    expect(Object.keys(KIT).sort()).toEqual(['barrel', 'bench', 'broom', 'cartWheel', 'choppingBlock', 'cleat', 'crate', 'crateOpen', 'eggBasket', 'handPump', 'hayHeap', 'hoistRope', 'horseshoe', 'knob',
      'latch', 'milkCan', 'pail', 'pitchfork', 'ropeCoil', 'sack', 'shovel', 'shutter', 'skates', 'splitLogs', 'squareBale', 'strapHinge', 'wallLantern']);
    for (const [kind, o, made] of everything) expect([...KIT[kind](o).cubes.map.keys()], kind).toEqual([...made.cubes.map.keys()]);
  });

  it('keeps every cube inside the object\'s own size, on the 0.05 m grid, and no object over 1.9 m', () => {
    for (const [kind, , o] of everything) {
      expect(o.cubes.size, kind).toBe(MICRO);
      for (const g of [o.cubes, o.lit]) for (const v of g?.map.values() ?? [])
        expect(v.x >= 0 && v.x < o.size[0] && v.y >= 0 && v.y < o.size[1] && v.z >= 0 && v.z < o.size[2], `${kind}: a cube at ${v.x}, ${v.y}, ${v.z} outside ${o.size}`).toBe(true);
      expect(o.size[1] * MICRO, kind).toBeLessThanOrEqual(1.9 + 1e-9);
      expect(o.cubes.count, kind).toBeGreaterThan(1);
    }
  });

  it('paints every cube a solid colour from the ladders', () => {
    for (const [kind, , o] of everything) for (const g of [o.cubes, o.lit]) for (const v of g?.map.values() ?? []) expect(LADDER_COLOURS.has(v.c.join()), `${kind}: ${v.c}`).toBe(true);
  });

  it('is one piece: every cube of an object touches another by a face or an edge (the skates are a pair)', () => {
    for (const [kind, , o] of everything) {
      if (kind === 'skates') continue;
      const all = new Map([...o.cubes.map, ...(o.lit?.map ?? [])]), seen = new Set<string>(), first = all.keys().next().value!, todo = [first];
      seen.add(first);
      while (todo.length) {
        const [x, y, z] = todo.pop()!.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
          const k = `${x + dx},${y + dy},${z + dz}`;
          if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); }
        }
      }
      expect(seen.size, kind).toBe(all.size);
    }
  });

  it('stamps an object turned by quarter turns, and refuses a cell already taken', () => {
    const world = new Grid(MICRO), crate = KIT.crate();
    place(world, crate, { kind: 'crate', at: [1, 0, 2], cluster: 't' });
    expect(world.count).toBe(crate.cubes.count);
    expect(() => place(world, KIT.milkCan(), { kind: 'milkCan', at: [1.2, 0, 2.2], cluster: 't' })).toThrow(/lands on another object/);
    const turned = new Grid(MICRO), fork = KIT.pitchfork();
    place(turned, fork, { kind: 'pitchfork', at: [0, 0, 0], turn: 1, cluster: 't' });
    expect(turned.count).toBe(fork.cubes.count);
    expect(Math.max(...[...turned.map.values()].map((v) => v.x))).toBe(fork.size[2] - 1); // its depth now lies along x
  });
});

describe('the ground\'s shade map (docs/miniature/04, section 5)', () => {
  it('is white on open ground, darker at a wall\'s foot, and never touches the barn\'s floor', () => {
    const wall = new Grid(0.2);
    for (let z = 100; z < 140; z++) for (let y = 0; y < 10; y++) wall.set(100, y, z, [1, 1, 1]); // a wall at x 20, z 20 to 28
    for (let x = -10; x < 10; x++) wall.set(x, 0, 5, [1, 1, 1]); // something on the barn's floor
    wall.set(60, 5, 60, [1, 1, 1]); // a cube 1 m up: too high to shade
    noteShade(wall.map.values(), 0.2);
    const s = shadeValues(), nx = Math.round(SHADE_AREA.w / SHADE_AREA.texel);
    const at = (x: number, z: number) => s[Math.floor((z - SHADE_AREA.z) / SHADE_AREA.texel) * nx + Math.floor((x - SHADE_AREA.x) / SHADE_AREA.texel)];
    expect(at(30, 40)).toBe(1);
    expect(at(12.05, 12.05)).toBe(1);
    expect(at(0, 1.05)).toBe(1);
    expect(at(20.25, 24)).toBeLessThan(0.9); // the first texel outside the wall
    expect(at(20.25, 24)).toBeGreaterThanOrEqual(0.6);
    expect(at(20.85, 24)).toBeGreaterThan(at(20.25, 24)); // and it fades
    expect(at(21.6, 24)).toBeGreaterThan(0.99);
  });
});
