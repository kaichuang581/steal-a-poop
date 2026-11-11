import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { FENCE_WORDS, STARTS } from '../../dream/dream';
import { WOTD } from '../../skin/wotd/words';
import { isInappropriateName } from '../nickname';
import { isProfaneWord } from '../profanity';
import { ChatFilter } from '../../../server/filter';

const lines = readFileSync('public/words.txt', 'utf8').split('\n');
const dict = createDictionary(lines);
// Spelled out by joining pieces, so this file can be searched for the words themselves without hitting them.
const F = ['fu', 'ck'].join(''), N = ['nig', 'ger'].join(''), N2 = ['nig', 'ga'].join(''), C = ['cu', 'nt'].join('');
const BAD = [F, `${F}ing`, `mother${F}er`, N, `${N}s`, N2, C, 'shit', 'bullshit', 'bitch', 'faggot', 'fag', 'whore', 'slut',
  'dick', 'cock', 'pussy', 'ass', 'asshole', 'bastard', 'damn', 'piss', 'crap', 'retard', 'spic', 'chink', 'kike', 'porn', 'rape', 'penis', 'sex'];
const CLEAN = ['cocktail', 'peacock', 'dickens', 'assume', 'class', 'raccoon', 'spicy', 'butter', 'basement', 'therapist',
  'wristwatch', 'saltwater', 'horns', 'congenital', 'scrape', 'grapes', 'sextant', 'sussex', 'shuttle', 'night', 'hello', 'poop'];

describe('no swears, slurs or sexual words anywhere', () => {
  it('the list knows them, and spares clean words that contain the same letters', () => {
    for (const w of BAD) expect(isProfaneWord(w), w).toBe(true);
    for (const w of CLEAN) expect(isProfaneWord(w), w).toBe(false);
  });
  it('the word list has none of them, so no table, room, bot or dream can play one', () => {
    expect(lines.filter((w) => w.trim() && isProfaneWord(w.trim()))).toEqual([]);
    for (const w of BAD) expect(dict.has(w), w).toBe(false);
    for (const w of ['cocktail', 'therapist', 'spicy', 'butter', 'basement']) expect(dict.has(w), w).toBe(true);
  });
  it('the dictionary refuses them even from a list that has them', () => {
    const d = createDictionary([F, N, 'cat']);
    expect(d.has(F)).toBe(false);
    expect(d.has(N)).toBe(false);
    expect(d.has('cat')).toBe(true);
    expect(d.startingWith('f')).toEqual([]);
  });
  it('the dream and the word of the day never show one', () => {
    for (const w of FENCE_WORDS) expect(isProfaneWord(w), w).toBe(false);
    for (const list of Object.values(STARTS)) for (const s of list) expect(isProfaneWord(s), s).toBe(false);
    for (const e of WOTD) expect(isProfaneWord(e.word), e.word).toBe(false);
  });
  it('names are refused, spaced out, in look-alike letters, or hidden in a longer name', () => {
    for (const n of [F, N, `x${N}x`, 'N1GGER', 'f.u.c.k', `Big${C}`, 'sh1t', 'b1tch', 'Dick', 'ass hat', 'mrPenis']) {
      expect(isInappropriateName(n), n).toBe(true);
    }
    for (const n of ['Cassie', 'Basement', 'Maya', 'Kai']) expect(isInappropriateName(n), n).toBe(false);
  });
  it('room chat holds them', () => {
    const filter = new ChatFilter({ blocklist: readFileSync('server/data/blocklist-en.txt', 'utf8').split('\n'), isWord: (w) => dict.has(w) });
    for (const m of [`${F} you`, `you ${N}`, 'f u c k', `n1${'gg'}er`, `${C}!`, 'shit']) expect(filter.check(m), m).toBeTruthy();
    expect(filter.check('nice word, cocktail!')).toBeFalsy();
  });
});
