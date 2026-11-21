import { describe, expect, it } from 'vitest';
import { pairRule, singleRules, MAX_TWIST_SHARE, MIN_TWIST_WORDS } from '../twists/rules';

const rule = (id: string) => {
  const r = singleRules().find((x) => x.id === id);
  if (!r) throw new Error(`no rule ${id}`);
  return r;
};

describe('word twist rules', () => {
  it('every single rule has its own id and label', () => {
    const rules = singleRules();
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    expect(new Set(rules.map((r) => r.label)).size).toBe(rules.length);
  });

  it('the rules the game already deals behave as before', () => {
    expect(rule('ban:e').accepts('tiger')).toBe(false);
    expect(rule('ban:e').accepts('robin')).toBe(true);
    expect(rule('len=6').accepts('planet')).toBe(true);
    expect(rule('min=6').accepts('pianos')).toBe(true);
    expect(rule('max=5').accepts('tiger')).toBe(true);
    expect(rule('end:vowel').accepts('piano')).toBe(true);
    expect(rule('has:o').accepts('robin')).toBe(true);
    expect(rule('has:o').accepts('tiger')).toBe(false);
    expect(rule('dbl:l').accepts('ball')).toBe(true);
  });

  it('the new rules read the word as their name says', () => {
    expect(rule('third:r').accepts('carrot')).toBe(true);
    expect(rule('third:r').accepts('bread')).toBe(false);
    expect(rule('vowels=2').accepts('robin')).toBe(true);
    expect(rule('no-repeats').accepts('robin')).toBe(true);
    expect(rule('no-repeats').accepts('ballet')).toBe(false);
    expect(rule('alternate').accepts('bagel')).toBe(true);
    expect(rule('alternate').accepts('robin')).toBe(true);
    expect(rule('alternate').accepts('strength')).toBe(false);
    expect(rule('vowel-pair').accepts('bread')).toBe(true);
    expect(rule('vowel-pair').accepts('robin')).toBe(false);
  });

  it('a pair holds only where both rules hold', () => {
    const both = pairRule(rule('ban:e'), rule('len=5'));
    expect(both.id).toBe('ban:e+len=5');
    expect(both.accepts('robin')).toBe(true);
    expect(both.accepts('tiger')).toBe(false);
    expect(both.accepts('robins')).toBe(false);
  });

  it('the difficulty band keeps a twist from being plain or impossible', () => {
    expect(MIN_TWIST_WORDS).toBeGreaterThan(0);
    expect(MAX_TWIST_SHARE).toBeGreaterThan(0);
    expect(MAX_TWIST_SHARE).toBeLessThan(1);
  });
});
