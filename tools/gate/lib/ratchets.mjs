// The ratchet comparison (plan file 16, section 4.1 f). docs/visual-overhaul/RATCHETS.json holds, for each gate module,
// the numbers that module measured when they were first stored. A stored leaf is either
//
//   a number        the measured value may not rise above it;
//   { "min": n }    the measured value may not fall below it.
//
// Every module hands the runner `measured`, an object of numbers of any depth. The runner compares each leaf with the
// stored one at the same place:
//
//   above a stored number        fails
//   below a stored number        passes, and is reported as "can be lowered"
//   below a stored { min }       fails
//   above a stored { min }       passes, and is reported as "can be raised"
//   no stored value              fails, unless the run has --seed: then the value is stored
//   stored but not measured      fails (a number nobody measures any more is a ratchet let go)
//
// Under --seed the value stored is the module's `seedWith` leaf at that place when it gave one (a limit, or a
// { min }), else the measured number. --seed only ever adds: a leaf that exists is never written over. Lowering a
// stored number, or raising it with Brian's dated words, is an edit to RATCHETS.json by hand, and the gate prints that
// file's diff under "Decisions for Brian".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** A stored "may not fall" leaf: an object whose one key is `min`, holding a number. */
export const isFloor = (v) => isObject(v) && Object.keys(v).length === 1 && isNumber(v.min);

/** A stored leaf of either kind. */
const isStoredLeaf = (v) => isNumber(v) || isFloor(v);

/** A leaf's place, written for a person: size.gzipBytes, hex["src/skin/a.css"]. */
export function leafName(path) {
  return path.map((key, i) => (/^[A-Za-z0-9_@-]+$/.test(key) ? (i ? `.${key}` : key) : `[${JSON.stringify(key)}]`)).join('') || '(the whole object)';
}

/** Every leaf of a stored or seed tree, as { path, kind: 'max' | 'min', value }, plus what is wrong with its shape. */
function storedLeaves(tree, path = [], out = { leaves: [], problems: [] }) {
  if (tree === undefined) return out;
  if (isNumber(tree)) out.leaves.push({ path, kind: 'max', value: tree });
  else if (isFloor(tree)) out.leaves.push({ path, kind: 'min', value: tree.min });
  else if (isObject(tree)) for (const key of Object.keys(tree).sort()) storedLeaves(tree[key], [...path, key], out);
  else out.problems.push({ path, problem: `is ${JSON.stringify(tree)}, not a number or { "min": n }` });
  return out;
}

/** Every leaf of a module's `measured`, as { path, value }, plus what is wrong with its shape. */
function measuredLeaves(tree, path = [], out = { leaves: [], problems: [] }) {
  if (tree === undefined) return out;
  if (isNumber(tree)) out.leaves.push({ path, value: tree });
  // { min: n } is how a stored floor is written, so a measured object of that shape could not be told from one.
  else if (isFloor(tree)) out.problems.push({ path, problem: 'is an object whose only key is "min": that shape is kept for stored floors, name the number something else' });
  else if (isObject(tree)) for (const key of Object.keys(tree).sort()) measuredLeaves(tree[key], [...path, key], out);
  else out.problems.push({ path, problem: `is ${typeof tree === 'number' ? String(tree) : JSON.stringify(tree) ?? typeof tree}, not a finite number` });
  return out;
}

const keyOf = (path) => JSON.stringify(path);

/** What sits at `path` in a tree: undefined when nothing does. */
function at(tree, path) {
  let node = tree;
  for (const key of path) {
    if (!isObject(node) || isFloor(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** True when a new leaf can be added at `path` without writing over anything: no value there, no leaf on the way. */
function free(tree, path) {
  let node = tree;
  for (let i = 0; i < path.length; i++) {
    if (node === undefined) return true;
    if (!isObject(node) || isFloor(node)) return false; // a leaf is in the way
    if (!Object.hasOwn(node, path[i])) return true;
    node = node[path[i]];
  }
  return node === undefined;
}

/** Judges one number against one stored leaf. */
function judge(kind, old, now) {
  if (kind === 'max') {
    if (now > old) return { ok: false, verdict: 'ROSE', note: `${fmt(now - old)} over the stored value` };
    if (now < old) return { ok: true, verdict: 'can be lowered', note: `${fmt(old - now)} under the stored value` };
    return { ok: true, verdict: 'same', note: '' };
  }
  if (now < old) return { ok: false, verdict: 'FELL', note: `${fmt(old - now)} under the stored floor` };
  if (now > old) return { ok: true, verdict: 'can be raised', note: `${fmt(now - old)} over the stored floor` };
  return { ok: true, verdict: 'same', note: '' };
}

/** A number without float noise: 3851, 0.25, 1.5e-7. */
export function fmt(n) {
  if (n === null || n === undefined) return 'none';
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(10)));
}

/**
 * Compares one module's measured numbers with its stored section.
 *   stored     the module's section of RATCHETS.json, or undefined
 *   measured   what the module measured
 *   seedWith   what to store under --seed where it differs from `measured` (same shape, leaves a number or { min })
 *   seed       true under --seed
 * Returns { ok, rows, add }: one row per leaf ({ leaf, path, kind, old, new, verdict, ok, note }), and the leaves a
 * --seed run should add ({ path, value } with value a number or { min }).
 */
export function compare({ stored, measured, seedWith, seed = false }) {
  const rows = [];
  const add = [];
  const S = storedLeaves(stored);
  const M = measuredLeaves(measured);
  const W = storedLeaves(seedWith);
  for (const { path, problem } of S.problems) rows.push(row(path, 'max', null, null, false, 'BAD STORED VALUE', `the stored value ${problem}`));
  for (const { path, problem } of M.problems) rows.push(row(path, 'max', null, null, false, 'NOT A NUMBER', `the measured value ${problem}`));
  for (const { path, problem } of W.problems) rows.push(row(path, 'max', null, null, false, 'BAD SEED', `seedWith ${problem}`));

  const storedBy = new Map(S.leaves.map((l) => [keyOf(l.path), l]));
  const seedBy = new Map(W.leaves.map((l) => [keyOf(l.path), l]));
  const measuredKeys = new Set(M.leaves.map((l) => keyOf(l.path)));

  for (const { path, value } of M.leaves) {
    const have = storedBy.get(keyOf(path));
    if (have) {
      const j = judge(have.kind, have.value, value);
      rows.push(row(path, have.kind, have.value, value, j.ok, j.verdict, j.note));
      continue;
    }
    if (at(stored, path) !== undefined || !free(stored, path)) {
      rows.push(row(path, 'max', null, value, false, 'SHAPE CHANGED', 'the stored values have a different shape at this place; --seed never writes over them'));
      continue;
    }
    if (!seed) {
      rows.push(row(path, 'max', null, value, false, 'NO STORED VALUE', 'nothing is stored for this number; run the gate once with --seed to store it, and commit RATCHETS.json'));
      continue;
    }
    const wanted = seedBy.get(keyOf(path)) ?? { kind: 'max', value };
    const j = judge(wanted.kind, wanted.value, value);
    add.push({ path, value: wanted.kind === 'min' ? { min: wanted.value } : wanted.value });
    rows.push(row(path, wanted.kind, wanted.value, value, j.ok, j.ok ? 'seeded' : `seeded, and ${j.verdict}`,
      j.ok ? (wanted.value === value ? 'stored for the first time' : `stored for the first time as ${wanted.kind === 'min' ? 'a floor of ' : ''}${fmt(wanted.value)}`) : j.note));
  }
  for (const { path, kind, value } of S.leaves) {
    if (!measuredKeys.has(keyOf(path))) rows.push(row(path, kind, value, null, false, 'NOT MEASURED', 'a value is stored for this number but the module did not measure it'));
  }
  for (const { path } of W.leaves) {
    if (!measuredKeys.has(keyOf(path))) rows.push(row(path, 'max', null, null, false, 'BAD SEED', 'seedWith names a number the module did not measure'));
  }
  rows.sort((a, b) => (a.leaf < b.leaf ? -1 : a.leaf > b.leaf ? 1 : 0));
  return { ok: rows.every((r) => r.ok), rows, add };
}

function row(path, kind, old, now, ok, verdict, note) {
  return { leaf: leafName(path), path, kind, old, new: now, verdict, ok, note: note ?? '' };
}

/**
 * Adds seeded leaves to a module's section of the store. Never writes over anything: a leaf that is there stays as it
 * is. Returns the leaves really added.
 */
export function addSeeds(store, id, add) {
  const added = [];
  for (const { path, value } of add) {
    const full = [id, ...path];
    if (at(store, full) !== undefined || !free(store, full)) continue;
    let node = store;
    for (const key of full.slice(0, -1)) {
      if (!Object.hasOwn(node, key)) node[key] = {};
      node = node[key];
    }
    node[full.at(-1)] = value;
    added.push({ path: full, value });
  }
  return added;
}

/**
 * What changed between two versions of the store (the base commit's and today's), leaf by leaf. `looser` is true for
 * the changes only Brian's dated words allow: a number raised, a floor lowered, a leaf taken out or turned into the
 * other kind. Sorted by leaf.
 */
export function storeChanges(before, after) {
  const A = new Map(storedLeaves(before).leaves.map((l) => [keyOf(l.path), l]));
  const B = new Map(storedLeaves(after).leaves.map((l) => [keyOf(l.path), l]));
  const out = [];
  const show = (l) => `${l.kind === 'min' ? 'at least ' : ''}${fmt(l.value)}`;
  for (const [key, a] of A) {
    const b = B.get(key);
    const leaf = leafName(a.path);
    if (!b) out.push({ leaf, change: 'removed', from: show(a), to: 'nothing', looser: true });
    else if (a.kind !== b.kind) out.push({ leaf, change: 'changed kind', from: show(a), to: show(b), looser: true });
    else if (b.value !== a.value) {
      const up = b.value > a.value;
      out.push({ leaf, change: a.kind === 'max' ? (up ? 'raised' : 'lowered') : (up ? 'floor raised' : 'floor lowered'), from: show(a), to: show(b), looser: a.kind === 'max' ? up : !up });
    }
  }
  for (const [key, b] of B) if (!A.has(key)) out.push({ leaf: leafName(b.path), change: 'added', from: 'nothing', to: show(b), looser: false });
  return out.sort((x, y) => (x.leaf < y.leaf ? -1 : x.leaf > y.leaf ? 1 : 0));
}

/** Keys in order at every depth, so the file reads the same whoever wrote it. */
export function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sorted(value[key]);
  return out;
}

/** Reads the store. A missing file is an empty store; a file that is not an object of objects is an error. */
export function readStore(file) {
  if (!existsSync(file)) return {};
  const store = JSON.parse(readFileSync(file, 'utf8'));
  if (!isObject(store)) throw new Error(`${file} is not a JSON object`);
  return store;
}

/** Writes the store, keys sorted, two spaces, one newline at the end. Only the runner calls this, and only under --seed. */
export function writeStore(file, store) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted(store), null, 2)}\n`);
}

/** One line for the console and the report: "gzipBytes   stored 751265   now 747414   can be lowered (3851 under ...)". */
export function rowLine(r) {
  const old = r.old === null ? 'none' : `${r.kind === 'min' ? 'at least ' : ''}${fmt(r.old)}`;
  return `${r.leaf}: stored ${old}, now ${fmt(r.new)}, ${r.verdict}${r.note ? ` (${r.note})` : ''}`;
}

export { isStoredLeaf };
