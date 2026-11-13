import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLAST_PALETTE, BURST_SHAPE, burstExplodes, CATALOG } from '../../shop/catalog';
import { propGrid } from '../../voxel/burstProps';
import { ACTS, MAX_PROPS } from '../burstActs';

/**
 * A Trading Post burst is not an explosion unless it is the frost ball (Brian, 2026-11-12: "the burst doesnt literally
 * have to be an explosion every single time ... it feels weird for an aurora to be exploding").
 */
describe('what each burst does when the bomb goes off', () => {
  const bursts = CATALOG.filter((i) => i.kind === 'blast');

  it('only the frost ball explodes; every other burst is an act', () => {
    for (const b of bursts) {
      const act = ACTS[BURST_SHAPE[b.id]];
      expect(act, b.id).toBeTruthy();
      expect(act.bang, b.id).toBe(b.id === 'blast-frost');
      expect(burstExplodes(b.id), b.id).toBe(b.id === 'blast-frost');
    }
    expect(burstExplodes('no-such-burst')).toBe(true);
  });

  it('an act fits the burst\'s clouds and lasts long enough to be watched, but not into the next bomb', () => {
    for (const [shape, act] of Object.entries(ACTS)) {
      expect(act.flames, shape).toBeLessThanOrEqual(420);
      expect(act.sparks, shape).toBeLessThanOrEqual(260);
      expect(act.props, shape).toBeLessThanOrEqual(MAX_PROPS);
      expect(act.life, shape).toBeGreaterThanOrEqual(2.4);
      expect(act.life, shape).toBeLessThanOrEqual(4.5); // the shortest turn is 5 s
      if (act.bang) expect(act.props, shape).toBe(0);
    }
  });

  it('an act that puts something up has a voxel model for it, in one piece', () => {
    for (const b of bursts) {
      const shape = BURST_SHAPE[b.id], act = ACTS[shape], grid = propGrid(shape, BLAST_PALETTE[b.id]);
      if (!act.props) { expect(grid, b.id).toBeNull(); continue; }
      expect(grid, b.id).toBeTruthy();
      expect(grid!.count, b.id).toBeGreaterThan(40);
      // Every voxel reaches every other through shared faces or edges: nothing floats.
      const cells = [...grid!.map.values()], seen = new Set<string>([`${cells[0].x},${cells[0].y},${cells[0].z}`]), todo = [cells[0]];
      while (todo.length) {
        const c = todo.pop()!;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
          const key = `${c.x + dx},${c.y + dy},${c.z + dz}`, next = grid!.map.get(key);
          if (next && !seen.has(key)) { seen.add(key); todo.push(next); }
        }
      }
      expect(seen.size, `${b.id}: ${cells.length - seen.size} voxels float`).toBe(cells.length);
    }
  });

  it('the table plays the act where the bomb was, watches it, and sounds and flashes softly for it', () => {
    const read = (f: string) => readFileSync(f, 'utf8');
    expect(read('src/skin/table/Bomb.tsx')).toMatch(/stage=\{stage\.current\}/);
    // The table stays with the sheep the bomb went off beside for the engine's beat (BarnTable's `dazed`).
    expect(read('src/skin/table/BarnTable.tsx')).toMatch(/speaker \?\? dazed \?\? upNext/);
    expect(read('src/skin/PaintedApp.tsx')).toMatch(/setSoftBoom\(!burstExplodes\(blast\)\)/);
    expect(read('src/skin/screens/PaintedGame.tsx')).toMatch(/glow=\{blast\.glow\}/);
  });
});
