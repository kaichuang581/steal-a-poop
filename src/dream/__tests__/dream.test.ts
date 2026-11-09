import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { dreamStreakDays, getDream, getDreamBest, getDreamStreak, markDreamStarted, recordDream } from '../daily';
import { BALE_PAIRS_FROM, BALES_FROM, check, formatHint, NO_REPEAT, STARTS, dreamSeed, dreamGlyphs, dreamShareText, dreamSummary, FENCE_WORDS, fenceAt, FIELD, JUMP_MS, jumpHeight, lettersAt, matched, signOf, speedAt, takeoffDistance } from '../dream';

const words = readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8').split('\n');
const dict = createDictionary(words);
const SEED = dreamSeed('2026-11-04');

describe('fences', () => {
  it('every fence word is a real word', () => {
    expect(FENCE_WORDS.filter((w) => !dict.has(w))).toEqual([]);
  });

  it('is the same dream for everyone on a day, and a different one the next day', () => {
    const a = Array.from({ length: 40 }, (_, i) => fenceAt(SEED, i));
    expect(Array.from({ length: 40 }, (_, i) => fenceAt(SEED, i))).toEqual(a);
    const b = Array.from({ length: 40 }, (_, i) => fenceAt(dreamSeed('2026-11-05'), i));
    expect(b.map((f) => f.letters.join(''))).not.toEqual(a.map((f) => f.letters.join('')));
  });

  it('asks for one letter at first, then two, then three, and never more', () => {
    expect([0, 4, 5, 15, 16, 29, 60].map(lettersAt)).toEqual([1, 1, 2, 2, 3, 3, 3]);
    for (let i = 0; i < 60; i++) if (fenceAt(SEED, i).kind === 'fence') expect(fenceAt(SEED, i).letters).toHaveLength(lettersAt(i));
  });

  it('asks only for common starts from the list (Brian, 2026-11-09: "common starting like GR, not stuff like LK")', () => {
    for (const seed of [SEED, dreamSeed('2026-12-25')]) for (let i = 0; i < 60; i++) {
      const f = fenceAt(seed, i);
      expect(STARTS[f.letters.length as 1 | 2 | 3]).toContain(f.letters.join(''));
    }
  });

  it('every start in the list begins plenty of real words', () => {
    const real = words.filter((w) => w.length >= 3);
    const need = { 1: 400, 2: 60, 3: 25 } as const;
    for (const k of [1, 2, 3] as const) for (const p of STARTS[k]) {
      expect(real.filter((w) => w.startsWith(p)).length, p).toBeGreaterThanOrEqual(need[k]);
    }
  });

  it('does not ask for the same start again within a few fences', () => {
    for (let d = 1; d <= 10; d++) {
      const starts = Array.from({ length: 40 }, (_, i) => fenceAt(dreamSeed(`2026-10-${String(d).padStart(2, '0')}`), i).letters.join(''));
      for (let i = 1; i < starts.length; i++) expect(starts.slice(Math.max(0, i - 4), i)).not.toContain(starts[i]);
    }
  });

  it('mixes up the start letters (Brian, 2026-11-09: "the letter s 5 times in a row")', () => {
    for (let d = 1; d <= 30; d++) {
      const seed = dreamSeed(`2026-12-${String(d).padStart(2, '0')}`);
      const firsts = Array.from({ length: 40 }, (_, i) => fenceAt(seed, i).letters[0]);
      // Never the same start letter as either of the last two fences.
      for (let i = 1; i < firsts.length; i++) for (let back = 1; back <= Math.min(NO_REPEAT, i); back++) expect(firsts[i]).not.toBe(firsts[i - back]);
      // A night of 30 fences uses plenty of letters, and none takes over.
      const night = firsts.slice(0, 30);
      expect(new Set(night).size).toBeGreaterThanOrEqual(8);
      for (const l of new Set(night)) expect(night.filter((x) => x === l).length).toBeLessThanOrEqual(7);
    }
  });

  it('can always be cleared: its fence word, when it has one, fits', () => {
    for (let i = 0; i < 80; i++) {
      const f = fenceAt(SEED, i);
      if (f.source) expect(check(dict, f, f.source, new Set())).toEqual({ ok: true });
    }
  });

  it('gives more time when it asks for more', () => {
    for (let i = 1; i < 80; i++) {
      const f = fenceAt(SEED, i);
      if (f.kind === 'fence') expect(f.gap).toBeGreaterThanOrEqual(400 + (f.letters.length - 1) * 10);
    }
  });

  it('takes any real word that starts with the letters, and nothing else', () => {
    const f = { index: 0, kind: 'fence' as const, letters: ['g', 'r'], source: 'grass', gap: 400 };
    expect(signOf(f)).toBe('GR…');
    const none = new Set<string>();
    for (const w of ['grass', 'green', 'grow', 'grumpy']) expect(check(dict, f, w, none)).toEqual({ ok: true });
    // The letters inside the word, or apart, no longer count (Brian, 2026-11-09: "make it starting").
    for (const w of ['agree', 'gear', 'garden', 'rag']) expect(check(dict, f, w, none)).toEqual({ ok: false, reason: 'letters' });
    expect(check(dict, f, 'grx', none)).toEqual({ ok: false, reason: 'word' });
    expect(check(dict, f, 'gr', none)).toEqual({ ok: false, reason: 'short' });
    expect(check(dict, f, 'grass', new Set(['grass']))).toEqual({ ok: false, reason: 'used' });
    expect(matched(f, 'g')).toBe(1);
    expect(matched(f, 'gar')).toBe(1);
    expect(matched(f, 'gra')).toBe(2);
    expect(matched(f, 'agr')).toBe(0);
  });
});

describe('running and jumping', () => {
  it('speeds up with the count, up to a cap', () => {
    expect(speedAt(0)).toBeLessThan(speedAt(10));
    expect(speedAt(100)).toBe(speedAt(200));
  });

  it('a jump taken at the take-off point clears the fence', () => {
    for (const count of [0, 10, 40]) {
      const v = speedAt(count);
      const start = FIELD.sheepX + FIELD.sheepW + takeoffDistance(v); // the fence's left edge at take-off
      // While the fence overlaps the sheep, the sheep is higher than the fence.
      for (let ms = 0; ms <= JUMP_MS; ms += 5) {
        const fenceLeft = start - (v * ms) / 1000;
        const overlaps = fenceLeft < FIELD.sheepX + FIELD.sheepW - 3 && fenceLeft + FIELD.fenceW > FIELD.sheepX + 3;
        if (overlaps) expect(jumpHeight(ms)).toBeGreaterThan(FIELD.fenceH - 6);
      }
    }
  });
});

describe('daily dream', () => {
  // A minimal in-memory localStorage for the node test environment.
  beforeEach(() => {
    const data = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
      key: () => null,
      get length() { return data.size; },
    } as Storage;
  });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('counts starting as the night\'s attempt and keeps a streak', () => {
    expect(getDream('2026-11-04')).toBeNull();
    markDreamStarted('2026-11-04');
    expect(getDream('2026-11-04')?.status).toBe('started');
    expect(recordDream({ date: '2026-11-03', status: 'done', count: 3 })).toBe(1);
    expect(recordDream({ date: '2026-11-04', status: 'done', count: 12 })).toBe(2);
    expect(getDreamStreak('2026-11-05')).toBe(2);
    expect(getDreamStreak('2026-11-07')).toBe(0);
    expect(getDreamBest()).toBe(12);
    expect(dreamStreakDays('2026-11-04').slice(-2)).toEqual(['played', 'played']);
  });

  it('shares the count without the words', () => {
    const text = dreamShareText({ date: '2026-11-04', count: 23, longest: 9, streak: 3 });
    expect(text).toContain('23 sheep');
    expect(text).toContain('9 letters');
    expect(text).toContain('3-night streak');
  });
});

describe('the hint and the share text (V4 Part 13)', () => {
  it('hints only on the first fence of each new length, and never with the fence\'s own start', () => {
    for (let d = 1; d <= 10; d++) {
      const seed = dreamSeed(`2026-09-${String(d).padStart(2, '0')}`);
      const hinted: number[] = [];
      for (let i = 0; i < 40; i++) {
        const f = fenceAt(seed, i);
        const h = formatHint(seed, f);
        if (!h) continue;
        hinted.push(f.letters.length);
        expect(h.start).not.toBe(f.letters.join(''));
        expect(h.start[0]).not.toBe(f.letters[0]); // never even the same first letter: no answer handed over
        expect(h.word.startsWith(h.start)).toBe(true);
        expect(dict.has(h.word)).toBe(true);
      }
      expect(hinted).toEqual([1, 2, 3]);
    }
  });

  it('writes the glyph row by letters asked, grouped in fives, the bump last, with the painted title', () => {
    const t = (count: number) => dreamShareText({ date: '2026-11-06', count, longest: 8, streak: 5, blankets: 1, bumped: true, title: 'Finish the Word' });
    expect(t(0).split('\n')[2]).toBe('⬛');
    expect(t(3).split('\n')[2]).toBe('🟩🟩🟩⬛');
    expect(t(12).split('\n')[2]).toBe('🟩🟩🟩🟩🟩 🟦🟦🟦🟦🟦 🟦🟦⬛');
    const forty = t(41).split('\n');
    expect(forty[0]).toBe('Finish the Word · Counting Sheep 2026-11-06');
    expect(forty[1]).toBe('The farmer counted 41 sheep then woke up');
    expect(forty[2].split(' ')).toHaveLength(8);
    expect(forty[3].split(' ')).toHaveLength(1);
    expect(forty[4]).toBe('Longest word: 8 letters');
    expect(forty[5]).toBe('5-night streak · 🛏 1 Warm Blanket');
  });
});

describe('the pace, the bales and the night\'s ending', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => dreamSeed(`2026-12-${String(i + 1).padStart(2, '0')}`));
  const seconds = (seed: string, i: number) => fenceAt(seed, i).gap / speedAt(i);

  it('starts with wide gaps and closes them with speed, not distance, like the offline dinosaur', () => {
    const fencesOnly = (from: number, to: number) => seeds.flatMap((s) => Array.from({ length: to - from }, (_, k) => from + k).filter((i) => fenceAt(s, i).kind === 'fence'));
    expect(fencesOnly(1, 6).length).toBeGreaterThan(0);
    for (const s of seeds) {
      // The opening fences still give time to find the game (faster since 2026-11-09: the first above 6 s, the first
      // few above 4.5 s).
      expect(seconds(s, 1)).toBeGreaterThan(6);
      for (let i = 1; i < 8; i++) expect(seconds(s, i)).toBeGreaterThan(4.5);
      for (let i = 1; i < 60; i++) if (fenceAt(s, i).kind === 'fence') {
        expect(fenceAt(s, i).gap).toBeGreaterThanOrEqual(760);
        expect(fenceAt(s, i).gap).toBeLessThan(900);
        expect(seconds(s, i)).toBeGreaterThan(2.3); // the floor, at top speed
      }
    }
    expect(speedAt(29)).toBeGreaterThan(speedAt(0) * 2); // a night ends at more than twice the speed it starts
  });

  it('never asks for something ordinary words cannot answer', () => {
    for (const s of seeds) for (let i = 0; i < 40; i++) {
      const f = fenceAt(s, i);
      expect(f.letters.length).toBeLessThanOrEqual(3);
      expect(f.letters.join('')).not.toMatch(/[jqvxz]/);
    }
  });

  it('brings in bales only from fence 8, more often later, never three in a row, and always a quick ask', () => {
    let early = 0, late = 0;
    for (const s of seeds) {
      for (let i = 0; i < 60; i++) {
        const f = fenceAt(s, i);
        if (i < BALES_FROM) expect(f.kind).toBe('fence');
        if (f.kind !== 'bale') continue;
        if (i < 18) early++; else if (i < 28) late++;
        expect(f.letters).toHaveLength(1);
        expect(f.gap).toBeLessThan(350);
        if (i < BALE_PAIRS_FROM) expect(fenceAt(s, i - 1).kind).toBe('fence');
        expect(fenceAt(s, i - 1).kind === 'bale' && fenceAt(s, i - 2).kind === 'bale').toBe(false);
      }
    }
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early * 0.9);
  });

  it('tells a finished night in one line, with each bump in its place and the link', () => {
    const fences = 30, bumps = [11];
    const text = dreamShareText({ date: '2026-11-07', count: 29, longest: 9, streak: 2, bumped: false, fences, bumps, seed: seeds[0], title: 'Finish the Word', url: 'https://example.test/game/' }).split('\n');
    expect(text[0]).toBe('Finish the Word · Counting Sheep 2026-11-07');
    expect(text[1]).toBe('Asleep after 30 fences, one bump, longest word 9 letters');
    expect([...text.slice(2, -2).join('').replace(/\s/g, '')].filter((c) => c === '⬛')).toHaveLength(1);
    expect(text.at(-1)).toBe('https://example.test/game/');
    expect(dreamSummary({ fences: 30, bumps: [], longest: 7 })).toBe('Asleep after 30 fences, no bumps, longest word 7 letters');
    expect(dreamGlyphs(4, true, { bumps: [1, 5] }).replace(/\s/g, '')).toBe('🟩⬛🟩🟩🟩⬛');
  });

  it('colours the glyph row by what each position really asked, bales included', () => {
    const s = seeds.find((x) => Array.from({ length: 30 }, (_, i) => fenceAt(x, i).kind).includes('bale'))!;
    const at = Array.from({ length: 30 }, (_, i) => i).find((i) => fenceAt(s, i).kind === 'bale')!;
    const row = [...dreamGlyphs(at + 1, false, { seed: s }).replace(/\s/g, '')];
    expect(row[at]).toBe('🟩');
  });
});
