import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { buildBarn } from '../barn';
import { buildYard } from '../yard';

/**
 * Two meshes with a face in the same plane, facing the same way, over the same spot z-fight: the GPU cannot tell
 * which is in front, and the spot flickers as a crawling line whenever the camera moves. Inside one geometry the
 * mesher culls shared faces, so this only happens between meshes; every barn and yard mesh sits at the world origin.
 */
function coplanarOverlaps(named: [string, BufferGeometry][], cell = 0.1, within = 40): string[] {
  const owner = new Map<string, string>();
  const found = new Set<string>();
  for (const [name, g] of named) {
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index!.array;
    for (let t = 0; t < idx.length; t += 6) {
      const vs = Array.from(idx.slice(t, t + 6));
      const n = [nor.getX(vs[0]), nor.getY(vs[0]), nor.getZ(vs[0])];
      const axis = n.findIndex((v) => Math.abs(v) > 0.5);
      const pts = vs.map((v) => [pos.getX(v), pos.getY(v), pos.getZ(v)]);
      if (Math.abs(pts[0][axis]) > within) continue;
      const [a, b] = [0, 1, 2].filter((k) => k !== axis);
      const lo = (k: number) => Math.round(Math.max(-within, Math.min(...pts.map((p) => p[k]))) / cell);
      const hi = (k: number) => Math.round(Math.min(within, Math.max(...pts.map((p) => p[k]))) / cell);
      const plane = `${axis}${Math.sign(n[axis])}|${Math.round(pts[0][axis] * 100)}`;
      for (let u = lo(a); u < hi(a); u++)
        for (let w = lo(b); w < hi(b); w++) {
          const key = `${plane}|${u}|${w}`;
          const prev = owner.get(key);
          if (prev === undefined) owner.set(key, name);
          else if (prev !== name) found.add([prev, name].sort().join(' and '));
        }
    }
  }
  return [...found];
}

describe('no z-fighting', () => {
  it('no two barn or yard meshes share a face', () => {
    const barn = buildBarn(), yard = buildYard();
    const named: [string, BufferGeometry][] = [
      ...barn.static.map((g, i) => [`barn ${['walls', 'beams', 'floor', 'bales', 'props'][i]}`, g] as [string, BufferGeometry]),
      ['barn tarp', barn.tarp], ['barn front', barn.front], ['barn lanterns', barn.lanterns],
      ...yard.chunks.map((g, i) => [`yard chunk ${i}`, g] as [string, BufferGeometry]),
    ];
    expect(coplanarOverlaps(named)).toEqual([]);
  }, 30_000); // builds the whole barn and yard: about a second alone, slower when the suite runs in parallel
});
