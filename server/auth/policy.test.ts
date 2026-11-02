import { describe, expect, it } from 'vitest';
import { ageOn, checkCountry, cleanNickname, identityHash, mayChat, needsParentalConsent, normalizeEmail } from './policy';

const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

describe('ageOn', () => {
  it('counts whole years and flips on the birthday', () => {
    expect(ageOn('2013-11-02', at('2026-11-01'))).toBe(12); // one day before the 13th birthday
    expect(ageOn('2013-11-02', at('2026-11-02'))).toBe(13);
    expect(ageOn('2000-02-29', at('2026-02-28'))).toBe(25);
    expect(ageOn('2000-02-29', at('2026-03-01'))).toBe(26);
  });
  it('refuses dates that do not exist, are in the future, or are absurd', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2099-01-01', '1800-01-01', 'yesterday', '', '2026-1-1']) {
      expect(ageOn(bad, at('2026-11-01')), bad).toBeNull();
    }
  });
});

describe('checkCountry', () => {
  it('normalises, uses the default consent age, and honours per-country overrides', () => {
    expect(checkCountry(' ca ')).toEqual({ ok: true, country: 'CA', consentAge: 13 });
    expect(checkCountry('de', { defaultAge: 13, byCountry: { DE: 16 }, blockedCountries: [] })).toEqual({ ok: true, country: 'DE', consentAge: 16 });
  });
  it('rejects malformed codes, blocked countries, and countries outside an allow-list', () => {
    expect(checkCountry('Canada')).toEqual({ ok: false, reason: 'bad_country' });
    expect(checkCountry('1A')).toEqual({ ok: false, reason: 'bad_country' });
    expect(checkCountry('XX', { defaultAge: 13, byCountry: {}, blockedCountries: ['XX'] })).toEqual({ ok: false, reason: 'country_not_supported' });
    expect(checkCountry('FR', { defaultAge: 13, byCountry: {}, blockedCountries: [], allowedCountries: ['CA', 'US'] })).toEqual({ ok: false, reason: 'country_not_supported' });
  });
});

describe('consent and chat', () => {
  it('a child below the consent age needs a parent; at the age they do not', () => {
    expect(needsParentalConsent(12, 13)).toBe(true);
    expect(needsParentalConsent(13, 13)).toBe(false);
    expect(needsParentalConsent(15, 16)).toBe(true);
  });
  it('only no-consent-needed and granted may chat', () => {
    expect(['not_required', 'granted', 'pending', 'refused', 'withdrawn'].map((s) => mayChat(s as never))).toEqual([true, true, false, false, false]);
  });
});

describe('cleanNickname', () => {
  it('trims, collapses spaces and enforces length and characters', () => {
    expect(cleanNickname('  Ana   B ')).toBe('Ana B');
    expect(cleanNickname('A')).toBeNull();
    expect(cleanNickname('x'.repeat(13))).toBeNull();
    expect(cleanNickname('bad<script>')).toBeNull();
    expect(cleanNickname('Zoë_2.0-x')).toBe('Zoë_2.0-x');
  });
});

describe('email identity', () => {
  it('treats the same mailbox as the same person', () => {
    expect(normalizeEmail('A.B+tag@Gmail.com')).toBe('ab@gmail.com');
    expect(normalizeEmail('ab@googlemail.com')).toBe('ab@gmail.com');
    expect(identityHash('a.b+x@gmail.com')).toBe(identityHash('AB@GMAIL.COM'));
  });
  it('keeps dots significant outside Gmail and does not mix people up', () => {
    expect(normalizeEmail('a.b@example.org')).toBe('a.b@example.org');
    expect(identityHash('a.b@example.org')).not.toBe(identityHash('ab@example.org'));
  });
});
