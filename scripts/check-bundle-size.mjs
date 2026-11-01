#!/usr/bin/env node
/**
 * Fails when the shipped JavaScript grows past a budget.
 *
 * Measures the gzipped size of every .js file in dist/assets, because that is what a
 * player actually downloads. Run `npm run build` first; this script never builds.
 *
 * The budget is the size of a clean production build on 2026-11-01. Raise it deliberately
 * in a pull request that explains why the extra weight is worth it — it is a tripwire, not
 * a target.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Gzipped bytes of dist/assets/*.js in a clean `npm run build` on 2026-11-01. */
const BUDGET_GZIP_BYTES = 149846;

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
