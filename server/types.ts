import type { GameState } from '../src/engine';

export const MAX_ROOM_SIZE = 10;
/** People needed before the host can start. Empty seats up to MIN_TABLE are taken by farm sheep (bots). */
export const MIN_TO_START = 2;
/** The smallest table the game plays at (the engine's MIN_PLAYERS). */
export const MIN_TABLE = 4;

/** The rules the host picks before starting: the same three the solo "Set the table" panel offers. */
export interface RoomSettings {
  turnsPerRound: 2 | 3 | 5;
  lives: 1 | 2 | 3 | 5;
  twists: boolean;
  /**
   * How many farm sheep (bots) the host has put at the table, 0 to MAX_BOTS: none for people only, some for a mixed
   * table, and with nobody else in the lobby a game against bots alone. Null is the old rule, kept for the Quick play
   * queue and for a lobby whose host never chose: farm sheep fill the table to MIN_TABLE and two people are needed.
   */
  bots: number | null;
  /** How good the farm sheep are. */
  botLevel: 'easy' | 'medium' | 'hard';
}
/** The most farm sheep a host can add. The table never seats more than MAX_ROOM_SIZE, people and bots together. */
export const MAX_BOTS = 7;
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { turnsPerRound: 2, lives: 3, twists: true, bots: null, botLevel: 'medium' };

/** Ranked tables (src/lib/ranked.ts has the ladder): people only, started by the server itself. */
export { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS } from '../src/lib/ranked';
/** A ranked table starts this long after its second player sits down, so a third and fourth can still make it. */
export const RANKED_WAIT_MS = 20_000;
/** A full ranked table starts this soon. */
export const RANKED_FULL_WAIT_MS = 4_000;

/**
 * Empty seats in the casual queue and in a lobby (Brian, 2026-11-14: "only make it do bots if after 10 seconds nobody
 * joins. and make it gradual", then "remove the option to add bots. just add in the bots after the 15 sec thing").
 * After QUEUE_QUIET_MS with no new person, bots sit down one at a time, QUEUE_BOT_GAP_MS apart (a gap picked from the
 * range for each), until the table holds MIN_TABLE. A person who comes in takes a bot's seat and the quiet starts over.
 * A queue table of MIN_TABLE or more starts itself QUEUE_FULL_WAIT_MS later; a lobby waits for its host.
 */
export const QUEUE_QUIET_MS = 15_000;
export const QUEUE_BOT_GAP_MS: readonly [number, number] = [1_500, 4_000];
export const QUEUE_FULL_WAIT_MS = 5_000;

export type Visibility = 'public' | 'private';
export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface Member {
  userId: string;
  name: string;
  /** Order of joining. The second-earliest member becomes host if the host leaves. */
  joinedAt: number;
}

export interface Room {
  code: string;
  /** 'fr' for a French table (French word list, matched only with French players); absent is English. */
  lang?: 'fr';
  name: string;
  visibility: Visibility;
  hostId: string;
  /** Opened by Quick play, not by someone creating a lobby: the app shows it as a queue. */
  queue: boolean;
  /** Game length, set by the host in the lobby. */
  settings: RoomSettings;
  members: Member[];
  phase: RoomPhase;
  game: GameState | null;
  /** userId -> engine seat. Set when the host starts the game. */
  seatOf: Record<string, number>;
  /** "daily" is a server-run Daily Table session: one human against bots, no joining. */
  kind: 'room' | 'daily';
  /** UTC date key for a daily session, otherwise null. */
  dailyDate: string | null;
  /** Identifies one game, for results. Set when the game starts. */
  gameId: string | null;
  /** True once the finished game has been reported, so it is reported only once. */
  reported: boolean;
  /** Host has stopped chat for everyone but themselves. */
  chatMuted: boolean;
  /** Players the host has silenced in this room. */
  mutedIds: string[];
  /** Players the host removed. They cannot rejoin this room. */
  kicked: string[];
  /** When the game ended, for clean-up. */
  finishedAt: number | null;
  /** A ranked table: opened by the ranked queue, accounts only, no farm sheep, fixed rules, and it starts itself. */
  ranked: boolean;
  /** Ranked, in the lobby: when the game will start (server time), or null while it still waits for a second player. */
  startAt: number | null;
  /** Ranked: who sat where when the game began. `seatOf` loses a player who leaves; this keeps them, to be placed. */
  ratedSeats: { userId: string; seat: number }[];
  /** Ranked: when each player who walked out of the running game did so. */
  leftAt: Record<string, number>;
  /** Ranked, once the game is over and the ratings are in: each player's change. */
  rated: Record<string, { before: number; after: number; delta: number; place: number }> | null;
  /** The casual queue: the bots seated so far, by name (player-like names, src/lib/playerNames.ts). Empty elsewhere. */
  botNames: string[];
  /** The casual queue: when a person last came in (or the room opened); bots wait QUEUE_QUIET_MS after it. */
  quietSince: number;
  /** The casual queue: when the next bot sits down, or null while none is due. */
  botAt: number | null;
}

export type RoomError =
  | 'already_in_room'
  | 'room_not_found'
  | 'room_full'
  | 'room_started'
  | 'not_in_room'
  | 'not_host'
  | 'not_enough_players'
  | 'game_not_running'
  | 'bad_name'
  | 'bad_code'
  | 'bad_settings'
  | 'kicked'
  | 'cannot_target'
  | 'daily_used'
  | 'daily_unavailable'
  | 'account_required'
  | 'ranked_room';

export type Ok<T = object> = { ok: true } & T;
export type Err = { ok: false; error: RoomError };
export type Result<T = object> = Ok<T> | Err;

export interface PublicRoomInfo {
  code: string;
  name: string;
  hostName: string;
  players: number;
  max: number;
  min: number;
}
