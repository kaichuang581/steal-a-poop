/**
 * Checks a login token (a JWT issued by Supabase Auth) on the server. The signature is verified with the
 * project's public keys (JWKS) or, for older projects, its shared secret; the issuer, audience and expiry
 * are checked; the session must not have been logged out; and the token must not predate a "log out
 * everywhere". Nothing from the token is trusted until all of that passes.
 */
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import type { CryptoKey, JWTPayload, KeyObject } from 'jose';
import type { AuthUser, SessionClaims } from '../contracts';
import { mayChat } from './policy';
import type { AccountStore } from './store';

export interface TokenVerifierOptions {
  /** The token's `iss`, for Supabase "https://<project>.supabase.co/auth/v1". */
  issuer: string;
  /** Public keys of the project, "https://<project>.supabase.co/auth/v1/.well-known/jwks.json". Preferred. */
  jwksUrl?: string;
  /** Legacy projects: the shared JWT secret (HS256). Never put it in the browser or the repository. */
  jwtSecret?: string;
  /** For tests: a key to verify with instead of fetching one. */
  key?: CryptoKey | KeyObject | Uint8Array;
  algorithms?: string[];
  audience?: string;
  now?: () => number;
}

export class TokenVerifier {
  private key: Parameters<typeof jwtVerify>[1];
  private algorithms: string[];

  constructor(
    private opts: TokenVerifierOptions,
    private store: AccountStore,
  ) {
    if (opts.key) {
      this.key = opts.key as never;
      this.algorithms = opts.algorithms ?? ['ES256', 'RS256', 'EdDSA', 'HS256'];
    } else if (opts.jwksUrl) {
      this.key = createRemoteJWKSet(new URL(opts.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 }) as never;
      this.algorithms = opts.algorithms ?? ['ES256', 'RS256', 'EdDSA'];
    } else if (opts.jwtSecret) {
      this.key = new TextEncoder().encode(opts.jwtSecret) as never;
      this.algorithms = ['HS256'];
    } else {
      throw new Error('TokenVerifier needs a jwksUrl, a jwtSecret or a key');
    }
  }

  private now = () => (this.opts.now ?? Date.now)();

  /** A verified login, or null. Does not need a profile. */
  async claims(token: string): Promise<SessionClaims | null> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.key as never, {
        issuer: this.opts.issuer,
        audience: this.opts.audience ?? 'authenticated',
        algorithms: this.algorithms,
        clockTolerance: 5,
        currentDate: new Date(this.now()),
      }));
    } catch (e) {
      if (!(e instanceof errors.JOSEError)) throw e; // a bug or a network failure is not "bad token"
      return null;
    }
    const { sub, session_id: sessionId, iat, exp, email } = payload as JWTPayload & { session_id?: unknown; email?: unknown };
    if (typeof sub !== 'string' || !sub || typeof sessionId !== 'string' || !sessionId) return null;
    if (typeof iat !== 'number' || typeof exp !== 'number') return null;
    if (await this.store.isSessionRevoked(sessionId)) return null;
    const profile = await this.store.getProfile(sub);
    if (profile) {
      if (profile.deletedAt !== null) return null;
      if (iat < Math.floor(profile.sessionsValidAfter / 1000)) return null; // issued before "log out everywhere"
    }
    // Supabase lists how and when the person signed in: amr: [{ method, timestamp }]. A refreshed token has a new
    // `iat` without the person having proved anything, so "recently signed in" must use this, not `iat`.
    const amr = (payload as { amr?: unknown }).amr;
    const stamps = Array.isArray(amr) ? amr.map((a) => Number((a as { timestamp?: unknown })?.timestamp)).filter((t) => Number.isFinite(t) && t > 0) : [];
    const authenticatedAt = stamps.length ? Math.max(...stamps) * 1000 : iat * 1000;
    return { userId: sub, email: typeof email === 'string' ? email : null, sessionId, issuedAt: iat * 1000, expiresAt: exp * 1000, authenticatedAt };
  }

  /** The signed-in player, or null. A profile is required (sign-up has to be finished). */
  async authenticate(token: string): Promise<AuthUser | null> {
    const c = await this.claims(token);
    if (!c) return null;
    const profile = await this.store.getProfile(c.userId);
    if (!profile || profile.deletedAt !== null) return null;
    return {
      userId: c.userId,
      name: profile.nickname,
      chatAllowed: mayChat(profile.consentStatus),
      resultsAllowed: mayChat(profile.consentStatus),
      isModerator: profile.isModerator,
      country: profile.country ?? undefined,
      session: { id: c.sessionId, expiresAt: c.expiresAt },
    };
  }
}
