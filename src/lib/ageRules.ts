/**
 * Who needs a parent's OK before playing, by country (requested by Kai, 2026-11-14). The game asks every new player
 * for their country and age, as a guest or with an account; a player younger than their country's age below needs a
 * parent to press the agree button once. The browser (guests) and the server (accounts) read this one table, so they
 * always agree. The server can raise a country with AGE_OF_CONSENT_BY_COUNTRY; it never lowers one.
 *
 * These are the ages at which a child may agree to an online service using their data on their own, as the laws read
 * in 2026 as best we know them. NOT LEGAL ADVICE: a lawyer must check this table before launch. A country not
 * listed uses DEFAULT_CONSENT_AGE. No country goes under 13.
 */
export const DEFAULT_CONSENT_AGE = 13;

/** Country (ISO 3166-1 alpha-2) -> the age below which a parent must agree, and where the number comes from. */
export const CONSENT_RULES: Readonly<Record<string, { age: number; source: string }>> = {
  // European Union: each country picks 13 to 16 (GDPR article 8).
  AT: { age: 14, source: 'GDPR art. 8, Austria' },
  BE: { age: 13, source: 'GDPR art. 8, Belgium' },
  BG: { age: 14, source: 'GDPR art. 8, Bulgaria' },
  HR: { age: 16, source: 'GDPR art. 8, Croatia' },
  CY: { age: 14, source: 'GDPR art. 8, Cyprus' },
  CZ: { age: 15, source: 'GDPR art. 8, Czechia' },
  DK: { age: 13, source: 'GDPR art. 8, Denmark' },
  EE: { age: 13, source: 'GDPR art. 8, Estonia' },
  FI: { age: 13, source: 'GDPR art. 8, Finland' },
  FR: { age: 15, source: 'GDPR art. 8, France' },
  DE: { age: 16, source: 'GDPR art. 8, Germany' },
  GR: { age: 15, source: 'GDPR art. 8, Greece' },
  HU: { age: 16, source: 'GDPR art. 8, Hungary' },
  IE: { age: 16, source: 'GDPR art. 8, Ireland' },
  IT: { age: 14, source: 'GDPR art. 8, Italy' },
  LV: { age: 13, source: 'GDPR art. 8, Latvia' },
  LT: { age: 14, source: 'GDPR art. 8, Lithuania' },
  LU: { age: 16, source: 'GDPR art. 8, Luxembourg' },
  MT: { age: 13, source: 'GDPR art. 8, Malta' },
  NL: { age: 16, source: 'GDPR art. 8, Netherlands' },
  PL: { age: 16, source: 'GDPR art. 8, Poland' },
  PT: { age: 13, source: 'GDPR art. 8, Portugal' },
  RO: { age: 16, source: 'GDPR art. 8, Romania' },
  SK: { age: 16, source: 'GDPR art. 8, Slovakia' },
  SI: { age: 15, source: 'GDPR art. 8, Slovenia' },
  ES: { age: 14, source: 'GDPR art. 8, Spain' },
  SE: { age: 13, source: 'GDPR art. 8, Sweden' },
  // The rest of the European Economic Area, and the UK.
  IS: { age: 13, source: 'GDPR art. 8, Iceland' },
  LI: { age: 16, source: 'GDPR art. 8, Liechtenstein' },
  NO: { age: 13, source: 'GDPR art. 8, Norway' },
  GB: { age: 13, source: 'UK GDPR and the Children\'s Code' },
  // North America.
  US: { age: 13, source: 'COPPA' },
  CA: { age: 14, source: 'Quebec Law 25 (14); 13 elsewhere in Canada, so the country takes the higher' },
  // Asia and Africa, where the law sets a higher age.
  KR: { age: 14, source: 'Personal Information Protection Act, South Korea' },
  CN: { age: 14, source: 'Personal Information Protection Law, China' },
  IN: { age: 18, source: 'Digital Personal Data Protection Act 2023, India' },
  ZA: { age: 18, source: 'POPIA, South Africa' },
};

export function consentAgeFor(country: string): number {
  return Math.max(DEFAULT_CONSENT_AGE, CONSENT_RULES[country.toUpperCase()]?.age ?? DEFAULT_CONSENT_AGE);
}

/** The table as the server's age policy wants it: country -> age. */
export function consentAgeTable(): Record<string, number> {
  return Object.fromEntries(Object.entries(CONSENT_RULES).map(([c, r]) => [c, r.age]));
}

/** True when a player of this age, in this country, needs a parent to agree before playing. */
export function needsParent(age: number, country: string): boolean {
  return age < consentAgeFor(country);
}

/** The ages the form offers: 5 to 17 one by one, then 18 and over as one choice. */
export const YOUNGEST = 5;
export const ADULT = 18;
export const AGE_CHOICES: { value: number; label: string }[] = [
  ...Array.from({ length: ADULT - YOUNGEST }, (_, i) => ({ value: YOUNGEST + i, label: String(YOUNGEST + i) })),
  { value: ADULT, label: '18 or older' },
];

/** A real age: a whole number the form could have sent. */
export const validAge = (age: unknown): age is number => typeof age === 'number' && Number.isInteger(age) && age >= YOUNGEST && age <= 120;

/** The words on the parent's button. */
export const PARENT_AGREE = 'I, as a parent, agree to let my child play';
export const PARENT_DECLINE = 'I do not agree';

/**
 * What the parent reads before pressing the button. The server keeps a hash of exactly this text with the record of
 * the agreement, as it does for the old email, so the record says what was shown.
 */
export const PARENT_NOTICE: readonly string[] = [
  'Finish the Word is a free word game. Your child can play alone, against computer players, and with other people online.',
  'Online, your child can join rooms with other players, chat with them (every message is checked by a filter before anyone sees it), add friends with a friend code, and appear on the public leaderboards under their nickname.',
  'With an account we keep the email address, the nickname, the country and age given here, and game results. As a guest, everything is kept in this browser only.',
  'You agree once. You can ask us to delete the account at any time from Settings.',
];
