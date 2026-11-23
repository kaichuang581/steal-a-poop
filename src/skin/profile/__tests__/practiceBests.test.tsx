import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPracticeSheet, PRACTICE_BOTS, PRACTICE_WEIGHT, recordPracticeRun } from '../../../lib/practice';
import { cellTip, PracticeBests, ratingSum, runLine } from '../Profile';

/**
 * The profile's practice (Brian's profile plan of 2026-11-23, section 7): every setting's best in a grid of wells, the
 * best one a lantern tile, the best rating with its sum written out, and every "rated" number words × bot × clock.
 */
describe('practice on the profile', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  });
  const page = () => renderToStaticMarkup(<PracticeBests sheet={getPracticeSheet()} />);
  const cells = (html: string) => [...html.matchAll(/role="cell"[^>]*>(.*?)(?=<span role="cell"|<\/span><\/span><span role="row"|<\/span><\/span><\/div>)/g)].map((m) => m[1].replace(/<span class="pf-tip".*$/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

  it('shows every setting its own best, and only the filled ones carry numbers', () => {
    recordPracticeRun(15, 'easy', 31);
    recordPracticeRun(10, 'medium', 17);
    recordPracticeRun(10, 'hard', 12);
    recordPracticeRun(5, 'hard', 6);
    expect(cells(page())).toEqual(['31 rated 31', '', '', '', '17 rated 38', '', '', '12 rated 36', '6 rated 24']);
  });

  it('every rating is words × bot × clock, rounded as lib/practice.ts rounds it, for every cell', () => {
    for (const d of PRACTICE_BOTS) for (const c of [15, 10, 5]) recordPracticeRun(c, d, 7);
    const sheet = getPracticeSheet();
    for (const row of sheet.rows) for (const cell of row.cells) {
      const want = Math.round(cell.words * PRACTICE_WEIGHT.bot[cell.difficulty] * PRACTICE_WEIGHT.clock[cell.clock]);
      expect(cell.rating, `${cell.difficulty} ${cell.clock}`).toBe(want);
      expect(ratingSum(cell).product).toBeCloseTo(cell.words * PRACTICE_WEIGHT.bot[cell.difficulty] * PRACTICE_WEIGHT.clock[cell.clock]);
    }
    expect(sheet.top?.rating).toBe(Math.round(7 * 2 * 2));
  });

  it('makes the best-rated run a lantern tile and the best rating, with its sum', () => {
    recordPracticeRun(15, 'easy', 31);
    recordPracticeRun(5, 'hard', 24);
    const html = page();
    expect(html.match(/data-top="true"/g)).toHaveLength(1);
    expect(html).toMatch(/pf-rating-value">96</);
    expect(html).toContain('24 words, Hard, 5 s');
    expect(html).toContain('24 times 2 times 2 equals 96');
    expect(html).not.toContain('·');
  });

  it('writes the tooltip with the rounding when there is one', () => {
    recordPracticeRun(10, 'medium', 6);
    const cell = getPracticeSheet().rows[1].cells[1];
    expect(cellTip(cell)).toBe('6 words, Medium bot, 10\u202Fs clock: 6 \u00D7 1.5 \u00D7 1.5 = 13.5, rounded to 14');
  });

  it('is honest when nothing has been played', () => {
    const html = page();
    expect(html).toContain('Finish a practice run to get a rating.');
    expect(html).not.toContain('data-top');
    expect(html.match(/data-none="true"/g)?.length).toBe(10);
    expect(runLine({ words: 1, difficulty: 'easy', clock: 15 })).toBe('1 word, Easy, 15 s');
  });
});
