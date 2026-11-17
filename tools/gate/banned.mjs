// Gate module: banned returns (plan file 19, section 4). Things Brian took out of the game, or said never to put in,
// that a careless rebuild would bring back. Every row of that table is here, with its scope and its kind:
//
//   added        no line this branch added may match: the lines `git diff -U0 <base>...HEAD` adds, and, so that a
//                part run on an unfinished tree says the same, the lines changed or new and not yet committed;
//   count        the total in the scope may not rise. Handed in as a number, so the ratchet in RATCHETS.json holds it;
//   count 0      the total must be none (and it is handed in too, so the store shows it);
//   must exist   the match must still be there.
//
// A row's scope leaves out `__tests__` folders unless the row says otherwise (row 15 looks everywhere in its scope:
// those names may appear nowhere; row 16 looks only at tests).
//
// Rows 13 and 17 are "count 0 from milestone 1". Until then they are counted and held by the ratchet. They must be
// none in milestone 1's own report run (--milestone 1), and in every run of a later milestone. A --baseline run judges
// the tree as the milestone before left it, and milestone 1's --quick runs are still on the way there: both hold the
// count by the ratchet and say how many are left.
//
// Row 15's seven names are kept encoded and are never printed: a match is reported by file, line and number only.
//
// Two more counts are handed in for other plan files: the middle dots of row 6 (file 16, section 4.1 f) and the
// distinct colours among the colour literals of the skin's stylesheets (file 13, section 4: "the count may only fall").
//
// Changing this file changes what the gate refuses: it is under tools/gate/**, so every change is printed as a
// decision for Brian.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listed } from './fences.mjs';

export const id = 'banned';
export const modes = ['quick', 'milestone', 'baseline'];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inTests = (file) => file.split('/').includes('__tests__');
const under = (dir) => (file) => file.startsWith(`${dir}/`);
const MIDDLE_DOT = String.fromCharCode(0xb7);

/** Row 15: three names CLAUDE.md's hard rules ban and four game titles the old plan cited, base64, lower case. */
const NAMES = ['Z2hpYmxp', 'bWl5YXpha2k=', 'dG90b3Jv', 'Y3Jvc3N5IHJvYWQ=', 'dG93bnNjYXBlcg==', 'YSBzaG9ydCBoaWtl', 'bWluZWNyYWZ0'];
/** One pattern a name: any case; the words of a title may be run together or parted by spaces, hyphens or underscores. */
const NAME_PATTERNS = NAMES.map((code) => {
  const words = Buffer.from(code, 'base64').toString('utf8').split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(words.length > 1 ? `(?<![a-z])${words.join('[\\s_-]*')}(?![a-z])` : words[0], 'gi');
});

/** The Home menu's rows (row 7): the ids of 2026-11-14's menu, plus the one-night repair row. */
const MENU_IDS = ['queue', 'lobby', 'join', 'dream', 'repair', 'practice', 'tutorial', 'bazaar', 'boards'];
/** Every state of the animal rig (row 18), as `SheepState` lists them at the base. */
const SHEEP_STATES = ['idle', 'proud', 'happy', 'startled', 'cold', 'dazed', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing', 'thinking', 'run', 'jump', 'bonk', 'land', 'walk', 'flop', 'perch', 'lounge'];
const HEADS = ['chicken', 'cow', 'goat', 'horse', 'pig', 'sheep'];

/**
 * The rows that are a pattern in a scope. `key` is the number's name in RATCHETS.json; `kinds` holds 'added',
 * 'count', 'zero' (count 0) and 'zeroFrom1' (count 0 from milestone 1). `today` is the plan's own figure, in the
 * plan's words. `secret` rows never have their matches printed.
 */
const ROWS = [
  { row: 1, key: 'row01_kitPinCork', what: 'kit-pin, kit-cork (paper held up by pins, the cork board)', pattern: /kit-pin|kit-cork/g, scope: 'src/skin', paths: ['src/skin'], kinds: ['added', 'zero'], today: '0' },
  { row: 2, key: 'row02_leverRopeSlider', what: 'export function Lever, RopeSlider (the lever and the rope slider)', pattern: /export function Lever\b|RopeSlider/g, scope: 'src/skin/kit', paths: ['src/skin/kit'], kinds: ['zero'], today: '0' },
  { row: 3, key: 'row03_hangNails', what: 'hang="nails" (fake fasteners)', pattern: /hang="nails"/g, scope: 'src/skin/**/*.tsx', paths: ['src/skin'], only: (f) => f.endsWith('.tsx'), kinds: ['count'], today: '3 (two in KitPreview.tsx, one in shop/FeedSacks.tsx)' },
  { row: 3, key: 'row03_skNail', what: 'sk-nail (fake fasteners)', pattern: /sk-nail/g, scope: 'src/skin/**/*.tsx', paths: ['src/skin'], only: (f) => f.endsWith('.tsx'), kinds: ['count'], today: '26' },
  { row: 5, key: 'row05_steal', what: 'steal, steals, stealing, stealer(s), but in the repo\'s own name', pattern: /\b[Ss]teal(?:s|ing|er|ers)?\b(?!-a-poop| a Poop)/g, scope: 'src/skin', paths: ['src/skin'], kinds: ['added', 'count'], today: '4 (KitPreview.tsx, kit.css)' },
  { row: 6, key: 'row06_middleDots', what: 'the middle dot (U+00B7)', pattern: new RegExp(MIDDLE_DOT, 'g'), scope: 'src/skin/**/*.{ts,tsx}', paths: ['src/skin'], only: (f) => /\.tsx?$/.test(f), kinds: ['added', 'count'], today: '52 in 18 files' },
  { row: 8, key: 'row08_pcfSoftShadowMap', what: 'PCFSoftShadowMap', pattern: /PCFSoftShadowMap/g, scope: 'src', paths: ['src'], kinds: ['zero'], today: '0' },
  { row: 9, key: 'row09_standardMaterials', what: 'MeshStandardMaterial, MeshPhysicalMaterial, envMap', pattern: /MeshStandardMaterial|MeshPhysicalMaterial|envMap/g, scope: 'src/skin except table/Wendigo.tsx', paths: ['src/skin'], only: (f) => f !== 'src/skin/table/Wendigo.tsx', kinds: ['zero'], today: '0' },
  // Written with a colon (an option) or set with an equals sign; a 1 alone is the only value let through. (The
  // `(?!\s)` keeps the pattern from stepping back over the space before the value.)
  { row: 10, key: 'row10_exposure', what: 'toneMappingExposure with a value other than 1', pattern: /toneMappingExposure\s*(?::|=(?!=))\s*(?!\s)(?!1(?![\d.]))/g, scope: 'src/skin except loading/DoorsRender.tsx', paths: ['src/skin'], only: (f) => f !== 'src/skin/loading/DoorsRender.tsx', kinds: ['zero'], today: '0' },
  { row: 12, key: 'row12_stakes', what: 'stakeGeometry, stakeVoxels anywhere but voxel/props.ts', pattern: /stakeGeometry|stakeVoxels/g, scope: 'src/skin except voxel/props.ts', paths: ['src/skin'], only: (f) => f !== 'src/skin/voxel/props.ts', kinds: ['zero'], today: '0' },
  { row: 13, key: 'row13_googleFonts', what: 'fonts.googleapis, fonts.gstatic, DotGothic16', pattern: /fonts\.googleapis|fonts\.gstatic|DotGothic16/g, scope: 'src, vite.config.ts', paths: ['src', 'vite.config.ts'], kinds: ['count', 'zeroFrom1'], today: '2 lines in src (PaintedApp.tsx, components/PaintedCredits.tsx), 2 in vite.config.ts' },
  { row: 14, key: 'row14_wordOfDayClicks', what: 'onClick, <button, kit-paper in the Word of the day', pattern: /onClick|<button|kit-paper/g, scope: 'src/skin/wotd/WordOfDay.tsx', paths: ['src/skin/wotd/WordOfDay.tsx'], kinds: ['zero'], today: '0' },
  { row: 15, key: 'row15_names', what: 'the seven names CLAUDE.md and the plan keep out (kept encoded, never printed)', patterns: NAME_PATTERNS, secret: true, tests: true, names: true, scope: 'src/skin, docs/visual-overhaul (tests and file names too)', paths: ['src/skin', 'docs/visual-overhaul'], kinds: ['zero'], today: '0' },
  { row: 16, key: null, what: 'it.skip, describe.skip, it.todo, test.skip (and test.todo, describe.todo)', pattern: /\b(?:it|test|describe)\.(?:skip|todo)\b/g, tests: 'only', scope: 'src/**/__tests__', paths: ['src'], kinds: ['added'], today: 'n/a' },
  { row: 17, key: 'row17_testFail', what: 'test.fail( (a fault case still marked as expected to fail)', pattern: /\btest\.fail\s*\(/g, tests: true, scope: 'e2e-painted', paths: ['e2e-painted'], kinds: ['count', 'zeroFrom1'], today: 'n/a' },
];

/** True when `file` is in a row's scope. */
function inScope(row, file) {
  if (!row.paths.some((p) => file === p || file.startsWith(`${p}/`))) return false;
  if (row.tests === 'only' ? !inTests(file) : !row.tests && inTests(file)) return false;
  return row.only ? row.only(file) : true;
}

const patternsOf = (row) => row.patterns ?? [row.pattern];

/** Every match of a row in a text, as [{ line, which }] (which: the pattern's number, from 1). */
function matchesIn(row, text) {
  const out = [];
  patternsOf(row).forEach((pattern, i) => {
    for (const m of text.matchAll(pattern)) out.push({ line: text.slice(0, m.index).split('\n').length, which: i + 1 });
  });
  return out.sort((a, b) => a.line - b.line || a.which - b.which);
}

/** `file:line`, with the pattern's number for a row that has several secret ones. Never the text that matched. */
const place = (row, file, m) => `${file}:${m.line}${row.secret ? ` (name ${m.which} of ${patternsOf(row).length})` : ''}`;

/** Parses `git diff -U0`: the lines it adds, as [{ file, line, text }]. */
function addedByDiff(text) {
  const out = [];
  let file = null, line = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) { file = raw.startsWith('+++ b/') ? raw.slice(6).replace(/\t$/, '') : null; continue; }
    if (raw.startsWith('diff --git ') || raw.startsWith('--- ')) { if (raw.startsWith('diff --git ')) file = null; continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (file !== null && raw.startsWith('+')) out.push({ file, line: line++, text: raw.slice(1) });
  }
  return out;
}

/**
 * Every line this branch added under `src`: committed since the base, changed and not committed, or in a new file
 * git does not know yet. Returns { lines: [{ file, line, text, how }], problem }.
 */
async function addedLines(ctx) {
  const lines = [];
  const diff = 'git -c core.quotePath=false diff -U0 --no-color --no-ext-diff -M';
  const committed = await ctx.sh(`${diff} ${ctx.base}...${ctx.head} -- src`);
  if (committed.code !== 0) return { lines, problem: `git diff ${ctx.base.slice(0, 7)}...HEAD failed: ${committed.stderr.trim().split('\n')[0]}` };
  for (const l of addedByDiff(committed.stdout)) lines.push({ ...l, how: 'committed' });
  const loose = await ctx.sh(`${diff} ${ctx.head} -- src`);
  if (loose.code !== 0) return { lines, problem: `git diff HEAD failed: ${loose.stderr.trim().split('\n')[0]}` };
  for (const l of addedByDiff(loose.stdout)) lines.push({ ...l, how: 'not committed' });
  const fresh = await ctx.sh('git -c core.quotePath=false ls-files -z --others --exclude-standard -- src');
  if (fresh.code !== 0) return { lines, problem: `git ls-files failed: ${fresh.stderr.trim().split('\n')[0]}` };
  for (const file of fresh.stdout.split('\0').filter(Boolean)) {
    let text;
    try { text = readFileSync(join(ctx.root, file), 'utf8'); } catch { continue; }
    text.split('\n').forEach((t, i) => lines.push({ file, line: i + 1, text: t, how: 'a new file, not committed' }));
  }
  return { lines, problem: null };
}

/** Row 4: how many of `pin`, `tilt`, `seed` the Paper component takes. Null when Paper could not be found. */
function paperProps(text) {
  const from = text.indexOf('export function Paper(');
  const to = from < 0 ? -1 : text.indexOf(') {', from);
  if (to < 0) return null;
  return (text.slice(from, to).match(/\b(?:pin|tilt|seed)\b/g) ?? []).length;
}

/** Row 7: the menu ids in `items` of PaintedHome.tsx that are not on the list. Null when `items` could not be found. */
function strangeMenuIds(text) {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => /^\s*const items: MenuItem\[\] = \[\s*$/.test(l));
  if (from < 0) return null;
  const indent = /^\s*/.exec(lines[from])[0];
  const to = lines.findIndex((l, i) => i > from && l === `${indent}];`);
  if (to < 0) return null;
  const out = [];
  let found = 0;
  for (let i = from; i <= to; i++) {
    for (const m of lines[i].matchAll(/\bid:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?/g)) {
      found++;
      const id = m[1] ?? m[2] ?? m[3];
      if (id === undefined || !MENU_IDS.includes(id)) out.push({ line: i + 1, id: id ?? '(not a plain string)' });
    }
  }
  return found ? out : null;
}

/** Row 11: every `<Bomb` of BarnTable.tsx and whether it says red={false}. */
function barnBombs(text) {
  const out = [];
  for (const m of text.matchAll(/<Bomb(?![A-Za-z0-9_])/g)) {
    const end = text.indexOf('/>', m.index);
    const tag = text.slice(m.index, end < 0 ? m.index + 3000 : Math.min(end, m.index + 3000));
    out.push({ line: text.slice(0, m.index).split('\n').length, plain: tag.includes('red={false}') });
  }
  return out;
}

/** Row 18: each thing that must still be there, as { what, file, ok(text) }. */
const MUST_EXIST = [
  { what: 'kit-float-need (what the word needs, over the floating letters)', file: 'src/skin/components/InputStrip.tsx', ok: (t) => t.includes('kit-float-need') },
  { what: 'export const ROUNDED_VOXELS (the rounded corners stay a switch)', file: 'src/skin/voxel/rounded.ts', ok: (t) => /export const ROUNDED_VOXELS\b/.test(t) },
  { what: 'const SPIN_MS = 3800 (the fair machine\'s spin)', file: 'src/skin/shop/FeedSacks.tsx', ok: (t) => /\bconst SPIN_MS = 3800\b/.test(t) },
  { what: 'export const NEAR_MISS = 0.15 (the quiet near miss)', file: 'src/skin/shop/FeedSacks.tsx', ok: (t) => /export const NEAR_MISS = 0\.15(?!\d)/.test(t) },
  { what: 'export function Switch', file: 'src/skin/kit/index.tsx', ok: (t) => /export function Switch\b/.test(t) },
  { what: 'export function Slider', file: 'src/skin/kit/index.tsx', ok: (t) => /export function Slider\b/.test(t) },
  ...HEADS.map((animal) => ({ what: `the import of assets/heads/${animal}.png (Brian's own pixel heads)`, file: 'src/skin/avatars/AvatarIcon.tsx', ok: (t) => new RegExp(`^import \\w+ from '[./]*assets/heads/${animal}\\.png';`, 'm').test(t) })),
  ...SHEEP_STATES.map((state) => ({ what: `'${state}' in SheepState`, file: 'src/skin/table/Sheep.tsx', ok: (t) => sheepStates(t).includes(`'${state}'`) })),
];

/**
 * The text that lists the states of `SheepState`: the type's own union, or, where the type is read off a list
 * (`(typeof ALL_STATES)[number]`), that list.
 */
function sheepStates(text) {
  const type = /export type SheepState =([^;]*);/.exec(text)?.[1] ?? '';
  return /\bALL_STATES\b/.test(type) ? /export const ALL_STATES\b[^=]*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '' : type;
}

/** The colour literals of a stylesheet: hex (3, 4, 6 or 8 digits), rgb() and rgba(). */
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|rgba?\(([^)]*)\)/g;

/** The distinct colour literals in a set of stylesheets, two ways: as written, and as colours with the alpha left out. */
function cssColours(texts) {
  const literals = new Set(), colours = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(COLOUR)) {
      const written = m[0].toLowerCase().replace(/\s+/g, '');
      literals.add(written);
      if (written.startsWith('#')) {
        const digits = written.length <= 5 ? [...written.slice(1)].map((c) => c + c).join('') : written.slice(1);
        colours.add(digits.slice(0, 6));
      } else {
        const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
        const numbers = parts.map((p) => (p.endsWith('%') ? Math.round(Number(p.slice(0, -1)) * 2.55) : Math.round(Number(p))));
        // Three plain numbers are a colour; anything else (a variable, say) is kept as it is written.
        colours.add(numbers.length === 3 && numbers.every((n) => Number.isFinite(n)) ? numbers.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('') : written);
      }
    }
  }
  return { literals: literals.size, colours: colours.size };
}

export async function run(ctx) {
  const problems = [];
  const lines = [];
  const measured = {};
  const rows = [];
  const texts = new Map();
  const read = (file) => {
    if (!texts.has(file)) { try { texts.set(file, readFileSync(join(ctx.root, file), 'utf8')); } catch { texts.set(file, null); } }
    return texts.get(file);
  };

  // What must be none from milestone 1: in milestone 1's own report run, and in every run of a later milestone.
  // A --baseline run looks at the tree the milestone before left.
  const milestone = ctx.milestone ?? null;
  const reached = milestone === null ? null : ctx.mode === 'baseline' ? milestone - 1 : milestone;
  const noneFrom1 = reached !== null && (reached >= 2 || (reached === 1 && ctx.mode !== 'quick'));

  let files;
  try { files = listed(ctx.root, ['src', 'vite.config.ts', 'docs/visual-overhaul', 'e2e-painted']); } catch (e) {
    return { ok: false, summary: `NOT RUN: ${String(e?.message ?? e).split('\n')[0]}`, lines: [], data: {} };
  }
  const added = await addedLines(ctx);
  if (added.problem) return { ok: false, summary: `NOT RUN: the lines this branch added could not be listed (${added.problem})`, lines: [], data: {} };

  // Failures first, then every row in the table's order.
  const failures = [];
  const said = [];
  const fail = (row, text) => { problems.push(`row ${row}`); failures.push({ row, text: `FAIL row ${row}: ${text}` }); };
  const say = (row, text) => said.push({ row, text });

  for (const row of ROWS) {
    const entry = { row: row.row, what: row.what, scope: row.scope, kinds: row.kinds, today: row.today };
    rows.push(entry);
    const scoped = files.filter((f) => inScope(row, f));

    if (row.kinds.some((k) => k !== 'added')) {
      const per = [];
      let total = 0;
      for (const file of scoped) {
        const text = read(file);
        const found = text === null ? [] : matchesIn(row, text);
        // A banned name in a file's own name counts as a match on line 0.
        if (row.names) patternsOf(row).forEach((pattern, i) => { if (file.match(pattern)) found.unshift({ line: 0, which: i + 1 }); });
        if (found.length) { per.push({ file, found }); total += found.length; }
      }
      entry.count = total;
      entry.files = Object.fromEntries(per.map((p) => [p.file, p.found.length]));
      measured[row.key] = total;
      const where = per.flatMap((p) => p.found.map((m) => place(row, p.file, m)));
      const shown = where.length > 12 ? `${where.slice(0, 12).join(', ')} and ${where.length - 12} more` : where.join(', ');
      const mustBeNone = row.kinds.includes('zero') || (row.kinds.includes('zeroFrom1') && noneFrom1);
      if (mustBeNone && total > 0) fail(row.row, `${row.what}: ${plural(total, 'match', 'matches')} in ${row.scope}, and there may be none${row.kinds.includes('zeroFrom1') ? ' from milestone 1' : ''}: ${shown}`);
      const perFile = per.map((p) => `${p.file} ${p.found.length}`).join(', ');
      const waiting = row.kinds.includes('zeroFrom1') && !noneFrom1 ? `; must be none when milestone 1 ends${total ? `: ${total} left` : ''}` : '';
      say(row.row, `row ${row.row}, ${row.what}: ${total} in ${row.scope}${per.length > 1 ? ` (${plural(per.length, 'file')})` : ''}${row.secret || !total ? '' : `: ${perFile}`} [${row.kinds.includes('zero') ? 'count 0' : mustBeNone ? 'count 0 from milestone 1' : `may not rise${waiting}`}; the plan's today: ${row.today}]`);
    }

    if (row.kinds.includes('added')) {
      const hits = [];
      for (const l of added.lines) {
        if (!inScope(row, l.file)) continue;
        if (patternsOf(row).some((pattern) => { pattern.lastIndex = 0; return pattern.test(l.text); })) hits.push(`${l.file}:${l.line} (${l.how})`);
      }
      for (const pattern of patternsOf(row)) pattern.lastIndex = 0;
      entry.added = hits;
      if (hits.length) fail(row.row, `${row.what}: ${plural(hits.length, 'added line')} ${hits.length === 1 ? 'matches' : 'match'}, and no new line may: ${hits.slice(0, 12).join(', ')}${hits.length > 12 ? ` and ${hits.length - 12} more` : ''}`);
      else if (!row.kinds.some((k) => k !== 'added')) say(row.row, `row ${row.row}, ${row.what}: no added line in ${row.scope} matches [added 0]`);
    }
  }

  // Row 4: the props Paper lost with the pins.
  {
    const file = 'src/skin/kit/index.tsx';
    const text = read(file);
    const n = text === null ? null : paperProps(text);
    rows.push({ row: 4, what: 'pin, tilt or seed props on Paper', scope: file, kinds: ['zero'], today: '0', count: n });
    if (n === null) fail(4, `the Paper component could not be found in ${file}, so its props cannot be checked`);
    else {
      measured.row04_paperProps = n;
      if (n > 0) fail(4, `Paper in ${file} takes ${plural(n, 'prop')} of pin, tilt, seed, and it may take none (plain cards, 2026-11-13)`);
      say(4, `row 4, pin, tilt or seed props on Paper: ${n} in ${file} [count 0; the plan's today: 0]`);
    }
  }

  // Row 7: the Home menu's rows.
  {
    const file = 'src/skin/screens/PaintedHome.tsx';
    const text = read(file);
    const strange = text === null ? null : strangeMenuIds(text);
    rows.push({ row: 7, what: 'a menu id outside the nine of the Home menu', scope: file, kinds: ['zero'], today: '0', count: strange?.length ?? null });
    if (strange === null) fail(7, `the menu's items could not be found in ${file}, so its rows cannot be checked`);
    else {
      measured.row07_menuIds = strange.length;
      if (strange.length) fail(7, `${file} has ${plural(strange.length, 'menu id')} outside {${MENU_IDS.join(', ')}}: ${strange.map((s) => `"${s.id}" at line ${s.line}`).join(', ')} (a new menu row is Brian's to ask for)`);
      say(7, `row 7, a menu id outside {${MENU_IDS.join(', ')}}: ${strange.length} in ${file} [count 0; the plan's today: 0]`);
    }
  }

  // Row 11: the barn's bomb is never the red one.
  {
    const file = 'src/skin/table/BarnTable.tsx';
    const text = read(file);
    const bombs = text === null ? [] : barnBombs(text);
    const red = bombs.filter((b) => !b.plain);
    rows.push({ row: 11, what: '<Bomb with red={false} at the barn', scope: file, kinds: ['must exist'], today: 'present', bombs: bombs.length, withoutRedFalse: red.length });
    if (!bombs.length) fail(11, `no <Bomb is left in ${file}: the barn's bomb, with red={false}, must still be there`);
    else if (red.length) fail(11, `${file} has a <Bomb without red={false} at line ${red.map((b) => b.line).join(', ')} ("keep the bomb icy": the barn's cue is the frost)`);
    else say(11, `row 11, <Bomb with red={false}: present in ${file} (${plural(bombs.length, 'bomb')}) [must exist]`);
  }

  // Row 18: what must still be there.
  {
    const gone = [];
    for (const item of MUST_EXIST) {
      const text = read(item.file);
      if (text === null || !item.ok(text)) gone.push(`${item.what} in ${item.file}`);
    }
    rows.push({ row: 18, what: 'what must still be there', scope: 'as named', kinds: ['must exist'], today: 'present', checked: MUST_EXIST.length, gone });
    if (gone.length) fail(18, `${plural(gone.length, 'thing')} that must still be there ${gone.length === 1 ? 'is' : 'are'} gone: ${gone.join('; ')}`);
    else say(18, `row 18, what must still be there: all ${MUST_EXIST.length} present (the floating letters' line, the rounded-corner switch, the fair machine's two numbers, Switch and Slider, the six heads, the ${SHEEP_STATES.length} states) [must exist]`);
  }

  // Row 13 in the plan's own unit, lines, so its figure can be read against this one.
  {
    const row = ROWS.find((r) => r.row === 13);
    const count = (scope) => files.filter((f) => inScope(row, f) && scope(f)).reduce((sum, f) => sum + new Set(matchesIn(row, read(f) ?? '').map((m) => m.line)).size, 0);
    say(13, `row 13 counted in lines, as the plan counts it: ${count(under('src'))} in src, ${count((f) => f === 'vite.config.ts')} in vite.config.ts`);
  }

  // For plan file 13: the distinct colour literals in the skin's stylesheets.
  {
    const sheets = files.filter((f) => f.startsWith('src/skin/') && f.endsWith('.css'));
    const c = cssColours(sheets.map((f) => read(f) ?? ''));
    measured.cssColours = c.colours;
    say(99, `distinct colours among the hex, rgb() and rgba() literals of src/skin/**/*.css (${plural(sheets.length, 'stylesheet')}): ${c.colours}, counted as the plan counted its 267: the alpha left out, and a hex and an rgb() of one colour counted once [may not rise]. As written there are ${c.literals} distinct literals`);
    rows.push({ row: 'file 13', what: 'distinct colours among the colour literals of the skin\'s stylesheets', scope: 'src/skin/**/*.css', kinds: ['count'], today: '267', count: c.colours, asWritten: c.literals });
  }

  const byRow = (a, b) => a.row - b.row;
  lines.push(...failures.sort(byRow).map((l) => l.text), ...said.sort(byRow).map((l) => l.text));
  const failed = [...new Set(problems)];
  return {
    ok: failed.length === 0,
    summary: failed.length ? `${plural(failed.length, 'row')} of plan file 19, section 4, did not hold: ${failed.join(', ')}` : `all 18 rows hold: nothing banned was added, no count rose, everything that must exist is there (${measured.row06_middleDots} middle dots, ${measured.row13_googleFonts} font-host matches, ${measured.row17_testFail} test.fail marks${noneFrom1 ? '' : ', the last two counted until milestone 1 ends'})`,
    lines,
    data: { rows, noneFromMilestone1: noneFrom1 },
    measured,
    decisions: [],
    human: [],
  };
}
