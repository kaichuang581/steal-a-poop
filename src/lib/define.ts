/**
 * Word definitions from the Free Dictionary API (dictionaryapi.dev).
 *
 * The API needs no key and returns Wiktionary text under CC BY-SA 3.0. A lookup can never
 * throw: an invalid word, an offline browser, a timeout and a bad response all resolve to
 * "unavailable", so the end screen can always render.
 */

export const DEFINITION_TIMEOUT_MS = 3_000;
export const DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

export interface WordDefinition {
  word: string;
  partOfSpeech: string;
  definition: string;
  sourceUrl: string | null;
}

export type DefinitionUnavailableReason = 'invalid' | 'offline' | 'timeout' | 'not_found' | 'failed';

export type DefinitionResult =
  | { status: 'ok'; definition: WordDefinition }
  | { status: 'unavailable'; reason: DefinitionUnavailableReason };

/** Successful and not-found results are kept for the rest of the page session. */
const cache = new Map<string, DefinitionResult>();
/** Two taps on the same word share one request. */
const inFlight = new Map<string, Promise<DefinitionResult>>();

/** Test hook; also lets a future UI drop the cache when it is no longer needed. */
export function clearDefinitionCache(): void {
  cache.clear();
  inFlight.clear();
}

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

function isSingleWord(word: string): boolean {
  return /^[a-z]{1,64}$/.test(word);
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Only ordinary web links are safe to put in an href. */
function externalUrl(value: unknown): string | null {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : null;
}

/** First usable definition in the first entry that has one. */
function parseDefinition(word: string, data: unknown): WordDefinition | null {
  if (!Array.isArray(data)) return null;
  for (const entry of data) {
    if (!isRecord(entry)) continue;
    const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
    for (const meaning of meanings) {
      if (!isRecord(meaning)) continue;
      const definitions = Array.isArray(meaning.definitions) ? meaning.definitions : [];
      for (const candidate of definitions) {
        if (!isRecord(candidate)) continue;
        const definition = text(candidate.definition).replace(/\s+/g, ' ');
        if (!definition) continue;
        const source = Array.isArray(entry.sourceUrls)
          ? entry.sourceUrls.find((url) => typeof url === 'string' && url.trim())
          : null;
        return {
          word: normalize(text(entry.word)) || word,
          partOfSpeech: text(meaning.partOfSpeech),
          definition,
          sourceUrl: externalUrl(source),
        };
      }
    }
  }
  return null;
}

async function requestDefinition(word: string, signal: AbortSignal): Promise<DefinitionResult> {
  try {
    const res = await fetch(`${DICTIONARY_ENDPOINT}${encodeURIComponent(word)}`, { signal });
    if (!res.ok) {
      return { status: 'unavailable', reason: res.status === 404 ? 'not_found' : 'failed' };
    }
    const definition = parseDefinition(word, await res.json());
    return definition ? { status: 'ok', definition } : { status: 'unavailable', reason: 'not_found' };
  } catch {
    return { status: 'unavailable', reason: 'failed' };
  }
}

async function fetchWithTimeout(word: string): Promise<DefinitionResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DefinitionResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: 'unavailable', reason: 'timeout' });
    }, DEFINITION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([requestDefinition(word, controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Look up one word. Always resolves; never rejects. The request URL contains only the word.
 * Successful lookups and 404s are cached in memory. Transient failures are not cached, so a
 * second tap can retry after a brief connection problem.
 */
export function lookupDefinition(raw: string): Promise<DefinitionResult> {
  const word = normalize(raw);
  if (!isSingleWord(word)) {
    return Promise.resolve({ status: 'unavailable', reason: 'invalid' });
  }
  const cached = cache.get(word);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(word);
  if (pending) return pending;
  if (isOffline()) {
    return Promise.resolve({ status: 'unavailable', reason: 'offline' });
  }

  const lookup = fetchWithTimeout(word)
    .catch(() => ({ status: 'unavailable', reason: 'failed' }) as DefinitionResult)
    .then((result) => {
      if (result.status === 'ok' || result.reason === 'not_found') cache.set(word, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(word);
    });
  inFlight.set(word, lookup);
  return lookup;
}
