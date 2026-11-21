import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Leaderboards, levelSheet, rankedSheet, winsSheet } from '../Leaderboards';
import type { BoardTab, Sheet } from '../Leaderboards';

/**
 * The surface test (docs/leaderboards/LEADERBOARDS-PLAN.md, section 11, check 2; Brian, 2026-11-21: "nothing may look like
 * a flat, empty, single-coloured card"). Every tab is drawn with made-up boards; then every rule of the screen's styles
 * that gives one of its elements a background is judged: the element it paints must carry one of the recipes (slab, board,
 * bar, tile, well, ink card, snow cap, ribbon), or be no larger than 40 on one side. There is no browser here to measure
 * with, so "larger" is read from the sizes the stylesheet gives each piece; a piece with a background and no size on
 * record fails. The one exemption is the screen itself (`.lb`), whose colour is the sky the stage draws over.
 */
const RECIPES = ['slab', 'board', 'bar', 'tile', 'well', 'inkcard', 'snowcap', 'ribbon'];
const recipe = (cls: string) => cls.split('-').some((w) => RECIPES.includes(w));
const SKY = 'lb';

const names = ['kxln', 'owen2008', 'bigmayafan18', 'realfrog', 'libo', 'its_tansy', 'Pip', 'MapleLeafKid', 'barley_bun', 'thegoatjo'];
const sheets: Record<BoardTab, Sheet> = {
  ranked: rankedSheet({ top: names.map((name, i) => ({ place: i + 1, name, rating: 2240 - i * 100, games: 300 - i, wins: 100 - i, you: i === 6 })), you: { place: 7, of: 2431 } }),
  wins: winsSheet({ rows: names.map((name, i) => ({ rank: i + 1, name, value: 212 - i * 12, games: 323 - i * 15 })) }, 'Pip'),
  level: levelSheet({ top: names.map((name, i) => ({ place: i + 1, name, xp: 96000 - i * 5300, level: 41 - i * 2, you: false })), players: 2431, you: { place: 140, xp: 1200 } }),
};

/** A stylesheet's rules, comments out, as [selectors, declarations]; @media and @container blocks opened up. */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (t: string) => {
    let i = 0;
    while (i < t.length) {
      const open = t.indexOf('{', i);
      if (open < 0) break;
      const head = t.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < t.length && depth) { if (t[j] === '{') depth++; else if (t[j] === '}') depth--; j++; }
      const body = t.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@container') || head.startsWith('@supports')) walk(body);
      else if (!head.startsWith('@')) out.push([head, body]);
      i = j;
    }
  };
  walk(text);
  return out;
}
/** The classes of a selector's subject: its last compound, without pseudo-classes and pseudo-elements. */
function subject(selector: string): string[] {
  const last = selector.trim().split(/\s*[\s>+~]\s*(?![^(]*\))/).pop() ?? '';
  return [...last.replace(/::?[\w-]+(\([^)]*\))?/g, '').matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}
/** Splits a selector list at its top-level commas. */
const selectors = (head: string) => head.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
/** A background that paints something: a colour, a var, an image; not none or transparent. */
const paints = (body: string) => /(?:^|;)\s*background(?:-color|-image)?\s*:\s*(?!none\b|transparent\b)[^;]+/.test(body);
/** The plan's pixels a length stands for: calc(N * var(--u)), var(--s) (3), calc(N * var(--s)), Npx; null when unknown. */
function plan(v: string): number | null {
  v = v.trim();
  let m = v.match(/^calc\(([\d.]+) \* var\(--u\)\)$/);
  if (m) return Number(m[1]);
  if (v === 'var(--s)') return 3;
  m = v.match(/^calc\(([\d.]+) \* var\(--s\)\)$/);
  if (m) return Number(m[1]) * 3;
  m = v.match(/^([\d.]+)px$/);
  if (m) return Number(m[1]);
  return null;
}

const css = ['src/skin/boards/boards.css', 'src/skin/home/home.css'].map((f) => readFileSync(f, 'utf8')).join('\n');
const all = rules(css);
/** What the stylesheet says a class's width and height are (the smallest it ever gives), in the plan's pixels. */
function size(cls: string): { w: number | null; h: number | null } {
  let w: number | null = null, h: number | null = null;
  for (const [head, body] of all) {
    if (!selectors(head).some((s) => subject(s).includes(cls) && !/::/.test(s))) continue;
    for (const d of body.split(';')) {
      const [k, ...rest] = d.split(':');
      const key = k?.trim(), n = plan(rest.join(':'));
      if (n === null) continue;
      if (key === 'width' || key === 'min-width' && w === null) w = Math.min(w ?? n, n);
      if (key === 'height') h = Math.min(h ?? n, n);
    }
  }
  return { w, h };
}

describe('nothing on the leaderboards is a flat, empty, single-coloured card', () => {
  for (const tab of ['ranked', 'wins', 'level'] as const) {
    const page = renderToStaticMarkup(<Leaderboards onClose={() => undefined} start={{ tab, sheet: sheets[tab], info: true }} />);
    const elements = [...page.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/).filter(Boolean));
    const used = new Set(elements.flat());

    it(`${tab}: is drawn from its board, with every recipe on it`, () => {
      expect(page).toContain('realfrog');
      for (const r of ['hm-slab', 'lb-board', 'lb-bar', 'lb-tile', 'lb-well', 'lb-inkcard', 'lb-snowcap', 'lb-ribbon']) expect(used.has(r), r).toBe(true);
      expect(page.match(/class="lb-tile"/g)?.length).toBe(names.length - 3);
    });

    it(`${tab}: no element is given a background in the markup itself`, () => {
      expect(page).not.toMatch(/style="[^"]*background/);
    });

    it(`${tab}: every background the styles give it is a recipe's, or on a piece no larger than 40 on a side`, () => {
      const bad: string[] = [];
      for (const [head, body] of all) {
        if (!paints(body)) continue;
        for (const sel of selectors(head)) {
          const subj = subject(sel);
          // A rule that names its piece by tag alone (Home's `.hm-dots i`) is judged by its other classes: on this screen
          // it may not apply at all.
          if (!subj.length) {
            const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
            if (classes.length && classes.every((c) => used.has(c))) bad.push(`${sel} (paints an element named by its tag)`);
            continue;
          }
          // Each element the rule's subject names (an element carrying all of its classes); none, and it is some other
          // screen's rule.
          for (const el of elements.filter((e) => subj.every((c) => e.includes(c)))) {
            if (el.length === 1 && el[0] === SKY) continue;
            if (el.some(recipe)) continue;
            const sizes = el.map(size);
            const small = sizes.some(({ w, h }) => (w !== null && w <= 40) || (h !== null && h <= 40));
            if (!small) bad.push(`${sel} on .${el.join('.')} (${JSON.stringify(sizes)})`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('every background rule in the screen\'s own stylesheet names the piece it paints by a class', () => {
    for (const [head, body] of rules(readFileSync('src/skin/boards/boards.css', 'utf8'))) {
      if (!paints(body)) continue;
      for (const sel of selectors(head)) expect(subject(sel).length, sel).toBeGreaterThan(0);
    }
  });
});
