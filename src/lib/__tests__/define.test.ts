import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDefinitionCache,
  DEFINITION_TIMEOUT_MS,
  lookupDefinition,
} from '../define';

/** The shape the API actually returned for zephyr. */
const ZEPHYR_BODY = [
  {
    word: 'zephyr',
    phonetic: '/ˈzɛfə(ɹ)/',
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition: 'A light wind from the west.',
            synonyms: ['westerly'],
            antonyms: [],
          },
          {
            definition: 'Any soft, gentle breeze.',
            synonyms: [],
            antonyms: [],
          },
        ],
      },
    ],
    license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
    sourceUrls: ['https://en.wiktionary.org/wiki/zephyr'],
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  clearDefinitionCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearDefinitionCache();
});

describe('lookupDefinition', () => {
  it('returns the first definition and sends only the single word', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ZEPHYR_BODY));
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupDefinition('  Zephyr  ');

    expect(result).toEqual({
      status: 'ok',
      definition: {
        word: 'zephyr',
        partOfSpeech: 'noun',
        definition: 'A light wind from the west.',
        sourceUrl: 'https://en.wiktionary.org/wiki/zephyr',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.dictionaryapi.dev/api/v2/entries/en/zephyr',
    );
    expect(fetchMock.mock.calls[0][1]).toHaveProperty('signal');
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('caches a successful result in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ZEPHYR_BODY));
    vi.stubGlobal('fetch', fetchMock);

    const first = await lookupDefinition('zephyr');
    const second = await lookupDefinition('ZEPHYR');

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request when the same word is tapped twice at once', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ZEPHYR_BODY));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([lookupDefinition('zephyr'), lookupDefinition('zephyr')]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a missing word without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          title: 'No Definitions Found',
          message: "Sorry pal, we couldn't find definitions for the word you were looking for.",
        },
        404,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('notaword')).resolves.toEqual({
      status: 'unavailable',
      reason: 'not_found',
    });
  });

  it('reports a network failure without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('zephyr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'failed',
    });
  });

  it('reports a non-404 server error without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('zephyr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'failed',
    });
  });

  it('does not cache a transient failure, so a retry reaches the API again', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(ZEPHYR_BODY));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('zephyr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'failed',
    });
    await expect(lookupDefinition('zephyr')).resolves.toMatchObject({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('times out after exactly three seconds and aborts the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = lookupDefinition('zephyr');
    await vi.advanceTimersByTimeAsync(DEFINITION_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(signal?.aborted).toBe(true);
  });

  it('does not touch the network when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('zephyr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'offline',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a single word without a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const input of ['', 'two words', 'zephyr!', '../zephyr', 'a'.repeat(65)]) {
      await expect(lookupDefinition(input)).resolves.toEqual({
        status: 'unavailable',
        reason: 'invalid',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a 200 response with no definition as unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ word: 'zephyr', meanings: [] }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(lookupDefinition('zephyr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'not_found',
    });
  });
});
