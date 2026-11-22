// Bakes the Queue chooser's pictures (src/skin/ranked/PlayChooser.tsx), all drawn as pixel art by tools/art/playArt.js
// and scaled up by whole pixels (nearest neighbour, PLAY_ART.SCALE), lossless WebP so no pixel blurs into the next:
// public/play/casual.webp (the snow day), casual-snow.webp (a tile of falling snow, clear round the flakes), ranked.webp
// (the night rink) and ranked-flash.webp (the second frame of what twinkles there, clear elsewhere).
// Needs no dev server:  node tools/renderPlayArt.mjs   (PW_CHROMIUM: an installed Chromium, as for npm run e2e)
// Re-run after changing tools/art/playArt.js, and commit the pictures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

export const LAYERS = ['casual', 'casual-snow', 'ranked', 'ranked-flash'];

mkdirSync('public/play', { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const write = (file, data) => {
  if (!data.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(file, bytes);
  console.log(`${file}: ${Math.round(bytes.length / 1024)} KB`);
};
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: readFileSync('tools/art/playArt.js', 'utf8') });
  for (const name of LAYERS) {
    const data = await page.evaluate((name) => {
      const art = drawPlayArt(name), k = PLAY_ART.SCALE;
      const out = document.createElement('canvas');
      out.width = art.width * k; out.height = art.height * k;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, 0, 0, out.width, out.height);
      return out.toDataURL('image/webp', 1);
    }, name);
    write(`public/play/${name}.webp`, data);
  }
} finally {
  await browser.close();
}

// The bake manifest (plan file 18, section 4.5): what was just baked is stamped, so `npm test` knows these are the
// pictures today's drawing code and tool make.
{
  const { execFileSync } = await import('node:child_process');
  const ids = LAYERS.map((n) => `play/${n}`).join(',');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/bakeStamp.ts', '--', '--only', ids], { stdio: 'inherit' });
}
