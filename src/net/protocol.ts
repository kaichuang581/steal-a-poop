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

/** The rules a host may set before starting (server/types.ts RoomSettings). */
export interface RoomSettingsDTO {
  turnsPerRound: 2 | 3 | 5;
  lives: 1 | 2 | 3 | 5;
  twists: boolean;
  /** Farm sheep (bots) the host has added, 0 to 7. Null: none chosen, they fill the table to four. Absent from an older server. */
  bots?: number | null;
  /** How good the farm sheep are. Absent from an older server. */
  botLevel?: 'easy' | 'medium' | 'hard';
}

export interface RoomViewDTO {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  /** Opened by the casual queue (Queue, then Casual): shown as a queue, not as someone's lobby. */
  queue?: boolean;
  /** Game length, picked by the host in the lobby. Absent from an older server. */
  settings?: RoomSettingsDTO;
  members: { userId: string; name: string; cosmetics?: Cosmetics; /** The avatar they picked (an id from src/avatars/ids.ts). */ avatar?: string; /** At a ranked table: their rating (src/lib/ranked.ts). */ rating?: number }[];
  phase: 'lobby' | 'playing' | 'finished';
  min: number;
  max: number;
  seatOf: Record<string, number>;
  game: GameState | null;
  /** Host has stopped chat for everyone but themselves. */
  chatMuted: boolean;
  /** Players the host has silenced. */
  mutedIds: string[];
  /** A ranked table: accounts only, no farm sheep, standard rules, and it starts itself. Absent from an older server. */
  ranked?: boolean;
  /** Ranked, waiting: when the game starts, in server time; null while it waits for a second player. */
  startAt?: number | null;
  /** Ranked, over: each player's rating change, by user id. Arrives a moment after the game ends. */
  rated?: Record<string, { before: number; after: number; delta: number; place: number }> | null;
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
  | ({ t: 'create'; visibility: 'public' | 'private'; roomName?: string } & Partial<RoomSettingsDTO>)
  | { t: 'join'; code: string }
  /** Quick start: the fullest open public room, or a new one. */
  | { t: 'quick' }
  /** The ranked queue: the fullest waiting ranked table, or a new one. Accounts only. */
  | { t: 'ranked' }
  /** Host only, before the game: game length and whether quick-start players may come in. */
  | ({ t: 'options'; visibility?: 'public' | 'private' } & Partial<RoomSettingsDTO>)
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'daily' }
  | { t: 'act'; action: { type: 'play'; word: string } | { type: 'bank' } | { type: 'pass' } }
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
    case 'not_enough_players': return 'You need at least 2 people to start.';
    case 'bad_settings': return 'That setting is not available.';
    case 'rate_limited': return 'Slow down a little and try again.';
    case 'not_in_room': return 'You are not in a room.';
    case 'game_not_running': return 'The game is not running.';
    case 'bad_name': return 'Pick a nickname first.';
    case 'kicked': return 'The host removed you from that room.';
    case 'cannot_target': return 'You cannot do that to yourself or the host.';
    case 'daily_used': return 'You have already played today\'s Daily Table.';
    case 'daily_unavailable': return 'The Daily Table is not available right now.';
    case 'account_required': return 'Ranked needs an account, so your rank has somewhere to live. Sign in and try again.';
    case 'ranked_room': return 'A ranked table runs itself: nobody can change it.';
    case 'ranked_unavailable': return 'Ranked is not switched on for this server yet.';
    default: return 'Something went wrong. Try again.';
  }
}
