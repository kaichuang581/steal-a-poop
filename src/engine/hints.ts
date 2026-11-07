import type { Dictionary } from './dictionary';
import { rarityOf } from './rarity';
import type { RoundModifier } from './types';
import { validateWord } from './validation';

export interface HintArgs {
  dict: Dictionary;
  chainLetter: string;
  used: readonly string[];
  modifier: RoundModifier;
  count: number;
  random: () => number;
}

/**
 * Up to `count` distinct valid words for the chain letter, for tutorial hints.
 * Favours short common-letter words. The dictionary has no familiarity data, so an
 * obscure Scrabble word can still appear.
 */
export function suggestWords({ dict, chainLetter, used, modifier, count, random }: HintArgs): string[] {
  const valid = dict
    .startingWith(chainLetter)
    .filter((w) => validateWord(w, { dict, chainLetter, used, modifier }).ok);
  const friendly = valid.filter((w) => w.length >= 4 && w.length <= 7 && rarityOf(w) === 'common');
  const out: string[] = [];
  for (const pool of [friendly, valid]) {
    const left = pool.filter((w) => !out.includes(w));
    while (out.length < count && left.length) {
      out.push(left.splice(Math.floor(random() * left.length), 1)[0]);
    }
  }
  return out;
}
