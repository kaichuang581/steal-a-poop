import type { GameSettings } from './settings';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Personality = 'cautious' | 'greedy' | 'random';
/** 1 up to the game's `settings.rounds`. */
export type Round = number;

export type RoundModifier =
  | 'none'
  | 'no_e'
  | 'six_plus'
  | 'double_letter'
  | 'vowel_double'
  | 'double_points_fast';

export type Phase = 'intro' | 'playing' | 'gameOver';

/**
 * normal: full rules. practice: no penalties, invalid words can be retried, roomy human timer.
 * tour: practice plus scripted bots, used by the interactive tutorial.
 */
export type GameMode = 'normal' | 'practice' | 'tour';

export interface Player {
  /** Seat index. Seat 0 is always the human. Turns go seat 0 -> 1 -> ... -> n-1 -> 0. */
  id: number;
  name: string;
  emoji: string;
  color: string;
  isHuman: boolean;
  difficulty: Difficulty | null;
  /** The last round this sheep passed the bomb in (once a round). */
  passedRound?: number;
  personality: Personality | null;
  /** Bots bank once the pile reaches this value. 0 for the human. */
  bankThreshold: number;
  /** Unused since the game became last-sheep-standing (no points); always 0. Kept so saved games and rooms still load. */
  banked: number;
  /** Wool balls: the sheep's lives. A turn that runs out costs one, a steal takes one; none left and the sheep freezes. */
  lives: number;
  /** Out of wool: skipped for the rest of the game, cannot steal. The last unfrozen sheep wins. */
  frozen: boolean;
  /** When the sheep froze (game time), so later freezes rank above earlier ones. Null while it is still in. */
  frozenAt: number | null;
  /** A bad steal word blocks this sheep's next steal until this time. */
  stealCooldownUntil: number;
  /** Turns used this round. A round ends when every unfrozen player has used the round's turns. */
  turnsTaken: number;
  lastWord: string | null;
  steals: number;
  wordsPlayed: number;
  longestWord: string;
  bestWord: { word: string; points: number } | null;
}

export interface TurnState {
  seat: number;
  startedAt: number;
  endsAt: number;
  durationMs: number;
  /** When the active bot acts. Null for a human turn. */
  botActAt: number | null;
  /** Scheduled steal attempts by bots on this turn. */
  stealPlans: { seat: number; at: number }[];
  /** A steal turn: the last (red) seconds are open for the other sheep to rob this one. Drawn when the turn starts. */
  stealable: boolean;
}

export interface Trap {
  trapperSeat: number;
  victimSeat: number;
  letter: string;
}

export interface ChainEntry {
  round: Round;
  seat: number;
  kind: 'play' | 'steal' | 'bank' | 'timeout' | 'invalid' | 'stealFail' | 'pass';
  word: string | null;
  points: number;
  /** For a steal: the seat the wool ball was taken from. */
  fromSeat?: number;
}

export type EventKind =
  | 'roundStart'
  | 'play'
  | 'pass'
  | 'bank'
  | 'steal'
  | 'stealFail'
  | 'timeout'
  | 'invalid'
  | 'trapSprung'
  | 'burn'
  | 'chainReset'
  | 'seatBot'
  | 'stealTurn'
  | 'lifeLost'
  | 'frozen'
  | 'gameOver';

export interface GameEvent {
  id: number;
  at: number;
  kind: EventKind;
  seat: number | null;
  text: string;
  amount: number;
  /** The word, for play and steal events. */
  word?: string;
}

export interface GameState {
  seed: string;
  /** The game length settings this game was created with (plan V3.3 Part 2). */
  settings: GameSettings;
  /** Mulberry32 state. Every random draw advances it, so replays are exact. */
  rng: number;
  mode: GameMode;
  phase: Phase;
  round: Round;
  modifier: RoundModifier;
  /** One modifier per round, drawn at game start. */
  modifierDeck: RoundModifier[];
  chainLetter: string;
  /** Time carry: ms the next turn is stretched (+) or squeezed (-) by the last word. Absent or 0 when off. */
  carryMs?: number;
  /** A pass: the next turn lasts this long (the fuse that was left), once. */
  passMs?: number;
  pile: number;
  used: string[];
  players: Player[];
  turn: TurnState | null;
  introEndsAt: number | null;
  trap: Trap | null;
  history: ChainEntry[];
  events: GameEvent[];
  eventSeq: number;
  winners: number[] | null;
}

export type Action =
  | { type: 'play'; seat: number; word: string }
  | { type: 'bank'; seat: number }
  | { type: 'steal'; seat: number; word: string }
  /** Hand the bomb to the next sheep without playing a word: once a round, and they get the fuse that is left. */
  | { type: 'pass'; seat: number };

export interface ActionResult {
  state: GameState;
  /** False when the action was rejected and nothing changed. */
  accepted: boolean;
  /** Rejection reason, or the validation reason for a submitted word that failed. */
  reason?: string;
  /** A one-edit fix for a clear typo. Nothing has changed; the player confirms by resubmitting it. */
  suggestion?: string;
}
