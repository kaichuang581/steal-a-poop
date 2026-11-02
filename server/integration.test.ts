import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createDictionary } from '../src/engine';
import { BlockList } from './blocks';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { startServer } from './index';
import { MemoryAccountStore } from './auth/store';
import { EconomyService } from './economy/service';
import { MemoryEconomyStore } from './economy/store';
import { MemoryResultsStore } from './game/results';
import { GameDataService } from './game/service';
import { FriendsService, MemoryFriendStore } from './social/friends';

// The real server with the real game-data services (in-memory stores), the way main.ts wires them. Time is ours to move,
// so a whole Daily Table can be played in a moment.

const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
let seed = 7;
const randomInt = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
const open: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const s of open.splice(0)) await s.close();
});

async function boot() {
  let clock = Date.UTC(2026, 10, 4, 12, 0, 0);
  const accounts = new MemoryAccountStore();
  const economyStore = new MemoryEconomyStore();
  const economy = new EconomyService(economyStore, () => clock);
  const results = new MemoryResultsStore();
  const blocks = new BlockList();
  const chat = new ChatService({ now: () => clock, filter: new ChatFilter({ blocklist: ['blorf'], isWord: () => false }) });
  let notify: (id: string, m: object) => void = () => undefined;
  const data = new GameDataService({
    results, accounts, economy, isBanned: (id) => chat.state(id).banned, now: () => clock,
    onAward: (id, r) => notify(id, { t: 'reward', coins: r.coins, parts: r.parts, balance: r.balance }),
  });
  const friends = new FriendsService({ store: new MemoryFriendStore(), accounts, blocks, now: () => clock, online: () => true });
  const server = await startServer({
    port: 0, ctx: { dict }, chat, randomInt, tickMs: 20, reviewEveryMs: 60_000, now: () => clock,
    limits: { shutdownGraceMs: 0 }, blocks, friends, cosmetics: economy,
    onGameFinished: (r) => data.record(r),
    dailyGate: { reserve: (u, d) => data.claimDaily(u, d) },
    verifyToken: async (t) => {
      if (!t.startsWith('u:')) return null;
      const id = t.slice(2);
      const p = await accounts.getProfile(id);
      return p ? { userId: id, name: p.nickname, chatAllowed: true, resultsAllowed: true, isModerator: false } : null;
    },
  });
  notify = server.notify;
  open.push(server);
  const addPlayer = (id: string, over: Partial<Parameters<MemoryAccountStore['createProfile']>[0]> = {}) =>
    accounts.createProfile({
      userId: id, nickname: id.toUpperCase(), emailHash: '', dateOfBirth: '1990-01-01', country: 'CA', consentStatus: 'not_required', leaderboardVisible: true,
      isModerator: false, sessionsValidAfter: 0, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
    });
  return { server, data, economyStore, results, addPlayer, advance: (ms: number) => (clock += ms), accounts };
}

async function connect(port: number, id: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const msgs: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'hello', token: `u:${id}` }));
  const waitFor = async (pred: (m: Record<string, any>) => boolean, ms = 4000) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const end = Date.now() + ms;
    for (;;) {
      const hit = msgs.find(pred);
      if (hit) return hit;
      if (Date.now() > end) throw new Error(`timed out; got ${msgs.map((m) => m.t).join(',')}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  await waitFor((m) => m.t === 'welcome');
  return { ws, msgs, waitFor, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe('a Daily Table played through the real server', () => {
  it('is gated to one try a day, then stored, paid, announced, and shown on the boards', async () => {
    const t = await boot();
    await t.addPlayer('ana');
    const ana = await connect(t.server.port, 'ana');

    ana.send({ t: 'daily' });
    await ana.waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    t.advance(60 * 60 * 1000); // an hour passes: every turn times out and the game plays itself out
    const reward = await ana.waitFor((m) => m.t === 'reward', 8000);
    expect(reward.coins).toBeGreaterThanOrEqual(15); // at least the daily finish pay
    expect(reward.balance).toBe(reward.coins);
    expect(reward.parts[0].label).toBe('Finished the Daily Table');

    expect(t.results.games.size).toBe(1);
    const stored = [...t.results.games.values()][0];
    expect(stored).toMatchObject({ mode: 'daily', dailyDate: '2026-11-04' });
    expect(stored.players.filter((p) => p.userId === 'ana')).toHaveLength(1);
    expect(stored.players.filter((p) => p.userId === null).length).toBeGreaterThan(0); // bots are in the game but not on the boards
    expect(await t.economyStore.balance('ana')).toBe(reward.balance);
    expect((await t.data.myStats('ana')).gamesPlayed).toBe(1);

    const board = await t.data.dailyBoard('2026-11-04');
    expect(board.rows.map((r) => r.name)).toEqual(['ANA']);

    // The second try the same day is refused; the next day is allowed.
    ana.send({ t: 'leave' });
    await ana.waitFor((m) => m.t === 'left');
    ana.send({ t: 'daily' });
    expect(await ana.waitFor((m) => m.t === 'error' && m.error === 'daily_used')).toBeTruthy();
    t.advance(24 * 3600 * 1000);
    const roomsBefore = ana.msgs.filter((m) => m.t === 'room').length;
    ana.send({ t: 'daily' });
    await expect.poll(() => ana.msgs.filter((m) => m.t === 'room').length, { timeout: 4000 }).toBeGreaterThan(roomsBefore); // a new table opened
  });

  it('a child without a parent\'s consent plays the Daily Table but is not stored, paid, or ranked', async () => {
    const t = await boot();
    await t.addPlayer('kid', { consentStatus: 'pending', leaderboardVisible: false });
    // The sign-in check gives a waiting child resultsAllowed: false; the game data service double-checks against the profile.
    const kid = await connect(t.server.port, 'kid');
    kid.send({ t: 'daily' });
    await kid.waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    t.advance(60 * 60 * 1000);
    await new Promise((r) => setTimeout(r, 400));
    await expect.poll(() => t.results.games.size, { timeout: 8000 }).toBe(1);
    expect([...t.results.games.values()][0].players.every((p) => p.userId === null)).toBe(true);
    expect(await t.economyStore.balance('kid')).toBe(0);
    expect(kid.msgs.some((m) => m.t === 'reward')).toBe(false);
    expect((await t.data.dailyBoard('2026-11-04')).rows).toEqual([]);
  });
});
