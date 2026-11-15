import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPracticeSheet, recordPracticeRun } from '../../../lib/practice';
import { PracticeBests, runLine } from '../Profile';

/**
 * The profile's practice bests (Brian, 2026-11-13: "practice best could mean easy mode, medium, or hard mode ... take in
 * account the time as well"): what the page puts on the wall for a played-in browser and for a new one.
 */
describe('practice bests on the profile', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  });
  const page = () => renderToStaticMarkup(<PracticeBests sheet={getPracticeSheet()} />);
  /** The chalk table's cells, a row a bot, as text. */
  const cells = (html: string) => [...html.matchAll(/<tr>(.*?)<\/tr>/g)].slice(1).map((r) => [...r[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));

  it('shows every setting its own best: a row a bot, a column a starting clock', () => {
    recordPracticeRun(15, 'easy', 31);
    recordPracticeRun(10, 'medium', 17);
    recordPracticeRun(10, 'hard', 12);
    recordPracticeRun(5, 'hard', 6);
    const html = page();
    expect([...html.matchAll(/<th scope="col">(\d+) s/g)].map((m) => m[1])).toEqual(['15', '10', '5']);
    expect([...html.matchAll(/<th scope="row">.*?<span>(\w+)/g)].map((m) => m[1])).toEqual(['Easy', 'Medium', 'Hard']);
    expect(cells(html)).toEqual([
      ['31 rated 31', '–', '–'],
      ['–', '17 rated 38', '–'],
      ['–', '12 rated 36', '6 rated 24'],
    ]);
  });
  it('rings the best-rated run and makes it the practice rating, with what it was', () => {
    recordPracticeRun(15, 'easy', 31);
    recordPracticeRun(10, 'hard', 12);
    const html = page();
    expect(html.match(/data-top="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-top="true"[^>]*><span class="kit-chalk-ring"><b>12<\/b>/);
    expect(html).toMatch(/Practice rating<\/span><span class="sk-prof-rating-value">36<\/span><span class="sk-prof-rating-run">12 words · Hard bot · 10 s clock/);
  });
  it('says how a run is rated, on the card and on the slate', () => {
    const html = page();
    expect(html).toContain('times 1.5 for the medium bot or a 10 s clock, times 2 for the hard bot or a 5 s clock');
    expect([...html.matchAll(/<i>(×[\d.]+)?<\/i>/g)].map((m) => m[1] ?? '')).toEqual(['', '×1.5', '×2', '', '×1.5', '×2']);
  });
  it('is honest when nothing has been played: no rating, every setting a dash', () => {
    const html = page();
    expect(html).toContain('No practice runs yet.');
    expect(html).not.toContain('data-top');
    expect(cells(html).flat()).toEqual(Array(9).fill('–'));
    expect(html).toMatch(/sk-prof-rating-value" data-none="true">–</);
  });
  it('words a run plainly', () => {
    expect(runLine({ words: 1, difficulty: 'easy', clock: 15 })).toBe('1 word · Easy bot · 15 s clock');
    expect(runLine({ words: 12, difficulty: 'hard', clock: 5 })).toBe('12 words · Hard bot · 5 s clock');
  });
});
