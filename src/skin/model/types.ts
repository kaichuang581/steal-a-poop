export type Hour = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Place = 'meadow' | 'pier' | 'porch' | 'kitchen' | 'teahouse';
export type Mode = 'quick' | 'daily' | 'practice' | 'tutorial' | 'rooms';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TwistId = 'noE' | 'sixPlus' | 'doubleLetter' | 'vowelDouble' | 'doublePointsShort';
export type CreatureId = 'moss' | 'pip' | 'willow' | 'bramble' | 'fern' | 'quill' | 'juniper';
export type Weather = 'none' | 'mist' | 'rain' | 'leaves' | 'snow';

export interface PlayerView {
  id: string;
  name: string;
  isYou: boolean;
  isBot: boolean;
  difficulty?: Difficulty;
  creature?: CreatureId;      // assigned by the skin, stable per player id
  banked: number;             // unused since there are no points (always 0)
  dimmed: boolean;            // lost turn or failed steal, until the next turn starts
  lives: number;              // wool balls left (3 at game start)
  frozen: boolean;            // out of lives: skipped for the rest of the game
}

export interface MessageView {
  kind: 'invalid' | 'typo' | 'timeout' | 'penalty' | 'info' | 'thinking';
  text: string;
  fix?: string;               // for kind === 'typo'
}

export interface TableView {
  mode: Mode;
  phase: 'setup' | 'turn' | 'roundEnd' | 'gameEnd';
  round: number;
  turn: number;               // 1..5 within the round for the current player
  twist: TwistId | null;
  pile: number;
  letter: string | null;      // the required starting letter
  isTrapLetter: boolean;      // letter is X, Z, Q or J
  players: PlayerView[];
  currentPlayerId: string;
  youId: string;
  secondsLeft: number;        // fractional allowed
  turnSeconds: number;        // 5..16 (faster each round), or 25 in the tutorial
  stealOpen: boolean;         // last 3 seconds of another player's turn
  typed: string;              // the current input text
  message: MessageView | null;
  longestWord?: { word: string; playerId: string };
  winnerIds?: string[];
  streakDays?: boolean[];     // Daily: last 7 days, true = played
  dailyPlayedToday?: boolean;
}

export const TWIST_TEXT: Record<TwistId, string> = {
  noE: 'No letter E',
  sixPlus: 'Words of 6 letters or more',
  doubleLetter: 'Words need a double letter',
  vowelDouble: 'Plain rules',
  doublePointsShort: 'Faster round: 2 seconds shorter',
};

export const PLACE_FOR_MODE: Record<Mode, Place> = {
  quick: 'meadow', daily: 'pier', practice: 'porch', tutorial: 'kitchen', rooms: 'teahouse',
};
