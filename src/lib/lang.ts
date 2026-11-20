/**
 * The game's language: English (the default) or French. Chosen by the language button on the start screen and kept on
 * this device (`sap:lang`); `?lang=fr` / `?lang=en` override it for one page. Switching reloads the page, so the word
 * list, the words on screen and the rooms you are matched with all change together.
 */
export type Lang = 'en' | 'fr';

const KEY = 'sap:lang';

function fromUrl(): Lang | null {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    return q === 'fr' || q === 'en' ? q : null;
  } catch {
    return null;
  }
}

let current: Lang | null = null;

export function getLang(): Lang {
  if (current) return current;
  let saved: string | null = null;
  try {
    saved = globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    /* storage blocked */
  }
  current = fromUrl() ?? (saved === 'fr' ? 'fr' : 'en');
  return current;
}

export function setLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(KEY, lang);
  } catch {
    /* storage blocked: the URL still carries it */
  }
  const url = new URL(globalThis.location.href);
  url.searchParams.delete('lang');
  if (lang === 'fr') url.searchParams.set('lang', 'fr');
  globalThis.location.assign(url.toString());
}

/** The word list for a language, relative to the page. */
export function wordsFile(lang: Lang = getLang()): string {
  return lang === 'fr' ? 'words-fr.txt' : 'words.txt';
}

/**
 * Takes the accents off a word so it can be typed on any keyboard: "été" is "ete", "cœur" is "coeur". The French word
 * list is stored this way, so a player who types the accents and one who leaves them out are both right.
 */
export function foldAccents(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE');
}
