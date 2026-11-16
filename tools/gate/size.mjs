// Gate module: the gzipped JavaScript a player downloads (plan file 16, section 4.1 f; ruling M4, net zero).
//
// Two measures of the same thing, which must agree:
//   1. this file's own: every .js in dist/assets, gzipped at level 9, summed. The same sum scripts/check-bundle-size.mjs
//      makes (that script is read here, never edited);
//   2. `npm run size`, the check CI's Quality and Deploy workflows run, with its own verdict.
//
// The ratchet is the limit, not today's size: 751,265 bytes (682,969 x 1.1, rounded down). The bundle may move about
// under it, and may never pass it. The plan's 10 kB reserve on top is not available here: only Brian or Kai may open it,
// by raising the stored value in RATCHETS.json by hand.
//
// It measures the dist/ that is there. The runner builds it first (`npm run build`); in a run that left the build out
// the result says so.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const id = 'size';
export const modes = ['quick', 'milestone', 'baseline'];

/** The limit of 2026-11-16: floor(682,969 x 1.1). Stored once under --seed; from then on RATCHETS.json is what counts. */
const LIMIT = 751265;

const n = (bytes) => bytes.toLocaleString('en-US');

/** The budget and allowance written in the size script, so a change to either is seen and said. */
function scriptLimit(root) {
  try {
    const text = readFileSync(join(root, 'scripts', 'check-bundle-size.mjs'), 'utf8');
    const budget = Number(/const BUDGET_GZIP_BYTES = (\d+)/.exec(text)?.[1]);
    const tolerance = Number(/const TOLERANCE = ([\d.]+)/.exec(text)?.[1]);
    if (!Number.isFinite(budget) || !Number.isFinite(tolerance)) return null;
    return { budget, tolerance, limit: Math.floor(budget * (1 + tolerance)) };
  } catch {
    return null;
  }
}

export async function run(ctx) {
  // A build that was tried and failed leaves the last good dist/ lying there: measuring that would pass on old bytes.
  if (ctx.steps?.build?.ran && !ctx.steps.build.ok) {
    return { ok: false, summary: 'NOT RUN: the build failed, so the dist/ that is there is an older one', lines: [], data: {} };
  }
  const assets = join(ctx.root, 'dist', 'assets');
  if (!existsSync(assets) || !statSync(assets).isDirectory()) {
    return { ok: false, summary: 'NOT RUN: there is no dist/assets to measure (the build did not run, or failed)', lines: [], data: {} };
  }
  const files = readdirSync(assets).filter((name) => name.endsWith('.js')).sort().map((name) => {
    const raw = readFileSync(join(assets, name));
    return { name, raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length };
  });
  if (!files.length) return { ok: false, summary: 'NOT RUN: dist/assets holds no .js file', lines: [], data: {} };
  const gzipBytes = files.reduce((sum, f) => sum + f.gzip, 0);
  const rawBytes = files.reduce((sum, f) => sum + f.raw, 0);

  // The script CI runs, and the total it printed (the last row of its table: "total  <raw>  <gzipped>").
  const script = await ctx.sh('npm run size');
  const printed = /^total\s+(\d+)\s+(\d+)\s*$/m.exec(script.stdout);
  const scriptTotal = printed ? Number(printed[2]) : null;
  const written = scriptLimit(ctx.root);

  const stored = typeof ctx.stored?.gzipBytes === 'number' ? ctx.stored.gzipBytes : null;
  const against = stored ?? LIMIT;
  const lines = [
    `${n(gzipBytes)} gzipped bytes in ${files.length} files (${n(rawBytes)} before gzip); the ratchet is ${n(against)}${stored === null ? ' (not stored yet)' : ''}: ${gzipBytes <= against ? `${n(against - gzipBytes)} to spare` : `${n(gzipBytes - against)} OVER`}`,
    `npm run size: ${script.code === 0 ? 'passed' : `FAILED (exit ${script.code})`}${scriptTotal === null ? ', and printed no total' : `, total ${n(scriptTotal)}`}`,
    ...files.map((f) => `${f.name}: ${n(f.gzip)} gzipped, ${n(f.raw)} raw`),
  ];
  const problems = [];
  const decisions = [];
  if (script.code !== 0) problems.push(`npm run size failed (exit ${script.code})`);
  if (scriptTotal === null) problems.push('npm run size printed no total to compare with');
  else if (scriptTotal !== gzipBytes) problems.push(`the two measures disagree: ${n(gzipBytes)} here, ${n(scriptTotal)} from npm run size`);
  if (!written) {
    problems.push('the budget could not be read out of scripts/check-bundle-size.mjs');
  } else if (written.limit !== against) {
    decisions.push(written.limit > against
      ? `scripts/check-bundle-size.mjs now allows ${n(written.limit)} gzipped bytes, above the ratchet of ${n(against)}. The gate still holds the bundle to ${n(against)}; only Brian or Kai may raise it (and the 10 kB reserve is theirs to open).`
      : `scripts/check-bundle-size.mjs now allows ${n(written.limit)} gzipped bytes, under the ratchet of ${n(against)}: size.gzipBytes in RATCHETS.json can be lowered to match.`);
  }
  if (ctx.steps?.build && !ctx.steps.build.ran) lines.push('this run did not build: the dist/ measured is whatever was there');

  return {
    ok: problems.length === 0,
    summary: problems.length ? problems.join('; ') : `${n(gzipBytes)} gzipped bytes of ${n(against)}`,
    lines,
    data: { gzipBytes, rawBytes, limit: against, files, script: { exit: script.code, total: scriptTotal, ...(written ?? {}) } },
    measured: { gzipBytes },
    seedWith: { gzipBytes: LIMIT },
    decisions,
    human: [],
  };
}
