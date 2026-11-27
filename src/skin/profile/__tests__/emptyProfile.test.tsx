import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nothingPlayed, numberSlips, Profile } from '../Profile';
import type { LocalNumbers } from '../Profile';

/**
 * The profile's numbers (Brian's profile plan of 2026-11-23, section 4): five Tiles, each a value and a label line; a
 * Tile with nothing behind it shows 0 (the longest word a dash) and keeps its label. Wins are one Tile, online wins
 * joining it only when the account's are known. No player-facing text says "server". The v2 plan put the middle dot
 * back on this card (Brian, 2026-11-23).
 */
describe("the profile's numbers", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  });
  const none: LocalNumbers = { words: 0, wins: 0, longest: '', dreamBest: 0, streak: 0, bestStreak: 0 };

  it('shows five Tiles from an empty browser, zeros and a dash, labels unchanged', () => {
    const html = renderToStaticMarkup(<Profile onClose={() => {}} />);
    expect(html.match(/class="pf-tile"/g)).toHaveLength(5);
    const tiles = numberSlips(none);
    expect(tiles.map((s) => s.value)).toEqual(['0', '0', '0', '', '0']);
    expect(tiles.map((s) => s.label)).toEqual(['words played', 'Quick Game wins', 'sheep in a night', 'longest word', 'night streak, best 0']);
    // The only "server" is the developer build's own tag (import.meta.env.DEV, as in tests); players never see it.
    expect(html.replace('Server off', '').toLowerCase()).not.toContain('server');
    expect(html).not.toContain('Kept in this browser');
    expect(html.match(/saved in this browser/g)).toHaveLength(1);
  });

  it('counts what is played, and adds online wins to the one Wins Tile', () => {
    expect(nothingPlayed(none)).toBe(true);
    for (const n of [{ words: 3 }, { wins: 1 }, { longest: 'lamb' }, { dreamBest: 4 }, { streak: 1, bestStreak: 1 }]) expect(nothingPlayed({ ...none, ...n })).toBe(false);
    const played = numberSlips({ words: 12, wins: 2, longest: 'slipperiness', dreamBest: 9, streak: 2, bestStreak: 5 });
    expect(played.map((s) => s.value)).toEqual(['12', '2', '9', 'SLIPPERINESS', '2']);
    expect(played[3].label).toBe('longest word, 12 letters');
    expect(played[4].label).toBe('night streak, best 5');
    const both = numberSlips({ ...none, wins: 1 }, 3);
    expect(both[1]).toMatchObject({ value: '4', label: 'Quick 1, online 3' });
  });
});
