import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Motion and feel (docs/visual-overhaul/15-motion-and-feel.md): source checks on the skin's stylesheets and Home.
// The browser checks (computed animation names under both reduced-motion settings, paused animations under a full
// page, the menu's node kept across a panel) belong to the painted suite in milestone 12.

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__') files(path, out); }
    else if (path.endsWith('.css')) out.push(path.split('\\').join('/'));
  }
  return out;
}

const css = files('src/skin').map((f) => ({ f, text: readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

/** The body of the block whose `{` is at `open`, and the index after its `}`. */
function block(text: string, open: number): { body: string; end: number } {
  let depth = 1;
  let i = open + 1;
  while (depth && i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
  return { body: text.slice(open + 1, i - 1), end: i };
}

/** Splits on commas outside brackets. */
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(list.slice(from, i)); from = i + 1; }
  }
  out.push(list.slice(from));
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** Every rule at the top level of `text` (or inside a block), as selector text and declarations, skipping at-rules. */
function rules(text: string): { sel: string; decls: string }[] {
  const out: { sel: string; decls: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    const { body, end } = block(text, open);
    if (!head.startsWith('@')) out.push({ sel: head, decls: body });
    i = end;
  }
  return out;
}

describe('motion and feel', () => {
  it('endless animations move only transform and opacity (change 2)', () => {
    const keyframes = new Map<string, string[]>();
    for (const { text } of css) {
      for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
        const body = block(text, m.index + m[0].length - 1).body;
        keyframes.set(m[1], [...body.matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]));
      }
    }
    const allowed = new Set(['transform', 'opacity', 'rotate', 'translate', 'scale', 'animation-timing-function']);
    const bad: string[] = [];
    const unknown: string[] = [];
    for (const { f, text } of css) {
      for (const m of text.matchAll(/animation\s*:\s*([^;}]*)/g)) {
        for (const part of topLevel(m[1])) {
          if (!/\binfinite\b/.test(part)) continue;
          const name = part.split(' ').find((t) => keyframes.has(t));
          if (!name) { unknown.push(`${f}: ${part}`); continue; }
          const props = keyframes.get(name)!.filter((p) => !allowed.has(p));
          if (props.length) bad.push(`${f}: ${name} animates ${[...new Set(props)].join(', ')}`);
        }
      }
      expect(text, `${f} sets an iteration count apart from the animation`).not.toMatch(/animation-iteration-count\s*:\s*infinite/);
    }
    expect(unknown).toEqual([]);
    expect(bad).toEqual([]);
  });

  it('the computer\'s reduce-motion setting and the game\'s switch have the same rules, file by file (change 1)', () => {
    const PREFIX = /^:root(?:\[data-skin="painted"\])?\.reduce-motion\s*/;
    const split = (sel: string) => topLevel(sel).flatMap((s) => {
      // A whole selector written as :is(a, b) is the same as a, b.
      if (!s.startsWith(':is(')) return [s];
      let depth = 0;
      let close = -1;
      for (let i = 3; i < s.length && close < 0; i++) { if (s[i] === '(') depth++; else if (s[i] === ')' && --depth === 0) close = i; }
      return close === s.length - 1 ? topLevel(s.slice(4, -1)) : [s];
    });
    const pairs = (list: { sel: string; decls: string }[]) => new Set(list.flatMap(({ sel, decls }) => {
      const ds = decls.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean);
      return split(sel).flatMap((s) => ds.map((d) => `${s} { ${d} }`));
    }));
    for (const { f, text } of css) {
      const switchRules = rules(text)
        .map(({ sel, decls }) => ({ parts: topLevel(sel), decls }))
        .filter(({ parts }) => parts.some((p) => PREFIX.test(p)))
        .map(({ parts, decls }) => {
          expect(parts.every((p) => PREFIX.test(p)), `${f}: ${parts.join(', ')} mixes switch and plain selectors`).toBe(true);
          const rest = parts.map((p) => p.replace(PREFIX, '') || ':root[data-skin="painted"]');
          return { sel: rest.join(', '), decls };
        });
      const media: { sel: string; decls: string }[] = [];
      for (const m of text.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)) media.push(...rules(block(text, m.index + m[0].length - 1).body));
      const a = [...pairs(switchRules)].sort();
      const b = [...pairs(media)].sort();
      expect(a.filter((x) => !b.includes(x)), `${f}: the switch only`).toEqual([]);
      expect(b.filter((x) => !a.includes(x)), `${f}: the computer's setting only`).toEqual([]);
    }
  });

  it('no pseudo-element sits inside :is() or :where(), where browsers silently drop it', () => {
    // :is() is a forgiving list: an entry like .x::after is thrown away without an error, so a rule meant to stop that
    // pseudo-element's animation stops nothing (found in review of milestone 11).
    const bad: string[] = [];
    for (const { f, text } of css) for (const m of text.matchAll(/:(?:is|where)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      if (m[1].includes('::')) bad.push(`${f}: ${m[0].slice(0, 80)}`);
    }
    expect(bad).toEqual([]);
  });
  it('Home marks itself covered under a full page and pauses its slab, title and word of the day (change 3)', () => {
    const home = readFileSync('src/skin/screens/PaintedHome.tsx', 'utf8');
    expect(home).toMatch(/className=\{`sk-home[^`]*`\} data-covered=\{bazaar \|\| boards \|\| profile \|\| undefined\}/);
    const homeCss = css.find(({ f }) => f.endsWith('home/home.css'))!.text;
    const paused = rules(homeCss).filter(({ decls }) => /animation-play-state:\s*paused/.test(decls)).flatMap(({ sel }) => topLevel(sel));
    const all = ':is(.hm-panel, .hm-title, .sk-wotd)';
    for (const sel of [all, `${all} *`, `${all} ::before`, `${all} ::after`]) expect(paused).toContain(`.sk-home[data-covered] ${sel}`);
  });

  it('the desktop menu sits in one wrapper whatever the step, so a panel never remounts it (change 4)', () => {
    const home = readFileSync('src/skin/screens/PaintedHome.tsx', 'utf8');
    // One wrapper, whatever its class says about the step (2026-11-22: behind a setup sheet it dims all but the chosen item).
    expect(home).toMatch(/<div className=\{step === 'tables' \? undefined : [^\n]*inert=\{step !== 'tables'\}>\{tables\}<\/div>/);
    expect(home).not.toMatch(/step === 'tables' \? tables :/);
  });
});
