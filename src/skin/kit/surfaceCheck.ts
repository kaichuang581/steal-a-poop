/**
 * The surface test's reading of a stylesheet (docs/leaderboards/LEADERBOARDS-PLAN.md, section 11, check 2), for a
 * screen that is drawn from the shared recipes (the pen: docs/pen/PEN-PLAN.md, section 12, check 2). The same reading
 * as src/skin/boards/__tests__/surface.test.tsx, which keeps its own copy: every rule that gives an element on the page
 * a background must paint a piece that carries a recipe, or one no larger than 40 on a side by the sizes the stylesheet
 * gives it. No browser: "larger" is read from the stylesheet, and a painted piece with no size on record fails.
 */
export const RECIPES = ['slab', 'board', 'bar', 'tile', 'well', 'inkcard', 'snowcap', 'ribbon'];
const recipe = (cls: string) => cls.split('-').some((w) => RECIPES.includes(w));

/** A stylesheet's rules, comments out, as [selectors, declarations]; @media and @container blocks opened up. */
export function rules(css: string): [string, string][] {
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
export function subject(selector: string): string[] {
  const last = selector.trim().split(/\s*[\s>+~]\s*(?![^(]*\))/).pop() ?? '';
  return [...last.replace(/::?[\w-]+(\([^)]*\))?/g, '').matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}
export const selectors = (head: string) => head.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
/** A background that paints something: a colour, a var, an image; not none or transparent. */
export const paints = (body: string) => /(?:^|;)\s*background(?:-color|-image)?\s*:(?!\s*(?:none|transparent)\b)\s*[^;\s][^;]*/.test(body);
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

/** What is wrong with `page` (static markup) drawn with `css`: each painted piece that is no recipe and not small. */
export function surfaceProblems(page: string, css: string, sky: string): string[] {
  const all = rules(css);
  const size = (cls: string) => {
    let w: number | null = null, h: number | null = null;
    for (const [head, body] of all) {
      if (!selectors(head).some((s) => subject(s).includes(cls) && !/::/.test(s))) continue;
      for (const d of body.split(';')) {
        const [k, ...rest] = d.split(':');
        const key = k?.trim(), n = plan(rest.join(':'));
        if (n === null) continue;
        if (key === 'width' || (key === 'min-width' && w === null)) w = Math.min(w ?? n, n);
        if (key === 'height') h = Math.min(h ?? n, n);
      }
    }
    return { w, h };
  };
  const elements = [...page.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/).filter(Boolean));
  const used = new Set(elements.flat());
  const bad: string[] = [];
  if (/style="[^"]*background/.test(page)) bad.push('a background in the markup itself');
  for (const [head, body] of all) {
    if (!paints(body)) continue;
    for (const sel of selectors(head)) {
      const subj = subject(sel);
      if (!subj.length) {
        // Named by its tag (Home's busy dots, `.hm-dots i`): fine when the rule itself makes it small.
        const classes = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        const own = Object.fromEntries(body.split(';').map((d) => d.split(':')).map(([k, ...v]) => [k?.trim(), plan(v.join(':'))]));
        const small = [own.width, own.height].some((n) => n !== null && n !== undefined && n <= 40);
        if (classes.length && classes.every((c) => used.has(c)) && !small) bad.push(`${sel} (paints an element named by its tag)`);
        continue;
      }
      for (const el of elements.filter((e) => subj.every((c) => e.includes(c)))) {
        if (el.length && el.includes(sky) && el.every((c) => c === sky || c === 'hm' || c === 'rc')) continue;
        if (el.some(recipe)) continue;
        const sizes = el.map(size);
        if (!sizes.some(({ w, h }) => (w !== null && w <= 40) || (h !== null && h <= 40))) bad.push(`${sel} on .${el.join('.')} (${JSON.stringify(sizes)})`);
      }
    }
  }
  return bad;
}
