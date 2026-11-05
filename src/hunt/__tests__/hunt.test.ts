import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { getHuntBest, huntShareText, recordHuntBest } from '../record';
import { activeRules, applyItem, attack, countWords, dailySeed, damageFor, hintWord, ITEMS, MILK_HEAL, nextPredator, predatorAt, startRun, timeOut, turnSeconds } from '../hunt';
import type { Run } from '../hunt';
import { banLetter, CHAIN, DOUBLE, ENDS_VOWEL, LONGER, maxLength, minConsonants, minLength, minVowels, mustContain, NO_FIRST_AGAIN, NO_REPEAT, STARTS_VOWEL } from '../rules';

const words = readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8').split('\n');
const dict = createDictionary(words);
const SEED = dailySeed('2026-11-04');

describe('rules', () => {
  it('each rule tests what it says', () => {
    const none = { prev: null };
    expect(minLength(6).test('garden', none)).toBe(true);
    expect(minLength(6).test('gate', none)).toBe(false);
    expect(maxLength(5).test('sheep', none)).toBe(true);
    expect(maxLength(5).test('sheeps', none)).toBe(false);
    expect(minConsonants(3).test('frost', none)).toBe(true);
    expect(minConsonants(3).test('area', none)).toBe(false);
    expect(minVowels(3).test('audio', none)).toBe(true);
    expect(banLetter('e').test('sheep', none)).toBe(false);
    expect(mustContain('w').test('wool', none)).toBe(true);
    expect(NO_REPEAT.test('wolf', none)).toBe(true);
    expect(NO_REPEAT.test('sheep', none)).toBe(false);
    expect(DOUBLE.test('sheep', none)).toBe(true);
    expect(ENDS_VOWEL.test('banana', none)).toBe(true);
    expect(STARTS_VOWEL.test('ice', none)).toBe(true);
  });

  it('the chain rules read the previous word and stand aside for the first one', () => {
    expect(CHAIN.test('tree', { prev: 'cat' })).toBe(true);
    expect(CHAIN.test('dog', { prev: 'cat' })).toBe(false);
    expect(CHAIN.test('dog', { prev: null })).toBe(true);
    expect(LONGER.test('cat', { prev: 'sheep' })).toBe(false);
    expect(LONGER.test('meadow', { prev: 'sheep' })).toBe(true);
    expect(LONGER.test('wonderful', { prev: 'extraordinarily' })).toBe(true); // capped at 9
    expect(NO_FIRST_AGAIN.test('sun', { prev: 'sheep' })).toBe(false);
  });
});

describe('predators', () => {
  it('are the same for everyone on a day, and differ between days', () => {
    const a = predatorAt(dict, SEED, 3), b = predatorAt(dict, SEED, 3);
    expect(a.kind).toBe(b.kind);
    expect(a.rules.map((r) => r.id)).toEqual(b.rules.map((r) => r.id));
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05'].map((d) => predatorAt(dict, dailySeed(d), 3).rules.map((r) => r.id).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('bring more rules and hit harder the further the sheep gets, with a boss every fifth', () => {
    const p = [0, 1, 2, 3, 4, 5, 9].map((i) => predatorAt(dict, SEED, i));
    expect(p.map((x) => x.rules.length)).toEqual([1, 1, 2, 2, 3, 3, 3]);
    expect(p[0].reserve).toBeNull();
    expect(p.slice(1).every((x) => x.reserve !== null)).toBe(true);
    expect(p[4].boss && p[4].kind === 'shadow').toBe(true);
    expect(p[6].boss).toBe(true);
    // Each animal has its own build (the eagle is frail, the bear tough), but the trend climbs steeply.
    expect(p[5].maxHp).toBeGreaterThan(p[0].maxHp * 2);
    expect(p[6].maxHp).toBeGreaterThan(p[4].maxHp); // each boss tougher than the last
    expect(p[6].attack).toBeGreaterThan(p[0].attack);
  });

  it('never bring two rules from one group, and always leave plenty of words', () => {
    for (const day of ['2026-11-04', '2026-12-25', '2027-01-01']) {
      for (let i = 0; i < 12; i++) {
        const x = predatorAt(dict, dailySeed(day), i);
        const all = x.reserve ? [...x.rules, x.reserve] : x.rules;
        expect(new Set(all.map((r) => r.group)).size).toBe(all.length);
        expect(countWords(dict, all, 250)).toBeGreaterThanOrEqual(250);
      }
    }
  });

  it('turns get shorter, never under 10 seconds', () => {
    expect([0, 5, 10, 20].map(turnSeconds)).toEqual([20, 15, 10, 10]);
  });
});

describe('a run', () => {
  let run: Run;
  beforeEach(() => {
    run = startRun(dict, SEED);
    run = { ...run, predator: { ...run.predator, rules: [minLength(5)], reserve: null } };
  });

  it('non-words, repeats and too-short words cost nothing', () => {
    for (const w of ['zzzzzz', 'ab', 'w0rd']) expect(attack(run, dict, w).run).toBe(run);
    const hit = attack(run, dict, 'garden').run;
    expect(attack(hit, dict, 'garden').outcome).toEqual({ kind: 'invalid', reason: 'used' });
  });

  it('a word that breaks a rule wastes the turn and the predator strikes', () => {
    const { run: r, outcome } = attack(run, dict, 'cat');
    expect(outcome.kind).toBe('broke');
    expect(r.hp).toBe(run.hp - run.predator.attack);
    expect(r.predator.hp).toBe(run.predator.hp);
    expect(r.marks).toEqual(['broke']);
  });

  it('a good word hurts the predator, which strikes back', () => {
    const { run: r, outcome } = attack(run, dict, 'garden');
    if (outcome.kind !== 'hit') throw new Error(outcome.kind);
    expect(outcome.damage).toBe(damageFor('garden', 1).damage);
    expect(r.predator.hp).toBe(run.predator.maxHp - outcome.damage);
    expect(r.hp).toBe(run.hp - run.predator.attack);
    expect(r.damage).toBe(outcome.damage);
    expect(r.prev).toBe('garden');
  });

  it('a predator hurt to half brings its reserve rule, once', () => {
    let r: Run = { ...run, predator: { ...run.predator, maxHp: 30, hp: 30, reserve: ENDS_VOWEL } };
    const first = attack(r, dict, 'gardens');
    if (first.outcome.kind !== 'hit') throw new Error(first.outcome.kind);
    expect(first.outcome.enraged?.id).toBe('endvowel');
    r = first.run;
    expect(r.predator.rules.map((x) => x.id)).toEqual(['min5', 'endvowel']);
    expect(r.predator.reserve).toBeNull();
  });

  it('a knockout means no strike back, and the next predator heals the sheep a little', () => {
    const r: Run = { ...run, hp: 50, predator: { ...run.predator, hp: 1 } };
    const out = attack(r, dict, 'garden');
    if (out.outcome.kind !== 'hit') throw new Error(out.outcome.kind);
    expect(out.outcome.defeated).toBe(true);
    expect(out.run.hp).toBe(50);
    expect(out.run.defeated).toBe(1);
    const next = nextPredator(out.run, dict);
    expect(next.index).toBe(1);
    expect(next.level).toBe(6); // grew a level
    expect(next.maxHp).toBe(106);
    expect(next.hp).toBe(50 + 6 + 25);
    expect(next.prev).toBeNull();
  });

  it('running out of time costs one and a half strikes, and the run ends at zero', () => {
    const { run: r, outcome } = timeOut({ ...run, hp: 5 });
    expect(outcome).toMatchObject({ kind: 'timeout', counter: Math.round(run.predator.attack * 1.5), hp: 0, dead: true });
    expect(r.over).toBe(true);
  });

  it('the chain rules give way when they would leave the sheep with no word', () => {
    const tiny = createDictionary(['cat', 'tap', 'pit', 'tea', 'zebra']);
    const r: Run = { ...startRun(tiny, 'x'), prev: 'zebra', predator: { ...run.predator, rules: [CHAIN, minLength(3)] } };
    const { rules, relaxed } = activeRules(r, tiny);
    expect(relaxed.map((x) => x.id)).toEqual(['chain']);
    expect(rules.map((x) => x.id)).toEqual(['min3']);
  });
});

describe('the bag', () => {
  let run: Run;
  beforeEach(() => {
    run = startRun(dict, SEED);
    run = { ...run, predator: { ...run.predator, rules: [minLength(6), ENDS_VOWEL], reserve: null } };
  });

  it('starts with two milks, a bell and a pepper; each use takes the turn', () => {
    expect(run.items).toEqual({ milk: ITEMS.milk.count, bell: 1, pepper: 1 });
    const out = applyItem({ ...run, hp: 50 }, dict, 'milk')!;
    expect(out.outcome).toMatchObject({ kind: 'item', heal: MILK_HEAL, counter: run.predator.attack });
    expect(out.run.hp).toBe(50 + MILK_HEAL - run.predator.attack);
    expect(out.run.items.milk).toBe(1);
    expect(out.run.marks).toEqual(['item']);
  });

  it('milk never heals past full, and an empty slot cannot be used', () => {
    expect(applyItem(run, dict, 'milk')!.outcome).toMatchObject({ heal: 0 });
    expect(applyItem({ ...run, items: { ...run.items, bell: 0 } }, dict, 'bell')).toBeNull();
  });

  it('the hint bell rings an unused word that obeys every rule', () => {
    const w = hintWord(run, dict)!;
    expect(w.length).toBeGreaterThanOrEqual(6);
    expect('aeiou').toContain(w.at(-1));
    expect(dict.has(w)).toBe(true);
    expect(applyItem(run, dict, 'bell')!.outcome).toMatchObject({ kind: 'item', hint: w });
  });

  it('the pepper doubles the next word only', () => {
    const peppered = applyItem(run, dict, 'pepper')!.run;
    const first = attack(peppered, dict, 'banana');
    if (first.outcome.kind !== 'hit') throw new Error(first.outcome.kind);
    expect(first.outcome.damage).toBe(damageFor('banana', 2).damage * 2);
    const second = attack(first.run, dict, 'avocado');
    if (second.outcome.kind !== 'hit') throw new Error(second.outcome.kind);
    expect(second.outcome.damage).toBe(damageFor('avocado', 2).damage);
  });
});

describe('sharing and records', () => {
  it('shows the result without spoiling the words', () => {
    const text = huntShareText({ defeated: 2, damage: 312, marks: ['hit', 'crit', 'broke', 'timeout'], record: true });
    expect(text).toBe('Finish the Word · Hunt\n🐺 2 predators beaten · 💥 312 damage\n🟩🟨🟥⬛\n🏆 New personal best');
  });

  it('keeps the best run: more predators first, then more damage', () => {
    const data = new Map<string, string>();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
    } as Storage;
    expect(getHuntBest()).toBeNull();
    expect(recordHuntBest({ defeated: 0, damage: 0 }).isNew).toBe(false);
    expect(recordHuntBest({ defeated: 2, damage: 100 }).isNew).toBe(true);
    expect(recordHuntBest({ defeated: 1, damage: 500 }).isNew).toBe(false);
    expect(recordHuntBest({ defeated: 2, damage: 150 }).isNew).toBe(true);
    expect(getHuntBest()).toEqual({ defeated: 2, damage: 150 });
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
});
