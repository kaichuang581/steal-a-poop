/**
 * Types shared between lanes. A lane may ADD fields here only in its own pull request that
 * touches nothing else, and must not rename or remove anything. See docs/LANES.md.
 */

export interface AuthUser {
  userId: string;
  /** Display name, already checked by the accounts lane. */
  name: string;
  /** False for accounts that may not chat: under-13 without parental consent, or banned. */
  chatAllowed: boolean;
  /** True for people who may use the moderation tools. */
  isModerator: boolean;
  /** Two-letter country code from sign-up, if known. */
  country?: string;
  /** The login session this user signed in with. Lets the server expire and end it. Absent for dev sign-in. */
  session?: { id: string; expiresAt: number };
  /** False for a child whose parent has not consented: they may play, but results are not stored. Default true. */
  resultsAllowed?: boolean;
}

/** A verified login that may not have a profile yet (the moment right after sign-up). */
export interface SessionClaims {
  userId: string;
  email: string | null;
  sessionId: string;
  /** Epoch ms. */
  issuedAt: number;
  expiresAt: number;
  /** When the person last proved who they are (typed a password, or completed Google/Meta sign-in). Epoch ms. */
  authenticatedAt: number;
}

/** Turns a login token into a user, or null. Used by the WebSocket and the HTTP API. */
export type VerifyToken = (token: string) => Promise<AuthUser | null>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteRequest {
  /** Values of ":name" segments in the path. */
  params: Record<string, string>;
  query: Record<string, string>;
  /** Parsed JSON body, or null when there is none. */
  body: unknown;
  user: AuthUser | null;
  /** For routes with auth "session": the verified login, with or without a profile. */
  session?: SessionClaims | null;
  /** The caller's address as the server sees it (the proxy's header when trusted). For rate limits only. */
  ip: string;
}

export interface RouteResponse {
  status: number;
  json?: unknown;
}

export interface Route {
  method: HttpMethod;
  /** For example "/api/leaderboard/:period". */
  path: string;
  /** none: anyone. session: a verified login (a profile is not required yet). user: a signed-in user with a profile. moderator: a signed-in moderator. */
  auth: 'none' | 'session' | 'user' | 'moderator';
  handler: (req: RouteRequest) => Promise<RouteResponse> | RouteResponse;
}

/** One finished game, reported by the rooms lane and consumed by the accounts lane (leaderboards). */
export interface GameResult {
  gameId: string;
  /** "room" for a multiplayer game, "daily" for a server-run Daily Table session. */
  mode: 'room' | 'daily';
  roomCode: string | null;
  /** UTC date key such as 2026-11-01, for daily games. */
  dailyDate: string | null;
  finishedAt: number;
  players: {
    /** null for a bot, including a bot that replaced someone who left. */
    userId: string | null;
    name: string;
    seat: number;
    banked: number;
    steals: number;
    wordsPlayed: number;
    longestWord: string;
  }[];
  /** userIds of the winner(s); bots are never listed. */
  winners: string[];
}

export type GameResultSink = (result: GameResult) => Promise<void> | void;

/** Decides whether a player may start today's Daily Table. Implemented by the accounts lane. */
export interface DailyGate {
  /** Reserves the one attempt for this user and date. False if they already used it. */
  reserve(userId: string, dailyDate: string): Promise<boolean>;
}
