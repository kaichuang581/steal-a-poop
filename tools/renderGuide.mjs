// Bakes the picture of the sheepdog on the tutorial's guide card: ?preview=guide photographed into
// public/tour/sheepdog.webp (256 x 256, clear background).
// Run with the dev server up:  node tools/renderGuide.mjs [--base http://localhost:5173/steal-a-poop/]
// Re-run after changing the dog (src/skin/voxel/characters.ts) or its framing (src/skin/tour/GuideRender.tsx), and commit the picture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const i = process.argv.indexOf('--base');
const base = i >= 0 ? process.argv[i + 1] : 'http://localhost:5173/steal-a-poop/';

mkdirSync('public/tour', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${base}?preview=guide`);
  await page.waitForFunction(() => window.__thumbReady, null, { timeout: 30000 });
  await page.waitForTimeout(150);
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.92));
  if (!data.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync('public/tour/sheepdog.webp', bytes);
  console.log(`sheepdog: ${Math.round(bytes.length / 1024)} KB`);
} finally {
  await browser.close();
}

// The bake manifest (plan file 18, section 4.5), the one step added to this tool: what was just baked is stamped, so
// `npm test` and `npm run check:scenes` know this is the picture today's model, page and tool make.
// A bake that failed never gets here, and a stamp that is refused ends this tool with its error.
{
  const baked = ['tour/sheepdog'];
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/bakeStamp.ts', '--', '--only', baked.join(',')], { stdio: 'inherit' });
}
