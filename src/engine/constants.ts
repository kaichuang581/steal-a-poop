export const ROUNDS = 3;
export const TURNS_PER_PLAYER_PER_ROUND = 5;
export const MIN_WORD_LENGTH = 3;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

/** The reference turn length bot response times are tuned for; turns themselves follow the round (below). */
export const BASE_TURN_MS = 10_000;
/** Turns speed up every round: 16 s in the first, 2 s less each round after, down to 5 s. */
export const FIRST_ROUND_TURN_MS = 16_000;
export const LAST_ROUND_TURN_MS = 5_000;
export const TURN_MS_STEP = 2_000;
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
 * Chance a bot hesitates into the last (red) seconds of its turn before answering: the moment others can steal. With
 * no pile to shorten turns, bots would otherwise nearly always answer early and steals would almost never come up.
 */
export const BOT_LATE_CHANCE = 0.3;
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
