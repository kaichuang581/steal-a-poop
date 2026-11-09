import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve as resolvePath, sep } from 'node:path';

/**
 * The farm kit's audit (docs/REDESIGN_PLAN_V6_UI.md Part 3.1). It reads the painted skin's stylesheets and components
 * and reports every surface that is a shape rather than a material: gradients used as a colour, rounded corners over
 * 4 px, blur-only shadows, Tailwind colour and shadow utilities, emoji or typographic glyphs used as icons, and any font
 * that is not one of the three tokens. src/skin/hunt keeps its own look and is not read (V6 decision 9.3); tests and
 * this folder are not surfaces and are not read either.
 */

export type Kind = 'gradient' | 'radius' | 'shadow' | 'utility' | 'emoji' | 'font';
export const KINDS: Kind[] = ['gradient', 'radius', 'shadow', 'utility', 'emoji', 'font'];

export interface Finding {
  kind: Kind;
  /** Path from the repository root, with forward slashes. */
  file: string;
  line: number;
  /** The CSS selector the finding sits in; empty for a component. */
  selector: string;
  /** What was found, trimmed to one line. */
  text: string;
}

export interface SurfaceRow {
  className: string;
  file: string;
  line: number;
  /** The surface properties the rule sets. */
  props: string[];
  /** The rule's own declarations of those properties, for the audit document. */
  values: Record<string, string>;
}

export interface AllowEntry { file: string; selectorOrLine: string; reason: string }

const FONT_TOKENS = ['var(--skin-font-display)', 'var(--skin-font-hand)', 'var(--skin-font-body)'];
const GRADIENT = /\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/;
const PALETTE = 'slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const COLOUR_UTILITY = new RegExp(`^(?:[a-z-]+:)*(?:bg|text|border|from|to|via)-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?$`);
const SHADOW_UTILITY = /^(?:[a-z-]+:)*shadow(?:-[a-z0-9[\]#().,-]+)?$/;
const ROUNDED_UTILITY = /^(?:[a-z-]+:)*rounded(?:-[a-z0-9[\].-]+)?$/;
const PICTOGRAPH = /\p{Extended_Pictographic}/u;
/** Typographic glyphs that stand in for an icon when they are all a string or a CSS `content` holds. */
const GLYPH_ICONS = /^[✓✔✗✘…•★☆♥♦→←↑↓×]$/u;
/** Where a rounded corner is the material's own shape (V6 Part 3.1). */
// Round things in the kit: pegs, pins and nail or screw heads, knots, the lever's pivot and lamp, a tag's punched hole, ice and the slate's inner edge.
const ROUND_OK = ['.kit-peg', '.kit-pin', '.kit-nail', '.kit-string--knot', '.kit-screw', '.kit-lever-pivot', '.kit-lever-lamp', '.kit-tag', '.kit-ice', '.kit-slate-face', '.kit-rope'];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'hunt' || name === '__tests__' || name === 'audit') continue;
      files(p, out);
    } else if (/\.(css|tsx)$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const posix = (p: string) => p.split(sep).join('/');
const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 140);

/** Blank out comments, keeping every newline so line numbers hold. */
function stripCssComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}
function stripTsComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Splits on commas outside parentheses. */
function topLevel(value: string, by = ','): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === by && depth === 0) { out.push(value.slice(start, i)); start = i + 1; }
  }
  out.push(value.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The custom properties declared anywhere in the skin's stylesheets, for resolving radii written as tokens. */
function customProperties(cssFiles: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of cssFiles) {
    for (const m of stripCssComments(readFileSync(f, 'utf8')).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) vars[m[1]] ??= m[2].trim();
  }
  return vars;
}

function resolve(value: string, vars: Record<string, string>, depth = 0): string {
  if (depth > 5) return value;
  return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, name: string, fallback?: string) => resolve(vars[name] ?? fallback ?? '', vars, depth + 1));
}

/** The largest corner radius in a value, in px; any percentage counts as over (V6 Part 3.1). */
function largestRadius(value: string): number {
  let most = 0;
  for (const m of value.matchAll(/(-?[\d.]+)(px|%|rem|em)?/g)) {
    const n = Number(m[1]);
    if (!n) continue;
    const px = m[2] === '%' ? Infinity : m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
    most = Math.max(most, px);
  }
  return most;
}

/** True when every outer term of a shadow is blur-only: no offset, some blur. Rings (`0 0 0 3px`) are not shadows. */
function blurOnly(value: string): boolean {
  const terms = topLevel(value.replace(/^none$/, '')).filter((t) => !/\binset\b/.test(t));
  if (!terms.length) return false;
  return terms.every((t) => {
    const lengths = t.replace(/(?:rgba?|hsla?|color-mix|var)\([^)]*\)/g, ' ').match(/-?[\d.]+(?:px|rem|em)?/g) ?? [];
    const [x = '0', y = '0', blur = '0'] = lengths;
    return parseFloat(x) === 0 && parseFloat(y) === 0 && parseFloat(blur) > 0;
  });
}

interface Rule { selector: string; body: string; start: number }

/** Every rule with declarations, at any nesting depth (media queries, supports, keyframes). */
function rules(src: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  let preludeStart = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const prelude = src.slice(preludeStart, i).trim();
      stack.push(prelude);
      preludeStart = i + 1;
      // A block holds declarations when its prelude is a selector (or a keyframe step) and its body has no nested braces.
      const close = src.indexOf('}', i);
      const nested = src.indexOf('{', i + 1);
      if (!prelude.startsWith('@') && (nested === -1 || nested > close)) {
        const parents = stack.slice(0, -1).filter((p) => p.startsWith('@keyframes')).join(' ');
        out.push({ selector: oneLine(`${parents} ${prelude}`), body: src.slice(i + 1, close), start: i + 1 });
      }
    } else if (ch === '}') {
      stack.pop();
      preludeStart = i + 1;
    } else if (ch === ';' && stack.length === 0) {
      preludeStart = i + 1;
    }
  }
  return out;
}

function declarations(rule: Rule): { prop: string; value: string; offset: number }[] {
  const out: { prop: string; value: string; offset: number }[] = [];
  let offset = 0;
  for (const part of topLevel(rule.body, ';').length ? rule.body.split(/;(?![^(]*\))/) : []) {
    const at = rule.body.indexOf(part, offset);
    offset = at + part.length;
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (prop && value) out.push({ prop, value, offset: rule.start + at + (part.length - part.trimStart().length) });
  }
  return out;
}

function auditCss(file: string, src: string, vars: Record<string, string>): Finding[] {
  const clean = stripCssComments(src);
  const out: Finding[] = [];
  for (const rule of rules(clean)) {
    const kit = rule.selector.includes('.kit-');
    for (const d of declarations(rule)) {
      const at = { file, line: lineAt(clean, d.offset), selector: rule.selector, text: oneLine(`${d.prop}: ${d.value}`) };
      if (d.prop.startsWith('--')) continue; // a token's definition is judged where it is used
      if (!kit && GRADIENT.test(d.value)) out.push({ kind: 'gradient', ...at });
      if (d.prop === 'border-radius' || /^border-(?:top|bottom)-(?:left|right)-radius$/.test(d.prop)) {
        const round = ROUND_OK.some((c) => rule.selector.includes(c));
        if (!round && largestRadius(resolve(d.value, vars)) > 4) out.push({ kind: 'radius', ...at });
      }
      if (!kit && d.prop === 'box-shadow' && blurOnly(resolve(d.value, vars))) out.push({ kind: 'shadow', ...at });
      if (!kit && d.prop === 'filter') {
        for (const m of d.value.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g)) if (blurOnly(m[1])) { out.push({ kind: 'shadow', ...at }); break; }
      }
      const plain = d.value.replace(/\s*!important$/, '');
      if (d.prop === 'font-family' && !FONT_TOKENS.includes(plain) && plain !== 'inherit') out.push({ kind: 'font', ...at });
      if (d.prop === 'font' && !FONT_TOKENS.some((t) => plain.includes(t)) && plain !== 'inherit') out.push({ kind: 'font', ...at });
      if (d.prop === 'content') {
        const glyph = d.value.replace(/^['"]|['"]$/g, '');
        if (PICTOGRAPH.test(glyph) || GLYPH_ICONS.test(glyph)) out.push({ kind: 'emoji', ...at });
      }
    }
  }
  return out;
}

/** The text of every string literal (quotes or template) inside a JSX `className=` value. */
function classNames(src: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  for (const m of src.matchAll(/className=/g)) {
    let i = m.index! + m[0].length;
    if (src[i] === '"' || src[i] === "'") {
      const end = src.indexOf(src[i], i + 1);
      out.push({ text: src.slice(i + 1, end), index: i });
      continue;
    }
    if (src[i] !== '{') continue;
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    const expr = src.slice(start, i);
    for (const s of expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) out.push({ text: (s[1] ?? s[2] ?? s[3]).replace(/\$\{[^}]*\}/g, ' '), index: start + s.index! });
  }
  return out;
}

function auditTsx(file: string, src: string, vars: Record<string, string>): Finding[] {
  const clean = stripTsComments(src);
  const out: Finding[] = [];
  const lines = clean.split('\n');
  const add = (kind: Kind, index: number, text: string) => out.push({ kind, file, line: lineAt(clean, index), selector: '', text: oneLine(text) });
  // Inline styles and style strings: gradients, radii, shadows, fonts.
  lines.forEach((line, n) => {
    const index = clean.split('\n').slice(0, n).join('\n').length + (n ? 1 : 0);
    if (GRADIENT.test(line)) add('gradient', index, line);
    for (const m of line.matchAll(/borderRadius:\s*(?:'([^']*)'|"([^"]*)"|(\d+(?:\.\d+)?))/g)) {
      const value = m[1] ?? m[2] ?? `${m[3]}px`;
      if (largestRadius(resolve(value, vars)) > 4) add('radius', index, line);
    }
    for (const m of line.matchAll(/(?:boxShadow|filter):\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)) {
      const value = m[1] ?? m[2] ?? m[3];
      const shadow = /drop-shadow\(([^)]*)\)/.exec(value)?.[1] ?? value;
      if (/boxShadow|drop-shadow/.test(m[0]) && blurOnly(resolve(shadow, vars))) add('shadow', index, line);
    }
    for (const m of line.matchAll(/fontFamily:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)) {
      if (!FONT_TOKENS.includes(m[1] ?? m[2] ?? m[3])) add('font', index, line);
    }
  });
  // Tailwind colour, shadow and radius utilities in class names.
  for (const { text, index } of classNames(clean)) {
    for (const token of text.split(/\s+/).filter(Boolean)) {
      if (COLOUR_UTILITY.test(token) || SHADOW_UTILITY.test(token)) add('utility', index, token);
      else if (ROUNDED_UTILITY.test(token) && !/rounded-none$/.test(token)) add('radius', index, token);
    }
  }
  // Emoji anywhere in code, and typographic glyphs standing alone as an icon (a string or JSX text of just that glyph).
  for (const m of clean.matchAll(/\p{Extended_Pictographic}/gu)) add('emoji', m.index!, m[0]);
  for (const m of clean.matchAll(/(['"`>])\s*([^\s'"`<>{}])\s*(['"`<])/gu)) {
    if (GLYPH_ICONS.test(m[2]) && !PICTOGRAPH.test(m[2])) add('emoji', m.index!, m[0]);
  }
  return out;
}

function auditShareCard(file: string, src: string): Finding[] {
  const clean = stripTsComments(src);
  return [...clean.matchAll(/system-ui/g)].map((m) => ({ kind: 'font' as const, file, line: lineAt(clean, m.index!), selector: '', text: 'system-ui' }));
}

function repoRoot(): string {
  // The audit runs from the repository root (npm test, vite-node); src/skin is resolved against it.
  return process.cwd();
}

/** Every finding in the painted skin, allowed or not. */
export function audit(root = 'src/skin'): Finding[] {
  const base = repoRoot();
  const all = files(resolvePath(base, root));
  const css = all.filter((f) => f.endsWith('.css'));
  const vars = customProperties(css);
  const out: Finding[] = [];
  for (const f of all) {
    const src = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const file = posix(relative(base, f));
    out.push(...(f.endsWith('.css') ? auditCss(file, src, vars) : auditTsx(file, src, vars)));
  }
  const card = join(resolvePath(base, root), 'share', 'card.ts');
  try {
    out.push(...auditShareCard(posix(relative(base, card)), readFileSync(card, 'utf8').replace(/\r\n/g, '\n')));
  } catch { /* no share card */ }
  return out;
}

/** Whether an allow-list entry covers a finding: same file, and its selector, its line or its text names it ('*': the whole file). */
export function allowedBy(f: Finding, allow: AllowEntry[]): AllowEntry | undefined {
  return allow.find((a) => a.file === f.file && (a.selectorOrLine === '*' || f.selector.includes(a.selectorOrLine) || f.text.includes(a.selectorOrLine) || String(f.line) === a.selectorOrLine));
}

/** The findings no allow-list entry covers, and their counts by kind. */
export function tally(findings: Finding[], allow: AllowEntry[]): { open: Finding[]; counts: Record<Kind, number> } {
  const open = findings.filter((f) => !allowedBy(f, allow));
  const counts = Object.fromEntries(KINDS.map((k) => [k, open.filter((f) => f.kind === k).length])) as Record<Kind, number>;
  return { open, counts };
}

/** Every CSS class in the skin whose rule sets a background, a border or a box-shadow (V6 Part 3.1). */
export function surfaces(root = 'src/skin'): SurfaceRow[] {
  const base = repoRoot();
  const rows = new Map<string, SurfaceRow>();
  for (const f of files(resolvePath(base, root)).filter((x) => x.endsWith('.css'))) {
    const clean = stripCssComments(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    const file = posix(relative(base, f));
    for (const rule of rules(clean)) {
      if (rule.selector.startsWith('@keyframes')) continue;
      const decls = declarations(rule).filter((d) => /^(background|border(?!-collapse|-spacing)|box-shadow)/.test(d.prop));
      if (!decls.length) continue;
      for (const m of rule.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
        const key = `${file} ${m[1]}`;
        const row = rows.get(key) ?? { className: m[1], file, line: lineAt(clean, rule.start), props: [], values: {} };
        for (const d of decls) {
          const prop = d.prop.startsWith('background') ? 'background' : d.prop.startsWith('border') && d.prop.includes('radius') ? 'border-radius' : d.prop.startsWith('border') ? 'border' : 'box-shadow';
          if (!row.props.includes(prop)) row.props.push(prop);
          row.values[prop] ??= oneLine(d.value);
        }
        rows.set(key, row);
      }
    }
  }
  return [...rows.values()].sort((a, b) => a.className.localeCompare(b.className));
}
