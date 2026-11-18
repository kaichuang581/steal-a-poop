import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LINE, nothingPlayed, numberSlips, Profile } from '../Profile';
import type { LocalNumbers, Stat } from '../Profile';

/**
 * A new player's profile (plan file 11, change 2): still six slips, the zero ones say how to fill them, one line under
 * the heading while nothing has been played, and no middle dot between phrases (Brian, 2026-11-14).
 */
describe("a new player's profile", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  });
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
  /** The "Your numbers" section of the whole page, rendered from an empty browser. */
  const numbers = () => {
    const html = renderToStaticMarkup(<Profile onClose={() => {}} />);
    const at = html.indexOf('aria-labelledby="prof-stats"');
    return html.slice(at, html.indexOf('</section>', at));
  };
  const notes = (html: string) => [...html.matchAll(/sk-prof-stat-note">(.*?)<\/span>/g)].map((m) => m[1]);

  it('shows six slips, four of them invitations, and the line', () => {
    const html = numbers();
    expect(html.match(/class="[^"]*sk-prof-stat( |")/g)).toHaveLength(6);
    expect(notes(html).slice(0, 5)).toEqual(['play a game to start', 'win a Quick Game', 'play a game', 'count sheep tonight', 'come back tomorrow night']);
    expect(html).toContain(EMPTY_LINE);
    expect(text(html)).not.toContain('·');
  });

  it('drops the line once anything is counted, and says what the slips record', () => {
    const room: Stat = { label: 'Online wins', value: '–', note: 'needs the game server' };
    const none: LocalNumbers = { words: 0, wins: 0, longest: '', dreamBest: 0, streak: 0, bestStreak: 0 };
    expect(nothingPlayed(none)).toBe(true);
    const oneWin = { ...none, wins: 1 };
    expect(nothingPlayed(oneWin)).toBe(false);
    expect(numberSlips(oneWin, room)[1].note).toBe('Quick Games won');
    for (const n of [{ words: 3 }, { longest: 'lamb' }, { dreamBest: 4 }, { streak: 1, bestStreak: 1 }]) expect(nothingPlayed({ ...none, ...n })).toBe(false);
    const played = numberSlips({ words: 12, wins: 2, longest: 'meadow', dreamBest: 9, streak: 2, bestStreak: 5 }, room);
    expect(played).toHaveLength(6);
    expect(played.map((s) => s.note)).toEqual(['played at the table', 'Quick Games won', '6 letters', 'sheep in one night', 'nights in a row, best 5', 'needs the game server']);
    expect(played.map((s) => s.note).join(' ')).not.toContain('·');
  });

  it('keeps a broken streak\'s best rather than inviting again', () => {
    const room: Stat = { label: 'Online wins', value: '–', note: '' };
    expect(numberSlips({ words: 5, wins: 0, longest: 'ewe', dreamBest: 3, streak: 0, bestStreak: 4 }, room)[4].note).toBe('nights in a row, best 4');
  });
});
