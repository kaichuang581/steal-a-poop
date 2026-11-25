#!/usr/bin/env node
/**
 * Fails when the shipped JavaScript grows past a budget.
 *
 * Measures the gzipped size of every .js file in dist/assets, because that is what a
 * player actually downloads. Run `npm run build` first; this script never builds.
 *
 * The budget is the size of a clean production build. Raise it deliberately, in a commit
 * that explains why the extra weight is worth it: it is a tripwire, not a target.
 *
 * History: 149,906 bytes on 2026-11-01, before the painted skin's three.js scenes. Every push
 * failed against it from then on, so the check caught nothing. Rebased on 2026-11-11 to the
 * build of that day (the 3D farm, table, dream and podium are all in the main chunk).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gzipped bytes of dist/assets/*.js in a clean `npm run build` on `main`, 2026-11-11, raised on 2026-11-17 by
 * 5,031 bytes for the visual overhaul's milestone 2 (the world built in slices, faces nobody sees dropped, flat faces
 * merged, animals in fewer draws: about 1,100 lines of real code, which took the total 0.87 kB over the old limit), and
 * again by 6,000 bytes for milestone 4 (quality tiers, the detail swap, the contact patch), and again by 3,000 bytes for
 * milestone 7 (table framings with the board in frame, the calmer floor, the duel refinements), and again by 4,000 bytes
 * for the French version (the last 1,000 because CI's build came out about 0.3 kB bigger than a local one) (the language
 * switch, accent folding, the French page translator and the dream's French starts; the French text itself is
 * public/i18n-fr.json, not counted here), and again by 1,000 bytes for milestone 6 (Brian's face picks, the hat in the
 * head, two shadow draws per animal), and on 2026-11-20 by 6,000 bytes for the painted-miniature plan's M3 (the micro
 * kit's twenty-seven object builders, the placements with their rules, the ground's shade map: 3.12 kB over the old
 * limit), and on 2026-11-20 by 3,000 bytes for the new start screen merged with the French version (CI's build came
 * out 1.1 kB over, about 3 kB bigger than a local one; Brian's standing choice of 2026-11-17 is to raise the limit),
 * and on 2026-11-21 by 1,000 bytes for the yarn loading screen (CI's build came out 0.09 kB over; locally 2.9 kB under),
 * and on 2026-11-21 by 2,000 bytes for the depth plan's light, palette and clouds (1.72 kB under locally, which CI's
 * build, about 3 kB bigger, would have failed).
 * and on 2026-11-21 by 6,000 bytes for the leaderboards' second version (docs/leaderboards/LEADERBOARDS-PLAN.md: the
 * slab screen, its pixel art and the snowy island; 4.1 kB locally, with room for CI's larger gzip), +15,000 in 0.9.5 (the
 * leaderboards' stage: its poses, the rebuilt island, the festival podiums, the floating trophy and the festival sky;
 * 15.2 kB locally, all in the stage's own chunk, which loads only when the leaderboards open).
 * All are flagged to Brian; a shrink pass back toward the plan's net-zero is listed for milestone 12.
 */
const BUDGET_GZIP_BYTES = 791000; // +31,000 for Counting Sheep version 3 (docs/dream/v3, 2026-11-25: the dream in voxels: the pack's 69 models and three worlds as data, their mesher and the voxel world, 45.6 kB in the dream's own chunk, which loads only when the dream opens; the flat scenery it replaces came out of the main chunk; 29.9 kB over locally, and CI's build runs about 3.6 kB over a local one); +1,000 for the Brian avatars' exposure, vignette and grain (4.1 kB under locally, and CI's build runs about 3.6 kB bigger); +3,000 for the fifth and sixth admin avatars' face maths and sliders (1.5 kB under locally, and CI's build runs about 3.6 kB bigger than a local one); +6,000 in 0.9.7 (the profile and Home's cards rebuilt; Brian's choice of 2026-11-17: raise the limit; CI's build, with the real server settings, runs about 3.6 kB over a local one, and 0.9.6 and 0.9.7 both failed to deploy on it); +1,000 in 0.9.3 (the kitchen garden): CI's gzip ran 0.42 kB over; +6,000 in 0.9.4 (the leaderboards); +15,000 in 0.9.5 (their stage); +4,000 unique visitors and the chooser's live counts; +10,000 for Counting Sheep's redesign (docs/dream, 2026-11-24: the bed strip, the tray and interface, the beat's effects and star words were 7.2 kB by its third milestone; CI's build runs about 3.6 kB over a local one)

/** Allowed growth over the budget before the check fails (10%). */
const TOLERANCE = 0.1;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(repoRoot, 'dist', 'assets');

const limit = Math.floor(BUDGET_GZIP_BYTES * (1 + TOLERANCE));

const kb = (bytes) => `${(bytes / 1000).toFixed(2)} kB`;
const pct = (bytes) => `${((bytes / BUDGET_GZIP_BYTES - 1) * 100).toFixed(1)}%`;

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

let entries;
try {
  entries = readdirSync(assetsDir);
} catch {
  fail(`Cannot read dist/assets. Run "npm run build" first.`);
}

if (!statSync(assetsDir).isDirectory()) {
  fail(`dist/assets is not a directory.`);
}

const jsFiles = entries.filter((name) => name.endsWith('.js')).sort();

if (jsFiles.length === 0) {
  fail(`No .js files in dist/assets. Run "npm run build" first.`);
}

const rows = [];
let totalRaw = 0;
let totalGzip = 0;

for (const name of jsFiles) {
  const raw = readFileSync(join(assetsDir, name));
  const gzip = gzipSync(raw, { level: 9 }).length;
  totalRaw += raw.length;
  totalGzip += gzip;
  rows.push({ name, raw: raw.length, gzip });
}

const nameWidth = Math.max(...rows.map((row) => row.name.length), 12);
const rawWidth = Math.max(...rows.map((row) => String(row.raw).length), 9);
const gzipWidth = Math.max(...rows.map((row) => String(row.gzip).length), 10);

console.log('\nBundle size — gzipped JavaScript in dist/assets\n');
console.log(
  `${'file'.padEnd(nameWidth)}  ${'raw'.padStart(rawWidth)}  ${'gzipped'.padStart(gzipWidth)}`
);
console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(rawWidth)}  ${'-'.repeat(gzipWidth)}`);
for (const row of rows) {
  console.log(
    `${row.name.padEnd(nameWidth)}  ${String(row.raw).padStart(rawWidth)}  ${String(row.gzip).padStart(gzipWidth)}`
  );
}
console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(rawWidth)}  ${'-'.repeat(gzipWidth)}`);
console.log(
  `${'total'.padEnd(nameWidth)}  ${String(totalRaw).padStart(rawWidth)}  ${String(totalGzip).padStart(gzipWidth)}`
);

console.log(`\n  total gzipped : ${kb(totalGzip)}`);
console.log(`  budget        : ${kb(BUDGET_GZIP_BYTES)}`);
console.log(`  allowance     : +${TOLERANCE * 100}% → limit ${kb(limit)}`);

if (totalGzip > limit) {
  console.error(
    `\n✗ FAIL: ${kb(totalGzip)} is ${kb(totalGzip - limit)} over the ${kb(limit)} limit ` +
      `(${pct(totalGzip)} vs the ${kb(BUDGET_GZIP_BYTES)} budget).`
  );
  console.error(
    `  Shrink the bundle, or raise BUDGET_GZIP_BYTES in scripts/check-bundle-size.mjs and explain why in the pull request.`
  );
  process.exit(1);
}

const headroom = limit - totalGzip;
console.log(
  `\n✓ PASS: ${kb(headroom)} of headroom left (${pct(totalGzip)} vs the ${kb(BUDGET_GZIP_BYTES)} budget).\n`
);
