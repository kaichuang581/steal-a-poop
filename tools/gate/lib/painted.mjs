// The one way a gate tool builds, serves, opens and photographs the painted game (plan file 16, section 4.1 d).
// Every picture, count and anchor tool goes through here, so they all look at the same build, in the same browser,
// under the same clock and the same dice. What is true about driving the game, and how it was measured, is in README.md
// beside this file.
//
//   import { ensureGateBuild, serve, launch, home, shoot } from './lib/painted.mjs';
//   const dist = await ensureGateBuild(root);
//   const site = await serve(dist);
//   const browser = await launch();
//   const { page, context, errors } = await home(browser, { url: site.url, pov: 0, hour: 'day' });
//   const png = await shoot(page);
//   await context.close(); await browser.close(); await site.close();   // in a finally: an open browser holds the tool open
//
// Nothing here writes into the repo: builds, base checkouts and locks live in the cache directory.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The checkout this file belongs to: its node_modules run vite and the browser, whichever checkout is being built. */
export const ROOT = resolve(HERE, '..', '..', '..');

// ---------------------------------------------------------------------------------------------------------------------
// The cache, the tree's key and locks
// ---------------------------------------------------------------------------------------------------------------------

/** Where builds, base checkouts, shots and locks are kept: $GATE_CACHE, or ~/.cache/fleeced-gate. Made if missing. */
export function cacheDir() {
  const dir = resolve(process.env.GATE_CACHE || join(homedir(), '.cache', 'fleeced-gate'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${root}: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

/** The files `git status` calls changed or new, as [state, path] pairs. Reads only. */
function dirtyFiles(root) {
  // -z: one entry per NUL, paths as they are (no quoting); a rename is followed by the path it came from.
  const parts = git(root, ['status', '--porcelain', '--untracked-files=all', '-z']).split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const state = parts[i].slice(0, 2), path = parts[i].slice(3);
    if (state[0] === 'R' || state[0] === 'C') i++; // the old name: its content is gone or unchanged, the new path says it all
    out.push([state, path]);
  }
  return out.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

/**
 * A name for exactly this source: the commit's sha when nothing is changed or new, else the sha plus a hash of every
 * changed or new file's state and contents. A build is reused only under the same key, so it is only ever reused for
 * the same source. Env files are read by vite but hidden from git, so they are hashed in as well.
 */
export function treeKey(root) {
  const sha = git(root, ['rev-parse', 'HEAD']).trim();
  const dirty = dirtyFiles(root);
  const envFiles = readdirSync(root).filter((f) => f === '.env' || f.startsWith('.env.')).sort();
  if (!dirty.length && !envFiles.length) return sha;
  const h = createHash('sha256');
  const add = (state, path) => {
    h.update(`${state}\0${path}\0`);
    const full = join(root, path);
    try {
      const st = lstatSync(full);
      if (st.isFile()) h.update(readFileSync(full));
      else h.update(`<${st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : 'other'}>`);
    } catch { h.update('<gone>'); }
    h.update('\0');
  };
  for (const [state, path] of dirty) add(state, path);
  for (const f of envFiles) add('env', f);
  return `${sha}-${h.digest('hex').slice(0, 12)}`;
}

/**
 * The one folder of the cache that belongs to this source: <cache>/<treeKey>. Its gate build is there (dist-gate), the
 * runner's test report (vitest.json), and whatever a tool keeps about that tree: shots, counts. Made if missing.
 */
export function treeDir(root) {
  const dir = join(cacheDir(), treeKey(root));
  mkdirSync(dir, { recursive: true });
  return dir;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/**
 * Runs `fn` while holding a lock named `name`, so two tools never build the same thing or make the same checkout at
 * once. The lock is a directory (making one either works or fails, on every file system); it holds its owner's pid, and
 * a lock whose owner has died is taken over.
 */
export async function withLock(name, fn, { waitMs = 30 * 60_000, log = () => {} } = {}) {
  const dir = join(cacheDir(), 'locks');
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.lock`);
  const t0 = Date.now();
  let said = false;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'owner'), `${process.pid}\n${new Date().toISOString()}\n`);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let owner = 0;
      try { owner = Number(readFileSync(join(lock, 'owner'), 'utf8').split('\n')[0]); } catch { /* being written */ }
      // No owner file after a few seconds, or an owner that is no longer running: the lock was left behind.
      const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if ((owner && !pidAlive(owner)) || (!owner && age > 10_000)) { rmSync(lock, { recursive: true, force: true }); continue; }
      if (Date.now() - t0 > waitMs) throw new Error(`waited ${Math.round(waitMs / 1000)} s for the lock ${lock} (held by pid ${owner || '?'})`);
      if (!said) { said = true; log(`waiting for ${name} (pid ${owner || '?'} has it)`); }
      await sleep(250);
    }
  }
  try { return await fn(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

/**
 * Loaded into every node process this file starts (node --import): the child ends the moment its stdin closes. The
 * other end of that pipe is held by this process and never written to, so it closes when this process ends, however
 * it ends: a tool that throws, a process.exit, Ctrl-C, even kill -9. Without it a preview server outlived the tool
 * that forgot to close it (measured: one `vite preview` left running per run that threw). stdin is not counted as work
 * to wait for, so a child that finishes by itself (a build) still ends by itself.
 */
const WITH_PARENT = `data:text/javascript,${encodeURIComponent("process.stdin.on('end',()=>process.exit(0));process.stdin.on('error',()=>process.exit(0));process.stdin.resume();process.stdin.unref?.();")}`;

/** Runs a command to its end, keeping what it printed. Never through a shell. `stdin: 'pipe'` is for a WITH_PARENT child. */
function run(cmd, args, { cwd, env, timeoutMs = 20 * 60_000, stdin = 'ignore' } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { cwd, env, stdio: [stdin, 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); fail(e); });
    child.on('close', (code) => { clearTimeout(timer); done({ code: code ?? 1, stdout, stderr }); });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The base checkout and the gate build
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The base commit, checked out on its own under <cache>/wt/<sha> (a detached `git worktree add`: the one git command in
 * the gate that changes anything, and it only adds an entry under the repo's worktree list). Reused when it is there,
 * at that commit, and nothing in it is changed or new: a base that has been written into is not the base. Anything
 * else there is deleted as plain files and checked out again. Its node_modules is a link to this checkout's when the
 * two package-lock.json files are the same byte for byte; otherwise `npm ci` runs there. Returns the directory.
 * Do not write into it: a tool's output belongs in the cache (treeDir).
 */
export async function ensureBaseCheckout(root, sha, { log = () => {} } = {}) {
  const full = git(root, ['rev-parse', '--verify', `${sha}^{commit}`]).trim();
  const dir = join(cacheDir(), 'wt', full);
  return withLock(`wt-${full}`, async () => {
    // What is wrong with what is there now, in words; '' when it is a checkout of exactly that commit and nothing more.
    const wrong = () => {
      let top = '', at = '';
      try {
        top = git(dir, ['rev-parse', '--show-toplevel']).trim();
        at = git(dir, ['rev-parse', 'HEAD']).trim();
      } catch { return 'it is not a checkout'; }
      if (realpathSync(top) !== realpathSync(dir)) return 'it is not a checkout of its own';
      if (at !== full) return `it is at ${at.slice(0, 7)}`;
      const changed = dirtyFiles(dir);
      return changed.length ? `${changed.length} of its files are changed or new: ${changed.slice(0, 3).map(([, path]) => path).join(', ')}${changed.length > 3 ? ', ...' : ''}` : '';
    };
    if (existsSync(dir)) {
      const why = wrong();
      if (why) {
        log(`the checkout at ${dir} cannot be used (${why}): making it again`);
        // Plain files only (a link is taken away, never followed). No `git worktree remove` and no `git worktree
        // prune`: those reach into the list of every checkout the repo has, and the owner's are on it.
        rmSync(dir, { recursive: true, force: true });
      }
    }
    if (!existsSync(dir)) {
      mkdirSync(dirname(dir), { recursive: true });
      log(`checking out ${full.slice(0, 7)} at ${dir}`);
      // --force matters only when this very path is still on the repo's list from a checkout whose folder has gone
      // (deleted above, or by hand with the cache): git then drops that one entry and makes it anew.
      git(root, ['worktree', 'add', '--force', '--detach', dir, full]);
    }
    const modules = join(dir, 'node_modules');
    // A link left pointing at nothing (the head's node_modules was installed again) is taken away and made anew.
    if (!existsSync(modules) && lstatSync(modules, { throwIfNoEntry: false })) rmSync(modules, { force: true });
    if (!existsSync(modules)) {
      const same = existsSync(join(root, 'package-lock.json')) && existsSync(join(dir, 'package-lock.json'))
        && readFileSync(join(root, 'package-lock.json')).equals(readFileSync(join(dir, 'package-lock.json')));
      if (same && existsSync(join(root, 'node_modules'))) {
        symlinkSync(join(root, 'node_modules'), modules, 'dir');
      } else {
        log(`package-lock.json differs from the head's: npm ci in ${dir}`);
        const r = await run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, env: process.env });
        if (r.code !== 0) throw new Error(`npm ci failed in ${dir}:\n${r.stderr.slice(-2000)}`);
      }
    }
    return dir;
  }, { log });
}

/** The switches a build reads from its surroundings. The gate build sets every one, so no shell or env file leaks in. */
const BUILD_ENV = { VITE_TOUR: '1', VITE_SERVER_URL: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_TURNSTILE_SITE_KEY: '', VITE_SKIN: '' };

/**
 * The gate's own build of the checkout at `dir`: `VITE_TOUR=1 npx vite build --outDir <cache>/<treeKey>/dist-gate
 * --emptyOutDir`, run there. It is never deployed. (Today VITE_TOUR changes nothing; a later milestone makes it switch
 * on ?season=.) No game server, no sign-in and the painted look, whatever the shell has set. Skipped when that key is
 * already built. Returns the output directory.
 */
export async function ensureGateBuild(dir, { log = () => {} } = {}) {
  const key = treeKey(dir);
  const home = join(cacheDir(), key);
  const out = join(home, 'dist-gate');
  const stamp = join(home, 'dist-gate.json');
  const built = () => existsSync(stamp) && existsSync(join(out, 'index.html'));
  if (built()) return out;
  return withLock(`build-${key}`, async () => {
    if (built()) return out; // someone else built it while we waited
    mkdirSync(home, { recursive: true });
    rmSync(stamp, { force: true });
    const vite = join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(vite)) throw new Error(`no vite in ${dir}/node_modules: run npm ci there (or ensureBaseCheckout)`);
    const env = { ...process.env, ...BUILD_ENV };
    delete env.VITE_BASE; // the gate always builds for the default address, /steal-a-poop/
    log(`building ${key.slice(0, 20)} into ${out}`);
    const t0 = Date.now();
    // What `npx vite build` runs, without npx in between.
    const r = await run(process.execPath, ['--import', WITH_PARENT, vite, 'build', '--outDir', out, '--emptyOutDir'], { cwd: dir, env, stdin: 'pipe' });
    if (r.code !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the gate build failed in ${dir} (exit ${r.code}):\n${(r.stderr || r.stdout).slice(-3000)}`);
    // Written last: a build that was killed half way has no stamp, and is built again.
    writeFileSync(stamp, `${JSON.stringify({ key, from: dir, seconds: Math.round((Date.now() - t0) / 100) / 10, node: process.version, at: new Date().toISOString() }, null, 2)}\n`);
    return out;
  }, { log });
}

// ---------------------------------------------------------------------------------------------------------------------
// Serving a build
// ---------------------------------------------------------------------------------------------------------------------

/** The address a build expects to live under, read from its own page: "/steal-a-poop/" unless it was built otherwise. */
export function basePathOf(distDir) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const m = /<script[^>]+src="([^"]*?)assets\/[^"]+\.js"/.exec(html);
  const base = m ? m[1] : '/';
  return base.startsWith('/') ? base : '/';
}

function freePort() {
  return new Promise((done, fail) => {
    const s = createServer();
    s.unref();
    s.on('error', fail);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => done(port)); });
  });
}

/**
 * Serves a build the way the site is served: `npx vite preview --outDir <distDir> --host 127.0.0.1 --port <free>
 * --strictPort`, under the base path the build was made for. Resolves { url, port, base, close } once the page answers.
 * Close it when done. A server nobody closed ends with the process that started it (WITH_PARENT), never after it.
 */
export async function serve(distDir, { timeoutMs = 30_000 } = {}) {
  const dist = resolve(distDir);
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`nothing built at ${dist}`);
  const base = basePathOf(dist);
  const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await freePort();
    // What `npx vite preview` runs, started directly so that closing it stops the server itself and leaves no child
    // behind. WITH_PARENT ends it when this process ends without closing it; and it is not counted as work this
    // process waits for (unref), so a tool that forgot to close it still ends, and the server with it.
    const child = spawn(process.execPath, ['--import', WITH_PARENT, vite, 'preview', '--outDir', dist, '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--base', base], {
      cwd: ROOT, env: { ...process.env, VITE_BASE: base }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.on('error', () => {}); // the server went first: nothing to say
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.unref();
    for (const pipe of [child.stdin, child.stdout, child.stderr]) pipe.unref?.();
    let exited = false;
    child.on('exit', () => { exited = true; });
    const close = () => new Promise((done) => {
      if (exited) return done();
      child.ref(); // from here on its going is something to wait for: without this an `await site.close()` at a script's end is cut short
      child.once('exit', () => done());
      child.kill('SIGTERM');
      setTimeout(() => { if (!exited) child.kill('SIGKILL'); }, 3000).unref();
    });
    const url = `http://127.0.0.1:${port}${base}`;
    const t0 = Date.now();
    while (!exited && Date.now() - t0 < timeoutMs) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok && /<div id="root">/.test(await res.text())) return { url, port, base, close };
      } catch { /* not up yet */ }
      await sleep(100);
    }
    lastError = output.trim().slice(-1500);
    await close();
    if (!exited || /already in use|EADDRINUSE/i.test(lastError)) continue; // the port was taken in between: try another
    break;
  }
  throw new Error(`vite preview did not come up for ${dist}:\n${lastError}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------------------------------------------------

/** Software rendering: the same picture on a laptop and on the build server, whatever graphics chip either has. */
export const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'];

let endsOnSignal = false;
/**
 * Playwright takes SIGTERM and SIGHUP for itself once a browser is up: it closes the browser and leaves the process
 * running (measured: a tool waiting on a timer outlived `kill <pid>`, its preview server with it). A gate tool that is
 * told to stop must stop, so the signal ends the process as it would have; Playwright's own exit hook then takes the
 * browser and its profile folder down, and the server goes with its parent.
 */
function endOnSignal() {
  if (endsOnSignal) return;
  endsOnSignal = true;
  for (const [signal, code] of [['SIGTERM', 143], ['SIGHUP', 129]]) process.once(signal, () => process.exit(code));
}

/** Chromium, drawing in software. Set PW_CHROMIUM to use an already-installed Chromium, as playwright.config.ts does. */
export function launch(options = {}) {
  endOnSignal();
  return chromium.launch({
    ...options,
    args: [...CHROMIUM_ARGS, ...(options.args ?? [])],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening the painted game
// ---------------------------------------------------------------------------------------------------------------------

/** The plan's pinned moment and seed (file 16, section 4.1 d). A time with no zone is read in the page's own zone. */
export const PINNED = { time: '2026-11-16T12:00:00', seed: 20261116, timezoneId: 'UTC', locale: 'en-US' };

/** The epoch of a wall-clock time in a named zone ("2026-11-16T12:00:00" in "UTC"). A time that names its own zone, a Date and a number pass through. */
export function epochOf(time, timezoneId = PINNED.timezoneId) {
  if (typeof time === 'number') return time;
  if (time instanceof Date) return time.getTime();
  if (/(Z|[+-]\d\d:?\d\d)$/.test(time)) return new Date(time).getTime();
  const asUtc = new Date(`${time}Z`).getTime();
  if (!Number.isFinite(asUtc)) throw new Error(`not a time: ${time}`);
  // What the zone's clocks read at that instant, taken back off: twice, so a change of the clocks nearby settles.
  const wall = (t) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezoneId, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  let t = asUtc - (wall(asUtc) - asUtc);
  t = asUtc - (wall(t) - t);
  return t;
}

/**
 * What a browser that has been here before has saved, so no first-visit question stands in front of the game. Each key
 * and the shape of its value come from the game's own code (file and line in README.md):
 *   sap:age-check  the first-visit form's answers (country, age, a parent's agreement)
 *   sap:tourDone   the tutorial has been taken
 *   sap:settings   the player's name; the rest is filled in from the game's defaults
 *   sap:tips       the two coach tips shown once in a first game have been seen
 */
export function firstVisitAnswers(at) {
  return {
    'sap:age-check': { country: 'US', age: 18, parent: false, at },
    'sap:tourDone': true,
    'sap:settings': { name: 'Brian' },
    'sap:tips': ['modifier', 'wool'],
  };
}

/** What a response for a file with this ending must say it is. Anything else is the page handed back in its place. */
const TYPES = {
  js: /javascript/, mjs: /javascript/, css: /^text\/css/, html: /^text\/html/, json: /json/, txt: /^text\/plain/,
  png: /^image\/png/, webp: /^image\/webp/, jpg: /^image\/jpeg/, jpeg: /^image\/jpeg/, svg: /^image\/svg\+xml/, gif: /^image\/gif/, ico: /^image\/(x-icon|vnd\.microsoft\.icon)/,
  woff2: /font\/woff2|application\/font-woff2/, woff: /font\/woff|application\/font-woff/, ttf: /font\/ttf|application\/(x-font-ttf|font-sfnt)/,
  glb: /^model\/gltf-binary/, wasm: /^application\/wasm/,
};

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * Until milestone 1 ships the fonts with the game, the page fetches them from two outside hosts. Each answer is kept in
 * the cache directory the first time and replayed after that, so base and head are set in the very same font files and a
 * slow or missing network cannot change a picture.
 */
async function cacheFonts(context) {
  const dir = join(cacheDir(), 'fonts');
  mkdirSync(dir, { recursive: true });
  await context.route(FONT_HOSTS, async (route) => {
    const url = route.request().url();
    const file = join(dir, createHash('sha256').update(url).digest('hex').slice(0, 32));
    try {
      if (existsSync(`${file}.json`) && existsSync(`${file}.body`)) {
        const meta = JSON.parse(readFileSync(`${file}.json`, 'utf8'));
        return await route.fulfill({ status: 200, headers: meta.headers, body: readFileSync(`${file}.body`) });
      }
      const res = await route.fetch();
      const body = await res.body();
      if (res.status() === 200) {
        const headers = { 'content-type': res.headers()['content-type'] ?? '', 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' };
        // Each file is written beside its place and moved in, so another tool reading the cache at the same moment
        // finds a whole font or none; the .json goes in last and is what says the pair is there.
        const mine = `${file}.${process.pid}.tmp`;
        writeFileSync(mine, body);
        renameSync(mine, `${file}.body`);
        writeFileSync(mine, JSON.stringify({ url, headers }));
        renameSync(mine, `${file}.json`);
      }
      return await route.fulfill({ response: res, body });
    } catch {
      return route.abort('failed').catch(() => {});
    }
  });
}

/** What this file remembers about each page it opened: the pinned moment, the seed, the requests on their way. */
const OPEN = new WeakMap();
const opened = (page) => {
  const o = OPEN.get(page);
  if (!o) throw new Error('this page was not opened by openPainted');
  return o;
};

/**
 * How long, in real time, one wait may take before it is given up: 300 s, or $GATE_PATIENCE_MS, or what the place was
 * given as `timeoutMs`. It is long on purpose. A place takes 10 to 25 s here, but the graphics process shares the
 * machine: with other heavy jobs running beside it, two frames of Home once took 479 s instead of 2.4 (README.md).
 */
export const PATIENCE_MS = Number(process.env.GATE_PATIENCE_MS) > 0 ? Number(process.env.GATE_PATIENCE_MS) : 300_000;
const patienceOf = (page) => OPEN.get(page)?.patienceMs ?? PATIENCE_MS;

/** `work`, or a plain failure after `ms` of real time: a call into a page whose graphics process is stuck never comes back by itself. */
function within(ms, what, work) {
  let timer;
  const late = new Promise((_, fail) => { timer = setTimeout(() => fail(new Error(`gave up after ${ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)} s of real time waiting for ${what}`)), ms); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * A fresh browser context with the painted game open in it, and nothing left to chance that can be pinned:
 *   - the clock is Playwright's (page.clock), installed held at `time`. It does not run by itself: this file moves it
 *     (advance, jump, until), because under software rendering a real second holds a different number of frames each
 *     run, and the doors, the turn clock and every animation count time. See README.md, "The clock".
 *   - Math.random, crypto.getRandomValues and crypto.randomUUID come from `seed` (determinism.js), in the page before
 *     any of its own code.
 *   - localStorage holds a returning player's answers (firstVisitAnswers), plus `storage` (a value of null takes a
 *     key out; a string is stored as it is; anything else as JSON).
 *   - reduced motion unless `reducedMotion: false`; the zone is UTC and the language en-US, so noon is noon everywhere.
 * `query` is added to the address (dpr 1 unless it says otherwise). `init` is more init scripts (strings of code, or
 * { path } / { content }). `before({ context, page, errors })` runs once everything is set and nothing is loaded yet,
 * for a route or a listener that has to be there from the first request. `fonts` is 'cache' (see cacheFonts), 'live'
 * (fetched every time) or 'block'. Returns { context, page, errors }: errors fills with every page error, console error, failed
 * request, answer of 400 or more, and answer whose type does not match its file's ending.
 * The page is loaded but not yet waited for: call waitReady, or use home() and the other places below.
 */
export async function openPainted(browser, {
  url, query = {}, viewport = { width: 1280, height: 800 }, touch = false, reducedMotion = true,
  time = PINNED.time, seed = PINNED.seed, storage = {}, init = [], before = null,
  timezoneId = PINNED.timezoneId, locale = PINNED.locale, fonts = 'cache',
} = {}) {
  if (!url) throw new Error('openPainted needs the url of a served build (serve(dist).url)');
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference', timezoneId, locale, colorScheme: 'light', serviceWorkers: 'block',
  });
  // Playwright's own half minute for a click or an evaluate is too short when the page is busy building or drawing.
  context.setDefaultTimeout(PATIENCE_MS);
  try {
    const at = epochOf(time, timezoneId);
    // First in, so it keeps the browser's own timers before the pinned clock takes their names.
    await context.addInitScript({ content: `window.__GATE_SEED = ${Number(seed) >>> 0};\n${readFileSync(join(HERE, 'determinism.js'), 'utf8')}` });
    const saved = { ...firstVisitAnswers(at), ...storage };
    const entries = Object.entries(saved).map(([k, v]) => [k, v === null ? null : typeof v === 'string' ? v : JSON.stringify(v)]);
    await context.addInitScript((list) => {
      try {
        // Only what is not there yet: a value the game has written since is the game's.
        for (const [k, v] of list) if (v !== null && localStorage.getItem(k) === null) localStorage.setItem(k, v);
      } catch { /* a page with no storage of its own (about:blank) */ }
    }, entries);
    for (const script of init) await context.addInitScript(typeof script === 'string' ? { content: script } : script);
    if (fonts === 'cache') await cacheFonts(context);
    else if (fonts === 'block') await context.route(FONT_HOSTS, (route) => route.abort('blockedbyclient'));

    const page = await context.newPage();
    const errors = [];
    // What the page is still fetching: nothing is called ready while a request is on its way.
    const inFlight = new Set();
    page.on('request', (r) => inFlight.add(r));
    page.on('requestfinished', (r) => inFlight.delete(r));
    page.on('requestfailed', (r) => inFlight.delete(r));
    OPEN.set(page, { at, seed: Number(seed) >>> 0, inFlight, errors });
    page.on('pageerror', (e) => errors.push({ kind: 'pageerror', text: String(e?.stack || e?.message || e) }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push({ kind: 'console', text: m.text(), url: m.location()?.url || '' }); });
    page.on('requestfailed', (r) => errors.push({ kind: 'requestfailed', text: r.failure()?.errorText ?? 'failed', url: r.url() }));
    page.on('response', (r) => {
      const status = r.status();
      const address = r.url();
      if (status >= 400) errors.push({ kind: 'status', text: String(status), url: address });
      if (status < 200 || status >= 300) return;
      let ending = '';
      try { ending = (/\.([a-z0-9]+)$/i.exec(new URL(address).pathname)?.[1] ?? '').toLowerCase(); } catch { /* not an address */ }
      const want = TYPES[ending];
      const got = r.headers()['content-type'] ?? '';
      if (want && !want.test(got)) errors.push({ kind: 'content-type', text: `.${ending} answered as ${got || 'nothing'}`, url: address });
    });

    // Held at the pinned moment from the page's first instant: Date.now() is `at` and performance.now() is 0.
    // (pauseAt installs the same clock page.clock.install does. install followed by pauseAt would let the few real
    // milliseconds between the two calls leak into performance.now, a different few each run.)
    await page.clock.pauseAt(at);

    // The caller's last word before the page loads: a route that answers 404, a listener, anything that must be in first.
    if (before) await before({ context, page, errors });

    const params = new URLSearchParams({ dpr: '1', ...Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])) });
    const target = new URL(url);
    for (const [k, v] of params) target.searchParams.set(k, v);
    await page.goto(target.href, { waitUntil: 'load' });
    return { context, page, errors };
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The clock, by hand
// ---------------------------------------------------------------------------------------------------------------------

/** One frame of a 60 Hz screen, in the pinned clock's whole milliseconds: its frames fall on multiples of 16. */
export const FRAME_MS = 16;

/**
 * Under the pinned clock the game's timers and frames run inside the call that moves the clock, so anything they throw
 * comes back as that call's failure instead of as a page error. It is the page's fault, not the tool's: it goes into
 * the page's `errors` as a pageerror and the clock carries on (it has already finished the step). A browser that has
 * gone away is still a failure of the call.
 */
async function moveClock(page, move) {
  try {
    await move();
  } catch (e) {
    const text = String(e?.message ?? e);
    if (page.isClosed() || /Target (page, context or browser has been )?closed|browser has been closed|crashed/i.test(text)) throw e;
    const o = OPEN.get(page);
    if (!o) throw e;
    o.errors.push({ kind: 'pageerror', text: text.replace(/^clock\.\w+: /, '') });
  }
}

/** Runs the page's clock on by `ms`: every timer fires in turn and a frame is drawn every 16 ms, as on a real screen. */
export async function advance(page, ms = FRAME_MS) {
  await moveClock(page, () => page.clock.runFor(ms));
}

/**
 * Jumps the page's clock `ms` ahead in one go: each timer that came due fires once, and one frame is drawn. For
 * crossing a wait nothing needs to be seen in (a turn running out) at one frame's cost instead of sixty a second.
 */
export async function jump(page, ms) {
  await moveClock(page, () => page.clock.fastForward(ms));
}

/** Whether WebGL draws (true) or only goes through the motions (false). See determinism.js, noDraw. */
export async function drawing(page, on) {
  await page.evaluate((v) => window.__gate.noDraw(!v), on);
}

/**
 * Steps the clock until `test` (a function run in the page, given `arg`) answers something truthy, and returns that
 * answer. The page is asked after every step, so the state is caught on the first frame it holds. Never a bare sleep:
 * the clock only moves here, `step` ms at a time, and `timeoutMs` is real time, the patience for a slow machine.
 */
export async function until(page, test, arg, { step = FRAME_MS, timeoutMs, what = 'the page to be ready', hop = false } = {}) {
  timeoutMs ??= patienceOf(page);
  return within(timeoutMs + 10_000, what, untilInner(page, test, arg, { step, timeoutMs, what, hop }));
}

async function untilInner(page, test, arg, { step, timeoutMs, what, hop }) {
  const t0 = Date.now();
  let steps = 0;
  for (;;) {
    const got = await page.evaluate(test, arg);
    if (got) return got;
    if (Date.now() - t0 > timeoutMs) {
      const where = await page.evaluate(() => ({
        doors: document.querySelector('.sk-doors')?.getAttribute('data-phase') ?? null, bootDoors: !!document.getElementById('boot-doors'),
        canvases: [...document.querySelectorAll('canvas[data-engine]')].map((c) => (c.hasAttribute('data-drawn') ? 'drawn' : 'not drawn')),
        clock: Math.round(performance.now()),
      })).catch(() => null);
      throw new Error(`waited ${Math.round((Date.now() - t0) / 1000)} s (${steps} steps of ${step} ms) for ${what}; the page: ${JSON.stringify(where)}`);
    }
    if (hop) await jump(page, step); else await advance(page, step);
    steps++;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Ready, clicks and the shot
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Whether the page is in a state worth photographing. Runs in the page.
 *   - no loading doors: neither the game's (.sk-doors) nor the ones the page came with (#boot-doors);
 *   - every three.js canvas has drawn (data-drawn) and still has its context (`loose` names a place whose canvases
 *     never mark themselves, the item preview's);
 *   - on Home: the farm is shown (.sk-farm-fade[data-ready]) and the word list is in (no menu row still says Loading);
 *   - every stylesheet and picture has arrived and no font is still loading;
 *   - `need`, when given, is a selector that must be on the page (the screen being waited for).
 */
function pageIsReady({ home = false, loose = null, need = null } = {}) {
  if (need && !document.querySelector(need)) return false;
  if (document.querySelector('.sk-doors') || document.getElementById('boot-doors')) return false;
  const canvases = [...document.querySelectorAll('canvas[data-engine]')];
  for (const c of canvases) {
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl || gl.isContextLost()) return false;
    if (!c.hasAttribute('data-drawn') && !(loose && c.closest(loose))) return false;
  }
  if (home) {
    if (!canvases.length || !document.querySelector('.sk-farm-fade[data-ready]')) return false;
    const rows = [...document.querySelectorAll('.sk-menu-item')];
    if (!rows.length || rows.some((r) => /^Loading/.test(r.querySelector('.sk-menu-label')?.textContent ?? ''))) return false;
  }
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => !l.sheet)) return false;
  if ([...document.images].some((i) => !i.complete)) return false;
  return document.fonts.status === 'loaded';
}

/** Lets the browser itself take a breath: two of its own frames (not the pinned clock's), so observers and layout catch up. */
async function breathe(page) {
  await page.evaluate(() => new Promise((done) => window.__gate.real.raf(() => window.__gate.real.raf(() => done()))));
}

/**
 * Steps the clock until `test` holds in the page and nothing is being fetched. Between steps the browser gets real
 * frames of its own (`calm`), because a canvas is made when the browser reports its size and a lazy piece when it
 * arrives, both in real time: without the pause the same thing lands on a different tick of the pinned clock each run.
 */
async function reach(page, test, arg, { what, timeoutMs, step = FRAME_MS, calm = true } = {}) {
  timeoutMs ??= patienceOf(page);
  return within(timeoutMs + 10_000, what, reachInner(page, test, arg, { what, timeoutMs, step, calm }));
}

async function reachInner(page, test, arg, { what, timeoutMs, step, calm }) {
  const { inFlight } = opened(page);
  const t0 = Date.now();
  let steps = 0;
  for (;;) {
    if (calm) await breathe(page);
    if (inFlight.size === 0) {
      const got = await page.evaluate(test, arg);
      if (got) return got;
    }
    if (Date.now() - t0 > timeoutMs) {
      const where = await page.evaluate(() => ({
        doors: document.querySelector('.sk-doors')?.getAttribute('data-phase') ?? null, bootDoors: !!document.getElementById('boot-doors'),
        canvases: [...document.querySelectorAll('canvas[data-engine]')].map((c) => (c.hasAttribute('data-drawn') ? 'drawn' : 'not drawn')),
        fonts: document.fonts.status, clock: Math.round(performance.now()),
      })).catch(() => null);
      throw new Error(`waited ${Math.round((Date.now() - t0) / 1000)} s (${steps} steps) for ${what}; fetching ${inFlight.size}; the page: ${JSON.stringify(where)}`);
    }
    await advance(page, step);
    steps++;
  }
}

/**
 * Waits, in real time, until the graphics process has carried out everything each canvas has been asked to draw. A
 * WebGL call only queues work; under software rendering the work itself takes seconds. A fence is put at the end of
 * each canvas's queue and asked about until it is passed. Runs in the page.
 */
async function graphicsDone(limitMs) {
  const wait = (ms) => new Promise((r) => window.__gate.real.setTimeout(r, ms));
  const t0 = window.__gate.real.now();
  for (const c of document.querySelectorAll('canvas[data-engine]')) {
    const gl = c.getContext('webgl2');
    if (!gl || gl.isContextLost()) continue;
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) continue;
    gl.flush();
    // The answer only changes between tasks, so ask, step aside, ask again.
    while (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED && !gl.isContextLost() && window.__gate.real.now() - t0 < limitMs) await wait(8);
    gl.deleteSync(fence);
  }
  return window.__gate.real.now() - t0 < limitMs;
}

/**
 * Draws the page as it stands, for real, and waits until the graphics process has finished doing so: `frames` frames
 * of the pinned clock with WebGL drawing, then a fence in each canvas's queue (graphicsDone), then two of the browser's
 * own frames to put the result on screen. Drawing stays on afterwards. Returns the real milliseconds it took: under
 * software rendering this is where the time goes.
 */
export async function settle(page, { frames = 2, timeoutMs } = {}) {
  timeoutMs ??= patienceOf(page);
  const t0 = Date.now();
  await within(timeoutMs, 'the page to be drawn (the graphics process is slow or stuck)', (async () => {
    await drawing(page, true);
    for (let i = 0; i < frames; i++) await advance(page, FRAME_MS);
    const done = await page.evaluate(graphicsDone, timeoutMs);
    if (!done) throw new Error(`the graphics process had not finished drawing after ${Math.round(timeoutMs / 1000)} s`);
    await breathe(page);
  })());
  return Date.now() - t0;
}

/**
 * Waits until the page is ready (see pageIsReady above) and draws it. Never a bare sleep: the pinned clock is stepped a
 * frame at a time with drawing off, the page is asked after each step, and only then are real frames drawn (settle).
 * `home` adds Home's own conditions. `timeoutMs` is real time for each of the two halves (PATIENCE_MS when left out).
 * Resolves once document.fonts.ready has too. Returns { waitMs, drawMs }.
 */
export async function waitReady(page, { home = false, loose = null, frames = 2, timeoutMs, what = home ? 'Home to be ready' : 'the screen to be ready' } = {}) {
  const t0 = Date.now();
  await drawing(page, false);
  await reach(page, pageIsReady, { home, loose }, { what, timeoutMs });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const waitMs = Date.now() - t0;
  const drawMs = await settle(page, { frames, timeoutMs });
  return { waitMs, drawMs };
}

/** The gate's click: the event sent straight to the element (the plan's rule), so no pointer has to travel or hover. */
export async function click(locator) {
  await locator.dispatchEvent('click');
}

/**
 * The picture, as PNG bytes: page.screenshot({ animations: 'disabled' }), which sets every CSS animation and
 * transition to its end (or, for one that never ends, its start). Refuses when the canvas is behind the page (frames
 * were stepped with drawing off and no settle since): that picture would show two different moments.
 */
export async function shoot(page, options = {}) {
  const stale = await page.evaluate(() => window.__gate?.stale ?? false);
  if (stale) throw new Error('the canvas is older than the page: frames were stepped with drawing off; call settle(page) before shoot(page)');
  return page.screenshot({ type: 'png', ...options, animations: 'disabled' });
}

// ---------------------------------------------------------------------------------------------------------------------
// The places the gate photographs
// ---------------------------------------------------------------------------------------------------------------------

/** How far past the pinned moment the page's date is set before a game is dealt (see deal below). */
const DEAL_AT_MS = 60_000;

/**
 * Makes the next thing dealt the same every run. A game's seed is written from Date.now() and Math.random() at the
 * click (src/state/store.ts:237 for practice, :251 for a table), and how many numbers the page has rolled by then is
 * not promised. So straight before the click the page's date is set to one fixed moment (the date only: no timer
 * fires and performance.now does not move) and the dice are started again from the seed.
 */
async function deal(page) {
  const { at } = opened(page);
  await page.clock.setSystemTime(at + DEAL_AT_MS);
  await page.evaluate(() => window.__gate.reseed());
}

/** A row of Home's menu, by the words on it. */
const menuRow = (page, label) => page.locator('.sk-menu-item').filter({ has: page.locator('.sk-menu-label', { hasText: new RegExp(`^${label}$`) }) });

/** Opens the game and gets Home ready without drawing it: the way in to every other place. */
async function enterHome(browser, options, query = {}) {
  const t0 = Date.now();
  const o = await openPainted(browser, { ...options, query: { hour: 'day', ...query, ...(options.query ?? {}) } });
  try {
    // `timeoutMs` is the real-time patience for each wait on this page, not for the place as a whole.
    if (options.timeoutMs) { OPEN.get(o.page).patienceMs = options.timeoutMs; o.context.setDefaultTimeout(options.timeoutMs); }
    await drawing(o.page, false);
    await reach(o.page, pageIsReady, { home: true }, { what: 'Home to be ready' });
    return { ...o, t0, timings: { homeMs: Date.now() - t0 } };
  } catch (e) {
    await o.context.close().catch(() => {});
    throw e;
  }
}

/** Runs a place's steps; if one fails, the context is closed and the error says which place and what the page logged. */
async function place(name, o, steps) {
  try {
    await steps();
    o.timings.totalMs = Date.now() - o.t0;
    return { context: o.context, page: o.page, errors: o.errors, timings: o.timings };
  } catch (e) {
    const seen = o.errors.slice(0, 5).map((x) => `${x.kind}: ${x.text}`).join(' | ');
    await o.context.close().catch(() => {});
    e.message = `${name}: ${e.message}${seen ? ` (the page said: ${seen})` : ''}`;
    throw e;
  }
}

/** The tour scene the wendigo can be seen from (POV_SHOTS index 2, src/skin/scene/homePov.ts:55 and :69). */
const PADDOCK_POV = 2;

/**
 * Whether the wendigo's model is in Home's scene and showing. Its eyes are the only sprites in that scene
 * (src/skin/table/Wendigo.tsx:135), and the scene is on the page as window.__scene (src/skin/table/DevStats.tsx:8).
 */
function wendigoIsIn() {
  let seen = false;
  window.__scene?.traverse((o) => {
    if (!o.isSprite) return;
    let shown = true;
    for (let p = o; p; p = p.parent) if (!p.visible) shown = false;
    if (shown) seen = true;
  });
  return seen;
}

/**
 * Home, on one held shot: `pov` is the tour's scene (0 the doorway; 2 the paddock), `hour` its time of day
 * (dawn, day, dusk, night). `extraQuery` adds switches (wendigoDebug: '', voxels: 'sharp', dev: 1).
 * Options as openPainted (url, viewport, touch, seed, time, storage, init).
 */
export async function home(browser, { pov = 0, hour = 'day', extraQuery = {}, ...options } = {}) {
  const o = await enterHome(browser, options, { pov, hour, ...extraQuery });
  return place('home', o, async () => {
    // The paddock shot is the one the wendigo stands in. Its model arrives after the farm and is posed when it lands,
    // so the farm being ready does not mean it is there yet.
    if (Number(pov) === PADDOCK_POV || 'wendigoDebug' in extraQuery) {
      await reach(o.page, wendigoIsIn, null, { what: 'the wendigo to be standing in the scene' });
      await advance(o.page, FRAME_MS * 2);
    }
    await o.page.evaluate(() => document.fonts.ready.then(() => true));
    o.timings.drawMs = await settle(o.page);
  });
}

/** The typing line is up and it is your turn: the word bar says so and its hidden input has the keys. */
function yourTurn() {
  const bar = document.querySelector('[data-tour="input"]');
  const input = bar?.querySelector('input.sk-input-ghost');
  return !!bar && bar.getAttribute('data-mode') === 'mine' && !!input && !input.disabled && document.activeElement === input;
}

/** How long after your turn starts the picture is taken, in the pinned clock's ms: by then the bomb has landed and the board that calls the turn has gone. */
const TURN_SETTLE_MS = 2000;

/** From Home to a dealt table of farm sheep, stopped on your turn. Shared by table() and tableResults(). */
async function sitDown(o, { seats = null } = {}) {
  const { page } = o;
  await click(menuRow(page, 'Create lobby'));
  const panel = page.locator('[role="dialog"][aria-label="Set the table"]');
  await reach(page, () => !!document.querySelector('[role="dialog"][aria-label="Set the table"] .sk-sit:not(:disabled)'), null, { what: 'the "set the table" panel' });
  if (seats !== null) await click(panel.locator('.kit-tile', { hasText: new RegExp(`^${seats}$`) }));
  await deal(page);
  await click(panel.locator('.sk-sit'));
  await reach(page, pageIsReady, { need: '[data-tour="input"]' }, { what: 'the table to be drawn' });
  o.timings.tableMs = Date.now() - o.t0;
  await reach(page, yourTurn, null, { what: 'your turn at the table', calm: false });
}

/**
 * The barn table on your turn. With no game server, Create lobby opens the "set the table" panel and Sit down deals a
 * table of farm sheep on this device. Ends with [data-tour="input"] accepting keys, TURN_SETTLE_MS into your turn.
 * `seats` picks how many sit down (2 to 10; the game's own default when left out).
 */
export async function table(browser, { seats = null, ...options } = {}) {
  const o = await enterHome(browser, options);
  return place('table', o, async () => {
    await sitDown(o, { seats });
    await advance(o.page, TURN_SETTLE_MS);
    o.timings.drawMs = await settle(o.page);
  });
}

/** The game is over and its results board is up. */
const RESULTS = '.sk-final';
/** How big a hop the clock takes while a game is run to its end with nobody typing: under the 400 ms the game calls a stall (STALL_MS, src/state/store.ts:112). */
const RUN_OUT_HOP_MS = 250;

/**
 * A finished Quick Game on its results board. Reached by playing no word at all: the pinned clock is hopped forward
 * (drawing off) while your turns run out, your sheep freezes and the farm sheep play on until one is left. With the same
 * seed it is the same game every run, word for word. Under reduced motion the board comes up the moment the game ends
 * (src/skin/screens/PaintedGame.tsx:173); with motion on, the finale plays first and this waits it out.
 * `seats` as table(); fewer seats is a shorter game.
 */
export async function tableResults(browser, { seats = null, ...options } = {}) {
  const o = await enterHome(browser, options);
  return place('tableResults', o, async () => {
    const { page } = o;
    await sitDown(o, { seats });
    const t0 = Date.now();
    const before = await page.evaluate(() => performance.now());
    await until(page, (sel) => !!document.querySelector(sel), RESULTS, { step: RUN_OUT_HOP_MS, hop: true, what: 'the game to play itself out' });
    o.timings.playedOutMs = Date.now() - t0;
    o.timings.gameClockMs = Math.round(await page.evaluate(() => performance.now()) - before);
    await reach(page, pageIsReady, { need: RESULTS }, { what: 'the results board and its podium to be drawn' });
    await advance(page, 1000);
    o.timings.drawMs = await settle(page);
  });
}

/**
 * Practice: the start of a run on the ice, stopped on your turn (TURN_SETTLE_MS in). Home's Practice row opens the
 * "Practice run" panel; Start run deals it. `clock` (15, 10 or 5) and `bot` (easy, medium, hard) press the panel's
 * buttons first; left out, the game's defaults stand.
 */
export async function duel(browser, { clock = null, bot = null, ...options } = {}) {
  const o = await enterHome(browser, options);
  return place('duel', o, async () => {
    const { page } = o;
    await click(menuRow(page, 'Practice'));
    const panel = page.locator('[role="dialog"][aria-label="Practice run"]');
    await reach(page, () => !!document.querySelector('[role="dialog"][aria-label="Practice run"] .sk-sit:not(:disabled)'), null, { what: 'the practice panel' });
    if (clock !== null) await click(panel.locator('button', { hasText: new RegExp(`^${clock} s$`) }));
    if (bot !== null) await click(panel.locator('button', { hasText: new RegExp(`^${bot}$`, 'i') }));
    await deal(page);
    await click(panel.locator('.sk-sit'));
    await reach(page, pageIsReady, { need: '[data-tour="input"]' }, { what: 'the ice to be drawn' });
    o.timings.iceMs = Date.now() - o.t0;
    await reach(page, yourTurn, null, { what: 'your turn on the ice', calm: false });
    await advance(page, TURN_SETTLE_MS);
    o.timings.drawMs = await settle(page);
  });
}

/**
 * Counting Sheep, opened from Home's menu row, at its ready sign ("press any key"): tonight's dream, which follows
 * the pinned date. Nothing is pressed, so the night is not used up.
 */
export async function dream(browser, options = {}) {
  const o = await enterHome(browser, options);
  return place('dream', o, async () => {
    const { page } = o;
    await click(menuRow(page, 'Counting Sheep'));
    await reach(page, pageIsReady, { need: 'main.dr-root[data-phase="ready"] .dr-blink' }, { what: 'the dream to be at its ready sign' });
    o.timings.dreamMs = Date.now() - o.t0;
    await advance(page, 500);
    o.timings.drawMs = await settle(page);
  });
}

const POST = '[role="dialog"][aria-label="The Trading Post"]';
const postTab = (page, label) => page.locator(`${POST} [role="tab"]`, { hasText: new RegExp(`^\\s*${label}\\s*$`) });

/** From Home (drawn once, since the farm stops drawing behind the Trading Post) into the Trading Post, on the tab named. */
async function openPost(o, label) {
  const { page } = o;
  // The farm's last picture stays on screen behind the page: draw it for real before it stops.
  o.timings.farmDrawMs = await settle(page);
  await click(menuRow(page, 'Trading Post'));
  await reach(page, pageIsReady, { need: POST }, { what: 'the Trading Post' });
  await click(postTab(page, label));
  await reach(page, (arg) => [...document.querySelectorAll(`${arg.post} [role="tab"][aria-selected="true"]`)].some((t) => t.textContent.trim() === arg.label), { post: POST, label }, { what: `the ${label} tab` });
  await reach(page, pageIsReady, { need: POST }, { what: `the ${label} tab's pictures` });
}

/** The Trading Post's Feed Sacks tab: the three sacks on their stall. */
export async function bazaarSacks(browser, options = {}) {
  const o = await enterHome(browser, options);
  return place('bazaarSacks', o, async () => {
    await openPost(o, 'Feed Sacks');
    await advance(o.page, 500);
    o.timings.drawMs = await settle(o.page);
  });
}

/**
 * The Barn Book with one item's closer look open: the first card's picture is pressed. Under reduced motion (the
 * default) the closer look is the still picture; with `reducedMotion: false` it is the live turning model, whose
 * canvas never marks itself drawn, so twenty frames are counted off after it appears.
 */
export async function bookPreview(browser, options = {}) {
  const o = await enterHome(browser, options);
  return place('bookPreview', o, async () => {
    const { page } = o;
    await openPost(o, 'Barn Book');
    await click(page.locator(`${POST} .sk-card-view`).first());
    await reach(page, pageIsReady, { need: '.sk-preview', loose: '.sk-preview' }, { what: "the item's closer look" });
    if (options.reducedMotion === false) {
      await reach(page, () => !!document.querySelector('.sk-preview canvas[data-engine]'), null, { what: "the closer look's live view" });
      await advance(page, FRAME_MS * 20);
    } else await advance(page, 500);
    o.timings.drawMs = await settle(page);
  });
}

/** The profile page, opened from the plank with your name on Home. The farm keeps drawing behind it. */
export async function profile(browser, options = {}) {
  const o = await enterHome(browser, options);
  return place('profile', o, async () => {
    const { page } = o;
    await click(page.locator('[data-profile]').first());
    await reach(page, pageIsReady, { need: '[role="dialog"][aria-label="Your profile"]' }, { what: 'the profile' });
    await advance(page, 500);
    o.timings.drawMs = await settle(page);
  });
}
