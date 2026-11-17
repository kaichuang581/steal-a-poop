// Gate module: the count gate (plan file 17, section 4, change 1, and the "Today" column of its section 6).
//
// What each screen of the painted game asks of a device, counted, not timed: triangles and draw calls over every pass
// of a frame, programs, contexts, buffer bytes, how often it draws and how often React commits. Every number comes
// from tools/gate/probe.js, an init script that wraps the page's WebGL contexts. No frame rate is evidence of anything
// here: the browser draws in software and the page's clock is held and stepped by hand (lib/README.md).
//
// How a state is measured. One of the helper's places is opened in a context of its own, on the gate build, under the
// pinned clock, the pinned dice and reduced motion, with ?dpr=1&hour=day. The page is in the probe's count-only mode
// from its first instant (window.__GATE_NODRAW): no draw, clear or blit call is ever carried out, so nothing is drawn
// in software at all, the frames the helper means to draw included. three.js still culls, uploads and compiles, so the
// counts are the real ones; one more place, opened for it, proves that every run (below). Then:
//   one second of the page's clock      triangles and draws of each frame, summed over every context and pass: the worst
//                                       frame and the mean. React's commits, localStorage reads, and how many of the
//                                       display's ticks each canvas drew on. The pinned clock's display ticks every
//                                       16 ms, so its second holds 62 or 63 frames, not 60.
//   a second with the display at 144 Hz the same count of renders (__gate.setRafHz(144)): exactly 144 ticks in the second
//   three seconds with the tab hidden   draw calls made in the third (__gate.hide(true): no tick comes, so a draw there
//                                       was made from a timer)
// and what the page holds as it stands: programs and buffer bytes in the contexts still alive, contexts made since the
// page loaded, each canvas's box against its parent's.
//
// The probe's own check (the plan's: "a real-draw run of Home shot 0 matches count-only within 2 %"). Every run opens
// Home's shot 0 once more, counts two frames, then draws the next two for real and waits for the graphics process to
// finish them; the module fails if the two pairs are further apart than 2 %. `--real` below does the same for the
// whole counted second (a minute of software rendering).
//
// Every state is measured RUNS times (three), each in a fresh context. A number handed in as a ratchet must be the
// same every time; if one is not, the module fails and names it, because a ratchet that is not repeatable would flap.
// Numbers known not to repeat are never handed in: they go into the report's data with their spread (the table's
// canvas with motion on, oscillators a second in a hidden tab).
//
// Tiers. There is one today. Milestone 4 brings ?gfx=low|medium|high; the plan's High is today's picture, so today's
// numbers are stored under `high` and may only fall. Milestone 4 gives that tier its query and adds the other two.
//
// It can be run by hand, which is also how its own proofs are made (nothing is written into the repo):
//   node tools/gate/counts.mjs                              every state, three times, as the gate runs it
//   node tools/gate/counts.mjs --states home-pov0,results   some states     --devices computer   one size
//   node tools/gate/counts.mjs --runs 1 --jobs 2            fewer runs, fewer at once
//   node tools/gate/counts.mjs --from <checkout>            build and measure another checkout (the base's, say)
//   node tools/gate/counts.mjs --real home-pov0             the same second with every frame really drawn, against
//                                                           count-only (the plan's check: within 2 %)
//   node tools/gate/counts.mjs --out <file.json>            where the result goes (default: the cache)
// $GATE_COUNTS_JOBS is how many places a gate run opens at once (half the cores, four at most, when not set);
// $GATE_COUNTS_RUNS how many times each state is measured (three when not set; fewer is not a gate result).
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAME_MS, ROOT, advance, bazaarSacks, bookPreview, cacheDir, drawing, dream, duel, ensureGateBuild, home, jump, launch, profile, serve, settle, table, tableResults, treeDir, until } from './lib/painted.mjs';

export const id = 'counts';
export const modes = ['milestone', 'baseline'];

const HERE = dirname(fileURLToPath(import.meta.url));
const PROBE = join(HERE, 'probe.js');
/** What goes into every page ahead of the game: count-only from the first instant, then the probe. */
const INIT = [{ content: 'window.__GATE_NODRAW = true;' }, { path: PROBE }];

/** How many times each state is measured, each in a context of its own. */
const RUNS = 3;
/** The length of each counted window, in the page's clock. */
const WINDOW_MS = 1000;
/** The clock's hop while nothing is counted: under the 400 ms the game calls a stall (src/state/store.ts). */
const HOP_MS = 250;
/** How long Home is left alone before "idle" is counted: milestone 2 slows Home after 20 s without a touch. */
const IDLE_MS = 21_000;
/** The frames a canvas draws before it marks itself drawn (MarkDrawn, src/skin/table/Rendering.tsx): its heaviest, with every parked effect in them. */
const MOUNT_FRAMES = 3;
/** How long the tab has been hidden when its draws are counted (the plan: "2 s after hiding"). */
const HIDDEN_WAIT_MS = 2000;
/** The faked display rate (the plan's 144 Hz screen). */
const FAST_HZ = 144;
/** The plan's check of the probe itself: really drawn frames and counted ones agree within this share. */
const REAL_TOLERANCE = 0.02;
/** How long the music is listened to in a hidden tab, in real seconds: two bars of Home's song at 76 beats a minute. */
const MUSIC_LISTEN_S = 6.4;

/**
 * The graphics tiers. One today: the game has no ?gfx= yet. The plan's High is today's picture on the device, so
 * today's numbers are High's. Milestone 4: give `high` the query { gfx: 'high' } and add medium and low after it.
 */
const TIERS = [{ id: 'high', query: {} }];

/** The two sizes the plan names. `shots` is how many scenes Home's tour has there (src/skin/scene/homePov.ts). */
const DEVICES = [
  { id: 'computer-1280x720', short: 'computer', viewport: { width: 1280, height: 720 }, touch: false, shots: 8 },
  { id: 'phone-390x844', short: 'phone', viewport: { width: 390, height: 844 }, touch: true, shots: 6 },
];

/**
 * The states, in the plan's order. `open` is a place of lib/painted.mjs. `rates` adds how often the screen draws (at
 * the clock's own rate, at 144 Hz, hidden) and its canvas against its box; `commits` adds React's commits a second;
 * `game` adds the worst frames of the whole game the helper played out to get there; `idleMs` leaves the page alone
 * first; `after` does something more once the place is open. The closer look is opened with motion on (`motion`):
 * under reduced motion it is a still picture with no 3D in it.
 */
function statesFor(device) {
  const list = [];
  for (let pov = 0; pov < device.shots; pov++) {
    list.push({ id: `home-pov${pov}`, what: `Home, held on shot ${pov}`, open: (b, o) => home(b, { ...o, pov, hour: 'day' }), rates: pov === 0 });
  }
  list.push(
    { id: 'home-idle', what: 'Home with no shot held, left alone for 21 s', open: (b, o) => home(b, { ...o, pov: null, hour: 'day' }), rates: true, idleMs: IDLE_MS },
    { id: 'home-profile', what: 'Home behind the profile page', open: profile, rates: true },
    { id: 'trading-post', what: 'The Trading Post, Feed Sacks tab', open: bazaarSacks, rates: true },
    { id: 'closer-look', what: "An item's closer look in the Barn Book, the live model", open: (b, o) => bookPreview(b, { ...o, reducedMotion: false }), rates: true, motion: true },
    { id: 'table-4-seats', what: 'A Quick Game at four seats, your turn', open: (b, o) => table(b, { ...o, seats: 4 }), rates: true, commits: true },
    { id: 'table-6-seats', what: 'A Quick Game at six seats, your turn', open: (b, o) => table(b, { ...o, seats: 6 }), rates: true, commits: true },
    { id: 'results', what: 'The results of a six-seat game, the podium over the table', open: (b, o) => tableResults(b, { ...o, seats: 6 }), rates: true, commits: true, game: true },
    { id: 'practice', what: 'Practice on the ice, your turn', open: duel, rates: true, commits: true },
    { id: 'counting-sheep', what: 'Counting Sheep at its ready sign, the bedroom bubble beside it', open: dream, rates: true },
    { id: 'counting-sheep-running', what: 'Counting Sheep a second and a half into a run nobody types in', open: dream, after: startDream },
  );
  return list;
}

/** How far into a run of Counting Sheep the count starts. The sheep meets its first fence about four seconds in. */
const DREAM_RUN_MS = 1500;

/**
 * Starts tonight's dream from its ready sign, as Enter does (src/skin/dream/DreamScreen.tsx, onKey), and lets it run.
 * Nothing is typed. The night it uses up is this context's alone.
 */
async function startDream(page) {
  await page.locator('main.dr-root').dispatchEvent('keydown', { key: 'Enter' });
  await until(page, () => document.querySelector('main.dr-root')?.getAttribute('data-phase') === 'running', null, { what: 'the dream to start running' });
  await advance(page, DREAM_RUN_MS);
}

/**
 * The plan's figures for today (file 17, sections 3 and 6), each beside what this module measures nearest to it. Only
 * printed, never judged: the ratchet is what was measured here, not what the plan wrote down.
 */
const PLAN_TODAY = [
  { what: 'Home, triangles in the worst frame of the worst shot', plan: 4_150_000, from: (m) => maxOver(m.computer, /^home-pov\d$/, 'trianglesWorst') },
  { what: 'Home, draw calls in that frame', plan: 961, from: (m) => maxOver(m.computer, /^home-pov\d$/, 'drawsWorst') },
  { what: 'Table at six seats, triangles in the worst frame of a game once it is in play', plan: 2_320_000, from: (m) => m.computer?.results?.playTrianglesWorst },
  { what: 'Table at six seats, draw calls in the worst frame of a game once it is in play', plan: 409, from: (m) => m.computer?.results?.playDrawsWorst },
  { what: 'Practice on the ice, triangles in the worst frame', plan: 459_000, from: (m) => m.computer?.practice?.trianglesWorst },
  { what: 'Counting Sheep running, triangles in the worst frame, two canvases', plan: 611_000, from: (m) => m.computer?.['counting-sheep-running']?.trianglesWorst },
  { what: 'Results, triangles in the worst frame, two canvases', plan: 2_550_000, from: (m) => m.computer?.results?.trianglesWorst },
  { what: "An item's closer look, triangles in the worst frame", plan: 4000, from: (m) => m.computer?.['closer-look']?.trianglesWorst },
  { what: "An item's closer look, draw calls", plan: 9, from: (m) => m.computer?.['closer-look']?.drawsWorst },
  { what: 'Home, buffer megabytes on a computer', plan: 324, from: (m) => mb(maxOver(m.computer, /^home-/, 'bufferBytes')) },
  { what: 'Table, buffer megabytes on a computer', plan: 142, from: (m) => mb(m.computer?.['table-6-seats']?.bufferBytes) },
  { what: 'Home, buffer megabytes on a phone', plan: 175, from: (m) => mb(maxOver(m.phone, /^home-/, 'bufferBytes')) },
  { what: 'Table, buffer megabytes on a phone', plan: 88, from: (m) => mb(m.phone?.['table-6-seats']?.bufferBytes) },
  { what: 'Renders a second at 144 Hz', plan: 134, from: (m) => m.computer?.['home-pov0']?.rendersPerSecondAt144 },
  { what: 'Draw calls in a second with the tab hidden', plan: 0, from: (m) => m.computer?.['home-pov0']?.hiddenDrawCalls },
  { what: 'React commits a second at the table', plan: 60, from: (m) => m.computer?.['table-6-seats']?.reactCommitsPerSecond },
];

// ---------------------------------------------------------------------------------------------------------------------
// Small things
// ---------------------------------------------------------------------------------------------------------------------

const firstLine = (e) => String(e?.message ?? e).split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 400) ?? 'no message';
const n = (x) => (typeof x === 'number' ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'not measured');
const mb = (bytes) => (typeof bytes === 'number' ? Math.round(bytes / 1048576 * 10) / 10 : undefined);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function maxOver(states, pattern, key) {
  let best;
  for (const [name, m] of Object.entries(states ?? {})) if (pattern.test(name) && typeof m[key] === 'number' && (best === undefined || m[key] > best)) best = m[key];
  return best;
}

/** How many places are opened at once: $GATE_COUNTS_JOBS, or half the cores, four at most (lib/README.md, section 6). */
function jobsWanted(asked) {
  const given = Number(asked ?? process.env.GATE_COUNTS_JOBS);
  if (Number.isInteger(given) && given > 0) return Math.min(given, 16);
  return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
}
function runsWanted(asked) {
  const given = Number(asked ?? process.env.GATE_COUNTS_RUNS);
  return Number.isInteger(given) && given > 0 ? Math.min(given, 10) : RUNS;
}

/**
 * Runs `work` over `items`, `jobs` at a time, and resolves every answer in the items' own order. Never rejects.
 * Items marked `alone` are never run two at once: one lane takes them in turn, then helps with the rest.
 * (Measured: a page with motion on keeps the browser composing frames in real time. One such page among others is
 * fine; with two or three open at once the graphics process never got round to the WebGL contexts, and every wait
 * for it ran out. So the places opened with motion on take turns.)
 */
async function pool(items, jobs, work) {
  const out = new Array(items.length);
  const alone = items.map((_, i) => i).filter((i) => items[i].alone);
  const rest = items.map((_, i) => i).filter((i) => !items[i].alone);
  const run = async (i) => { try { out[i] = await work(items[i], i); } catch (e) { out[i] = { ok: false, error: firstLine(e) }; } };
  const lane = async (first) => {
    if (first) while (alone.length) await run(alone.shift());
    while (rest.length) await run(rest.shift());
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, (_, k) => lane(k === 0)));
  return out;
}

/** What a page logged, made the same from run to run: the preview server's port is a new one each time. */
function tidyErrors(errors) {
  const plain = (text) => String(text ?? '').replace(/https?:\/\/(127\.0\.0\.1|localhost):\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return errors.map((e) => `${e.kind}: ${plain(e.text)}${e.url ? ` (${plain(e.url)})` : ''}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading the probe
// ---------------------------------------------------------------------------------------------------------------------

const snapshot = (page, from = 0, brief = false) => page.evaluate(([f, b]) => window.__probe.snapshot(f, b), [from, brief]);
const frameNo = (page) => page.evaluate(() => window.__probe.frameNo());
const drawCallsSoFar = (page) => page.evaluate(() => window.__probe.contexts().reduce((sum, c) => sum + c.total.draws, 0));

/** One frame's draws and triangles over every context and pass. */
function frameSum(f) {
  let draws = 0, triangles = 0;
  for (const c of Object.values(f.ctx)) { draws += c.draws; triangles += c.triangles; }
  return { draws, triangles };
}

/** A pass in a few words, from what hangs on its framebuffer. */
function passName(p) {
  if (!p) return 'a framebuffer since deleted';
  if (p.color === 'canvas') return `the canvas, ${p.w} x ${p.h}`;
  const size = `${p.w} x ${p.h}`;
  if (p.samples > 0) return `the multisampled target, ${size}, ${p.samples} samples`;
  if (p.depth && p.w === p.h) return `a shadow map, ${size}`;
  if (p.depth) return `a target with depth, ${size}`;
  return `an effect target, ${size}`;
}

/** The second that was counted: the worst frame, the mean, who drew how often, and the worst frame pass by pass. */
function readSecond(frames, contexts) {
  const sums = frames.map(frameSum);
  const total = sums.reduce((a, s) => ({ draws: a.draws + s.draws, triangles: a.triangles + s.triangles }), { draws: 0, triangles: 0 });
  const count = Math.max(1, frames.length);
  let worst = 0;
  for (let i = 1; i < sums.length; i++) if (sums[i].triangles > sums[worst].triangles) worst = i;
  const renders = {};
  const commits = {};
  let reads = 0;
  for (const f of frames) {
    for (const [ctx, c] of Object.entries(f.ctx)) if (c.draws > 0) renders[ctx] = (renders[ctx] ?? 0) + 1;
    for (const [who, k] of Object.entries(f.commits)) commits[who] = (commits[who] ?? 0) + k;
    reads += f.reads;
  }
  const passes = [];
  for (const [ctx, c] of Object.entries(frames[worst]?.ctx ?? {})) {
    const info = contexts.find((x) => String(x.id) === ctx);
    for (const [fb, p] of Object.entries(c.fb)) {
      if (p.draws > 0) passes.push({ context: Number(ctx), pass: passName(info?.passes?.[fb]), draws: p.draws, triangles: p.triangles });
    }
  }
  passes.sort((a, b) => b.triangles - a.triangles || b.draws - a.draws || (a.pass < b.pass ? -1 : 1));
  return {
    frames: frames.length,
    trianglesWorst: sums.length ? Math.max(...sums.map((s) => s.triangles)) : 0,
    drawsWorst: sums.length ? Math.max(...sums.map((s) => s.draws)) : 0,
    trianglesMean: Math.round(total.triangles / count),
    drawsMean: Math.round(total.draws / count * 100) / 100,
    renders, rendersAll: Object.values(renders).reduce((a, b) => a + b, 0), commits, reads, passes,
  };
}

/** How far a canvas's box is from its parent's, as a factor: 1 when they are the same, never under 1. */
function boxRatio(boxes) {
  let worst = 1;
  for (const b of boxes) {
    for (const i of [0, 1]) {
      const c = b.box[i], p = b.parent[i];
      if (c > 0 && p > 0) worst = Math.max(worst, c / p, p / c);
    }
  }
  return Math.round(worst * 10000) / 10000;
}

// ---------------------------------------------------------------------------------------------------------------------
// Measuring one state, once
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Opens a state's place and counts it. Resolves { ok, handed, data, errors, ms }: `handed` holds the numbers that are
 * ratchets, `data` what is only reported. `real` draws the counted second for real as well (slow: a second of Home is
 * a minute of software rendering) and adds how the two compare.
 */
async function measure(browser, url, tier, device, st, { real = false } = {}) {
  const t0 = Date.now();
  let opened = null;
  try {
    opened = await st.open(browser, { url, viewport: { ...device.viewport }, touch: device.touch, query: { ...tier.query }, init: INIT });
    const { page } = opened;
    await drawing(page, false);
    if (st.after) await st.after(page);
    if (st.idleMs) for (let t = 0; t < st.idleMs; t += HOP_MS) await jump(page, HOP_MS);

    // Onto a tick of the display, so every counted second holds the same 62 frames.
    const offBeat = await page.evaluate(() => performance.now()) % FRAME_MS;
    if (offBeat) await advance(page, FRAME_MS - offBeat);

    // The page as it stands, and every frame since it loaded in brief.
    const before = await snapshot(page, 0, true);
    if (!before.contexts.length) throw new Error('the probe saw no WebGL2 context: it was not in the page before the game');

    let drawn = null;
    if (real) {
      // The same second twice over would be two different seconds, so the really drawn one comes from a page of its
      // own: this call measures it, the caller compares it with a counted run of the same state.
      await page.evaluate(() => { window.__GATE_NODRAW = false; });
      await drawing(page, true);
    }
    await advance(page, WINDOW_MS);
    const during = await snapshot(page, before.totals.frameNo + 1, false);
    const second = readSecond(during.frames, during.contexts);
    if (real) {
      // A WebGL call only queues work: wait until the graphics process has carried all of it out.
      await settle(page, { frames: 0 });
      drawn = during.frames.reduce((sum, f) => sum + Object.values(f.ctx).reduce((a, c) => a + c.real, 0), 0);
      await page.evaluate(() => { window.__GATE_NODRAW = true; });
    }

    const alive = during.contexts.filter((c) => c.live);
    const handed = {
      trianglesWorst: second.trianglesWorst,
      trianglesMean: second.trianglesMean,
      drawsWorst: second.drawsWorst,
      drawsMean: second.drawsMean,
      programs: alive.reduce((sum, c) => sum + c.programs, 0),
      contexts: alive.length,
      contextsMade: during.totals.contextsMade,
      bufferBytes: alive.reduce((sum, c) => sum + c.bufferBytes, 0),
    };

    const data = {
      frames: second.frames,
      passes: second.passes,
      rendersByContext: second.renders,
      commits: second.commits,
      storageReadsPerSecond: second.reads,
      contexts: during.contexts.map((c) => ({
        id: c.id, live: c.live, released: c.released, lost: c.lost, canvas: `${c.canvas.width} x ${c.canvas.height}`, programs: c.programs, programsMade: c.programsMade,
        vertexBytes: c.vertexBytes, indexBytes: c.indexBytes, textureBytes: c.textureBytes, renderbufferBytes: c.renderbufferBytes,
      })),
      boxes: during.boxes,
    };

    // The heaviest frame since the page loaded, whichever screen it was on: reported, not a ratchet of this state.
    data.sinceLoad = { trianglesWorst: Math.max(0, ...before.frames.map((f) => f[3])), drawsWorst: Math.max(0, ...before.frames.map((f) => f[2])) };

    if (st.game) {
      // The game the helper played out to get here, a frame every 250 ms of it: the frames only the table's canvas
      // drew (it is the second one made; Home's is the first, the podium's the third). Its first frames are its
      // heaviest: every parked effect is drawn once in them. "Play" is the game after those.
      const game = before.frames.filter((f) => f[5].length === 1 && f[5][0] === 2);
      const play = game.slice(MOUNT_FRAMES);
      const most = (list, at) => (list.length ? Math.max(...list.map((f) => f[at])) : 0);
      handed.gameTrianglesWorst = most(game, 3);
      handed.gameDrawsWorst = most(game, 2);
      handed.playTrianglesWorst = most(play, 3);
      handed.playDrawsWorst = most(play, 2);
      data.gameFrames = game.length;
    }
    if (st.commits) handed.reactCommitsPerSecond = second.commits['react-dom'] ?? 0;

    if (st.rates && !real) {
      handed.rendersPerSecond = second.rendersAll;
      handed.canvasBoxRatio = boxRatio(during.boxes);

      // The same screen on a 144 Hz display. Two frames to let the change of rate through, then a second of ticks.
      await page.evaluate((hz) => window.__gate.setRafHz(hz), FAST_HZ);
      await advance(page, 2 * FRAME_MS);
      const fastFrom = await frameNo(page) + 1;
      await advance(page, WINDOW_MS);
      const fast = readSecond(await page.evaluate((f) => window.__probe.frames(f), fastFrom), during.contexts);
      handed.rendersPerSecondAt144 = fast.rendersAll;
      data.ticksAt144 = fast.frames;
      data.rendersByContextAt144 = fast.renders;
      await page.evaluate(() => window.__gate.setRafHz(null));
      await advance(page, 2 * FRAME_MS);

      // The tab hidden: two seconds pass, then the draw calls of one second are counted. No tick comes while hidden.
      await page.evaluate(() => window.__gate.hide(true));
      for (let t = 0; t < HIDDEN_WAIT_MS; t += HOP_MS) await jump(page, HOP_MS);
      const callsBefore = await drawCallsSoFar(page);
      const ticksBefore = await frameNo(page);
      await advance(page, WINDOW_MS);
      handed.hiddenDrawCalls = await drawCallsSoFar(page) - callsBefore;
      data.ticksWhileHidden = await frameNo(page) - ticksBefore;
    }

    const said = await page.evaluate(() => window.__probe.totals().errors);
    const errors = [...tidyErrors(opened.errors), ...said.map((e) => `${e.kind} (seen by the probe): ${String(e.text).slice(0, 300)}`)];
    return { ok: true, handed, data, errors: [...new Set(errors)], drawn, ms: Date.now() - t0, longTasks: during.totals.longTasks, longestTaskMs: during.totals.longestTaskMs };
  } catch (e) {
    return { ok: false, error: firstLine(e), errors: tidyErrors(opened?.errors ?? []), ms: Date.now() - t0 };
  } finally {
    await opened?.context.close().catch(() => {});
  }
}

/** How far apart two counts are, as a share of the larger. */
const apart = (a, b) => (Math.max(a, b) === 0 ? 0 : Math.abs(a - b) / Math.max(a, b));

/**
 * The probe's own check: Home's shot 0, two frames counted, then the next two really drawn and waited for. The shot is
 * held and still, so the four frames ask for the same things.
 */
async function measureRealCheck(browser, url, tier, device) {
  const t0 = Date.now();
  let opened = null;
  try {
    opened = await home(browser, { url, viewport: { ...device.viewport }, touch: device.touch, query: { ...tier.query }, init: INIT, pov: 0, hour: 'day' });
    const { page } = opened;
    await drawing(page, false);
    const from = await frameNo(page) + 1;
    await advance(page, 2 * FRAME_MS);
    await page.evaluate(() => { window.__GATE_NODRAW = false; });
    await settle(page, { frames: 2 }); // drawing on, two frames, and the graphics process has finished them
    const frames = (await page.evaluate((f) => window.__probe.frames(f, true), from)).filter((f) => f[2] > 0);
    const row = (f) => ({ draws: f[2], triangles: f[3], carriedOut: f[4] });
    const counted = frames.filter((f) => f[4] === 0).map(row);
    const drawn = frames.filter((f) => f[4] > 0).map(row);
    const pairs = Math.min(counted.length, drawn.length);
    let worst = 0;
    for (let i = 0; i < pairs; i++) worst = Math.max(worst, apart(counted[i].triangles, drawn[i].triangles), apart(counted[i].draws, drawn[i].draws));
    return { ok: true, counted, drawn, apart: pairs === 2 && drawn.every((d) => d.carriedOut === d.draws) ? worst : null, errors: tidyErrors(opened.errors), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: firstLine(e), errors: tidyErrors(opened?.errors ?? []), ms: Date.now() - t0 };
  } finally {
    await opened?.context.close().catch(() => {});
  }
}

/**
 * The table with motion on, for its canvas against its box only (plan file 17, problem 7). The table grows in with a
 * CSS animation, CSS animations run on real time whatever the pinned clock says, and the canvas takes its size from
 * wherever the animation had got to: so this number is not the same from run to run, and is never a ratchet.
 */
async function measureTableMotion(browser, url, tier, device) {
  const t0 = Date.now();
  let opened = null;
  try {
    opened = await table(browser, { url, viewport: { ...device.viewport }, touch: device.touch, query: { ...tier.query }, init: INIT, reducedMotion: false, seats: 6 });
    const boxes = await opened.page.evaluate(() => window.__probe.boxes());
    return { ok: true, ratio: boxRatio(boxes), boxes, errors: tidyErrors(opened.errors), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: firstLine(e), errors: tidyErrors(opened?.errors ?? []), ms: Date.now() - t0 };
  } finally {
    await opened?.context.close().catch(() => {});
  }
}

/**
 * Oscillators a second in a hidden tab (plan file 17, change 12: today the music's scheduler runs on while hidden).
 * The music writes each bar against the sound system's own clock, which runs in real time whatever the page's clock
 * says, so here the page's clock is walked forward in step with real time: a tenth of a second of one for a tenth of
 * the other. Sound starts on a key press. The answer comes in whole bars and is not the same from run to run.
 */
async function measureHiddenMusic(browser, url, tier, device) {
  const t0 = Date.now();
  let opened = null;
  try {
    opened = await home(browser, { url, viewport: { ...device.viewport }, touch: device.touch, query: { ...tier.query }, init: INIT, pov: 0, hour: 'day' });
    const { page } = opened;
    await drawing(page, false);
    const made = () => page.evaluate(() => window.__probe.totals().oscillators);
    /** Walks the page's clock for `seconds` of real time, a tenth of a second at a time, in step with it. */
    const walk = async (seconds, each = null) => {
      const start = Date.now();
      for (let i = 1; i <= Math.round(seconds * 10); i++) {
        await advance(page, 100);
        if (each && await each()) return true;
        const ahead = start + i * 100 - Date.now();
        if (ahead > 0) await sleep(ahead);
      }
      return false;
    };
    // The game unlocks sound on a key press and starts the music on the first press after the sound system is running.
    let playing = false;
    for (let press = 0; press < 6 && !playing; press++) {
      await page.keyboard.press('Shift');
      playing = await walk(1.5, async () => await made() > 0);
    }
    if (!playing) return { ok: false, error: 'the music did not start: no oscillator was made within 9 s of the key presses', errors: tidyErrors(opened.errors), ms: Date.now() - t0 };
    await walk(1);
    const shownFrom = await made();
    await walk(MUSIC_LISTEN_S);
    const shown = (await made() - shownFrom) / MUSIC_LISTEN_S;
    await page.evaluate(() => window.__gate.hide(true));
    await walk(HIDDEN_WAIT_MS / 1000);
    const hiddenFrom = await made();
    await walk(MUSIC_LISTEN_S);
    const hidden = (await made() - hiddenFrom) / MUSIC_LISTEN_S;
    const one = (x) => Math.round(x * 10) / 10;
    return { ok: true, shown: one(shown), hidden: one(hidden), errors: tidyErrors(opened.errors), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: firstLine(e), errors: tidyErrors(opened?.errors ?? []), ms: Date.now() - t0 };
  } finally {
    await opened?.context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The whole run
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Builds, serves, opens a browser and measures. `only` and `devices` narrow it (a narrowed run is not a gate result).
 * Resolves { measured, data, problems, lines, tasks }: `problems` is why the module fails, empty when it passes.
 */
async function measureAll({ root = ROOT, runs = RUNS, jobs = jobsWanted(), only = null, devices = null, log = () => {}, extras = true } = {}) {
  const dist = await ensureGateBuild(root, { log });
  const site = await serve(dist);
  const browser = await launch();
  const started = Date.now();
  try {
    const tasks = [];
    for (const tier of TIERS) {
      for (const device of DEVICES) {
        if (devices && !devices.includes(device.short)) continue;
        for (const st of statesFor(device)) {
          if (only && !only.includes(st.id)) continue;
          for (let run = 1; run <= runs; run++) tasks.push({ kind: 'state', tier, device, st, run, alone: st.motion === true });
        }
        if (extras && (!only || only.includes('table-motion'))) for (let run = 1; run <= runs; run++) tasks.push({ kind: 'table-motion', tier, device, run, alone: true });
      }
      if (extras && (!devices || devices.includes('computer')) && (!only || only.includes('hidden-music'))) {
        for (let run = 1; run <= runs; run++) tasks.push({ kind: 'hidden-music', tier, device: DEVICES[0], run });
      }
      if (extras && (!devices || devices.includes('computer')) && (!only || only.includes('real-check'))) tasks.push({ kind: 'real-check', tier, device: DEVICES[0], run: 1 });
    }
    // The longest first, so the lanes end together.
    const weight = (t) => (t.kind === 'hidden-music' ? 4 : t.st?.game ? 3 : t.kind === 'real-check' || t.st?.idleMs ? 2 : 1);
    tasks.sort((a, b) => weight(b) - weight(a));
    log(`${tasks.length} places to open, ${jobs} at a time, each state ${runs} time${runs === 1 ? '' : 's'}`);
    let done = 0;
    const results = await pool(tasks, jobs, async (t) => {
      const r = t.kind === 'state' ? await measure(browser, site.url, t.tier, t.device, t.st)
        : t.kind === 'table-motion' ? await measureTableMotion(browser, site.url, t.tier, t.device)
          : t.kind === 'real-check' ? await measureRealCheck(browser, site.url, t.tier, t.device)
            : await measureHiddenMusic(browser, site.url, t.tier, t.device);
      done++;
      const name = `${t.tier.id} ${t.device.short} ${t.kind === 'state' ? t.st.id : t.kind} run ${t.run}`;
      log(`${String(done).padStart(3)}/${tasks.length} ${name}: ${r.ok ? 'counted' : `FAILED: ${r.error}`} (${(r.ms / 1000).toFixed(1)} s${r.longTasks ? `; ${r.longTasks} long tasks, the longest ${Math.round(r.longestTaskMs)} ms` : ''})`);
      return r;
    });
    return { ...collect(tasks, results, { runs }), seconds: Math.round((Date.now() - started) / 1000), tasks: tasks.length };
  } finally {
    await browser.close().catch(() => {});
    await site.close().catch(() => {});
  }
}

/** Puts the runs of each state side by side: what is handed in, what is only reported, and what went wrong. */
function collect(tasks, results, { runs }) {
  const measured = {};
  const data = { runs, tiers: {}, notRepeatable: {} };
  const problems = [];
  const lines = [];
  const groups = new Map();
  tasks.forEach((t, i) => {
    const key = `${t.tier.id}\0${t.device.id}\0${t.kind === 'state' ? t.st.id : t.kind}`;
    if (!groups.has(key)) groups.set(key, { t, results: [] });
    groups.get(key).results[t.run - 1] = results[i];
  });

  for (const tier of TIERS) {
    for (const device of DEVICES) {
      const states = [...statesFor(device).map((st) => ({ kind: 'state', id: st.id, st })), { kind: 'table-motion', id: 'table-motion' }, { kind: 'hidden-music', id: 'hidden-music' }, { kind: 'real-check', id: 'real-check' }];
      for (const s of states) {
        const g = groups.get(`${tier.id}\0${device.id}\0${s.id}`);
        if (!g) continue;
        const name = `${tier.id}, ${device.id}, ${s.id}`;
        const failed = g.results.map((r, i) => (r?.ok ? null : `run ${i + 1}: ${r?.error ?? 'no result'}`)).filter(Boolean);
        if (failed.length) { problems.push(`${name} could not be counted (${failed.join('; ')})`); continue; }
        const said = [...new Set(g.results.flatMap((r) => r.errors ?? []))];
        if (said.length) problems.push(`${name}: the page reported ${said.length === 1 ? 'an error' : `${said.length} errors`}: ${said.slice(0, 3).join(' | ')}`);

        if (s.kind === 'table-motion') {
          const ratios = g.results.map((r) => r.ratio);
          ((data.notRepeatable.tableCanvasWithMotion ??= {})[tier.id] ??= {})[device.id] = { runs: ratios, least: Math.min(...ratios), most: Math.max(...ratios), canvases: g.results.map((r) => r.boxes.map((b) => `${b.box[0]} x ${b.box[1]} in ${b.parent[0]} x ${b.parent[1]}`).join(', ')) };
          continue;
        }
        if (s.kind === 'real-check') {
          const r = g.results[0];
          (data.realCheck ??= {})[tier.id] = { counted: r.counted, drawn: r.drawn, apart: r.apart };
          if (r.apart === null || r.apart > REAL_TOLERANCE) problems.push(`${name}: ${r.apart === null ? 'two counted frames and two really drawn ones, every draw call of them carried out, were not found' : `really drawn frames and counted ones are ${(r.apart * 100).toFixed(2)} % apart`} (the plan's check of the probe is ${REAL_TOLERANCE * 100} %)`);
          const f = (x) => (x ? `${n(x.triangles)} triangles in ${n(x.draws)} draw calls` : 'nothing');
          lines.push(`the probe's own check, ${tier.id}, Home shot 0: counted ${f(r.counted[0])}; really drawn ${f(r.drawn[0])}, ${n(r.drawn[0]?.carriedOut)} of them carried out; apart by ${r.apart === null ? 'not known' : `${(r.apart * 100).toFixed(2)} %`} (the plan allows ${REAL_TOLERANCE * 100} %)`);
          continue;
        }
        if (s.kind === 'hidden-music') {
          ((data.notRepeatable.oscillatorsPerSecond ??= {})[tier.id] ??= {})[device.id] = { hidden: g.results.map((r) => r.hidden), shown: g.results.map((r) => r.shown), listenedSeconds: MUSIC_LISTEN_S };
          continue;
        }

        // A ratchet is the same every run, or it is not a ratchet.
        const first = g.results[0].handed;
        const handed = {};
        for (const key of Object.keys(first).sort()) {
          const values = g.results.map((r) => r.handed[key]);
          handed[key] = Math.max(...values);
          if (values.some((v) => v !== values[0])) problems.push(`${name}: ${key} was not the same in every run (${values.map(n).join(', ')}): a ratchet has to repeat`);
        }
        ((measured[tier.id] ??= {})[device.id] ??= {})[s.id] = handed;
        ((data.tiers[tier.id] ??= {})[device.id] ??= {})[s.id] = { what: s.st.what, ...g.results[0].data };
      }
    }
  }

  // The report's lines: a table a device, then the plan's figures beside ours.
  for (const tier of TIERS) {
    const short = {};
    for (const device of DEVICES) {
      const states = measured[tier.id]?.[device.id];
      if (!states) continue;
      short[device.short] = states;
      lines.push(`${tier.id}, ${device.id}: triangles worst frame / mean, draw calls worst / mean, programs, contexts alive (made), buffer MB`);
      for (const [name, m] of Object.entries(states)) {
        const extra = [
          m.rendersPerSecond !== undefined ? `renders a second ${n(m.rendersPerSecond)}, at 144 Hz ${n(m.rendersPerSecondAt144)}, draw calls in a hidden second ${n(m.hiddenDrawCalls)}, canvas against its box ${n(m.canvasBoxRatio)}` : '',
          m.reactCommitsPerSecond !== undefined ? `react-dom commits a second ${n(m.reactCommitsPerSecond)}` : '',
          m.gameTrianglesWorst !== undefined ? `worst frame of the whole game ${n(m.gameTrianglesWorst)} triangles, ${n(m.gameDrawsWorst)} draw calls; once in play ${n(m.playTrianglesWorst)}, ${n(m.playDrawsWorst)}` : '',
        ].filter(Boolean).join('; ');
        lines.push(`  ${name}: ${n(m.trianglesWorst)} / ${n(m.trianglesMean)}, ${n(m.drawsWorst)} / ${n(m.drawsMean)}, ${n(m.programs)}, ${n(m.contexts)} (${n(m.contextsMade)}), ${n(mb(m.bufferBytes))}${extra ? `; ${extra}` : ''}`);
      }
      const worst = data.tiers[tier.id]?.[device.id]?.['home-pov0']?.passes ?? [];
      if (worst.length) lines.push(`  home-pov0, the worst frame pass by pass: ${worst.filter((p) => p.triangles > 2).map((p) => `${p.pass}: ${n(p.triangles)} triangles in ${n(p.draws)} draws`).join('; ')}; and ${worst.filter((p) => p.triangles <= 2).length} passes of one or two triangles (the bloom chain, the tilt-shift, the output)`);
    }
    if (Object.keys(short).length) {
      lines.push(`${tier.id}: the plan's figures for today (file 17, sections 3 and 6) beside what was counted here`);
      for (const row of PLAN_TODAY) {
        const got = row.from(short);
        if (got === undefined) continue;
        lines.push(`  ${row.what}: the plan ${n(row.plan)}, counted ${n(got)}`);
      }
    }
    const motion = data.notRepeatable.tableCanvasWithMotion?.[tier.id];
    for (const [device, m] of Object.entries(motion ?? {})) lines.push(`not a ratchet: ${tier.id}, ${device}, the table's canvas against its box with motion on was ${m.runs.map((r) => r.toFixed(4)).join(', ')} in ${m.runs.length} run${m.runs.length === 1 ? '' : 's'} (the plan: 1.21 to 1.35); the canvases: ${m.canvases.join(' | ')}`);
    const music = data.notRepeatable.oscillatorsPerSecond?.[tier.id];
    for (const [device, m] of Object.entries(music ?? {})) lines.push(`not a ratchet: ${tier.id}, ${device}, oscillators a second over ${m.listenedSeconds} real seconds: hidden ${m.hidden.map(n).join(', ')}; shown ${m.shown.map(n).join(', ')} (the plan: 29.8 hidden)`);
  }
  lines.push('NOT RUN, these numbers only: real renders a second on a real 144 Hz display, and any frame rate. The page\'s clock is held and the browser draws in software, so a second here holds exactly as many ticks as the faked display gives it; what is counted is on how many of them the game drew.');
  return { measured, data, problems, lines };
}

/** What Brian is told in every report: which of the plan's numbers this module does not hand in as ratchets, and why. */
const DECISIONS = [
  'The plan\'s "renders a second at 144 Hz" (134 today) is a real frame rate, which a held clock and software rendering cannot give: NOT RUN. What is handed in instead is on how many of a faked 144 Hz display\'s ticks the game drew in one second of the page\'s clock (144 today: every tick), which is the number milestone 2\'s cap brings down.',
  'Oscillators a second in a hidden tab is measured in real time and comes in whole bars of music, so it is not the same three times running: it is in the report\'s data with its spread and is not a ratchet. When milestone 2 has made it 0 every time, it can be handed in.',
  'The table\'s canvas against its box is 1 under reduced motion, which is how every ratchet here is counted. With motion on it follows a CSS animation that runs on real time and is different from run to run: that reading is in the data with its spread and is not a ratchet (milestone 1 fixes the canvas; the reduced-motion ratchet then guards it).',
  'Every state is counted under reduced motion, as the gate\'s pictures are taken (the closer look excepted: its 3D only exists with motion on). The worst frame is the worst of one second of a held state, not of a whole session: the figures taken over a whole game are the results state\'s "worst frame of the whole game" and "once in play", a frame every 250 ms of a game nobody types in.',
  'Today\'s one tier is stored as "high" (the plan\'s High is today\'s picture). Milestone 4 gives it ?gfx=high and adds medium and low; that is a change to tools/gate/counts.mjs, and new numbers to store.',
];

export async function run(ctx) {
  let out;
  try {
    out = await measureAll({ root: ctx.root, runs: runsWanted(), log: ctx.log });
  } catch (e) {
    return { ok: false, summary: `NOT RUN: the count gate could not start (${firstLine(e)})`, lines: [], data: {} };
  }
  const { measured, data, problems, lines } = out;
  const states = Object.values(measured).flatMap((tier) => Object.values(tier)).reduce((sum, device) => sum + Object.keys(device).length, 0);
  const lessRuns = data.runs < RUNS;
  if (lessRuns) problems.push(`each state was counted ${data.runs} time${data.runs === 1 ? '' : 's'} ($GATE_COUNTS_RUNS), not ${RUNS}: that is not a gate result`);
  if (!states) return { ok: false, summary: `NOT RUN: no state could be counted (${problems[0] ?? 'nothing was opened'})`, lines: problems, data };
  ctx.log(`${out.tasks} places opened in ${out.seconds} s`);
  return {
    ok: problems.length === 0,
    summary: problems.length
      ? `${problems.length} problem${problems.length === 1 ? '' : 's'}: ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}`
      : `${states} states counted ${data.runs} times each, every ratchet the same each time`,
    lines: [...problems.map((p) => `PROBLEM: ${p}`), ...lines],
    data,
    measured,
    decisions: DECISIONS,
    human: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// By hand
// ---------------------------------------------------------------------------------------------------------------------

async function main(argv) {
  const a = { states: null, devices: null, runs: undefined, jobs: undefined, from: ROOT, real: null, out: null, extras: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); return argv[++i]; };
    if (arg === '--states') a.states = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--devices') a.devices = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--runs') a.runs = next();
    else if (arg === '--jobs') a.jobs = next();
    else if (arg === '--from') a.from = resolve(next());
    else if (arg === '--real') a.real = next();
    else if (arg === '--out') a.out = resolve(next());
    else if (arg === '--no-extras') a.extras = false;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write('node tools/gate/counts.mjs [--states a,b] [--devices computer,phone] [--runs N] [--jobs N] [--from <checkout>] [--real <state>] [--no-extras] [--out <file.json>]\n(the top of the file says what each does)\n');
      return;
    } else throw new Error(`no such option: ${arg}`);
  }
  const log = (line) => process.stdout.write(`${line}\n`);
  const save = (result) => {
    const file = a.out ?? join(treeDir(a.from), 'counts', 'by-hand.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
    log(`written: ${file.replace(cacheDir(), '<cache>')}`);
  };

  if (a.real) {
    // The plan's check of the probe: the same second of one state, once with every frame really drawn, once counted.
    const device = DEVICES.find((d) => !a.devices || a.devices.includes(d.short));
    const st = statesFor(device).find((s) => s.id === a.real);
    if (!st) throw new Error(`no such state on ${device.short}: ${a.real}`);
    const site = await serve(await ensureGateBuild(a.from, { log }));
    const browser = await launch();
    try {
      log(`${st.id} on ${device.id}: one second counted, then the same second with every frame really drawn (slow)`);
      const counted = await measure(browser, site.url, TIERS[0], device, { ...st, rates: false });
      if (!counted.ok) throw new Error(`counted run failed: ${counted.error}`);
      const drawn = await measure(browser, site.url, TIERS[0], device, { ...st, rates: false }, { real: true });
      if (!drawn.ok) throw new Error(`really drawn run failed: ${drawn.error}`);
      const rows = ['trianglesWorst', 'trianglesMean', 'drawsWorst', 'drawsMean'].map((key) => {
        const c = counted.handed[key], d = drawn.handed[key];
        return { key, counted: c, drawn: d, differBy: apart(c, d) };
      });
      for (const r of rows) log(`  ${r.key}: counted ${n(r.counted)}, really drawn ${n(r.drawn)}, apart by ${(r.differBy * 100).toFixed(3)} %`);
      log(`  really drawn: ${n(drawn.drawn)} draw calls carried out over ${drawn.data.frames} frames in ${(drawn.ms / 1000).toFixed(1)} s; counted run ${(counted.ms / 1000).toFixed(1)} s`);
      const ok = rows.every((r) => r.differBy <= REAL_TOLERANCE) && drawn.drawn > 0;
      log(ok ? `within ${REAL_TOLERANCE * 100} %: the probe counts what is drawn` : `NOT within ${REAL_TOLERANCE * 100} %`);
      save({ state: st.id, device: device.id, rows, drawCallsCarriedOut: drawn.drawn, frames: drawn.data.frames, ok });
      process.exitCode = ok ? 0 : 1;
    } finally {
      await browser.close().catch(() => {});
      await site.close().catch(() => {});
    }
    return;
  }

  const out = await measureAll({ root: a.from, runs: runsWanted(a.runs), jobs: jobsWanted(a.jobs), only: a.states, devices: a.devices, log, extras: a.extras });
  for (const line of out.lines) log(line);
  for (const p of out.problems) log(`PROBLEM: ${p}`);
  log(`${out.tasks} places opened in ${out.seconds} s; ${out.problems.length ? `${out.problems.length} problems` : 'no problems'}`);
  save({ measured: out.measured, data: out.data, problems: out.problems });
  process.exitCode = out.problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`counts: ${e?.stack ?? e}\n`);
    process.exitCode = 1;
  }).finally(() => process.stdout.write('', () => process.exit(process.exitCode ?? 0)));
}
