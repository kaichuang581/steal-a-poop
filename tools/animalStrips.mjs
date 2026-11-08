// Saves the V5.1 Part 8 strips: opens ?preview=strips, waits for every species' sheet, writes them as PNGs.
//   node tools/animalStrips.mjs --base http://localhost:5173/steal-a-poop/ [--out docs/skin/animals-v5_1] [--species cow,pig]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const out = arg('out', 'docs/skin/animals-v5_1');
const species = arg('species');
mkdirSync(out, { recursive: true });
// Software GL where there is no GPU (CI, a headless shell).
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}?skin=painted&preview=strips${species ? `&species=${species}` : ''}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__stripsDone === true, null, { timeout: 600000, polling: 1000 });
const strips = await p.evaluate(() => window.__strips);
for (const [name, url] of Object.entries(strips)) {
  const ext = url.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  writeFileSync(`${out}/strips-${name}.${ext}`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${out}/strips-${name}.${ext}`);
}
if (errs.length) console.log('page errors:', errs.join('\n'));
await b.close();
