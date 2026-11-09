import { describe, expect, it } from 'vitest';
import { fenceAt, FENCE_WORDS, hintWord, matched } from '../../dream/dream';

describe('the dream hint never offers a word already used tonight', () => {
  it('falls back to a longer unused word before repeating one', () => {
    const fence = { ...fenceAt('hint-test', 5), letters: ['a', 'n', 'e'] };
    const short = FENCE_WORDS.filter((w) => w.length <= 6 && matched(fence, w) === 3);
    const hint = hintWord(fence, new Set(short));
    expect(matched(fence, hint)).toBe(3);
    expect(short).not.toContain(hint);
  });
});
