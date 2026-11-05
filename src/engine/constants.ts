export const ROUNDS = 3;
export const TURNS_PER_PLAYER_PER_ROUND = 5;
export const MIN_WORD_LENGTH = 3;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

/** The reference turn length bot response times are tuned for; turns themselves follow the round (below). */
export const BASE_TURN_MS = 10_000;
export const FIRST_ROUND_TURN_MS = 16_000;
export const LAST_ROUND_TURN_MS = 5_000;
/**
 * Turns speed up every round (a round is every sheep taking its turns: two circles of the table by default). The base
 * turn by round, then the last value for as long as the game runs. Each step is a bigger share of the turn than the
 * one before, so the squeeze is felt: 16, 12, 9, 7, 5. This is the game's own pace, not a twist.
 */
export const TURN_MS_BY_ROUND = [FIRST_ROUND_TURN_MS, 12_000, 9_000, 7_000, LAST_ROUND_TURN_MS] as const;
export const MIN_TURN_MS = 5_000;
export const STEAL_WINDOW_MS = 3_000;
export const INTRO_MS = 2_500;
/** Human turn length in practice and tour games. */
export const PRACTICE_TURN_MS = 25_000;

export const FAIL_PENALTY = 5;
/** Wool balls each sheep starts with (normal games). */
export const LIVES_PER_GAME = 3;
/** A sheep can hold this many wool balls more than it started with (from steals and traps). */
export const EXTRA_WOOL_CAP = 2;
/**
 * Steals are an event, not every turn: the chance any turn is a steal turn, where the last (red) seconds are open for
 * the others to rob the sheep on turn. Drawn when the turn starts, and announced.
 */
export const STEAL_TURN_CHANCE = 0.3;
/**
 * On a steal turn the bot on turn always hesitates into the red seconds, so the window the alarm promised really
 * opens, and it answers (and the other bots make their steals) only in this last share of the window: a person who
 * reads the letter and types has the first go. On every other turn bots answer at their own pace.
 */
export const STEAL_LATE_SHARE = 0.35;
/** On a steal turn the bots' own urge to steal is this many times their usual chance (capped below one). */
export const STEAL_TURN_BOT_BOOST = 1.5;
/** After a bad steal word, that sheep cannot try to steal again for this long. */
export const STEAL_COOLDOWN_MS = 1_000;
/** A bot's chance of fumbling grows as turns get shorter, up to this much on top of its base. */
export const BOT_PRESSURE_FAIL = 0.25;
export const TRAP_PAYOUT = 5;
export const STEAL_BONUS = 5;

export const TRAP_LETTERS = new Set(['x', 'z', 'q', 'j']);
export const LETTER_BONUS: Record<string, number> = {
  x: 3, z: 3, q: 3, j: 3,
  y: 1, k: 1, v: 1, w: 1,
};
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
