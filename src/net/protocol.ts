import type { GameState } from '../engine';

/** The shapes the game server sends (see server/index.ts and docs/SERVER.md). */
export interface PublicRoomInfo {
  code: string;
  name: string;
  hostName: string;
  players: number;
  max: number;
  min: number;
}

export interface RoomViewDTO {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  members: { userId: string; name: string }[];
  phase: 'lobby' | 'playing' | 'finished';
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: GameState | null;
}

export interface ChatMsg {
  id: number;
  roomCode: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

export type ServerMsg =
  | { t: 'welcome'; userId: string; name: string; serverNow: number; chat: { banned: boolean; suspendedUntil: number | null } }
  | { t: 'rooms'; list: PublicRoomInfo[]; serverNow: number }
  | { t: 'room'; view: RoomViewDTO; serverNow: number; you: { userId: string; seat: number | null } }
  | { t: 'left' }
  | { t: 'result'; accepted: boolean; reason: string | null; suggestion: string | null }
  | { t: 'chat'; message: ChatMsg }
  | { t: 'chatBlocked'; reason: string; until: number | null; retryAfterMs: number | null }
  | { t: 'reportResult'; ok: boolean; reason: string | null }
  | { t: 'appealResult'; ok: boolean; reason: string | null }
  | { t: 'error'; error: string };

export type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'rooms' }
  | { t: 'create'; visibility: 'public' | 'private'; roomName?: string }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'daily' }
  | { t: 'act'; action: { type: 'play'; word: string } | { type: 'steal'; word: string } | { type: 'bank' } }
  | { t: 'chat'; text: string }
  | { t: 'report'; messageId: number }
  | { t: 'appeal'; note: string };

/** Human-readable text for a server error code. */
export function describeError(code: string): string {
  switch (code) {
    case 'bad_code': return 'That is not a valid room code.';
    case 'room_not_found': return 'No room with that code.';
    case 'room_full': return 'That room is full.';
    case 'room_started': return 'That game has already started.';
    case 'already_in_room': return 'You are already in a room.';
    case 'not_host': return 'Only the host can do that.';
    case 'not_enough_players': return 'You need at least 4 players to start.';
    case 'rate_limited': return 'Slow down a little and try again.';
    case 'not_in_room': return 'You are not in a room.';
    case 'game_not_running': return 'The game is not running.';
    case 'bad_name': return 'Pick a nickname first.';
    case 'daily_used': return 'You have already played today\'s Daily Table.';
    case 'daily_unavailable': return 'The Daily Table is not available right now.';
    default: return 'Something went wrong. Try again.';
  }
}
