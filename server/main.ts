import { randomInt } from 'node:crypto';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { createDictionary } from '../src/engine';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { createModerationRoutes } from './routes/moderation';
import { BlockList, PostgresBlockStore } from './blocks';
import { MemoryAudit, PostgresAudit } from './moderation/audit';
import { PostgresReportStore, PostgresStore } from './moderation/postgres';
import { ChildSafetyService, MemoryReportStore } from './moderation/reporting';
import { createHttpServer } from './http';
import { startServer } from './index';
import type { SessionClaims, VerifyToken } from './contracts';
import { DevCaptcha, TurnstileVerifier } from './auth/captcha';
import { ConsoleMailer } from './auth/mailer';
import type { Mailer } from './auth/mailer';
import { DEFAULT_AGE_POLICY } from './auth/policy';
import { RevocationBus } from './auth/revocations';
import { AccountService, SupabaseAuthAdmin } from './auth/service';
import { MemoryAccountStore, PostgresAccountStore } from './auth/store';
import { TokenVerifier } from './auth/tokens';
import { createAccountRoutes } from './routes/accounts';
import { allRoutes } from './routes';
import { ClaudeReviewer } from './review';

/**
 * Starts the game server.
 *   PORT                  default 8787
 *   ALLOW_DEV_AUTH=1      accept "dev:<name>" tokens. Local development only.
 *   ALLOWED_ORIGINS       comma-separated site origins allowed to call the HTTP API and to open a game socket.
 *                         Required when NODE_ENV=production (the server refuses to start without it).
 *   MAX_CONNECTIONS_PER_IP  open sockets per address, default 20
 *   MAX_CONNECTIONS       open sockets in total, default 2000
 *   HEARTBEAT_MS          ping interval, default 25000
 *   TRUST_PROXY=1         take the client address from Fly-Client-IP / X-Forwarded-For. Only behind a proxy you control
 *   STEAL_ORDERING        'arrival' (default) or 'compensated'. See docs/SERVER.md before using compensated
 *   STEAL_BUFFER_MS       how long compensated mode collects steals, default 250
 *   FINISHED_ROOM_TTL_MS  how long a finished game stays in memory, default 600000
 *   DEV_MODERATORS        comma-separated dev nicknames treated as moderators (dev sign-in only)
 *   DATABASE_URL          Postgres for moderation state (run db/migrations/200_moderation.sql first). Without it, state is in memory only
 *   ANTHROPIC_API_KEY     turns on Claude review of held messages and reports
 *   REVIEW_MODEL          model id for the reviewer (required with the key)
 * Sign-in: set SUPABASE_URL (and SUPABASE_JWT_SECRET only for a legacy project) to verify real Supabase logins.
 *   SUPABASE_URL, SUPABASE_JWKS_URL (optional), SUPABASE_JWT_SECRET (legacy), SUPABASE_SERVICE_ROLE_KEY (account deletion)
 *   TURNSTILE_SECRET      CAPTCHA for our own sign-up endpoint. APP_URL: the site address used in emails
 *   AGE_OF_CONSENT_BY_COUNTRY (JSON, from your lawyer), ALLOWED_COUNTRIES, BLOCKED_COUNTRIES (comma-separated ISO codes)
 * With NODE_ENV=production the server refuses to start unless real sign-in, DATABASE_URL, CAPTCHA and ALLOWED_ORIGINS are set.
 * Without SUPABASE_URL it needs ALLOW_DEV_AUTH=1 (local development only).
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.error('ALLOWED_ORIGINS must list the site origin(s) in production, for example https://kaichuang581.github.io');
  process.exit(1);
}
if (allowedOrigins.length === 0) console.warn('No ALLOWED_ORIGINS: any website can open a game socket and call the API. Fine for local development only.');
const envNumber = (name: string): number | undefined => {
  const n = Number(process.env[name]);
  return process.env[name] && Number.isFinite(n) && n > 0 ? n : undefined;
};

const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
const filter = new ChatFilter({
  blocklist: readFileSync('server/data/blocklist-en.txt', 'utf8').split('\n'),
  isWord: (w) => dict.has(w),
});

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.REVIEW_MODEL;
const reviewer = apiKey && model ? new ClaudeReviewer({ apiKey, model, log: console.log }) : undefined;
if (apiKey && !model) console.warn('ANTHROPIC_API_KEY is set but REVIEW_MODEL is not: reviews will wait for a person.');


const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 5 }) : null;
if (!pool) console.warn('No DATABASE_URL: suspensions, bans and the review queue are lost on restart.');
// Child-safety reports are kept but go nowhere yet (dry run): no reporter is registered. See docs/lanes/trust.md.
const audit = pool ? new PostgresAudit(pool) : new MemoryAudit();
const reporting = new ChildSafetyService({
  audit,
  store: pool ? new PostgresReportStore(pool) : new MemoryReportStore(),
  now: Date.now,
  onError: () => console.error('child-safety report write failed'),
});
await reporting.load();
const chat = new ChatService({
  now: Date.now,
  filter,
  reviewer,
  sink: reporting,
  audit,
  store: pool ? new PostgresStore(pool) : undefined,
  // Deliberately generic: the error text could contain a message under review.
  onPersistError: () => console.error('moderation store write failed'),
});
await chat.load();

const blocks = new BlockList(pool ? new PostgresBlockStore(pool) : undefined, Date.now, () => console.error('block list write failed'));
await blocks.load();

// ---- sign-in -------------------------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const accountStore = pool ? new PostgresAccountStore(pool) : new MemoryAccountStore();
const bus = new RevocationBus();
const csv = (name: string) => (process.env[name] ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
const ageByCountry = (() => {
  try {
    return JSON.parse(process.env.AGE_OF_CONSENT_BY_COUNTRY ?? '{}') as Record<string, number>;
  } catch {
    console.error('AGE_OF_CONSENT_BY_COUNTRY is not valid JSON');
    process.exit(1);
  }
})();
const agePolicy = {
  ...DEFAULT_AGE_POLICY,
  byCountry: ageByCountry,
  allowedCountries: csv('ALLOWED_COUNTRIES').length ? csv('ALLOWED_COUNTRIES') : undefined,
  blockedCountries: csv('BLOCKED_COUNTRIES'),
};

let verifyToken: VerifyToken;
let verifySession: (token: string) => Promise<SessionClaims | null>;
if (supabaseUrl) {
  const verifier = new TokenVerifier(
    {
      issuer: `${supabaseUrl}/auth/v1`,
      jwksUrl: process.env.SUPABASE_JWT_SECRET ? undefined : (process.env.SUPABASE_JWKS_URL ?? `${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      jwtSecret: process.env.SUPABASE_JWT_SECRET,
    },
    accountStore,
  );
  verifyToken = (t) => verifier.authenticate(t);
  verifySession = (t) => verifier.claims(t);
} else {
  if (isProduction || process.env.ALLOW_DEV_AUTH !== '1') {
    console.error('No sign-in is configured. Set SUPABASE_URL, or ALLOW_DEV_AUTH=1 for local development (never in production).');
    process.exit(1);
  }
  const devModerators = new Set((process.env.DEV_MODERATORS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  verifyToken = async (token) =>
    token.startsWith('dev:') && token.length > 4
      ? { userId: token, name: token.slice(4, 16), chatAllowed: true, isModerator: devModerators.has(token.slice(4)) }
      : null;
  verifySession = async () => null; // the account endpoints need a real login
}

const turnstileSecret = process.env.TURNSTILE_SECRET;
if (isProduction) {
  const missing = [
    !supabaseUrl && 'SUPABASE_URL', !pool && 'DATABASE_URL', !turnstileSecret && 'TURNSTILE_SECRET', !process.env.APP_URL && 'APP_URL',
    !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Production needs: ${missing.join(', ')}`);
    process.exit(1);
  }
}
// No real mail sender exists yet. Without one, a child who needs a parent's consent cannot sign up (the request fails, it is never left stuck).
const mailer: Mailer | null = isProduction ? null : new ConsoleMailer();
if (!mailer) console.warn('No mail sender is configured: sign-ups that need a parent\'s consent will be refused.');

const accounts = new AccountService({
  store: accountStore,
  now: Date.now,
  mailer,
  agePolicy,
  nicknameAllowed: (n) => !filter.check(n),
  blocks,
  bus,
  authAdmin: supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseAuthAdmin({ url: supabaseUrl, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }) : undefined,
  appUrl: process.env.APP_URL ?? 'http://localhost:5173/',
  log: console.log,
});
// A ban also bans the email, so the same person cannot simply sign up again.
chat.onChange((userId) => {
  if (chat.state(userId).banned) void accounts.recordBan(userId, 'banned by moderation').catch(() => console.error('could not record banned identity'));
});
setInterval(() => void accounts.purge().catch(() => undefined), 3_600_000).unref();

// One port serves the HTTP API and the WebSocket game connection.
const httpServer = createHttpServer({
  routes: [
    ...allRoutes,
    ...createModerationRoutes({ chat, reporting, log: console.log }),
    ...createAccountRoutes({ service: accounts, captcha: turnstileSecret ? new TurnstileVerifier({ secret: turnstileSecret }) : new DevCaptcha() }),
  ],
  verifyToken,
  verifySession,
  trustProxy: process.env.TRUST_PROXY === '1',
  allowedOrigins,
});
const port = Number(process.env.PORT ?? 8787);
await new Promise<void>((resolve) => httpServer.listen(port, resolve));

const server = await startServer({
  blocks,
  revocations: bus,
  audit,
  port,
  httpServer,
  ctx: { dict },
  chat,
  verifyToken,
  randomInt: (n) => randomInt(n),
  steals: {
    ordering: process.env.STEAL_ORDERING === 'compensated' ? 'compensated' : 'arrival',
    bufferMs: envNumber('STEAL_BUFFER_MS'),
  },
  limits: {
    allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined,
    maxPerIp: envNumber('MAX_CONNECTIONS_PER_IP'),
    maxTotal: envNumber('MAX_CONNECTIONS'),
    heartbeatMs: envNumber('HEARTBEAT_MS'),
    finishedRoomTtlMs: envNumber('FINISHED_ROOM_TTL_MS'),
    trustProxy: process.env.TRUST_PROXY === '1',
  },
});
console.log(`game server on ws://localhost:${server.port} and http://localhost:${server.port} (dev sign-in, reviewer ${reviewer ? 'on' : 'off'})`);

// Finish pending moderation writes before the process exits.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void (async () => {
      await server.close();
      await reporting.flush();
      await blocks.flush();
      await pool?.end();
      process.exit(0);
    })();
  });
}
