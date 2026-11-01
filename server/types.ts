import type { GameState } from '../src/engine';

export const MAX_ROOM_SIZE = 10;
export const MIN_TO_START = 4;

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
  name: string;
  visibility: Visibility;
  hostId: string;
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
  | 'daily_used'
  | 'daily_unavailable';

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
