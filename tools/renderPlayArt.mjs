// Bakes the Queue chooser's two pictures (src/skin/ranked/PlayChooser.tsx):
//  - public/play/casual.webp from tools/art/playArt.js, which draws it as pixel art, scaled up by whole pixels
//    (nearest neighbour, PLAY_ART.SCALE) and encoded as lossless WebP so no pixel blurs into the next;
//  - public/play/ranked.webp from Brian's own picture, tools/art/ranked-source.webp (1024 x 1024; 2026-11-21: "just use
//    this image but crop it"): the band RANKED_CROP.y to y + 640 at full width, 1024 x 640 (16:10), WebP at 0.9.
// Needs no dev server:  node tools/renderPlayArt.mjs
// Re-run after changing tools/art/playArt.js, and commit the pictures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('public/play', { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); // PW_CHROMIUM: an installed Chromium, as for npm run e2e
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: readFileSync('tools/art/playArt.js', 'utf8') });
  const RANKED_CROP = { y: 140, width: 1024, height: 640 };
  const source = `data:image/webp;base64,${readFileSync('tools/art/ranked-source.webp').toString('base64')}`;
  const ranked = await page.evaluate(async ({ source, crop }) => {
    const img = new Image();
    img.src = source;
    await img.decode();
    const out = document.createElement('canvas');
    out.width = crop.width; out.height = crop.height;
    out.getContext('2d').drawImage(img, 0, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return out.toDataURL('image/webp', 0.9);
  }, { source, crop: RANKED_CROP });
  for (const name of ['casual']) {
    const data = await page.evaluate((name) => {
      const art = drawPlayArt(name), k = PLAY_ART.SCALE;
      const out = document.createElement('canvas');
      out.width = art.width * k; out.height = art.height * k;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 0, 0, out.width, out.height);
      return out.toDataURL('image/webp', 1);
    }, name);
    if (!data.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`public/play/${name}.webp`, bytes);
    console.log(`play/${name}: ${Math.round(bytes.length / 1024)} KB`);
  }
  if (!ranked.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
  const rankedBytes = Buffer.from(ranked.split(',')[1], 'base64');
  writeFileSync('public/play/ranked.webp', rankedBytes);
  console.log(`play/ranked: ${Math.round(rankedBytes.length / 1024)} KB`);
} finally {
  await browser.close();
}

// The bake manifest (plan file 18, section 4.5): what was just baked is stamped, so `npm test` knows this is the
// picture today's drawing code and tool make.
{
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/bakeStamp.ts', '--', '--only', 'play/casual,play/ranked'], { stdio: 'inherit' });
}
