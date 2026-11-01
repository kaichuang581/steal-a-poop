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
import type { VerifyToken } from './contracts';
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
 * Real sign-in (Supabase) is not wired yet: without ALLOW_DEV_AUTH the server refuses to start.
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


if (process.env.ALLOW_DEV_AUTH !== '1') {
  console.error('No sign-in is configured. Set ALLOW_DEV_AUTH=1 for local development only.');
  process.exit(1);
}
const devModerators = new Set((process.env.DEV_MODERATORS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const verifyToken: VerifyToken = async (token) =>
  token.startsWith('dev:') && token.length > 4
    ? { userId: token, name: token.slice(4, 16), chatAllowed: true, isModerator: devModerators.has(token.slice(4)) }
    : null;

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

// One port serves the HTTP API and the WebSocket game connection.
const httpServer = createHttpServer({
  routes: [...allRoutes, ...createModerationRoutes({ chat, reporting, log: console.log })],
  verifyToken,
  allowedOrigins,
});
const port = Number(process.env.PORT ?? 8787);
await new Promise<void>((resolve) => httpServer.listen(port, resolve));

const blocks = new BlockList(pool ? new PostgresBlockStore(pool) : undefined, Date.now, () => console.error('block list write failed'));
await blocks.load();

const server = await startServer({
  blocks,
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
