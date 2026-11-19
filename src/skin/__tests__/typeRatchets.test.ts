import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The static ratchets of plan file 13 (docs/visual-overhaul/13-typography-and-hud-rules.md, changes 3, 4 and 8). Each
// is a count that may only fall: when a change brings one down, lower its limit here to the new count in the same
// commit. Raising a limit is a decision for Brian. The gate's own copies (tools/gate/banned.mjs, RATCHETS.json) are
// separate and are judged in milestone 12.

/** Literal font sizes under 11 px in the skin's stylesheets and inline styles. 5 at the plan's count; 3 once the
 *  phone's word-of-the-day pronunciation went from 10 to 11 px (milestone 10). Left: boards.css's two phone rank tags
 *  (10 and 9 px) and kit.css's stitch label (9 px). */
const SMALL_TEXT_LIMIT = 3;
/** Distinct colours among the hex, rgb() and rgba() literals of src/skin/**\/*.css, counted as the plan counted its 267
 *  (and as tools/gate/banned.mjs does): the alpha left out, a hex and an rgb() of one colour counted once. 264 once
 *  Home's title tiles, update board and menu patch went (2026-11-19). */
const CSS_COLOUR_LIMIT = 264;
/** Lines of player-facing code in src/skin with a middle dot in them (comments and dev-only pages left out). 39 at the
 *  plan's count; 34 by this rule at milestone 10; 30 once Home's name plate, version line and blanket caption lost
 *  theirs (2026-11-19). No new one: "No middle dot between phrases" (Brian, 2026-11-14). */
const MIDDLE_DOT_LIMIT = 30;

/** Dev-only pages: never shown to a player. */
const DEV_ONLY = new Set(['src/skin/table/DevStats.tsx', 'src/skin/table/SheepPreview.tsx', 'src/skin/kit/KitPreview.tsx']);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__') files(path, out); }
    else out.push(path.split('\\').join('/'));
  }
  return out;
}

const skin = files('src/skin');
const css = skin.filter((f) => f.endsWith('.css'));
const code = skin.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/** Every font size under 11 px written in the skin, as file:line and the declaration. */
function smallText(): string[] {
  const found: string[] = [];
  for (const f of css) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/font-size\s*:\s*([^;}]*)/g)) {
      const px = [...m[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((p) => Number(p[1]));
      if (px.some((n) => n < 11)) found.push(`${f}:${lineOf(text, m.index)} ${m[0].trim()}`);
    }
  }
  for (const f of code) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)(px)?['"]?/g)) {
      if (Number(m[1]) < 11) found.push(`${f}:${lineOf(text, m.index)} ${m[0]}`);
    }
  }
  return found;
}

const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|rgba?\(([^)]*)\)/g;

/** The distinct colours of the skin's stylesheets, alpha left out. */
function cssColours(): Set<string> {
  const colours = new Set<string>();
  for (const f of css) {
    for (const m of readFileSync(f, 'utf8').matchAll(COLOUR)) {
      const written = m[0].toLowerCase().replace(/\s+/g, '');
      if (written.startsWith('#')) {
        const digits = written.length <= 5 ? [...written.slice(1)].map((c) => c + c).join('') : written.slice(1);
        colours.add(digits.slice(0, 6));
      } else {
        const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
        const n = parts.map((p) => (p.endsWith('%') ? Math.round(Number(p.slice(0, -1)) * 2.55) : Math.round(Number(p))));
        colours.add(n.length === 3 && n.every((x) => Number.isFinite(x)) ? n.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('') : written);
      }
    }
  }
  return colours;
}

/** Lines of player-facing code with a middle dot, as file:line. A line that is only a comment does not count. */
function middleDots(): string[] {
  const found: string[] = [];
  for (const f of code) {
    if (DEV_ONLY.has(f)) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!line.includes('\u00b7')) return;
      if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
      found.push(`${f}:${i + 1}`);
    });
  }
  return found;
}

describe('type and copy ratchets (plan file 13)', () => {
  it('small text only gets rarer: literal font sizes under 11 px', () => {
    const found = smallText();
    expect(found.length, `font sizes under 11 px (limit ${SMALL_TEXT_LIMIT}):\n${found.join('\n')}`).toBeLessThanOrEqual(SMALL_TEXT_LIMIT);
  });

  it('the phone word of the day says its pronunciation at 11 px, not 10', () => {
    const text = readFileSync('src/skin/styles/skin.css', 'utf8');
    expect(text).toMatch(/\.sk-wotd--compact \.sk-wotd-say \{ font-size: 11px;/);
  });

  it('raw colours in the skin\'s CSS only get fewer', () => {
    expect(cssColours().size).toBeLessThanOrEqual(CSS_COLOUR_LIMIT);
  });

  it('no new middle dot between phrases; existing ones only go', () => {
    const found = middleDots();
    expect(found.length, `lines with a middle dot (limit ${MIDDLE_DOT_LIMIT}):\n${found.join('\n')}`).toBeLessThanOrEqual(MIDDLE_DOT_LIMIT);
  });

  it('the counters see what they count', () => {
    // A counter that reads no files would pass every ratchet.
    expect(css.length).toBeGreaterThan(5);
    expect(code.length).toBeGreaterThan(100);
    expect(cssColours().size).toBeGreaterThan(100);
  });
});
