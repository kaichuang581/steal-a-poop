// Gate module: the painted smoke and fault suite (plan file 16, section 4.1 a).
//
// It runs what CI's `smoke` job runs, `npm run test:painted`, and reads Playwright's own JSON report of it. The suite
// builds the painted game and serves it by itself (e2e-painted/playwright.painted.config.ts), so nothing here depends
// on the dist/ the runner built.
//
// What it reports: how many cases passed, how many failed, and how many carry the expected-to-fail mark. The fault
// cases are marked until milestone 1 gives the game its fail-soft; each marked case is named with what it does today.
// Three numbers go to the ratchets:
//   expectedToFail  the marked cases. It may only fall, and from milestone 1 on it must be 0.
//   knownToday      things the suite saw that are wrong today and that the plan gives no check for (the suite writes
//                   each on its case as a note of type `known`). Named in the report. It may only fall.
//   cases           how many cases the suite has. Stored as a floor: a case cannot be dropped quietly.
//
// A case that is skipped, or run alone, fails the module: every case runs every time. A marked case that passes fails
// the run by Playwright's own rule, and this module says to take the mark off.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { treeDir } from './lib/painted.mjs';
import { quote } from './lib/sh.mjs';

export const id = 'smoke';
export const modes = ['milestone', 'baseline'];

const SUITE = 'e2e-painted';
const FILES = ['smoke.spec.ts', 'faults.spec.ts'];
/** The longest the whole suite may take. It takes a few minutes; a shared machine drawing in software can be many times slower. */
const PATIENCE_MS = 60 * 60_000;

/** Colour codes out, the repo's and the cache's own paths made relative: nothing in the report names this machine. */
function plain(text, ctx) {
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '').split(ctx.root).join('.').split(ctx.cache).join('<cache>');
}
const firstLine = (text, ctx) => plain(text, ctx).split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 400) ?? '';

/** Every case in Playwright's report, in the report's own order. */
function casesOf(report, ctx) {
  const out = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const notes = (t.annotations ?? []).map((a) => ({ type: String(a.type), text: plain(a.description ?? '', ctx) }));
        out.push({
          file: String(spec.file ?? suite.file ?? ''),
          title: [...path, spec.title].join(' > '),
          // 'passed', or 'failed' for a case that carries the mark.
          expected: t.expectedStatus,
          // What happened: 'passed', 'failed', 'timedOut', 'interrupted', 'skipped', or 'not run'.
          outcome: last?.status ?? 'not run',
          // Playwright's verdict: 'expected', 'unexpected', 'flaky' or 'skipped'.
          verdict: t.status,
          marked: notes.find((n) => n.type === 'fail')?.text ?? '',
          known: notes.filter((n) => n.type === 'known').map((n) => n.text),
          said: firstLine(last?.error?.message ?? last?.errors?.[0]?.message ?? '', ctx),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, child.file === child.title ? path : [...path, child.title]);
  };
  for (const top of report.suites ?? []) walk(top, []);
  return out;
}

/** How often the suite's own files call for a mark, a skip or a lone run, read from the source. */
function marksIn(root) {
  const count = { fail: 0, left: [] };
  const dir = join(root, SUITE);
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')).sort() : []) {
    const text = readFileSync(join(dir, name), 'utf8');
    count.fail += (text.match(/\btest\.fail\s*\(/g) ?? []).length;
    for (const m of text.matchAll(/\b(?:test|describe|it)(?:\.describe)?\.(skip|only|fixme)\s*\(/g)) count.left.push(`${SUITE}/${name}: ${m[0].replace(/\s*\($/, '')}`);
  }
  return count;
}

export async function run(ctx) {
  const dir = join(treeDir(ctx.root), 'smoke');
  // Made afresh every run: a report left by an earlier run must never be read as this one's.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const reportFile = join(dir, 'report.json');

  const t0 = Date.now();
  let tail = '';
  const res = await ctx.sh(`npm run test:painted -- --reporter=list,json --output ${quote(join(dir, 'test-results'))}`, {
    env: { PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile },
    timeoutMs: PATIENCE_MS,
    onData: (text) => {
      tail = (tail + text).slice(-4000);
      for (const line of plain(text, ctx).split('\n')) if (/^\s*(✓|✘|ok|x|-|\d+ (passed|failed|skipped|flaky))/.test(line)) ctx.log(line.trim().slice(0, 200));
    },
  });
  const seconds = Math.round((Date.now() - t0) / 1000);
  writeFileSync(join(dir, 'output.log'), `${res.stdout}\n${res.stderr}`);
  ctx.log(`the suite ran for ${seconds} s (exit ${res.code}); its report and what it printed are in ${plain(dir, ctx)}`);

  const notRun = (why) => ({
    ok: false,
    summary: `NOT RUN: ${why}`,
    lines: plain(tail, ctx).split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-12),
    data: { exit: res.code },
  });
  if (res.timedOut) return notRun(`npm run test:painted was stopped after ${Math.round(PATIENCE_MS / 60_000)} minutes`);
  let report;
  try { report = JSON.parse(readFileSync(reportFile, 'utf8')); } catch {
    return notRun(`npm run test:painted wrote no report (exit ${res.code}): the build or the preview server did not come up`);
  }
  const cases = casesOf(report, ctx);
  const outside = (report.errors ?? []).map((e) => firstLine(e.message ?? e, ctx)).filter(Boolean);
  if (!cases.length) return notRun(`no case ran (exit ${res.code})${outside.length ? `: ${outside[0]}` : ''}`);
  if (cases.every((c) => c.outcome === 'not run')) return notRun(`the suite was found but none of its ${cases.length} cases ran (exit ${res.code})${outside.length ? `: ${outside[0]}` : ''}`);

  const marked = cases.filter((c) => c.expected === 'failed');
  const passed = cases.filter((c) => c.expected === 'passed' && c.verdict === 'expected');
  const skipped = cases.filter((c) => c.verdict === 'skipped' || c.expected === 'skipped');
  const failed = cases.filter((c) => !skipped.includes(c) && c.verdict !== 'expected');
  const failsAsMarked = marked.filter((c) => c.verdict === 'expected');
  const known = cases.flatMap((c) => c.known.map((text) => ({ title: c.title, text })));
  const source = marksIn(ctx.root);

  const problems = [];
  if (failed.length) problems.push(`${failed.length} failed`);
  if (skipped.length) problems.push(`${skipped.length} skipped (every case runs every time)`);
  if (outside.length) problems.push(`the run itself reported: ${outside[0]}`);
  for (const file of FILES) if (!cases.some((c) => c.file.endsWith(file))) problems.push(`no case from ${SUITE}/${file} ran`);
  if (source.left.length) problems.push(`a case is switched off or run alone in the source: ${source.left.join(', ')}`);
  if (source.fail !== marked.length) problems.push(`the source marks ${source.fail} cases as expected to fail and the run saw ${marked.length}: a mark that depends on something is not a mark the gate can count`);
  // The plan: "milestone 1 removes every mark, and the gate fails if one remains after milestone 1".
  if (ctx.mode === 'milestone' && typeof ctx.milestone === 'number' && ctx.milestone >= 1 && marked.length) {
    problems.push(`${marked.length} cases still carry the expected-to-fail mark, and milestone 1 takes every one off`);
  }
  if (res.code !== 0 && !problems.length) problems.push(`npm run test:painted ended with exit ${res.code}`);

  const lines = [];
  for (const c of cases) {
    const name = `${c.file}: ${c.title}`;
    if (skipped.includes(c)) lines.push(`${name}: SKIPPED`);
    else if (c.expected === 'failed' && c.verdict === 'expected') lines.push(`${name}: fails, as marked. This run: ${c.said || 'it gave no reason'}`);
    else if (c.expected === 'failed') lines.push(`${name}: PASSED although it is marked as expected to fail. Take the mark off in ${SUITE}/${c.file}, and lower smoke.expectedToFail in RATCHETS.json`);
    else if (c.verdict === 'expected') lines.push(`${name}: passed`);
    else lines.push(`${name}: FAILED (${c.outcome}${c.verdict === 'flaky' ? ', then passed on another try' : ''}). ${c.said}`);
  }
  if (marked.length) {
    lines.push('', `Marked as expected to fail (${marked.length}). Each mark says what the game does today:`);
    for (const c of marked) lines.push(`${c.title}: ${c.marked || 'the mark gives no reason'}`);
  }
  if (known.length) {
    lines.push('', `Wrong today, with no check in the plan (${known.length}). Not held against the suite; counted so that it cannot grow:`);
    for (const k of known) lines.push(`${k.title}: ${k.text}`);
  }
  if (outside.length) lines.push('', ...outside.map((e) => `The run itself: ${e}`));

  return {
    ok: problems.length === 0,
    summary: `${passed.length} passed, ${failed.length} failed, ${marked.length} marked as expected to fail${failsAsMarked.length === marked.length ? '' : ` (${failsAsMarked.length} of them fail)`}, of ${cases.length} cases${known.length ? `; ${known.length} known wrong today` : ''}${problems.length ? `: ${problems.join('; ')}` : ''}`,
    lines,
    data: {
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      expectedToFail: marked.length,
      cases: cases.map((c) => ({ file: c.file, title: c.title, expected: c.expected, outcome: c.outcome, verdict: c.verdict, ...(c.marked ? { marked: c.marked } : {}), ...(c.known.length ? { known: c.known } : {}), ...(c.verdict === 'expected' && c.expected === 'passed' ? {} : { said: c.said }) })),
      knownToday: known,
      exit: res.code,
    },
    measured: { expectedToFail: marked.length, knownToday: known.length, cases: cases.length },
    seedWith: { expectedToFail: marked.length, knownToday: known.length, cases: { min: cases.length } },
    decisions: [],
    human: [],
  };
}
