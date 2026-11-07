/**
 * Writes docs/skin/UI_AUDIT.md from the farm kit's audit (docs/REDESIGN_PLAN_V6_UI.md Part 3.2): every surface in the
 * painted skin, where it is, what it looks like now, what the audit finds in it, and the kit material it becomes.
 * Run from the repository root: `npx vite-node scripts/ui-audit-doc.ts`. Rerun at every milestone.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import allow from '../src/skin/audit/allow.json';
import budget from '../src/skin/audit/budget.json';
import { allowedBy, audit, KINDS, surfaces, tally } from '../src/skin/audit/uiAudit';
import type { AllowEntry, Finding, Kind } from '../src/skin/audit/uiAudit';

const findings = audit();
const { open, counts } = tally(findings, allow as AllowEntry[]);

/** Which material each surface becomes, from Part 3.2's inventory and Parts 4 to 6. First match wins. */
const BECOMES: [RegExp, string, string][] = [
  [/^sk-(wash|results-backdrop|garland|boom|door|jump|wordblast|word-burst)|^dr-backdrop/, 'kept: light and air, on the allow-list', '4.12'],
  [/^sk-menu-lantern/, 'kept: the lantern glow on the focused row, on the allow-list', '4.12'],
  [/^sk-(type-)?caret/, 'the amber pencil-tick caret', '6.3'],
  [/^sk-steal-flash|^sk-alarm-flash/, 'light (a screen-edge flash): to the allow-list or the kit in U3', '6.3'],
  [/^sk-menu-(row|caption)/, 'kept as type; any backing goes with the menu board in U2', '6.1'],
  [/^sk-home$/, 'the Home screen root: no surface of its own', '6.1'],
  [/^sk-letter-card/, 'removed; a `Slate mini` carries the seconds under the voxel board', '5.2'],
  [/^sk-think/, 'three pixel wool tufts, no disc', '5.3'],
  [/^sk-steal-(banner|call)/, 'deleted (unused)', '6.3'],
  [/^sk-update/, '`Board label tone=barn hang=nails snow`', '6.1'],
  [/^sk-plate/, '`Board label hang=nails` name plate, avatar in a `Peg light` frame', '6.1'],
  [/^sk-icon-chip/, '`Peg`', '4.8, 6.3'],
  [/^sk-icon-btn/, '`Peg` (the log-end recipe, kept; the Home override deleted)', '4.8, 6.1'],
  [/^sk-menu-primary/, 'kept as `Board painted tone=green`', '6.1'],
  [/^sk-menu-play-icon/, 'kept (the Play sign\'s triangle disc)', '6.1'],
  [/^sk-menu-item/, 'type over the wash; the focused row a `Patch tone=cream`', '6.1'],
  [/^sk-menu-board/, 'the menu backing: removed or a `Board panel`, settled in U2', '6.1'],
  [/^sk-menu-badge|^sk-soft-tag/, '`Paper tag` with a hole and string', '4.2, 6.1'],
  [/^sk-key/, '`Tile mini`', '4.3, 6.1'],
  [/^sk-(setup|sit)/, '`Clipboard`; Sit down and Start run as `Board painted tone=green` buttons', '6.1'],
  [/^sk-sheet/, '`Clipboard`', '6.2'],
  [/^sk-guide-(basic|faq|art)|^sk-rule-row|^sk-chain-list/, 'ruled `Paper sheet` rows; art in a pencil frame', '6.2'],
  [/^sk-guide/, '`Clipboard` with paper index tabs', '6.2'],
  [/^sk-mini-tile/, '`Tile mini`', '4.3, 6.2'],
  [/^sk-field/, 'a paper line (`Paper slip` with a ruled edge)', '6.2'],
  [/^sk-avatar-choice/, 'framed portraits (`Board light` frames on nails)', '6.2'],
  [/^sk-photo-face/, 'the admin photo in a `Peg light` frame', '6.2'],
  [/^classic-panel/, '`Panel` with a `Board heading` and a `Peg` close', '6.5'],
  [/^(tour-|coach-tip)/, '`Paper note` pinned (the tour cards and tips)', '6.3'],
  [/^sk-input-|^sk-type-tile/, 'the wooden trough with `Tile`s; Play as `Brass`, Steal as `Brass` on a `barn` board', '6.3'],
  [/^sk-notice/, 'kept, as `Board heading`', '4.1, 6.3'],
  [/^sk-alarm/, 'kept, as `Board alarm`', '4.1, 6.3'],
  [/^sk-tally/, '`Board panel hang=ropes` with a `Slate board` and `Slate plaque`s', '6.3, 6.4'],
  [/^sk-title-rope|^sk-rope/, '`.kit-rope`', '4.7'],
  [/^sk-title/, 'kept, as `Board title` and `Tile lg hung`', '6.1'],
  [/^sk-nail/, '`.kit-nail` (kept)', '4.1'],
  [/^sk-tile/, '`Tile`', '4.3'],
  [/^sk-paper|^sk-framed/, '`Paper`, or a `Clipboard` when it is a dialog', '4.2, 4.9'],
  [/^sk-chip/, '`Patch`', '4.5'],
  [/^sk-(btn|wood|cloth|coral)/, '`WoodButton` re-cut, `ClothButton` stitched, `CoralButton` retired for `Brass`', '4.8'],
  [/^dr-fence-tile/, '`Tile sm hung` on a rope', '5.4'],
  [/^dr-tag/, '`Paper slip`', '5.1'],
  [/^dr-night/, '`Knit` stitches', '4.6, 6.4'],
  [/^dr-card|^dr-quilt|^dr-card-quilt/, 'the results scene: `Board panel` hung from the bedroom beam, `Slate plaque`, `Knit`, folded quilts', '6.4'],
  [/^dr-btn/, '`Brass` (Share) and `WoodButton`', '4.8, 6.4'],
  [/^dr-board|^dr-bump/, 'kept as `Board heading`', '6.4'],
  [/^dr-burst/, 'light (the bump\'s burst): to the allow-list or the kit in U4', '6.4'],
  [/^dr-/, 'the dream HUD: `Patch`, `Slate plaque` and `Peg`', '6.4'],
];

function becomes(name: string): [string, string] {
  const hit = BECOMES.find(([re]) => re.test(name));
  return hit ? [hit[1], hit[2]] : ['to settle in U1 (no row in the plan\'s inventory)', '4'];
}

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== '__tests__' && n !== 'audit') tsxFiles(p, out); } else if (n.endsWith('.tsx')) out.push(p);
  }
  return out;
}
const sources = tsxFiles('src/skin').map((f) => ({ f: f.replace(/\\/g, '/'), src: readFileSync(f, 'utf8') }));

/** The components that use a class, and the screens they belong to. */
function where(name: string): string {
  const users = sources.filter(({ src }) => new RegExp(`['"\` ]${name.replace(/[-]/g, '\\-')}(?=['"\` }])`).test(src)).map(({ f }) => f.split('/').pop()!.replace('.tsx', ''));
  return users.length ? [...new Set(users)].slice(0, 4).join(', ') + (users.length > 4 ? ` +${users.length - 4}` : '') : 'CSS only (state or override)';
}

/** One line on what a surface looks like now, read from its own declarations. */
function now(values: Record<string, string>): string {
  const bits: string[] = [];
  const bg = values.background;
  if (bg) bits.push(/gradient\(/.test(bg) ? 'gradient fill' : /url\(/.test(bg) ? 'texture' : /transparent|none/.test(bg) ? 'no fill' : 'flat fill');
  const r = values['border-radius'];
  if (r) bits.push(/999|50%|9999/.test(r) ? 'pill or round' : /var\(--radius/.test(r) ? r.replace(/var\(--(radius-[\w-]+)\)/, '$1') : `${r.split(' ')[0]} corners`);
  if (values.border && !/^none|^0/.test(values.border)) bits.push('border');
  const s = values['box-shadow'];
  if (s && s !== 'none') bits.push(/0 0 0 /.test(s) && !/\d+px \d+px [1-9]/.test(s) ? 'ring' : /inset/.test(s) ? 'carved edge' : 'drop shadow');
  return bits.join(', ') || 'no surface of its own';
}

const findingsOf = (file: string, cls: string) => findings.filter((f) => f.file === file && new RegExp(`\\.${cls}(?![\\w-])`).test(f.selector));
const describe = (fs: Finding[]) => {
  if (!fs.length) return 'none';
  const parts = KINDS.map((k) => {
    const of = fs.filter((f) => f.kind === k);
    if (!of.length) return '';
    const allowed = of.filter((f) => allowedBy(f, allow as AllowEntry[])).length;
    return `${of.length} ${k}${allowed ? ` (${allowed} allowed)` : ''}`;
  }).filter(Boolean);
  return parts.join(', ');
};

const screenOf = (file: string) =>
  /dream\//.test(file) ? 'Counting Sheep' : /screens\/PaintedHome|TitleBoard|GameMenu|MenuTag/.test(file) ? 'Home' : /screens\/PaintedGame|table\//.test(file) ? 'Table' : 'shared';

const rows = surfaces().map((s) => {
  const [mat, part] = becomes(s.className);
  return `| \`.${s.className}\` | ${screenOf(s.file)}: ${where(s.className)} | ${now(s.values)} | ${describe(findingsOf(s.file, s.className))} | ${mat} | ${part} |`;
});

/** Surfaces drawn by components rather than a class rule of their own (Part 3.2's inventory, and what U0 found). */
const COMPONENTS: [string, string, string, string, string][] = [
  ['`PlayerCard`', 'Table: scoreboard column', 'paper cards, 200 px', 'the barn ledger, a `Slate board`', '6.3'],
  ['speaker `label` chips', 'Table: `PaintedGame`, beside each sheep', '`.sk-chip` pills by drei `Html`', 'name stakes with `Paper slip`s', '5.3'],
  ['`PaintedSettings` rows', 'Home: settings', '`rounded-xl` rows on `--paper-edge`, range input', '`Panel` of planks, `Lever`, `RopeSlider`', '6.2'],
  ['`AdminPanel`', 'Home: admin lock', 'paper panel, white field', 'small `Panel` with a brass hasp', '6.2'],
  ['`LegalDialog`, `FeedbackDialog`', 'Home and table: footer links, feedback', 'Tailwind panels: `rounded-lg`, `bg-white`, `bg-black/50`', '`Clipboard`', '6.2'],
  ['`PaintedCredits`, `RulesCard`, the leave dialog', 'Home, table', 'paper panels', '`Clipboard`', '6.2'],
  ['`RunOver`', 'Practice duel end', 'paper panel', '`Board panel` with a `Slate plaque`', '6.3'],
  ['practice VS bar', 'Practice duel', '`.sk-chip` names and carved VS', '`Paper slip`s pinned to stakes in the ice', '6.3'],
  ['`Lantern` streak string', 'Table end board (daily)', '`rounded-full` beads', '`Knit` stitches', '4.6'],
  ['`signPost`, `signRim`, `signLetters`', 'Counting Sheep world', 'flat slab, proud letters, cream rim', 'the fence sign with carved letters and a lantern', '5.1'],
  ['`src/skin/share/card.ts`', 'share image', 'flat fills, `system-ui`', 'plank, slate and stitches; Fraunces and Patrick Hand', '6.4'],
  ['loading lines ("Loading the word list…", "Raising the barn…")', 'Home, table, dream', '`.sk-paper`', '`Paper slip` on a nail', '6.2'],
  ['`DevStats`, `SheepPreview`', 'developer overlay and preview page', 'Tailwind `bg-white/80`, `rounded`, gradient page backgrounds', 'kit or allow-list, settled in U5 (not player-facing)', '6.5'],
];

const componentFindings = (needle: RegExp) => describe(open.filter((f) => f.selector === '' && needle.test(f.file)));
const compRows = COMPONENTS.map(([name, at, look, mat, part]) => {
  const files = name.match(/`([A-Za-z]+)`/g)?.map((m) => m.slice(1, -1)) ?? [];
  const found = files.length ? componentFindings(new RegExp(`(${files.join('|')})\\.tsx$`)) : 'none';
  return `| ${name} | ${at} | ${look} | ${found} | ${mat} | ${part} |`;
});

const openTable = open.map((f) => `| ${f.kind} | \`${f.file}:${f.line}\` | ${f.selector ? `\`${f.selector.slice(0, 70)}\`` : '(component)'} | ${f.text.replace(/\|/g, '\\|').slice(0, 90)} |`);

const doc = `# UI audit (V6 Milestone U0)

Generated by \`npx vite-node scripts/ui-audit-doc.ts\` from \`src/skin/audit\` (docs/REDESIGN_PLAN_V6_UI.md Parts 3.1 and 3.2). Rerun it at every milestone; do not edit by hand.

The audit reads every \`.css\` and \`.tsx\` under \`src/skin\` except \`src/skin/hunt\` (decision 9.3), tests and the audit itself, plus \`src/skin/share/card.ts\` for fonts.

## Counts

| Kind | Open | Budget | All found | Allowed (Part 4.12) |
|---|---|---|---|---|
${KINDS.map((k) => `| ${k} | ${counts[k]} | ${(budget as Record<Kind, number>)[k]} | ${findings.filter((f) => f.kind === k).length} | ${findings.filter((f) => f.kind === k && allowedBy(f, allow as AllowEntry[])).length} |`).join('\n')}
| **total** | **${open.length}** | **${KINDS.reduce((n, k) => n + (budget as Record<Kind, number>)[k], 0)}** | **${findings.length}** | **${findings.length - open.length}** |

The budget lives in \`src/skin/audit/budget.json\` and only goes down: \`npm test\` fails if a count rises above it, and also if a fix lowers a count without the budget following it.

## Every surface, by class (${rows.length})

Where = the screen, then the components that use the class. Findings = what the audit flags in that class's own rules.

| Surface | Where | Now | Findings | Becomes | Part |
|---|---|---|---|---|---|
${rows.join('\n')}

## Surfaces drawn by components

| Surface | Where | Now | Findings (component code) | Becomes | Part |
|---|---|---|---|---|---|
${compRows.join('\n')}

## Found by U0 beyond the plan's inventory

- **Counting Sheep v4.1** (merged after the plan was written, at 4dce7f7): \`.dr-card*\` (the results card), \`.dr-btn*\`, \`.dr-bump\`, \`.dr-burst\`, \`.dr-board\` and the dream's night restyle of the word bar (\`.dr-root .sk-input-bar\`, \`.dr-root .sk-type-tile\`, \`.dr-root .sk-input-go\`). They fold into Part 6.4.
- **Season (v0.3.0)**: \`.sk-garland*\` (allowed, Part 4.12) and the candy-cane stripe under the panel headers (\`.sk-sheet-head::after\`, \`.sk-guide-head::after\`, \`.sk-setup-head::after\`), which becomes part of the \`Clipboard\`.
- **Practice duel**: the pressure vignette in \`DuelTable.tsx\` (allowed with the table's vignette) and the VS bar's \`.sk-chip\`s (Part 6.3).
- **Home**: the name plate is now an input (\`.sk-plate-name\`), and the menu backing \`.sk-menu-board\` has no row in the plan; U2 settles it.
- **Glyphs**: \`✓\` as CSS content on the lit fence tile (\`dream.css\`), the lone \`…\` in the thought bubble (\`Sheep.tsx\`) and in \`DreamScreen.tsx\`.
- **Developer surfaces**: \`DevStats\` and \`SheepPreview\` are not player-facing but sit in \`src/skin\`; U5 puts them in the kit or on the allow-list with a reason.

## Every open finding (${open.length})

| Kind | Where | Selector | Text |
|---|---|---|---|
${openTable.join('\n')}
`;

writeFileSync('docs/skin/UI_AUDIT.md', doc);
console.log(`docs/skin/UI_AUDIT.md: ${rows.length} class rows, ${compRows.length} component rows, ${open.length} open findings`);
