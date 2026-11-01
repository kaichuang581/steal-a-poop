import { randomInt } from 'node:crypto';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { createDictionary } from '../src/engine';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { createModerationRoutes } from './routes/moderation';
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
 *   ALLOWED_ORIGINS       comma-separated site origins allowed to call the HTTP API
 *   DEV_MODERATORS        comma-separated dev nicknames treated as moderators (dev sign-in only)
 *   DATABASE_URL          Postgres for moderation state (run db/migrations/200_moderation.sql first). Without it, state is in memory only
 *   ANTHROPIC_API_KEY     turns on Claude review of held messages and reports
 *   REVIEW_MODEL          model id for the reviewer (required with the key)
 * Real sign-in (Supabase) is not wired yet: without ALLOW_DEV_AUTH the server refuses to start.
 */
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
const reporting = new ChildSafetyService({
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
  store: pool ? new PostgresStore(pool) : undefined,
  // Deliberately generic: the error text could contain a message under review.
  onPersistError: () => console.error('moderation store write failed'),
});
await chat.load();

// One port serves the HTTP API and the WebSocket game connection.
const httpServer = createHttpServer({
  routes: [...allRoutes, ...createModerationRoutes({ chat, reporting, log: console.log })],
  verifyToken,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
});
const port = Number(process.env.PORT ?? 8787);
await new Promise<void>((resolve) => httpServer.listen(port, resolve));

const server = await startServer({
  port,
  httpServer,
  ctx: { dict },
  chat,
  verifyToken,
  randomInt: (n) => randomInt(n),
});
console.log(`game server on ws://localhost:${server.port} and http://localhost:${server.port} (dev sign-in, reviewer ${reviewer ? 'on' : 'off'})`);

// Finish pending moderation writes before the process exits.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void (async () => {
      await server.close();
      await reporting.flush();
      await pool?.end();
      process.exit(0);
    })();
  });
}
