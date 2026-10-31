import { ROUNDS } from './constants';
import type { Player } from './types';

/** Negative when `a` ranks above `b`. Banked score, then steals, then longest word. */
export function compareStandings(a: Player, b: Player): number {
  return (b.banked - a.banked) || (b.steals - a.steals) || (b.longestWord.length - a.longestWord.length);
}

export function rankPlayers(players: readonly Player[]): Player[] {
  return [...players].sort(compareStandings);
}

/** Seats of the winner(s). More than one seat means a full tie. */
export function computeWinners(players: readonly Player[]): number[] {
  const [top] = rankPlayers(players);
  return players.filter((p) => compareStandings(top, p) === 0).map((p) => p.id);
}

export interface GameSummary {
  wordsPlayed: number;
  steals: number;
  longestWord: { word: string; seat: number } | null;
  bestWord: { word: string; points: number; seat: number } | null;
}

export function summarize(players: readonly Player[]): GameSummary {
  let longestWord: GameSummary['longestWord'] = null;
  let bestWord: GameSummary['bestWord'] = null;
  let wordsPlayed = 0;
  let steals = 0;
  for (const p of players) {
    wordsPlayed += p.wordsPlayed;
    steals += p.steals;
    if (p.longestWord && (!longestWord || p.longestWord.length > longestWord.word.length)) {
      longestWord = { word: p.longestWord, seat: p.id };
    }
    if (p.bestWord && (!bestWord || p.bestWord.points > bestWord.points)) {
      bestWord = { ...p.bestWord, seat: p.id };
    }
  }
  return { wordsPlayed, steals, longestWord, bestWord };
}

export const ROUND_COUNT = ROUNDS;
