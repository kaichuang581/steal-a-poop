/**
 * The bake stamp (plan file 18, section 4.5): writes tools/bake/baked.json, the manifest of every picture the game
 * ships that is a photograph of one of its own voxel models, and checks it.
 *
 *   npx vite-node tools/bakeStamp.ts --                          stamp every picture
 *   npx vite-node tools/bakeStamp.ts -- --only shop/tick-owl     stamp some (ids as --list prints them, or file paths)
 *   npx vite-node tools/bakeStamp.ts -- --check                  change nothing: say what is stale; exit 1 if anything is
 *   npx vite-node tools/bakeStamp.ts -- --list                   every picture, its tool and where its model is checked
 *   npx vite-node tools/bakeStamp.ts -- --times                  how long each model takes to build, change nothing
 *   --json <file>   the same, for a machine          --args '<json list>'   the arguments the bake tool was run with
 *   --known-stale '<how it is known>'   with --only: these pictures are KNOWN to be older than what makes them today
 *
 * The four bake tools (tools/renderThumbs.mjs, renderStall.mjs, renderYarnBall.mjs, renderGuide.mjs) run this at their
 * end for the pictures they have just baked. That is the only time a stamp means something: a stamp says "this file
 * is what this model, this page and this tool made", and only a bake makes that so. Stamping a picture that was not
 * baked again makes a stale picture read as fresh. The one honest use by hand is after a capture by hand (the two play
 * cards), or to write the first manifest.
 *
 * The first manifest (milestone 0 of the visual overhaul, 2026-11-16) was written by hand that way: it records the
 * models and the files as they were that day, and proves nothing about whether a picture matched its model before.
 *
 * A picture known to be stale is not hidden by its stamp. `--known-stale` writes how it is known into its entry; every
 * check then names the picture and counts it, and the count is a ratchet in docs/visual-overhaul/RATCHETS.json that
 * may only fall, so the flag cannot be used to wave a new stale picture through. The mark stays through any stamp
 * that finds the same file, and goes when a bake has changed the file.
 *
 * What a stamp refuses: a picture that is not the size its tool bakes, or not clear where a bake is clear; a model
 * that cannot be built; a line of the page or the tool that tools/bake/stale.ts copies and that has changed.
 *
 * Exit code: 0 done, or nothing stale; 1 something is stale or could not be stamped; 64 the command line was wrong.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkAllButModels, commandOf, drawnHashOf, fileHashOf, firstLine, listening, loadFrom, MANIFEST, manifestText, mirrorFindings, modelFinding, modelHashOf, planFor,
  readManifest, renderHashOf, shipped, webpHeader, worldModelHash,
} from './bake/stale';
import type { Baked, Finding, Plan, WorldLike } from './bake/stale';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const say = (line = '') => process.stdout.write(`${line}\n`);
const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

class Usage extends Error {}
interface Args { only: string[] | null; check: boolean; list: boolean; times: boolean; json: string | null; args: string[] | null; knownStale: string | null; help: boolean }

function parse(argv: string[]): Args {
  const a: Args = { only: null, check: false, list: false, times: false, json: null, args: null, knownStale: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i], value: string | undefined;
    if (arg === '--') continue;
    if (arg.startsWith('--') && arg.includes('=')) [arg, value] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)];
    const next = (): string => {
      if (value !== undefined) return value;
      if (i + 1 >= argv.length) throw new Usage(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === '--only') a.only = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--check') a.check = true;
    else if (arg === '--list') a.list = true;
    else if (arg === '--times') a.times = true;
    else if (arg === '--json') a.json = next();
    else if (arg === '--args') {
      let list: unknown;
      try { list = JSON.parse(next()); } catch { throw new Usage('--args takes a JSON list of strings, for example --args \'["--width","1024"]\''); }
      if (!Array.isArray(list) || list.some((s) => typeof s !== 'string')) throw new Usage('--args takes a JSON list of strings');
      a.args = list as string[];
    } else if (arg === '--known-stale') a.knownStale = next().trim();
    else if (arg === '--help' || arg === '-h') a.help = true;
    else throw new Usage(`no such option: ${arg} (see --help)`);
  }
  if (a.only && !a.only.length) throw new Usage('--only needs at least one picture');
  if ([a.check, a.list, a.times].filter(Boolean).length > 1) throw new Usage('give one of --check, --list, --times, not two');
  if (a.args && (a.check || a.list || a.times)) throw new Usage('--args goes with a stamp, not with --check, --list or --times');
  if (a.knownStale !== null && (a.check || a.list || a.times || !a.only)) throw new Usage('--known-stale goes with a stamp of named pictures (--only), not with --check, --list or --times');
  if (a.knownStale !== null && a.knownStale.length < 20) throw new Usage('--known-stale needs the words that say how the staleness is known');
  return a;
}

/** What one picture is now: its hashes and its header, or why they could not be worked out. */
interface Now { plan: Plan; modelHash?: string; renderHash?: string; fileHash?: string; head?: { width: number; height: number; alpha: boolean }; want?: [number, number]; ms?: number; voxels?: number; problems: string[] }

/** The scene checker's world, built with only what these plans need: the two scenes of the play cards, at the level a computer builds. */
async function buildWorldFor(plans: Plan[]): Promise<WorldLike & { close(): Promise<void> }> {
  const { buildWorld } = await import('./scenes/build');
  const scenes = [...new Set(plans.flatMap((p) => (p.scene ? [p.scene.name] : [])))];
  say(`  building ${scenes.length ? `the ${scenes.join(' and the ')} scene${scenes.length === 1 ? '' : 's'} and the models` : 'no scene'} in the scene checker's world, for ${count(plans.length, 'picture')} checked in check:scenes`);
  return buildWorld({ scenes, details: ['fine'], models: scenes.length > 0, log: (line) => say(`    ${line}`) });
}

async function main(): Promise<number> {
  let args: Args;
  try { args = parse(process.argv.slice(2)); } catch (e) {
    if (e instanceof Usage) { say(`bakeStamp: ${e.message}`); return 64; }
    throw e;
  }
  if (args.help) {
    const text = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
    say(text.slice(1, text.findIndex((l) => l.trim() === '*/')).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
    return 0;
  }
  const t0 = performance.now();
  const load = loadFrom(ROOT);
  const files = shipped(ROOT);
  const plans = files.map((f) => planFor(f)).filter((p): p is Plan => p !== null);
  const unplanned = files.filter((f) => !planFor(f));

  if (args.list) {
    for (const p of plans) say(`${p.id.padEnd(28)} ${p.file.padEnd(40)} ${(p.tool ? commandOf(p) : 'by hand').padEnd(52)} model checked in ${p.checked}`);
    for (const f of unplanned) say(`${f}: NO PLAN (tools/bake/stale.ts does not know which tool bakes it)`);
    say(`${count(plans.length, 'picture')}: ${plans.filter((p) => p.checked === 'npm test').length} with their model checked in npm test, ${plans.filter((p) => p.checked === 'check:scenes').length} in check:scenes; ${plans.filter((p) => !p.tool).length} captured by hand`);
    return unplanned.length ? 1 : 0;
  }

  // Which pictures this run is about.
  let chosen = plans;
  if (args.only) {
    const unknown = args.only.filter((o) => !plans.some((p) => p.id === o || p.file === o));
    if (unknown.length) { say(`bakeStamp: --only: no such picture: ${unknown.join(', ')} (see --list; a picture is named by its id, shop/tick-owl, or its file)`); return 64; }
    chosen = plans.filter((p) => args.only!.includes(p.id) || args.only!.includes(p.file));
  }

  // What each is now. Models first: the pictures `npm test` checks, and under --times every picture a tool bakes,
  // are built here, listening to the mesher; the others in the scene checker's world, as its stage builds them.
  const now = new Map<string, Now>(chosen.map((p) => [p.file, { plan: p, problems: [] }]));
  const squashed = new Map<string, string>();
  for (const n of now.values()) n.problems.push(...mirrorFindings(ROOT, n.plan, squashed).map((f) => f.text));
  const here = chosen.filter((p) => p.recipe && (args.times || p.checked === 'npm test'));
  // A picture drawn on a 2D canvas: its model is the text of the code that draws it, read here.
  for (const p of chosen) if (p.drawn) { const n = now.get(p.file)!; try { n.modelHash = drawnHashOf(ROOT, p); } catch (e) { n.problems.push(`${p.file}: ${firstLine(e)}`); } }
  const there = args.times ? [] : chosen.filter((p) => p.checked === 'check:scenes');
  if (here.length) {
    // The game's files are read in before anything is timed: what is timed is the model's build alone. One that is
    // gone is not this line's to report: the recipe that needs it says so, by its picture's name.
    for (const path of ['src/skin/shop/catalog.ts', 'src/skin/voxel/bombSkins.ts', 'src/skin/shop/bombAura.ts', 'src/skin/shop/thumbModels.ts', 'src/skin/voxel/mesher.ts', 'src/skin/shop/stallModels.ts', 'src/skin/shop/stallPlan.ts', 'src/skin/voxel/characters.ts']) await load(path).catch(() => undefined);
    try {
      await listening(ROOT, async (setsOf) => {
        for (const plan of here) {
          const n = now.get(plan.file)!;
          try {
            const s0 = performance.now();
            const sets = setsOf(await plan.recipe!(load), plan.file);
            n.ms = performance.now() - s0;
            n.voxels = sets.reduce((sum, s) => sum + s.count, 0);
            n.modelHash = modelHashOf(sets);
          } catch (e) { n.problems.push(`${plan.file}: its model could not be built (${firstLine(e)})`); }
        }
      });
    } catch (e) {
      // The mesher could not be listened to at all: no model was built, and each picture says so.
      for (const plan of here) if (!now.get(plan.file)!.modelHash) now.get(plan.file)!.problems.push(`${plan.file}: its model could not be built (${firstLine(e)})`);
    }
  }
  if (there.length) {
    let world: (WorldLike & { close(): Promise<void> }) | null = null;
    try {
      world = await buildWorldFor(there);
      for (const plan of there) {
        const n = now.get(plan.file)!;
        try { n.modelHash = await worldModelHash(world, plan); } catch (e) { n.problems.push(`${plan.file}: its model could not be built (${firstLine(e)})`); }
      }
    } catch (e) {
      for (const plan of there) now.get(plan.file)!.problems.push(`${plan.file}: the scene checker's world could not be built (${firstLine(e)})`);
    } finally { await world?.close(); }
  }
  for (const n of now.values()) {
    const { plan } = n;
    try { n.renderHash = renderHashOf(ROOT, plan); } catch (e) { n.problems.push(`${plan.file}: ${firstLine(e)}`); }
    const bytes = readFileSync(join(ROOT, plan.file));
    n.fileHash = fileHashOf(bytes);
    n.head = webpHeader(bytes) ?? undefined;
    if (!n.head) n.problems.push(`${plan.file} is not a WebP picture (its header cannot be read)`);
  }

  const before = readManifest(ROOT);
  const entryOf = new Map(before.entries.map((e) => [e.file, e]));
  const write = (report: unknown) => {
    if (!args.json) return;
    const file = isAbsolute(args.json) ? args.json : resolve(process.cwd(), args.json);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    say(`wrote ${args.json}`);
  };
  const seconds = () => (performance.now() - t0) / 1000;

  if (args.times) {
    // The plan's rule for `npm test`: a model that builds in under 50 ms. Measured here, one build each, modules read in first.
    const rows = here.map((p) => {
      const n = now.get(p.file)!, stamped = entryOf.get(p.file)?.modelHash;
      return { id: p.id, checked: p.checked, ms: n.ms ?? null, voxels: n.voxels ?? null, under50: n.ms !== undefined && n.ms < 50, sameAsStamped: stamped === undefined || n.modelHash === undefined ? null : stamped === n.modelHash, problems: n.problems };
    });
    for (const r of rows) say(`${r.id.padEnd(28)} ${r.ms === null ? 'NOT BUILT' : `${r.ms.toFixed(1).padStart(7)} ms`} ${String(r.voxels ?? '').padStart(7)} voxels   ${r.under50 ? 'under 50 ms' : 'NOT under 50 ms'}   model checked in ${r.checked}${r.sameAsStamped === null ? '' : r.sameAsStamped ? '   same hash as stamped' : '   NOT the hash that is stamped'}${r.problems.length ? `   ${r.problems.join('; ')}` : ''}`);
    const total = rows.reduce((sum, r) => sum + (r.ms ?? 0), 0), inTest = rows.filter((r) => r.checked === 'npm test');
    say(`${count(rows.length, 'model')} built in ${total.toFixed(0)} ms; the ${inTest.length} checked in npm test in ${inTest.reduce((sum, r) => sum + (r.ms ?? 0), 0).toFixed(0)} ms, the slowest ${Math.max(0, ...inTest.map((r) => r.ms ?? 0)).toFixed(1)} ms`);
    write({ tool: 'bakeStamp', mode: 'times', rows, totalMs: total });
    return rows.some((r) => r.ms === null) ? 1 : 0;
  }

  if (args.check) {
    const fast = await checkAllButModels(ROOT, load);
    const wanted = new Set(chosen.map((p) => p.file));
    const findings: Finding[] = fast.findings.filter((f) => f.file === MANIFEST || wanted.has(f.file) || !args.only);
    for (const { entry, plan } of fast.listed) {
      if (!wanted.has(entry.file)) continue;
      const n = now.get(entry.file)!;
      if (n.modelHash) findings.push(...modelFinding(entry, n.modelHash));
      else findings.push({ file: entry.file, kind: 'broken', text: n.problems.find((p) => p.includes('could not be built')) ?? `${plan.file}: its model was not built` });
    }
    const seen = new Set<string>(), unique = findings.filter((f) => !seen.has(f.text) && seen.add(f.text));
    const by = (kind: Finding['kind']) => unique.filter((f) => f.kind === kind).length;
    // A picture known to be stale is named and counted, and fails nothing here: its count is a ratchet's to hold.
    const failing = unique.filter((f) => f.kind !== 'known');
    const images = chosen.map((p) => ({ id: p.id, file: p.file, tool: p.tool, checked: p.checked, listed: entryOf.has(p.file), findings: unique.filter((f) => f.file === p.file).map((f) => ({ kind: f.kind, text: f.text })) }));
    for (const f of unique) say(f.text);
    const fresh = images.filter((i) => i.listed && !i.findings.length).length;
    say(`${failing.length ? 'bakeStamp --check: FAIL' : 'bakeStamp --check: PASS'}   ${count(chosen.length, 'picture')}${args.only ? ' (a part: --only)' : ''}: ${fresh} fresh, ${by('known')} KNOWN to be stale (counted, not failed), ${by('stale')} stale, ${by('changed')} changed without a stamp, ${by('size')} of the wrong size or clearness, ${by('list')} not listed as planned, ${by('broken')} that could not be checked   ${seconds().toFixed(0)} s`);
    write({
      tool: 'bakeStamp', mode: 'check', ok: failing.length === 0, partial: !!args.only,
      counts: { pictures: chosen.length, fresh, knownStale: by('known'), stale: by('stale'), changed: by('changed'), size: by('size'), list: by('list'), broken: by('broken'), noTool: chosen.filter((p) => !p.tool).length, inNpmTest: chosen.filter((p) => p.checked === 'npm test').length, inCheckScenes: chosen.filter((p) => p.checked === 'check:scenes').length },
      images, findings: unique.map((f) => ({ file: f.file, kind: f.kind, text: f.text })), manifestProblems: fast.problems,
    });
    return failing.length ? 1 : 0;
  }

  // The stamp. Every picture chosen is stamped or refused; nothing else in the manifest is touched.
  if (before.problems.length && existsSync(join(ROOT, MANIFEST)) && args.only) {
    say(`bakeStamp: ${MANIFEST} is not in shape, so a part of it cannot be stamped:`);
    for (const p of before.problems) say(`  ${p}`);
    say('  Stamp everything again (no --only) once the pictures are baked.');
    return 1;
  }
  const entries = new Map<string, Baked>(args.only ? before.entries.map((e) => [e.file, e]) : []);
  const refused: string[] = [], lines: string[] = [];
  for (const n of now.values()) {
    const { plan } = n, old = entryOf.get(plan.file);
    // The arguments: the ones that pick this picture, then the ones the tool was run with (or was, the last time).
    const extra = args.args ?? (old && old.tool === plan.tool ? old.args.slice(plan.args.length) : []);
    const entryArgs = [...plan.args, ...extra];
    if (!n.problems.length && n.head) {
      try { n.want = await plan.size(load, entryArgs); } catch (e) { n.problems.push(`${plan.file}: the size its tool bakes could not be worked out (${firstLine(e)})`); }
      if (n.want && (n.head.width !== n.want[0] || n.head.height !== n.want[1])) n.problems.push(`${plan.file} is ${n.head.width} x ${n.head.height}, and ${plan.tool ?? 'its capture'} makes it ${n.want[0]} x ${n.want[1]}`);
      if (n.head.alpha !== plan.alpha) n.problems.push(plan.alpha ? `${plan.file} has no clear pixel: a baked picture stands on a clear background, with no backdrop behind it` : `${plan.file} has an alpha channel, and this picture fills its frame`);
    }
    if (n.problems.length || !n.modelHash || !n.renderHash || !n.fileHash || !n.head) {
      refused.push(...(n.problems.length ? n.problems : [`${plan.file}: its model was not built`]));
      if (old && !args.only) entries.set(plan.file, old); // a refusal leaves the old entry as it was, so the check still says what is wrong
      continue;
    }
    // Known to be stale: said now (--known-stale), or said before of this very file. A bake that changed the file ends it.
    const known = args.knownStale ?? (old?.knownStale && old.fileHash === n.fileHash ? old.knownStale : undefined);
    const entry: Baked = {
      id: plan.id, file: plan.file, tool: plan.tool, args: entryArgs, page: plan.page, model: plan.model, checked: plan.checked, ...(plan.capture ? { capture: plan.capture } : {}),
      ...(known ? { knownStale: known } : {}),
      width: n.head.width, height: n.head.height, alpha: n.head.alpha, modelHash: n.modelHash, renderHash: n.renderHash, fileHash: n.fileHash,
    };
    const moved = !old ? ['new'] : [old.modelHash !== entry.modelHash ? 'model' : '', old.renderHash !== entry.renderHash ? 'render' : '', old.fileHash !== entry.fileHash ? 'file' : ''].filter(Boolean);
    // A model or a render that moved under a file that did not: the stamp was run, and the picture is the old one.
    const unbaked = !!old && moved.length > 0 && !moved.includes('file');
    lines.push(`${plan.id.padEnd(28)} ${moved.length ? moved.join(', ') : 'the same'}${unbaked && !known ? '   NOT BAKED AGAIN: the picture is the old file, and it now reads as fresh' : ''}${known ? '   KNOWN TO BE STALE: marked, named by every check and counted' : old?.knownStale ? '   baked again: no longer marked as known to be stale' : ''}`);
    entries.set(plan.file, entry);
  }
  const gone = args.only ? [] : before.entries.filter((e) => !files.includes(e.file));
  for (const line of lines) say(line);
  for (const e of gone) say(`${e.id.padEnd(28)} taken out: ${e.file} is not there`);
  for (const f of unplanned) refused.push(`${f} is shipped from a folder of baked pictures, and tools/bake/stale.ts has no plan for it`);
  const text = manifestText([...entries.values()]);
  const same = existsSync(join(ROOT, MANIFEST)) && readFileSync(join(ROOT, MANIFEST), 'utf8') === text;
  if (!same) { mkdirSync(dirname(join(ROOT, MANIFEST)), { recursive: true }); writeFileSync(join(ROOT, MANIFEST), text); }
  for (const r of refused) say(`REFUSED: ${r}`);
  say(`bakeStamp: ${count(lines.length, 'picture')} stamped${refused.length ? `, ${refused.length} REFUSED` : ''}; ${MANIFEST} ${same ? 'is as it was' : `written, ${count(entries.size, 'entry', 'entries')}`}   ${seconds().toFixed(0)} s`);
  write({ tool: 'bakeStamp', mode: 'stamp', ok: refused.length === 0, stamped: lines.length, refused, entries: entries.size, written: !same });
  return refused.length ? 1 : 0;
}

// vite-node closes its own server when this file's last line has run, so the whole run is awaited here.
const code = await main();
process.exitCode = code;
await new Promise<void>((done) => { process.stdout.write('', () => done()); });
process.exit(code);
