import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createDictionary, suggestWords } from '../src/engine';
import type { GameState } from '../src/engine';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { startServer } from './index';

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

async function boot(extra: { reconnectGraceMs?: number } = {}) {
  const chat = new ChatService({ now: Date.now, filter });
  const server = await startServer({
    port: 0, ctx: { dict }, chat, randomInt, tickMs: 50, reviewEveryMs: 60_000, reconnectGraceMs: extra.reconnectGraceMs,
    verifyToken: async (token) => (token.startsWith('dev:') ? { userId: token, name: token.slice(4) } : null),
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
