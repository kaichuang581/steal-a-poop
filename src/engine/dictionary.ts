export interface Dictionary {
  readonly size: number;
  has(word: string): boolean;
  /** Words beginning with `letter`. Used by bots to pick candidates. */
  startingWith(letter: string): readonly string[];
}

const EMPTY: readonly string[] = [];

/** Builds the dictionary from raw lines. Keeps lowercase a-z words only, deduplicated. */
export function createDictionary(lines: Iterable<string>): Dictionary {
  const words = new Set<string>();
  const byStart = new Map<string, string[]>();
  for (const raw of lines) {
    const word = raw.trim().toLowerCase();
    if (!/^[a-z]+$/.test(word) || words.has(word)) continue;
    words.add(word);
    const bucket = byStart.get(word[0]);
    if (bucket) bucket.push(word);
    else byStart.set(word[0], [word]);
  }
  return {
    size: words.size,
    has: (word) => words.has(word),
    startingWith: (letter) => byStart.get(letter) ?? EMPTY,
  };
}
