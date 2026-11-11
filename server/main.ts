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
import { ConsoleMailer, SmtpMailer } from './auth/mailer';
import type { Mailer } from './auth/mailer';
import { DEFAULT_AGE_POLICY } from './auth/policy';
import { RevocationBus } from './auth/revocations';
import { AccountService, SupabaseAuthAdmin } from './auth/service';
import { MemoryAccountStore, PostgresAccountStore } from './auth/store';
import { TokenVerifier } from './auth/tokens';
import { createAccountRoutes } from './routes/accounts';
import { createFriendRoutes } from './routes/friends';
import { createLeaderboardRoutes } from './routes/leaderboard';
import { createShopRoutes } from './routes/shop';
import { createOpsRoutes } from './routes/ops';
import { isInappropriateName } from '../src/lib/nickname';
import { createFeedbackRoutes } from './routes/feedback';
import { AlertMonitor, WebhookSender } from './ops/alerts';
import type { Snapshot } from './ops/alerts';
import { EconomyService } from './economy/service';
import { MemoryEconomyStore, PostgresEconomyStore } from './economy/store';
import { BarnService } from './barn/service';
import { MemoryBarnStore, PostgresBarnStore } from './barn/store';
import { createBarnRoutes } from './routes/barn';
import { MemoryResultsStore, PostgresResultsStore } from './game/results';
import { GameDataService } from './game/service';
import { FriendsService } from './social/friends';
import { MemoryFriendStore, PostgresFriendStore } from './social/friends';
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
 *   FINISHED_ROOM_TTL_MS  how long a finished game stays in memory, default 600000
 *   DEV_MODERATORS        comma-separated dev nicknames treated as moderators (dev sign-in only)
 *   DATABASE_URL          Postgres for moderation state (run db/migrations/200_moderation.sql first). Without it, state is in memory only
 *   ANTHROPIC_API_KEY     turns on Claude review of held messages and reports
 *   REVIEW_MODEL          model id for the reviewer (required with the key)
 * Sign-in: set SUPABASE_URL (and SUPABASE_JWT_SECRET only for a legacy project) to verify real Supabase logins.
 *   SUPABASE_URL, SUPABASE_JWKS_URL (optional), SUPABASE_JWT_SECRET (legacy), SUPABASE_SERVICE_ROLE_KEY (account deletion)
 *   GITHUB_FEEDBACK_TOKEN Optional. A fine-grained GitHub token with Issues: read and write on the feedback repo; with it the in-game form creates issues. GITHUB_FEEDBACK_REPO overrides owner/name
 *   ALERT_WEBHOOK_URL     Slack or Discord webhook for alerts (stuck moderation queue, database down, reviewer limit). ALERT_QUEUE_MINUTES, ALERT_CHILD_SAFETY_MINUTES, ALERT_MEMORY_MB tune it
 *   SMTP_URL, MAIL_FROM   sends the parent's consent email (any SMTP service). Without them, children who need a parent's consent cannot sign up
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
  verifyToken = async (token) => {
    if (!(token.startsWith('dev:') && token.length > 4)) return null;
    const name = token.slice(4, 16);
    // Development players get a profile at once so friends, leaderboards and coins can be tried locally.
    const now = Date.now();
    await accountStore.createProfile({
      userId: token, nickname: name, emailHash: '', dateOfBirth: '1990-01-01', country: 'CA', consentStatus: 'not_required', leaderboardVisible: true,
      isModerator: false, sessionsValidAfter: 0, createdAt: now, updatedAt: now, deletedAt: null,
    }).catch(() => false);
    return { userId: token, name, chatAllowed: true, resultsAllowed: true, isModerator: devModerators.has(token.slice(4)) };
  };
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
const mailer: Mailer | null =
  process.env.SMTP_URL && process.env.MAIL_FROM ? new SmtpMailer({ url: process.env.SMTP_URL, from: process.env.MAIL_FROM }) : isProduction ? null : new ConsoleMailer();
if (!mailer) console.warn('No mail sender is configured (SMTP_URL and MAIL_FROM): sign-ups that need a parent\'s consent will be refused.');

// ---- game data: results, coins, friends ---------------------------------------------------------------
const economyStore = pool ? new PostgresEconomyStore(pool) : new MemoryEconomyStore();
const economy = new EconomyService(economyStore);
const barn = new BarnService(pool ? new PostgresBarnStore(pool) : new MemoryBarnStore());
const presence = { online: (_id: string) => false };
let notify: (userId: string, msg: object) => void = () => undefined;
const friends = new FriendsService({
  store: pool ? new PostgresFriendStore(pool) : new MemoryFriendStore(),
  accounts: accountStore,
  blocks,
  now: Date.now,
  online: (id) => presence.online(id),
  cosmetics: (id) => economy.cachedCosmetics(id),
});
const gameData = new GameDataService({
  results: pool ? new PostgresResultsStore(pool) : new MemoryResultsStore(),
  accounts: accountStore,
  economy,
  isBanned: (id) => chat.state(id).banned,
  now: Date.now,
  onAward: (userId, reward) => notify(userId, { t: 'reward', coins: reward.coins, parts: reward.parts, balance: reward.balance }),
  log: console.log,
});

const accounts = new AccountService({
  standing: (id) => ({ suspendedUntil: chat.state(id).suspendedUntil, openItems: chat.status(id).openItems }),
  erasers: [(id) => gameData.erase(id), (id) => friends.erase(id), (id) => barn.erase(id)],
  store: accountStore,
  now: Date.now,
  mailer,
  agePolicy,
  nicknameAllowed: (n) => !filter.check(n) && !isInappropriateName(n),
  blocks,
  bus,
  authAdmin: supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseAuthAdmin({ url: supabaseUrl, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }) : undefined,
  appUrl: process.env.APP_URL ?? 'http://localhost:5173/',
  log: console.log,
});
// A ban also bans the email, so the same person cannot simply sign up again.
chat.onChange((userId) => {
  if (chat.state(userId).banned) void accounts.recordBan(userId, 'banned by moderation').catch(() => console.error('could not record banned identity'));
  // If a person clears a deleted account's case, the hold on its email ends at once.
  void accounts.refreshRestriction(userId).catch(() => console.error('could not refresh email hold'));
});
setInterval(() => void accounts.purge().catch(() => undefined), 3_600_000).unref();

// ---- watching the server -------------------------------------------------------------------------------
let serverRef: Awaited<ReturnType<typeof startServer>> | null = null;
const maxConnections = envNumber('MAX_CONNECTIONS') ?? 2000;
const takeSnapshot = async (): Promise<Snapshot> => {
  let databaseOk: boolean | null = null;
  if (pool) databaseOk = await pool.query('select 1').then(() => true, () => false);
  const stats = serverRef?.rooms.stats() ?? { rooms: 0, players: 0 };
  const rc = reviewer?.counters;
  return {
    at: Date.now(),
    connections: serverRef?.connections() ?? 0,
    maxConnections,
    rooms: stats.rooms,
    players: stats.players,
    memoryMb: process.memoryUsage().rss / 1048576,
    databaseOk,
    oldestModerationItemMs: chat.oldestUnreviewed()?.ageMs ?? null,
    oldestChildSafetyItemMs: chat.oldestChildSafetyOpen()?.ageMs ?? null,
    moderationWriteFailures: chat.persistFailures,
    reviewer: rc ? { calls: rc.calls, escalated: rc.escalated, capped: rc.failures.capped, failures: rc.failures.timeout + rc.failures.network + rc.failures.http + rc.failures.unreadable, tokensIn: rc.tokensIn, tokensOut: rc.tokensOut, estimatedCostUsd: rc.estimatedCostUsd } : null,
  };
};

// One port serves the HTTP API and the WebSocket game connection.
const httpServer = createHttpServer({
  routes: [
    ...allRoutes,
    ...createModerationRoutes({ chat, reporting, economy: economyStore, audit, log: console.log }),
    ...createFriendRoutes({ friends }),
    ...createLeaderboardRoutes({ data: gameData, accounts }),
    ...createShopRoutes({ economy, store: economyStore }),
    ...createBarnRoutes({ barn }),
    ...createOpsRoutes({ snapshot: takeSnapshot }),
    ...createFeedbackRoutes({ token: process.env.GITHUB_FEEDBACK_TOKEN, repo: process.env.GITHUB_FEEDBACK_REPO || 'kaichuang581/steal-a-poop' }),
    ...createAccountRoutes({ service: accounts, captcha: turnstileSecret ? new TurnstileVerifier({ secret: turnstileSecret }) : new DevCaptcha() }),
  ],
  verifyToken,
  verifySession,
  trustProxy: process.env.TRUST_PROXY === '1',
  allowedOrigins,
});
const port = Number(process.env.PORT ?? 8787);
await new Promise<void>((resolve) => httpServer.listen(port, resolve));

// A last line of defence. Every room and game lives in this one process, so a stray rejected promise must not end it:
// log it and carry on. (Node 22's default for an unhandled rejection is to exit.) A synchronous uncaught exception is
// still fatal, as it should be: the state may be half-changed, and Fly restarts the machine.
process.on('unhandledRejection', (reason) => {
  console.error('unhandled rejection (kept running):', reason instanceof Error ? reason.stack ?? reason.message : String(reason));
});

const server = await startServer({
  onGameFinished: (result) => gameData.record(result),
  dailyGate: { reserve: (userId, date) => gameData.claimDaily(userId, date) },
  friends,
  cosmetics: economy,
  blocks,
  revocations: bus,
  audit,
  port,
  httpServer,
  ctx: { dict },
  chat,
  verifyToken,
  randomInt: (n) => randomInt(n),
  nameAllowed: (n) => !filter.check(n) && !isInappropriateName(n),
  adminUserIds: (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  limits: {
    allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined,
    maxPerIp: envNumber('MAX_CONNECTIONS_PER_IP'),
    maxTotal: envNumber('MAX_CONNECTIONS'),
    heartbeatMs: envNumber('HEARTBEAT_MS'),
    finishedRoomTtlMs: envNumber('FINISHED_ROOM_TTL_MS'),
    trustProxy: process.env.TRUST_PROXY === '1',
  },
});
serverRef = server;
presence.online = server.isOnline;
notify = server.notify;
const alertUrl = process.env.ALERT_WEBHOOK_URL;
const stopAlerts = alertUrl
  ? new AlertMonitor({
      snapshot: takeSnapshot,
      sender: new WebhookSender({ url: alertUrl }),
      cfg: { queueMs: (envNumber('ALERT_QUEUE_MINUTES') ?? 120) * 60_000, childSafetyMs: (envNumber('ALERT_CHILD_SAFETY_MINUTES') ?? 30) * 60_000, connectionsFraction: 0.8, memoryMb: envNumber('ALERT_MEMORY_MB') ?? 420 },
      log: console.error,
    }).start()
  : null;
if (!alertUrl) console.warn('No ALERT_WEBHOOK_URL: nobody will be told if the moderation queue or the database has a problem.');
console.log(`game server on ws://localhost:${server.port} and http://localhost:${server.port} (${supabaseUrl ? 'real sign-in' : 'DEV sign-in'}, reviewer ${reviewer ? 'on' : 'off'})`);

// Finish pending moderation writes before the process exits.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void (async () => {
      stopAlerts?.();
      await server.close();
      await reporting.flush();
      await blocks.flush();
      await pool?.end();
      process.exit(0);
    })();
  });
}
