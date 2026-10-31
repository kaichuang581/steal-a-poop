export type Difficulty = 'easy' | 'medium' | 'hard';
export type Personality = 'cautious' | 'greedy' | 'random';
export type Round = 1 | 2 | 3;

export type RoundModifier =
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
  personality: Personality | null;
  /** Bots bank once the pile reaches this value. 0 for the human. */
  bankThreshold: number;
  /** Game-wide banked score. May go negative from penalties. */
  banked: number;
  /** Turns used this round. A round ends when every player has used 5. */
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
}

export interface Trap {
  trapperSeat: number;
  victimSeat: number;
  letter: string;
}

export interface ChainEntry {
  round: Round;
  seat: number;
  kind: 'play' | 'steal' | 'bank' | 'timeout' | 'invalid' | 'stealFail';
  word: string | null;
  points: number;
}

export type EventKind =
  | 'roundStart'
  | 'play'
  | 'bank'
  | 'steal'
  | 'stealFail'
  | 'timeout'
  | 'invalid'
  | 'trapSprung'
  | 'burn'
  | 'chainReset'
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
  /** Mulberry32 state. Every random draw advances it, so replays are exact. */
  rng: number;
  mode: GameMode;
  phase: Phase;
  round: Round;
  modifier: RoundModifier;
  /** One modifier per round, drawn at game start. */
  modifierDeck: RoundModifier[];
  chainLetter: string;
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
  | { type: 'steal'; seat: number; word: string };

export interface ActionResult {
  state: GameState;
  /** False when the action was rejected and nothing changed. */
  accepted: boolean;
  /** Rejection reason, or the validation reason for a submitted word that failed. */
  reason?: string;
  /** A one-edit fix for a clear typo. Nothing has changed; the player confirms by resubmitting it. */
  suggestion?: string;
}
