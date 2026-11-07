/**
 * Contact sheets for the farm kit milestones (docs/REDESIGN_PLAN_V6_UI.md Parts 3.3 and 7.10): every screen state of the
 * painted skin at 1920 x 1080 and 390 x 844, taken from the running dev server.
 *
 *   npm run dev                                   (painted, with VITE_SERVER_URL for the rooms screens)
 *   node scripts/ui-contact-sheets.mjs before     (writes docs/skin/ui-v6/before/<size>/<state>.jpg)
 *
 * BASE_URL picks another server (default http://localhost:5173/steal-a-poop/), PW_CHROMIUM an installed Chrome. Math.random
 * is seeded so games deal the same way each run; states the game only reaches by chance (a steal window, a trap, the
 * tally, the end) are set through the store, which the dev server exposes as a module. A state that cannot be reached
 * is skipped and listed at the end.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const name = process.argv[2] ?? 'before';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173/steal-a-poop/';
const OUT = join('docs', 'skin', 'ui-v6', name);
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const SIZES = { desktop: { width: 1920, height: 1080, mobile: false }, phone: { width: 390, height: 844, mobile: true } };

const seeded = () => {
  let s = 20261107;
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  localStorage.setItem('sap:tourDone', 'true');
  localStorage.setItem('sap:settings', JSON.stringify({ name: 'Brian', practice: { clock: 15, difficulty: 'easy' } }));
};

const ready = (page) => page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Start now/.test(b.textContent ?? '') && !b.disabled), null, { timeout: 60000 });
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
/** The store module, as the app loaded it (dev server only). */
const store = (page, fn) => page.evaluate(async (body) => {
  // The dev server may have served the store under more than one URL; the live one is the one holding the game.
  const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/src/state/store.ts'));
  let useStore;
  for (const url of urls.reverse()) { ({ useStore } = await import(url)); if (useStore.getState().game || useStore.getState().dict) break; }
  return new Function('useStore', body)(useStore);
}, fn);
const home = async (page, query = '?pov=0') => { await page.goto(BASE + query); await ready(page); await settle(page, 2500); };
const click = (page, role, nameRe) => page.getByRole(role, { name: nameRe }).first().click({ timeout: 8000 });

async function game(page, how = 'Start now') {
  await home(page, '');
  await click(page, 'button', new RegExp(`^${how}`));
  // The word bar, not a button called Play: Home's menu has one of those too.
  await page.getByLabel(/^Type a word/).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.sk-input-go')].some((b) => !b.disabled), null, { timeout: 20000 });
  await settle(page, 600);
}
/** Change the live game and hold the clock, so the frame stays put for the picture. */
const pin = (page, body) => store(page, `const s = useStore.getState(); const g = structuredClone(s.game); ${body}; useStore.setState({ game: g }); useStore.getState().pause();`);

const STATES = {
  'home-tables': (p) => home(p),
  'home-setup': async (p) => { await home(p); await click(p, 'button', /^Play$/); await settle(p, 800); },
  'home-practice': async (p) => { await home(p); await click(p, 'button', /^Practice/); await settle(p, 800); },
  'home-help': async (p) => { await home(p); await click(p, 'button', /^How to Play$/); await settle(p, 800); },
  'home-settings': async (p) => { await home(p); await click(p, 'button', /^Settings$/); await settle(p, 800); },
  'home-avatar': async (p) => { await home(p); await click(p, 'button', /^Avatar$/); await settle(p, 800); },
  'home-admin': async (p) => { await home(p); await click(p, 'button', /^Admin/); await settle(p, 800); },
  'home-account': async (p) => { await home(p); await click(p, 'button', /^Account$/); await settle(p, 800); },
  'home-credits': async (p) => { await home(p); await click(p, 'button', /^Settings$/); await click(p, 'button', /Credits/); await settle(p, 800); },
  'home-feedback': async (p) => { await home(p); await p.getByText('Feedback', { exact: true }).first().click({ timeout: 8000 }); await settle(p, 800); },
  'home-legal': async (p) => { await home(p); await p.getByText('Privacy policy', { exact: true }).first().click({ timeout: 8000 }); await settle(p, 800); },
  'table-your-turn': (p) => game(p),
  'table-bot-turn': async (p) => {
    await game(p);
    await store(p, "const s = useStore.getState(); const w = s.dict.startingWith(s.game.chainLetter).find((x) => x.length >= 5); s.act({ type: 'play', seat: 0, word: w });");
    await settle(p, 900);
  },
  'table-steal-window': async (p) => {
    await game(p);
    await pin(p, 'g.turn = { ...g.turn, seat: 1, stealable: true, botActAt: null, stealPlans: [], endsAt: s.now + 1500, durationMs: 10000, startedAt: s.now - 8500 }');
    await settle(p, 500);
  },
  'table-trap': async (p) => { await game(p); await pin(p, "g.chainLetter = 'x'; g.trap = { trapperSeat: 1, victimSeat: 0, letter: 'x' }"); await settle(p, 500); },
  'table-tally': async (p) => { await game(p); await pin(p, "g.phase = 'intro'; g.round = 2; g.introEndsAt = s.now + 600000; g.turn = null; g.players[2].lives = 1; g.players[3].lives = 0; g.players[3].frozen = true; g.players[3].frozenAt = 1"); await settle(p, 900); },
  'table-end': async (p) => {
    await game(p);
    await pin(p, "g.phase = 'gameOver'; g.turn = null; g.winners = [1]; g.players.forEach((q, i) => { if (i !== 1) { q.lives = 0; q.frozen = true; q.frozenAt = i; } }); g.players[0].steals = 2; g.players[0].longestWord = 'tabanid'");
    await settle(p, 1500);
  },
  'table-leave': async (p) => { await game(p); await click(p, 'button', /^Leave game$/); await settle(p, 500); },
  'table-sheet-rules': async (p) => { await game(p); await click(p, 'button', /^How to play$/); await settle(p, 500); },
  'table-sheet-chain': async (p) => { await game(p); await click(p, 'button', /^Chain history$/); await settle(p, 500); },
  'duel-running': async (p) => { await home(p, ''); await click(p, 'button', /^Practice/); await click(p, 'button', /^Start run$/); await settle(p, 3500); },
  'duel-run-over': async (p) => {
    await home(p, ''); await click(p, 'button', /^Practice/); await click(p, 'button', /^5 s$/); await click(p, 'button', /^Start run$/);
    await p.getByRole('dialog', { name: 'Run over' }).waitFor({ timeout: 30000 }); await settle(p, 1200);
  },
  'dream-ready': async (p) => { await home(p, ''); await click(p, 'button', /^Counting Sheep/); await settle(p, 4000); },
  'dream-running': async (p) => { await home(p, ''); await click(p, 'button', /^Counting Sheep/); await settle(p, 3000); await p.keyboard.press('Space'); await settle(p, 3500); },
  'dream-bump': async (p) => {
    await home(p, ''); await click(p, 'button', /^Counting Sheep/); await settle(p, 3000); await p.keyboard.press('Space');
    await p.getByText(/bump/i).first().waitFor({ timeout: 40000 }); await settle(p, 400);
  },
  'dream-results': async (p) => {
    await home(p, ''); await click(p, 'button', /^Counting Sheep/); await settle(p, 3000); await p.keyboard.press('Space');
    await p.getByRole('button', { name: /Back to the farm|Share/ }).first().waitFor({ timeout: 150000 }); await settle(p, 3000);
  },
  'rooms-lobby': async (p) => { await home(p); await click(p, 'button', /^Play with friends/); await settle(p, 1500); },
  'rooms-room': async (p) => { await home(p); await click(p, 'button', /^Play with friends/); await settle(p, 1500); await click(p, 'button', /^Create$/); await settle(p, 1500); },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const skipped = [];
for (const [size, v] of Object.entries(SIZES)) {
  mkdirSync(join(OUT, size), { recursive: true });
  for (const [state, run] of Object.entries(STATES).filter(([s]) => !ONLY.length || ONLY.includes(s))) {
    const context = await browser.newContext({ viewport: { width: v.width, height: v.height }, isMobile: v.mobile, hasTouch: v.mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(seeded);
    try {
      await run(page);
      await page.screenshot({ path: join(OUT, size, `${state}.jpg`), type: 'jpeg', quality: 80 });
      console.log(`${size}/${state}`);
    } catch (e) {
      skipped.push(`${size}/${state}: ${String(e.message ?? e).split('\n')[0]}`);
      console.log(`skipped ${size}/${state}`);
    }
    await context.close();
  }
}
await browser.close();
if (skipped.length) console.log(`\nSkipped:\n${skipped.join('\n')}`);
