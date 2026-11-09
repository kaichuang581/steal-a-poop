// Bakes the loading screen's barn doors (src/skin/loading/doorsModel.ts) into the images BarnDoors.tsx shows.
// Run with the dev server up:  node tools/renderDoors.mjs [--base http://localhost:5173/steal-a-poop/] [--width 2048]
// Writes public/loading/doors-leaves.webp, doors-lintel.webp and doors-sill.webp. Re-run after changing the model.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const width = Number(arg('width', 2048));
const quality = Number(arg('quality', 0.88));

mkdirSync('public/loading', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--use-gl=angle'] });
try {
  for (const part of ['leaves', 'lintel', 'sill']) {
    const url = `${base}?preview=doors&part=${part}`;
    const page = await browser.newPage({ viewport: { width, height: 400 } });
    await page.goto(url);
    await page.waitForFunction(() => window.__doorsBox, null, { timeout: 30000 });
    const box = await page.evaluate(() => window.__doorsBox);
    const height = Math.round((width * box.h) / box.w);
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.waitForFunction(() => window.__doorsReady, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const data = await page.evaluate((q) => document.querySelector('canvas').toDataURL('image/webp', q), quality);
    if (!data.startsWith('data:image/webp')) throw new Error(`${part}: the browser did not encode WebP`);
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`public/loading/doors-${part}.webp`, bytes);
    console.log(`${part}: ${width} x ${height} (${box.w} x ${box.h} voxels), ${Math.round(bytes.length / 1024)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
