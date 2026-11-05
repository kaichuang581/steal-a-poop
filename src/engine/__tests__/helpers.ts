import { createDictionary } from '../dictionary';
import { createGame } from '../game';
import { advance } from '../reducer';
import type { GameState } from '../types';

export const WORDS = [
  'cat', 'tab', 'bat', 'tax', 'xylem', 'mud', 'dog', 'gate', 'eel', 'lamp',
  'pale', 'tiger', 'rat', 'toy', 'jazz', 'zoo', 'oak', 'kit', 'tree', 'tall',
  'apple', 'egg', 'ant', 'tea', 'tow', 'quiz', 'wow', 'wax', 'tick', 'tuck',
  'cattle', 'tomorrow',
];

export const dict = createDictionary(WORDS);
export const ctx = { dict };

export const T0 = 1_000_000;

/** A game on seat 0's turn (human), chain letter forced to `letter`. Bots are inert until `now` passes their timers. */
export function humanTurn(letter = 'c', modifier?: GameState['modifier']): GameState {
  let s = createGame({ seed: 'test', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium' }, dict);
  s = advance(s, ctx, T0 + 2500);
  s = structuredClone(s);
  s.chainLetter = letter;
  if (modifier) s.modifier = modifier;
  s.turn!.stealPlans = [];
  s.turn!.stealable = true; // tests steal when they like; steal turns are drawn at random in play
  return s;
}

/** Stop the active bot and its steals from acting on their own. */
export function freezeBots(s: GameState): GameState {
  const c = structuredClone(s);
  c.turn!.botActAt = null;
  c.turn!.stealPlans = [];
  c.turn!.stealable = true;
  return c;
}
