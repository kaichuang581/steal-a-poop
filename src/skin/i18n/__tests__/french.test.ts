import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../../../engine/dictionary';
import { normalizeWord, validateWord } from '../../../engine/validation';
import { suggestCorrection } from '../../../engine/typos';
import { foldAccents } from '../../../lib/lang';
import { setFrench, toFrench } from '../translate';

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
