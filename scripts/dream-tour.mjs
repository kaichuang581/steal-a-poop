/**
 * Plays a whole night of Counting Sheep and photographs every part of it, start to finish:
 *   node scripts/dream-tour.mjs <desktop|phone> [outDir]
 * Two runs: the main night (an 8-night streak with two Warm Blankets, so the results show the quilts) clears fences
 * with the dream's own hint words, shows a wrong word, a hint, a deliberate bump, hay bales and the late, fast fences,
 * and ends with the farmer asleep; the second night is all bumps, so the farmer wakes up. Then practice and the menu.
 * BASE_URL picks the server (default the local dev server), PW_CHROMIUM an installed Chrome.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const size = process.argv[2] ?? 'desktop';
const OUT = join(process.argv[3] ?? join('docs', 'skin', 'ui-v6', 'dream-tour'), size);
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/steal-a-poop/';
const V = size === 'phone' ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let n = 0;
const shot = async (page, name) => {
  const file = `${String(++n).padStart(2, '0')}-${name}.jpg`;
  await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 82 });
  console.log(size, file);
};

/** A fresh profile: Brian, tour done, and (for the main night) an 8-night streak ending yesterday with two blankets. */
async function open(streak) {
  const context = await browser.newContext({ viewport: { width: V.width, height: V.height }, isMobile: !!V.isMobile, hasTouch: !!V.hasTouch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript((s) => {
    localStorage.setItem('sap:tourDone', 'true');
    localStorage.setItem('sap:settings', JSON.stringify({ name: 'Brian' }));
    if (s) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem('sap:dream-streak', JSON.stringify({ count: 8, last: key, best: 8, blankets: 2, earnedAt: 7 }));
    }
  }, streak);
  await page.goto(BASE + '?pov=0');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Start now/.test(b.textContent ?? '') && !b.disabled), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  return { context, page };
}

/** The dream's own modules, as the dev server serves them: tonight's seed, its fences and hint words. */
const dreamApi = (page, body) => page.evaluate(async (b) => {
  const base = location.pathname.replace(/\/$/, '');
  const d = await import(`${base}/src/dream/dream.ts`);
  const t = await import(`${base}/src/skin/hooks/useToday.ts`);
  return new Function('d', 't', b)(d, t);
}, body);
const slipText = (page) => page.evaluate(() => document.querySelector('.dr-placeholder')?.textContent ?? '');
const phase = (page) => page.evaluate(() => document.querySelector('.dr-root')?.getAttribute('data-phase') ?? '');

/** Waits until fence `i` is open for typing (its letters on the slip), or the night ends. */
async function waitOpen(page, letters, ms = 20000) {
  const want = `a word with ${letters.map((l) => l.toUpperCase()).join(', then ')}`;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const p = await phase(page);
    if (p === 'results' || p === 'crashed' || p === 'drifting') return false;
    if ((await slipText(page)) === want) return true;
    await page.waitForTimeout(60);
  }
  return false;
}

async function mainNight() {
  const { context, page } = await open(true);
  await shot(page, 'home-menu');
  await page.getByRole('button', { name: /^Counting Sheep/ }).first().click();
  await page.waitForTimeout(700);
  await shot(page, 'swoop-in');
  await page.waitForTimeout(2800);
  await shot(page, 'ready');
  const fences = await dreamApi(page, "const seed = d.dreamSeed(t.localDateKey(new Date())); return Array.from({ length: d.DREAM_LENGTH.fences }, (_, i) => { const f = d.fenceAt(seed, i); return { letters: f.letters, kind: d.obstacleAt(seed, i).kind ?? d.obstacleAt(seed, i) }; });");
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await shot(page, 'running');
  const used = [];
  const shotAt = new Set();
  let i = 0;
  // After a word is taken the slip keeps that fence's letters until the sheep jumps it, while typing already goes to the
  // next fence: never act twice on the same slip (unless it stays put, when two fences in a row ask the same letters).
  let acted = '', actedAt = 0;
  // Read which fence is open from the slip ("a word with A, then N"), so the script never falls behind the sheep.
  while (i < fences.length) {
    if ((await phase(page)) !== 'running') break;
    const text = await slipText(page);
    if (!text.startsWith('a word with ') || (text === acted && Date.now() - actedAt < 2500)) { await page.waitForTimeout(40); continue; }
    const letters = text.slice('a word with '.length).toLowerCase().split(', then ');
    let j = i;
    while (j < fences.length && fences[j].letters.join() !== letters.join()) j++;
    if (j >= fences.length) { await page.waitForTimeout(40); continue; }
    i = j;
    acted = text; actedAt = Date.now();
    const word = await dreamApi(page, `const seed = d.dreamSeed(t.localDateKey(new Date())); return d.hintWord(d.fenceAt(seed, ${i}), new Set(${JSON.stringify(used)}));`);
    if (i === 0 && !shotAt.has('typing')) {
      shotAt.add('typing');
      await shot(page, 'fence-open');
      await page.keyboard.type(word.slice(0, Math.ceil(word.length / 2)));
      await page.waitForTimeout(150);
      await shot(page, 'typing');
      await page.keyboard.type(word.slice(Math.ceil(word.length / 2)));
      await page.keyboard.press('Enter');
      used.push(word);
      await page.waitForTimeout(250);
      await shot(page, 'word-taken');
      await page.waitForTimeout(900);
      await shot(page, 'jump');
      i++;
      continue;
    }
    if (i === 1 && !shotAt.has('wrong')) {
      // A word that is not a word: the bar shakes it off.
      shotAt.add('wrong');
      await page.keyboard.type('zqx');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(120);
      await shot(page, 'wrong-word');
      await page.waitForTimeout(400);
      for (let k = 0; k < 3; k++) await page.keyboard.press('Backspace');
      await page.waitForTimeout(80);
    }
    if (i === 2 && !shotAt.has('hint')) {
      // Wait for the hint: after 3.2 s with nothing typed the dream offers a word.
      shotAt.add('hint');
      await page.waitForTimeout(3500);
      await shot(page, 'hint');
    }
    if (i === 5 && !shotAt.has('bump')) {
      // Miss one on purpose: the bump holds the sheep and knocks the fence flat.
      shotAt.add('bump');
      await page.getByText(/bump/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(150);
      await shot(page, 'bump');
      await page.waitForTimeout(1500);
      await shot(page, 'after-bump');
      i++;
      continue;
    }
    if (fences[i].kind === 'bale' && !shotAt.has('bale')) { shotAt.add('bale'); await shot(page, 'first-hay-bale'); }
    if (i >= 18 && !shotAt.has('late')) { shotAt.add('late'); await shot(page, 'late-fences'); }
    if (i === fences.length - 1) await shot(page, 'last-fence');
    await page.keyboard.type(word);
    await page.keyboard.press('Enter');
    used.push(word);
    i++;
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.querySelector('.dr-root')?.getAttribute('data-phase') !== 'running', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await shot(page, 'falling-asleep');
  await page.getByRole('button', { name: /^Share$|^Copied!$/ }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot(page, 'results-asleep');
  await page.getByRole('button', { name: 'Back to the farm' }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, 'home-after-dream');
  await context.close();
}

async function wokenNight() {
  const { context, page } = await open(false);
  await page.getByRole('button', { name: /^Counting Sheep/ }).first().click();
  await page.waitForTimeout(3500);
  await page.keyboard.press('Space');
  // Type nothing: every fence bumps, and the third wakes the farmer.
  await page.waitForFunction(() => document.querySelector('.dr-root')?.getAttribute('data-phase') !== 'running', null, { timeout: 120000 });
  await page.waitForTimeout(500);
  await shot(page, 'waking-up');
  await page.getByRole('button', { name: /^Share$|^Copied!$/ }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot(page, 'results-woken');
  // Practice from the results: the endless version, which ends on the first bump.
  await page.getByRole('button', { name: /^Practice$/ }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, 'practice-ready');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('.dr-root')?.getAttribute('data-phase') !== 'running' && document.querySelector('.dr-root')?.getAttribute('data-phase') !== 'ready', null, { timeout: 120000 });
  await page.getByRole('button', { name: /^Share$|^Copied!$|^Practice$/ }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot(page, 'practice-results');
  await context.close();
}

try {
  await mainNight();
  await wokenNight();
} finally {
  await browser.close();
}
