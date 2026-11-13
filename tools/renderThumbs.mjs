// Bakes the Trading Post's thumbnails (docs/PLAN_TRADING_POST_REFINE.md Part 7): every catalogue item, photographed
// through ?preview=thumb into public/shop/<id>.webp (256 x 256, clear background).
// Run with the dev server up:  node tools/renderThumbs.mjs [--base http://localhost:5173/steal-a-poop/] [--only id,id]
// Re-run after changing an item's look (catalog.ts, voxel/bomb.ts, shop/thumbModels.ts) and commit the pictures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const only = arg('only', '').split(',').filter(Boolean);
// The ids come from the catalogue's source, so this file needs no build step.
const catalog = readFileSync('src/skin/shop/catalog.ts', 'utf8');
// The sacks are not here: they are baked in their crates on the market stall, by tools/renderStall.mjs.
const ids = [...catalog.matchAll(/\{ id: '([a-z0-9-]+)'/g)].map((m) => m[1]);

mkdirSync('public/shop', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    await page.goto(`${base}?preview=thumb&id=${id}`);
    await page.waitForFunction(() => window.__thumbReady, null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.92));
    if (!data.startsWith('data:image/webp')) throw new Error(`${id}: the browser did not encode WebP`);
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`public/shop/${id}.webp`, bytes);
    console.log(`${id}: ${Math.round(bytes.length / 1024)} KB`);
  }
} finally {
  await browser.close();
}
