import { describe, expect, it } from 'vitest';
import { buildFarmstead, FARM } from '../farmstead';
import { BARN } from '../layout';

describe('the start screen farm', () => {
  it('builds every part under its triangle budget', () => {
    const t0 = performance.now();
    const farm = buildFarmstead();
    console.log(`farmstead: ${farm.triangles} triangles, ${farm.props.length + farm.fine.length} chunks, built in ${Math.round(performance.now() - t0)} ms`);
    for (const g of [farm.shell, farm.terrain, ...farm.props, ...farm.fine]) expect(g.getAttribute('position').count).toBeGreaterThan(0);
    expect(farm.triangles).toBeLessThan(1_000_000); // everything the tour gets close to is at 0.1 m
  }, 30_000);

  it('keeps the buildings out of the barn and the paddock clear of the silo', () => {
    expect(FARM.silo.x - FARM.silo.r).toBeGreaterThan(BARN.maxX + 0.8);
    expect(FARM.paddock.minX).toBeGreaterThan(FARM.silo.x + FARM.silo.r);
    expect(FARM.run.maxX).toBeLessThan(BARN.minX - 0.8);
  });
});
