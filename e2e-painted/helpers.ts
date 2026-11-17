// What every case of the painted suite shares (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 a).
//
// The suite opens the painted game the way a player does, in real time, on the build `npm run build` makes. Three
// things are set up for every case before its first request, by the `watch` fixture below:
//
//   1. WebGL draw calls are counted and skipped (tools/gate/lib/determinism.js, its `noDraw` switch). three.js still
//      walks the scene, uploads and compiles, so the game runs as it does for a player, but a frame costs a
//      millisecond where software rendering would take a second. The same file takes the page's dice from one seed.
//   2. The page is watched. A case fails on any page error, any failed request, any answer of 400 or more, any answer
//      whose type does not match its file's ending (`vite preview` answers a missing .js with the page and status
//      200), and any request that leaves the game's own address for anywhere but the two font hosts.
//   3. Fonts. Until milestone 1 ships them with the game, the page asks two outside hosts for its fonts. Each answer is
//      taken from the font cache the gate's pictures use (<cache>/fonts, the same files) and, when it is not there
//      yet, fetched once and kept. So a case reads the real fonts, a machine that has run before needs no network,
//      and a build machine fetches four files a run. If the hosts cannot be reached and nothing is kept, the request
//      fails and so does the case, saying it was the network.
//
// A fault case names what it breaks on purpose (`watch.fault(/.../)`): requests to those addresses are the fault, not
// a finding. A page error is never excused.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';
import type { BrowserContext, Locator, Page, TestInfo } from '@playwright/test';

declare global {
  interface Window {
    /** Left by tools/gate/lib/determinism.js. `skipped` counts the draw calls left out. */
    __gate: { noDraw(on: boolean): boolean; readonly drawing: boolean; readonly skipped: number };
    /** Left by a fault case's own init script: how often the fault was met, and what it keeps for later. */
    __fault?: { hits: number; events?: string[]; lose?: WEBGL_lose_context | null };
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DETERMINISM = resolve(HERE, '..', 'tools', 'gate', 'lib', 'determinism.js');

// ---------------------------------------------------------------------------------------------------------------------
// Patience. A case waits for something on the page, and these are how long each such wait may take in real time on a
// slow, shared machine before the case is called failed. A bare sleep is used only where the fault or the plan sets a
// time: the 4 s before a lost context is given back, the plan's "at 12 s", the few seconds an end state must last.
// ---------------------------------------------------------------------------------------------------------------------

/** Home from a cold page: the code arrives, the farm is built (seconds of a frozen page), the doors open. */
export const HOME_MS = 120_000;
/** A game screen from Home: the table, the ice. */
export const SCREEN_MS = 90_000;
/** One step on a page that is already up: a panel, a tab, a turn. */
export const STEP_MS = 45_000;

// ---------------------------------------------------------------------------------------------------------------------
// What the suite relies on in the game (file and line of each: tools/gate/lib/README.md, section 4)
// ---------------------------------------------------------------------------------------------------------------------

/** The loading doors: the game's own, and the ones the page comes with (those carry both the class and the id). */
export const DOORS = '.sk-doors, #boot-doors';
/** Every three.js canvas. One that has drawn three frames marks itself `data-drawn` (MarkDrawn, Rendering.tsx). */
export const CANVAS = 'canvas[data-engine]';
/** The first-visit form. */
export const FORM = '[role="dialog"][aria-label="Welcome to the barn"]';
/** The word bar, and the hidden input in it that takes the keys. */
export const WORD_BAR = '[data-tour="input"]';
export const WORD_INPUT = `${WORD_BAR} input.sk-input-ghost`;
/** The Trading Post, and an item's closer look. */
export const POST = '[role="dialog"][aria-label="The Trading Post"]';
export const CLOSER_LOOK = '.sk-preview';

/** A build with no game server shows these six rows on Home, in this order (PaintedHome.tsx, `items`). */
export const MENU_ROWS = ['Queue', 'Create lobby', 'Counting Sheep', 'Practice', 'Tutorial', 'Trading Post'];

/** What a browser that has been here before has saved, so the first-visit form is not in the way. */
const RETURNING = {
  'sap:age-check': { country: 'US', age: 18, parent: false, at: Date.UTC(2026, 10, 16, 12) },
  'sap:tourDone': true,
  'sap:settings': { name: 'Brian' },
  'sap:tips': ['modifier', 'wool'],
};

/**
 * The two hosts the page asks for its fonts until milestone 1, and what a font file's address ends in. They are the
 * only addresses outside the game a case may reach. When milestone 1 ships the fonts with the game (plan file 17,
 * change 6: "no request leaves the origin") the hosts go from here, and any request that leaves the game fails a case.
 */
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const FONT_FILES = /\.(woff2?|ttf|otf)(\?|$)/i;

/** What an answer for a file with this ending must say it is. Anything else is the page handed back in its place. */
const TYPES: Record<string, RegExp> = {
  js: /javascript/, mjs: /javascript/, css: /^text\/css/, html: /^text\/html/, json: /json/, txt: /^text\/plain/,
  png: /^image\/png/, webp: /^image\/webp/, jpg: /^image\/jpeg/, jpeg: /^image\/jpeg/, svg: /^image\/svg\+xml/, gif: /^image\/gif/, ico: /^image\/(x-icon|vnd\.microsoft\.icon)/,
  woff2: /font\/woff2|application\/font-woff2/, woff: /font\/woff|application\/font-woff/, ttf: /font\/ttf|application\/(x-font-ttf|font-sfnt)/,
  glb: /^model\/gltf-binary/, wasm: /^application\/wasm/,
};

// ---------------------------------------------------------------------------------------------------------------------
// The watch
// ---------------------------------------------------------------------------------------------------------------------

export interface Problem {
  kind: 'pageerror' | 'requestfailed' | 'status' | 'content-type' | 'outside';
  text: string;
  url?: string;
}

export interface Watch {
  /** Everything seen so far that fails a case, faults included. */
  readonly problems: Problem[];
  /** What the page wrote to the console as an error. Kept with a failed case; never a failure by itself. */
  readonly consoleErrors: string[];
  /** Names an address this case breaks on purpose. Requests there are the fault, not a finding. */
  fault(address: RegExp): void;
  /** How many requests have met a named fault so far: a fault nothing asked for has tested nothing. */
  faultsMet(): number;
}

export interface Options {
  /** `returning`: the first-visit form has been answered before. `first`: nothing is saved. */
  visitor: 'returning' | 'first';
  /** `served`: the real fonts (see the top of this file). `blocked`: every font file is refused. */
  fonts: 'served' | 'blocked';
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Where the gate keeps the fonts it has fetched: $GATE_CACHE/fonts, or ~/.cache/fleeced-gate/fonts. */
function fontCache(): string {
  const dir = join(resolve(process.env.GATE_CACHE || join(homedir(), '.cache', 'fleeced-gate')), 'fonts');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Answers the two font hosts from the font cache, in the files and names tools/gate/lib/painted.mjs keeps them under
 * (so the suite and the gate's pictures are set in the very same fonts). A file that is not there is fetched, three
 * tries, and kept. Nothing reachable and nothing kept: the request fails, and the case with it.
 */
async function serveFonts(context: BrowserContext, problems: Problem[]) {
  const dir = fontCache();
  await context.route(FONT_HOSTS, async (route) => {
    const url = route.request().url();
    const file = join(dir, createHash('sha256').update(url).digest('hex').slice(0, 32));
    let headers: Record<string, string> | null = null;
    let body: Buffer | null = null;
    try {
      if (existsSync(`${file}.json`) && existsSync(`${file}.body`)) {
        headers = (JSON.parse(readFileSync(`${file}.json`, 'utf8')) as { headers: Record<string, string> }).headers;
        body = readFileSync(`${file}.body`);
      }
    } catch { headers = null; body = null; /* a damaged pair: fetched afresh below */ }
    let why = '';
    for (let attempt = 1; !body && attempt <= 3; attempt++) {
      try {
        const answer = await route.fetch({ timeout: 20_000 });
        if (answer.status() !== 200) throw new Error(`status ${answer.status()}`);
        const got = await answer.body();
        headers = { 'content-type': answer.headers()['content-type'] ?? '', 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' };
        // Each file is written beside its place and moved in, so another worker reading the cache at this moment
        // finds a whole font or none; the .json goes in last and is what says the pair is there.
        const mine = `${file}.${process.pid}.tmp`;
        writeFileSync(mine, got);
        renameSync(mine, `${file}.body`);
        writeFileSync(mine, JSON.stringify({ url, headers }));
        renameSync(mine, `${file}.json`);
        body = got;
      } catch (e) {
        why = String((e as Error)?.message ?? e).split('\n')[0];
        if (/closed|disposed/i.test(why)) return; // the case is over: nobody is waiting for this font
        if (attempt < 3) await sleep(attempt * 1000);
      }
    }
    if (!body || !headers) {
      problems.push({ kind: 'requestfailed', text: `a font host could not be reached in three tries (${why}) and this file is not in the font cache at ${dir}: the network, not the game`, url });
      return route.abort('failed').catch(() => {});
    }
    return route.fulfill({ status: 200, headers, body }).catch(() => {});
  });
}

/** Refuses every font file, wherever it is asked from: the two hosts today, the game's own folder from milestone 1. */
async function blockFonts(context: BrowserContext) {
  await context.route(FONT_HOSTS, (route) => route.abort('blockedbyclient').catch(() => {}));
  await context.route(FONT_FILES, (route) => route.abort('blockedbyclient').catch(() => {}));
}

const short = (text: string, most = 400) => (text.length > most ? `${text.slice(0, most)} ...` : text);
const problemLine = (p: Problem) => `${p.kind}: ${short(p.text)}${p.url ? ` (${p.url})` : ''}`;

export const test = base.extend<Options & { watch: Watch }>({
  visitor: ['returning', { option: true }],
  fonts: ['served', { option: true }],

  watch: [async ({ context, page, baseURL, visitor, fonts }, use, testInfo) => {
    const problems: Problem[] = [];
    const consoleErrors: string[] = [];
    const faults: RegExp[] = [];
    let met = 0;
    const isFault = (address: string) => faults.some((f) => f.test(address));

    // First in, so the draw switch is there before any of the game's code.
    await context.addInitScript({ path: DETERMINISM });
    await context.addInitScript(() => { window.__gate.noDraw(true); });
    if (visitor === 'returning') {
      const entries = Object.entries(RETURNING).map(([k, v]) => [k, JSON.stringify(v)] as const);
      await context.addInitScript((list) => {
        try {
          // Only what is not there yet: a value the game has written since is the game's.
          for (const [k, v] of list) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
        } catch { /* a page with no storage of its own */ }
      }, entries);
    }
    if (fonts === 'blocked') {
      faults.push(FONT_HOSTS, FONT_FILES);
      await blockFonts(context);
    } else {
      await serveFonts(context, problems);
    }

    const home = new URL(baseURL ?? 'http://127.0.0.1/').origin;
    page.on('pageerror', (e) => problems.push({ kind: 'pageerror', text: String(e?.stack || e?.message || e) }));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.text()}${m.location()?.url ? ` (${m.location().url})` : ''}`); });
    page.on('request', (r) => {
      const address = r.url();
      if (isFault(address)) met++;
      if (!/^(https?|wss?):/.test(address)) return; // data:, blob:, about: never leave the page
      if (!address.startsWith(`${home}/`) && !FONT_HOSTS.test(address)) problems.push({ kind: 'outside', text: 'a request left the game for an address that is not a font host', url: address });
    });
    page.on('requestfailed', (r) => problems.push({ kind: 'requestfailed', text: r.failure()?.errorText ?? 'failed', url: r.url() }));
    page.on('response', (r) => {
      const status = r.status();
      const address = r.url();
      if (status >= 400) problems.push({ kind: 'status', text: String(status), url: address });
      if (status < 200 || status >= 300) return;
      let ending = '';
      try { ending = (/\.([a-z0-9]+)$/i.exec(new URL(address).pathname)?.[1] ?? '').toLowerCase(); } catch { /* not an address */ }
      const want = TYPES[ending];
      const got = r.headers()['content-type'] ?? '';
      if (want && !want.test(got)) problems.push({ kind: 'content-type', text: `.${ending} answered as ${got || 'nothing'}`, url: address });
    });

    await use({
      problems,
      consoleErrors,
      fault: (address) => { faults.push(address); },
      faultsMet: () => met,
    });

    // The case is over. What the page said goes with it; what went wrong on the page fails it.
    if (consoleErrors.length) await testInfo.attach('console errors', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
    const found = problems.filter((p) => p.kind === 'pageerror' || p.kind === 'outside' || !p.url || !isFault(p.url));
    if (found.length) await testInfo.attach('what went wrong on the page', { body: found.map(problemLine).join('\n'), contentType: 'text/plain' });
    expect(found.map(problemLine), 'the page must end with no page error, no failed request, no answer of the wrong type and no request to a stranger').toEqual([]);
  }, { auto: true }],
});

export { expect };

// ---------------------------------------------------------------------------------------------------------------------
// Waiting for the page
// ---------------------------------------------------------------------------------------------------------------------

/** What the page looks like now, for the message of a wait that gave up. */
async function where(page: Page): Promise<string> {
  const seen = await page.evaluate(({ doors, canvas }) => ({
    doors: [...document.querySelectorAll(doors)].map((d) => `${d.id || 'doors'}:${d.getAttribute('data-phase') ?? '?'}`),
    canvases: [...document.querySelectorAll(canvas)].map((c) => (c.hasAttribute('data-drawn') ? 'drawn' : 'not drawn')),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label')),
    rootChildren: document.getElementById('root')?.childElementCount ?? null,
    wordBar: document.querySelector('[data-tour="input"]')?.getAttribute('data-mode') ?? null,
  }), { doors: DOORS, canvas: CANVAS }).catch((e) => `the page did not answer: ${String(e).split('\n')[0]}`);
  return JSON.stringify(seen);
}

/** Waits until `test` holds in the page. A wait that gives up says what it was waiting for and what the page showed. */
export async function until<Arg>(page: Page, what: string, test: (arg: Arg) => unknown, arg: Arg, timeout: number): Promise<void> {
  try {
    // The page gets `arg` as it was handed in; Playwright's own types cannot follow a caller's type through.
    await page.waitForFunction(test as (arg: unknown) => unknown, arg as unknown, { timeout });
  } catch (e) {
    const text = String((e as Error)?.message ?? e).split('\n')[0];
    if (!/Timeout|exceeded/i.test(text)) throw e;
    throw new Error(`waited ${Math.round(timeout / 1000)} s for ${what}. The page: ${await where(page)}`);
  }
}

/**
 * The screen is up and drawn: the doors have gone, there is at least one three.js canvas, and every one of them has
 * marked itself drawn and still has its context. `need` is a selector the screen must show. A canvas that never marks
 * itself keeps this waiting until it gives up, which is the point: the doors only give up on such a canvas after 15 s
 * (BarnDoors.tsx), and a player sits behind them all that time.
 */
export async function drawn(page: Page, what: string, { need = null as string | null, timeout = SCREEN_MS } = {}): Promise<void> {
  await until(page, `${what}: no loading doors, and every canvas drawn`, ({ doors, canvas, need: wanted }) => {
    if (wanted && !document.querySelector(wanted)) return false;
    if (document.querySelector(doors)) return false;
    const all = [...document.querySelectorAll<HTMLCanvasElement>(canvas)];
    if (!all.length) return false;
    return all.every((c) => c.hasAttribute('data-drawn') && !(c.getContext('webgl2')?.isContextLost() ?? true));
  }, { doors: DOORS, canvas: CANVAS, need }, timeout);
}

/** Home, ready to use: drawn (above), the farm shown, and the word list in (no menu row still says Loading). */
export async function homeReady(page: Page, timeout = HOME_MS): Promise<void> {
  await drawn(page, 'Home', { need: '.sk-farm-fade[data-ready]', timeout });
  await until(page, 'the word list (a menu row still says Loading)', () => {
    const labels = [...document.querySelectorAll('.sk-menu-item .sk-menu-label')];
    return labels.length > 0 && labels.every((l) => !/^Loading/.test(l.textContent ?? ''));
  }, null, STEP_MS);
}

/** A row of Home's menu, by the words on it. */
export const menuRow = (page: Page, label: string): Locator =>
  page.locator('.sk-menu-item').filter({ has: page.locator('.sk-menu-label', { hasText: new RegExp(`^${label}$`) }) });

/** A tab of the Trading Post, by the words on it. */
export const postTab = (page: Page, label: string): Locator => page.locator(`${POST} [role="tab"]`, { hasText: new RegExp(`^\\s*${label}\\s*$`) });

/** How many WebGL draw calls the page has asked for (and the switch has left out) since it loaded. */
export const drawCalls = (page: Page): Promise<number> => page.evaluate(() => window.__gate.skipped);

/**
 * Draw calls in one drawn frame: the middle value over `frames` frames of the browser, leaving out frames in which
 * nothing was drawn (a scene that draws every other frame still gives the count of a whole frame).
 */
export const drawCallsAFrame = (page: Page, frames = 40): Promise<number> => page.evaluate((count) => new Promise<number>((done) => {
  const deltas: number[] = [];
  let last = window.__gate.skipped;
  let n = 0;
  const step = () => {
    const now = window.__gate.skipped;
    if (now !== last) deltas.push(now - last);
    last = now;
    if (++n >= count) {
      deltas.sort((a, b) => a - b);
      done(deltas.length ? deltas[deltas.length >> 1] : 0);
    } else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), frames);

// ---------------------------------------------------------------------------------------------------------------------
// The end state of a fault: readable text on screen, and #root not empty
// ---------------------------------------------------------------------------------------------------------------------

interface Look {
  /** How many elements #root holds, or null when there is no #root. */
  rootChildren: number | null;
  /** The loading doors on the page, each as name:phase. */
  doors: string[];
  /** Letters and digits a player can read now. */
  letters: number;
  /** The start of that text. */
  sample: string;
}

/**
 * What a player can read on the page now. A piece of text counts when it is set at 11 px or more (the plan's floor),
 * is not hidden or faded out, lies inside the window, and is what is on top where it lies: Home's menu behind shut
 * doors does not count, and neither does the doors' own loading sign (it is marked aria-hidden, as decoration).
 */
function look(doorsSelector: string): Look {
  const texts: string[] = [];
  let letters = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    const count = text.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (count < 2) continue;
    const el = node.parentElement;
    if (!el || el.closest('[aria-hidden="true"], script, style, noscript, template')) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility !== 'visible' || parseFloat(style.fontSize) < 11) continue;
    let opacity = 1;
    for (let p: Element | null = el; p; p = p.parentElement) opacity *= parseFloat(getComputedStyle(p).opacity || '1');
    if (opacity < 0.5) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || box.right <= 0 || box.bottom <= 0 || box.left >= innerWidth || box.top >= innerHeight) continue;
    const x = Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
    texts.push(text);
    letters += count;
  }
  const root = document.getElementById('root');
  return {
    rootChildren: root ? root.childElementCount : null,
    doors: [...document.querySelectorAll(doorsSelector)].map((d) => `${d.id || 'doors'}:${d.getAttribute('data-phase') ?? '?'}`),
    letters,
    sample: texts.join(' | ').slice(0, 160),
  };
}

/** Fewer letters than this is not a message anyone could act on. */
const READABLE_LETTERS = 12;
/** An end state stays: it is looked at again this long after it first held. */
const HOLD_MS = 3000;
/** A page with nothing in #root, no doors and nothing to read for this long is a blank page: no need to wait longer. */
const BLANK_MS = 5000;

const describeLook = (l: Look | null) => (l
  ? `${l.letters ? `${l.letters} readable letters ("${l.sample}")` : 'no readable text'}; #root ${l.rootChildren === null ? 'is missing' : l.rootChildren === 0 ? 'is empty' : `holds ${l.rootChildren}`}; loading doors: ${l.doors.length ? l.doors.join(', ') : 'none'}`
  : 'the page did not answer');

/**
 * The plan's end state for a fault (file 16, section 4.1 a): readable text on screen, and #root not empty. With
 * `root: false` only the text is asked for: when the main script never arrives, #root has nothing to hold and the
 * message must come from the page itself.
 *
 * Two ways to ask. `at` (an epoch) is for a fault the plan gives a time for ("at 12 s"): the page is looked at at that
 * moment, once. Otherwise the state has to be reached `within` ms from now, after `settleMs` for a fault whose effect
 * lands a moment after its cause. Either way it has to stay: the page is looked at again HOLD_MS later.
 */
export async function endsOnReadableText(page: Page, what: string, { within = STEP_MS, at = 0, root = true, settleMs = 0 } = {}): Promise<void> {
  const good = (l: Look | null) => !!l && l.letters >= READABLE_LETTERS && (!root || (l.rootChildren ?? 0) > 0);
  const see = () => page.evaluate(look, DOORS).catch(() => null);
  let seen: Look | null;
  if (at) {
    await sleep(Math.max(0, at - Date.now()));
    seen = await see();
    if (!good(seen)) throw new Error(`${what}: ${describeLook(seen)}`);
  } else {
    if (settleMs) await sleep(settleMs);
    const deadline = Date.now() + within;
    seen = await see();
    let blankSince = 0;
    while (!good(seen)) {
      const blank = !!seen && !seen.letters && !seen.rootChildren && !seen.doors.length;
      if (!blank) blankSince = 0;
      else if (!blankSince) blankSince = Date.now();
      else if (Date.now() - blankSince >= BLANK_MS) throw new Error(`${what}: a blank page. ${describeLook(seen)}`);
      if (Date.now() >= deadline) throw new Error(`${what}: ${describeLook(seen)}`);
      await sleep(250);
      seen = await see();
    }
  }
  await sleep(HOLD_MS);
  seen = await see();
  if (!good(seen)) throw new Error(`${what}: it did not last. ${describeLook(seen)}`);
}

/**
 * Something the suite saw that is wrong today and that the plan gives no check for. It does not fail the case: it is
 * written on it, and the gate counts these and lists each by name (tools/gate/smoke.mjs), so the count can only fall.
 */
export function knownToday(testInfo: TestInfo, text: string): void {
  testInfo.annotations.push({ type: 'known', description: text });
}
