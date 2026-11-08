import { roundTurnMs } from './timer';
import type { Difficulty } from './types';

/**
 * Game length settings (plan V3.3 Part 2). Every rule that used to be a constant reads from here; the defaults are
 * exactly the constants, so a game with DEFAULT_SETTINGS plays as it always did.
 */
export interface GameSettings {
  /** Unused since games run until one sheep is left. Kept so saved settings still load. */
  rounds: 1 | 2 | 3 | 5;
  /** Turns each sheep takes per round; the turn timer shrinks every round. */
  turnsPerRound: 2 | 3 | 5 | 7;
  /** Wool balls (lives) each sheep starts with. 'unlimited' is read as 5: a game must be able to end. */
  lives: 1 | 2 | 3 | 5 | 'unlimited';
  /** False: no round twist, plain rules every round. */
  twists: boolean;
  botCount: number;
  botDifficulty: Difficulty;
  /**
   * Time carry. 'more': a good word gives the next sheep extra time. 'less': it takes time away (hot potato). 'off' (the
   * default): turns are the round's length. The game's opening turn is 10 s when it is on.
   */
  timeCarry?: 'off' | 'more' | 'less';
  /**
   * One Quick Game after a bad patch: the bots fumble a little more. Never shown to the player, and only the store sets
   * it, never the Daily Table or a room, where every player has to meet the same bots.
   */
  softGame?: boolean;
  /** Practice runs only: the starting clock in seconds. 15 when absent. */
  practiceClock?: 5 | 10 | 15;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 3, turnsPerRound: 2, lives: 3, twists: true, botCount: 5, botDifficulty: 'medium',
};

/** The lives counter a player with unlimited lives carries; it is never decremented. */
export const UNLIMITED_LIVES = 99;

export type PresetId = 'quick' | 'standard' | 'long' | 'custom';

/** The three presets (plan V3.3 Part 2.3); Custom is whatever the chips say. */
export const PRESETS: Record<Exclude<PresetId, 'custom'>, Pick<GameSettings, 'turnsPerRound' | 'lives' | 'twists'>> = {
  quick: { turnsPerRound: 2, lives: 2, twists: true },
  standard: { turnsPerRound: 2, lives: 3, twists: true },
  long: { turnsPerRound: 3, lives: 5, twists: true },
};

const RULE_KEYS = ['turnsPerRound', 'lives', 'twists'] as const;

/** Which preset the rule settings match, or 'custom'. */
export function presetOf(s: GameSettings): PresetId {
  for (const id of ['quick', 'standard', 'long'] as const) {
    if (RULE_KEYS.every((k) => PRESETS[id][k] === s[k])) return id;
  }
  return 'custom';
}

export function resolveSettings(partial?: Partial<GameSettings>): GameSettings {
  // Saves from before the per-round speed-up may still carry a turnSeconds rule; it no longer exists.
  const { turnSeconds: _old, ...rest } = (partial ?? {}) as Partial<GameSettings> & { turnSeconds?: unknown };
  const s = { ...DEFAULT_SETTINGS, ...rest };
  // A game has to be able to end, so unlimited wool is read as the most there is.
  if (s.lives === 'unlimited') s.lives = 5;
  return s;
}

/** Wool balls a sheep starts with under these settings. */
export function startingWool(s: GameSettings): number {
  return s.lives === 'unlimited' ? 5 : s.lives;
}

/**
 * Rough length in minutes. Games run until one sheep is left; with more wool they last more rounds (about two rounds
 * per starting wool ball, a rough fit), each round turns x players x (0.7 x that round's turn seconds + 2 s).
 */
export function estimateMinutes(s: GameSettings): number {
  const rounds = 2 + startingWool(s) * 2;
  let seconds = 0;
  for (let r = 1; r <= rounds; r++) seconds += s.turnsPerRound * (s.botCount + 1) * 0.75 * ((roundTurnMs(r) / 1000) * 0.7 + 2);
  return Math.max(1, Math.round(seconds / 60));
}
