// Quick safety check of a running game server. Usage:
//   node scripts/smoke.mjs https://your-server.example.org https://your-site-origin
// It only reads; it creates nothing. Exit code 1 if anything is wrong. Run it after every first deploy.
import WebSocket from 'ws';

const [base, goodOrigin] = process.argv.slice(2);
if (!base || !goodOrigin) {
  console.error('Usage: node scripts/smoke.mjs <server address> <allowed website origin>');
  process.exit(2);
}
const wsBase = base.replace(/^http/, 'ws');
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed += 1;
};

const status = async (path, init) => (await fetch(base + path, init)).status;

check('health check answers', (await status('/healthz')) === 200);
for (const path of ['/api/account/me', '/api/shop', '/api/friends', '/api/wallet', '/api/me/stats']) {
  check(`${path} needs a login`, (await status(path, { headers: { origin: goodOrigin } })) === 401);
}
for (const path of ['/api/ops/status', '/api/mod/queue']) {
  check(`${path} needs a moderator`, (await status(path, { headers: { origin: goodOrigin, authorization: 'Bearer not-a-real-token' } })) === 401);
}
const board = await fetch(`${base}/api/leaderboard/all?metric=wins`, { headers: { origin: goodOrigin } });
check('leaderboard is public and well-formed', board.status === 200 && Array.isArray((await board.json()).rows));
check('a bad period is refused', (await status('/api/leaderboard/forever', { headers: { origin: goodOrigin } })) === 400);
check('a foreign website is refused by the API', (await status('/api/leaderboard/all', { headers: { origin: 'https://evil.example' } })) === 403);

const open = (origin) =>
  new Promise((resolve) => {
    const ws = new WebSocket(wsBase, origin ? { headers: { origin } } : {});
    const t = setTimeout(() => resolve({ result: 'timeout' }), 6000);
    ws.on('unexpected-response', (_req, res) => (clearTimeout(t), resolve({ result: 'refused', code: res.statusCode })));
    ws.on('error', () => undefined);
    ws.on('close', (code) => (clearTimeout(t), resolve({ result: 'closed', code })));
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: origin === goodOrigin ? 'dev:smoke' : 'x' })));
  });
const evil = await open('https://evil.example');
check('a foreign website cannot open a game connection', evil.result === 'refused' && evil.code === 403, JSON.stringify(evil));
const dev = await open(goodOrigin);
check('the development sign-in is refused', dev.result === 'closed' && dev.code === 4001, JSON.stringify(dev));

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
