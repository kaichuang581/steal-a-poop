export type Rarity = 'common' | 'uncommon' | 'rare';

export const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.0,
};

/** Ranks are positions in the Google Books word-frequency list, not counts. */
export const COMMON_MAX_RANK = 10_000;
export const UNCOMMON_MAX_RANK = 30_000;

/** Approximate English letter frequency, in percent. Kept as the offline fallback. */
const LETTER_FREQ: Record<string, number> = {
  e: 12.7, t: 9.1, a: 8.2, o: 7.5, i: 7.0, n: 6.7, s: 6.3, h: 6.1, r: 6.0,
  d: 4.3, l: 4.0, c: 2.8, u: 2.8, m: 2.4, w: 2.4, f: 2.2, g: 2.0, y: 2.0,
  p: 1.9, b: 1.5, v: 1.0, k: 0.8, j: 0.15, x: 0.15, q: 0.1, z: 0.07,
};

const DATA_FILE = 'word-frequency.txt';

let frequencyRanks: Map<string, number> | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Parses `word<TAB>rank` lines, most frequent first. Blank lines and lines
 * starting with `#` are comments. Invalid words and ranks are ignored.
 */
export function parseFrequencyRanks(text: string): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [word, rawRank] = line.split(/\s+/);
    if (!/^[a-z]+$/.test(word)) continue;
    const rank = Number(rawRank);
    if (!Number.isInteger(rank) || rank < 1) continue;
    const existing = ranks.get(word);
    if (existing === undefined || rank < existing) ranks.set(word, rank);
  }
  return ranks;
}

/** Replaces the loaded table. Intended for tests; pass null to restore the fallback. */
export function setFrequencyRanks(ranks: Map<string, number> | null): void {
  frequencyRanks = ranks;
  loadPromise = null;
}

/** Fetches and parses the data file once. Failures leave the fallback in place. */
export function loadFrequencyRanks(url = `${import.meta.env.BASE_URL}${DATA_FILE}`): Promise<void> {
  if (frequencyRanks) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          loadPromise = null;
          return;
        }
        frequencyRanks = parseFrequencyRanks(await res.text());
      } catch {
        loadPromise = null; // the caller may retry; scoring keeps using the fallback
      }
    })();
  }
  return loadPromise;
}

/** The original placeholder: average letter frequency, long words nudged toward rare. */
function letterFrequencyRarity(word: string): Rarity {
  let total = 0;
  for (const ch of word) total += LETTER_FREQ[ch] ?? 0;
  const avg = total / word.length;
  const score = avg - (word.length >= 8 ? 1 : 0);
  if (score >= 5.5) return 'common';
  if (score >= 3.8) return 'uncommon';
  return 'rare';
}

/**
 * THE rarity function. Uses the English word-frequency list when it is loaded,
 * and the letter-frequency estimate for words the list does not cover (or
 * before the list arrives). Nothing else in the engine needs to change.
 */
export function rarityOf(word: string): Rarity {
  const rank = frequencyRanks?.get(word);
  if (rank !== undefined) {
    if (rank <= COMMON_MAX_RANK) return 'common';
    if (rank <= UNCOMMON_MAX_RANK) return 'uncommon';
    return 'rare';
  }
  return letterFrequencyRarity(word);
}

// In Node (tests aside), read the file synchronously so scripts/simulate.ts sees
// the same ranks as the browser. The browser path fetches it after first paint.
const isNode = typeof process !== 'undefined' && typeof process.versions?.node === 'string';
if (isNode && !process.env.VITEST) {
  try {
    const fs = process.getBuiltinModule('node:fs');
    frequencyRanks = parseFrequencyRanks(fs.readFileSync('public/word-frequency.txt', 'utf8'));
  } catch {
    // Missing file: the fallback below and the browser fetch still work.
  }
}

// Do not compete with the dictionary fetch that gates the first screen: start
// on the first interaction, or after ten seconds if the player just reads.
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  const start = () => { void loadFrequencyRanks(); };
  window.addEventListener('pointerdown', start, { once: true, passive: true });
  window.addEventListener('keydown', start, { once: true });
  window.setTimeout(start, 10_000);
}
