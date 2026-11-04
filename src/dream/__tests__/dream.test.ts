import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { dreamStreakDays, getDream, getDreamBest, getDreamStreak, markDreamStarted, recordDream } from '../daily';
import { dreamSeed, dreamShareText, faceOf, FENCE_WORDS, fenceAt, FIELD, JUMP_MS, jumpHeight, speedAt, takeoffDistance, tryFill } from '../dream';

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
    expect(b.map((f) => f.word)).not.toEqual(a.map((f) => f.word));
  });

  it('starts with one blank in short words and gets harder', () => {
    for (let i = 0; i < 5; i++) {
      const f = fenceAt(SEED, i);
      expect(f.blanks).toHaveLength(1);
      expect(f.word.length).toBeLessThanOrEqual(4);
    }
    const late = Array.from({ length: 30 }, (_, i) => fenceAt(SEED, 40 + i));
    expect(late.every((f) => f.blanks.length >= 2 && f.word.length >= 5)).toBe(true);
    expect(late.every((f) => f.blanks.length < f.word.length)).toBe(true);
  });

  it('gives time to type: never less than about two seconds a fence, more for more blanks', () => {
    for (let i = 0; i < 80; i++) {
      const f = fenceAt(SEED, i);
      expect(f.gap).toBeGreaterThanOrEqual(2.1 + (f.blanks.length - 1) * 0.55);
    }
  });

  it('shows the blanks and fills them in order', () => {
    const f = { index: 0, word: 'sheep', blanks: [2, 3], gap: 3 };
    expect(faceOf(f, '')).toBe('SH__P');
    expect(faceOf(f, 'e')).toBe('SHE_P');
    expect(faceOf(f, 'ee')).toBe('SHEEP');
  });

  it('accepts any real word that fits, not only the one the fence was cut from', () => {
    const f = { index: 0, word: 'cat', blanks: [1], gap: 3 };
    expect(tryFill(dict, f, '')).toBe('more');
    expect(tryFill(dict, f, 'a')).toBe('ok');
    expect(tryFill(dict, f, 'u')).toBe('ok');
    expect(tryFill(dict, f, 'x')).toBe('wrong');
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
    const text = dreamShareText({ date: '2026-11-04', count: 23, lucid: 2, streak: 3 });
    expect(text).toContain('23 sheep');
    expect(text).toContain('🐑🐑🐑🐑🐑');
    expect(text).toContain('2 lucid jumps');
    expect(text).toContain('3-night streak');
  });
});
