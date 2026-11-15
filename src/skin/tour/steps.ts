import { MIN_WORD_LENGTH, TURN_MS_BY_ROUND } from '../../engine';
import type { GameState } from '../../engine';
import { TWIST_TEXT } from '../model/types';

/**
 * The tutorial's script for the painted game (Brian, 2026-11-13: "refurbish the tutorial now, its very outdated both
 * ui-wise and all around"). One guided round at the barn table: read a card, play a word, watch the chain go on, read
 * what the bomb and the wool balls are, play once more. It has no card about traps: the game has none (the same day:
 * "idk why it says that getting someone killed will 'give you a wool ball' ... fix it immediately"). Every number and name in it is read from the engine, so the
 * text cannot drift from the rules again (the old one still spoke of a timer ring, a hint button and a faster-round
 * twist, none of which exist).
 *
 * `info` steps stop the game's clock and wait for Next. `wait` steps let the game run until `done` says the player has
 * done the thing, then `linger` a moment so the result is seen before the next card stops the clock.
 */
export interface TourCtx { game: GameState; mySeat: number }

/** What a step points at: a 3D thing the scene reports (`mark:board`, `mark:bomb`, see marks.ts) or a CSS selector.
 *  The first one that is on screen is ringed. */
export type TourTarget = `mark:${string}` | string;

export interface TourStep {
  id: string;
  kind: 'info' | 'wait';
  targets: TourTarget[];
  title: string;
  body: (c: TourCtx) => string;
  /** A second, quieter line. */
  note?: (c: TourCtx) => string | null;
  /** What the button says on an info step (Next when left out). */
  next?: string;
  done?: (c: TourCtx) => boolean;
  /** How long after `done` the next card comes, in ms. */
  linger?: number;
}

const up = (s: string) => s.toUpperCase();
const plays = (c: TourCtx) => c.game.history.filter((h) => h.kind === 'play' && !!h.word);
export const myPlays = (c: TourCtx) => plays(c).filter((h) => h.seat === c.mySeat);
const letter = (c: TourCtx) => up(c.game.chainLetter);
const myTurn = (c: TourCtx) => c.game.phase === 'playing' && c.game.turn?.seat === c.mySeat;
/** The first word anyone played after the player's latest one, if any yet. */
const answer = (c: TourCtx) => {
  const all = plays(c);
  const mine = all.map((h) => h.seat).lastIndexOf(c.mySeat);
  return mine < 0 ? null : all.slice(mine + 1).find((h) => h.seat !== c.mySeat) ?? null;
};

/** "15, 10, then 5 seconds", from the engine's own turn lengths. */
export const turnLengths = () => {
  const s = TURN_MS_BY_ROUND.map((ms) => ms / 1000);
  return `${s.slice(0, -1).join(', ')}, then ${s.at(-1)} seconds`;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome', kind: 'info', targets: [], next: 'Start',
    title: 'Learn the game',
    body: () => 'One round with the farm’s sheepdog, about a minute. Nothing here counts: nobody loses wool.',
  },
  {
    id: 'letter', kind: 'info', targets: ['mark:board', '.kit-float-need'],
    title: 'The letter',
    body: (c) => `Every word has to start with the letter on the board. Right now that is ${letter(c)}.`,
  },
  {
    id: 'play', kind: 'wait', targets: ['.sk-input-bar'], linger: 700,
    title: 'Your turn',
    body: (c) => (myTurn(c)
      ? `Type a real word that starts with ${letter(c)}, ${MIN_WORD_LENGTH} letters or more, and press Enter.`
      : 'Your turn is coming up.'),
    note: (c) => (myTurn(c) ? 'Stuck? The book under your word has ideas.' : null),
    done: (c) => myPlays(c).length >= 1,
  },
  {
    // Short enough that the next card stops the clock while the sheep after that one still has the bomb by it.
    id: 'chain', kind: 'wait', targets: ['mark:board', '.kit-float-need'], linger: 900,
    title: 'The chain',
    body: (c) => {
      const mine = myPlays(c).at(-1)?.word;
      if (!mine) return 'Each word starts with the last letter of the one before it.';
      const next = answer(c)?.seat ?? c.game.turn?.seat;
      const who = next === undefined || next === c.mySeat ? 'the next sheep' : c.game.players[next]?.name ?? 'the next sheep';
      return `${up(mine)} ends in ${up(mine.at(-1)!)}, so the next word starts with ${up(mine.at(-1)!)}. Watch ${who} answer.`;
    },
    done: (c) => answer(c) !== null,
  },
  {
    id: 'bomb', kind: 'info', targets: ['mark:bomb'],
    title: 'The bomb is the clock',
    body: () => 'It sits with whoever is up and counts down. Play a word before it goes off and it moves on to the next sheep.',
  },
  {
    id: 'wool', kind: 'info', targets: ['.sk-plate:has(.sk-plate-you)', '[data-tour="me"]'],
    title: 'Wool balls are lives',
    body: (c) => {
      const n = c.game.players[c.mySeat]?.lives ?? 0;
      return `If the bomb goes off on your turn, you lose a wool ball. You have ${n}, marked by your name. Lose them all and you freeze: out of the game.`;
    },
    note: () => 'A wrong word costs nothing. It bounces, and you try another.',
  },
  {
    id: 'rounds', kind: 'info', targets: ['.sk-hud-tab'],
    title: 'Faster rounds, then twists',
    body: () => `Turns get shorter every round: ${turnLengths()}.`,
    note: () => `From round 2 each round has a twist, such as “${TWIST_TEXT.noE}” or “${TWIST_TEXT.sixPlus}”. An alarm calls it, and it is written up here.`,
  },
  {
    id: 'again', kind: 'wait', targets: ['.sk-input-bar'], linger: 700,
    title: 'One more',
    body: (c) => (myTurn(c)
      ? `Your turn again: a word that starts with ${letter(c)}.`
      : 'Play another word when the bomb comes back round to you.'),
    done: (c) => myPlays(c).length >= 2,
  },
  {
    id: 'done', kind: 'info', targets: [],
    title: 'That’s the game',
    body: () => 'Last sheep standing wins.',
    note: () => 'Replay this any time from Settings. The book at the top of a game has the full rules.',
  },
];

/** How soon after a card comes up Enter may move it on. The Enter that plays a word must never also dismiss the card
 *  that word brings up (the old tutorial lost its Traps card that way), and neither must a held key. */
export const ENTER_GUARD_MS = 350;
export const enterMovesOn = (sinceShownMs: number, repeat: boolean) => !repeat && sinceShownMs >= ENTER_GUARD_MS;
