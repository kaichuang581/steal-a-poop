import { FAIL_PENALTY, STEAL_BONUS, STEAL_WINDOW_MS, TRAP_PAYOUT } from '../engine';
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
const lastBank = (c: TourCtx) => [...c.game.history].reverse().find((h) => h.kind === 'bank' && h.seat === 0);
const mySteal = (c: TourCtx) => c.game.history.find((h) => h.kind === 'steal' && h.seat === 0);

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome', target: null, kind: 'info', pause: true,
    title: 'Welcome',
    body: () => 'A one-minute tour. You will play one real turn, bank a pile, and see a steal. Nothing here costs you points.',
  },
  {
    id: 'chain', target: 'chain', kind: 'info', pause: true,
    title: 'The chain letter',
    body: (c) => `Every word must start with this tile: ${letter(c)}. After each word the tile flips to that word's last letter, so the chain keeps going.`,
  },
  {
    id: 'me', target: 'me', kind: 'info', pause: true,
    title: 'This is you',
    body: () => `The ring around your seat is your turn timer. It drains, turns yellow, then red. In a real game, running out costs ${FAIL_PENALTY} points.`,
  },
  {
    id: 'play', target: 'input', kind: 'wait', pause: false,
    title: 'Your turn: play a word',
    body: (c) => c.game.turn?.seat === 0
      ? `Type a word starting with ${letter(c)} and press Enter. Stuck? Tap Hint for ideas. Invalid words just bounce back in the tutorial.`
      : 'Your turn starts in a moment…',
    done: (c) => c.game.history.some((h) => h.kind === 'play' && h.seat === 0),
  },
  {
    id: 'pile', target: 'pile', kind: 'info', pause: true,
    title: 'The pile',
    body: () => 'Your word’s points flew into the shared pile. Every play grows it. A bigger pile glows hotter and shortens the timer (10s minus 1s per 10 points, never under 5s).',
  },
  {
    id: 'bank', target: 'bank', kind: 'wait', pause: false,
    title: 'Bank it',
    body: (c) => c.game.turn?.seat === 0
      ? `Press BANK to take the whole pile (${c.game.pile}) into your score.`
      : 'The bots are playing. When your turn comes round, press BANK to move the pile into your score. The pile belongs to nobody until someone banks it, and it burns at the end of the round.',
    done: (c) => c.game.history.some((h) => h.kind === 'bank' && h.seat === 0),
  },
  {
    id: 'banked', target: 'me', kind: 'info', pause: true,
    title: 'Banked',
    body: (c) => `You banked ${lastBank(c)?.points ?? 0}. That score is yours for the whole game, and the pile is back to 0. Bank too late and someone steals it; too early and you forgo growing it.`,
  },
  {
    id: 'waitSteal', target: null, kind: 'wait', pause: false,
    title: 'Now: stealing',
    body: () => `Watch the next bot’s timer. In the last ${STEAL_WINDOW_MS / 1000} seconds of someone else’s turn, the steal window opens…`,
    done: (c) => c.stealOpen && c.game.turn?.seat !== 0,
  },
  {
    id: 'steal', target: 'steal', kind: 'wait', pause: true,
    title: 'Steal window open',
    body: (c) => `The clock is paused for you. Type a word starting with ${letter(c)}, then press STEAL. You take the turn, bank the whole pile and get +${STEAL_BONUS}. Steals are unlimited, so take every chance you get.`,
    done: (c) => !!mySteal(c) || c.game.events.some((e) => e.kind === 'stealFail' && e.seat === 0),
  },
  {
    id: 'stealResult', target: 'me', kind: 'info', pause: true,
    title: 'Steal result',
    body: (c) => mySteal(c)
      ? `STOLEN! You banked ${mySteal(c)!.points} in one move.`
      : 'That word was not valid, so the steal did not go through. Check the spelling and try again while the window is open.',
  },
  {
    id: 'traps', target: null, kind: 'info', pause: true,
    title: 'Trap letters',
    body: () => `End a word on X, Z, Q or J (shown in gold) and you set a trap. If the next player times out or plays an invalid word, you get +${TRAP_PAYOUT}.`,
  },
  {
    id: 'modifier', target: 'modifier', kind: 'info', pause: true,
    title: 'Round modifiers',
    body: () => 'Each of the 3 rounds has one special rule, announced at round start and shown here: no E, 6+ letters, double letters, vowel-start words worth 2x, or double points with a shorter timer.',
  },
  {
    id: 'winning', target: 'me', kind: 'info', pause: true,
    title: 'Winning',
    body: () => 'After 3 rounds, the highest banked score wins. Ties go to most steals, then longest word.',
  },
  {
    id: 'done', target: null, kind: 'info', pause: true,
    title: 'You are ready',
    body: () => 'That is everything. Reopen the tutorial any time from Settings, or read the Scoring and FAQ tabs under How to Play.',
  },
];
