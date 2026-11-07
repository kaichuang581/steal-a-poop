import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createDictionary } from '../src/engine';
import { ChatService } from './chat';
import { ChatFilter } from './filter';
import { startServer } from './index';

const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
const filter = new ChatFilter({ blocklist: ['blorf'], isWord: (w) => dict.has(w) });
type Msg = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const closers: (() => Promise<void>)[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.terminate());
  for (const c of closers.splice(0)) await c();
});

async function connect(port: number, name: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  sockets.push(ws);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  ws.send(JSON.stringify({ t: 'hello', token: `dev:${name}` }));
  const send = (m: object) => ws.send(JSON.stringify(m));
  const until = async (pred: (ms: Msg[]) => boolean, ms = 2500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (pred(msgs)) return; await new Promise((r) => setTimeout(r, 20)); }
    throw new Error(`timed out; got ${msgs.map((m) => m.t).join(',')}`);
  };
  await until((m) => m.some((x) => x.t === 'welcome'));
  return { send, msgs, until };
}

describe('avatars over the wire', () => {
  it('shows a picked avatar to the room, ignores unknown ids, and clears on null', async () => {
    const chat = new ChatService({ now: Date.now, filter });
    const server = await startServer({
      port: 0, ctx: { dict }, chat, randomInt: (n: number) => Math.floor(Math.random() * n), tickMs: 50, reviewEveryMs: 60_000, limits: { shutdownGraceMs: 0 },
      verifyToken: async (t) => (t.startsWith('dev:') ? { userId: t, name: t.slice(4), chatAllowed: true, isModerator: false } : null),
    });
    closers.push(() => server.close());
    const ana = await connect(server.port, 'Ana');
    const ben = await connect(server.port, 'Ben');
    ana.send({ t: 'create', visibility: 'public' });
    await ana.until((m) => m.some((x) => x.t === 'room'));
    const code = ana.msgs.find((x) => x.t === 'room')!.view.code;
    ben.send({ t: 'join', code });
    await ben.until((m) => m.some((x) => x.t === 'room'));
    const avatarOf = (c: { msgs: Msg[] }, name: string) => [...c.msgs].reverse().find((x) => x.t === 'room')?.view.members.find((mm: Msg) => mm.name === name)?.avatar;

    ana.send({ t: 'avatar', id: 'goat' });
    await ben.until(() => avatarOf(ben, 'Ana') === 'goat');

    const before = ben.msgs.length;
    ana.send({ t: 'avatar', id: 'not-a-real-avatar' });
    await ana.until((m) => m.some((x) => x.t === 'error' && x.error === 'bad_message'));
    expect(ben.msgs.length).toBe(before); // nothing was shown to anyone
    expect(avatarOf(ben, 'Ana')).toBe('goat');

    ana.send({ t: 'avatar', id: null });
    await ben.until(() => avatarOf(ben, 'Ana') === undefined);
  });
});
