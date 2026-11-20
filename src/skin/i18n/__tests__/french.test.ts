import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../../../engine/dictionary';
import { normalizeWord, validateWord } from '../../../engine/validation';
import { suggestCorrection } from '../../../engine/typos';
import { foldAccents } from '../../../lib/lang';
import { setFrench, toFrench } from '../translate';
import { check, fenceAt, formatHint, setDreamLanguage, STARTS } from '../../../dream/dream';
import { pickFrom } from '../../wotd/pick';

const FR = JSON.parse(readFileSync('public/i18n-fr.json', 'utf8')) as Record<string, string>;
setFrench(FR);

const fr = createDictionary(readFileSync('public/words-fr.txt', 'utf8').split('\n'));
const ctx = (letter: string) => ({ dict: fr, chainLetter: letter, used: [], modifier: null as never });

describe('the French game', () => {
  it('has a French word list, stored without accents', () => {
    expect(fr.size).toBeGreaterThan(200_000);
    for (const w of ['maison', 'bonjour', 'ete', 'coeur', 'francais', 'eleve']) expect(fr.has(w)).toBe(true);
  });

  it('accepts a word typed with or without its accents', () => {
    expect(foldAccents('Été')).toBe('Ete');
    expect(normalizeWord('  Cœur ')).toBe('coeur');
    expect(validateWord('élève', ctx('e')).ok).toBe(true);
    expect(validateWord('eleve', ctx('e')).ok).toBe(true);
    expect(validateWord('Français', ctx('f')).ok).toBe(true);
  });

  it('offers a spelling fix, as the English game does', () => {
    expect(suggestCorrection('bonjuor', ctx('b'))).toBe('bonjour');
  });

  it('leaves out swear words', () => {
    for (const w of ['merde', 'putain', 'connard', 'encule']) expect(fr.has(w)).toBe(false);
  });

  it('translates the screen, keeping spaces and names', () => {
    expect(toFrench('Settings')).toBe('Réglages');
    expect(toFrench('  Play again ')).toBe('  Rejouer ');
    expect(toFrench("Maya's turn")).toBe('Au tour de Maya');
    expect(toFrench('Must start with B.')).toBe('Doit commencer par B.');
    expect(toFrench('kxln')).toBeNull();
    expect(Object.values(FR).every((v) => v.length > 0)).toBe(true);
  });
});

describe('the French dream and word of the day', () => {
  it('asks for French starts that begin plenty of French words, and takes accents', () => {
    setDreamLanguage('fr');
    try {
      for (const k of [1, 2, 3] as const) {
        for (const p of STARTS[k]) {
          const n = [...'abcdefghijklmnopqrstuvwxyz'].includes(p[0]) ? fr.startingWith(p[0]).filter((w) => w.startsWith(p) && w.length >= 3).length : 0;
          expect(n, p).toBeGreaterThan(50);
        }
      }
      const seed = 'dream:2026-11-20';
      for (let i = 0; i < 30; i++) expect(STARTS[fenceAt(seed, i).letters.length as 1 | 2 | 3]).toContain(fenceAt(seed, i).letters.join(''));
      const f = { index: 0, kind: 'fence' as const, letters: ['e'], source: '', gap: 800 };
      expect(check(fr, f, 'Été', new Set()).ok).toBe(true);
      const hint = formatHint(seed, fenceAt(seed, 0));
      if (hint) expect(fr.has(hint.word)).toBe(true);
    } finally {
      setDreamLanguage('en');
    }
  });

  it('has French words of the day, every one in the French list, for every weekday', () => {
    const all = JSON.parse(readFileSync('public/wotd-fr.json', 'utf8')) as { word: string; level: 1 | 2 | 3; short: string }[];
    for (const e of all) {
      expect(fr.has(normalizeWord(e.word.split("'").pop()!)), e.word).toBe(true);
      expect(e.short.length).toBeLessThanOrEqual(32);
    }
    const byLevel = { 1: all.filter((w) => w.level === 1), 2: all.filter((w) => w.level === 2), 3: all.filter((w) => w.level === 3) } as never;
    for (const d of ['2026-11-16', '2026-11-18', '2026-11-21']) expect(pickFrom(byLevel, d).word).toBeTruthy();
  });
});
