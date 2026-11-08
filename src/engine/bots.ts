import { CORNER_LETTERS } from './constants';
import type { Dictionary } from './dictionary';
import { rarityOf } from './rarity';
import { validateWord } from './validation';
import type { Difficulty, Personality, RoundModifier } from './types';

export interface BotProfile {
  responseMs: [number, number];
  failRate: number;
  prefer: 'short' | 'any' | 'long';
  /** Practice runs: the chance, per word, that this bot aims for a CORNER_LETTERS ending. */
  corner: number;
}

export const BOT_PROFILES: Record<Difficulty, BotProfile> = {
  easy: { responseMs: [4000, 9000], failRate: 0.2, prefer: 'short', corner: 0 },
  medium: { responseMs: [3000, 7000], failRate: 0.12, prefer: 'any', corner: 0.35 },
  hard: { responseMs: [2000, 6000], failRate: 0.05, prefer: 'long', corner: 0.8 },
};

export const PERSONALITIES: readonly Personality[] = ['cautious', 'greedy', 'random'];

/** Bank threshold band per personality; `roll` is a [0,1) draw. */
export function bankThresholdFor(personality: Personality, roll: number): number {
  switch (personality) {
    case 'cautious':
      return 15 + Math.floor(roll * 11);
    case 'greedy':
      return 40 + Math.floor(roll * 21);
    default:
      return 20 + Math.floor(roll * 31);
  }
}

export interface PickArgs {
  dict: Dictionary;
  chainLetter: string;
  used: readonly string[];
  modifier: RoundModifier;
  prefer: BotProfile['prefer'];
  random: () => number;
  /** Chance of aiming for a CORNER_LETTERS ending. Left out, no random draw is spent on it. */
  corner?: number;
}

/** Picks a valid word for the chain letter, biased by difficulty. Null if none exist. */
export function pickBotWord(args: PickArgs): string | null {
  const { dict, chainLetter, used, modifier, prefer, random, corner } = args;
  const valid = dict
    .startingWith(chainLetter)
    .filter((w) => validateWord(w, { dict, chainLetter, used, modifier }).ok);
  if (corner && random() < corner) {
    const nasty = valid.filter((w) => CORNER_LETTERS.has(w[w.length - 1]));
    // The letter first, then a word ending on it: far more words end on Y than on the rest, and every corner would be a Y.
    const endings = [...new Set(nasty.map((w) => w[w.length - 1]))];
    if (endings.length) {
      const ending = endings[Math.floor(random() * endings.length)];
      const pool = nasty.filter((w) => w.endsWith(ending));
      return pool[Math.floor(random() * pool.length)];
    }
  }
  const tiers: ((w: string) => boolean)[] =
    prefer === 'short'
      ? [(w) => w.length <= 5 && rarityOf(w) === 'common', () => true]
      : prefer === 'long'
        ? [(w) => w.length >= 7 || rarityOf(w) === 'rare', (w) => w.length >= 5, () => true]
        : [() => true];
  for (const tier of tiers) {
    const pool = valid.filter(tier);
    if (pool.length) return pool[Math.floor(random() * pool.length)];
  }
  return null;
}
