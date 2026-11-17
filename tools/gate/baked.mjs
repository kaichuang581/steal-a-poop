// Gate module: the bake manifest (plan file 18, section 4.5; file 16, section 4.1 h). The state of every picture the
// game ships that is a photograph of one of its own voxel models: the Trading Post's thumbnails, the market stall,
// the loading doors, the tutorial's sheepdog and the two play cards. tools/bake/baked.json lists them, each with the
// hash of its model, of the page and tool that made it, and of its own bytes.
//
// This module works no hash out itself. It runs the stamp's own check,
//
//   npx vite-node tools/bakeStamp.ts -- --check --json <cache>/baked/gate-check.json
//
// which builds every model again (the thumbnails' and the sheepdog's as `npm test` builds them, the doors', the
// stall's and the play cards' as `npm run check:scenes` does) and says what is stale, what changed without a stamp,
// what is the wrong size, and what is shipped and not listed. Any of those fails this module, by name, with the
// command that bakes the picture again.
//
// Then one thing only the gate can see, because it knows the base: a stamp without a bake. The stamp is the one way
// to make a stale picture read as fresh, so every entry whose model or render hash moved since the base while its
// file did not is named under "Decisions for Brian". It cannot be failed outright: a model can change where its
// picture does not show it, and a bake can draw the same bytes again.
//
// A picture whose entry says it was KNOWN to be stale when it was stamped (`knownStale`: today the three pictures of
// the loading doors, baked the day before the rounded voxel corners came in) is a known failure: named in the lines
// below and under "Decisions for Brian", counted, and failed by nobody until the count rises.
//
// The two ratchets, which may only fall: how many pictures are known to be stale, and how many no tool bakes (the two
// play cards, captured by hand).
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'baked';
export const modes = ['milestone', 'baseline'];

const MANIFEST = 'tools/bake/baked.json';
/** The check builds two scenes and every model: a quarter of a minute alone on this machine; the limit is for a loaded one. */
const TIMEOUT_MS = 30 * 60_000;
const KEEP_LINES = 80;
const quote = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The manifest's entries by file, from its text; null when the text is not a manifest. */
function entriesOf(text) {
  try {
    const list = JSON.parse(text)?.images;
    return Array.isArray(list) ? new Map(list.filter((e) => e && typeof e.file === 'string').map((e) => [e.file, e])) : null;
  } catch {
    return null;
  }
}

export async function run(ctx) {
  const dir = join(ctx.cache, 'baked');
  const file = join(dir, 'gate-check.json');
  mkdirSync(dir, { recursive: true });
  rmSync(file, { force: true }); // an older run's answer must never stand in for this one's

  const r = await ctx.sh(`npx vite-node tools/bakeStamp.ts -- --check --json ${quote(file)}`, { timeoutMs: TIMEOUT_MS });
  const tail = () => `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-14);
  if (!existsSync(file)) {
    return { ok: false, summary: `NOT RUN: tools/bakeStamp.ts --check wrote no result (exit ${r.code}${r.timedOut ? ', stopped after 30 minutes' : ''})`, lines: tail(), data: {} };
  }
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    return { ok: false, summary: `NOT RUN: what tools/bakeStamp.ts --check wrote is not JSON (${String(e?.message ?? e).split('\n')[0]})`, lines: tail(), data: {} };
  }
  if (json?.tool !== 'bakeStamp' || json.mode !== 'check' || typeof json.ok !== 'boolean' || !json.counts || !Number.isInteger(json.counts.knownStale) || !Number.isInteger(json.counts.noTool) || !Array.isArray(json.images) || !Array.isArray(json.findings)) {
    return { ok: false, summary: 'NOT RUN: what tools/bakeStamp.ts --check wrote is not its report', lines: tail(), data: {} };
  }
  if (json.partial) return { ok: false, summary: 'NOT RUN: tools/bakeStamp.ts --check ran a part only', lines: [], data: {} };

  const c = json.counts;
  const problems = [];
  if (c.stale) problems.push(`${c.stale} stale`);
  if (c.changed) problems.push(`${c.changed} changed without a stamp`);
  if (c.size) problems.push(`${c.size} of the wrong size or clearness`);
  if (c.list) problems.push(`${c.list} not listed as planned`);
  if (c.broken) problems.push(`${c.broken} that could not be checked`);
  // The two answers of one check must agree: its exit code and its report.
  if (r.code === 0 && !json.ok) problems.push('tools/bakeStamp.ts --check ended with exit 0 though its report names a finding');
  if (r.code !== 0 && json.ok) problems.push(`tools/bakeStamp.ts --check ended with exit ${r.code} though its report names no finding`);
  const failing = json.findings.filter((f) => f.kind !== 'known');
  const known = json.findings.filter((f) => f.kind === 'known');
  if (json.ok !== (failing.length === 0) || known.length !== c.knownStale) problems.push('the report of tools/bakeStamp.ts --check does not agree with itself');

  // The manifest at the base, to see what was stamped since. Reading only: `git show` changes nothing.
  const decisions = [];
  // The pictures known to be stale, by how it is known: one decision for the three doors baked on one day.
  const byWhy = new Map();
  for (const f of known) {
    const why = String(f.text).split('How it is known: ')[1] ?? '';
    byWhy.set(why, [...(byWhy.get(why) ?? []), f.file]);
  }
  for (const [why, files] of byWhy) {
    decisions.push(`${plural(files.length, 'baked picture is', 'baked pictures are')} known to be stale, and counted (baked.knownStale, which may only fall): ${files.join(', ')}. ${why} Baking ${files.length === 1 ? 'it' : 'them'} again changes a picture players see, so when to do it is Brian's to say.`);
  }
  const lines = [];
  const since = { atBase: false, added: [], removed: [], bakedAgain: [], stampedNotBaked: [] };
  const headText = existsSync(join(ctx.root, MANIFEST)) ? readFileSync(join(ctx.root, MANIFEST), 'utf8') : null;
  const head = headText === null ? null : entriesOf(headText);
  const shown = await ctx.sh(`git show ${quote(`${ctx.base}:${MANIFEST}`)}`);
  const base = shown.code === 0 ? entriesOf(shown.stdout) : null;
  if (head && shown.code === 0 && !base) problems.push(`${MANIFEST} at the base commit is not a manifest, so what was stamped since cannot be told`);
  if (head && base) {
    since.atBase = true;
    for (const [name, now] of head) {
      const was = base.get(name);
      if (!was) { since.added.push(name); continue; }
      const moved = [was.modelHash !== now.modelHash ? 'model' : '', was.renderHash !== now.renderHash ? 'render' : ''].filter(Boolean);
      if (was.fileHash !== now.fileHash) since.bakedAgain.push(name);
      else if (moved.length) since.stampedNotBaked.push({ file: name, moved });
    }
    for (const name of base.keys()) if (!head.has(name)) since.removed.push(name);
    if (since.stampedNotBaked.length) {
      decisions.push(`${plural(since.stampedNotBaked.length, 'baked picture was', 'baked pictures were')} stamped again since the base and the file did not change: ${since.stampedNotBaked.map((s) => `${s.file} (${s.moved.join(' and ')} hash moved)`).join(', ')}. Either the bake drew the same picture again, or tools/bakeStamp.ts was run without a bake and a stale picture now reads as fresh. Bake ${since.stampedNotBaked.length === 1 ? 'it' : 'them'} again to be sure, or say why the picture cannot have changed.`);
    }
    if (since.added.length) lines.push(`since the base: ${plural(since.added.length, 'new entry', 'new entries')} (${since.added.join(', ')})`);
    if (since.removed.length) lines.push(`since the base: ${plural(since.removed.length, 'entry', 'entries')} taken out (${since.removed.join(', ')})`);
    if (since.bakedAgain.length) lines.push(`since the base: ${plural(since.bakedAgain.length, 'picture')} baked again (${since.bakedAgain.join(', ')})`);
    if (since.stampedNotBaked.length) lines.push(`since the base: ${plural(since.stampedNotBaked.length, 'picture')} STAMPED AGAIN OVER THE SAME FILE (${since.stampedNotBaked.map((s) => s.file).join(', ')}): see Decisions for Brian`);
  } else if (head && !base) {
    since.added.push(...head.keys());
    decisions.push(`${MANIFEST} is new since the base: its ${head.size} entries are first stamps. They record each model and each picture as they were when it was written, and prove nothing about whether a picture matched its model before: no picture was baked again to find out. From here on a model, a page or a tool that changes without its picture being baked again fails npm test or check:scenes by name.`);
    lines.push(`since the base: the manifest itself is new (${head.size} first stamps)`);
  }

  const byTool = new Map();
  for (const image of json.images) {
    const key = image.tool ?? 'captured by hand (no tool)';
    const g = byTool.get(key) ?? { pictures: 0, fresh: 0, known: 0, inNpmTest: 0 };
    g.pictures++;
    if (image.listed && !image.findings.length) g.fresh++;
    if (image.findings.some((f) => f.kind === 'known')) g.known++;
    if (image.checked === 'npm test') g.inNpmTest++;
    byTool.set(key, g);
  }
  const table = [...byTool].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([tool, g]) => `${tool}: ${plural(g.pictures, 'picture')}, ${g.fresh} fresh${g.known ? `, ${g.known} KNOWN to be stale` : ''}; model checked in ${g.inNpmTest === g.pictures ? 'npm test' : g.inNpmTest === 0 ? 'check:scenes' : `npm test (${g.inNpmTest}) and check:scenes (${g.pictures - g.inNpmTest})`}`);
  const found = json.findings.map((f) => f.text);

  return {
    ok: problems.length === 0,
    summary: problems.length
      ? `${plural(c.pictures, 'baked picture')}: ${problems.join('; ')}`
      : `${plural(c.pictures, 'baked picture')}: ${c.fresh} fresh${c.knownStale ? `, ${c.knownStale} KNOWN to be stale (counted)` : ''}; ${c.inNpmTest} models built again as npm test builds them, ${c.inCheckScenes} as check:scenes does; ${c.noTool} captured by hand`,
    lines: [
      `${plural(c.pictures, 'picture')} in ${MANIFEST}: ${c.fresh} fresh, ${c.knownStale} known to be stale (counted, not failed), ${c.stale} stale, ${c.changed} changed without a stamp, ${c.size} of the wrong size or clearness, ${c.list} not listed as planned, ${c.broken} that could not be checked`,
      ...table,
      ...lines,
      ...found.slice(0, KEEP_LINES),
      ...(found.length > KEEP_LINES ? [`... ${found.length - KEEP_LINES} more: npx vite-node tools/bakeStamp.ts -- --check`] : []),
    ],
    // No times and no absolute paths: the stamp's report holds neither.
    data: { counts: c, images: json.images, findings: json.findings, manifestProblems: json.manifestProblems ?? [], sinceBase: since },
    measured: { knownStale: c.knownStale, noTool: c.noTool },
    decisions,
    human: [],
  };
}
