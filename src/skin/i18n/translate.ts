/**
 * Puts the painted game in French: every text and label on the page whose English is in FR (or matches FR_PATTERNS)
 * is swapped for its French, now and whenever React draws something new. It works on the page rather than in each
 * component so that the English game is untouched and every screen is covered by one table. Anything marked
 * `data-i18n-skip`, typed fields, and the room's chat log (players' own words) are left alone.
 */
let FR: Record<string, string> = {};
let FR_PATTERNS: [RegExp, string][] = [];
/** Sets the English-to-French lines (public/i18n-fr.json) and the patterns for lines with names and numbers in them
 *  (public/i18n-fr-patterns.json: [regular expression source, French], first match wins). Both are fetched only in
 *  French, so the English game's download does not grow. */
export function setFrench(lines: Record<string, string>, patterns: [string, string][] = []): void {
  FR = lines;
  FR_PATTERNS = patterns.map(([src, out]) => [new RegExp(src), out]);
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const SKIP = '[data-i18n-skip], script, style, textarea, input, [role="log"], .rm-chat-log, [contenteditable="true"]';

/** A piece kept from an English line: its French if the table has it (a list like "Wood, Stone" piece by piece). */
function piece(g: string): string {
  if (Object.hasOwn(FR, g)) return FR[g];
  if (g.includes(', ')) return g.split(', ').map((x) => (Object.hasOwn(FR, x) ? FR[x] : x)).join(', ');
  return /[A-Za-z]/.test(g) && !/^\d/.test(g) ? (toFrench(g) ?? g) : g;
}

/** French for one line of English, or null when there is none. Leading and trailing spaces are kept. */
export function toFrench(text: string): string | null {
  const core = text.trim();
  if (!core || !/[A-Za-z]/.test(core)) return null;
  let fr: string | undefined = Object.hasOwn(FR, core) ? FR[core] : undefined;
  if (fr === undefined) {
    for (const [re, out] of FR_PATTERNS) {
      if (re.test(core)) {
        // The parts kept from the English (a name, a number, a rank) are translated too when the table has them.
        fr = core.replace(re, (...args: unknown[]) => {
          const groups = args.slice(1).filter((a): a is string => typeof a === 'string');
          return out.replace(/\$(\d)/g, (_, i: string) => piece(groups[Number(i) - 1] ?? ''));
        });
        break;
      }
    }
  }
  if (fr === undefined || fr === core) return null;
  const start = text.indexOf(core);
  return text.slice(0, start) + fr + text.slice(start + core.length);
}

function skipped(el: Element | null): boolean {
  return !!el?.closest(SKIP);
}

function translateText(node: Text): void {
  if (skipped(node.parentElement)) return;
  const fr = toFrench(node.data);
  if (fr !== null) node.data = fr;
}

function translateAttrs(el: Element): void {
  if (el.closest('[data-i18n-skip]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const fr = toFrench(v);
    if (fr !== null) el.setAttribute(a, fr);
  }
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (skipped(el) && el.matches(SKIP)) return;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
}

/** Fetches the French lines, then translates the page and keeps it translated. Returns a function that stops it. */
export function startFrench(): () => void {
  let stop = () => {};
  let gone = false;
  document.documentElement.lang = 'fr';
  const get = <T,>(file: string, empty: T): Promise<T> => fetch(`${import.meta.env.BASE_URL}${file}`)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : empty))
    .catch(() => empty);
  void Promise.all([get<Record<string, string>>('i18n-fr.json', {}), get<[string, string][]>('i18n-fr-patterns.json', [])])
    .then(([lines, patterns]) => {
      if (gone) return;
      setFrench(lines, patterns);
      stop = observe();
    });
  return () => { gone = true; stop(); };
}

function observe(): () => void {
  translateTree(document.body);
  const titleFr = toFrench(document.title);
  if (titleFr) document.title = titleFr;
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateText(r.target as Text);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
      else r.addedNodes.forEach(translateTree);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  return () => obs.disconnect();
}
