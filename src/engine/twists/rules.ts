import { MIN_WORD_LENGTH } from '../constants';

/**
 * Word twists, built from rule families. A rule is one test on a word; a twist is one rule or two rules that both
 * have to hold. The generator (tools/buildTwists.ts) keeps only the combinations the dictionary can still play, and
 * drops any that accept exactly the same words as one already kept, so the pool has no near-copies.
 *
 * Pure: no randomness, no I/O, no game state.
 */

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export const VOWELS = 'aeiou';
/** A chain needs this many start letters with legal words, or the first player is stuck. */
export const MIN_START_LETTERS = 8;
/** Every letter a legal word can end on must start at least this many legal words, or the chain dies there. */
export const MIN_CONTINUATIONS = 3;
/** A twist has to feel like one: at least this many words, and no more than this share of the dictionary. */
export const MIN_TWIST_WORDS = 300;
export const MAX_TWIST_SHARE = 0.2;

export interface TwistRule {
  /** Stable id, e.g. "ban:e" or "len=5". Pairs join two ids with "+". */
  id: string;
  /** Short label for the round announcement, e.g. "No E". */
  label: string;
  /** One sentence for the screen. */
  detail: string;
  /** True for a word the rule allows. Words are lower case a-z. */
  accepts: (word: string) => boolean;
}

const upper = (c: string) => c.toUpperCase();
const isVowel = (c: string | undefined) => c !== undefined && VOWELS.includes(c);
const vowelCount = (w: string) => [...w].filter((c) => VOWELS.includes(c)).length;

/** Every single rule, in a fixed order. */
export function singleRules(): TwistRule[] {
  const rules: TwistRule[] = [];
  const add = (id: string, label: string, detail: string, accepts: (w: string) => boolean) => rules.push({ id, label, detail, accepts });

  for (const a of LETTERS) {
    const U = upper(a);
    add(`ban:${a}`, `No ${U}`, `Words may not contain the letter ${U}.`, (w) => !w.includes(a));
    add(`has:${a}`, `Needs ${U}`, `Every word must contain the letter ${U}.`, (w) => w.includes(a));
    add(`dbl:${a}`, `Double ${U}`, `Words must contain ${U}${U} in a row.`, (w) => w.includes(a + a));
    add(`third:${a}`, `Third letter ${U}`, `The third letter of every word is ${U}.`, (w) => w[2] === a);
    add(`ends:${a}`, `Ends in ${U}`, `Words must end in the letter ${U}.`, (w) => w.endsWith(a));
  }
  for (let n = 3; n <= 8; n++) add(`len=${n}`, `Exactly ${n} letters`, `Every word has exactly ${n} letters.`, (w) => w.length === n);
  for (let n = 4; n <= 9; n++) add(`min=${n}`, `${n}+ letters`, `Every word has at least ${n} letters.`, (w) => w.length >= n);
  for (let n = 4; n <= 8; n++) add(`max=${n}`, `${n} letters max`, `Every word has ${n} letters or fewer.`, (w) => w.length <= n);
  add('start:vowel', 'Starts with a vowel', 'Words must begin with A, E, I, O or U.', (w) => isVowel(w[0]));
  add('start:consonant', 'Starts with a consonant', 'Words must begin with a consonant.', (w) => !isVowel(w[0]));
  add('end:vowel', 'Ends on a vowel', 'Words must end in A, E, I, O or U.', (w) => isVowel(w[w.length - 1]));
  add('end:consonant', 'Ends on a consonant', 'Words must end in a consonant.', (w) => !isVowel(w[w.length - 1]));
  for (let k = 1; k <= 4; k++) add(`vowels=${k}`, `${k} vowel${k > 1 ? 's' : ''} only`, `Words have exactly ${k} vowel${k > 1 ? 's' : ''}.`, (w) => vowelCount(w) === k);
  add('no-repeats', 'No repeated letters', 'No letter may appear twice in a word.', (w) => new Set(w).size === w.length);
  add('alternate', 'Vowels and consonants alternate', 'Vowels and consonants take turns: CVCV or VCVC.', (w) => [...w].every((c, i) => isVowel(c) === (i % 2 === 1)) || [...w].every((c, i) => isVowel(c) === (i % 2 === 0)));
  add('vowel-pair', 'Two vowels together', 'Words must contain two vowels side by side.', (w) => [...w].some((c, i) => isVowel(c) && isVowel(w[i + 1])));
  return rules;
}

/** Two rules that must both hold. The id joins the two, the label reads in order. */
export function pairRule(a: TwistRule, b: TwistRule): TwistRule {
  return {
    id: `${a.id}+${b.id}`,
    label: `${a.label}, ${b.label.charAt(0).toLowerCase()}${b.label.slice(1)}`,
    detail: `${a.detail} ${b.detail}`,
    accepts: (w) => a.accepts(w) && b.accepts(w),
  };
}

/** The shortest a word can be and still count. Re-exported so the generator and the game agree. */
export const RULE_MIN_LENGTH = MIN_WORD_LENGTH;
