import { describe, expect, it } from 'vitest';
import { practiceRating } from '../../../lib/practice';
import { reportTitle } from '../reportChalk';

describe('the report (P4)', () => {
  it('titles a run by its count and best', () => {
    const d = { words: 9, best: 21, newBest: false, clockFrom: 15, clockTo: 14, bot: 'Easy', rating: 9 };
    expect(reportTitle(d)).toBe('Warm-up done');
    expect(reportTitle({ ...d, words: 10 })).toBe('Good session');
    expect(reportTitle({ ...d, words: 23, newBest: true })).toBe('New best!');
  });
  it("P4's example: 23 words, easy bot, 15 s clock, is rated 23", () => {
    expect(practiceRating(15, 'easy', 23)).toBe(23);
  });
});
