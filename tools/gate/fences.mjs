#!/usr/bin/env node
// Gate module: the fences (plan file 16, section 4.1 c; file 19, sections 1 and 7). Arithmetic, hashes and one
// `git ls-files`: nothing is built and nothing is opened.
//
// Three things are held, and src/skin/__tests__/fences.test.ts holds the same three in `npm test` by calling the
// functions below (one implementation, so the test and the gate cannot drift apart):
//
//   1. The fenced files. src/skin/__tests__/fences.json pins the SHA-256 of every file the visual overhaul may not
//      touch: all of src/engine, src/dream, src/state, src/lib, src/net, src/auth, src/avatars, src/audio, src/ui,
//      server, db and e2e, plus src/main.tsx, src/index.css, index.html, public/words.txt, public/word-frequency.txt,
//      and src/config.ts hashed without the one line that may be added to it (the FESTIVE constant). A file that
//      changed, appeared or went is named.
//   2. The saved keys. The set the plan's own search finds (grep -rhoE "sap:[a-zA-Z:._-]+" src) equals the pinned list.
//   3. The tests that may be replaced. tools/gate/replaceable.json, the replaceable entries of
//      tools/gate/milestones.json and the sentence in docs/visual-overhaul/19-decisions-and-conflicts.md (section 1,
//      the same sentence as in CLAUDE.md's entry) name the same files for the same milestones.
//
// What git lists is what is hashed (tracked files, and new files git does not ignore), so build output and
// node_modules never enter.
//
// As a gate module it also prints the change of fences.json between base and head as a decision for Brian, and hands
// in the kit audit's budgets (src/skin/audit/budget.json) and the number of entries in src/skin/audit/allow.json as
// ratchets, so a budget raised later, or one more allowance, is refused until Brian says so.
//
// Run directly:
//   node tools/gate/fences.mjs            check, print what differs, exit 1 if anything does
//   node tools/gate/fences.mjs --write    pin what is there now (a change that is meant: Kai's server work, say).
//                                         The gate prints the change to fences.json as a decision for Brian.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const id = 'fences';
export const modes = ['quick', 'milestone', 'baseline'];

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/** Where the pins live. A watched file: the runner prints its diff, and this module says what the diff means. */
export const PINS = 'src/skin/__tests__/fences.json';
/** Every file under these is fenced. */
export const FENCED_DIRS = ['src/engine', 'src/dream', 'src/state', 'src/lib', 'src/net', 'src/auth', 'src/avatars', 'src/audio', 'src/ui', 'server', 'db', 'e2e'];
/** And these single files. */
export const FENCED_FILES = ['src/main.tsx', 'src/index.css', 'index.html', 'public/words.txt', 'public/word-frequency.txt'];
/** Fenced but for one line: the season's constant (CLAUDE.md: "src/config.ts (one constant, FESTIVE, beside UPDATE_NAME)"). */
export const CONFIG = 'src/config.ts';
/**
 * The one line of src/config.ts that is left out of its hash: `export const FESTIVE = true;` or `= false;`, alone on
 * its line, with nothing after it but a comment. Anything else on that line, or a FESTIVE that is not a plain true or
 * false, is a change to the file like any other.
 */
const FESTIVE_LINE = /^export const FESTIVE(?:\s*:\s*boolean)?\s*=\s*(?:true|false)\s*;?[ \t]*(?:\/\/.*)?\r?$/;

/** The plan's search for saved keys, as a pattern. The pinned list holds each key without these four characters in front. */
const KEY_PREFIX = 'sap:';
const KEY_PATTERN = /sap:[a-zA-Z:._-]+/g;

const REPLACEABLE = 'tools/gate/replaceable.json';
const MILESTONES = 'tools/gate/milestones.json';
const FILE_19 = 'docs/visual-overhaul/19-decisions-and-conflicts.md';
const CLAUDE = 'CLAUDE.md';
const BUDGET = 'src/skin/audit/budget.json';
const ALLOW = 'src/skin/audit/allow.json';

/** What a person does about a fenced file that differs. Printed with every failure. */
export const WHAT_TO_DO = [
  'The visual overhaul may not touch a fenced file (CLAUDE.md, "The visual overhaul"; plan file 16, section 4.1 c): put it back as it was.',
  'A change that is meant (Kai\'s server work on another branch, say) is pinned again with `node tools/gate/fences.mjs --write`, and said in the pull request, where the gate prints the change to fences.json as a decision for Brian.',
];

const ABOUT = [
  'The fences of the visual overhaul (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 c). Checked by src/skin/__tests__/fences.test.ts in `npm test` and by tools/gate/fences.mjs in `npm run gate`.',
  'files: the SHA-256 of every file the overhaul may not touch, as git lists them: all of src/engine, src/dream, src/state, src/lib, src/net, src/auth, src/avatars, src/audio, src/ui, server, db and e2e, plus src/main.tsx, src/index.css, index.html, public/words.txt and public/word-frequency.txt. src/config.ts is hashed without the one line that may be added to it, the FESTIVE constant.',
  'savedKeys: every key the game saves under in a browser, each written here without the "sap" and the colon it starts with (so that this list is not itself found by the search that makes it). A saved key is a promise to players: the set may not change.',
  'A file or key that differs fails the test, by name. A change that is meant is pinned again with `node tools/gate/fences.mjs --write` and said in the pull request; the gate prints every change to this file as a decision for Brian.',
];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sortedCopy = (list) => [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    throw new Error(`the fences ask git which files there are, and git could not say (git ${args[0]} in ${root}: ${String(r.error?.message ?? r.stderr ?? '').trim().split('\n')[0] || `exit ${r.status}`}). Run this in a checkout of the repo.`);
  }
  return r.stdout;
}

/**
 * The files under `paths` that git lists (tracked, or new and not ignored) and that are there as plain files, sorted.
 * A tracked file that has been deleted is not in the list, and neither is one swapped for a link.
 */
export function listed(root, paths) {
  const out = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths]);
  const names = [...new Set(out.split('\0').filter(Boolean))];
  return sortedCopy(names.filter((name) => lstatSync(join(root, name), { throwIfNoEntry: false })?.isFile()));
}

/** The bytes of src/config.ts that are hashed: the file without its FESTIVE line. Byte for byte when there is none. */
export function configBytes(bytes) {
  const lines = bytes.toString('latin1').split('\n');
  return Buffer.from(lines.filter((line) => !FESTIVE_LINE.test(line)).join('\n'), 'latin1');
}

/** Every fenced file that is there now, with its hash: { path: sha256 }, keys sorted. */
export function fencedNow(root) {
  const files = {};
  for (const name of listed(root, [...FENCED_DIRS, ...FENCED_FILES, CONFIG])) {
    const bytes = readFileSync(join(root, name));
    files[name] = sha256(name === CONFIG ? configBytes(bytes) : bytes);
  }
  return files;
}

/** The saved keys found in src now, without their prefix, sorted. The same set the plan's grep prints. */
export function savedKeysNow(root) {
  const found = new Set();
  for (const name of listed(root, ['src'])) {
    for (const match of readFileSync(join(root, name), 'latin1').matchAll(KEY_PATTERN)) found.add(match[0].slice(KEY_PREFIX.length));
  }
  return sortedCopy(found);
}

/** Reads the pins. Throws a plain sentence when the file is missing or is not what `--write` writes. */
export function readPins(root) {
  let json;
  try { json = JSON.parse(readFileSync(join(root, PINS), 'utf8')); } catch (e) {
    throw new Error(`${PINS} could not be read (${String(e?.message ?? e).split('\n')[0]}): the fences have nothing to compare with`);
  }
  return pinsOf(json);
}

/** The two lists out of a parsed fences.json, or a thrown sentence saying what is wrong with it. */
function pinsOf(json) {
  const files = json?.files, keys = json?.savedKeys;
  const good = files && typeof files === 'object' && !Array.isArray(files) && Object.values(files).every((h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h))
    && Array.isArray(keys) && keys.every((k) => typeof k === 'string' && k !== '' && !k.startsWith(KEY_PREFIX));
  if (!good) throw new Error(`${PINS} is not a list of pins (files: { path: sha256 }, savedKeys: [key without its prefix]): the fences have nothing to compare with`);
  if (new Set(keys).size !== keys.length) throw new Error(`${PINS} lists a saved key twice`);
  return { files, savedKeys: keys };
}

/** How two { path: sha256 } maps differ. */
function fileDifferences(pinned, now) {
  const changed = [], added = [], deleted = [];
  for (const name of Object.keys(now)) {
    if (!Object.hasOwn(pinned, name)) added.push(name);
    else if (pinned[name] !== now[name]) changed.push(name);
  }
  for (const name of Object.keys(pinned)) if (!Object.hasOwn(now, name)) deleted.push(name);
  return { changed: sortedCopy(changed), added: sortedCopy(added), deleted: sortedCopy(deleted) };
}

function keyDifferences(pinned, now) {
  const a = new Set(pinned), b = new Set(now);
  return { added: sortedCopy(now.filter((k) => !a.has(k))), gone: sortedCopy(pinned.filter((k) => !b.has(k))) };
}

/** Names for a first line: all of them when few, else the first ones and how many more. */
const some = (list, max = 6) => (list.length <= max ? list.join(', ') : `${list.slice(0, max).join(', ')} and ${list.length - max} more`);

/**
 * The fenced files against their pins. Returns lines: none when every file is as pinned. The first line names what
 * differs, the next ones each file, the last two what to do.
 */
export function fileProblems(root) {
  const d = fileDifferences(readPins(root).files, fencedNow(root));
  const count = d.changed.length + d.added.length + d.deleted.length;
  if (!count) return [];
  const parts = [d.changed.length ? `changed: ${some(d.changed)}` : '', d.added.length ? `added: ${some(d.added)}` : '', d.deleted.length ? `deleted: ${some(d.deleted)}` : ''].filter(Boolean);
  return [
    `${plural(count, 'fenced file')} ${count === 1 ? 'is' : 'are'} not as ${PINS} pins ${count === 1 ? 'it' : 'them'} (${parts.join('; ')})`,
    ...d.changed.map((name) => `  changed: ${name}`),
    ...d.added.map((name) => `  added:   ${name}`),
    ...d.deleted.map((name) => `  deleted: ${name}`),
    ...(d.changed.includes(CONFIG) ? [`${CONFIG} may gain one line and no more: \`export const FESTIVE = true;\` (or false), alone on its line; a comment may follow it on that line. Anything else there is a change.`] : []),
    ...WHAT_TO_DO,
  ];
}

/** The saved keys against the pinned list. Returns lines: none when the two sets are the same. */
export function keyProblems(root) {
  const pins = readPins(root);
  const d = keyDifferences(pins.savedKeys, savedKeysNow(root));
  if (!d.added.length && !d.gone.length) return [];
  const show = (keys) => keys.map((k) => `${KEY_PREFIX}${k}`);
  const parts = [d.added.length ? `new: ${some(show(d.added))}` : '', d.gone.length ? `gone: ${some(show(d.gone))}` : ''].filter(Boolean);
  return [
    `the saved keys in src are not the ${pins.savedKeys.length} that ${PINS} pins (${parts.join('; ')})`,
    ...show(d.added).map((k) => `  new:  ${k}`),
    ...show(d.gone).map((k) => `  gone: ${k}`),
    'A saved key is a promise to players: the overhaul adds none and renames none, but for the one the plan names (the graphics cache of milestone 4, a device cache, not player data).',
    `The search is the plan's own: grep -rhoE "${KEY_PREFIX}[a-zA-Z:._-]+" src. A key that is meant is pinned with \`node tools/gate/fences.mjs --write\`, and the gate prints the change to fences.json as a decision for Brian.`,
  ];
}

const squash = (text) => text.replace(/\s+/g, ' ').trim();
const FILE_WORD = /[A-Za-z0-9_./-]*[A-Za-z0-9_]\.tsx?(?![A-Za-z0-9_])/g;
const START = 'Tests that may be replaced, each only in its milestone:';
const NEVER = 'Never replaced:';
const END = 'The gate checks vitest\'s JSON: no other test may vanish, skip or be renamed.';

/** The sentence that lists the replaceable tests, out of a document: { whole, may, never }, or null when it is not there. */
function sentenceOf(text) {
  const flat = squash(text);
  const from = flat.indexOf(START), mid = flat.indexOf(NEVER, from), to = flat.indexOf(END, mid);
  if (from < 0 || mid < 0 || to < 0) return null;
  return { flat, whole: flat.slice(from, to + END.length), may: flat.slice(from + START.length, mid).trim(), never: flat.slice(mid + NEVER.length, to).trim() };
}

/**
 * tools/gate/replaceable.json against the milestone table and against the sentence of plan file 19, section 1 (and
 * CLAUDE.md's copy of it). Returns lines: none when all agree on which files and which milestones.
 */
export function replaceableProblems(root) {
  const read = (name) => readFileSync(join(root, name), 'utf8');
  let mine, table, text19, claude;
  try {
    mine = JSON.parse(read(REPLACEABLE));
    table = JSON.parse(read(MILESTONES));
    text19 = read(FILE_19);
    claude = read(CLAUDE);
  } catch (e) {
    return [`the list of replaceable tests could not be compared: ${String(e?.message ?? e).split('\n')[0]}`];
  }
  const out = [];
  const entries = Array.isArray(mine?.replaceable) ? mine.replaceable : null;
  const bad = !entries || entries.some((e) => !e || !Number.isInteger(e.milestone) || typeof e.file !== 'string' || typeof e.scope !== 'string' || typeof e.condition !== 'string' || typeof e.test !== 'boolean' || typeof e.named !== 'string' || !e.named);
  if (bad || !Array.isArray(table?.milestones)) return [`${bad ? REPLACEABLE : MILESTONES} does not have the shape the fences read (replaceable: [{ milestone, file, scope, condition, test, named, ledger }])`];
  const where = (e) => `${e.file} (milestone ${e.milestone})`;
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(where(e))) out.push(`${REPLACEABLE} lists ${where(e)} twice`);
    seen.add(where(e));
    // What the ledger lets through is written only for a vitest file, and only in the words the ledger knows.
    const l = e.ledger;
    const known = l === null || (l && typeof l === 'object' && l.bytes === true && (l.tests === 'kept' || l.tests === 'replaced') && (l.stay === undefined || (Array.isArray(l.stay) && l.stay.every((s) => typeof s === 'string' && s))));
    if (!known) out.push(`${REPLACEABLE}: the ledger entry of ${where(e)} is not one the ledger reads (null, or { bytes: true, tests: "kept" | "replaced", stay: [names] })`);
    else if (l !== null && !e.test) out.push(`${REPLACEABLE}: ${where(e)} is not a test file, so the ledger can let nothing through for it (ledger must be null)`);
  }

  // 1. The milestone table: the same files in the same milestones, in the same words.
  const numbers = new Set(table.milestones.map((m) => m.milestone));
  for (const e of entries) if (!numbers.has(e.milestone)) out.push(`${REPLACEABLE} lists ${where(e)}, and ${MILESTONES} has no milestone ${e.milestone}`);
  for (const m of table.milestones) {
    const theirs = Array.isArray(m.replaceable) ? m.replaceable : [];
    const ours = entries.filter((e) => e.milestone === m.milestone);
    for (const t of theirs) {
      const o = ours.find((e) => e.file === t.file);
      if (!o) { out.push(`${MILESTONES} lets milestone ${m.milestone} replace ${t.file}, and ${REPLACEABLE} does not list it there`); continue; }
      for (const field of ['scope', 'condition', 'test']) {
        if (o[field] !== t[field]) out.push(`${where(o)}: "${field}" is not the same in ${REPLACEABLE} and ${MILESTONES}`);
      }
    }
    for (const o of ours) if (!theirs.some((t) => t.file === o.file)) out.push(`${REPLACEABLE} lists ${where(o)}, and ${MILESTONES} does not let milestone ${m.milestone} replace it`);
  }

  // 2. The sentence of plan file 19, section 1.
  const s = sentenceOf(text19);
  if (!s) return [...out, `the sentence that starts "${START}" was not found whole in ${FILE_19}: the list of replaceable tests cannot be compared with it`];
  const items = [];
  for (const piece of s.may.split(';').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(.*)\((\d+)\)\.?$/s.exec(piece);
    if (!m) { out.push(`${FILE_19}: "${piece}" does not end with its milestone in brackets`); continue; }
    items.push({ text: m[1].trim(), milestone: Number(m[2]), used: false });
  }
  for (const e of entries) {
    const own = items.filter((i) => i.milestone === e.milestone && i.text.includes(e.named));
    if (!own.length) { out.push(`${REPLACEABLE} lists ${where(e)} as "${e.named}", and the sentence in ${FILE_19} names no such thing for milestone ${e.milestone}`); continue; }
    for (const i of own) i.used = true;
    // The words that name it must lead to the file: its path, its file name, or words beside which section 1 gives the path.
    const isFile = e.named === e.file || e.named === basename(e.file);
    if (!isFile && (e.named.match(FILE_WORD) || !s.flat.includes(e.file))) out.push(`${REPLACEABLE}: "${e.named}" does not name ${e.file} (it is not its path or its file name, and ${FILE_19} does not give that path)`);
  }
  for (const i of items) {
    if (!i.used) out.push(`the sentence in ${FILE_19} lets milestone ${i.milestone} replace "${i.text}", and ${REPLACEABLE} lists nothing for it`);
    for (const word of i.text.match(FILE_WORD) ?? []) {
      const known = entries.some((e) => e.milestone === i.milestone && (e.file === word || (!word.includes('/') && basename(e.file) === word)));
      if (!known) out.push(`the sentence in ${FILE_19} names ${word} for milestone ${i.milestone}, and ${REPLACEABLE} does not list it there`);
    }
  }
  const inOrder = (numbers) => [...new Set(numbers)].sort((a, b) => a - b).join(', ');
  const inSentence = inOrder(items.map((i) => i.milestone));
  const inMine = inOrder(entries.map((e) => e.milestone));
  const inTable = inOrder(table.milestones.filter((m) => (m.replaceable ?? []).length).map((m) => m.milestone));
  if (inSentence !== inMine || inMine !== inTable) out.push(`the milestones that may replace a test are not the same in three places: the sentence in ${FILE_19} says ${inSentence || 'none'}, ${REPLACEABLE} says ${inMine || 'none'}, ${MILESTONES} says ${inTable || 'none'}`);

  // 3. "Never replaced": the same names in the sentence and in the file, and nothing on the list above is one of them.
  const never = mine.never;
  const lists = [never?.under, never?.tests, never?.checks];
  if (lists.some((l) => !Array.isArray(l) || l.some((n) => typeof n !== 'string' || !n))) out.push(`${REPLACEABLE} has no "never" list (never: { under: [folders], tests: [names], checks: [subjects] })`);
  else {
    const pieces = (text) => text.split(/[;,]/).map((w) => w.trim()).filter(Boolean);
    const said = pieces(s.never.replace(/\.$/, '')).map((w) => w.replace(/^anything under /, ''));
    const held = [...never.under, ...never.tests, ...never.checks.flatMap(pieces)];
    for (const name of held) if (!said.includes(name)) out.push(`${REPLACEABLE} says "${name}" is never replaced, and the sentence in ${FILE_19} does not`);
    for (const name of said) if (!held.includes(name)) out.push(`the sentence in ${FILE_19} says "${name}" is never replaced, and ${REPLACEABLE} does not`);
    for (const e of entries) {
      const why = neverReplaced(e.file, never);
      if (why) out.push(`${REPLACEABLE} lists ${where(e)}, which is never replaced (${why})`);
    }
  }

  // 4. CLAUDE.md's entry is the binding copy: it holds the same sentence, word for word.
  const c = sentenceOf(claude);
  if (!c) out.push(`the sentence that starts "${START}" was not found whole in ${CLAUDE}`);
  else if (c.whole !== s.whole) out.push(`the sentence that starts "${START}" is not the same in ${CLAUDE} and in ${FILE_19}`);

  return out.length ? [`the list of tests that may be replaced is not the same in ${REPLACEABLE}, ${MILESTONES} and ${FILE_19} (${plural(out.length, 'difference')})`, ...out.map((line) => `  ${line}`), 'Which tests may be replaced is Brian\'s list (plan file 19, section 1, question 10): change it in all three places, with his words, or in none.'] : [];
}

/** Why a file is on the "never replaced" list, in words, or '' when it is not. */
export function neverReplaced(file, never) {
  const folder = (never?.under ?? []).find((dir) => file === dir || file.startsWith(`${dir}/`));
  if (folder) return `it is under ${folder}`;
  const name = (never?.tests ?? []).find((n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.test\\.tsx?$`).test(basename(file)));
  return name ? `${name} is named` : '';
}

/** Everything `--write` pins, as the text of fences.json. */
function pinsText(root) {
  return `${JSON.stringify({ about: ABOUT, files: fencedNow(root), savedKeys: savedKeysNow(root) }, null, 2)}\n`;
}

/** What changed between two versions of the pins, as sentences for a person. `was` null: there were none. */
function pinChanges(was, now) {
  if (!was) return [`${PINS} is new: it pins ${plural(Object.keys(now.files).length, 'fenced file')} and ${plural(now.savedKeys.length, 'saved key')}.`];
  const f = fileDifferences(was.files, now.files), k = keyDifferences(was.savedKeys, now.savedKeys);
  const show = (keys) => keys.map((key) => `${KEY_PREFIX}${key}`);
  const out = [];
  if (f.changed.length) out.push(`${PINS}: ${plural(f.changed.length, 'fenced file')} pinned again, so changed on purpose: ${some(f.changed, 40)}.`);
  if (f.added.length) out.push(`${PINS}: ${plural(f.added.length, 'file')} newly pinned, so added inside the fences: ${some(f.added, 40)}.`);
  if (f.deleted.length) out.push(`${PINS}: ${plural(f.deleted.length, 'file')} no longer pinned, so deleted from inside the fences: ${some(f.deleted, 40)}.`);
  if (k.added.length) out.push(`${PINS}: ${plural(k.added.length, 'saved key')} added to the pinned list: ${show(k.added).join(', ')}. A saved key is a promise to players.`);
  if (k.gone.length) out.push(`${PINS}: ${plural(k.gone.length, 'saved key')} taken off the pinned list: ${show(k.gone).join(', ')}. A saved key is a promise to players.`);
  return out;
}

/** The kit audit's budgets and the number of its allowances: the numbers a later milestone may not raise. */
function auditNumbers(root) {
  const budget = JSON.parse(readFileSync(join(root, BUDGET), 'utf8'));
  const allow = JSON.parse(readFileSync(join(root, ALLOW), 'utf8'));
  const kinds = budget && typeof budget === 'object' && !Array.isArray(budget) ? Object.keys(budget).sort() : [];
  if (!kinds.length || kinds.some((k) => typeof budget[k] !== 'number' || !Number.isFinite(budget[k]))) throw new Error(`${BUDGET} is not an object of numbers`);
  if (!Array.isArray(allow)) throw new Error(`${ALLOW} is not a list`);
  return { auditBudget: Object.fromEntries(kinds.map((k) => [k, budget[k]])), auditAllow: allow.length };
}

export async function run(ctx) {
  const problems = [];
  const lines = [];
  const decisions = [];
  const data = {};
  const attempt = (what, fn) => {
    try { return fn(); } catch (e) { problems.push(`${what}: ${String(e?.message ?? e).split('\n')[0]}`); return null; }
  };

  // The pins are read once here: with none to read, the two checks that compare with them have nothing to say.
  const pins = attempt('the pins', () => readPins(ctx.root));
  const files = pins ? attempt('the fenced files', () => fileProblems(ctx.root)) : null;
  const keys = pins ? attempt('the saved keys', () => keyProblems(ctx.root)) : null;
  const list = attempt('the replaceable tests', () => replaceableProblems(ctx.root));
  for (const found of [files, keys, list]) if (found?.length) { problems.push(found[0]); lines.push(...found); }

  if (pins) {
    data.files = Object.keys(pins.files).length;
    data.savedKeys = pins.savedKeys.length;
    if (files && !files.length) lines.push(`${plural(data.files, 'fenced file')} as pinned: nothing changed, appeared or went`);
    if (keys && !keys.length) lines.push(`${plural(data.savedKeys, 'saved key')}, the pinned set`);
    // What this branch did to the pins, for Brian. The runner prints the file's diff; this says what the diff means.
    const shown = await ctx.sh(`git show ${ctx.base}:${PINS}`);
    const was = shown.code === 0 ? attempt(`${PINS} at the base`, () => pinsOf(JSON.parse(shown.stdout))) : null;
    if (shown.code !== 0 || was) {
      const changes = pinChanges(was, pins);
      decisions.push(...changes);
      data.pinChanges = changes;
    }
  }
  if (list && !list.length) {
    const entries = JSON.parse(readFileSync(join(ctx.root, REPLACEABLE), 'utf8')).replaceable;
    data.replaceable = entries.map((e) => ({ milestone: e.milestone, file: e.file }));
    lines.push(`${plural(entries.length, 'replaceable file')} in ${plural(new Set(entries.map((e) => e.milestone)).size, 'milestone')}: ${REPLACEABLE}, ${MILESTONES}, ${FILE_19} and ${CLAUDE} agree`);
  }

  const measured = attempt('the kit audit\'s budgets', () => auditNumbers(ctx.root));
  if (measured) {
    data.audit = measured;
    lines.push(`kit audit budgets (${BUDGET}): ${Object.entries(measured.auditBudget).map(([k, v]) => `${k} ${v}`).join(', ')}; allowances (${ALLOW}): ${measured.auditAllow}`);
  }

  return {
    ok: problems.length === 0,
    summary: problems.length ? problems.join('; ') : `${plural(data.files ?? 0, 'fenced file')} and ${plural(data.savedKeys ?? 0, 'saved key')} as pinned; the replaceable list agrees in three places`,
    lines,
    data,
    measured: measured ?? undefined,
    decisions,
    human: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Run directly
// ---------------------------------------------------------------------------------------------------------------------

function main(argv) {
  const say = (line = '') => process.stdout.write(`${line}\n`);
  const unknown = argv.filter((a) => a !== '--write' && a !== '--help' && a !== '-h');
  if (unknown.length || argv.includes('--help') || argv.includes('-h')) {
    say('node tools/gate/fences.mjs            check the fenced files, the saved keys and the replaceable list; exit 1 if anything differs');
    say('node tools/gate/fences.mjs --write    pin the fenced files and saved keys that are there now, in src/skin/__tests__/fences.json');
    return unknown.length ? 64 : 0;
  }
  if (argv.includes('--write')) {
    let was = null;
    try { was = readPins(ROOT); } catch { /* none yet, or not readable: everything is new */ }
    const text = pinsText(ROOT);
    writeFileSync(join(ROOT, PINS), text);
    const now = pinsOf(JSON.parse(text));
    const changes = pinChanges(was, now);
    say(`${PINS}: ${plural(Object.keys(now.files).length, 'fenced file')} and ${plural(now.savedKeys.length, 'saved key')} pinned.`);
    if (was && !changes.length) say('Nothing differed from what was pinned.');
    for (const line of was ? changes : []) say(line);
    if (was && changes.length) say('Say this change in the pull request: the gate prints it as a decision for Brian.');
    return 0;
  }
  let failed = false;
  for (const [what, fn] of [['fenced files', fileProblems], ['saved keys', keyProblems], ['replaceable tests', replaceableProblems]]) {
    let found;
    try { found = fn(ROOT); } catch (e) { found = [String(e?.message ?? e)]; }
    if (found.length) { failed = true; say(`FAIL  ${what}`); for (const line of found) say(`  ${line}`); }
    else say(`PASS  ${what}`);
  }
  return failed ? 1 : 0;
}

const direct = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (direct) process.exitCode = main(process.argv.slice(2));
