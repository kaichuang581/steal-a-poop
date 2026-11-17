/**
 * The scene checker (plan file 18, section 4.2; file 16, section 4.1 i): builds every scene and model of the painted
 * game, fine and coarse, and runs the stages over them, in this order:
 *
 *   connect  place  lights  coplanar  lens  models  wendigo  baked
 *
 *   npm run check:scenes                        every stage
 *   npm run check:floating                      the connect stage alone (`--only connect`): what floats, and where
 *   npm run check:scenes -- --only connect,place    some stages
 *   npm run check:scenes -- --scene pen         some scenes (also: a scene's name with no flag, as the old tool took it)
 *   npm run check:scenes -- --details coarse    one detail level
 *   npm run check:scenes -- --json <file>       everything, for a machine
 *   npm run check:floating -- --detail=pine     the old tool's: every loose piece from code that matches, with its box
 *
 * A stage is tools/scenes/<id>.ts (README.md beside this file is the interface). A stage whose file does not exist is
 * NOT BUILT and fails the run: nothing that was not checked ever reads as green. Every number a stage hands in is
 * compared with the `scenes` section of docs/visual-overhaul/RATCHETS.json by the gate's own comparison
 * (tools/gate/lib/ratchets.mjs), so this command alone passes or fails the way `npm run gate` would. Only the gate
 * stores numbers (`--seed`); with nothing stored this prints them and says so.
 *
 * Exit code: 0 every stage that ran passed and every ratchet held; 1 anything else; 64 the command line was wrong.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore: the gate's comparison is a plain .mjs with no types of its own; the shapes used here are written out below
import { compare, readStore, rowLine } from '../gate/lib/ratchets.mjs';
import { buildWorld, DETAILS, SCENE_NAMES, STAGE_IDS } from './build';
import type { Detail, Exemption, Failure, SceneName, Stage, StageResult, World } from './build';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const EXEMPT = join(ROOT, 'docs', 'visual-overhaul', 'EXEMPT.json');
const RATCHETS = join(ROOT, 'docs', 'visual-overhaul', 'RATCHETS.json');
const say = (line = '') => process.stdout.write(`${line}\n`);

class Usage extends Error {}

interface Args { only: string[] | null; scenes: SceneName[] | null; details: Detail[] | null; json: string | null; flags: Record<string, string | true> }

function parse(argv: string[]): Args {
  const a: Args = { only: null, scenes: null, details: null, json: null, flags: {} };
  const scenes: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i], value: string | undefined;
    if (arg === '--') continue;
    if (!arg.startsWith('--')) { scenes.push(arg); continue; } // the old tool took a scene's name bare
    if (arg.includes('=')) [arg, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)];
    const next = (): string => {
      if (value !== undefined) return value;
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Usage(`${arg} needs a value`);
      return argv[++i];
    };
    const list = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);
    if (arg === '--only') a.only = list(next());
    else if (arg === '--scene' || arg === '--scenes') scenes.push(...list(next()));
    else if (arg === '--details') a.details = list(next()) as Detail[];
    else if (arg === '--json') a.json = next();
    else if (arg === '--help' || arg === '-h') a.flags.help = true;
    // Anything else is for the stages: --detail=pine (the old tool's), --all, --props and --strict (which it also took).
    else a.flags[arg.slice(2)] = value ?? true;
  }
  if (a.only) {
    const bad = a.only.filter((s) => !(STAGE_IDS as readonly string[]).includes(s));
    if (bad.length || !a.only.length) throw new Usage(`--only: no such stage: ${bad.join(', ') || '(none given)'} (there are: ${STAGE_IDS.join(', ')})`);
  }
  if (scenes.length) {
    const bad = scenes.filter((s) => !(SCENE_NAMES as readonly string[]).includes(s));
    if (bad.length) throw new Usage(`no such scene: ${bad.join(', ')} (there are: ${SCENE_NAMES.join(', ')})`);
    a.scenes = SCENE_NAMES.filter((s) => scenes.includes(s));
  }
  if (a.details) {
    const bad = a.details.filter((d) => !DETAILS.includes(d));
    if (bad.length || !a.details.length) throw new Usage(`--details takes fine, coarse or both, not "${bad.join(', ')}" (for the old tool's --detail=<text>, write it with the equals sign)`);
    a.details = DETAILS.filter((d) => a.details!.includes(d));
  }
  return a;
}

/**
 * Reads docs/visual-overhaul/EXEMPT.json and holds it to its shape (plan file 18, section 4.6): a list of entries,
 * each { check, scene, match, reason, brian: { date, words } } and nothing more, but `status: "pending"` on an entry
 * Brian has not answered yet (its date and words are null). An entry with no words that is not marked pending, or
 * marked pending with words, is refused: nothing is excused by accident.
 */
function readExempt(): { entries: Exemption[]; problems: string[] } {
  const problems: string[] = [];
  if (!existsSync(EXEMPT)) return { entries: [], problems: ['docs/visual-overhaul/EXEMPT.json does not exist'] };
  let json: unknown;
  try { json = JSON.parse(readFileSync(EXEMPT, 'utf8')); } catch (e) { return { entries: [], problems: [`docs/visual-overhaul/EXEMPT.json is not JSON: ${String((e as Error).message)}`] }; }
  const list = (json as { exemptions?: unknown })?.exemptions;
  if (!Array.isArray(list)) return { entries: [], problems: ['docs/visual-overhaul/EXEMPT.json has no "exemptions" list'] };
  const entries: Exemption[] = [];
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  list.forEach((e: Record<string, unknown>, i) => {
    const where = `EXEMPT.json entry ${i + 1}`;
    if (!e || typeof e !== 'object') { problems.push(`${where} is not an object`); return; }
    const extra = Object.keys(e).filter((k) => !['check', 'scene', 'match', 'reason', 'status', 'brian'].includes(k));
    if (extra.length) problems.push(`${where} has fields that are not part of an entry: ${extra.join(', ')}`);
    for (const key of ['check', 'scene', 'match', 'reason']) if (!text(e[key])) problems.push(`${where} has no ${key}`);
    if (text(e.check) && !(STAGE_IDS as readonly string[]).includes(e.check as string)) problems.push(`${where} names the check "${e.check}", which is not a stage`);
    if (text(e.scene) && !(SCENE_NAMES as readonly string[]).includes(e.scene as string)) problems.push(`${where} names the scene "${e.scene}", which is not one scene (${SCENE_NAMES.join(', ')})`);
    const b = e.brian as { date?: unknown; words?: unknown } | undefined;
    if (!b || typeof b !== 'object' || !('date' in b) || !('words' in b)) { problems.push(`${where} has no brian: { date, words }`); return; }
    if (e.status === 'pending') {
      if (b.date !== null || b.words !== null) problems.push(`${where} is marked pending and has a date or words: take the mark off, or the words out`);
    } else if (e.status !== undefined) problems.push(`${where} has status "${String(e.status)}": the only status is "pending"`);
    else if (!text(b.words) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) problems.push(`${where} is not pending and has no dated words from Brian (date as YYYY-MM-DD)`);
    entries.push(e as unknown as Exemption);
  });
  return { entries, problems };
}

/** What a stage that is not there, or could not run, is recorded as. */
const blank = (summary: string): StageResult => ({ ok: false, summary, lines: [], measured: {}, failures: [], data: null });

async function main(): Promise<number> {
  let args: Args;
  try { args = parse(process.argv.slice(2)); } catch (e) {
    if (e instanceof Usage) { say(`check:scenes: ${e.message}`); return 64; }
    throw e;
  }
  if (args.flags.help) {
    const text = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
    say(text.slice(1, text.findIndex((l) => l.trim() === '*/')).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
    return 0;
  }
  const t0 = performance.now();
  const ids = STAGE_IDS.filter((s) => !args.only || args.only.includes(s));
  const partial = !!args.only || !!args.scenes || !!args.details;
  const scenes = args.scenes ?? [...SCENE_NAMES], details = args.details ?? [...DETAILS];
  const cache = join(process.env.GATE_CACHE || join(homedir(), '.cache', 'fleeced-gate'), 'scenes');
  mkdirSync(cache, { recursive: true });

  say(`check:scenes: ${ids.join(', ')}${partial ? `   PART RUN (${[args.only ? `--only ${args.only.join(',')}` : '', args.scenes ? `--scene ${args.scenes.join(',')}` : '', args.details ? `--details ${args.details.join(',')}` : ''].filter(Boolean).join(' ')})` : ''}`);

  // The stages that are there.
  const stages = new Map<string, Stage>(), missing: string[] = [], broken = new Map<string, string>();
  for (const id of ids) {
    const file = join(HERE, `${id}.ts`);
    if (!existsSync(file)) { missing.push(id); continue; }
    try {
      const mod = (await import(/* @vite-ignore */ file)) as Partial<Stage>;
      if (mod.id !== id || typeof mod.run !== 'function') broken.set(id, `tools/scenes/${id}.ts does not follow the interface (it must export id = '${id}' and run)`);
      else stages.set(id, mod as Stage);
    } catch (e) {
      broken.set(id, `tools/scenes/${id}.ts could not be loaded: ${String((e as Error)?.message ?? e).split('\n')[0]}`);
    }
  }

  const exempt = readExempt();
  let store: Record<string, unknown> = {};
  let storeProblem = '';
  try { store = (readStore(RATCHETS).scenes ?? {}) as Record<string, unknown>; } catch (e) { storeProblem = String((e as Error).message); }
  const hasStore = Object.keys(store).length > 0;

  // The world, built once: only what the stages of this run read.
  const wantScenes = new Set<SceneName>(), needsOf = [...stages.values()].map((s) => s.needs ?? {});
  for (const n of needsOf) for (const s of n.scenes === 'none' ? [] : !n.scenes || n.scenes === 'all' ? SCENE_NAMES : n.scenes) if (scenes.includes(s)) wantScenes.add(s);
  const wantModels = needsOf.some((n) => n.models !== false);
  let world: World | null = null, worldProblem = '';
  if (stages.size) {
    try {
      world = await buildWorld({ scenes: [...wantScenes], details, models: wantModels, log: (line) => say(`  ${line}`) });
    } catch (e) {
      worldProblem = String((e as Error)?.stack ?? e);
      say(`\nThe scenes could not be built:\n${worldProblem}`);
    }
  }
  const builtSeconds = (performance.now() - t0) / 1000;

  // The stages, in order. One that throws is a failed stage, not the end of the run.
  const results: { id: string; status: 'pass' | 'fail' | 'not built' | 'not run'; result: StageResult; seconds: number }[] = [];
  for (const id of ids) {
    const stage = stages.get(id);
    if (!stage) {
      results.push(missing.includes(id)
        ? { id, status: 'not built', result: blank(`tools/scenes/${id}.ts does not exist yet: nothing was checked`), seconds: 0 }
        : { id, status: 'fail', result: blank(broken.get(id)!), seconds: 0 });
      continue;
    }
    if (!world) { results.push({ id, status: 'not run', result: blank('NOT RUN: the scenes could not be built'), seconds: 0 }); continue; }
    say(`\n== ${id} ${'='.repeat(Math.max(3, 100 - id.length))}`);
    const s0 = performance.now();
    let result: StageResult;
    try {
      const stageCache = join(cache, id);
      mkdirSync(stageCache, { recursive: true });
      result = await stage.run(world, {
        root: ROOT, scenes, details, exempt: exempt.entries.filter((e) => e.check === id), stored: store[id], flags: args.flags, cache: stageCache,
        log: (line) => say(`  [${id}] ${line}`),
      });
      if (!result || typeof result.ok !== 'boolean' || !Array.isArray(result.lines) || !Array.isArray(result.failures) || typeof result.measured !== 'object' || result.measured === null) {
        result = blank('returned no verdict (run must hand back { ok, summary, lines, measured, failures, data })');
      }
    } catch (e) {
      result = blank(`threw: ${String((e as Error)?.message ?? e).split('\n')[0]}`);
      result.lines = String((e as Error)?.stack ?? e).split('\n').slice(0, 6);
    }
    const status = result.ok ? 'pass' : /^NOT RUN\b/.test(result.summary) ? 'not run' : 'fail';
    for (const line of result.lines) say(line);
    results.push({ id, status, result, seconds: (performance.now() - s0) / 1000 });
  }
  await world?.close();

  // What is handed in: each stage's numbers under its id, and how many entries EXEMPT.json holds.
  const measured: Record<string, unknown> = { exemptions: exempt.entries.length };
  for (const r of results) if (r.status === 'pass' || (r.status === 'fail' && Object.keys(r.result.measured).length)) measured[r.id] = r.result.measured;

  // The ratchets, by the gate's own comparison. A part run measures a part: what it left out is not held against it.
  const storedFor = (): Record<string, unknown> => {
    if (!partial) return store;
    const part: Record<string, unknown> = {};
    for (const key of Object.keys(measured)) if (key in store) part[key] = store[key];
    return part;
  };
  const judged = compare({ stored: hasStore ? storedFor() : undefined, measured });
  const rows = (judged.rows as { leaf: string; verdict: string; ok: boolean; old: number | null; new: number | null; kind: string; note: string }[])
    .filter((r) => !(partial && (args.scenes || args.details) && r.verdict === 'NOT MEASURED'));
  const unstored = rows.filter((r) => r.verdict === 'NO STORED VALUE');
  const ratchetsOk = rows.every((r) => r.ok);
  const checksOk = results.every((r) => r.status === 'pass') && !exempt.problems.length && !storeProblem && !worldProblem;

  say(`\n== the verdict ${'='.repeat(88)}`);
  // A stage passes when it ran clean AND every number it handed in held: known failures are allowed only as stored.
  const held = (id: string): 'held' | 'did not hold' | 'not stored' => {
    const own = rows.filter((r) => r.leaf === id || r.leaf.startsWith(`${id}.`) || r.leaf.startsWith(`${id}[`));
    return own.some((r) => !r.ok && r.verdict !== 'NO STORED VALUE') ? 'did not hold' : own.some((r) => !r.ok) ? 'not stored' : 'held';
  };
  for (const r of results) {
    const word = r.status !== 'pass' ? ({ fail: 'FAIL', 'not built': 'NOT BUILT', 'not run': 'NOT RUN' })[r.status] : ({ held: 'PASS', 'did not hold': 'FAIL', 'not stored': 'NOT STORED' })[held(r.id)];
    say(`  ${r.id.padEnd(9)} ${word.padEnd(10)} ${r.result.summary}${r.status === 'pass' && held(r.id) === 'held' && r.result.failures.length ? ' (all of them known: no stored number rose)' : ''}${r.seconds ? `   (${r.seconds.toFixed(1)} s)` : ''}`);
  }
  for (const p of exempt.problems) say(`  EXEMPT.json: ${p}`);
  if (storeProblem) say(`  RATCHETS.json could not be read: ${storeProblem}`);
  const pending = exempt.entries.filter((e) => e.status === 'pending');
  say(`  exemptions: ${exempt.entries.length} in docs/visual-overhaul/EXEMPT.json${pending.length ? `, ${pending.length} of them PENDING (no words from Brian yet): ${pending.map((e) => `${e.check} / ${e.scene} / "${e.match}"`).join('; ')}` : ''}`);
  say('');
  if (!hasStore) {
    say('  The numbers below are NOT STORED: docs/visual-overhaul/RATCHETS.json has no "scenes" section yet. The gate stores');
    say('  them once (npm run gate -- --milestone none --only scenes --seed); until then they are held to nothing.');
  }
  const shown = rows.filter((r) => !r.ok || r.verdict !== 'same');
  for (const r of shown) say(`    ${rowLine(r)}`);
  if (hasStore) say(`  ratchets: ${rows.length} numbers compared with docs/visual-overhaul/RATCHETS.json: ${rows.filter((r) => r.verdict === 'same').length} the same, ${rows.filter((r) => r.ok && r.verdict !== 'same').length} can be lowered, ${rows.filter((r) => !r.ok).length} DID NOT HOLD`);

  const ok = checksOk && ratchetsOk;
  const seconds = (performance.now() - t0) / 1000;
  say('');
  say(ok ? `check:scenes: PASS${partial ? ' (a part run: what ran passed)' : ''}   ${seconds.toFixed(0)} s`
    : `check:scenes: FAIL   ${[
      ...results.filter((r) => r.status !== 'pass').map((r) => `${r.id} ${({ fail: 'failed', 'not built': 'is not built', 'not run': 'did not run', pass: '' })[r.status]}`),
      ...(exempt.problems.length ? ['EXEMPT.json is not in shape'] : []),
      ...(storeProblem ? ['RATCHETS.json could not be read'] : []),
      ...(unstored.length ? [`${unstored.length} numbers are not stored`] : []),
      ...(rows.some((r) => !r.ok && r.verdict !== 'NO STORED VALUE') ? [`a ratchet did not hold: ${rows.filter((r) => !r.ok && r.verdict !== 'NO STORED VALUE').slice(0, 6).map((r) => `${r.leaf} ${r.verdict}`).join(', ')}`] : []),
    ].join('; ')}   ${seconds.toFixed(0)} s`);

  if (args.json) {
    const file = isAbsolute(args.json) ? args.json : resolve(process.cwd(), args.json);
    mkdirSync(dirname(file), { recursive: true });
    const failures: (Failure & { stage: string })[] = results.flatMap((r) => r.result.failures.map((f) => ({ stage: r.id, ...f })));
    writeFileSync(file, `${JSON.stringify({
      tool: 'check:scenes',
      ok, checksOk, ratchetsOk, partial,
      only: args.only, scenes, details,
      stages: results.map((r) => ({ id: r.id, status: r.status, ok: r.result.ok, ratchets: held(r.id), summary: r.result.summary, lines: r.result.lines, measured: r.result.measured, failures: r.result.failures.length, data: r.result.data })),
      failures,
      measured,
      ratchets: { stored: hasStore, rows },
      exempt: { count: exempt.entries.length, pending: pending.length, entries: exempt.entries, problems: exempt.problems },
      world: world ? {
        scenes: world.scenes.map((s) => ({ name: s.name, detail: s.detail, voxels: s.voxels, parts: s.parts.length, world: s.world.length, things: s.things.map((t) => t.name), hash: s.hash, notes: s.notes })),
        models: world.models.map((m) => ({ id: m.id, kind: m.kind, parts: m.parts.length, voxels: m.parts.reduce((n, p) => n + p.count, 0), hash: m.hash, notes: m.notes })),
      } : null,
      problem: worldProblem ? worldProblem.split('\n').slice(0, 8) : null,
      // Times are kept apart from everything else: the gate's report holds none.
      timing: { seconds, build: builtSeconds, world: world?.seconds ?? {}, stages: Object.fromEntries(results.map((r) => [r.id, r.seconds])) },
    }, null, 2)}\n`);
    say(`wrote ${args.json}`);
  }
  return ok ? 0 : 1;
}

// vite-node closes its own server when this file's last line has run, so the whole run is awaited here. The exit
// waits for what was printed to be written out: into a pipe, an exit straight after a long report can cut it short.
const code = await main();
process.exitCode = code;
await new Promise<void>((done) => { process.stdout.write('', () => done()); });
process.exit(code);
