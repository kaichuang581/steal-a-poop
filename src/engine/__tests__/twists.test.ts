import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickBotWord } from '../bots';
import { createDictionary } from '../dictionary';
import { ALL_MODIFIERS, createGame, dailySetup, modifierForRound } from '../game';
import { suggestWords } from '../hints';
import { hasPlayableWord, validateWord } from '../validation';
import type { RoundModifier } from '../types';

const words = readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8').split('\n');
const dict = createDictionary(words);
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

describe('more twists (Brian, 2026-11-08)', () => {
  it('round 1 is plain and no later round is, over many seeds', () => {
    let later = 0;
    let plain = 0;
    for (let i = 0; i < 200; i++) {
      const s = createGame({ seed: `seed-${i}`, now: 0, humanName: 'Me', playerCount: 4, difficulty: 'medium' }, dict);
      expect(modifierForRound(s.modifierDeck, 1)).toBe('none');
      for (let round = 2; round <= 20; round++, later++) if (modifierForRound(s.modifierDeck, round) === 'none') plain++;
    }
    expect(plain / later).toBe(0);
  });

  it('cycles every twist once before repeating, and stays plain with twists off', () => {
    const deck: RoundModifier[] = ['none', ...ALL_MODIFIERS];
    const firstPass = ALL_MODIFIERS.map((_, i) => modifierForRound(deck, i + 2));
    expect(firstPass).toEqual(ALL_MODIFIERS);
    expect(modifierForRound(deck, ALL_MODIFIERS.length + 2)).toBe(ALL_MODIFIERS[0]);
    expect(modifierForRound(['none'], 7)).toBe('none');
  });

  it('a daily game deals everyone the same deck', () => {
    const day = new Date('2026-11-08T12:00:00Z');
    const a = createGame(dailySetup(day, 'A', 0), dict);
    const b = createGame(dailySetup(day, 'B', 999), dict);
    expect(a.modifierDeck).toEqual(b.modifierDeck);
  });

  const ctx = (chainLetter: string, modifier: RoundModifier) => ({ dict, chainLetter, used: [], modifier });
  it.each([
    ['no_a', 'bottle', 'banana', 'modifier_no_a'],
    ['no_s', 'cattle', 'cats', 'modifier_no_s'],
    ['five_max', 'tiger', 'tigers', 'modifier_five_max'],
    ['ends_vowel', 'piano', 'pianos', 'modifier_ends_vowel'],
    ['has_o', 'robin', 'rabbit', 'modifier_has_o'],
  ] as const)('%s accepts %s and rejects %s', (modifier, good, bad, reason) => {
    expect(validateWord(good, ctx(good[0], modifier)).ok).toBe(true);
    expect(validateWord(bad, ctx(bad[0], modifier))).toEqual({ ok: false, reason });
  });

  it.each(ALL_MODIFIERS)('%s: every letter a legal word can end on still has legal words, for players, bots and hints', (modifier) => {
    const ends = new Set<string>();
    for (const l of ALPHABET) for (const w of dict.startingWith(l)) if (validateWord(w, ctx(l, modifier)).ok) ends.add(w[w.length - 1]);
    expect(ends.size).toBeGreaterThan(0);
    for (const l of ends) {
      expect(hasPlayableWord(dict, l, [], modifier), `${modifier} after a word ending in ${l}`).toBe(true);
      const bot = pickBotWord({ dict, chainLetter: l, used: [], modifier, prefer: 'any', random: () => 0.5 });
      expect(bot && validateWord(bot, ctx(l, modifier)).ok).toBe(true);
      for (const hint of suggestWords({ dict, chainLetter: l, used: [], modifier, count: 3, random: () => 0.5 })) {
        expect(validateWord(hint, ctx(l, modifier)).ok).toBe(true);
      }
    }
  });
});
