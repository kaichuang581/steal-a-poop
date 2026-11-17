#!/usr/bin/env node
// The gate: one command that runs every check a milestone of the visual overhaul is judged by, and writes one report
// (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 e). The contract every module follows, the cache and how
// to add a module are in README.md beside this file.
//
//   node tools/gate/gate.mjs --quick             types, npm test, the build, size, fences, ledger, banned: every commit
//   node tools/gate/gate.mjs --milestone 3       everything; writes docs/visual-overhaul/reports/m03.json and m03.md
//   node tools/gate/gate.mjs --milestone none    everything, for a pull request that is not a milestone; writes nothing
//                                                into the repo, and a changed picture is listed, not failed
//   node tools/gate/gate.mjs --baseline          everything, on a fresh branch before work starts (head is the base)
//
//   --only a,b   --skip a,b    run a part (names of modules, or types, tests, build, build-server). A part run is never
//                              a gate result: it ends with exit code 2 at best, and writes no report into the repo.
//   --seed                     store ratchet numbers that have no stored value yet (never writes over one that has)
//   --base <commit>            judge against this commit, not `git merge-base HEAD origin/main`
//   --fresh                    run the tests even when this exact commit's report is in the cache
//   --verbose                  print what the type check, tests and builds print, as they run
//
// Exit code: 0 every check passed; 1 a check failed, or the gate itself could not run; 2 a part run whose part passed;
// 64 the command line was wrong.
//
// The runner does four things itself, in this order, then the modules, in theirs: the type check, the head's test
// report (vitest's JSON, which the ledger module reads), and both builds. A module that is missing or broken is a
// failed check in the report, not a crash: one run always shows everything. Last, it looks at `git status` again:
// a run that left anything in the repo (its own report and, under --seed, the ratchet store aside) fails.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { commitsSince, facts, fileAt, status, watchedDiff, watchedGroup, WATCHED_NAMES } from './lib/git.mjs';
import { addSeeds, compare, leafName, readStore, rowLine, storeChanges, writeStore } from './lib/ratchets.mjs';
import { labelOf, summaryLines, WORD, writeReports } from './lib/report.mjs';
import { quote, sh } from './lib/sh.mjs';
import { relativeNames } from './lib/vitest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const RATCHETS = join(ROOT, 'docs', 'visual-overhaul', 'RATCHETS.json');
const MILESTONES = join(HERE, 'milestones.json');

/** Every module, in the order it runs. To add one: write tools/gate/<id>.mjs and add its id here (README.md). */
const MODULES = ['size', 'fences', 'ledger', 'banned', 'baked', 'scenes', 'smoke', 'pictures', 'counts'];
/** The modules --quick must run. --milestone and --baseline must run all of them. */
const QUICK = ['size', 'fences', 'ledger', 'banned'];
const MODES = ['quick', 'milestone', 'baseline'];

/** What the runner does itself before any module. The commands are the ones CI's other workflows run. */
const STEPS = [
  { id: 'types', name: 'type check', cmd: 'npx tsc --noEmit', modes: MODES, timeoutMs: 15 * 60_000 },
  { id: 'tests', name: 'npm test', cmd: 'npx vitest run --reporter=json --outputFile=<cache>/<tree>/vitest.json', modes: MODES, timeoutMs: 45 * 60_000 },
  { id: 'build', name: 'build', cmd: 'npm run build', modes: MODES, timeoutMs: 20 * 60_000 },
  { id: 'build-server', name: 'server build', cmd: 'npm run build:server', modes: ['milestone', 'baseline'], timeoutMs: 20 * 60_000 },
];

const two = (n) => String(n).padStart(2, '0');
const say = (line = '') => process.stdout.write(`${line}\n`);

class Usage extends Error {}

// ---------------------------------------------------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------------------------------------------------

function parse(argv) {
  const a = { mode: null, milestone: null, only: [], skip: [], seed: false, base: null, fresh: false, verbose: false, help: false };
  const setMode = (mode) => {
    if (a.mode) throw new Usage('give one of --quick, --milestone <NN|none>, --baseline, not two');
    a.mode = mode;
  };
  const list = (text, flag) => {
    const ids = String(text ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) throw new Usage(`${flag} needs a list, for example ${flag} size,fences`);
    const known = [...STEPS.map((s) => s.id), ...MODULES];
    const bad = ids.filter((id) => !known.includes(id));
    if (bad.length) throw new Usage(`${flag}: no such check: ${bad.join(', ')} (there are: ${known.join(', ')})`);
    return ids;
  };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i], value;
    if (arg.startsWith('--') && arg.includes('=')) [arg, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)];
    const next = () => {
      if (value !== undefined) return value;
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Usage(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === '--quick') setMode('quick');
    else if (arg === '--baseline') setMode('baseline');
    else if (arg === '--milestone') {
      setMode('milestone');
      const v = next();
      if (v !== 'none') {
        if (!/^\d{1,2}$/.test(v)) throw new Usage(`--milestone takes a number or "none", not "${v}"`);
        a.milestone = Number(v);
      }
    } else if (arg === '--only') a.only = list(next(), '--only');
    else if (arg === '--skip') a.skip = list(next(), '--skip');
    else if (arg === '--seed') a.seed = true;
    else if (arg === '--base') a.base = next();
    else if (arg === '--fresh') a.fresh = true;
    else if (arg === '--verbose') a.verbose = true;
    else if (arg === '--help' || arg === '-h') a.help = true;
    else throw new Usage(`no such option: ${arg}`);
  }
  if (!a.help && !a.mode) throw new Usage('say which run: --quick, --milestone <NN|none> or --baseline');
  if (a.only.length && a.skip.length) throw new Usage('give --only or --skip, not both');
  return a;
}

function help() {
  const text = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  const from = text.findIndex((l) => l.includes('node tools/gate/gate.mjs --quick'));
  const to = text.findIndex((l) => l.startsWith('// 64 '));
  say(text.slice(from, to + 1).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}

// ---------------------------------------------------------------------------------------------------------------------
// The test report
// ---------------------------------------------------------------------------------------------------------------------

/** Reads vitest's JSON into the few numbers the report prints. Null when the file is missing or is not a report. */
function readTests(file) {
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  if (!json || !Array.isArray(json.testResults)) return null;
  const failedTests = [];
  const failedFiles = [];
  const why = {};
  // The first line of what a failure said: the report names the test, this says what was wrong with it.
  const firstLine = (text) => String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 240) ?? '';
  for (const f of json.testResults) {
    if (f.status === 'failed') {
      failedFiles.push(f.name);
      if (f.message) why[f.name] = firstLine(f.message);
    }
    for (const t of f.assertionResults ?? []) {
      if (t.status !== 'failed') continue;
      failedTests.push(`${f.name}: ${t.fullName}`);
      why[`${f.name}: ${t.fullName}`] = firstLine(t.failureMessages?.[0]);
    }
  }
  return {
    success: json.success === true,
    files: json.testResults.length,
    total: json.numTotalTests ?? 0,
    passed: json.numPassedTests ?? 0,
    failed: json.numFailedTests ?? 0,
    skipped: json.numPendingTests ?? 0,
    todo: json.numTodoTests ?? 0,
    failedFiles: failedFiles.sort(),
    failedTests: failedTests.sort(),
    why,
  };
}

const testsGreen = (t) => Boolean(t) && t.success && t.failed === 0 && t.failedFiles.length === 0 && t.total > 0;
const testsLine = (t) => `${t.files} files, ${t.total} tests: ${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped, ${t.todo} todo`;

/** The last lines a failed command printed, for the report. */
function tail(result, count = 30) {
  const text = `${result.stdout}\n${result.stderr}`.replace(/\u001b\[[0-9;]*m/g, '');
  return text.split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-count);
}

// ---------------------------------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------------------------------

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) return help();

  const cache = resolve(process.env.GATE_CACHE || join(homedir(), '.cache', 'fleeced-gate'));
  mkdirSync(cache, { recursive: true });
  const run$ = (cmd, opts = {}) => sh(cmd, { cwd: ROOT, ...opts });

  const table = JSON.parse(readFileSync(MILESTONES, 'utf8'));
  const planOf = (n) => table.milestones.find((m) => m.milestone === n) ?? null;
  if (args.milestone !== null && !planOf(args.milestone)) throw new Usage(`there is no milestone ${args.milestone} (tools/gate/milestones.json has ${table.milestones.map((m) => m.milestone).join(', ')})`);

  // A milestone run writes its own two report files: they do not make the tree "changed".
  const ownReports = args.mode === 'milestone' && args.milestone !== null
    ? ['json', 'md'].map((ext) => `docs/visual-overhaul/reports/m${two(args.milestone)}.${ext}`)
    : [];
  const git = await facts(run$, ROOT, { baseOverride: args.base, ignore: ownReports });
  const ahead = await commitsSince(run$, ROOT, git.base, git.head);

  // --quick and --baseline learn their milestone from the branch (overhaul/mNN-<name>), so the ledger knows which
  // tests that milestone may replace.
  const fromBranch = /^overhaul\/m(\d{2})-/.exec(git.branch);
  const milestone = args.mode === 'milestone' ? args.milestone : fromBranch && planOf(Number(fromBranch[1])) ? Number(fromBranch[1]) : null;
  const plan = milestone === null ? null : planOf(milestone);
  const label = labelOf(args.mode, args.mode === 'milestone' ? args.milestone : null);
  const partial = args.only.length > 0 || args.skip.length > 0;
  const chosen = (id) => (args.only.length ? args.only.includes(id) : !args.skip.includes(id));
  const logs = join(cache, 'logs', label);
  mkdirSync(logs, { recursive: true });

  let store = readStore(RATCHETS);

  const run = {
    ranAt: new Date().toISOString(),
    mode: args.mode,
    milestone,
    label,
    partial,
    only: args.only,
    skip: args.skip,
    seed: args.seed,
    baseGiven: args.base,
    commits: { base: git.base, head: git.head, ahead, branch: git.branch, expectedBranch: plan ? `overhaul/m${two(milestone)}-${plan.name}` : null },
    tree: { clean: !git.dirty, porcelain: git.porcelain },
    environment: { node: process.version, platform: `${process.platform} ${process.arch}`, ci: Boolean(process.env.CI) },
    plan,
    steps: [],
    extra: [],
    modules: [],
    pictures: null,
    human: [],
    humanFiles: [],
    stop: null,
    watched: { committed: [], uncommitted: [] },
    release: { versionAtBase: null, version: null, changelogChanged: false },
    storeChanges: [],
    decisions: [],
    verdict: { word: 'FAIL', failed: [] },
  };

  say(`Fleeced gate: --${args.mode}${args.mode === 'milestone' ? ` ${args.milestone ?? 'none'}` : ''}${partial ? ' (a part run)' : ''}${args.seed ? ' --seed' : ''}`);
  say(`base ${git.base.slice(0, 7)}  head ${git.head.slice(0, 7)}  ${git.porcelain.length ? `${git.porcelain.length} paths not committed` : 'tree clean'}  cache ${cache}`);
  say();

  // ------------------------------------------------------------------------------------------------------------------
  // The runner's own steps
  // ------------------------------------------------------------------------------------------------------------------

  const stepState = {};
  const testFile = join(cache, git.stamp, 'vitest.json');

  for (const def of STEPS) {
    const entry = { id: def.id, name: def.name, cmd: def.cmd, status: 'pass', ok: true, summary: '', lines: [], data: {} };
    run.steps.push(entry);
    stepState[def.id] = { ran: false, ok: false };
    if (!def.modes.includes(args.mode)) { entry.status = 'not in this mode'; entry.summary = `not part of --${args.mode}`; continue; }
    if (!chosen(def.id)) { entry.status = 'left out'; entry.summary = 'left out of this part run'; say(`  ${def.name}: left out`); continue; }

    const started = Date.now();
    say(`  ${def.name}: running ...`);
    const follow = args.verbose ? (text) => process.stdout.write(text) : undefined;
    const done = (ok, summary) => {
      entry.ok = ok;
      entry.status = ok ? 'pass' : 'fail';
      entry.summary = summary;
      stepState[def.id] = { ran: true, ok };
      say(`  ${def.name}: ${WORD[entry.status]}  ${summary}  (${Math.round((Date.now() - started) / 1000)} s)`);
    };
    const keep = (r) => writeFileSync(join(logs, `${def.id}.log`), `$ ${entry.cmd}\n(exit ${r.code})\n\n${r.stdout}\n${r.stderr}\n`);

    if (def.id === 'tests') {
      mkdirSync(dirname(testFile), { recursive: true });
      entry.cmd = `npx vitest run --reporter=json --outputFile=${quote(testFile)}`;
      // A report is used again only for a clean tree at exactly this commit (nothing changed, nothing new, no env
      // file), and only a green one: a failure is always looked at afresh.
      const named = () => { try { relativeNames(testFile, ROOT); } catch { /* no report, or not one: readTests says so */ } };
      if (git.stamp === git.head && !args.fresh) named();
      const cached = git.stamp === git.head && !args.fresh ? readTests(testFile) : null;
      if (testsGreen(cached)) {
        entry.data = cached;
        done(true, testsLine(cached));
        say(`    (this commit's report was in the cache and was used again; --fresh runs the tests anyway)`);
        continue;
      }
      rmSync(testFile, { force: true }); // an old report must never be read as this run's
      const r = await run$(entry.cmd, { timeoutMs: def.timeoutMs, onData: follow });
      keep(r);
      // vitest names each file by its full path on this disk; the report is kept with names from the repo's root, so
      // it can be compared with one made in another checkout (lib/vitest.mjs).
      named();
      const t = readTests(testFile);
      if (!t) {
        entry.lines = tail(r);
        done(false, `vitest wrote no report (exit ${r.code})`);
        continue;
      }
      entry.data = t;
      const said = (name) => (t.why[name] ? [`    ${t.why[name]}`] : []);
      entry.lines = [
        ...t.failedTests.flatMap((name) => [`failed: ${name}`, ...said(name)]),
        ...t.failedFiles.filter((f) => !t.failedTests.some((name) => name.startsWith(`${f}:`))).flatMap((f) => [`failed to run: ${f}`, ...said(f)]),
      ];
      const ok = r.code === 0 && testsGreen(t);
      done(ok, `${testsLine(t)}${ok ? '' : r.code !== 0 && testsGreen(t) ? ` (vitest ended with exit ${r.code})` : ''}`);
      continue;
    }

    const r = await run$(def.cmd, { timeoutMs: def.timeoutMs, onData: follow });
    keep(r);
    if (r.code !== 0) entry.lines = tail(r);
    done(r.code === 0, r.code === 0 ? 'passed' : r.timedOut ? `stopped after ${Math.round(def.timeoutMs / 60_000)} minutes` : `failed (exit ${r.code})`);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The modules
  // ------------------------------------------------------------------------------------------------------------------

  const baseTests = join(cache, git.base, 'vitest.json');
  const context = (id) => ({
    root: ROOT,
    mode: args.mode,
    milestone: run.milestone,
    base: git.base,
    head: git.head,
    dirty: git.dirty,
    cache,
    plan,
    stored: store[id],
    seed: args.seed,
    log: (line) => say(`    [${id}] ${line}`),
    sh: run$,
    vitest: { head: existsSync(testFile) ? testFile : null, base: existsSync(baseTests) ? baseTests : null },
    // Beyond the contract, for a module that needs it: the branch, whether this is a part run, and how the runner's
    // own steps went ({ ran, ok } for types, tests, build and build-server).
    branch: git.branch,
    partial,
    steps: stepState,
  });
  const strings = (list) => (Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : []);
  let stored = 0;

  for (const id of MODULES) {
    const entry = { id, status: 'pass', ok: true, summary: '', lines: [], measured: undefined, ratchets: [], seeded: [], decisions: [], human: [], data: {} };
    run.modules.push(entry);
    const file = join(HERE, `${id}.mjs`);
    const wanted = args.mode === 'quick' ? QUICK.includes(id) : true;
    const fail = (summary, status = 'fail') => { entry.ok = false; entry.status = status; entry.summary = summary; };
    const report = () => say(`  ${id}: ${WORD[entry.status]}  ${entry.summary}`);

    if (!chosen(id)) { entry.status = 'left out'; entry.summary = 'left out of this part run'; report(); continue; }
    if (!existsSync(file)) {
      if (wanted) fail(`tools/gate/${id}.mjs does not exist yet: nothing was checked`, 'not built');
      else { entry.status = 'not in this mode'; entry.summary = `not part of --${args.mode} (and tools/gate/${id}.mjs does not exist yet)`; }
      report();
      continue;
    }
    let mod;
    try { mod = await import(pathToFileURL(file).href); } catch (e) {
      fail(`tools/gate/${id}.mjs could not be loaded: ${String(e?.message ?? e).split('\n')[0]}`);
      report();
      continue;
    }
    if (mod.id !== id || !Array.isArray(mod.modes) || typeof mod.run !== 'function') {
      fail(`tools/gate/${id}.mjs does not follow the contract (it must export id = '${id}', modes and run)`);
      report();
      continue;
    }
    if (!mod.modes.includes(args.mode)) {
      if (wanted) fail(`tools/gate/${id}.mjs leaves --${args.mode} out of its modes, and the gate needs it there`);
      else { entry.status = 'not in this mode'; entry.summary = `not part of --${args.mode}`; }
      report();
      continue;
    }

    say(`  ${id}: running ...`);
    let result;
    try { result = await mod.run(context(id)); } catch (e) {
      fail(`threw: ${String(e?.message ?? e).split('\n')[0]}`);
      entry.lines = String(e?.stack ?? e).split('\n').slice(0, 4);
      report();
      continue;
    }
    if (!result || typeof result.ok !== 'boolean') {
      fail('returned no verdict (run must resolve to { ok, summary, ... })');
      report();
      continue;
    }
    entry.summary = String(result.summary ?? '');
    entry.lines = strings(result.lines);
    entry.data = result.data ?? {};
    entry.measured = result.measured;
    entry.decisions = strings(result.decisions);
    entry.human = strings(result.human);

    // The ratchets. A module that failed is never seeded from: what it measured may be half a measurement.
    const judged = compare({ stored: store[id], measured: result.measured, seedWith: result.seedWith, seed: args.seed && result.ok });
    entry.ratchets = judged.rows;
    if (judged.add.length) {
      entry.seeded = addSeeds(store, id, judged.add).map((s) => ({ leaf: leafName(s.path), value: s.value }));
      stored += entry.seeded.length;
    }
    entry.ok = result.ok && judged.ok;
    // A module that could not do its work says so with a summary that starts "NOT RUN": it is shown as that, and it
    // fails like any other check that did not pass.
    entry.status = entry.ok ? 'pass' : !result.ok && /^NOT RUN\b/.test(entry.summary) ? 'not run' : 'fail';
    if (result.ok && !judged.ok) entry.summary = `${entry.summary}${entry.summary ? '; ' : ''}a ratchet did not hold: ${judged.rows.filter((r) => !r.ok).map((r) => `${r.leaf} ${r.verdict}`).join(', ')}`;
    if (!result.ok && args.seed && result.measured !== undefined) entry.lines.push('nothing was stored from this module under --seed, because it failed');
    report();
    for (const r of judged.rows) say(`      ${rowLine(r)}`);

    if (id === 'pictures' && result.data && typeof result.data === 'object') {
      // What the pictures module may hand over for the report's own section: lists of shot ids.
      const lists = {};
      for (const [key, name] of [['changed', 'Changed'], ['unexpected', 'Changed and not declared'], ['unchanged', 'Declared and not changed']]) {
        if (Array.isArray(result.data[key])) lists[name] = result.data[key].map(String);
      }
      if (Object.keys(lists).length) run.pictures = lists;
    }
  }

  if (stored > 0) {
    writeStore(RATCHETS, store);
    store = readStore(RATCHETS);
    say(`  stored ${stored} new ratchet value${stored === 1 ? '' : 's'} in docs/visual-overhaul/RATCHETS.json`);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // What the runner checks about the run itself
  // ------------------------------------------------------------------------------------------------------------------

  // A gate tool writes into the cache, never into the repo. Anything `git status` lists now that it did not list
  // when the run started was left by this run: a failure, in every kind of run. (The run's own report is written
  // after this; the ratchet store is the runner's to write under --seed.)
  try {
    const before = new Set(git.porcelain);
    const mine = new Set([...ownReports, ...(stored > 0 ? ['docs/visual-overhaul/RATCHETS.json'] : [])]);
    const left = (await status(run$, ROOT)).filter(([state, path]) => !before.has(`${state} ${path}`) && !mine.has(path)).map(([state, path]) => `${state} ${path}`);
    run.extra.push(left.length
      ? { id: 'left-behind', name: 'nothing left behind', status: 'fail', ok: false, summary: `this run left ${left.length} path${left.length === 1 ? '' : 's'} in the repo that ${left.length === 1 ? 'was' : 'were'} not there when it started: ${left.slice(0, 8).join(', ')}${left.length > 8 ? ', ...' : ''} (a gate tool writes into the cache only)` }
      : { id: 'left-behind', name: 'nothing left behind', status: 'pass', ok: true, summary: '`git status` lists nothing this run added' });
  } catch (e) {
    run.extra.push({ id: 'left-behind', name: 'nothing left behind', status: 'fail', ok: false, summary: `git status could not be read after the run: ${String(e?.message ?? e).split('\n')[0]}` });
  }

  const numbered = args.mode === 'milestone' && args.milestone !== null;
  if (numbered || args.mode === 'baseline') {
    run.extra.push(git.dirty
      ? { id: 'tree', name: 'tree', status: 'fail', ok: false, summary: `git status --porcelain is not empty (${git.porcelain.length} paths): a report must describe a commit` }
      : { id: 'tree', name: 'tree', status: 'pass', ok: true, summary: git.porcelain.length ? 'clean but for this report' : 'git status --porcelain is empty' });
  }
  if (args.mode === 'baseline') {
    run.extra.push(git.base === git.head
      ? { id: 'fresh-branch', name: 'fresh branch', status: 'pass', ok: true, summary: 'head is the base' }
      : { id: 'fresh-branch', name: 'fresh branch', status: 'fail', ok: false, summary: `head is ${ahead ?? 'some'} commits past the base: a baseline is run before work starts` });
  }

  // Human checks (plan file 16, section 7): a result lives in docs/visual-overhaul/human/mNN.md, on a line that starts
  // with the check's id. A missing one is printed in every later report, and blocks milestone 12.
  if ((numbered || args.mode === 'baseline') && run.milestone !== null) {
    for (let m = 0; m <= run.milestone; m++) {
      const entry = planOf(m);
      if (!entry) continue;
      const rel = `docs/visual-overhaul/human/m${two(m)}.md`;
      const text = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null;
      if (text !== null) run.humanFiles.push({ milestone: m, path: rel, text });
      for (const h of entry.human ?? []) {
        const answered = text !== null && text.split('\n').some((line) => line.replace(/^[\s#>*-]+/, '').startsWith(h.id));
        run.human.push({ milestone: m, id: h.id, what: h.what, from: h.from ?? '', state: answered ? 'answered' : 'open' });
      }
    }
    if (plan?.stops) {
      const rel = `docs/visual-overhaul/human/m${two(run.milestone)}.md`;
      run.stop = `Milestone ${two(run.milestone)} stops for Brian before the next one starts. His answer is quoted from ${rel}${existsSync(join(ROOT, rel)) ? ', below.' : ', which does not exist yet: no answer is recorded.'}`;
    }
  }
  for (const m of run.modules) for (const what of m.human) run.human.push({ milestone: null, id: '', what: `${m.id}: ${what}`, from: '', state: 'open' });
  const open = run.human.filter((h) => h.state === 'open');
  if (numbered && args.milestone === 12) {
    run.extra.push(open.length
      ? { id: 'human', name: 'human checks', status: 'fail', ok: false, summary: `${open.length} human checks have no result: the release milestone waits for every one` }
      : { id: 'human', name: 'human checks', status: 'pass', ok: true, summary: 'every human check has a result' });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Decisions for Brian
  // ------------------------------------------------------------------------------------------------------------------

  try {
    run.watched = await watchedDiff(run$, ROOT, git.base, git.head);
  } catch (e) {
    run.decisions.push(`The watched files could not be compared (${String(e?.message ?? e)}): look at them by hand: ${WATCHED_NAMES.join(', ')}.`);
  }
  const groups = new Map();
  for (const f of run.watched.committed) {
    const g = groups.get(watchedGroup(f.path)) ?? { files: 0, added: 0, removed: 0 };
    g.files++; g.added += f.added ?? 0; g.removed += f.removed ?? 0;
    groups.set(watchedGroup(f.path), g);
  }
  for (const [name, g] of [...groups].sort()) {
    run.decisions.push(`${name} changed between base and head: ${g.files === 1 ? '' : `${g.files} files, `}${g.added} line${g.added === 1 ? '' : 's'} added, ${g.removed} removed. The diff is under "Watched files".`);
  }
  if (run.watched.uncommitted.length) run.decisions.push(`Watched files changed and not committed: ${run.watched.uncommitted.map((f) => f.path).join(', ')}.`);
  // The ratchet store against the base's, leaf by leaf: a number let out is said in so many words, not left in a diff.
  try {
    const was = await fileAt(run$, ROOT, git.base, 'docs/visual-overhaul/RATCHETS.json');
    run.storeChanges = storeChanges(was === null ? {} : JSON.parse(was), store);
    for (const c of run.storeChanges.filter((x) => x.looser)) {
      run.decisions.push(`RATCHETS.json: ${c.leaf} was ${c.change === 'removed' ? 'taken out (it was ' + c.from + ')' : `${c.change} from ${c.from} to ${c.to}`} since the base. A ratchet is let out only with Brian's dated words.`);
    }
  } catch (e) {
    run.decisions.push(`RATCHETS.json could not be compared with the base's (${String(e?.message ?? e).split('\n')[0]}): read its diff by hand.`);
  }
  if (stored > 0) run.decisions.push(`This run stored ${stored} ratchet value${stored === 1 ? '' : 's'} for the first time (--seed): ${run.modules.flatMap((m) => m.seeded.map((s) => s.leaf)).join(', ')}.`);
  for (const m of run.modules) for (const d of m.decisions) run.decisions.push(`${m.id}: ${d}`);
  // The version and the changelog (plan file 16, section 7: every milestone's pull request has a CHANGELOG.md line and
  // a version bump). Recorded, and said when a milestone has neither yet; never a failure of the gate: the plan's list
  // of what the gate judges does not hold them, and a person (Kai's review) does.
  try {
    const versionOf = (text) => { try { return JSON.parse(text).version ?? null; } catch { return null; } };
    const was = await fileAt(run$, ROOT, git.base, 'package.json');
    const changelog = await run$(`git diff --name-only ${quote(`${git.base}...${git.head}`)} -- CHANGELOG.md`);
    run.release = {
      versionAtBase: was === null ? null : versionOf(was),
      version: versionOf(readFileSync(join(ROOT, 'package.json'), 'utf8')),
      changelogChanged: changelog.stdout.trim() !== '' || git.porcelain.some((l) => l.slice(3) === 'CHANGELOG.md'),
    };
    if (numbered && git.base !== git.head) {
      const missing = [run.release.version === run.release.versionAtBase ? `the version is still ${run.release.version}` : '', run.release.changelogChanged ? '' : 'CHANGELOG.md has no new line'].filter(Boolean);
      if (missing.length) run.decisions.push(`Milestone ${two(milestone)} is not ready to merge: ${missing.join(' and ')} (every milestone's pull request carries a changelog line and a version bump).`);
    }
  } catch { /* recorded as unknown */ }
  if (numbered) {
    if (run.commits.expectedBranch && git.branch && git.branch !== run.commits.expectedBranch) run.decisions.push(`This is milestone ${two(milestone)} on the branch "${git.branch}"; the plan's branch is "${run.commits.expectedBranch}".`);
    for (const u of plan?.undeclared ?? []) run.decisions.push(`Shots, not said by the plan: ${u}`);
    const asked = (plan?.questions ?? []).filter((q) => !table.answered?.[String(q)]);
    if (asked.length) run.decisions.push(`Plan file 19, section 2, asks question${asked.length === 1 ? '' : 's'} ${asked.join(', ')} at this milestone. Each answer is recorded, dated and quoted, in docs/visual-overhaul/human/m${two(milestone)}.md.`);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The verdict and the report
  // ------------------------------------------------------------------------------------------------------------------

  const failed = [...run.steps, ...run.extra, ...run.modules].filter((e) => ['fail', 'not built', 'not run'].includes(e.status)).map((e) => e.id);
  run.verdict = { failed, word: failed.length ? 'FAIL' : partial ? 'PART RUN' : 'PASS' };

  const written = writeReports(run, { root: ROOT, cache });
  say();
  for (const line of summaryLines(run)) say(line);
  say();
  for (const file of written) say(`report: ${file}`);
  say(`logs:   ${logs}`);
  process.exitCode = failed.length ? 1 : partial ? 2 : 0;
}

main().catch((e) => {
  if (e instanceof Usage) {
    process.stderr.write(`gate: ${e.message}\n(node tools/gate/gate.mjs --help)\n`);
    process.exitCode = 64;
    return;
  }
  // The gate itself broke. That is never a pass.
  process.stderr.write(`\ngate: could not run: ${e?.stack ?? e}\nVERDICT: FAIL (the gate itself did not finish)\n`);
  process.exitCode = 1;
}).finally(() => {
  // The verdict is in. A module that left something open (a server, a timer) must not keep the gate from ending:
  // once everything printed has been written out, stop.
  process.stdout.write('', () => process.stderr.write('', () => process.exit(process.exitCode ?? 0)));
});
