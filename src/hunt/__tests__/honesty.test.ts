import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Plan v7 Part 10.8 and guardrail (a): nothing kept between runs may change health, damage, items, time or rules. */
describe('no persistent power', () => {
  it('the fight (hunt.ts, rules.ts) reads nothing stored: no records, log, packs, bestiary or storage', () => {
    for (const f of ['hunt.ts', 'rules.ts', 'codes.ts', 'everyday.ts']) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      expect(imports.filter((i) => /storage|record|log|packs|bestiary|savecode/.test(i)), f).toEqual([]);
      expect(src.includes('localStorage'), f).toBe(false);
    }
  });

  it('the screen starts every run from the code alone', () => {
    const src = readFileSync(new URL('../../skin/hunt/HuntScreen.tsx', import.meta.url), 'utf8');
    expect([...src.matchAll(/startRun\(([^)]*)\)/g)].map((m) => m[1])).toEqual(['dict, seedOf(code']);
  });
});
