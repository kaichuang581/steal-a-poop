/**
 * Puts the painted game in French: every text and label on the page whose English is in FR (or matches FR_PATTERNS)
 * is swapped for its French, now and whenever React draws something new. It works on the page rather than in each
 * component so that the English game is untouched and every screen is covered by one table. Anything marked
 * `data-i18n-skip`, typed fields, and the room's chat log (players' own words) are left alone.
 */
import { FR_PATTERNS } from './fr';

let FR: Record<string, string> = {};
/** Sets the English-to-French lines (public/i18n-fr.json). */
export function setFrench(lines: Record<string, string>): void {
  FR = lines;
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const SKIP = '[data-i18n-skip], script, style, textarea, input, [role="log"], .rm-chat-log, [contenteditable="true"]';

/** French for one line of English, or null when there is none. Leading and trailing spaces are kept. */
export function toFrench(text: string): string | null {
  const core = text.trim();
  if (!core || !/[A-Za-z]/.test(core)) return null;
  let fr: string | undefined = Object.hasOwn(FR, core) ? FR[core] : undefined;
  if (fr === undefined) {
    for (const [re, out] of FR_PATTERNS) {
      if (re.test(core)) {
        fr = core.replace(re, out);
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
  void fetch(`${import.meta.env.BASE_URL}i18n-fr.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((lines: Record<string, string>) => {
      if (gone) return;
      setFrench(lines);
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
