// Quick safety check of a running game server, and of the website if its address is given. Usage:
//   node scripts/smoke.mjs https://your-server.example.org https://your-site-origin [https://your-site-origin/path/]
// It only reads; it creates nothing. Exit code 1 if anything is wrong. The "Smoke check" workflow runs it after every
// server deploy.
import WebSocket from 'ws';

const [base, goodOrigin, site] = process.argv.slice(2);
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
for (const path of ['/api/account/me', '/api/shop', '/api/wallet', '/api/me/stats', '/api/ranked/top', '/api/barn/top']) {
  check(`${path} needs a login`, (await status(path, { headers: { origin: goodOrigin } })) === 401);
}
for (const path of ['/api/ops/status', '/api/mod/queue']) {
  check(`${path} needs a moderator`, (await status(path, { headers: { origin: goodOrigin, authorization: 'Bearer not-a-real-token' } })) === 401);
}
// Friends are back on the profile (2026-11-14): every friends address needs a login, a guest's included.
for (const path of ['/api/friends', '/api/friends/code', '/api/guest/friends']) {
  check(`${path} needs a login`, (await status(path, { headers: { origin: goodOrigin } })) === 401);
}
// A control character in a path is refused at the door, not passed on to the database (2026-11-15).
check('a NUL in a path is refused', (await status('/api/consent/%00', { headers: { origin: goodOrigin } })) === 400);
// The admin panel's numbers answer only to the stats key: a wrong one is refused (403), or the numbers are off (404).
const stats = await status('/api/admin/stats', { method: 'POST', headers: { origin: goodOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'not-the-stats-key-0000' }) });
check('the admin numbers refuse a wrong key', stats === 403 || stats === 404, String(stats));
console.log(`     (the admin numbers are ${stats === 404 ? 'off: ADMIN_STATS_KEY is not set on the server' : 'on'})`);
// The leaderboards page reads these two without a login.
for (const path of ['/api/ranked/board', '/api/barn/board']) {
  const r = await fetch(base + path, { headers: { origin: goodOrigin } });
  check(`${path} is public and well-formed`, r.status === 200 && Array.isArray((await r.json()).top));
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

if (site) {
  const page = await fetch(site);
  check('the website answers', page.status === 200, String(page.status));
  const html = await page.text();
  check('the website serves the game page', html.includes('boot-doors'), 'not the game page');
  const preview = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  check('the link preview picture is there', !!preview && (await fetch(preview)).status === 200, String(preview));
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
