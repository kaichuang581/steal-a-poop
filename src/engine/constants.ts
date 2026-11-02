export const ROUNDS = 3;
/** Turns per player per round for a standard table. See TURNS_BY_SEATS. */
export const TURNS_PER_PLAYER_PER_ROUND = 5;

/**
 * Turns per player per round, keyed by table size. Empty by default, so every table uses
 * TURNS_PER_PLAYER_PER_ROUND and the game is exactly as it shipped. Add an entry to shorten
 * (or lengthen) one size, for example `TURNS_BY_SEATS_OVERRIDES[10] = 3`.
 * `scripts/simulate.ts` sets this so two configurations can be compared.
 */
export const TURNS_BY_SEATS_OVERRIDES: Record<number, number> = {};

/** Turns per player per round at a table with `seats` players. Default: 5 at every size. */
export function TURNS_BY_SEATS(seats: number): number {
  return TURNS_BY_SEATS_OVERRIDES[seats] ?? TURNS_PER_PLAYER_PER_ROUND;
}

/**
 * Whether a bot's failed steal halves its banked score. A human's failed steal always does, so
 * this only ever relaxes the rule for bots. Default true, the rule the game shipped with.
 */
export let BOTS_HALVE_ON_FAILED_STEAL = true;

/** Test and simulation hook for the bot rule above. The game itself never calls this. */
export function setBotsHalveOnFailedSteal(value: boolean): void {
  BOTS_HALVE_ON_FAILED_STEAL = value;
}
export const MIN_WORD_LENGTH = 3;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;

export const BASE_TURN_MS = 10_000;
export const MIN_TURN_MS = 5_000;
export const STEAL_WINDOW_MS = 3_000;
export const INTRO_MS = 2_500;
/** Human turn length in practice and tour games. */
export const PRACTICE_TURN_MS = 25_000;

export const FAIL_PENALTY = 5;
export const TRAP_PAYOUT = 5;
export const STEAL_BONUS = 5;

export const TRAP_LETTERS = new Set(['x', 'z', 'q', 'j']);
export const LETTER_BONUS: Record<string, number> = {
  x: 3, z: 3, q: 3, j: 3,
  y: 1, k: 1, v: 1, w: 1,
};
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
