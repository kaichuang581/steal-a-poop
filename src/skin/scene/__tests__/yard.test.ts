import { describe, expect, it } from 'vitest';
import { buildDistance } from '../distance';
import { buildYard } from '../yard';

describe('yard and distance builders', () => {
  it('builds the yard in 8 m chunks under 600k triangles (0.1 m above the ground)', () => {
    const t0 = performance.now();
    const y = buildYard();
    console.log(`yard: ${y.chunks.length} chunks, ${y.triangles} triangles, ${Math.round(performance.now() - t0)} ms`);
    expect(y.chunks.length).toBeGreaterThan(10);
    expect(y.triangles).toBeGreaterThan(50_000);
    expect(y.triangles).toBeLessThan(600_000);
    expect(y.smokeFrom[1]).toBeGreaterThan(5);
  });
  it('builds hills and mountains under 250k triangles', () => {
    const t0 = performance.now();
    const d = buildDistance();
    const hm = (d.hills.index!.count + d.mountains.index!.count) / 3;
    console.log(`hills ${d.hills.index!.count / 3}, mountains ${d.mountains.index!.count / 3}`);
    console.log(`distance: hills+mountains ${hm} triangles, total ${d.triangles}, ${Math.round(performance.now() - t0)} ms`);
    expect(hm).toBeLessThan(250_000);
    expect(d.windmillBlades.index!.count).toBeGreaterThan(0);
  });
});
