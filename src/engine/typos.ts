import type { ValidationContext } from './validation';
import { normalizeWord, validateWord } from './validation';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Every string one edit away: a letter removed, added, changed, or two neighbours swapped. */
function editsOfOne(word: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i <= word.length; i++) {
    if (i < word.length) {
      out.add(word.slice(0, i) + word.slice(i + 1));
      if (i < word.length - 1) out.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
      for (const c of LETTERS) if (c !== word[i]) out.add(word.slice(0, i) + c + word.slice(i + 1));
    }
    for (const c of LETTERS) out.add(word.slice(0, i) + c + word.slice(i));
  }
  out.delete(word);
  return out;
}

/**
 * A clear typo: the word is not playable, but exactly one playable word is a single edit away.
 * Returns that word, or null when nothing (or more than one word) fits.
 */
export function suggestCorrection(raw: string, ctx: ValidationContext): string | null {
  const word = normalizeWord(raw);
  if (!/^[a-z]+$/.test(word) || word.length < 2) return null;
  const found: string[] = [];
  for (const candidate of editsOfOne(word)) {
    if (validateWord(candidate, ctx).ok) {
      found.push(candidate);
      if (found.length > 1) return null;
    }
  }
  return found.length === 1 ? found[0] : null;
}
