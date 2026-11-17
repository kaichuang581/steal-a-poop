// What the gate asks git, and nothing more. Every command here only reads: merge-base, rev-parse, status, diff, branch.
// (The one git command in the gate that changes anything is the base checkout, and that lives in lib/painted.mjs.)
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { quote } from './sh.mjs';

/**
 * The files whose change between base and head is always put in front of Brian (plan file 16, section 4.1 f, and file
 * 19, section 4): the ratchet store, the fences, the size budget, the kit audit's budgets, the workflows, the gate
 * itself and the exemption list. Git pathspecs.
 */
export const WATCHED = [
  'docs/visual-overhaul/RATCHETS.json',
  'src/skin/__tests__/fences.json',
  'scripts/check-bundle-size.mjs',
  ':(glob)src/skin/audit/*.json',
  '.github',
  'tools/gate',
  'docs/visual-overhaul/EXEMPT.json',
];

/** How each watched pathspec is written for a person, in the same order. */
export const WATCHED_NAMES = [
  'docs/visual-overhaul/RATCHETS.json',
  'src/skin/__tests__/fences.json',
  'scripts/check-bundle-size.mjs',
  'src/skin/audit/*.json',
  '.github/**',
  'tools/gate/**',
  'docs/visual-overhaul/EXEMPT.json',
];

/** `git status --porcelain` as [state, path] pairs, sorted by path. Untracked files are listed one by one. */
export async function status(sh, root, paths = []) {
  const spec = paths.length ? ` -- ${paths.map(quote).join(' ')}` : '';
  const r = await sh(`git status --porcelain --untracked-files=all -z${spec}`, { cwd: root });
  if (r.code !== 0) throw new Error(`git status failed: ${r.stderr.trim()}`);
  const parts = r.stdout.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const state = parts[i].slice(0, 2), path = parts[i].slice(3);
    if (state[0] === 'R' || state[0] === 'C') i++; // a rename or copy is followed by the old name: the new path says it all
    out.push([state, path]);
  }
  return out.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

/**
 * A folder name for exactly this source: the commit when nothing is changed or new, else the commit plus a hash of
 * every changed or new file's state and contents. Env files are read by vite and vitest but hidden from git, so they
 * are hashed in as well. The same recipe, step for step, as treeKey in lib/painted.mjs, so a tree's build and its test
 * report land in one folder of the cache.
 */
export function treeStamp(root, head, entries) {
  const envFiles = readdirSync(root).filter((f) => f === '.env' || f.startsWith('.env.')).sort();
  if (!entries.length && !envFiles.length) return head;
  const h = createHash('sha256');
  const add = (state, path) => {
    h.update(`${state}\0${path}\0`);
    const full = join(root, path);
    try {
      const st = lstatSync(full);
      if (st.isFile()) h.update(readFileSync(full));
      else h.update(`<${st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : 'other'}>`);
    } catch { h.update('<gone>'); }
    h.update('\0');
  };
  for (const [state, path] of entries) add(state, path);
  for (const f of envFiles) add('env', f);
  return `${head}-${h.digest('hex').slice(0, 12)}`;
}

/**
 * Base and head, the branch, and what is uncommitted. `ignore` holds paths that do not count as "the tree is changed"
 * (the two report files a milestone run writes itself). Throws with a plain sentence when git cannot answer: without a
 * base there is nothing to judge against.
 */
export async function facts(sh, root, { baseOverride = null, ignore = [] } = {}) {
  const one = async (cmd, what) => {
    const r = await sh(cmd, { cwd: root });
    if (r.code !== 0) throw new Error(`${what}: \`${cmd}\` failed: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
    return r.stdout.trim();
  };
  const head = await one('git rev-parse HEAD', 'no head commit');
  const base = baseOverride
    ? await one(`git rev-parse --verify ${quote(`${baseOverride}^{commit}`)}`, `--base ${baseOverride} is not a commit`)
    : await one('git merge-base HEAD origin/main', 'no base commit (is origin/main fetched? In CI the checkout needs fetch-depth 0)');
  // A pull request on the build server is checked out with no branch: its name comes from the workflow instead.
  const branch = (await sh('git branch --show-current', { cwd: root })).stdout.trim() || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  const all = await status(sh, root);
  const counted = all.filter(([, path]) => !ignore.includes(path));
  return { head, base, branch, porcelain: all.map(([state, path]) => `${state} ${path}`), dirty: counted.length > 0, stamp: treeStamp(root, head, all) };
}

/** A file as it was at a commit (`git show <commit>:<path>`), or null when it was not there. Reads only. */
export async function fileAt(sh, root, commit, path) {
  const r = await sh(`git show ${quote(`${commit}:${path}`)}`, { cwd: root });
  return r.code === 0 ? r.stdout : null;
}

/** How many commits head is past base (0 on a fresh branch). */
export async function commitsSince(sh, root, base, head) {
  const r = await sh(`git rev-list --count ${quote(`${base}..${head}`)}`, { cwd: root });
  return r.code === 0 ? Number(r.stdout.trim()) : null;
}

/** How much of one watched file's diff the report prints, and of all of them together. What is left out is counted. */
const DIFF_LINES_A_FILE = 80;
const DIFF_LINES_IN_ALL = 400;

/**
 * What changed in the watched files: committed between base and head (`git diff base...head`, the three-dot form: what
 * the branch itself did), and not committed yet. Sorted, so two runs print the same thing.
 *
 * Each committed file comes with its kind ('new', 'changed', 'deleted', 'renamed') and its line counts. A changed or
 * renamed file also carries its diff from the first "@@" on, as `diff` (lines), cut to DIFF_LINES_A_FILE lines a file
 * and DIFF_LINES_IN_ALL in all, with `cut` saying how many lines were left out. A new file's diff is the file itself,
 * so it is not repeated.
 */
export async function watchedDiff(sh, root, base, head) {
  const spec = WATCHED.map(quote).join(' ');
  const range = quote(`${base}...${head}`);
  const r = await sh(`git diff --numstat -z ${range} -- ${spec}`, { cwd: root });
  if (r.code !== 0) throw new Error(`git diff failed: ${r.stderr.trim()}`);
  const committed = [];
  const parts = r.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const [added, removed, path] = parts[i].split('\t');
    // A rename prints its two names after the counts, each as its own entry: keep the new one.
    if (path === '') { committed.push({ path: parts[i + 2], added: num(added), removed: num(removed), from: parts[i + 1] }); i += 2; }
    else committed.push({ path, added: num(added), removed: num(removed) });
  }
  committed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // New, changed or deleted: `git diff --name-status` says which (a rename is followed by both names).
  const kinds = new Map();
  const st = await sh(`git diff --name-status -z ${range} -- ${spec}`, { cwd: root });
  if (st.code !== 0) throw new Error(`git diff failed: ${st.stderr.trim()}`);
  const names = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < names.length; i++) {
    const letter = names[i][0];
    if (letter === 'R' || letter === 'C') { kinds.set(names[i + 2], 'renamed'); i += 2; }
    else { kinds.set(names[i + 1], letter === 'A' ? 'new' : letter === 'D' ? 'deleted' : 'changed'); i += 1; }
  }
  let room = DIFF_LINES_IN_ALL;
  for (const f of committed) {
    f.kind = kinds.get(f.path) ?? 'changed';
    f.diff = [];
    f.cut = 0;
    if (f.kind !== 'changed' && f.kind !== 'renamed') continue;
    const paths = f.from ? `${quote(f.from)} ${quote(f.path)}` : quote(f.path);
    const d = await sh(`git diff --no-color --no-ext-diff -M -U3 ${range} -- ${paths}`, { cwd: root });
    if (d.code !== 0) throw new Error(`git diff failed for ${f.path}: ${d.stderr.trim()}`);
    const lines = d.stdout.replace(/\n$/, '').split('\n');
    const from = lines.findIndex((l) => l.startsWith('@@'));
    const body = from < 0 ? [] : lines.slice(from);
    const keep = Math.max(0, Math.min(body.length, DIFF_LINES_A_FILE, room));
    f.diff = body.slice(0, keep);
    f.cut = body.length - keep;
    room -= keep;
  }
  const uncommitted = (await status(sh, root, WATCHED)).map(([state, path]) => ({ state: state.trim() || state, path }));
  return { committed, uncommitted };
}

/** A count from --numstat; a binary file has "-" there. */
function num(text) {
  return text === '-' ? null : Number(text);
}

/** Which watched group a path belongs to, as a person would write it. */
export function watchedGroup(path) {
  if (path.startsWith('.github/')) return '.github/**';
  if (path.startsWith('tools/gate/')) return 'tools/gate/**';
  if (/^src\/skin\/audit\/[^/]+\.json$/.test(path)) return 'src/skin/audit/*.json';
  return path;
}
