import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createDictionary, suggestWords } from '../src/engine';
import type { GameState } from '../src/engine';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { MemoryAudit } from './moderation/audit';
import type { DailyGate, GameResultSink } from './contracts';
import { startServer } from './index';
import type { ConnectionLimits, ServerOptions } from './index';
import { BlockList } from './blocks';
import type { AuthUser } from './contracts';
import { RevocationBus } from './auth/revocations';

const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
const filter = new ChatFilter({ blocklist: ['blorf'], isWord: (w) => dict.has(w) });

let seed = 99;
const randomInt = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);

type Msg = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

class Client {
  msgs: Msg[] = [];
  private waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];
  constructor(public ws: WebSocket, public name: string) {
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as Msg;
      this.msgs.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  static async connect(port: number, name: string, token = `dev:${name}`) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const c = new Client(ws, name);
    c.send({ t: 'hello', token });
    return c;
  }
  send(m: object) { this.ws.send(JSON.stringify(m)); }
  waitFor(pred: (m: Msg) => boolean, ms = 2500): Promise<Msg> {
    const seen = this.msgs.find(pred);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out; got ${this.msgs.map((m) => m.t).join(',')}`)), ms);
      this.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }
  /** The next message of this type that arrives after now. */
  next(t: string, ms = 2500) {
    const from = this.msgs.length;
    return new Promise<Msg>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no "${t}" after ${from} msgs`)), ms);
      this.waiters.push({ pred: (m) => m.t === t && this.msgs.indexOf(m) >= from, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }
  lastRoom(): Msg | undefined { return [...this.msgs].reverse().find((m) => m.t === 'room'); }
  close() { this.ws.close(); }
}

const open: { close: () => Promise<void> }[] = [];
const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  for (const s of open.splice(0)) await s.close();
});

async function boot(extra: { friends?: { areFriends(a: string, b: string): Promise<boolean> }; cosmetics?: ServerOptions['cosmetics']; blocks?: BlockList; verifyToken?: (t: string) => Promise<AuthUser | null>; revocations?: RevocationBus; now?: () => number; limits?: ConnectionLimits; reconnectGraceMs?: number; dailyGate?: DailyGate; onGameFinished?: GameResultSink; audit?: MemoryAudit } = {}) {
  const chat = new ChatService({ now: Date.now, filter });
  const server = await startServer({
    port: 0, ctx: { dict }, chat, randomInt, tickMs: 50, reviewEveryMs: 60_000, reconnectGraceMs: extra.reconnectGraceMs,
    dailyGate: extra.dailyGate, onGameFinished: extra.onGameFinished, audit: extra.audit,
    limits: { shutdownGraceMs: 0, ...extra.limits }, now: extra.now,
    revocations: extra.revocations, friends: extra.friends, cosmetics: extra.cosmetics, blocks: extra.blocks,
    verifyToken: extra.verifyToken ?? (async (token) => (token.startsWith('dev:') ? { userId: token, name: token.slice(4), chatAllowed: !token.startsWith('dev:Mute'), isModerator: false } : null)),
  });
  open.push(server);
  return server;
}
async function join4(server: Awaited<ReturnType<typeof boot>>, visibility: 'public' | 'private' = 'public') {
  const names = ['Ana', 'Ben', 'Cy', 'Di'];
  const cs = await Promise.all(names.map((n) => Client.connect(server.port, n)));
  clients.push(...cs);
  await Promise.all(cs.map((c) => c.waitFor((m) => m.t === 'welcome')));
  cs[0].send({ t: 'create', visibility });
  const created = await cs[0].waitFor((m) => m.t === 'room');
  const code = created.view.code as string;
  for (const c of cs.slice(1)) {
    c.send({ t: 'join', code });
    await c.waitFor((m) => m.t === 'room');
  }
  await cs[0].waitFor((m) => m.t === 'room' && m.view.members.length === 4);
  return { cs, code };
}

describe('connecting', () => {
  it('closes a connection that signs in with a bad token', async () => {
    const server = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ t: 'hello', token: 'nope' }));
    const code = await new Promise<number>((r) => ws.once('close', (c) => r(c)));
    expect(code).toBe(4001);
  });
  it('refuses to do anything before signing in, and survives garbage', async () => {
    const server = await boot();
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise((r) => ws.once('open', r));
    const got: Msg[] = [];
    ws.on('message', (d) => got.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ t: 'create', visibility: 'public' }));
    ws.send('{not json');
    ws.send(JSON.stringify({ nope: 1 }));
    await new Promise((r) => setTimeout(r, 150));
    expect(got.map((m) => m.error)).toEqual(['not_signed_in', 'bad_message', 'bad_message']);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });
});

describe('rooms over the wire', () => {
  it('lists public rooms, hides private ones, and joins by code', async () => {
    const server = await boot();
    const [a, b, c] = await Promise.all(['Ana', 'Ben', 'Cy'].map((n) => Client.connect(server.port, n)));
    clients.push(a, b, c);
    await Promise.all([a, b, c].map((x) => x.waitFor((m) => m.t === 'welcome')));
    a.send({ t: 'create', visibility: 'public', roomName: 'Open table' });
    b.send({ t: 'create', visibility: 'private' });
    const pub = (await a.waitFor((m) => m.t === 'room')).view.code;
    await b.waitFor((m) => m.t === 'room');
    c.send({ t: 'rooms' });
    const list = await c.waitFor((m) => m.t === 'rooms');
    expect(list.list).toHaveLength(1);
    expect(list.list[0]).toMatchObject({ code: pub, name: 'Open table', hostName: 'Ana', players: 1, max: 10, min: 4 });
    c.send({ t: 'join', code: pub.toLowerCase() });
    const joined = await c.waitFor((m) => m.t === 'room');
    expect(joined.view.members.map((m: Msg) => m.name)).toEqual(['Ana', 'Cy']);
  });
  it('only the host can start, needs four players, and starts only on the host\'s say-so', async () => {
    const server = await boot();
    const { cs, code } = await join4(server);
    cs[1].send({ t: 'start' });
    expect((await cs[1].waitFor((m) => m.t === 'error')).error).toBe('not_host');
    await new Promise((r) => setTimeout(r, 200));
    expect(cs[0].lastRoom()!.view.phase).toBe('lobby'); // four players is not enough on its own
    cs[0].send({ t: 'start' });
    const started = await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    expect(started.view.code).toBe(code);
    expect(started.view.game.players).toHaveLength(4);
    expect(started.you).toEqual({ userId: 'dev:Ana', seat: 0 });
    expect(Math.abs(started.serverNow - Date.now())).toBeLessThan(5000); // clients use this to correct their clock
    const late = await Client.connect(server.port, 'Late');
    clients.push(late);
    await late.waitFor((m) => m.t === 'welcome');
    late.send({ t: 'join', code });
    expect((await late.waitFor((m) => m.t === 'error')).error).toBe('room_started');
  });
});

describe('playing', () => {
  it('relays a real move to everyone and enforces whose turn it is', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[0].send({ t: 'start' });
    await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    // wait out the round intro, then it is seat 0's turn
    await cs[0].waitFor((m) => m.t === 'room' && m.view.game?.phase === 'playing' && m.view.game.turn?.seat === 0, 6000);
    const game = cs[0].lastRoom()!.view.game as GameState;
    const word = suggestWords({ dict, chainLetter: game.chainLetter, used: game.used, modifier: game.modifier, count: 1, random: Math.random })[0];

    cs[1].send({ t: 'act', action: { type: 'play', word } });
    expect((await cs[1].waitFor((m) => m.t === 'result')).reason).toBe('not_your_turn');

    cs[0].send({ t: 'act', action: { type: 'play', word } });
    const result = await cs[0].waitFor((m) => m.t === 'result' && m.accepted);
    expect(result.accepted).toBe(true);
    const after = await cs[3].waitFor((m) => m.t === 'room' && m.view.game?.players[0].lastWord === word);
    expect(after.view.game.turn.seat).toBe(1);
  });
  it('rejects malformed moves', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[0].send({ t: 'act', action: { type: 'dance' } });
    expect((await cs[0].waitFor((m) => m.t === 'error')).error).toBe('bad_message');
  });
  it('returns a typo suggestion to the sender only', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[0].send({ t: 'start' });
    await cs[0].waitFor((m) => m.t === 'room' && m.view.game?.turn?.seat === 0, 6000);
    const game = cs[0].lastRoom()!.view.game as GameState;
    const words = suggestWords({ dict, chainLetter: game.chainLetter, used: game.used, modifier: game.modifier, count: 6, random: Math.random });
    let suggestion: string | null = null;
    for (const w of words) {
      for (const filler of ['q', 'j', 'z', 'x']) {
        cs[0].send({ t: 'act', action: { type: 'play', word: w + filler } });
        const r = await cs[0].next('result');
        if (r.suggestion) { suggestion = r.suggestion; break; }
      }
      if (suggestion) break;
    }
    expect(suggestion).not.toBeNull();
    expect(cs[0].lastRoom()!.view.game.players[0].banked).toBe(0);
  });
});

describe('chat over the wire', () => {
  it('delivers clean messages to the whole room', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[2].send({ t: 'chat', text: 'good luck all' });
    for (const c of cs) {
      const m = await c.waitFor((x) => x.t === 'chat');
      expect(m.message).toMatchObject({ text: 'good luck all', name: 'Cy' });
    }
  });
  it('holds a bad message: nobody receives it, and the sender is told and suspended', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[1].send({ t: 'chat', text: 'you blorf' });
    const blocked = await cs[1].waitFor((m) => m.t === 'chatBlocked');
    expect(blocked.reason).toBe('blocked');
    expect(blocked.until).toBeGreaterThan(Date.now());
    await new Promise((r) => setTimeout(r, 200));
    for (const [i, c] of cs.entries()) expect(c.msgs.some((m) => m.t === 'chat'), `client ${i}`).toBe(false);
    cs[1].send({ t: 'chat', text: 'sorry' });
    expect((await cs[1].next('chatBlocked')).reason).toBe('suspended');
    cs[2].send({ t: 'chat', text: 'still fine for others' });
    expect((await cs[0].waitFor((m) => m.t === 'chat')).message.text).toBe('still fine for others');
  });
  it('lets a player report a message and appeal a suspension', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[2].send({ t: 'chat', text: 'hello there' });
    const msg = (await cs[0].waitFor((m) => m.t === 'chat')).message;
    cs[0].send({ t: 'report', messageId: msg.id });
    expect(await cs[0].waitFor((m) => m.t === 'reportResult')).toMatchObject({ ok: true });
    cs[1].send({ t: 'chat', text: 'blorf' });
    await cs[1].waitFor((m) => m.t === 'chatBlocked');
    cs[1].send({ t: 'appeal', note: 'it was a mistake' });
    expect(await cs[1].waitFor((m) => m.t === 'appealResult')).toMatchObject({ ok: true });
    expect(server.chat.queue('human').some((i) => i.category === 'appeal')).toBe(true);
  });

  it('tells a returning player their standing in the welcome message', async () => {
    const server = await boot();
    server.chat.submit({ userId: 'dev:Held1', name: 'Held1', roomCode: 'R', text: 'blorf' });
    const c = await Client.connect(server.port, 'Held1');
    clients.push(c);
    const w = await c.waitFor((m) => m.t === 'welcome');
    expect(w.moderation).toMatchObject({ openItems: 1, heldMessage: { text: 'blorf' }, appeal: { state: 'none' } });
    expect(w.moderation.suspendedUntil).toBe(w.chat.suspendedUntil);
  });

  it('pushes the new standing to the player when a person decides, without a reload', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[1].send({ t: 'chat', text: 'blorf' });
    await cs[1].waitFor((m) => m.t === 'chatBlocked');
    const held = server.chat.queue()[0];
    held.status = 'human';
    server.chat.resolveByHuman(held.id, 'clear', 'false alarm', 'mod1');
    const pushed = await cs[1].waitFor((m) => m.t === 'moderation' && m.status.suspendedUntil === null);
    expect(pushed.status).toMatchObject({ banned: false, openItems: 0, lastDecision: { verdict: 'clear', byPerson: true, reason: 'false alarm' } });
  });
});

describe('block, mute and kick over the wire', () => {
  it('a blocker never receives the blocked player\'s messages; others do; unblocking restores them', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    const [ana, ben, cy, di] = cs;
    const benId = (await ben.waitFor((m) => m.t === 'welcome')).userId as string;
    cy.send({ t: 'block', userId: benId });
    expect(await cy.waitFor((m) => m.t === 'blocks' && m.list.includes(benId))).toBeTruthy();
    ben.send({ t: 'chat', text: 'hello from ben' });
    await ana.waitFor((m) => m.t === 'chat' && m.message.text === 'hello from ben');
    await di.waitFor((m) => m.t === 'chat' && m.message.text === 'hello from ben');
    await ben.waitFor((m) => m.t === 'chat' && m.message.text === 'hello from ben'); // the sender still sees their own
    await new Promise((r) => setTimeout(r, 200));
    expect(cy.msgs.some((m) => m.t === 'chat' && m.message.userId === benId)).toBe(false);
    // Cy can still talk to Ben; blocking is one way
    cy.send({ t: 'chat', text: 'cy here' });
    await ben.waitFor((m) => m.t === 'chat' && m.message.text === 'cy here');
    cy.send({ t: 'unblock', userId: benId });
    await cy.next('blocks');
    ben.send({ t: 'chat', text: 'second message' });
    await cy.waitFor((m) => m.t === 'chat' && m.message.text === 'second message');
  });

  it('you cannot block yourself', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    const me = (await cs[0].waitFor((m) => m.t === 'welcome')).userId as string;
    cs[0].send({ t: 'block', userId: me });
    expect(await cs[0].waitFor((m) => m.t === 'error')).toMatchObject({ error: 'cannot_target' });
  });

  it('a host mute silences one player or everyone else, only the host can do it, and it is logged', async () => {
    const audit = new MemoryAudit();
    const server = await boot({ audit });
    const { cs } = await join4(server);
    const [ana, ben, cy] = cs;
    const benId = (await ben.waitFor((m) => m.t === 'welcome')).userId as string;
    ben.send({ t: 'mute', on: true });
    expect(await ben.waitFor((m) => m.t === 'error')).toMatchObject({ error: 'not_host' });
    ana.send({ t: 'mute', on: true, userId: benId });
    await cy.waitFor((m) => m.t === 'room' && m.view.mutedIds.includes(benId));
    ben.send({ t: 'chat', text: 'can anyone hear me' });
    expect(await ben.waitFor((m) => m.t === 'chatBlocked')).toMatchObject({ reason: 'muted' });
    cy.send({ t: 'chat', text: 'cy is fine' });
    await ana.waitFor((m) => m.t === 'chat' && m.message.text === 'cy is fine');
    ana.send({ t: 'mute', on: false, userId: benId });
    ana.send({ t: 'mute', on: true }); // now the whole room
    await cy.waitFor((m) => m.t === 'room' && m.view.chatMuted === true);
    cy.send({ t: 'chat', text: 'blocked by room mute' });
    await cy.waitFor((m) => m.t === 'chatBlocked' && m.reason === 'muted');
    ana.send({ t: 'chat', text: 'the host can still talk' });
    await cy.waitFor((m) => m.t === 'chat' && m.message.text === 'the host can still talk');
    expect(server.chat.queue()).toHaveLength(0); // a mute is not a rule violation
    expect(audit.entries.map((e) => e.action)).toEqual(['host_mute', 'host_unmute', 'host_mute']);
    expect(audit.entries[0]).toMatchObject({ actor: expect.stringContaining('Ana'), userId: benId });
  });

  it('a host kick removes the player, tells them, keeps the game going with a bot, and blocks rejoining', async () => {
    const audit = new MemoryAudit();
    const server = await boot({ audit });
    const { cs, code } = await join4(server);
    const [ana, ben, , di] = cs;
    const diId = (await di.waitFor((m) => m.t === 'welcome')).userId as string;
    ben.send({ t: 'kick', userId: diId });
    expect(await ben.waitFor((m) => m.t === 'error')).toMatchObject({ error: 'not_host' });
    ana.send({ t: 'start' });
    await di.waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    ana.send({ t: 'kick', userId: diId });
    await di.waitFor((m) => m.t === 'kicked');
    await di.waitFor((m) => m.t === 'left');
    const after = await ana.waitFor((m) => m.t === 'room' && m.view.phase === 'playing' && m.view.members.length === 3);
    expect(after.view.game.players.filter((p: any) => p.isHuman)).toHaveLength(3); // the seat is now a bot
    di.send({ t: 'join', code });
    expect(await di.waitFor((m) => m.t === 'error')).toMatchObject({ error: 'kicked' });
    expect(audit.entries).toEqual([expect.objectContaining({ action: 'host_kick', userId: diId, details: { roomCode: code } })]);
  });
});

describe('server-run Daily Table over the wire', () => {
  async function one(server: Awaited<ReturnType<typeof boot>>, name: string) {
    const c = await Client.connect(server.port, name);
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    return c;
  }
  it('is unavailable when no gate is configured', async () => {
    const server = await boot();
    const c = await one(server, 'Solo1');
    c.send({ t: 'daily' });
    expect((await c.waitFor((m) => m.t === 'error')).error).toBe('daily_unavailable');
  });
  it('is refused when the gate says the attempt is spent', async () => {
    const server = await boot({ dailyGate: { reserve: async () => false } });
    const c = await one(server, 'Solo2');
    c.send({ t: 'daily' });
    expect((await c.waitFor((m) => m.t === 'error')).error).toBe('daily_used');
    expect(server.rooms.roomCount).toBe(0);
  });
  it('is unavailable if the gate itself fails, rather than letting anyone play', async () => {
    const server = await boot({ dailyGate: { reserve: async () => { throw new Error('db down'); } } });
    const c = await one(server, 'Solo3');
    c.send({ t: 'daily' });
    expect((await c.waitFor((m) => m.t === 'error')).error).toBe('daily_unavailable');
  });
  it('starts a solo game once the gate agrees, and does not spend a second attempt', async () => {
    const reserved: string[] = [];
    const server = await boot({ dailyGate: { reserve: async (u, d) => (reserved.push(`${u}@${d}`), true) } });
    const c = await one(server, 'Solo4');
    c.send({ t: 'daily' });
    const room = await c.waitFor((m) => m.t === 'room');
    expect(room.view.phase).toBe('playing');
    expect(room.view.game.players.filter((p: { isHuman: boolean }) => p.isHuman)).toHaveLength(1);
    expect(room.you.seat).toBe(0);
    c.send({ t: 'daily' }); // already playing: must not reserve again
    expect((await c.waitFor((m) => m.t === 'error')).error).toBe('already_in_room');
    expect(reserved).toHaveLength(1);
    expect(reserved[0]).toMatch(/^dev:Solo4@\d{4}-\d{2}-\d{2}$/);
  });
});

describe('accounts that may not chat', () => {
  it('are told so, and nobody receives their message', async () => {
    const server = await boot();
    const mute = await Client.connect(server.port, 'Mute1');
    const other = await Client.connect(server.port, 'Other1');
    clients.push(mute, other);
    await Promise.all([mute, other].map((c) => c.waitFor((m) => m.t === 'welcome')));
    mute.send({ t: 'create', visibility: 'private' });
    const code = (await mute.waitFor((m) => m.t === 'room')).view.code;
    other.send({ t: 'join', code });
    await other.waitFor((m) => m.t === 'room');
    mute.send({ t: 'chat', text: 'hello' });
    expect((await mute.waitFor((m) => m.t === 'chatBlocked')).reason).toBe('not_allowed');
    await new Promise((r) => setTimeout(r, 150));
    expect(other.msgs.some((m) => m.t === 'chat')).toBe(false);
  });
});

describe('leaving and disconnecting', () => {
  it('a player who leaves mid-game is replaced by a bot, and the host passes on', async () => {
    const server = await boot();
    const { cs } = await join4(server);
    cs[0].send({ t: 'start' });
    await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    cs[0].send({ t: 'leave' });
    await cs[0].waitFor((m) => m.t === 'left');
    const view = (await cs[1].waitFor((m) => m.t === 'room' && m.view.phase === 'playing' && m.view.members.length === 3)).view;
    expect(view.hostId).toBe('dev:Ben');
    expect(view.game.players[0].isHuman).toBe(false);
    expect(view.game.players[0].name).toBe('Ana');
    expect(view.phase).toBe('playing');
  });
  it('keeps the seat if the player reconnects within the grace period', async () => {
    const server = await boot({ reconnectGraceMs: 400 });
    const { cs } = await join4(server);
    cs[0].send({ t: 'start' });
    await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    cs[3].ws.terminate();
    await new Promise((r) => setTimeout(r, 120));
    const back = await Client.connect(server.port, 'Di');
    clients.push(back);
    const room = await back.waitFor((m) => m.t === 'room');
    expect(room.you.seat).toBe(3);
    await new Promise((r) => setTimeout(r, 500)); // past the original grace period
    expect(cs[0].lastRoom()!.view.members).toHaveLength(4);
    expect(cs[0].lastRoom()!.view.game.players[3].isHuman).toBe(true);
  });
  it('gives the seat to a bot once the grace period runs out', async () => {
    const server = await boot({ reconnectGraceMs: 150 });
    const { cs } = await join4(server);
    cs[0].send({ t: 'start' });
    await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing');
    cs[3].ws.terminate();
    const view = (await cs[0].waitFor((m) => m.t === 'room' && m.view.phase === 'playing' && m.view.members.length === 3, 3000)).view;
    expect(view.game.players[3].isHuman).toBe(false);
  });
  it('limits how many rooms one player can create', async () => {
    const server = await boot();
    const c = await Client.connect(server.port, 'Spammer');
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    const errors: string[] = [];
    for (let i = 0; i < 5; i++) {
      c.send({ t: 'create', visibility: 'public' });
      await new Promise((r) => setTimeout(r, 60));
      c.send({ t: 'leave' });
      await new Promise((r) => setTimeout(r, 60));
    }
    for (const m of c.msgs) if (m.t === 'error') errors.push(m.error);
    expect(errors).toContain('rate_limited');
  });
});

describe('connection limits and resilience', () => {
  const raw = (port: number, headers: Record<string, string> = {}) =>
    new Promise<{ status: number | 'open'; ws?: WebSocket }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
      ws.once('open', () => resolve({ status: 'open', ws }));
      ws.once('unexpected-response', (_req, res) => resolve({ status: res.statusCode ?? 0 }));
      ws.once('error', () => resolve({ status: 0 })); // refused outright (the server is gone)
    });

  it('only lets listed origins open a socket', async () => {
    const server = await boot({ limits: { allowedOrigins: ['https://game.example'] } });
    expect((await raw(server.port, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await raw(server.port)).status).toBe(403); // no Origin header at all
    const ok = await raw(server.port, { origin: 'https://game.example' });
    expect(ok.status).toBe('open');
    ok.ws!.close();
  });

  it('refuses a third connection from one address, and counts it again when one closes', async () => {
    const server = await boot({ limits: { maxPerIp: 2 } });
    const a = await raw(server.port);
    const b = await raw(server.port);
    expect([a.status, b.status]).toEqual(['open', 'open']);
    expect((await raw(server.port)).status).toBe(429);
    a.ws!.close();
    await new Promise((r) => setTimeout(r, 100));
    const c = await raw(server.port);
    expect(c.status).toBe('open');
    b.ws!.close();
    c.ws!.close();
  });

  it('refuses connections beyond the global cap', async () => {
    const server = await boot({ limits: { maxTotal: 2, maxPerIp: 99 } });
    const a = await raw(server.port);
    const b = await raw(server.port);
    expect((await raw(server.port)).status).toBe(503);
    expect(server.connections()).toBe(2);
    a.ws!.close();
    b.ws!.close();
  });

  it('with trustProxy, limits by the proxy-reported address instead of the socket', async () => {
    const server = await boot({ limits: { maxPerIp: 1, trustProxy: true } });
    const a = await raw(server.port, { 'x-forwarded-for': '203.0.113.1' });
    const b = await raw(server.port, { 'x-forwarded-for': '203.0.113.2' });
    expect([a.status, b.status]).toEqual(['open', 'open']);
    expect((await raw(server.port, { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' })).status).toBe(429);
    a.ws!.close();
    b.ws!.close();
  });

  it('drops a connection that stops answering heartbeats, and keeps one that answers', async () => {
    const server = await boot({ limits: { heartbeatMs: 60 } });
    const dead = new WebSocket(`ws://127.0.0.1:${server.port}`, { autoPong: false });
    await new Promise((r) => dead.once('open', r));
    const closed = new Promise<number>((r) => dead.once('close', r));
    const alive = await Client.connect(server.port, 'Alive1');
    clients.push(alive);
    await alive.waitFor((m) => m.t === 'welcome');
    await closed;
    await new Promise((r) => setTimeout(r, 200));
    expect(alive.ws.readyState).toBe(WebSocket.OPEN);
    expect(server.connections()).toBe(1);
  });

  it('rate limits every message type and disconnects a client that keeps flooding', async () => {
    const server = await boot({ limits: { messageLimits: { rooms: [3, 60_000], '*': [1000, 60_000] } } });
    const c = await Client.connect(server.port, 'Flood1');
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    for (let i = 0; i < 4; i++) c.send({ t: 'rooms' });
    await c.waitFor((m) => m.t === 'error' && m.error === 'rate_limited');
    expect(c.msgs.filter((m) => m.t === 'rooms')).toHaveLength(3); // three allowed, the fourth refused
    const closed = new Promise<number>((r) => c.ws.once('close', r));
    for (let i = 0; i < 80; i++) c.send({ t: 'rooms' });
    expect(await closed).toBe(4008);
  });

  it('other message types have their own budgets', async () => {
    const server = await boot({ limits: { messageLimits: { appeal: [2, 60_000] } } });
    const { cs } = await join4(server);
    for (let i = 0; i < 3; i++) cs[0].send({ t: 'appeal', note: 'x' });
    await cs[0].waitFor((m) => m.t === 'error' && m.error === 'rate_limited');
  });

  it('tells clients before it shuts down, then closes them politely', async () => {
    const server = await boot({ limits: { shutdownGraceMs: 100 } });
    const c = await Client.connect(server.port, 'Bye1');
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    const closed = new Promise<number>((r) => c.ws.once('close', r));
    const closing = server.close();
    expect(await c.waitFor((m) => m.t === 'shutdown')).toMatchObject({ reconnectInMs: 3000 });
    expect(await closed).toBe(1001);
    await closing;
    expect((await raw(server.port)).status).not.toBe('open');
  });

  it('leaving when the room is already gone just answers "left"', async () => {
    const server = await boot();
    const c = await Client.connect(server.port, 'Gone1');
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    c.send({ t: 'leave' });
    await c.waitFor((m) => m.t === 'left');
  });
});

describe('logins on open connections', () => {
  /** Tokens look like "sess:<name>:<session>:<ms until it expires>". */
  const sessions = async (token: string): Promise<AuthUser | null> => {
    const [kind, name, session, ms] = token.split(':');
    if (kind !== 'sess') return null;
    return { userId: `sess:${name}`, name, chatAllowed: true, isModerator: false, session: { id: session, expiresAt: Date.now() + Number(ms) } };
  };
  const connect = async (server: Awaited<ReturnType<typeof boot>>, token: string) => {
    const c = await Client.connect(server.port, 'x', token);
    clients.push(c);
    await c.waitFor((m) => m.t === 'welcome');
    return c;
  };
  const closeCode = (c: Client) => new Promise<number>((r) => c.ws.once('close', r));

  it('a logout closes only the matching session, with a code that means "do not reconnect"', async () => {
    const bus = new RevocationBus();
    const server = await boot({ verifyToken: sessions, revocations: bus });
    const c = await connect(server, 'sess:Ann:A:600000');
    bus.emit('sess:Ann', 'OTHER', 'logout');
    await new Promise((r) => setTimeout(r, 100));
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
    const closed = closeCode(c);
    bus.emit('sess:Ann', 'A', 'logout');
    expect(await closed).toBe(4003);
  });

  it('logging out everywhere closes the connection, and a change of account status asks it to reconnect', async () => {
    const bus = new RevocationBus();
    const server = await boot({ verifyToken: sessions, revocations: bus });
    const a = await connect(server, 'sess:Ann:A:600000');
    const closedA = closeCode(a);
    bus.emit('sess:Ann', null, 'logout');
    expect(await closedA).toBe(4003);
    const b = await connect(server, 'sess:Bob:B:600000');
    const closedB = closeCode(b);
    bus.emit('sess:Bob', null, 'status');
    expect(await closedB).toBe(4004);
  });

  it('asks for a fresh token before the login expires, and keeps the connection if it gets one', async () => {
    const server = await boot({ verifyToken: sessions, limits: { heartbeatMs: 40, reauthLeadMs: 150, sessionGraceMs: 100 } });
    const c = await connect(server, 'sess:Ann:A:250');
    await c.waitFor((m) => m.t === 'reauth');
    c.send({ t: 'auth', token: 'sess:Ann:A:600000' });
    await new Promise((r) => setTimeout(r, 500)); // well past the old expiry and its grace period
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('closes a connection whose login expired and was not refreshed', async () => {
    const server = await boot({ verifyToken: sessions, limits: { heartbeatMs: 40, reauthLeadMs: 150, sessionGraceMs: 100 } });
    const c = await connect(server, 'sess:Ann:A:200');
    expect(await closeCode(c)).toBe(4003);
  });

  it('refuses a "refresh" with a token for a different account', async () => {
    const server = await boot({ verifyToken: sessions });
    const c = await connect(server, 'sess:Ann:A:600000');
    const closed = closeCode(c);
    c.send({ t: 'auth', token: 'sess:Mallory:M:600000' });
    expect(await closed).toBe(4003);
  });

  it('a connection without a login session (development sign-in) never expires', async () => {
    const server = await boot({ limits: { heartbeatMs: 40, reauthLeadMs: 150, sessionGraceMs: 50 } });
    const c = await connect(server, 'dev:Dev1');
    await new Promise((r) => setTimeout(r, 300));
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
    expect(c.msgs.some((m) => m.t === 'reauth')).toBe(false);
  });
});

describe('invites and cosmetics over the wire', () => {
  const friendsOf = (pairs: [string, string][]) => ({ areFriends: async (a: string, b: string) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) });
  const id = (n: string) => `dev:${n}`;
  async function pair(extra: Parameters<typeof boot>[0] = {}) {
    const server = await boot({ friends: friendsOf([[id('Ana'), id('Ben')]]), ...extra });
    const [ana, ben, cy] = await Promise.all(['Ana', 'Ben', 'Cy'].map((n) => Client.connect(server.port, n)));
    clients.push(ana, ben, cy);
    await Promise.all([ana, ben, cy].map((c) => c.waitFor((m) => m.t === 'welcome')));
    return { server, ana, ben, cy };
  }
  const makeRoom = async (c: Client) => {
    c.send({ t: 'create', visibility: 'private' });
    return (await c.waitFor((m) => m.t === 'room')).view.code as string;
  };

  it('a friend in the lobby gets the room code; a non-friend is refused without being told anything', async () => {
    const { ana, ben, cy } = await pair();
    const code = await makeRoom(ana);
    ana.send({ t: 'invite', userId: id('Cy') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: false, reason: 'friends_only' });
    expect(cy.msgs.some((m) => m.t === 'invited')).toBe(false);
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: true });
    expect(await ben.waitFor((m) => m.t === 'invited')).toMatchObject({ from: { userId: id('Ana'), name: 'Ana' }, code, roomName: expect.stringContaining('Ana') });
  });

  it('is refused when you are not in a lobby, the friend is busy or offline, or you already asked', async () => {
    const { ana } = await pair();
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: false, reason: 'not_in_lobby' });
    await makeRoom(ana);
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: true });
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: false, reason: 'already_invited' });
    // a friend who is not connected
    const s2 = await boot({ friends: friendsOf([[id('Ann'), id('Ghost')]]) });
    const ann = await Client.connect(s2.port, 'Ann');
    clients.push(ann);
    await ann.waitFor((m) => m.t === 'welcome');
    await makeRoom(ann);
    ann.send({ t: 'invite', userId: id('Ghost') });
    expect(await ann.next('inviteResult')).toMatchObject({ ok: false, reason: 'offline' });
    const s3 = await boot({ friends: friendsOf([[id('Ana'), id('Ben')]]) });
    const [a3, b3] = await Promise.all(['Ana', 'Ben'].map((n) => Client.connect(s3.port, n)));
    clients.push(a3, b3);
    await Promise.all([a3, b3].map((c) => c.waitFor((m) => m.t === 'welcome')));
    await makeRoom(b3);
    await makeRoom(a3);
    a3.send({ t: 'invite', userId: id('Ben') });
    expect(await a3.next('inviteResult')).toMatchObject({ ok: false, reason: 'busy' });
  });

  it('a block in either direction stops an invite, with the same answer as a non-friend', async () => {
    const blocks = new BlockList();
    const { ana, ben } = await pair({ blocks });
    await makeRoom(ana);
    blocks.block(id('Ben'), id('Ana'));
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: false, reason: 'friends_only' });
    blocks.unblock(id('Ben'), id('Ana'));
    blocks.block(id('Ana'), id('Ben'));
    ana.send({ t: 'invite', userId: id('Ben') });
    expect(await ana.next('inviteResult')).toMatchObject({ ok: false, reason: 'friends_only' });
    expect(ben.msgs.some((m) => m.t === 'invited')).toBe(false);
  });

  it('shows what players wear in the room, and updates when they change it', async () => {
    const worn = new Map<string, Record<string, string>>([[id('Ana'), { badge: '🔥' }]]);
    const listeners: ((u: string, c: Record<string, string>) => void)[] = [];
    const cosmetics = {
      cosmetics: async (u: string) => worn.get(u) ?? {},
      cachedCosmetics: (u: string) => worn.get(u),
      onCosmetics: (l: (u: string, c: Record<string, string>) => void) => (listeners.push(l), () => undefined),
    };
    const { ana, ben } = await pair({ cosmetics });
    const code = await makeRoom(ana);
    ben.send({ t: 'join', code });
    const view = (await ben.waitFor((m) => m.t === 'room' && m.view.members.length === 2)).view;
    expect(view.members.find((m: any) => m.userId === id('Ana')).cosmetics).toEqual({ badge: '🔥' }); // eslint-disable-line @typescript-eslint/no-explicit-any
    worn.set(id('Ben'), { color: '#fbbf24' });
    listeners.forEach((l) => l(id('Ben'), { color: '#fbbf24' }));
    const again = await ana.waitFor((m) => m.t === 'room' && m.view.members.some((x: any) => x.cosmetics?.color === '#fbbf24')); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(again).toBeTruthy();
  });
});
