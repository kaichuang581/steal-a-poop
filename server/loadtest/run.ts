/**
 * Load test: many real WebSocket clients against a real server process on this machine.
 *
 *   npm run loadtest                       # 200 clients, 30 s
 *   npm run loadtest -- --clients 400 --seconds 60
 *
 * It starts server/main.ts as a separate process (so the server's memory and CPU are measured on their
 * own, not mixed with the 200 clients), signs in dev users, puts them into rooms of 10, starts a game in
 * each, and then asks the server a cheap question from every client once a second while the games run.
 *
 * What this does NOT tell you: real internet latency, TLS cost, Supabase or the database, real players
 * (these ones sit idle while bots and timeouts move the games), or production hardware. Clients and
 * server share this machine's CPU, so latency here is, if anything, pessimistic for the clients and
 * optimistic for the network. Treat the numbers as a floor to compare against, not a promise.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const CLIENTS = arg('clients', 200);
const SECONDS = arg('seconds', 30);
const PORT = arg('port', 8799);
const ROOM_SIZE = 10;

type Msg = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)] : NaN);
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : 'n/a');

const server = spawn('node_modules/.bin/vite-node', ['server/main.ts'], {
  env: {
    ...process.env, PORT: String(PORT), ALLOW_DEV_AUTH: '1', MAX_CONNECTIONS_PER_IP: String(CLIENTS + 50), MAX_CONNECTIONS: String(CLIENTS + 100),
    DATABASE_URL: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const pid = server.pid!;

const procStat = () => {
  const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0) / 1024; // MB
  const parts = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  const cpuSeconds = (Number(parts[11]) + Number(parts[12])) / 100; // utime + stime in clock ticks (100/s)
  return { rss, cpuSeconds };
};

class Bot {
  ws!: WebSocket;
  msgs: Msg[] = [];
  welcomed = false;
  closedWith: number | null = null;
  gotShutdown = false;
  pendingAt: number | null = null;
  rtts: number[] = [];
  received = 0;
  bytes = 0;
  roomCode = '';
  phase = '';
  constructor(public i: number) {}
  connect(): Promise<number> {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'hello', token: `dev:LT${this.i}` })));
      this.ws.on('message', (d) => {
        const raw = d.toString();
        this.received += 1;
        this.bytes += raw.length;
        const m = JSON.parse(raw) as Msg;
        if (m.t === 'welcome') {
          this.welcomed = true;
          resolve(performance.now() - t0);
        }
        if (m.t === 'rooms' && this.pendingAt !== null) {
          this.rtts.push(performance.now() - this.pendingAt);
          this.pendingAt = null;
        }
        if (m.t === 'room') {
          this.roomCode = m.view.code;
          this.phase = m.view.phase;
        }
        if (m.t === 'shutdown') this.gotShutdown = true;
      });
      this.ws.on('close', (code) => (this.closedWith = code));
      this.ws.on('error', reject);
    });
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  async until(pred: () => boolean, ms = 10_000) {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(20);
    }
  }
}

async function main() {
  // wait for the server
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 200) throw new Error(`server did not start:\n${serverLog}`);
    await sleep(100);
  }
  const idle = procStat();

  const bots = Array.from({ length: CLIENTS }, (_, i) => new Bot(i));
  const connectMs: number[] = [];
  for (let i = 0; i < bots.length; i += 20) connectMs.push(...(await Promise.all(bots.slice(i, i + 20).map((b) => b.connect()))));
  const afterConnect = procStat();

  // rooms of ten
  const groups: Bot[][] = [];
  for (let i = 0; i < bots.length; i += ROOM_SIZE) groups.push(bots.slice(i, i + ROOM_SIZE));
  for (const [gi, g] of groups.entries()) {
    const host = g[0];
    host.send({ t: 'create', visibility: gi % 2 ? 'private' : 'public' });
    await host.until(() => !!host.roomCode);
    for (const b of g.slice(1)) {
      b.send({ t: 'join', code: host.roomCode });
      await b.until(() => !!b.roomCode);
    }
  }
  for (const g of groups) if (g.length >= 4) g[0].send({ t: 'start' });
  await sleep(500);
  const playing = bots.filter((b) => b.phase === 'playing').length;
  const afterRooms = procStat();

  // steady state: every client asks "what rooms are open" once a second
  const sampleStart = procStat();
  const t0 = Date.now();
  const rssSamples: number[] = [];
  let asked = 0;
  const msgsBefore = bots.reduce((n, b) => n + b.received, 0);
  const bytesBefore = bots.reduce((n, b) => n + b.bytes, 0);
  while (Date.now() - t0 < SECONDS * 1000) {
    for (const b of bots) {
      if (b.pendingAt === null && b.ws.readyState === WebSocket.OPEN) {
        b.pendingAt = performance.now();
        b.send({ t: 'rooms' });
        asked += 1;
      }
    }
    rssSamples.push(procStat().rss);
    await sleep(1000);
  }
  const sampleEnd = procStat();
  const elapsed = (Date.now() - t0) / 1000;
  const msgs = bots.reduce((n, b) => n + b.received, 0) - msgsBefore;
  const bytes = bots.reduce((n, b) => n + b.bytes, 0) - bytesBefore;
  const rtts = bots.flatMap((b) => b.rtts);
  const lost = bots.filter((b) => b.closedWith !== null).length;

  // graceful shutdown: SIGTERM, count who was told and how they were closed
  server.kill('SIGTERM');
  const exited = await Promise.race([new Promise((r) => server.once('exit', () => r(true))), sleep(10_000).then(() => false)]);
  await sleep(300);

  const out = [
    `Load test: ${CLIENTS} clients, ${groups.length} rooms of up to ${ROOM_SIZE} (${playing} clients in running games), ${SECONDS}s steady state`,
    `Machine: ${process.platform} node ${process.version}; server and clients share this machine`,
    ``,
    `Connect (hello -> welcome):  p50 ${fmt(pct(connectMs, 0.5))} ms   p95 ${fmt(pct(connectMs, 0.95))} ms   max ${fmt(Math.max(...connectMs))} ms`,
    `Round trip ("rooms" request, ${rtts.length} answered of ${asked} sent):  p50 ${fmt(pct(rtts, 0.5))} ms   p95 ${fmt(pct(rtts, 0.95))} ms   p99 ${fmt(pct(rtts, 0.99))} ms   max ${fmt(Math.max(...rtts))} ms`,
    `Server memory (RSS):  empty ${fmt(idle.rss)} MB   ${CLIENTS} connected ${fmt(afterConnect.rss)} MB   in games ${fmt(afterRooms.rss)} MB   end of run ${fmt(sampleEnd.rss)} MB   peak ${fmt(Math.max(...rssSamples))} MB`,
    `Server CPU during steady state: ${fmt(((sampleEnd.cpuSeconds - sampleStart.cpuSeconds) / elapsed) * 100)}% of one core`,
    `Traffic to clients: ${fmt(msgs / elapsed)} messages/s, ${fmt(bytes / elapsed / 1024)} KB/s in total (${fmt(msgs / elapsed / CLIENTS)} msg/s per client)`,
    `Clients dropped during the run: ${lost}`,
    `Shutdown (SIGTERM): server exited ${exited ? 'by itself' : 'NOT in time'}; ${bots.filter((b) => b.gotShutdown).length}/${CLIENTS} clients were told first; closed with code 1001: ${bots.filter((b) => b.closedWith === 1001).length}`,
  ];
  console.log(out.join('\n'));
  if (!exited) server.kill('SIGKILL');
  process.exit(lost > 0 || !exited ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  try {
    server.kill('SIGKILL');
  } catch {
    /* already gone */
  }
  process.exit(1);
});
