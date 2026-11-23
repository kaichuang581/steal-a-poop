import { foldAccents } from '../lib/lang';
import { MIN_WORD_LENGTH } from './constants';
import type { Dictionary } from './dictionary';
import type { RoundModifier } from './types';

export type RejectReason =
  | 'format'
  | 'too_short'
  | 'wrong_start'
  | 'not_in_dictionary'
  | 'already_used'
  | 'modifier_no_e'
  | 'modifier_six_plus'
  | 'modifier_double_letter'
  | 'modifier_no_a'
  | 'modifier_no_s'
  | 'modifier_five_max'
  | 'modifier_ends_vowel'
  | 'modifier_has_o';

export type ValidationResult = { ok: true; word: string } | { ok: false; reason: RejectReason };

export interface ValidationContext {
  dict: Dictionary;
  chainLetter: string;
  used: readonly string[];
  modifier: RoundModifier;
}

/** Lowercase, trimmed and without accents ("Été" is "ete"), so a word typed with or without its accents counts. */
export function normalizeWord(raw: string): string {
  return foldAccents(raw.trim().toLowerCase());
}

/** True if at least one dictionary word is legal for this letter under the modifier. */
export function hasPlayableWord(dict: Dictionary, letter: string, used: readonly string[], modifier: RoundModifier): boolean {
  return dict.startingWith(letter).some((w) => validateWord(w, { dict, chainLetter: letter, used, modifier }).ok);
}

/**
 * Which round rule (twist) a word breaks, or null: the modifier part of validateWord on its own, so a screen can warn
 * while a word is being typed. `word` is already normalized.
 */
export function breaksRule(word: string, modifier: RoundModifier): RejectReason | null {
  switch (modifier) {
    case 'no_e':
      if (word.includes('e')) return 'modifier_no_e';
      break;
    case 'six_plus':
      if (word.length < 6) return 'modifier_six_plus';
      break;
    case 'double_letter':
      if (!/(.)\1/.test(word)) return 'modifier_double_letter';
      break;
    case 'no_a':
      if (word.includes('a')) return 'modifier_no_a';
      break;
    case 'no_s':
      if (word.includes('s')) return 'modifier_no_s';
      break;
    case 'five_max':
      if (word.length > 5) return 'modifier_five_max';
      break;
    case 'ends_vowel':
      if (!/[aeiou]$/.test(word)) return 'modifier_ends_vowel';
      break;
    case 'has_o':
      if (!word.includes('o')) return 'modifier_has_o';
      break;
    default:
      break;
  }
  return null;
}

export function validateWord(raw: string, ctx: ValidationContext): ValidationResult {
  const word = normalizeWord(raw);
  if (!/^[a-z]+$/.test(word)) return { ok: false, reason: 'format' };
  if (word.length < MIN_WORD_LENGTH) return { ok: false, reason: 'too_short' };
  if (word[0] !== ctx.chainLetter) return { ok: false, reason: 'wrong_start' };
  if (ctx.used.includes(word)) return { ok: false, reason: 'already_used' };
  if (!ctx.dict.has(word)) return { ok: false, reason: 'not_in_dictionary' };
  const broken = breaksRule(word, ctx.modifier);
  if (broken) return { ok: false, reason: broken };
  return { ok: true, word };
}
