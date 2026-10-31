import type { Dictionary } from './dictionary';
import { rarityOf } from './rarity';
import { validateWord } from './validation';
import type { Difficulty, Personality, RoundModifier } from './types';

export interface BotProfile {
  responseMs: [number, number];
  failRate: number;
  /** Chance, per other player's turn, that this bot plans a steal. */
  stealChance: number;
  prefer: 'short' | 'any' | 'long';
}

export const BOT_PROFILES: Record<Difficulty, BotProfile> = {
  easy: { responseMs: [4000, 9000], failRate: 0.2, stealChance: 0.08, prefer: 'short' },
  medium: { responseMs: [3000, 7000], failRate: 0.12, stealChance: 0.18, prefer: 'any' },
  hard: { responseMs: [2000, 6000], failRate: 0.05, stealChance: 0.3, prefer: 'long' },
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
}

/** Picks a valid word for the chain letter, biased by difficulty. Null if none exist. */
export function pickBotWord(args: PickArgs): string | null {
  const { dict, chainLetter, used, modifier, prefer, random } = args;
  const valid = dict
    .startingWith(chainLetter)
    .filter((w) => validateWord(w, { dict, chainLetter, used, modifier }).ok);
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
