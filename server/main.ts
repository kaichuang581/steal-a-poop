import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDictionary } from '../src/engine';
import { ChatService } from './chat';
import type { ChildSafetySink } from './chat';
import { ChatFilter } from './filter';
import { startServer } from './index';
import type { VerifyToken } from './index';
import { ClaudeReviewer } from './review';

/**
 * Starts the game server.
 *   PORT                  default 8787
 *   ALLOW_DEV_AUTH=1      accept "dev:<name>" tokens. Local development only.
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
const reviewer = apiKey && model ? new ClaudeReviewer({ apiKey, model }) : undefined;
if (apiKey && !model) console.warn('ANTHROPIC_API_KEY is set but REVIEW_MODEL is not: reviews will wait for a person.');

// Placeholder for the NCMEC reporting process: it only logs. See docs/MODERATION.md.
const sink: ChildSafetySink = { record: (item) => console.error('[child-safety item recorded, NOT reported]', item.id, item.userId) };

if (process.env.ALLOW_DEV_AUTH !== '1') {
  console.error('No sign-in is configured. Set ALLOW_DEV_AUTH=1 for local development only.');
  process.exit(1);
}
const verifyToken: VerifyToken = async (token) =>
  token.startsWith('dev:') && token.length > 4 ? { userId: token, name: token.slice(4, 16) } : null;

const server = await startServer({
  port: Number(process.env.PORT ?? 8787),
  ctx: { dict },
  chat: new ChatService({ now: Date.now, filter, reviewer, sink }),
  verifyToken,
  randomInt: (n) => randomInt(n),
});
console.log(`game server on ws://localhost:${server.port} (dev sign-in, reviewer ${reviewer ? 'on' : 'off'})`);
