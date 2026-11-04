import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { dreamStreakDays, getDream, getDreamBest, getDreamStreak, markDreamStarted, recordDream } from '../daily';
import { check, dreamSeed, dreamShareText, FENCE_WORDS, fenceAt, FIELD, JUMP_MS, jumpHeight, lettersAt, matched, signOf, speedAt, takeoffDistance } from '../dream';

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

  it('asks for one letter at first, then two, three, four and five', () => {
    expect([0, 2, 3, 7, 8, 14, 15, 24, 25, 60].map(lettersAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    for (let i = 0; i < 60; i++) expect(fenceAt(SEED, i).letters).toHaveLength(lettersAt(i));
  });

  it('can always be cleared: the word the letters came from fits', () => {
    for (let i = 0; i < 80; i++) {
      const f = fenceAt(SEED, i);
      expect(check(dict, f, f.source, new Set())).toEqual({ ok: true });
    }
  });

  it('gives more time when it asks for more', () => {
    for (let i = 1; i < 80; i++) {
      const f = fenceAt(SEED, i);
      expect(f.gap).toBeGreaterThanOrEqual(2.8 + (f.letters.length - 1) * 0.35);
    }
  });

  it('takes any real word with the letters in order, with anything around and between them', () => {
    const f = { index: 0, letters: ['s', 'p'], source: 'sheep', gap: 3 };
    expect(signOf(f)).toBe('S·P');
    const none = new Set<string>();
    for (const w of ['sheep', 'stop', 'slip', 'sleepy', 'gasps', 'whisper']) expect(check(dict, f, w, none)).toEqual({ ok: true });
    expect(check(dict, f, 'pass', none)).toEqual({ ok: false, reason: 'letters' }); // wrong order
    expect(check(dict, f, 'sxp', none)).toEqual({ ok: false, reason: 'word' });
    expect(check(dict, f, 'sp', none)).toEqual({ ok: false, reason: 'short' });
    expect(check(dict, f, 'sheep', new Set(['sheep']))).toEqual({ ok: false, reason: 'used' });
    expect(matched(f, 'sh')).toBe(1);
    expect(matched(f, 'shee')).toBe(1);
    expect(matched(f, 'sheep')).toBe(2);
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
    expect(dreamStreakDays('2026-11-04').slice(-2)).toEqual([true, true]);
  });

  it('shares the count without the words', () => {
    const text = dreamShareText({ date: '2026-11-04', count: 23, longest: 9, streak: 3 });
    expect(text).toContain('23 sheep');
    expect(text).toContain('🐑🐑🐑🐑🐑');
    expect(text).toContain('9 letters');
    expect(text).toContain('3-night streak');
  });
});
