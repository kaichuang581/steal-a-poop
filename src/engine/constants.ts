export const ROUNDS = 3;
export const TURNS_PER_PLAYER_PER_ROUND = 5;
export const MIN_WORD_LENGTH = 3;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

/** The reference turn length bot response times are tuned for; turns themselves follow the round (below). */
export const BASE_TURN_MS = 10_000;
export const FIRST_ROUND_TURN_MS = 15_000;
export const LAST_ROUND_TURN_MS = 5_000;
/**
 * Turns speed up every round (a round is every sheep taking its turns: two circles of the table by default). The base
 * turn by round, then the last value for as long as the game runs. A quick ramp, 5 s off each round, so the squeeze is
 * felt at once: 15, 10, then 5. This is the game's own pace, not a twist.
 */
export const TURN_MS_BY_ROUND = [FIRST_ROUND_TURN_MS, 10_000, LAST_ROUND_TURN_MS] as const;
export const MIN_TURN_MS = 5_000;
/** Time carry: the game's opening turn, the most a turn can be stretched to, and the most one word can shift the next turn. */
export const CARRY_OPENING_TURN_MS = 10_000;
export const CARRY_MAX_TURN_MS = 20_000;
export const CARRY_MAX_SHIFT_MS = 4_000;
export const CARRY_MS_PER_POINT = 500;
/** A passed bomb: the next sheep gets the fuse that is left, but never less than this. */
export const PASS_MIN_MS = 4_000;
export const CARRY_HARD_LETTERS = new Set(['x', 'z', 'q', 'j']);
export const INTRO_MS = 2_500;
/** Human turn length in the tour, whose steps need reading time. Practice keeps the game's own clock. */
export const PRACTICE_TURN_MS = 25_000;
/** Practice runs: the starting clocks on offer, in seconds. */
export const PRACTICE_CLOCKS = [15, 10, 5] as const;
/** Practice runs: the clock drops a second every this many words you play, down to MIN_TURN_MS. */
export const PRACTICE_WORDS_PER_STEP = 5;
/** Practice runs: how long the bot takes to answer, so a speed drill is never spent waiting. */
export const PRACTICE_BOT_MS = [1000, 2500] as const;
/** Practice runs: the letters a bot aims for to corner you, the ones with the fewest words to start. */
export const CORNER_LETTERS = new Set(['x', 'z', 'q', 'j', 'y', 'k']);

export const FAIL_PENALTY = 5;
/** Wool balls each sheep starts with (normal games). */
export const LIVES_PER_GAME = 3;
/** A sheep can hold this many wool balls more than it started with (from traps). */
export const EXTRA_WOOL_CAP = 2;
/** A bot's chance of fumbling grows as turns get shorter, up to this much on top of its base. */
export const BOT_PRESSURE_FAIL = 0.25;
/** A soft game (see GameSettings.softGame) adds this share of BOT_PRESSURE_FAIL to every bot's chance of fumbling. */
export const SOFT_GAME_PRESSURE = 0.5;
export const TRAP_PAYOUT = 5;

export const TRAP_LETTERS = new Set(['x', 'z', 'q', 'j']);
export const LETTER_BONUS: Record<string, number> = {
  x: 3, z: 3, q: 3, j: 3,
  y: 1, k: 1, v: 1, w: 1,
};
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
