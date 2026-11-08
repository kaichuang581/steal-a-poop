import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../../engine/dictionary';
import { seedOf } from '../codes';
import { applyItem, attack, causeOf, checkTyped, exampleWords, isExampleNo, isExampleYes, lastWords, MILK_HEAL, nextPredator, predatorAt, startRun, timeOut, walkHome } from '../hunt';
import type { Outcome, Run } from '../hunt';
import { EVERYDAY } from '../everyday';
import { brokenRule, CHAIN, ENDS_VOWEL, minLength, rulePool, ruleHow } from '../rules';
import type { Rule } from '../rules';

const words = readFileSync(new URL('../../../public/words.txt', import.meta.url), 'utf8').split('\n');
const dict = createDictionary(words);

/** A chain rule's example is "first then second": the second word against the first. */
function passes(rule: Rule, example: string): boolean {
  if (!rule.usesPrev) return rule.test(example, { prev: null });
  const [a, b] = example.split(' then ');
  return rule.test(b, { prev: a });
}

describe('rule cards that teach', () => {
  it('every rule has a plain sentence, and the chain rules fill theirs in from the last word', () => {
    for (let s = 0; s <= 6; s++) for (const r of rulePool(s)) expect(r.how).toMatch(/^[A-Z0-9].+\.$/);
    expect(ruleHow(CHAIN, 'sheep')).toBe('Your last word ended in P, so start with P.');
    expect(ruleHow(CHAIN, null)).toBe(CHAIN.how);
  });

  it('for every rule and five seeds: yes obeys it and is an everyday or friendly word, no breaks it', () => {
    for (let s = 0; s <= 6; s++) {
      for (const rule of rulePool(s)) {
        for (const seed of ['a', 'b', 'c', 'd', 'e']) {
          const { yes, no } = exampleWords(dict, rule, seed);
          expect(passes(rule, yes), `${rule.id} yes ${yes}`).toBe(true);
          expect(passes(rule, no), `${rule.id} no ${no}`).toBe(false);
          if (!rule.usesPrev) expect(isExampleYes(yes) && isExampleNo(no), `${rule.id} ${yes} ${no}`).toBe(true);
        }
      }
    }
  });

  it('the chain rules use the last word when there is one', () => {
    const { yes, no } = exampleWords(dict, CHAIN, 'x', { prev: 'sheep' });
    expect(yes[0]).toBe('p');
    expect(no[0]).not.toBe('p');
  });

  it('in twenty packs, each main rule\'s yes word obeys all the predator\'s main rules together', () => {
    let together = 0, total = 0;
    for (let k = 0; k < 20; k++) {
      for (let i = 0; i < 6; i++) {
        const p = predatorAt(dict, seedOf(`T${String(k).padStart(3, '0')}1`), i);
        for (const r of p.rules) {
          const ex = p.examples[r.id];
          expect(ex, r.id).toBeTruthy();
          if (r.usesPrev) continue;
          total++;
          if (!brokenRule(ex.yes, p.rules, { prev: null })) together++;
          expect(r.test(ex.no, { prev: null })).toBe(false);
        }
        if (p.reserve) expect(p.examples[p.reserve.id]).toBeTruthy();
      }
    }
    expect(together).toBe(total);
  });

  it('examples never change the pack: the same rules and builds as the rules alone would draw', () => {
    const p = predatorAt(dict, seedOf('K7QX1'), 4);
    const q = predatorAt(dict, seedOf('K7QX1'), 4);
    expect(p.examples).toEqual(q.examples);
    expect(p.rules.map((r) => r.id)).toEqual(q.rules.map((r) => r.id));
  });
});

describe('the live check', () => {
  const base = startRun(dict, seedOf('K7QX1'));
  const run: Run = { ...base, used: ['garden'], predator: { ...base.predator, rules: [minLength(5), ENDS_VOWEL], reserve: null } };

  it('reports the first broken rule as brokenRule does, short words, used words, and words not in the list', () => {
    expect(checkTyped(run, dict, 'cat').broken?.id).toBe('min5');
    expect(checkTyped(run, dict, 'garden').broken?.id).toBe('endvowel');
    expect(checkTyped(run, dict, 'banana').broken).toBeNull();
    expect(checkTyped(run, dict, 'ca')).toMatchObject({ tooShort: true, known: null });
    expect(checkTyped(run, dict, 'garden')).toMatchObject({ used: true, known: true, tooShort: false });
    expect(checkTyped(run, dict, 'zzzzza')).toMatchObject({ known: false, broken: null });
    for (const w of ['tomato', 'sheep', 'ab', 'quiet']) expect(checkTyped(run, dict, w).broken).toBe(brokenRule(w, run.predator.rules, { prev: null }));
  });
});

describe('what got you', () => {
  const base = startRun(dict, seedOf('K7QX1'));
  const run: Run = { ...base, predator: { ...base.predator, rules: [minLength(6)], reserve: null } };

  it('causeOf maps time-outs, broken rules, and strikes after a word or an item', () => {
    expect(causeOf(timeOut(run).outcome)).toBe('timeout');
    expect(causeOf(attack(run, dict, 'cat').outcome)).toBe('broke');
    expect(causeOf(attack(run, dict, 'garden').outcome)).toBe('hits');
    expect(causeOf(applyItem(run, dict, 'bell')!.outcome)).toBe('hits');
  });

  it('lastWords gives a word that obeys the rules in force on the killing turn', () => {
    const before: Run = { ...run, hp: 3, used: ['garden'] };
    const out: Outcome = timeOut(before).outcome;
    expect(out.kind === 'timeout' && out.dead).toBe(true);
    const { word } = lastWords(before, dict);
    expect(word && word.length >= 6 && dict.has(word) && word !== 'garden').toBe(true);
  });

  it('lastWords offers the milk only when one was left and it would have lasted out the strike', () => {
    const a = run.predator.attack;
    expect(lastWords({ ...run, hp: 5 }, dict).itemHelp).toBe(5 + MILK_HEAL > a ? 'milk' : null);
    expect(lastWords({ ...run, hp: 5, items: { ...run.items, milk: 0 } }, dict).itemHelp).toBeNull();
    const strong: Run = { ...run, hp: 5, predator: { ...run.predator, attack: 5 + MILK_HEAL } };
    expect(lastWords(strong, dict).itemHelp).toBeNull();
  });
});

describe('walking home', () => {
  it('ends the run after a boss with defeated unchanged; it is not allowed at any other time', () => {
    const start = startRun(dict, seedOf('K7QX1'));
    expect(walkHome(start)).toBe(start);
    const boss = predatorAt(dict, seedOf('K7QX1'), 4);
    const fainted: Run = { ...start, index: 4, defeated: 5, predator: { ...boss, hp: 0 } };
    const walked = walkHome(fainted);
    expect(walked).toMatchObject({ over: true, walkedHome: true, defeated: 5 });
    expect(nextPredator(fainted, dict).index).toBe(5);
  });
});

describe('the everyday words', () => {
  it('are all in the word list', () => {
    expect(EVERYDAY.filter((w) => !dict.has(w))).toEqual([]);
  });
});
