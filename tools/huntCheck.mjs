// The Hunt v7 acceptance run (docs/REDESIGN_PLAN_V7_HUNT.md Part 10): plays seeded packs in a real browser against a dev
// server and saves the screenshots the plan asks for. Each run is driven by a replica of the pure run kept in the page
// (the same src/hunt modules, the same seed), so the script always knows a legal word, a rule-breaking word and the HP.
//   node tools/huntCheck.mjs --base http://localhost:5173/steal-a-poop/ [--out docs/skin/hunt-v7] [--only lobby,deaths,...]
// Sections: lobby, link, same, deaths, timeout, run, leave, dex, save, phone. Exits 1 if any check fails.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'http://localhost:5173/steal-a-poop/');
const out = arg('out', 'docs/skin/hunt-v7');
const only = arg('only')?.split(',');
const want = (s) => !only || only.includes(s);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
const VERSION_DIGIT = '1';
const CODE = `K7QX${VERSION_DIGIT}`;

async function page({ w = 1280, h = 800, ctx } = {}) {
  const context = ctx ?? await browser.newContext({ viewport: { width: w, height: h } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.addInitScript(() => {
    if (sessionStorage.getItem('hunt-check')) return;
    sessionStorage.setItem('hunt-check', '1');
    localStorage.setItem('sap:tourDone', 'true');
    localStorage.setItem('sap:record', JSON.stringify({ played: 5, results: [] }));
    localStorage.setItem('sap:settings', JSON.stringify({ name: 'Brian' }));
  });
  return p;
}
const shot = (p, name) => p.locator('.gb-frame').screenshot({ path: `${out}/${name}.png` });
const mode = (p) => p.evaluate(() => document.querySelector('.gb-root')?.getAttribute('data-mode') ?? null);
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);
/** Imports one of the app's modules by its source path (dev server only). */
const MOD = `(n) => import(performance.getEntriesByType('resource').map((r) => r.name).find((x) => x.includes(n)))`;

async function home(p, query = '') {
  await p.goto(`${base}${query}`, { waitUntil: 'load' });
  await p.waitForFunction(() => !!document.querySelector('.sk-menu-item, .gb-root'), null, { timeout: 120000 });
  await p.waitForTimeout(800);
}
async function openHunt(p) {
  await p.evaluate(`(${MOD})('/src/skin/hunt/huntStore.ts').then((m) => m.useHuntUi.getState().openHunt())`);
  await p.waitForSelector('.gb-lobby-box, .gb-foe', { timeout: 60000 });
}
/** Keeps a copy of the run in the page: the same modules and seed as the screen. */
async function replica(p, code) {
  await p.evaluate(`(async () => {
    const mod = ${MOD};
    const H = await mod('/src/hunt/hunt.ts'), C = await mod('/src/hunt/codes.ts'), S = await mod('/src/state/store.ts'), R = await mod('/src/hunt/rules.ts');
    const dict = S.useStore.getState().dict;
    const state = { r: H.startRun(dict, C.seedOf(${JSON.stringify(code)})) };
    const apply = (o) => { state.r = o.outcome.kind === 'hit' && o.outcome.defeated && !o.run.over ? o.run : o.run; return o; };
    window.__rep = {
      get run() { return state.r; },
      hint() { return H.hintWord(state.r, dict); },
      /** A real word that breaks a rule in force. */
      breaker() {
        const { rules } = H.activeRules(state.r, dict);
        for (const r of rules) { const ex = state.r.predator.examples[r.id]; if (ex && ex.no && !ex.no.includes(' ') && dict.has(ex.no) && R.brokenRule(ex.no, rules, { prev: state.r.prev })) return ex.no; }
        for (const w of ['xylophone', 'cat', 'sheep', 'garden', 'zoo']) if (R.brokenRule(w, rules, { prev: state.r.prev })) return w;
        return null;
      },
      /** The weakest legal word: short and common, so the predator lives through it. */
      weak() {
        const { rules } = H.activeRules(state.r, dict);
        const used = new Set(state.r.used);
        let best = null, dmg = Infinity;
        for (const l of 'abcdefghijklmnopqrstuvwxyz') for (const w of dict.startingWith(l)) {
          if (w.length < 3 || w.length > 6 || used.has(w) || R.brokenRule(w, rules, { prev: state.r.prev })) continue;
          const d = H.damageFor(w, rules.length).damage;
          if (d < dmg) { dmg = d; best = w; }
        }
        return best;
      },
      attack(w) { return apply(H.attack(state.r, dict, w)).outcome.kind; },
      item(id) { return apply(H.applyItem(state.r, dict, id)).outcome.kind; },
      timeout() { apply(H.timeOut(state.r)); },
      next() { state.r = H.nextPredator(state.r, dict); },
    };
  })()`);
}
const rep = (p, expr) => p.evaluate(`window.__rep.${expr}`);

/** Presses through messages until the screen is in one of `modes`. */
async function until(p, modes, { skip = true, timeout = 60000 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const m = await mode(p);
    if (modes.includes(m)) return m;
    if (Date.now() > end) throw new Error(`waited for ${modes} but the screen is ${m}`);
    if (skip && m === 'steps') await p.keyboard.press('Enter');
    await p.waitForTimeout(m === 'announce' ? 300 : 120);
  }
}
/** At the battle menu: FIGHT, type, submit. */
async function fight(p, word) {
  await until(p, ['menu']);
  await p.keyboard.press('Enter');
  await p.waitForSelector('.gb-moves');
  await p.keyboard.type(word, { delay: 15 });
  await p.keyboard.press('Enter');
}
async function bag(p, index) {
  await until(p, ['menu']);
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  for (let i = 0; i < index; i++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
}
/** After a predator fainted: the screen moves on (or asks to walk home); the replica follows. */
async function afterFaint(p, walk) {
  const m = await until(p, ['menu', 'announce', 'walk', 'death']);
  if (m === 'walk') {
    if (walk) return 'walk';
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  }
  await rep(p, 'next()');
  return 'next';
}
/** Plays legal hint words (with milk when low) until `stop(run)` or the run ends. Records each predator's first look. */
async function play(p, { stop, walk = false, seen = [] } = {}) {
  for (let turn = 0; turn < 400; turn++) {
    const r = await rep(p, 'run');
    if (r.over) return 'over';
    if (stop?.(r)) return 'stopped';
    const m = await until(p, ['menu', 'walk', 'death']);
    if (m === 'death') return 'death';
    if (!seen[r.index]) seen[r.index] = { name: await text(p, '.gb-box-foe .gb-row span'), tags: await text(p, '.gb-tags') };
    if (r.hp < r.predator.attack * 2.2 && r.items.milk > 0 && r.hp < r.maxHp - 20) { await rep(p, "item('milk')"); await bag(p, 0); continue; }
    if (r.predator.boss && r.items.pepper > 0 && !r.peppered) { await rep(p, "item('pepper')"); await bag(p, 2); continue; }
    const word = await rep(p, 'hint()');
    const before = r.index;
    const kind = await rep(p, `attack(${JSON.stringify(word)})`);
    await fight(p, word);
    const after = await rep(p, 'run');
    if (kind === 'hit' && after.predator.hp === 0 && !after.over) {
      const res = await afterFaint(p, walk && after.predator.boss);
      if (res === 'walk') return 'walk';
    }
    if (after.over) return 'over';
    void before;
  }
  return 'limit';
}

// ---------------------------------------------------------------------------------------------------------------
if (want('lobby')) {
  const p = await page();
  await home(p);
  await openHunt(p);
  await p.waitForTimeout(600);
  check((await mode(p)) === 'lobby', 'opening the Hunt shows the lobby, not a fight');
  await p.waitForTimeout(2500);
  check((await mode(p)) === 'lobby' && !(await p.$('.gb-clock')), 'nothing starts and no clock runs on the lobby');
  await shot(p, 'lobby');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  await p.waitForSelector('.gb-code');
  await p.keyboard.type('k7-qx', { delay: 20 });
  await p.waitForTimeout(200);
  check((await text(p, '.gb-code-boxes')) === 'K7QX', 'code boxes upper-case and drop the dash');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  check((await text(p, '.gb-code')).includes("That's not a pack code."), 'a short code is refused with the plan\'s words');
  await shot(p, 'code-bad');
  await p.keyboard.type('2', { delay: 20 });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(400);
  check((await text(p, '.gb-code')).includes('older word list'), 'a code from another word list shows the notice first');
  await shot(p, 'code-stale');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await until(p, ['announce', 'steps'], { skip: false });
  check((await text(p, '.gb-packline')).includes('old list'), 'a stale code fought anyway is marked old list');
  check(p.errors.length === 0, `no page errors (${p.errors.join(' | ')})`);
  await p.context().close();
}

if (want('link')) {
  const p = await page();
  await home(p, `?pack=${CODE.toLowerCase()}`);
  await p.waitForSelector('.gb-foe', { timeout: 60000 });
  check(!p.url().includes('pack='), '?pack= is read once and removed from the address');
  check((await text(p, '.gb-packline')).includes(`PACK ${CODE}`), '?pack= opens that code straight into its fight');
  await until(p, ['announce'], { skip: true });
  await p.waitForTimeout(1500);
  await shot(p, 'announce');
  await p.context().close();
}

if (want('same')) {
  const seen = [];
  for (const k of [0, 1]) {
    const p = await page();
    await home(p, `?pack=${CODE}`);
    await p.waitForSelector('.gb-foe', { timeout: 60000 });
    await replica(p, CODE);
    const s = [];
    await play(p, { stop: (r) => r.index >= 3, seen: s });
    seen.push(s.slice(0, 3));
    if (k === 0) {
      await until(p, ['announce']);
      await p.waitForTimeout(BEAT_MS(4));
      await shot(p, 'announce-later');
      await until(p, ['menu']);
      await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
      await p.waitForSelector('.gb-rulecards');
      await p.waitForTimeout(500);
      await shot(p, 'rules-cards');
      check((await p.$$('.gb-rulecards .gb-card')).length >= 3, 'RULES shows a card per rule in force, and the ? card');
      await p.keyboard.press('Escape');
      const r = await rep(p, 'run');
      const bad = await rep(p, 'breaker()');
      await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter');
      await p.waitForSelector('.gb-moves');
      await p.keyboard.type(bad, { delay: 15 });
      await p.waitForTimeout(200);
      check((await text(p, '.gb-note')).startsWith('breaks:') && !!(await p.$('.gb-tags li[data-broken]')), `the live check names the broken rule and turns its tag red (${bad})`);
      await shot(p, 'live-check');
      void r;
    }
    await p.context().close();
  }
  check(JSON.stringify(seen[0]) === JSON.stringify(seen[1]) && seen[0].length === 3, `two browsers see the same first three predators and rules: ${JSON.stringify(seen[0])}`);
}
function BEAT_MS(n) { return 480 * n; }

if (want('deaths')) {
  // A broken rule.
  {
    const p = await page();
    await home(p, `?pack=${CODE}`);
    await p.waitForSelector('.gb-foe', { timeout: 60000 });
    await replica(p, CODE);
    for (let i = 0; i < 40; i++) {
      const r = await rep(p, 'run');
      if (r.over) break;
      const w = await rep(p, 'breaker()');
      await rep(p, `attack(${JSON.stringify(w)})`);
      await fight(p, w);
    }
    await until(p, ['death']);
    await p.waitForTimeout(400);
    const t = await text(p, '.gb-death');
    check(t.includes('A broken rule:') && t.includes('You typed'), `the death screen names a broken rule (${t.slice(0, 90)})`);
    check(/would have done\./.test(t), 'and a word that would have worked');
    check(!/so close|almost|!/.test(t.replace('WHAT GOT YOU', '')), 'with no near-miss copy and no exclamation marks');
    await shot(p, 'death-broke');
    await p.waitForTimeout(3000);
    check((await mode(p)) === 'death' && !(await p.$('.gb-clock')), 'nothing auto-starts and no clock runs on the death screen');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    check((await mode(p)) === 'death', 'Enter does nothing until a button is chosen');
    await p.context().close();
  }
  // The predator's strikes: rule-breaking words down to one strike from the end, then legal weak words.
  {
    const p = await page();
    await home(p, `?pack=${CODE}`);
    await p.waitForSelector('.gb-foe', { timeout: 60000 });
    await replica(p, CODE);
    for (let i = 0; i < 60; i++) {
      const r = await rep(p, 'run');
      if (r.over) break;
      const a = r.predator.attack;
      const w = r.hp - a > a ? await rep(p, 'breaker()') : await rep(p, 'weak()');
      await rep(p, `attack(${JSON.stringify(w)})`);
      await fight(p, w);
    }
    await until(p, ['death']);
    await p.waitForTimeout(400);
    const t = await text(p, '.gb-death');
    check(/It hit for \d+ and you had \d+\./.test(t), `the death screen names the strike (${t.slice(0, 90)})`);
    await shot(p, 'death-hits');
    await p.context().close();
  }
}

if (want('timeout')) {
  // The clock, with a mocked clock: each turn runs out at once.
  const p = await page();
  await p.clock.install();
  await home(p, `?pack=${CODE}`);
  await p.waitForSelector('.gb-foe', { timeout: 60000 });
  for (let i = 0; i < 300 && (await mode(p)) !== 'death'; i++) { await p.clock.runFor(5000); if (process.env.DEBUG) console.log(i, await mode(p), await text(p, '.gb-hpnum')); }
  const t = await text(p, '.gb-death');
  check(t.startsWith('WHAT GOT YOU') && t.includes('The clock.') && t.includes("seconds wasn't enough"), `the death screen names the clock (${t.slice(0, 90)})`);
  await shot(p, 'death-timeout');
  await p.context().close();
}

if (want('run')) {
  // A full run with legal words to the first boss, then walk home: the walk prompt, the results card and the share.
  const p = await page();
  await home(p, `?pack=${CODE}`);
  await p.waitForSelector('.gb-foe', { timeout: 60000 });
  await replica(p, CODE);
  const end = await play(p, { walk: true });
  if (end === 'walk') {
    await p.waitForTimeout(400);
    check(!(await p.$('.gb-clock')), 'no clock runs on the walk-home question');
    await shot(p, 'walk-prompt');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await until(p, ['results']);
    await p.waitForTimeout(900);
    await shot(p, 'results-walked');
    const t = await text(p, '.gb-polaroid');
    check(t.includes('WALKED HOME') && t.includes('NEW BEST') && t.includes(CODE), 'the results card carries the code, WALKED HOME and NEW BEST');
    // SHARE: the cursor starts unchosen; four buttons, SHARE third.
    for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    const share = await p.evaluate(() => navigator.clipboard.readText());
    console.log(share);
    check(share.startsWith(`Finish the Word · Hunt\nPack ${CODE} · 1st try\n5 predators beaten · `) && share.includes('Walked home after the Shadow Wolf') && share.includes(`?pack=${CODE}`), 'the share text matches Part 4.4');
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem('sap:hunt-log')));
    check(log.at(-1).cause === 'walk' && log.at(-1).defeated === 5, 'the walk is logged, and never raises defeated');
  } else check(false, `the run reached the first boss (it ended: ${end})`);
  await p.context().close();
}

if (want('leave')) {
  const p = await page();
  await home(p, `?pack=${CODE}`);
  await p.waitForSelector('.gb-foe', { timeout: 60000 });
  await until(p, ['menu']);
  await p.click('.gb-quit');
  await p.waitForTimeout(300);
  check((await mode(p)) === 'leave', 'the quit button asks before ending a run');
  await shot(p, 'leave-prompt');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  check((await mode(p)) === 'menu', 'STAY goes back to the fight');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('sap:hunt-log') ?? '[]'));
  check(log.at(-1)?.cause === 'left', 'LEAVE logs the run as left');
  await p.context().close();
}

if (want('dex')) {
  const p = await page();
  await home(p);
  await p.evaluate(() => localStorage.setItem('sap:hunt-bestiary', JSON.stringify({
    fox: { met: true, beaten: 12, highestLevel: 9, bestWord: { word: 'blizzard', damage: 48 }, firstMet: '2026-11-02' },
    wolf: { met: true, beaten: 4, highestLevel: 7, bestWord: { word: 'frosty', damage: 31 }, firstMet: '2026-11-03' },
    eagle: { met: true, beaten: 0, highestLevel: 0, bestWord: null, firstMet: '2026-11-07' },
    shadow: { met: true, beaten: 0, highestLevel: 0, bestWord: null, firstMet: '2026-11-07' },
  })));
  await openHunt(p);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await p.waitForSelector('.gb-dex');
  await p.waitForTimeout(800);
  check((await text(p, '.gb-dex-foot')).startsWith('4 OF 6 MET · 2 BEATEN'), 'the bestiary counts met and beaten');
  check((await p.$$('.gb-dex-card:not([data-met])')).length === 2, 'unmet predators are silhouettes');
  await shot(p, 'bestiary');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  await shot(p, 'bestiary-back');
  await p.context().close();
}

if (want('save')) {
  const a = await page();
  await home(a);
  await a.evaluate(() => {
    localStorage.setItem('sap:hunt-bestiary', JSON.stringify({ fox: { met: true, beaten: 3, highestLevel: 6, bestWord: { word: 'storm', damage: 20 }, firstMet: '2026-11-02' } }));
    localStorage.setItem('sap:dream-streak', JSON.stringify({ count: 4, last: '2026-11-07', best: 6, blankets: 1, earnedAt: 0 }));
  });
  const code = await a.evaluate(`(${MOD})('/src/lib/savecode.ts').then((m) => m.exportSave())`);
  const read = (p) => p.evaluate(() => [localStorage.getItem('sap:hunt-bestiary'), localStorage.getItem('sap:dream-streak')]);
  const ra = await read(a);
  // One software-rendered farm at a time: two at once stall the second page.
  await a.context().close();
  const b = await page();
  await home(b);
  await b.click('button[aria-label="Settings"]');
  await b.getByRole('button', { name: 'Paste' }).click();
  await b.fill('textarea[aria-label="Paste a save code"]', code);
  await b.waitForTimeout(300);
  await b.locator('[aria-label="Save code"]').screenshot({ path: `${out}/save-dry-run.png` });
  await b.getByRole('button', { name: 'Restore' }).click();
  await b.waitForTimeout(2500);
  await b.waitForSelector('.sk-menu-item', { timeout: 120000 }).catch(async () => { await b.screenshot({ path: `${out}/debug-after-restore.png` }); });
  const rb = await read(b);
  check(JSON.stringify(ra) === JSON.stringify(rb), 'the save code carries the bestiary and the dream streak to another browser');
  await b.click('button[aria-label="Settings"]');
  await b.getByRole('button', { name: 'Paste' }).click();
  await b.fill('textarea[aria-label="Paste a save code"]', code.slice(0, 30) + (code[30] === 'A' ? 'B' : 'A') + code.slice(31));
  await b.waitForTimeout(300);
  check((await b.textContent('[aria-label="Save code"]')).includes("doesn't add up"), 'a tampered code is refused with the reason');
  await b.locator('[aria-label="Save code"]').screenshot({ path: `${out}/save-tampered.png` });
  await b.context().close();
}

if (want('phone')) {
  const p = await page({ w: 390, h: 844 });
  await home(p);
  await openHunt(p);
  await p.waitForTimeout(600);
  await shot(p, 'phone-lobby');
  const box = await p.locator('.gb-frame').boundingBox();
  check(box.width <= 390, `the frame fits a phone (${box.width} wide)`);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  await p.waitForSelector('.gb-code');
  await p.keyboard.type('k7qx', { delay: 20 });
  await p.waitForTimeout(600);
  await shot(p, 'phone-code');
  await p.context().close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);
