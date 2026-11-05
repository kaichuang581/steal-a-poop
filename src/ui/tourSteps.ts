import { STEAL_WINDOW_MS } from '../engine';
import type { GameState } from '../engine';

export interface TourCtx {
  game: GameState;
  stealOpen: boolean;
}

export interface TourStep {
  id: string;
  /** Matches a data-tour attribute in the UI. Null centres the card. */
  target: string | null;
  title: string;
  body: (c: TourCtx) => string;
  /** info: game clock paused, press Next. wait: runs until `done` is true. */
  kind: 'info' | 'wait';
  /** Freeze the game clock while this step shows. */
  pause: boolean;
  done?: (c: TourCtx) => boolean;
}

const letter = (c: TourCtx) => c.game.chainLetter.toUpperCase();
const mySteal = (c: TourCtx) => c.game.history.find((h) => h.kind === 'steal' && h.seat === 0);
const myWool = (c: TourCtx) => c.game.players[0]?.lives ?? 0;
const redSeconds = STEAL_WINDOW_MS / 1000;

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome', target: null, kind: 'info', pause: true,
    title: 'Welcome',
    body: () => 'A one-minute tour. You will play a word and steal a wool ball. Nobody loses wool in the tour, so relax.',
  },
  {
    id: 'chain', target: 'chain', kind: 'info', pause: true,
    title: 'The chain letter',
    body: (c) => `Every word must start with this letter: ${letter(c)}. After each word it changes to that word's last letter, so the chain keeps going.`,
  },
  {
    id: 'me', target: 'me', kind: 'info', pause: true,
    title: 'You and your wool balls',
    body: (c) => `This is you. The little wool balls are your lives: you have ${myWool(c)}. The ring is your turn timer. Run out of time and you lose a wool ball. Lose them all and you freeze solid and are out.`,
  },
  {
    id: 'play', target: 'input', kind: 'wait', pause: false,
    title: 'Your turn: play a word',
    body: (c) => c.game.turn?.seat === 0
      ? `Type a real word (3+ letters) starting with ${letter(c)} and press Enter. Stuck? Tap Hint. A word that doesn't work just bounces back, so try another. A clear typo gets a suggested fix: press Enter again to accept it.`
      : 'Your turn starts in a moment…',
    done: (c) => c.game.history.some((h) => h.kind === 'play' && h.seat === 0),
  },
  {
    id: 'waitSteal', target: null, kind: 'wait', pause: false,
    title: 'Now: stealing',
    body: () => `Nice! Now watch the other sheep. When someone's timer turns red (their last ${redSeconds} seconds), you can steal…`,
    done: (c) => c.stealOpen && c.game.turn?.seat !== 0,
  },
  {
    id: 'steal', target: 'steal', kind: 'wait', pause: true,
    title: 'Their timer is red: steal!',
    body: (c) => `The clock is paused for you. Type a word starting with ${letter(c)} and press STEAL (or Enter). Get a word in first and you take one of their wool balls.`,
    done: (c) => !!mySteal(c) || c.game.events.some((e) => e.kind === 'stealFail' && e.seat === 0),
  },
  {
    id: 'stealResult', target: 'me', kind: 'info', pause: true,
    title: 'Steal result',
    body: (c) => mySteal(c)
      ? 'STOLEN! One of their wool balls is now yours, and the turn moved on. Steal whenever you see red.'
      : 'That word didn’t work, so it bounced. A bad steal word costs nothing: you just wait a second before you can try again.',
  },
  {
    id: 'traps', target: null, kind: 'info', pause: true,
    title: 'Traps',
    body: () => 'End a word on X, Z, Q or J to set a trap. If the next sheep runs out of time, you get a wool ball.',
  },
  {
    id: 'modifier', target: 'modifier', kind: 'info', pause: true,
    title: 'Rounds and twists',
    body: () => 'Every sheep takes 2 turns a round, and each round the timer gets shorter. Rounds after the first add a twist, shown here: no E, 6+ letters, a double letter, or an even faster round.',
  },
  {
    id: 'winning', target: 'me', kind: 'info', pause: true,
    title: 'Winning',
    body: () => 'Last sheep standing wins. The game ends the moment only one sheep is not frozen.',
  },
  {
    id: 'done', target: null, kind: 'info', pause: true,
    title: 'You are ready',
    body: () => 'That is everything. Reopen the tutorial any time from Settings, or read the Rules and FAQ under How to Play.',
  },
];
