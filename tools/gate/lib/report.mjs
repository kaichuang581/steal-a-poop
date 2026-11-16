// Turns one gate run into its report: a .json (everything, for machines) and a .md (what a reviewer reads). What a
// milestone report must record is listed in plan file 16, section 7; every item on that list has its own place below.
//
// Two runs of the same tree print the same report, but for one field: "ranAt" is the only time anywhere in it. No
// durations, no paths outside the repo (the cache is written <cache>, the repo's own files are relative), keys always
// in the same order.
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fmt, sorted } from './ratchets.mjs';

/** Verdict words, as they are printed everywhere. */
export const WORD = { pass: 'PASS', fail: 'FAIL', 'not built': 'NOT BUILT', 'not run': 'NOT RUN', 'left out': 'left out', 'not in this mode': 'not in this mode' };

const two = (n) => String(n).padStart(2, '0');
const short = (sha) => (sha ? sha.slice(0, 7) : 'none');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The name a run's report goes by: quick, baseline, m03, none. */
export function labelOf(mode, milestone) {
  if (mode === 'milestone') return milestone === null ? 'none' : `m${two(milestone)}`;
  return mode;
}

/** What the run was, in words. */
function title(run) {
  if (run.mode === 'quick') return `quick${run.milestone === null ? '' : ` (milestone ${two(run.milestone)})`}`;
  if (run.mode === 'baseline') return `baseline${run.milestone === null ? '' : ` for milestone ${two(run.milestone)}`}`;
  return run.milestone === null ? 'a pull request that is not an overhaul milestone' : `milestone ${two(run.milestone)}${run.plan?.name ? ` (${run.plan.name})` : ''}`;
}

/** The command that makes this report again. */
function command(run) {
  const mode = run.mode === 'milestone' ? `--milestone ${run.milestone === null ? 'none' : run.milestone}` : `--${run.mode}`;
  return ['node tools/gate/gate.mjs', mode, run.only.length ? `--only ${run.only.join(',')}` : '', run.skip.length ? `--skip ${run.skip.join(',')}` : '', run.seed ? '--seed' : '', run.baseGiven ? `--base ${run.baseGiven}` : ''].filter(Boolean).join(' ');
}

/** Takes this machine out of every string: the cache becomes <cache>, the repo's own files become relative. */
export function scrub(value, { root, cache }) {
  const home = homedir();
  const swap = (text) => text.split(cache).join('<cache>').split(`${root}/`).join('').split(root).join('.').split(home).join('~');
  const walk = (v) => {
    if (typeof v === 'string') return swap(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [swap(k), walk(x)]));
    return v;
  };
  return walk(value);
}

/** The machine-readable report. Key order is fixed here; what modules hand in (data, measured) is sorted by key. */
export function buildJson(run) {
  return {
    ranAt: run.ranAt,
    report: 1,
    command: command(run),
    mode: run.mode,
    milestone: run.milestone,
    label: run.label,
    verdict: run.verdict.word,
    failed: run.verdict.failed,
    partial: run.partial,
    only: run.only,
    skip: run.skip,
    seed: run.seed,
    commits: {
      base: run.commits.base,
      head: run.commits.head,
      headIsBase: run.commits.base === run.commits.head,
      commitsPastBase: run.commits.ahead,
      branch: run.commits.branch,
      expectedBranch: run.commits.expectedBranch,
    },
    tree: { clean: run.tree.clean, porcelain: run.tree.porcelain },
    release: run.release,
    environment: run.environment,
    plan: run.plan ? sorted(run.plan) : null,
    steps: run.steps.map((s) => ({ id: s.id, name: s.name, command: s.cmd, verdict: WORD[s.status], summary: s.summary, lines: s.lines, data: sorted(s.data ?? {}) })),
    checks: run.extra.map((x) => ({ id: x.id, name: x.name, verdict: WORD[x.status], summary: x.summary })),
    modules: run.modules.map((m) => ({
      id: m.id,
      verdict: WORD[m.status],
      summary: m.summary,
      lines: m.lines,
      measured: sorted(m.measured ?? {}),
      ratchets: m.ratchets.map((r) => ({ leaf: r.leaf, kind: r.kind === 'min' ? 'may not fall' : 'may not rise', stored: r.old, now: r.new, verdict: r.verdict, ok: r.ok, note: r.note })),
      seeded: m.seeded,
      decisions: m.decisions,
      human: m.human,
      data: sorted(m.data ?? {}),
    })),
    pictures: run.pictures,
    human: run.human,
    humanFiles: run.humanFiles,
    stop: run.stop,
    watched: run.watched,
    ratchetStoreChanges: run.storeChanges,
    decisions: run.decisions,
  };
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)];
const bullets = (items, none) => (items.length ? items.map((i) => `- ${i}`) : [none]);
const fenced = (lines) => (lines.length ? ['```', ...lines.map((l) => l.replace(/```/g, "'''")), '```'] : []);

/** One module's or step's own section. */
function detail(entry, heading) {
  const out = [`### ${heading}: ${WORD[entry.status]}`, '', entry.summary || '(no summary)', ''];
  if (entry.lines?.length) out.push(...fenced(entry.lines), '');
  return out;
}

/** The reviewer's report. */
export function buildMarkdown(run) {
  const find = (id) => run.modules.find((m) => m.id === id);
  const step = (id) => run.steps.find((s) => s.id === id);
  const out = [];
  out.push(`# Gate report: ${title(run)}`, '');
  out.push(`Written by \`${command(run)}\`. Do not edit it: CI runs the gate again and that run is the judge.`, '');
  const failed = run.verdict.failed;
  out.push(`**Verdict: ${run.verdict.word}.** ${failed.length ? `${plural(failed.length, 'check')} did not pass: ${failed.join(', ')}.` : run.partial ? 'What ran passed.' : 'Every check passed.'}`);
  if (run.partial) out.push('', `This was a part run (${[run.only.length ? `--only ${run.only.join(',')}` : '', run.skip.length ? `--skip ${run.skip.join(',')}` : ''].filter(Boolean).join(' ')}). A part run is never a gate result.`);
  out.push('');

  out.push('## The run', '');
  const ahead = run.commits.ahead;
  out.push(...table(['', ''], [
    ['Ran at', run.ranAt],
    ['Base commit', `\`${run.commits.base}\``],
    ['Head commit', `\`${run.commits.head}\`${run.commits.base === run.commits.head ? ' (the base itself)' : ahead === null ? '' : ` (${plural(ahead, 'commit')} past the base)`}`],
    ['Branch', `${run.commits.branch || '(none: a detached checkout)'}${run.commits.expectedBranch && run.commits.expectedBranch !== run.commits.branch ? `, where \`${run.commits.expectedBranch}\` was expected` : ''}`],
    ['`git status --porcelain`', run.tree.porcelain.length ? `NOT empty: ${plural(run.tree.porcelain.length, 'path')}${run.tree.clean ? ' (only this report)' : ''}` : 'empty'],
    ['Version in package.json', `${run.release.version ?? 'unknown'}${run.release.versionAtBase === null ? '' : run.release.version === run.release.versionAtBase ? ' (the same as at the base)' : ` (${run.release.versionAtBase} at the base)`}`],
    ['CHANGELOG.md', run.release.changelogChanged ? 'changed since the base' : 'not changed since the base'],
    ['Ratchets stored in this run (`--seed`)', run.seed ? String(run.modules.reduce((n, m) => n + m.seeded.length, 0)) : 'no'],
    ['Node', `${run.environment.node} on ${run.environment.platform}${run.environment.ci ? ', on the build server' : ''}`],
  ]), '');
  if (run.tree.porcelain.length) out.push('Not committed:', '', ...fenced(run.tree.porcelain), '');

  out.push('## Every check', '');
  out.push(...table(['Check', 'Verdict', 'In one line'], [
    ...run.steps.map((s) => [`${s.name} (\`${s.cmd}\`)`, WORD[s.status], s.summary]),
    ...run.extra.map((x) => [x.name, WORD[x.status], x.summary]),
    ...run.modules.map((m) => [m.id, WORD[m.status], m.summary]),
  ]), '');

  out.push('## Type check, tests and builds', '');
  for (const s of run.steps) out.push(...detail(s, s.name));
  const tests = step('tests');
  if (tests?.data?.total !== undefined) {
    const t = tests.data;
    out.push(`\`npm test\` counts: ${plural(t.files, 'file')}, ${plural(t.total, 'test')}: ${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped, ${t.todo} todo.`, '');
  }

  out.push('## Size', '', ...moduleSection(find('size')));
  out.push('## Scenes (`check:scenes`)', '', ...moduleSection(find('scenes')));
  out.push('## Bake manifest', '', ...moduleSection(find('baked')));
  out.push('## Fences', '', ...moduleSection(find('fences')));
  out.push('## Test ledger', '', ...moduleSection(find('ledger')));
  out.push('## Banned returns', '', ...moduleSection(find('banned')));

  out.push('## Pictures, against the declared list', '');
  if (run.mode === 'milestone' && run.milestone !== null) {
    const declared = run.plan?.shots ?? [];
    out.push(`Shots milestone ${two(run.milestone)} may change (tools/gate/milestones.json): ${declared.length ? declared.map((s) => `\`${s}\``).join(', ') : 'none'}.`, '');
    if (run.plan?.undeclared?.length) out.push(`The plan names no shot for some of this milestone's work (${plural(run.plan.undeclared.length, 'point')}, each under "Decisions for Brian"): a picture that changes outside the list above fails until the list is settled.`, '');
  } else if (run.mode === 'milestone') {
    out.push('Not a milestone: no shot is declared, and a changed picture is listed for the reviewer, not failed.', '');
  }
  out.push(...moduleSection(find('pictures')));
  if (run.pictures) {
    for (const [name, list] of Object.entries(run.pictures)) out.push(`${name}: ${list.length ? list.map((s) => `\`${s}\``).join(', ') : 'none'}.`, '');
  }

  out.push('## Smoke and fault suites', '', ...moduleSection(find('smoke')));
  out.push('## Counts', '', ...moduleSection(find('counts')));
  const others = run.modules.filter((m) => !['size', 'scenes', 'baked', 'fences', 'ledger', 'banned', 'pictures', 'smoke', 'counts'].includes(m.id));
  for (const m of others) out.push(`## ${m.id}`, '', ...moduleSection(m));

  out.push('## Ratchets: every number, stored and now', '');
  const rows = run.modules.flatMap((m) => m.ratchets.map((r) => [m.id, r.leaf, r.old === null ? 'none' : `${r.kind === 'min' ? 'at least ' : ''}${fmt(r.old)}`, fmt(r.new), `${r.verdict}${r.note ? `: ${r.note}` : ''}`]));
  if (rows.length) out.push(...table(['Module', 'Number', 'Stored', 'Now', 'Verdict'], rows), '');
  else out.push('No module that ran measured a number.', '');
  const seeded = run.modules.flatMap((m) => m.seeded.map((s) => `${s.leaf} = ${typeof s.value === 'object' ? `at least ${fmt(s.value.min)}` : fmt(s.value)}`));
  if (seeded.length) out.push('Stored for the first time in this run (`--seed`), now in docs/visual-overhaul/RATCHETS.json:', '', ...bullets(seeded, ''), '');
  const moved = run.storeChanges.filter((c) => c.change !== 'added');
  const added = run.storeChanges.length - moved.length;
  if (run.storeChanges.length) {
    out.push(`docs/visual-overhaul/RATCHETS.json against the base commit's: ${added} added${moved.length ? `, ${moved.length} changed:` : '.'}`, '');
    if (moved.length) out.push(...bullets(moved.map((c) => `${c.leaf}: ${c.change}, from ${c.from} to ${c.to}${c.looser ? ' (LOOSER: needs Brian\'s dated words)' : ''}`), ''), '');
  }
  const notChecked = run.modules.filter((m) => m.status === 'left out' || m.status === 'not in this mode' || m.status === 'not built').map((m) => m.id);
  if (notChecked.length) out.push(`Not compared in this run (the module did not run): ${notChecked.join(', ')}.`, '');

  out.push('## Open human checks', '');
  const open = run.human.filter((h) => h.state === 'open');
  out.push(...bullets(open.map((h) => `${h.milestone === null ? '' : `milestone ${two(h.milestone)}, `}${h.id ? `\`${h.id}\`: ` : ''}${h.what}${h.from ? ` (${h.from})` : ''}`), 'None.'), '');
  const answered = run.human.filter((h) => h.state === 'answered');
  if (answered.length) out.push('Answered (the text is quoted below):', '', ...bullets(answered.map((h) => `milestone ${two(h.milestone)}, \`${h.id}\`: ${h.what}`), ''), '');
  if (run.stop) out.push(run.stop, '');
  for (const f of run.humanFiles) out.push(`### ${f.path}`, '', ...f.text.trimEnd().split('\n').map((l) => `> ${l}`), '');

  out.push('## Decisions for Brian', '');
  out.push(...bullets(run.decisions, 'None.'), '');

  out.push('## Watched files, base to head', '');
  out.push('A change to any of these is a decision for Brian: docs/visual-overhaul/RATCHETS.json, src/skin/__tests__/fences.json, scripts/check-bundle-size.mjs, src/skin/audit/*.json, .github/**, tools/gate/**, docs/visual-overhaul/EXEMPT.json.', '');
  const w = run.watched;
  if (!w.committed.length && !w.uncommitted.length) out.push('None of them changed.', '');
  if (w.committed.length) out.push(...table(['File', 'What', 'Lines added', 'Lines removed'], w.committed.map((f) => [f.from ? `${f.path} (was ${f.from})` : f.path, f.kind ?? 'changed', f.added ?? 'binary', f.removed ?? 'binary'])), '');
  // The diff itself, for a file that was there before (a new file's diff is the file).
  for (const f of w.committed) {
    if (!f.diff?.length && !f.cut) continue;
    out.push(`### ${f.path}`, '', ...fenced(f.diff));
    if (f.cut) out.push('', `${plural(f.cut, 'more line')} of this diff ${f.cut === 1 ? 'is' : 'are'} not printed: \`git diff ${short(run.commits.base)}...${short(run.commits.head)} -- ${f.path}\` shows all of it.`);
    out.push('');
  }
  if (w.uncommitted.length) out.push('Changed and not committed:', '', ...fenced(w.uncommitted.map((f) => `${f.state} ${f.path}`)), '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function moduleSection(m) {
  if (!m) return ['This check is not part of the gate.', ''];
  const out = [`**${WORD[m.status]}.** ${m.summary || ''}`.trimEnd(), ''];
  if (m.lines?.length) out.push(...fenced(m.lines), '');
  return out;
}

/** The lines printed at the end of a run, and pasted wherever a summary is asked for. */
export function summaryLines(run) {
  const out = [];
  const width = Math.max(...[...run.steps, ...run.extra, ...run.modules].map((e) => (e.name ?? e.id).length), 6);
  out.push(`Fleeced gate: ${title(run)}`);
  out.push(`base ${short(run.commits.base)}  head ${short(run.commits.head)}${run.commits.base === run.commits.head ? ' (the base itself)' : ''}  branch ${run.commits.branch || '(detached)'}  tree ${run.tree.porcelain.length ? `NOT clean (${plural(run.tree.porcelain.length, 'path')})` : 'clean'}`);
  out.push('');
  for (const e of [...run.steps, ...run.extra, ...run.modules]) out.push(`  ${(e.name ?? e.id).padEnd(width)}  ${WORD[e.status].padEnd(16)}  ${e.summary}`);
  const rows = run.modules.flatMap((m) => m.ratchets.map((r) => ({ id: m.id, ...r })));
  out.push('', 'Ratchets (stored, now, verdict):');
  if (!rows.length) out.push('  none measured');
  for (const r of rows) out.push(`  ${r.id}.${r.leaf}: stored ${r.old === null ? 'none' : `${r.kind === 'min' ? 'at least ' : ''}${fmt(r.old)}`}, now ${fmt(r.new)}, ${r.verdict}${r.note ? ` (${r.note})` : ''}`);
  const open = run.human.filter((h) => h.state === 'open');
  out.push('', `Decisions for Brian: ${run.decisions.length}.`);
  for (const d of run.decisions) out.push(`  - ${d}`);
  out.push(`Open human checks: ${open.length}.`);
  for (const h of open) out.push(`  - ${h.milestone === null ? '' : `milestone ${two(h.milestone)}, `}${h.id ? `${h.id}: ` : ''}${h.what}`);
  const failed = run.verdict.failed;
  out.push(`VERDICT: ${run.verdict.word}${failed.length ? ` (${plural(failed.length, 'check')} did not pass: ${failed.join(', ')})` : ''}${run.partial ? ' (a part run is never a gate result)' : ''}`);
  return out;
}

/**
 * Writes the report. Always into the cache (<cache>/reports/<label>.json and .md, what CI uploads); and, for a whole
 * `--milestone NN` run, into the repo as docs/visual-overhaul/reports/mNN.json and mNN.md, to be committed unedited.
 * Returns the paths written.
 */
export function writeReports(run, { root, cache }) {
  const clean = scrub(run, { root, cache });
  const json = `${JSON.stringify(buildJson(clean), null, 2)}\n`;
  const md = buildMarkdown(clean);
  const written = [];
  const put = (dir) => {
    mkdirSync(dir, { recursive: true });
    for (const [ext, text] of [['json', json], ['md', md]]) {
      const file = join(dir, `${run.label}.${ext}`);
      writeFileSync(file, text);
      written.push(file);
    }
  };
  put(join(cache, 'reports'));
  if (run.mode === 'milestone' && run.milestone !== null && !run.partial) put(join(root, 'docs', 'visual-overhaul', 'reports'));
  return written;
}
