import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMON_MAX_RANK,
  UNCOMMON_MAX_RANK,
  loadFrequencyRanks,
  parseFrequencyRanks,
  rarityOf,
  setFrequencyRanks,
} from '../rarity';

const response = (body: string, ok = true) => ({ ok, text: async () => body }) as Response;

const shipped = () =>
  parseFrequencyRanks(readFileSync(new URL('../../../public/word-frequency.txt', import.meta.url), 'utf8'));

beforeEach(() => setFrequencyRanks(null));
afterEach(() => {
  setFrequencyRanks(null);
  vi.unstubAllGlobals();
});

describe('frequency data file', () => {
  it('is the ENABLE-filtered list with source ranks intact', () => {
    const ranks = shipped();
    expect(ranks.size).toBe(88_400);
    expect(ranks.get('the')).toBe(1);
    expect(ranks.get('cat')).toBe(3_432);
    expect(ranks.get('jazz')).toBe(7_885);
    expect(ranks.get('quiz')).toBe(18_448);
    expect(ranks.get('xylophone')).toBe(53_051);
  });

  it('contains only words from the game dictionary', () => {
    const dict = new Set(
      readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8')
        .split(/\r?\n/)
        .filter(Boolean),
    );
    const missing = [...shipped().keys()].filter((word) => !dict.has(word));
    expect(missing).toEqual([]);
  });

  it('states its source and license in the header', () => {
    const text = readFileSync(new URL('../../../public/word-frequency.txt', import.meta.url), 'utf8');
    expect(text).toContain('hackerb9/gwordlist');
    expect(text).toContain('Creative Commons Attribution 3.0');
  });
});

describe('parseFrequencyRanks', () => {
  it('reads tab- or space-separated word/rank lines and ignores comments', () => {
    const ranks = parseFrequencyRanks('# header\n\nthe\t1\ncat 3432\n');
    expect([...ranks]).toEqual([
      ['the', 1],
      ['cat', 3432],
    ]);
  });

  it('keeps the best rank for duplicates and drops malformed lines', () => {
    const ranks = parseFrequencyRanks('cat\t3432\ncat\t2\nnot-a-word\t9\njazz\t0\nquiz\tx\nCat\t1\n');
    expect([...ranks]).toEqual([['cat', 2]]);
  });
});

describe('rarityOf with frequency ranks', () => {
  it('uses the rank thresholds', () => {
    setFrequencyRanks(
      new Map([
        ['the', 1],
        ['cat', 3_432],
        ['jazz', 7_885],
        ['quiz', 18_448],
        ['zephyr', 33_302],
        ['xylophone', 53_051],
      ]),
    );
    expect(rarityOf('the')).toBe('common');
    expect(rarityOf('cat')).toBe('common');
    expect(rarityOf('jazz')).toBe('common');
    expect(rarityOf('quiz')).toBe('uncommon');
    expect(rarityOf('zephyr')).toBe('rare');
    expect(rarityOf('xylophone')).toBe('rare');
  });

  it('treats the threshold ranks as inclusive', () => {
    setFrequencyRanks(
      new Map([
        ['commonedge', COMMON_MAX_RANK],
        ['uncommonstart', COMMON_MAX_RANK + 1],
        ['uncommonedge', UNCOMMON_MAX_RANK],
        ['rarestart', UNCOMMON_MAX_RANK + 1],
      ]),
    );
    expect(rarityOf('commonedge')).toBe('common');
    expect(rarityOf('uncommonstart')).toBe('uncommon');
    expect(rarityOf('uncommonedge')).toBe('uncommon');
    expect(rarityOf('rarestart')).toBe('rare');
  });

  it('falls back to the old letter-frequency estimate for words not in the list', () => {
    setFrequencyRanks(new Map([['the', 1]]));
    expect(rarityOf('cat')).toBe('common'); // vowels: the old heuristic calls this common
    expect(rarityOf('jazz')).toBe('rare'); // j/z and no high-frequency letters
  });

  it('uses the fallback before any data is loaded', () => {
    expect(rarityOf('cat')).toBe('common');
    expect(rarityOf('jazz')).toBe('rare');
  });
});

describe('loadFrequencyRanks', () => {
  it('fetches, parses and applies the data', async () => {
    const mock = vi.fn(async () => response('the\t1\njazz\t10001\n'));
    vi.stubGlobal('fetch', mock);

    await loadFrequencyRanks('/word-frequency.txt');

    expect(mock).toHaveBeenCalledWith('/word-frequency.txt');
    expect(rarityOf('the')).toBe('common');
    expect(rarityOf('jazz')).toBe('uncommon');
  });

  it('keeps the fallback when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await loadFrequencyRanks('/word-frequency.txt');
    expect(rarityOf('cat')).toBe('common');
    expect(rarityOf('jazz')).toBe('rare');
  });

  it('keeps the fallback on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('', false)));
    await loadFrequencyRanks('/word-frequency.txt');
    expect(rarityOf('cat')).toBe('common');
    expect(rarityOf('jazz')).toBe('rare');
  });

  it('does not fetch again once data is already loaded', async () => {
    setFrequencyRanks(new Map([['the', 1]]));
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    await loadFrequencyRanks('/word-frequency.txt');
    expect(mock).not.toHaveBeenCalled();
  });
});
