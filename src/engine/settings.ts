import type { Difficulty } from './types';

/**
 * Game length settings (plan V3.3 Part 2). Every rule that used to be a constant reads from here; the defaults are
 * exactly the constants, so a game with DEFAULT_SETTINGS plays as it always did.
 */
export interface GameSettings {
  rounds: 1 | 2 | 3 | 5;
  turnsPerRound: 3 | 5 | 7;
  /** Base seconds per turn; the pile still shrinks it by 1 s per 10 points, never below 5 s. */
  turnSeconds: 5 | 8 | 10 | 12 | 15;
  /** 'unlimited' never freezes anyone. */
  lives: 1 | 2 | 3 | 5 | 'unlimited';
  /** False: no round twist, plain rules every round. */
  twists: boolean;
  /** 0 disables stealing. */
  stealWindowSeconds: 0 | 3 | 5;
  botCount: number;
  botDifficulty: Difficulty;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3, turnsPerRound: 5, turnSeconds: 10, lives: 3, twists: true, stealWindowSeconds: 3, botCount: 5, botDifficulty: 'medium',
};

/** The lives counter a player with unlimited lives carries; it is never decremented. */
export const UNLIMITED_LIVES = 99;

export type PresetId = 'quick' | 'standard' | 'long' | 'custom';

/** The three presets (plan V3.3 Part 2.3); Custom is whatever the chips say. */
export const PRESETS: Record<Exclude<PresetId, 'custom'>, Pick<GameSettings, 'rounds' | 'turnsPerRound' | 'turnSeconds' | 'lives' | 'twists' | 'stealWindowSeconds'>> = {
  quick: { rounds: 1, turnsPerRound: 5, turnSeconds: 8, lives: 2, twists: true, stealWindowSeconds: 3 },
  standard: { rounds: 3, turnsPerRound: 5, turnSeconds: 10, lives: 3, twists: true, stealWindowSeconds: 3 },
  long: { rounds: 5, turnsPerRound: 7, turnSeconds: 12, lives: 5, twists: true, stealWindowSeconds: 5 },
};

const RULE_KEYS = ['rounds', 'turnsPerRound', 'turnSeconds', 'lives', 'twists', 'stealWindowSeconds'] as const;

/** Which preset the rule settings match, or 'custom'. */
export function presetOf(s: GameSettings): PresetId {
  for (const id of ['quick', 'standard', 'long'] as const) {
    if (RULE_KEYS.every((k) => PRESETS[id][k] === s[k])) return id;
  }
  return 'custom';
}

export function resolveSettings(partial?: Partial<GameSettings>): GameSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}

/** Rough length in minutes: rounds × turns × players × (0.7 × turn seconds + 2 s), rounded (plan V3.3 Part 2.3). */
export function estimateMinutes(s: GameSettings): number {
  const seconds = s.rounds * s.turnsPerRound * (s.botCount + 1) * (s.turnSeconds * 0.7 + 2);
  return Math.max(1, Math.round(seconds / 60));
}
