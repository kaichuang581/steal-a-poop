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
/** The game's first intro: the table settles in as the loading screen lifts, then the first fuse is lit at once
 *  (Brian, 2026-11-23: the old 2.5 s showed a still, empty table). */
export const FIRST_INTRO_MS = 1_200;
/**
 * After a bomb goes off the table takes a beat (the sheep it went off beside is dazed, the screens show it): the next
 * sheep's fuse is lit this long after the bang, and its whole turn runs from then. Without it the next turn's clock
 * was already running under the blast, and a 5 s turn felt like 3 (Brian, 2026-11-13).
 */
export const AFTERMATH_MS = 2_400;
/**
 * A round's announcements (a new rule, faster turns) hold the table, ANNOUNCE_MS each, before its first fuse is lit, so
 * they can be read before the clock runs (Brian, 2026-11-23: the event "popups up WHILE the timer is ticking. thats nearly
 * impossible when its 5s. make the event popup actually stall the timer").
 */
export const ANNOUNCE_MS = 2_600;
/** And a short breath after the last announcement, before the first fuse. */
export const ANNOUNCE_TAIL_MS = 400;
/**
 * When this many sheep in a row run out of time on the same letter, the chain moves to a fresh letter (Brian,
 * 2026-11-23: "after 2 people die to the same thing, the bomb resets with a new letter").
 */
export const STUCK_LIMIT = 2;
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
/** A bot's chance of fumbling grows as turns get shorter, up to this much on top of its base. */
export const BOT_PRESSURE_FAIL = 0.25;
/** A soft game (see GameSettings.softGame) adds this share of BOT_PRESSURE_FAIL to every bot's chance of fumbling. */
export const SOFT_GAME_PRESSURE = 0.5;
/** The four hardest letters to start a word with. They once set a trap (see reducer.ts); now they are only hard. */
export const TRAP_LETTERS = new Set(['x', 'z', 'q', 'j']);
export const LETTER_BONUS: Record<string, number> = {
  x: 3, z: 3, q: 3, j: 3,
  y: 1, k: 1, v: 1, w: 1,
};
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
