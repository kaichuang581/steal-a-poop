import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The season's copy behind FESTIVE (plan file 13, change 7 and section 8): with the season off, none of the game's
// seasonal words show; with it on, every one is as it shipped. UPDATE_NAME, the version's name, is exempt.
const SEASONAL = /ho ho|jolly|merry|holly|humbug|fa la|navidad/i;

async function seasonWith(festive: boolean) {
  vi.resetModules();
  vi.doMock('../../config', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../config')>()), FESTIVE: festive }));
  return import('../season');
}

afterEach(() => {
  vi.doUnmock('../../config');
  vi.resetModules();
});

describe('the season\'s copy follows FESTIVE', () => {
  it('with FESTIVE off, no cheer, run title or tip says anything seasonal, and the season-off words take their place', async () => {
    const { CHEERS, RUN_OVER_TITLE, SEASON_TIPS } = await seasonWith(false);
    for (const line of [...CHEERS, RUN_OVER_TITLE, ...SEASON_TIPS]) expect(line).not.toMatch(SEASONAL);
    expect(CHEERS).toEqual(['Nice one!', 'Good word!', 'Well played!']);
    expect(RUN_OVER_TITLE).toBe('Run over');
    expect(SEASON_TIPS).toEqual([]);
  });

  it('with FESTIVE on, every line is exactly today\'s', async () => {
    const { CHEERS, RUN_OVER_TITLE, SEASON_TIPS } = await seasonWith(true);
    expect(CHEERS).toEqual(['Nice one!', 'Ho ho ho!', 'Jolly good!', 'Fa la la la baa!', 'Merry and bright!']);
    expect(RUN_OVER_TITLE).toBe('Baa humbug!');
    expect(SEASON_TIPS).toEqual([
      'Fleece Navidad: the whole farm is dressed for the season, hats and all.',
      'Have yourself a merry little word chain.',
      'Deck the stalls with bows of holly. Fa la la la baa.',
    ]);
  });

  it('the screens that showed the season\'s words read them from season.ts, not their own copies', () => {
    for (const file of ['src/skin/screens/PaintedGame.tsx', 'src/skin/screens/PaintedHome.tsx']) {
      const strings = readFileSync(join(process.cwd(), file), 'utf8').match(/'(?:[^'\\\n]|\\.)*'/g) ?? [];
      expect(strings.filter((s) => SEASONAL.test(s)), file).toEqual([]);
    }
  });

  it('the shipped config has FESTIVE on, so nothing changes today', async () => {
    const config = await import('../../config');
    expect(config.FESTIVE).toBe(true);
  });
});
