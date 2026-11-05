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

/** What a player has put on, shown beside their name. Chosen from a fixed shop list, never typed text. */
export interface Cosmetics {
  color?: string;
  title?: string;
  badge?: string;
}

export interface RoomViewDTO {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  members: { userId: string; name: string; cosmetics?: Cosmetics; /** The avatar they picked (an id from src/avatars/ids.ts). */ avatar?: string }[];
  phase: 'lobby' | 'playing' | 'finished';
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: GameState | null;
  /** Host has stopped chat for everyone but themselves. */
  chatMuted: boolean;
  /** Players the host has silenced. */
  mutedIds: string[];
}

export interface ChatMsg {
  id: number;
  roomCode: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

/** What a player may see about their own moderation case. Never the filter term or the reviewer's opinion. */
export interface ModerationStatus {
  banned: boolean;
  suspendedUntil: number | null;
  /** Items about this player still waiting for a reviewer or a person. */
  openItems: number;
  waitingSince: number | null;
  /** Their own held message, so they know what is being reviewed. */
  heldMessage: { text: string; at: number } | null;
  appeal: { state: 'none' | 'open' | 'decided'; note?: string; at?: number; verdict?: string; reason?: string };
  /** The reason is present only when a person wrote it. */
  lastDecision: { verdict: string; at: number; byPerson: boolean; reason?: string } | null;
}

export type ServerMsg =
  | { t: 'welcome'; userId: string; name: string; serverNow: number; chat: { banned: boolean; suspendedUntil: number | null }; moderation: ModerationStatus }
  /** Pushed to a player whenever their moderation case changes (held, decided, appealed). */
  | { t: 'moderation'; status: ModerationStatus }
  | { t: 'rooms'; list: PublicRoomInfo[]; serverNow: number }
  | { t: 'room'; view: RoomViewDTO; serverNow: number; you: { userId: string; seat: number | null } }
  | { t: 'left' }
  /** The server is restarting. Reconnect after the given time. */
  | { t: 'shutdown'; reconnectInMs: number }
  /** The host removed you. Sent just before 'left'. */
  | { t: 'kicked' }
  /** The login is about to expire: send { t: 'auth', token } with a fresh one. */
  | { t: 'reauth' }
  /** A friend invites you to a room. The code is sent only to friends. */
  | { t: 'invited'; from: { userId: string; name: string }; code: string; roomName: string }
  | { t: 'inviteResult'; ok: boolean; reason: string | null }
  /** Coins earned from a game that just finished. */
  | { t: 'reward'; coins: number; parts: { label: string; coins: number }[]; balance: number }
  /** Your own block list (user ids), sent after sign-in and whenever it changes. */
  | { t: 'blocks'; list: string[] }
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
  | { t: 'appeal'; note: string }
  | { t: 'block'; userId: string }
  | { t: 'unblock'; userId: string }
  /** Host only. With userId: silence that player. Without: stop chat for everyone but the host. */
  | { t: 'mute'; on: boolean; userId?: string }
  | { t: 'kick'; userId: string }
  /** A fresh login token for the same account, sent when the server asks with 'reauth'. */
  | { t: 'auth'; token: string }
  /** Invite a friend to the room you are in (before the game starts). */
  | { t: 'invite'; userId: string }
  /** The avatar you picked, or null for the default sheep. Cosmetic only. */
  | { t: 'avatar'; id: string | null };

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
    case 'friends_only': return 'You can only invite friends.';
    case 'kicked': return 'The host removed you from that room.';
    case 'cannot_target': return 'You cannot do that to yourself or the host.';
    case 'daily_used': return 'You have already played today\'s Daily Table.';
    case 'daily_unavailable': return 'The Daily Table is not available right now.';
    default: return 'Something went wrong. Try again.';
  }
}
