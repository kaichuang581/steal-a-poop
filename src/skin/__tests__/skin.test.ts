import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apply } from '../../engine';
import { ctx, humanTurn, T0 } from '../../engine/__tests__/helpers';
import { hourFor, seasonFor } from '../model/clock';
import { mapEngineEvent, thawedFor } from '../model/events';
import { creatureFor, toTableView } from '../model/useTableView';
import { isPaintedSkin } from '../flag';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const tok = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('painted tokens', () => {
  it.each([
    ['ink', 'paper', 11.7],
    ['ink-soft', 'paper', 4.7],
    ['button-text', 'wood-dark', 5.3],
    ['button-text', 'cloth-dark', 5.7],
    ['button-text', 'coral-dark', 4.9],
  ])('%s on %s has contrast %s:1', (fg, bg, want) => {
    const ratio = contrast(tok(fg), tok(bg));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(ratio - want)).toBeLessThanOrEqual(0.1);
  });
  it('uses no pure black', () => {
    expect(css.toLowerCase()).not.toContain('#000000');
  });
});

describe('skin flag', () => {
  it('is painted by default; the query wins, then the build setting', () => {
    expect(isPaintedSkin(new URLSearchParams(''), undefined)).toBe(true);
    expect(isPaintedSkin(new URLSearchParams('skin=classic'), undefined)).toBe(false);
    expect(isPaintedSkin(new URLSearchParams(''), 'classic')).toBe(false);
    expect(isPaintedSkin(new URLSearchParams('skin=painted'), 'classic')).toBe(true);
  });
});

describe('clock', () => {
  it('bands the hours and seasons', () => {
    expect(hourFor(new Date(2026, 0, 1, 6))).toBe('dawn');
    expect(hourFor(new Date(2026, 0, 1, 12))).toBe('day');
    expect(hourFor(new Date(2026, 0, 1, 18))).toBe('dusk');
    expect(hourFor(new Date(2026, 0, 1, 23))).toBe('night');
    expect(seasonFor(new Date(2026, 10, 3))).toBe('autumn');
    expect(seasonFor(new Date(2026, 10, 3), false)).toBe('spring');
  });
});

describe('view model and events', () => {
  it('maps the store to a TableView', () => {
    const g = humanTurn('c');
    // Read as the fuse is lit: before that nobody has the floor (the beat after a bomb, see the next test).
    const lit = g.turn!.startedAt;
    const v = toTableView(g, 'tour', 0, lit)!;
    expect(v.mode).toBe('tutorial');
    expect(v.phase).toBe('turn');
    expect(v.letter).toBe('c');
    expect(v.currentPlayerId).toBe('0');
    expect(v.players[0]).toMatchObject({ isYou: true, isBot: false, creature: creatureFor(0) });
    expect(v.secondsLeft).toBeCloseTo((g.turn!.endsAt - lit) / 1000);
  });

  it('in the beat after a bomb nobody has the floor, the next sheep is named, and the clock stands full', () => {
    const g = humanTurn('c');
    const before = toTableView(g, 'quick', 0, g.turn!.startedAt - 1000)!;
    expect(before.currentPlayerId).toBe('');
    expect(before.nextPlayerId).toBe('0');
    expect(before.secondsLeft).toBe(g.turn!.durationMs / 1000);
    expect(toTableView(g, 'quick', 0, g.turn!.startedAt + 1000)!.secondsLeft).toBeCloseTo(g.turn!.durationMs / 1000 - 1);
  });

  it('turns an accepted play into an accepted visual event', () => {
    const g = humanTurn('c');
    const res = apply(g, ctx, { type: 'play', seat: 0, word: 'cat' }, T0 + 10);
    expect(res.accepted).toBe(true);
    const e = res.state.events.find((x) => x.kind === 'play')!;
    expect(mapEngineEvent(e, g, res.state)).toEqual([{ type: 'accepted', playerId: '0', word: 'cat', points: e.amount }]);
  });

});

describe('lives in the skin', () => {
  it('maps life events and thaws last game’s frozen seats', () => {
    const g = humanTurn('c');
    const lost = { id: 50, at: 0, kind: 'lifeLost' as const, seat: 2, text: '', amount: 1 };
    const froze = { id: 51, at: 0, kind: 'frozen' as const, seat: 2, text: '', amount: 0 };
    expect(mapEngineEvent(lost, g, g)).toEqual([{ type: 'lifeLost', playerId: '2', livesLeft: 1 }]);
    expect(mapEngineEvent(froze, g, g)).toEqual([{ type: 'frozen', playerId: '2' }]);
    expect(thawedFor([1, 3], g)).toEqual([{ type: 'thawed', playerId: '1' }, { type: 'thawed', playerId: '3' }]);
    expect(toTableView(g, 'quick', 0, T0)!.players[0]).toMatchObject({ lives: 3, frozen: false });
  });
});
