// Gate module: the test ledger (plan file 16, section 4.1 g; file 19, section 1; ruling M3). It is what holds
// "never modify existing tests" and "no other test may vanish, skip or be renamed" (CLAUDE.md, "The visual overhaul").
//
// It reads two vitest JSON reports, the base commit's and the head's, and one `git diff`:
//
//   1. Every test the base has (its file plus its full name) is at head. One that passed at base passed at head. One
//      the base skipped (the database tests, where there is no Postgres) is skipped or passed at head.
//   2. Nothing at head failed, nothing at head is a todo, and no test file at head failed outside its tests (before
//      any of them, or in a hook: vitest then lists that file's tests as skipped, or not at all). The ledger does not
//      run a head test again and does not forgive a failure, whatever the test did at base.
//   3. No test file that the base has (`*.test.ts`, `*.test.tsx`, anything under a `__tests__` folder, e2e/**) differs
//      at head or is gone. A budget raised inside a test changes no test's name: this is what catches it.
//
// The only way past 1 and 3 is a file this milestone may replace: one that the milestone table lists for it
// (ctx.plan.replaceable) and tools/gate/replaceable.json lists too, within what that file's `ledger` entry lets
// through. Every test that goes that way is named in the report. A run with no milestone (--milestone none, the whole
// overhaul against its base) has every milestone between the base and the head, each file under its own milestone's
// rule, and every test replaced that way is a decision of its own. src/skin/__tests__/fences.json is the one file under
// a `__tests__` folder that 3 leaves alone: pinning it again is how a change to a fenced file is said, and the fences
// module and the runner both put that change in front of Brian.
//
// The base's report is kept at <cache>/<base>/vitest.json. When it is not there this module makes it: the runner's own
// command, run in the base checkout, written into the cache only. A test that failed at base is run twice more there,
// to tell a flaky test from a broken one; either way it is named in the report, and either way it must pass at head.
// So is a file that failed outside its tests at base: the first later run in which it ran is what the base does, or
// its tests would count as "skipped at base" and could be skipped at head for ever.
//
// It hands in one ratchet: how many tests passed at head. Stored as a floor, so the count may not fall.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { neverReplaced, PINS } from './fences.mjs';
import { quote } from './lib/sh.mjs';
import { relativeNames } from './lib/vitest.mjs';

export const id = 'ledger';
export const modes = ['quick', 'milestone', 'baseline'];

const REPLACEABLE = 'tools/gate/replaceable.json';
const MILESTONES = 'tools/gate/milestones.json';
/** As long as the runner gives the head's tests. */
const TESTS_TIMEOUT_MS = 45 * 60_000;
/** How many times more a test that failed at base is run there. */
const AGAIN = 2;
/** Past this many names of one kind the report's text says how many more there are; the .json always holds every one. */
const NAMES_SHOWN = 200;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const count = (n) => n.toLocaleString('en-US');
const keyOf = (file, name) => `${file}\u0000${name}`;
const byName = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const said = (t) => `${t.file}: ${t.name}`;
const firstLine = (text) => String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 200) ?? '';

/** A file the third rule covers. */
export const isTestFile = (path) => /\.test\.tsx?$/.test(path) || path.split('/').includes('__tests__') || path.startsWith('e2e/');

/** vitest's words for how a test ended, as the four the ledger judges by. Anything else is kept and refused by name. */
function statusOf(raw) {
  if (raw === 'passed' || raw === 'failed' || raw === 'todo') return raw;
  if (raw === 'skipped' || raw === 'pending' || raw === 'disabled') return 'skipped';
  return String(raw);
}

/**
 * Reads a vitest JSON report: every test by file and full name, and every file. Throws a plain sentence when the file
 * is not a report, or names its files from some other disk (lib/vitest.mjs: a kept report names them from the root).
 */
export function readReport(file) {
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`could not be read (${firstLine(e?.message ?? e)})`); }
  if (!json || !Array.isArray(json.testResults)) throw new Error('is not a vitest JSON report');
  const tests = new Map();
  const files = new Map();
  for (const f of json.testResults) {
    if (typeof f?.name !== 'string') continue;
    if (isAbsolute(f.name)) throw new Error(`names its files by their place on a disk (${f.name}), not from the repo's root`);
    const results = Array.isArray(f.assertionResults) ? f.assertionResults : [];
    files.set(f.name, { status: f.status, tests: results.length, failedTests: results.filter((t) => t.status === 'failed').length, said: firstLine(f.message) });
    for (const t of results) {
      const key = keyOf(f.name, t.fullName);
      const entry = tests.get(key) ?? { file: f.name, name: String(t.fullName), statuses: [] };
      entry.statuses.push(statusOf(t.status));
      tests.set(key, entry);
    }
  }
  return { tests, files };
}

/** How many tests a report holds, and how each ended. */
function tallyOf(report) {
  const tally = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, other: 0 };
  for (const t of report.tests.values()) for (const s of t.statuses) { tally.total++; if (Object.hasOwn(tally, s) && s !== 'total') tally[s]++; else tally.other++; }
  return tally;
}

/**
 * A file that failed outside its tests: before any of them (it could not be loaded) or in a hook. vitest then lists
 * its tests as skipped, or not at all, so what the report says about them is not what they do.
 */
const failedOutside = (f) => f.status === 'failed' && f.failedTests === 0;

const tallyLine = (r, t = tallyOf(r)) => `${count(t.total)} tests in ${plural(r.files.size, 'file')}: ${count(t.passed)} passed, ${count(t.failed)} failed, ${count(t.skipped)} skipped, ${count(t.todo)} todo`;

/** Runs vitest in `dir` with the runner's own command, writing the report to `out` and naming its files from `dir`. */
async function runVitest(ctx, dir, out, only = []) {
  mkdirSync(dirname(out), { recursive: true });
  const making = `${out}.making`;
  rmSync(making, { force: true });
  const r = await ctx.sh(`npx vitest run --reporter=json --outputFile=${quote(making)}${only.map((f) => ` ${quote(f)}`).join('')}`, { cwd: dir, timeoutMs: TESTS_TIMEOUT_MS });
  writeFileSync(`${out}.log`, `(in ${dir}, exit ${r.code})\n\n${r.stdout}\n${r.stderr}\n`);
  if (!existsSync(making)) return { ok: false, why: `vitest wrote no report (exit ${r.code}${r.timedOut ? ', stopped after 45 minutes' : ''}): ${firstLine(r.stderr) || firstLine(r.stdout) || 'it said nothing'}` };
  try { relativeNames(making, dir); } catch (e) { rmSync(making, { force: true }); return { ok: false, why: `what vitest wrote is not a report (${firstLine(e?.message ?? e)})` }; }
  // Moved into place only when whole: a run that was stopped half way leaves no report, never half of one.
  renameSync(making, out);
  return { ok: true };
}

/**
 * The base's report, made when it is missing, with what its failures did when run twice more there.
 * Returns { report, failed: [{ file, name, fails, of, kind }], fileNotes, made, problems } or { notRun: sentence }.
 *
 * Two kinds of failure at base are run again, their files only: a test that failed, and a file that failed outside
 * its tests (vitest lists that file's tests as skipped, which would let them be skipped at head for ever). For such a
 * file the first later run in which it ran is taken as what the base does.
 */
async function baseOf(ctx) {
  const home = join(ctx.cache, ctx.base);
  const file = join(home, 'vitest.json');
  const againIndex = join(home, 'ledger-base-again.json');
  const againFile = (i) => join(home, `ledger-base-again-${i}.json`);
  // The base checkout and the lock come with the browser helper, so that is loaded only when one of them is needed.
  let helper = null, checkout = null;
  const painted = async () => (helper ??= await import('./lib/painted.mjs'));
  const baseDir = async () => (checkout ??= await (await painted()).ensureBaseCheckout(ctx.root, ctx.base, { log: ctx.log }));
  const usable = () => { try { return readReport(file); } catch { return null; } };

  let made = false;
  let report = existsSync(file) ? usable() : null;
  if (existsSync(file) && !report) {
    // There is a file and it cannot be compared (not a report, or named from another disk). When the head is the base
    // the file is the runner's own report of this very run, so it is not this module's to make again.
    let why = '';
    try { readReport(file); } catch (e) { why = e.message; }
    if (ctx.base === ctx.head) return { notRun: `the base's test report ${why}` };
    ctx.log(`the base's test report ${why}: making it again`);
  }
  if (!report) {
    let dir;
    try { dir = await baseDir(); } catch (e) { return { notRun: `the base commit could not be checked out to run its tests (${firstLine(e?.message ?? e)})` }; }
    const result = await (await painted()).withLock(`vitest-${ctx.base}`, async () => {
      if (existsSync(file) && usable()) return { ok: true }; // someone else made it while we waited
      ctx.log(`no usable test report of the base ${ctx.base.slice(0, 7)} in the cache: running its tests in ${dir} (a few minutes)`);
      made = true;
      return runVitest(ctx, dir, file);
    }, { log: ctx.log });
    if (!result.ok) return { notRun: `the base's tests could not be run: ${result.why}` };
    report = usable();
    if (!report) return { notRun: 'the base\'s test report could not be read back after it was made' };
  }

  const failedTests = [...report.tests.values()].filter((t) => t.statuses.includes('failed'));
  const brokenFiles = [...report.files].filter(([, f]) => failedOutside(f)).map(([name]) => name);
  const needed = [...new Set([...failedTests.map((t) => t.file), ...brokenFiles])].sort();
  const problems = [];
  const fileNotes = [];
  const failed = [];
  if (!needed.length) return { report, failed, fileNotes, made, problems };

  // Run those files twice more at base, once: the two reports are kept beside the first, with the list of what they hold.
  let have = [];
  try { have = JSON.parse(readFileSync(againIndex, 'utf8')).files ?? []; } catch { /* none kept yet */ }
  if (needed.some((f) => !have.includes(f)) || !Array.from({ length: AGAIN }, (_, i) => existsSync(againFile(i + 1))).every(Boolean)) {
    let dir = null;
    try { dir = await baseDir(); } catch (e) { problems.push(`the base has a failure, and it could not be run again there (${firstLine(e?.message ?? e)})`); }
    if (dir) {
      ctx.log(`the base's report has a failure in ${plural(needed.length, 'file')}: running ${needed.length === 1 ? 'it' : 'them'} twice more there to tell flaky from broken`);
      rmSync(againIndex, { force: true });
      let whole = true;
      for (let i = 1; i <= AGAIN && whole; i++) {
        const r = await runVitest(ctx, dir, againFile(i), needed);
        if (!r.ok) { whole = false; problems.push(`the base has a failure, and run ${i + 1} of ${AGAIN + 1} there gave no report (${r.why})`); }
      }
      if (whole) {
        writeFileSync(`${againIndex}.tmp`, JSON.stringify({ about: 'The files of <cache>/<base>/vitest.json that had a failure, run twice more at the base (tools/gate/ledger.mjs): ledger-base-again-1.json and -2.json.', files: needed }));
        renameSync(`${againIndex}.tmp`, againIndex);
      }
    }
  }
  const runs = [];
  for (let i = 1; i <= AGAIN; i++) {
    try { runs.push(readReport(againFile(i))); } catch { /* said above, or below as "not run again" */ }
  }
  const again = runs.length === AGAIN;
  if (!again && !problems.length) problems.push('the base has a failure, and the reports of running it again there could not be read');

  for (const t of failedTests) {
    // A test that is not in a later run (its file did not get that far) did not pass in that run.
    const later = again ? runs.map((r) => { const s = r.tests.get(keyOf(t.file, t.name))?.statuses ?? ['failed']; return s.every((x) => x === 'passed') ? 'passed' : 'failed'; }) : [];
    const fails = 1 + later.filter((s) => s !== 'passed').length;
    failed.push({ file: t.file, name: t.name, fails, of: 1 + later.length, kind: !again ? 'not run again' : fails === 1 + later.length ? 'broken' : 'flaky' });
  }
  failed.sort(byName);
  for (const name of brokenFiles) {
    const good = again ? runs.find((r) => r.files.has(name) && !failedOutside(r.files.get(name))) : null;
    if (!good) {
      fileNotes.push({ file: name, kind: again ? 'broken' : 'not run again', line: `${again ? 'BROKEN' : 'FAILED'} at base ${ctx.base.slice(0, 7)}: ${name} failed outside its tests (before any of them, or in a hook)${again ? ` in ${AGAIN + 1} of ${AGAIN + 1} runs` : ', and could not be run again'}: what its tests do at base is not known, so they are held by name only.` });
      continue;
    }
    // What that file's tests did in the run where it ran is what the base does.
    for (const [key, t] of [...report.tests]) if (t.file === name) report.tests.delete(key);
    for (const [key, t] of good.tests) if (t.file === name) report.tests.set(key, t);
    report.files.set(name, good.files.get(name));
    fileNotes.push({ file: name, kind: 'flaky', line: `FLAKY at base ${ctx.base.slice(0, 7)}: ${name} failed outside its tests (before any of them, or in a hook) in the first run there and ran in a later one, whose results are taken as the base's.` });
  }
  return { report, failed, fileNotes, made, problems };
}

/**
 * What this run may replace: the files the milestone table lists for a milestone that tools/gate/replaceable.json
 * lists for it too, in the same words, with what the ledger lets through. Returns { files: Map(file -> { tests, stay,
 * scope, milestone }), notes }.
 *
 * A milestone run (ctx.milestone a number) gets its own milestone's entries and nothing else. A run with no milestone
 * (--milestone none: the whole overhaul against its base) gets the entries of every milestone whose work lies between
 * the base and the head: its branch, overhaul/mNN-<name> (local, else origin's), is in the head's history and not in
 * the base's. Each file keeps its own milestone's rule; nothing else is let through.
 */
async function allowances(ctx) {
  const files = new Map();
  const notes = [];
  let table = null;
  if (ctx.milestone === null) {
    try { table = JSON.parse(readFileSync(join(ctx.root, MILESTONES), 'utf8')); } catch (e) {
      notes.push(`${MILESTONES} could not be read (${firstLine(e?.message ?? e)}): nothing is let through`);
      return { files, notes };
    }
  }
  // [{ milestone, listed }]: the milestones whose replaceable entries this run reads.
  const plans = [];
  if (ctx.milestone !== null) plans.push({ milestone: ctx.milestone, listed: ctx.plan?.replaceable ?? [] });
  else {
    for (const m of Array.isArray(table?.milestones) ? table.milestones : []) {
      if (!(m?.replaceable ?? []).some((p) => p && p.test === true)) continue;
      const where = await branchOf(ctx, m);
      if (!where.ref) { notes.push(`milestone ${m.milestone} may replace tests, and ${where.why}: nothing is let through for it`); continue; }
      if (!where.between) { notes.push(`milestone ${m.milestone} may replace tests, and its branch ${where.ref} ${where.why}: nothing is let through for it`); continue; }
      plans.push({ milestone: m.milestone, listed: m.replaceable });
    }
  }
  const wanted = plans.map((pl) => ({ ...pl, listed: pl.listed.filter((p) => p && p.test === true) })).filter((pl) => pl.listed.length);
  if (!wanted.length) return { files, notes };
  let mine;
  try { mine = JSON.parse(readFileSync(join(ctx.root, REPLACEABLE), 'utf8')); } catch (e) {
    notes.push(`${REPLACEABLE} could not be read (${firstLine(e?.message ?? e)}): nothing is let through for milestone ${wanted.map((pl) => pl.milestone).join(', ')}`);
    return { files, notes };
  }
  for (const { milestone, listed } of wanted) {
    for (const p of listed) {
      const e = (Array.isArray(mine?.replaceable) ? mine.replaceable : []).find((x) => x && x.milestone === milestone && x.file === p.file);
      const never = neverReplaced(p.file, mine?.never);
      if (!e || e.scope !== p.scope || e.condition !== p.condition || e.test !== p.test) notes.push(`the milestone table lets milestone ${milestone} replace ${p.file}, and ${REPLACEABLE} does not say the same: nothing is let through for it`);
      else if (never) notes.push(`${p.file} is listed for milestone ${milestone} and is never replaced (${never}): nothing is let through for it`);
      else if (!e.ledger || e.ledger.bytes !== true || !['kept', 'replaced'].includes(e.ledger.tests)) notes.push(`${REPLACEABLE} gives no ledger entry the ledger reads for ${p.file}: nothing is let through for it`);
      else if (files.has(p.file)) notes.push(`${p.file} is listed for milestones ${files.get(p.file).milestone} and ${milestone}: only milestone ${files.get(p.file).milestone}'s rule is applied`);
      else files.set(p.file, { tests: e.ledger.tests, stay: Array.isArray(e.ledger.stay) ? e.ledger.stay : [], scope: String(p.scope ?? ''), milestone });
    }
  }
  return { files, notes };
}

/**
 * Where a milestone's branch is, and whether its work lies between the base and the head:
 * { ref, between, why }. ref is null when no branch of that name is found.
 */
async function branchOf(ctx, m) {
  const name = `overhaul/m${String(m.milestone).padStart(2, '0')}-${m.name}`;
  let ref = null;
  for (const r of [`refs/heads/${name}`, `refs/remotes/origin/${name}`]) {
    if ((await ctx.sh(`git rev-parse --verify --quiet ${quote(`${r}^{commit}`)}`)).code === 0) { ref = r; break; }
  }
  if (!ref) return { ref: null, between: false, why: `no branch ${name} is here (local or origin's)` };
  const inHead = (await ctx.sh(`git merge-base --is-ancestor ${quote(ref)} ${quote(ctx.head)}`)).code === 0;
  const inBase = (await ctx.sh(`git merge-base --is-ancestor ${quote(ref)} ${quote(ctx.base)}`)).code === 0;
  return { ref, between: inHead && !inBase, why: !inHead ? 'is not in the head\'s history' : inBase ? 'is already in the base\'s history' : '' };
}

/** The test files of the base that differ at head or are gone: [{ file, how: 'changed' | 'deleted' }]. Null when git could not say. */
async function changedTestFiles(ctx) {
  // The base against the files as they are now, committed or not: what vitest ran is what is on the disk.
  const r = await ctx.sh(`git diff --name-status --no-renames -z ${ctx.base} --`);
  if (r.code !== 0) return null;
  const parts = r.stdout.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const state = parts[i][0], file = parts[i + 1];
    if (state === 'A' || !isTestFile(file)) continue;
    if (state === 'D') { out.push({ file, how: 'deleted' }); continue; }
    // "Changed" can be the file's mode alone: the rule is about its bytes.
    const was = await ctx.sh(`git show ${quote(`${ctx.base}:${file}`)}`);
    let now = null;
    try { now = readFileSync(join(ctx.root, file), 'utf8'); } catch { /* gone after all */ }
    if (now === null) out.push({ file, how: 'deleted' });
    else if (was.code !== 0 || was.stdout !== now) out.push({ file, how: 'changed' });
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

export async function run(ctx) {
  const headFile = ctx.vitest?.head ?? null;
  if (!headFile) {
    return { ok: false, summary: 'NOT RUN: this run has no test report of the head (the tests were left out of it, or vitest wrote none), so there is nothing to compare with the base', lines: [], data: {} };
  }
  let head;
  try { head = readReport(headFile); } catch (e) {
    return { ok: false, summary: `NOT RUN: the head's test report ${e.message}`, lines: [], data: {} };
  }
  const base = await baseOf(ctx);
  if (base.notRun) return { ok: false, summary: `NOT RUN: ${base.notRun}`, lines: [], data: {} };
  const changedFiles = await changedTestFiles(ctx);
  if (changedFiles === null) return { ok: false, summary: 'NOT RUN: git could not compare the test files with the base\'s', lines: [], data: {} };

  const allow = await allowances(ctx);
  const lines = [];
  const decisions = [];
  const short = ctx.base.slice(0, 7);

  // What the base's own failures were: flaky, or broken.
  const baseFailed = base.failed;
  const knownAtBase = new Map(baseFailed.map((t) => [keyOf(t.file, t.name), t]));

  // Rule 1: every test of the base, at head.
  const gone = [], replaced = [], failed = [], skipped = [], todo = [], odd = [];
  const newIn = new Map(); // file -> names that are at head and not at base
  for (const t of head.tests.values()) {
    if (base.report.tests.has(keyOf(t.file, t.name))) continue;
    newIn.set(t.file, [...(newIn.get(t.file) ?? []), t.name]);
  }
  for (const [key, b] of base.report.tests) {
    const h = head.tests.get(key);
    const allowed = allow.files.get(b.file);
    if (!h || h.statuses.length < b.statuses.length) {
      const entry = { file: b.file, name: b.name };
      if (allowed?.tests === 'replaced' && !allowed.stay.includes(b.name)) replaced.push(entry);
      else {
        const file = head.files.get(b.file);
        entry.why = !file ? 'its file is not in the head\'s report (deleted, moved or renamed)'
          : failedOutside(file) ? `its file failed outside its tests at head${file.said ? ` (${file.said})` : ''}`
          : allowed?.tests === 'kept' ? 'its file may change in this milestone, and every test in it keeps its name'
          : allowed ? 'the list of replaceable tests says this one stays'
          : (newIn.get(b.file) ?? []).length ? `deleted or renamed; new in that file at head: ${newIn.get(b.file).slice(0, 3).map((n) => `"${n}"`).join(', ')}${newIn.get(b.file).length > 3 ? ', ...' : ''}`
          : 'deleted or renamed';
        gone.push(entry);
      }
      if (!h) continue;
    }
    const mustPass = b.statuses.some((s) => s === 'passed' || s === 'failed');
    if (mustPass && h.statuses.includes('skipped')) skipped.push({ file: b.file, name: b.name });
  }
  // Rule 2: nothing at head failed or is a todo, old or new.
  const newSkipped = [];
  for (const [key, t] of head.tests) {
    const known = knownAtBase.get(key);
    if (t.statuses.includes('failed')) failed.push({ file: t.file, name: t.name, atBase: known ? `${known.kind} at base too: it failed ${known.fails} of ${known.of} runs there` : '' });
    if (t.statuses.includes('todo')) todo.push({ file: t.file, name: t.name });
    for (const s of t.statuses) if (!['passed', 'failed', 'skipped', 'todo'].includes(s)) odd.push({ file: t.file, name: t.name, status: s });
    if (t.statuses.includes('skipped') && !base.report.tests.has(key)) newSkipped.push({ file: t.file, name: t.name });
  }
  const unloaded = [...head.files].filter(([, f]) => failedOutside(f)).map(([file, f]) => ({ file, said: f.said })).sort((a, b) => (a.file < b.file ? -1 : 1));
  for (const list of [gone, replaced, failed, skipped, todo, odd, newSkipped]) list.sort(byName);

  // Rule 3: no test file of the base differs or is gone, but one this milestone may replace (and the fence's pins).
  const filesRefused = [], filesAllowed = [], pinsChanged = [];
  for (const f of changedFiles) {
    if (f.file === PINS) pinsChanged.push(f);
    else if (allow.files.has(f.file) && (f.how === 'changed' || allow.files.get(f.file).tests === 'replaced')) filesAllowed.push(f);
    else filesRefused.push(f);
  }

  const problems = [];
  const list = (title, items, show) => {
    if (!items.length) return;
    lines.push(`${title}:`);
    for (const item of items.slice(0, NAMES_SHOWN)) lines.push(`  ${show(item)}`);
    if (items.length > NAMES_SHOWN) lines.push(`  ... and ${count(items.length - NAMES_SHOWN)} more: every one is in the report's .json`);
  };

  lines.push(`base ${short}: ${tallyLine(base.report)}${base.made ? ' (made in this run, in the base checkout)' : ''}`);
  lines.push(`head: ${tallyLine(head)}`);
  if (ctx.steps?.tests && !ctx.steps.tests.ran) lines.push('this run did not run the tests: the head\'s report is the one the cache holds for exactly this tree');
  const added = [...newIn.values()].reduce((sum, names) => sum + names.length, 0);
  if (added) lines.push(`new at head: ${plural(added, 'test')} in ${plural(newIn.size, 'file')}`);

  if (gone.length) problems.push(`${plural(gone.length, 'test')} of the base ${gone.length === 1 ? 'is' : 'are'} gone or renamed`);
  list('GONE at head (deleted or renamed; a test may not vanish)', gone, (t) => `${said(t)} (${t.why})`);
  if (skipped.length) problems.push(`${plural(skipped.length, 'test')} that ran at base ${skipped.length === 1 ? 'is' : 'are'} skipped at head`);
  list('SKIPPED at head, and it ran at base', skipped, said);
  if (failed.length) problems.push(`${plural(failed.length, 'test')} failed at head`);
  list('FAILED at head (the ledger does not run a test again and does not forgive a failure)', failed, (t) => `${said(t)}${t.atBase ? ` (${t.atBase})` : ''}`);
  if (unloaded.length) problems.push(`${plural(unloaded.length, 'test file')} failed outside ${unloaded.length === 1 ? 'its' : 'their'} tests at head`);
  list('FAILED OUTSIDE ITS TESTS at head (before any of them, or in a hook: what the report says of its tests is not what they do)', unloaded, (f) => `${f.file}${f.said ? `: ${f.said}` : ''}`);
  if (todo.length) problems.push(`${plural(todo.length, 'test')} at head ${todo.length === 1 ? 'is a todo' : 'are todos'}`);
  list('TODO at head (nothing at head may be a todo)', todo, said);
  if (odd.length) problems.push(`${plural(odd.length, 'test')} at head ended in a way the ledger does not know`);
  list('UNKNOWN status at head', odd, (t) => `${said(t)} (${t.status})`);
  if (filesRefused.length) problems.push(`${plural(filesRefused.length, 'existing test file')} ${filesRefused.length === 1 ? 'was' : 'were'} changed or deleted`);
  list('TEST FILE CHANGED since the base (an existing test file may not be edited or deleted; add a new file instead)', filesRefused, (f) => `${f.file} (${f.how})`);
  for (const p of base.problems) problems.push(p);

  // What was let through, by name, and what the reviewer should know.
  const whose = (file) => allow.files.get(file).milestone;
  if (ctx.milestone !== null) {
    list(`replaced in milestone ${ctx.milestone}, as plan file 19, section 1, allows`, replaced, said);
    list(`test files changed in milestone ${ctx.milestone}, as plan file 19, section 1, allows`, filesAllowed, (f) => `${f.file} (${f.how}): ${allow.files.get(f.file).scope}`);
  } else {
    list('replaced in the milestones between the base and the head, as plan file 19, section 1, allows', replaced, (t) => `milestone ${whose(t.file)}: ${said(t)}`);
    list('test files changed in the milestones between the base and the head, as plan file 19, section 1, allows', filesAllowed, (f) => `milestone ${whose(f.file)}: ${f.file} (${f.how}): ${allow.files.get(f.file).scope}`);
  }
  for (const note of allow.notes) lines.push(note);
  if (ctx.milestone !== null) {
    if (replaced.length) decisions.push(`Milestone ${ctx.milestone} replaced ${plural(replaced.length, 'test')} under plan file 19, section 1 (${[...new Set(replaced.map((t) => t.file))].join(', ')}). Each is named in the ledger's section: check that each is within "${[...new Set(replaced.map((t) => allow.files.get(t.file).scope))].join('" / "')}".`);
  } else {
    // No milestone: one decision per replaced test, each with its own milestone and scope.
    for (const t of replaced) decisions.push(`Milestone ${whose(t.file)} replaced ${said(t)} under plan file 19, section 1: check that it is within "${allow.files.get(t.file).scope}".`);
  }
  // A file that changed and lost no test: said too, so that a person reads the change against its scope.
  const quiet = filesAllowed.filter((f) => f.how === 'changed' && ![...gone, ...replaced].some((t) => t.file === f.file));
  for (const m of [...new Set(quiet.map((f) => whose(f.file)))]) {
    const mine = quiet.filter((f) => whose(f.file) === m);
    decisions.push(`Milestone ${m} changed ${mine.map((f) => f.file).join(', ')} under plan file 19, section 1, and every test in ${mine.length === 1 ? 'it' : 'them'} kept its name: check that the change is within "${[...new Set(mine.map((f) => allow.files.get(f.file).scope))].join('" / "')}".`);
  }
  for (const t of baseFailed) {
    const line = `${t.kind === 'flaky' ? 'FLAKY' : t.kind === 'broken' ? 'BROKEN' : 'FAILED'} at base ${short}: ${said(t)} failed ${t.fails} of ${t.of} ${t.of === 1 ? 'run' : 'runs'} there${t.kind === 'not run again' ? ' (it could not be run again)' : ''}. It must pass at head like any other test.`;
    lines.push(line);
    decisions.push(line);
  }
  for (const note of base.fileNotes) { lines.push(note.line); decisions.push(note.line); }
  if (newSkipped.length) {
    list('new at head and skipped (allowed; said so that a person sees it)', newSkipped, said);
    decisions.push(`${plural(newSkipped.length, 'test')} ${newSkipped.length === 1 ? 'is' : 'are'} new at head and skipped: ${newSkipped.slice(0, 5).map(said).join('; ')}${newSkipped.length > 5 ? `; and ${newSkipped.length - 5} more, in the ledger's section` : ''}.`);
  }
  if (pinsChanged.length) lines.push(`${PINS} differs from the base's: that is the fences' to say (a decision for Brian there), not a test that was edited`);

  const headTally = tallyOf(head), baseTally = tallyOf(base.report);
  const passed = headTally.passed;
  const held = baseTally.total - replaced.length;
  return {
    ok: problems.length === 0,
    summary: problems.length ? problems.join('; ') : `${count(passed)} tests passed at head; all ${count(held)} of the base's tests are there${headTally.skipped ? `, ${count(headTally.skipped)} skipped at head` : ''}; no existing test file changed${filesAllowed.length ? ` but the ${plural(filesAllowed.length, 'file')} ${ctx.milestone === null ? 'the replaceable list allows' : 'this milestone may replace'}` : ''}`,
    lines,
    data: {
      base: { files: base.report.files.size, ...baseTally, made: base.made, failed: baseFailed, fileNotes: base.fileNotes },
      head: { files: head.files.size, ...headTally },
      newAtHead: added,
      gone, skipped, failed, todo, unknown: odd, didNotRun: unloaded, newSkipped,
      testFilesChanged: filesRefused, replaced, testFilesAllowed: filesAllowed, notes: allow.notes,
    },
    measured: { tests: passed },
    seedWith: { tests: { min: passed } },
    decisions,
    human: [],
  };
}
