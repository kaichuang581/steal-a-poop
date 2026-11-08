import { WORDS_VERSION } from '../config';

/**
 * Pack codes (plan v7 Part 4.1): five characters read aloud across a lunch table. The first four are the pack, the fifth
 * the word list's version. The code is the seed: the same code gives everyone the same predators, rules, reserves and
 * hint words under the same word list.
 */

/** Crockford's base 32: no I, L, O or U, which look or sound like other symbols. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 5;

/** The fifth character for a word-list version. */
export function versionDigit(version = WORDS_VERSION): string {
  return ALPHABET[version % ALPHABET.length];
}

/** Four random symbols and the version digit. */
export function newCode(random: () => number = Math.random): string {
  let pack = '';
  for (let i = 0; i < CODE_LENGTH - 1; i++) pack += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length];
  return pack + versionDigit();
}

/** Upper-cases and maps the look-alikes (I and L to 1, O to 0, U to V), dropping spaces and dashes. */
export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
}

/** A typed or linked code, checked: null when it is not five symbols of the alphabet. `stale` when its list differs. */
export function parseCode(input: string): { code: string; version: number; stale: boolean } | null {
  const code = normaliseCode(input);
  if (code.length !== CODE_LENGTH || [...code].some((c) => !ALPHABET.includes(c))) return null;
  const version = ALPHABET.indexOf(code[CODE_LENGTH - 1]);
  return { code, version, stale: version !== WORDS_VERSION % ALPHABET.length };
}

/** The seed string the pure layer uses for a code. */
export function seedOf(code: string): string {
  return `pack:${code}`;
}

/** Seeds from before pack codes ('hunt:...'). */
export function isLegacySeed(seed: string): boolean {
  return seed.startsWith('hunt:');
}

/** The code a seed was made from, or null for a legacy seed. */
export function codeOfSeed(seed: string): string | null {
  return seed.startsWith('pack:') ? seed.slice(5) : null;
}
