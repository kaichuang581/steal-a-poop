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
}

export interface RouteResponse {
  status: number;
  json?: unknown;
}

export interface Route {
  method: HttpMethod;
  /** For example "/api/leaderboard/:period". */
  path: string;
  /** none: anyone. user: a signed-in user. moderator: a signed-in moderator. */
  auth: 'none' | 'user' | 'moderator';
  handler: (req: RouteRequest) => Promise<RouteResponse> | RouteResponse;
}
