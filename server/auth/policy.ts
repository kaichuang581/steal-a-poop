/**
 * Sign-up rules in one place: age, country, nickname and the identity of a banned person.
 * Nothing here talks to a database or the network, so every rule is easy to test.
 */
import { createHash } from 'node:crypto';

/** Ages at which a child can agree to data use alone. 13 unless a country is listed. */
export interface AgePolicy {
  /** Default age of digital consent. */
  defaultAge: number;
  /** Country (ISO alpha-2) -> age, where the law differs. EMPTY until a lawyer fills it in. */
  byCountry: Readonly<Record<string, number>>;
  /** If set, only these countries may sign up. Unset means all (the lawyer decides the launch list). */
  allowedCountries?: readonly string[];
  /** Countries that must be refused outright. */
  blockedCountries: readonly string[];
}

export const DEFAULT_AGE_POLICY: AgePolicy = { defaultAge: 13, byCountry: {}, blockedCountries: [] };

/** Whole years between a YYYY-MM-DD birth date and `now`, or null if the date is not a real past date. */
export function ageOn(dateOfBirth: string, now: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const born = new Date(Date.UTC(y, mo - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d) return null; // 2026-02-30 etc.
  const today = new Date(now);
  if (born.getTime() > now) return null; // in the future
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() < mo - 1 || (today.getUTCMonth() === mo - 1 && today.getUTCDate() < d)) age -= 1;
  return age > 120 ? null : age;
}

export type CountryDecision = { ok: true; country: string; consentAge: number } | { ok: false; reason: 'bad_country' | 'country_not_supported' };

export function checkCountry(raw: string, policy: AgePolicy = DEFAULT_AGE_POLICY): CountryDecision {
  const country = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, reason: 'bad_country' };
  if (policy.blockedCountries.includes(country)) return { ok: false, reason: 'country_not_supported' };
  if (policy.allowedCountries && !policy.allowedCountries.includes(country)) return { ok: false, reason: 'country_not_supported' };
  return { ok: true, country, consentAge: policy.byCountry[country] ?? policy.defaultAge };
}

export type ConsentStatus = 'not_required' | 'pending' | 'granted' | 'refused' | 'withdrawn';

/** Whether a person of this age needs a parent's consent where they live. */
export const needsParentalConsent = (age: number, consentAge: number) => age < consentAge;

/** A child without granted consent may play but not chat, and their results are not stored. */
export const mayChat = (status: ConsentStatus) => status === 'not_required' || status === 'granted';

const NICK_MIN = 2;
const NICK_MAX = 12;
export function cleanNickname(raw: string): string | null {
  const n = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (n.length < NICK_MIN || n.length > NICK_MAX) return null;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(n)) return null; // letters, digits, space, underscore, dot, dash
  return n;
}

/**
 * Same mailbox, however it is typed: lower case, and for Gmail-style addresses the dots and "+tag" are
 * ignored. Used only to recognise a banned person's address; it never changes the address used for mail.
 */
export function normalizeEmail(email: string): string {
  const [localRaw, domainRaw] = email.trim().toLowerCase().split('@');
  if (!localRaw || !domainRaw) return email.trim().toLowerCase();
  let local = localRaw.split('+')[0];
  let domain = domainRaw;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

export const identityHash = (email: string) => createHash('sha256').update(normalizeEmail(email)).digest('hex');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
