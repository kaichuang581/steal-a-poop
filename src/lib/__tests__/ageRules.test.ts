import { describe, expect, it } from 'vitest';
import { AGE_CHOICES, ADULT, CONSENT_RULES, DEFAULT_CONSENT_AGE, consentAgeFor, needsParent, validAge, YOUNGEST } from '../ageRules';

describe('who needs a parent, by country', () => {
  it('lists real two-letter countries, every one from 13 to 18 with a source', () => {
    for (const [code, rule] of Object.entries(CONSENT_RULES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(rule.age).toBeGreaterThanOrEqual(13);
      expect(rule.age).toBeLessThanOrEqual(18);
      expect(rule.source.length).toBeGreaterThan(3);
    }
  });
  it('uses 13 for a country not listed, and reads codes in any case', () => {
    expect(consentAgeFor('JP')).toBe(DEFAULT_CONSENT_AGE);
    expect(consentAgeFor('de')).toBe(16);
  });
  it('asks for a parent below the country\'s age and not at it', () => {
    expect(needsParent(12, 'US')).toBe(true);
    expect(needsParent(13, 'US')).toBe(false);
    expect(needsParent(15, 'DE')).toBe(true);
    expect(needsParent(16, 'DE')).toBe(false);
    expect(needsParent(17, 'IN')).toBe(true);
    expect(needsParent(ADULT, 'IN')).toBe(false);
  });
  it('offers every age from 5 to 17 and one choice for adults, all of them valid', () => {
    expect(AGE_CHOICES[0].value).toBe(YOUNGEST);
    expect(AGE_CHOICES.at(-1)).toEqual({ value: ADULT, label: '18 or older' });
    expect(AGE_CHOICES.every((c) => validAge(c.value))).toBe(true);
    expect(validAge(4)).toBe(false);
    expect(validAge('12')).toBe(false);
  });
  it('an 18-year-old needs nobody anywhere in the table', () => {
    for (const code of Object.keys(CONSENT_RULES)) expect(needsParent(ADULT, code)).toBe(false);
  });
});
