export const ROUNDS = 3;
export const TURNS_PER_PLAYER_PER_ROUND = 5;
export const MIN_WORD_LENGTH = 3;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;

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
