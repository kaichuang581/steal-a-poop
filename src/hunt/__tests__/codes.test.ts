import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORDS_VERSION } from '../../config';
import { createDictionary } from '../../engine/dictionary';
import { ALPHABET, isLegacySeed, newCode, parseCode, seedOf, versionDigit } from '../codes';
import { predatorAt } from '../hunt';
import { attemptOf, lastPack, ordinal, PACKS_MAX, readPacks, recordAttempt } from '../packs';
import { memoryStorage } from './helpers';

const words = readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8').split('\n');
const dict = createDictionary(words);

describe('pack codes', () => {
  it('newCode makes five symbols from the alphabet with the version digit last', () => {
    let s = 7;
    const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const c = newCode(random);
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}$/);
      expect([...c].every((x) => ALPHABET.includes(x))).toBe(true);
      expect(c[4]).toBe(versionDigit(WORDS_VERSION));
    }
  });

  it('parseCode accepts lower case and maps I, L, O and U; rejects the wrong length or symbols', () => {
    const v = versionDigit();
    expect(parseCode(`k7qx${v.toLowerCase()}`)).toEqual({ code: `K7QX${v}`, version: WORDS_VERSION % 32, stale: false });
    expect(parseCode(`ilou${v}`)!.code).toBe(`110V${v}`);
    expect(parseCode(` k7-qx${v} `)!.code).toBe(`K7QX${v}`);
    expect(parseCode('K7QX')).toBeNull();
    expect(parseCode('K7QX11')).toBeNull();
    expect(parseCode('K7Q!1')).toBeNull();
    expect(parseCode('')).toBeNull();
  });

  it('flags a code made with another word list as stale', () => {
    const other = ALPHABET[(WORDS_VERSION + 1) % 32];
    expect(parseCode(`K7QX${other}`)).toMatchObject({ stale: true, version: (WORDS_VERSION + 1) % 32 });
  });

  it('the code is the seed, and old seeds are told apart', () => {
    expect(seedOf('K7QX1')).toBe('pack:K7QX1');
    expect(isLegacySeed('hunt:123:abc')).toBe(true);
    expect(isLegacySeed(seedOf('K7QX1'))).toBe(false);
  });

  it('the same code gives the same pack, across calls and dictionaries', () => {
    const other = createDictionary(words);
    for (let i = 0; i < 10; i++) {
      // Rules carry their test as a function, a new closure each time, so compare everything else.
      expect(JSON.stringify(predatorAt(dict, seedOf('K7QX1'), i))).toBe(JSON.stringify(predatorAt(other, seedOf('K7QX1'), i)));
    }
  });

  it('two different codes differ in at least one predator within the first three', () => {
    const sig = (code: string) => [0, 1, 2].map((i) => { const p = predatorAt(dict, seedOf(code), i); return `${p.kind}:${p.attack}:${p.rules.map((r) => r.id)}:${p.reserve?.id}`; }).join('|');
    const codes = ['K7QX1', 'K7QY1', '00001', 'ZZZZ1', 'M4RS1'];
    for (let a = 0; a < codes.length; a++) for (let b = a + 1; b < codes.length; b++) expect(sig(codes[a])).not.toBe(sig(codes[b]));
  });
});

describe('packs played', () => {
  let done: () => void;
  beforeEach(() => { done = memoryStorage().done; });
  afterEach(() => done());

  it('counts attempts per code and keeps each code\'s best', () => {
    expect(attemptOf('K7QX1')).toBe(1);
    expect(recordAttempt('K7QX1', { defeated: 1, damage: 50 })).toBe(1);
    expect(attemptOf('K7QX1')).toBe(2);
    recordAttempt('K7QX1', { defeated: 0, damage: 90 });
    recordAttempt('AAAA1', { defeated: 3, damage: 10 });
    expect(readPacks().find((p) => p.code === 'K7QX1')).toEqual({ code: 'K7QX1', attempts: 2, best: { defeated: 1, damage: 50 } });
    expect(lastPack()!.code).toBe('AAAA1');
    recordAttempt('K7QX1', { defeated: 2, damage: 10 });
    expect(lastPack()).toEqual({ code: 'K7QX1', attempts: 3, best: { defeated: 2, damage: 10 } });
  });

  it('keeps the last 100 codes', () => {
    for (let i = 0; i < PACKS_MAX + 5; i++) recordAttempt(`C${String(i).padStart(3, '0')}1`, { defeated: 0, damage: 1 });
    expect(readPacks()).toHaveLength(PACKS_MAX);
    expect(attemptOf('C0001')).toBe(1);
  });

  it('says 1st, 2nd, 3rd, 4th, 11th, 12th, 21st', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
});
