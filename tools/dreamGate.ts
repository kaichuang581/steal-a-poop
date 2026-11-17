/**
 * The dream's pictures (plan file 09, 4.1 and 4.7). Opens Counting Sheep in practice with a fixed seed at each size and
 * photographs it at its ready sign and with the first fence moved on screen, for the milestone's before-and-after pairs.
 * V4.1's 32 sampled gates, read through the perspective camera, were retired with that camera in milestone 9: the side
 * view's numbers are unit tests now (src/skin/dream/__tests__/sideOn.test.ts) and its pixel gates are milestone 12's.
 * Run it against a dev server:
 *
 *   npx vite-node tools/dreamGate.ts -- --base http://localhost:5173/steal-a-poop/ [--shots 1280x800,390x844] [--fence 160] [--out dir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const arg = (name: string, fallback = '') => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? '' : fallback; };
const BASE = arg('base', 'http://localhost:5173/steal-a-poop/');
const OUT = arg('out', 'test-results/dream-gate');

/** The first-visit form (src/skin/onboarding/gate.ts, AGE_CHECK_KEY) dims every shot unless it was answered before load. */
const AGE_CHECK = `try { localStorage.setItem('sap:age-check', JSON.stringify({ country: 'GB', age: 30, parent: false, at: 1 })); } catch {}`;

/** Opens the practice dream at its ready sign. */
async function openDream(page: Page) {
  await page.addInitScript(AGE_CHECK);
  await page.goto(`${BASE}?dreamSeed=1&dev=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.sk-menu-item') && !document.body.textContent?.includes('Loading…'), null, { timeout: 90000 });
  // A string, so the runner does not rewrite the browser's import().
  await page.evaluate(`(async () => {
    const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/skin/dream/dreamStore.ts'));
    (await import(url)).useDreamUi.getState().openDream(true);
  })()`);
  await page.waitForSelector('.dr-root[data-phase="ready"] canvas', { timeout: 90000 });
}

/**
 * `--shots` (the six sizes of plan file 09, 4.7, unless given) and `--fence 160`. At each size: the ready sign
 * (`<size>-ready.png`), then the first fence moved to logical x `--fence` while the run is still held at ready
 * (`<size>-fence.png`), then Esc, which must leave without an error. Sizes narrower than 640 are opened as a touch phone.
 */
const SHOTS = arg('shots', '1280x800,1920x1080,1024x768,844x390,390x844,390x450').split(',').filter(Boolean);
const LAUNCH = { ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] };
{
  const fenceX = Number(arg('fence', '160'));
  const browser = await chromium.launch(LAUNCH);
  mkdirSync(OUT, { recursive: true });
  for (const size of SHOTS) {
    const [w, h] = size.split('x').map(Number);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 640, isMobile: w < 640 });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.message} @ ${(e.stack ?? '').split('\n').slice(1, 9).join(' < ')}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
    await openDream(page);
    await page.waitForTimeout(7000);
    writeFileSync(join(OUT, `${size}-ready.png`), await page.screenshot({ type: 'png' }));
    await page.evaluate((x) => {
      const L = (window as unknown as { __dreamLive?: { current: { fences: { x: number }[] } } }).__dreamLive;
      if (L) L.current.fences[0].x = x;
    }, fenceX);
    await page.waitForTimeout(4000);
    writeFileSync(join(OUT, `${size}-fence.png`), await page.screenshot({ type: 'png' }));
    // The bubble's canvas must fill its parent and have no transformed ancestor (plan file 09, 4.5).
    const facts = await page.evaluate(() => {
      const c = document.querySelector('.dr-bubble canvas');
      let transformed = 'none';
      for (let e = c?.parentElement ?? null; e; e = e.parentElement) if (getComputedStyle(e).transform !== 'none') { transformed = e.className || e.tagName; break; }
      const r = c?.getBoundingClientRect(), p = c?.parentElement?.getBoundingClientRect();
      return { transformed, fit: r && p ? `${(r.width - p.width).toFixed(1)},${(r.height - p.height).toFixed(1)}` : 'none' };
    });
    const stats = await page.evaluate(() => document.getElementById('sk-dev')?.textContent ?? '');
    // Leaving the dream (Esc) must not throw as the screen unmounts.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);
    console.log(`${size}: ${errors.length ? errors.join(' | ') : 'no page errors'}; ${stats}; ${JSON.stringify(facts)}`);
    await ctx.close();
  }
  await browser.close();
  process.exit(0);
}
