import { load, save } from './storage';

const KEY = 'sap:record';
/** Quick Games that run at the easy table, unless the player sets their own. */
export const FIRST_GAMES = 3;
const KEPT_RESULTS = 3;
const SOFT_AFTER_LOSSES = 2;

export interface Bests {
  wool: number;
  longest: string;
}

interface PlayerRecord {
  /** Quick Games finished. */
  played: number;
  /** The last few Quick Games, oldest first. True is a win. */
  results: boolean[];
  bests: Bests;
}

export interface GameResult {
  bests: Bests;
  /** Which of this game's numbers beat the old best. */
  beat: { wool: boolean; longest: boolean };
}

function read(): PlayerRecord {
  const saved = load<Partial<PlayerRecord>>(KEY, {});
  // Older records carry a steals best as well; it is dropped (steals were taken out of the game).
  return { played: 0, results: [], ...saved, bests: { wool: saved.bests?.wool ?? 0, longest: saved.bests?.longest ?? '' } };
}

export const isFirstGames = () => read().played < FIRST_GAMES;

/** Two losses in the last three Quick Games: the next one quietly goes easier. */
export const needsSoftGame = () => read().results.filter((won) => !won).length >= SOFT_AFTER_LOSSES;

/** Counts a finished Quick Game. A soft game clears the slate, so it is only ever one game at a time. */
export function recordQuickResult(won: boolean, soft: boolean): void {
  const r = read();
  save(KEY, { ...r, played: r.played + 1, results: soft ? [] : [...r.results, won].slice(-KEPT_RESULTS) });
}

export const getBests = () => read().bests;

/** Saves any new personal bests from a finished game. */
export function recordBests(game: Bests): GameResult {
  const r = read();
  const beat = { wool: game.wool > r.bests.wool, longest: game.longest.length > r.bests.longest.length };
  const bests = {
    wool: beat.wool ? game.wool : r.bests.wool,
    longest: beat.longest ? game.longest : r.bests.longest,
  };
  save(KEY, { ...r, bests });
  return { bests, beat };
}

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Who is at the table, said plainly: the others are the farm's sheep, not people. */
export function farmSheepLine(bots: number): string {
  return `You and ${NUMBERS[bots] ?? bots} farm sheep`;
}
