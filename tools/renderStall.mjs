// Bakes the Feed Sacks' market stall (src/skin/shop/stallModels.ts, measured by stallPlan.ts) into the pictures
// FeedSacks.tsx lays out: for each of the four stalls its backdrop and its awning's edge, then the three crates, the
// three sacks as they stand in them, and the lantern. Photographed through ?preview=stall into public/shop/stall.
// Run with the dev server up:  node tools/renderStall.mjs [--base http://localhost:5173/steal-a-poop/] [--only wide,crate-bomb]
// Re-run after changing the stall's model or its plan, and commit the pictures.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const only = arg('only', '').split(',').filter(Boolean);
// Each stall is baked about twice as wide as it is ever shown.
const WIDTHS = { wide: 2176, low: 2176, mid: 1480, narrow: 920 };
const shots = [];
for (const [size, width] of Object.entries(WIDTHS)) {
  shots.push({ name: size, query: `size=${size}&layer=back`, width });
  shots.push({ name: `${size}-valance`, query: `size=${size}&layer=valance`, width });
}
for (const sack of ['bomb', 'blast', 'tick']) {
  shots.push({ name: `crate-${sack}`, query: `layer=crate-${sack}`, width: 560 });
  shots.push({ name: `sack-${sack}`, query: `layer=sack-${sack}`, width: 560 });
}
shots.push({ name: 'lantern', query: 'layer=lantern', width: 160 });

mkdirSync('public/shop/stall', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
try {
  for (const { name, query, width } of shots) {
    if (only.length && !only.some((o) => name === o || name.startsWith(`${o}-`))) continue;
    const page = await browser.newPage({ viewport: { width, height: 400 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(`${base}?preview=stall&${query}`);
    await page.waitForFunction(() => window.__stallBox, null, { timeout: 30000 });
    const box = await page.evaluate(() => window.__stallBox);
    const height = Math.round((width * box.h) / box.w);
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.waitForFunction(() => window.__stallReady, null, { timeout: 60000 });
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.92));
    if (!data.startsWith('data:image/webp')) throw new Error(`${name}: the browser did not encode WebP`);
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`public/shop/stall/${name}.webp`, bytes);
    console.log(`${name}: ${width} x ${height}, ${Math.round(bytes.length / 1024)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
