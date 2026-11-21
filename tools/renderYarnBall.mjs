// Bakes the loading screen's yarn ball (drawBallWraps in src/skin/loading/yarn.ts): ?preview=yarnball photographed into
// public/loading/yarn-ball.webp (320 x 320, clear outside the ball, WebP at quality 0.9).
// Run with the dev server up:  node tools/renderYarnBall.mjs [--base http://localhost:5173/steal-a-poop/]
// Re-run after changing the ball (src/skin/loading/yarn.ts) or its page (src/skin/loading/YarnBallRender.tsx), and commit the picture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const i = process.argv.indexOf('--base');
const base = i >= 0 ? process.argv[i + 1] : 'http://localhost:5173/steal-a-poop/';

mkdirSync('public/loading', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${base}?preview=yarnball`);
  await page.waitForFunction(() => window.__thumbReady, null, { timeout: 30000 });
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.9));
  if (!data.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync('public/loading/yarn-ball.webp', bytes);
  console.log(`yarn ball: ${Math.round(bytes.length / 1024)} KB`);
} finally {
  await browser.close();
}

// The bake manifest (plan file 18, section 4.5): what was just baked is stamped, so `npm test` knows this is the
// picture today's drawing code, page and tool make. A bake that failed never gets here.
{
  const baked = ['loading/yarn-ball'];
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/bakeStamp.ts', '--', '--only', baked.join(',')], { stdio: 'inherit' });
}
