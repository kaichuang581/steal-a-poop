/**
 * Restrictions a predator puts on the sheep's words in the Daily Hunt. Each rule is a pure test on a word (and, for
 * the chain rules, the sheep's previous word). Rules have a difficulty (1 easy .. 3 hard) and a group: a predator
 * never brings two rules from the same group, so the rules never contradict each other.
 */

export interface RuleContext {
  /** The sheep's previous accepted word this run, or null before the first. */
  prev: string | null;
}

export interface Rule {
  id: string;
  group: string;
  difficulty: 1 | 2 | 3;
  /** Short label for the rule card and the list beside the input. */
  label: string;
  /** What the predator says when it brings the rule. */
  line: string;
  /** Depends on the previous word (the chain rules); skipped for the first word of a run. */
  usesPrev?: boolean;
  test(word: string, ctx: RuleContext): boolean;
}

const VOWEL = new Set(['a', 'e', 'i', 'o', 'u']);
const isVowel = (c: string) => VOWEL.has(c);
const count = (w: string, f: (c: string) => boolean) => [...w].filter(f).length;
const up = (c: string) => c.toUpperCase();

export function minLength(n: number): Rule {
  return {
    id: `min${n}`, group: 'length', difficulty: n <= 5 ? 1 : n <= 6 ? 2 : 3,
    label: `${n}+ letters`, line: `Nothing shorter than ${n} letters!`,
    test: (w) => w.length >= n,
  };
}

export function maxLength(n: number): Rule {
  return {
    id: `max${n}`, group: 'length', difficulty: n >= 6 ? 1 : 2,
    label: `${n} letters or fewer`, line: `Keep it short: ${n} letters at most!`,
    test: (w) => w.length <= n,
  };
}

export function minConsonants(n: number): Rule {
  return {
    id: `cons${n}`, group: 'consonants', difficulty: n <= 3 ? 1 : n <= 4 ? 2 : 3,
    label: `${n}+ consonants`, line: `I want at least ${n} consonants. Crunchy ones.`,
    test: (w) => count(w, (c) => !isVowel(c)) >= n,
  };
}

export function minVowels(n: number): Rule {
  return {
    id: `vow${n}`, group: 'vowels', difficulty: n <= 3 ? 2 : 3,
    label: `${n}+ vowels`, line: `Give me ${n} vowels or more!`,
    test: (w) => count(w, isVowel) >= n,
  };
}

export function banLetter(l: string): Rule {
  return {
    id: `ban${l}`, group: 'ban', difficulty: 'eaitrsno'.includes(l) ? 2 : 1,
    label: `No ${up(l)}`, line: `The letter ${up(l)} is mine now. No ${up(l)}!`,
    test: (w) => !w.includes(l),
  };
}

export function mustContain(l: string): Rule {
  return {
    id: `has${l}`, group: 'contain', difficulty: 'kvwyfb'.includes(l) ? 3 : 2,
    label: `Has a ${up(l)}`, line: `Every word needs a ${up(l)} in it!`,
    test: (w) => w.includes(l),
  };
}

export const CHAIN: Rule = {
  id: 'chain', group: 'start', difficulty: 2, usesPrev: true,
  label: 'Start with your last letter', line: 'Chain it! Start with the last letter of your last word!',
  test: (w, { prev }) => !prev || w[0] === prev[prev.length - 1],
};

export const LONGER: Rule = {
  id: 'longer', group: 'growth', difficulty: 3, usesPrev: true,
  label: 'At least as long as your last', line: 'No shrinking! At least as long as your last word!',
  // Capped at 9 so a long word cannot lock the sheep out for the rest of the fight.
  test: (w, { prev }) => !prev || w.length >= Math.min(9, prev.length),
};

export const NO_REPEAT: Rule = {
  id: 'norepeat', group: 'letters', difficulty: 2,
  label: 'No letter twice', line: 'Every letter only once. No repeats!',
  test: (w) => new Set(w).size === w.length,
};

export const DOUBLE: Rule = {
  id: 'double', group: 'letters', difficulty: 2,
  label: 'Has a double letter', line: 'I like my words with a double letter. Like "ee"... or "ll"!',
  test: (w) => /([a-z])\1/.test(w),
};

export const ENDS_VOWEL: Rule = {
  id: 'endvowel', group: 'end', difficulty: 2,
  label: 'Ends with a vowel', line: 'Finish on a vowel, little lamb!',
  test: (w) => isVowel(w[w.length - 1]),
};

export const ENDS_CONSONANT: Rule = {
  id: 'endcons', group: 'end', difficulty: 1,
  label: 'Ends with a consonant', line: 'End on a consonant. Snap!',
  test: (w) => !isVowel(w[w.length - 1]),
};

export const STARTS_VOWEL: Rule = {
  id: 'startvowel', group: 'start', difficulty: 2,
  label: 'Starts with a vowel', line: 'Open with a vowel. A, E, I, O or U!',
  test: (w) => isVowel(w[0]),
};

export const NO_FIRST_AGAIN: Rule = {
  id: 'newstart', group: 'start', difficulty: 1, usesPrev: true,
  label: 'New first letter each time', line: 'Never start two words the same way!',
  test: (w, { prev }) => !prev || w[0] !== prev[0],
};

/** Every rule a predator can bring, built for a given strength (0 = the first predator). */
export function rulePool(strength: number): Rule[] {
  const s = Math.min(strength, 6);
  return [
    minLength(5 + Math.min(3, Math.floor(s / 2))),
    maxLength(s < 3 ? 6 : 5),
    minConsonants(3 + Math.min(2, Math.floor(s / 2))),
    minVowels(s < 4 ? 3 : 4),
    ...['e', 'a', 'i', 'o', 's', 't', 'r'].map(banLetter),
    ...['b', 'c', 'd', 'g', 'k', 'm', 'p', 'w', 'y'].map(mustContain),
    CHAIN, LONGER, NO_REPEAT, DOUBLE, ENDS_VOWEL, ENDS_CONSONANT, STARTS_VOWEL, NO_FIRST_AGAIN,
  ];
}

/** The first rule the word breaks, or null when it obeys every rule. */
export function brokenRule(word: string, rules: readonly Rule[], ctx: RuleContext): Rule | null {
  for (const r of rules) if (!r.test(word, ctx)) return r;
  return null;
}
