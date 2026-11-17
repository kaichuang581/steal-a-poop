// Gate module: the scene checker (plan file 18, section 4.2; file 16, section 4.1 i). Every scene and model built,
// fine and coarse, and judged by the stages of tools/scenes/: connect, place, lights, coplanar, lens, models, wendigo,
// baked. tools/scenes/README.md says what each is and how to add one.
//
// This module does no checking of its own. It runs the same command CI's check-scenes job and a person run,
//
//   npx vite-node tools/scenes/check.ts -- --json <cache>/scenes/gate-check.json
//
// and hands the runner what that wrote: the stages' verdict, their lines, every number they measured and the number of
// entries in docs/visual-overhaul/EXEMPT.json. The numbers are ratchets: the runner compares them with the `scenes`
// section of RATCHETS.json, and check.ts makes the same comparison with the same code, so the command alone passes or
// fails as the gate does. The one difference is on purpose: this module's own verdict is the stages' alone, without
// the ratchets, because the runner judges those itself and, under --seed, has to be able to store them the first time.
//
// A stage whose file does not exist is NOT BUILT in check.ts's output and fails this module: what was not checked
// never reads as green.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'scenes';
export const modes = ['milestone', 'baseline'];

/** Building every scene twice over and judging it has taken half a minute alone on this machine; the limit is for a loaded one. */
const TIMEOUT_MS = 40 * 60_000;
/** Lines of one stage kept for the report; the rest are in check.ts's own output and its JSON. */
const KEEP_LINES = 140;

const WORD = { pass: 'PASS', fail: 'FAIL', 'not built': 'NOT BUILT', 'not run': 'NOT RUN' };
const quote = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;

/** The entries of EXEMPT.json, counted here as well as by check.ts: two readers of one file must agree. */
function countExemptions(root) {
  try {
    const json = JSON.parse(readFileSync(join(root, 'docs', 'visual-overhaul', 'EXEMPT.json'), 'utf8'));
    return Array.isArray(json?.exemptions) ? json.exemptions.length : null;
  } catch {
    return null;
  }
}

export async function run(ctx) {
  const dir = join(ctx.cache, 'scenes');
  const file = join(dir, 'gate-check.json');
  mkdirSync(dir, { recursive: true });
  rmSync(file, { force: true }); // an older run's answer must never stand in for this one's

  const r = await ctx.sh(`npx vite-node tools/scenes/check.ts -- --json ${quote(file)}`, { timeoutMs: TIMEOUT_MS });
  const tail = () => `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-14);
  if (!existsSync(file)) {
    return { ok: false, summary: `NOT RUN: tools/scenes/check.ts wrote no result (exit ${r.code}${r.timedOut ? ', stopped after 40 minutes' : ''})`, lines: tail(), data: {} };
  }
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    return { ok: false, summary: `NOT RUN: what tools/scenes/check.ts wrote is not JSON (${String(e?.message ?? e).split('\n')[0]})`, lines: tail(), data: {} };
  }
  if (json?.tool !== 'check:scenes' || !Array.isArray(json.stages) || typeof json.checksOk !== 'boolean' || !json.measured || typeof json.measured !== 'object') {
    return { ok: false, summary: 'NOT RUN: what tools/scenes/check.ts wrote is not its report', lines: tail(), data: {} };
  }
  if (json.partial) return { ok: false, summary: 'NOT RUN: tools/scenes/check.ts ran a part only', lines: [], data: {} };

  const problems = [];
  const bad = json.stages.filter((s) => s.status !== 'pass');
  if (bad.length) problems.push(...bad.map((s) => `${s.id} ${{ fail: 'failed', 'not built': 'is not built', 'not run': 'did not run' }[s.status] ?? s.status}`));
  if (json.exempt?.problems?.length) problems.push(`EXEMPT.json is not in shape (${json.exempt.problems.length} points)`);
  if (json.problem) problems.push('the scenes could not be built');
  const mine = countExemptions(ctx.root);
  if (mine === null || mine !== json.measured.exemptions) problems.push(`EXEMPT.json holds ${mine ?? 'no readable list of'} entries here and ${json.measured.exemptions} by check.ts's count`);
  // check.ts ends 0 only when its stages passed and its ratchets held; the ratchets are the runner's to judge here.
  if (r.code !== 0 && json.checksOk && json.ratchetsOk) problems.push(`tools/scenes/check.ts ended with exit ${r.code} though its report says everything held`);
  if (r.code === 0 && !json.checksOk) problems.push('tools/scenes/check.ts ended with exit 0 though its report says a stage did not pass');
  if (!json.checksOk && !problems.length) problems.push('tools/scenes/check.ts says its checks did not pass');

  const lines = [];
  for (const s of json.stages) {
    lines.push(`${s.id}: ${WORD[s.status] ?? s.status}  ${s.summary}`);
    const own = (s.lines ?? []).filter((l) => l.trim());
    lines.push(...own.slice(0, KEEP_LINES).map((l) => `    ${l}`));
    if (own.length > KEEP_LINES) lines.push(`    ... ${own.length - KEEP_LINES} more lines: npm run check:scenes -- --only ${s.id}`);
  }
  for (const p of json.exempt?.problems ?? []) lines.push(`EXEMPT.json: ${p}`);
  const pending = (json.exempt?.entries ?? []).filter((e) => e.status === 'pending');
  lines.push(`EXEMPT.json: ${json.measured.exemptions} entries${pending.length ? `, ${pending.length} pending` : ''}`);
  const failures = Array.isArray(json.failures) ? json.failures : [];
  const excused = failures.filter((f) => f.excusedBy).length;
  // The report is committed, so it holds the failures by name and count, with three places each, not thousands of
  // lines: the chunks of one builder (countryside.scrub[36], [39]...) are one name. check.ts's JSON has every one.
  const groups = new Map();
  for (const f of failures) {
    const source = String(f.source ?? '').replace(/\[\d+\]/g, '[*]');
    const key = JSON.stringify([f.stage, f.scene, f.detail, source, f.excusedBy ?? null]);
    const g = groups.get(key) ?? { stage: f.stage, scene: f.scene, detail: f.detail, source, count: 0, excusedBy: f.excusedBy ?? null, what: f.what, where: [] };
    g.count++;
    if (g.where.length < 3) g.where.push(f.where);
    groups.set(key, g);
  }
  const named = [...groups.values()];
  lines.push(`${failures.length} known failures in all, under ${named.length} names (${excused} excused by EXEMPT.json): each is counted in a ratchet below and named in this report's JSON`);

  const decisions = pending.map((e) => `EXEMPT.json excuses "${e.match}" in the ${e.scene} scene's ${e.check} check with no words from Brian yet (pending). ${e.reason} Plan file 18, section 8, question 1, asks him; until he answers, the pieces it excuses are listed in the report and counted.`);

  return {
    ok: problems.length === 0,
    summary: problems.length ? problems.join('; ') : `${json.stages.length} stages passed over ${json.world?.scenes?.length ?? 0} scene builds and ${json.world?.models?.length ?? 0} models; ${failures.length} known failures, each counted (${excused} excused)`,
    lines,
    // No times and no absolute paths: check.ts keeps its times apart, under `timing`, and that is left out here.
    data: {
      stages: json.stages.map((s) => ({ id: s.id, status: s.status, summary: s.summary, failures: s.failures, data: s.data })),
      failures: named,
      exempt: json.exempt ?? null,
      world: json.world ?? null,
    },
    measured: json.measured,
    decisions,
    human: [],
  };
}
