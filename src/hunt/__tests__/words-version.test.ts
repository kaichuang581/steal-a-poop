import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORDS_HASH } from '../../config';

describe('the word list version', () => {
  it('WORDS_HASH matches public/words.txt: change the list, bump WORDS_VERSION and update the hash', () => {
    const bytes = readFileSync(new URL('../../../public/words.txt', import.meta.url));
    let h = 2166136261;
    for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0;
    expect(h.toString(16).padStart(8, '0')).toBe(WORDS_HASH);
  });
});
