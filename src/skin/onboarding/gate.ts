import type { AuthStatus, Profile } from '../../auth/authStore';
import { needsParent } from '../../lib/ageRules';
import { load, save } from '../../lib/storage';

/**
 * The first-visit form (requested by Kai, 2026-11-14): before anything else, every new player picks how to play (as a
 * guest, with email, or with Google) and gives their country and age; if their country's rules say so, a parent
 * presses the agree button once. After that, nothing is held back.
 *
 * A guest's answers are kept in this browser (`sap:age-check`); an account's are kept on the server, so an account is
 * asked once whatever device it signs in on.
 */
export interface AgeCheck {
  country: string;
  age: number;
  /** A parent pressed the agree button. */
  parent: boolean;
  at: number;
}

export const AGE_CHECK_KEY = 'sap:age-check';

export function loadAgeCheck(): AgeCheck | null {
  const raw = load<Partial<AgeCheck> | null>(AGE_CHECK_KEY, null);
  if (!raw || typeof raw.country !== 'string' || typeof raw.age !== 'number' || typeof raw.parent !== 'boolean') return null;
  return { country: raw.country, age: raw.age, parent: raw.parent, at: typeof raw.at === 'number' ? raw.at : 0 };
}

export function saveAgeCheck(check: AgeCheck): void {
  save(AGE_CHECK_KEY, check);
}

/** This browser's answers let a guest in: old enough for their country, or a parent agreed. */
export const checkPasses = (c: AgeCheck | null): boolean => !!c && (c.parent || !needsParent(c.age, c.country));

/**
 * Which part of the form to show, or null when the player is in.
 *  choose:   pick guest, email or Google
 *  profile:  signed in for the first time: username, country, age
 *  age:      an account made before this form (no age yet, or waiting on a parent's email): country and age
 *  refused:  a parent said no to this account by email
 *  wait:     still finding out whether the saved sign-in is good
 */
export type GateStep = 'choose' | 'profile' | 'age' | 'refused' | 'wait';

export function gateStep(status: AuthStatus, profile: Profile | null, check: AgeCheck | null): GateStep | null {
  switch (status) {
    case 'loading': return 'wait';
    case 'needsProfile': return 'profile';
    case 'ready':
      if (!profile) return 'wait';
      if (profile.consentStatus === 'refused' || profile.consentStatus === 'withdrawn') return 'refused';
      if ((profile.consentStatus === 'not_required' || profile.consentStatus === 'granted') && profile.country) return null;
      return 'age';
    // Signed out, accounts switched off, or the server could not be reached: a guest, judged by this browser's answers.
    default: return checkPasses(check) ? null : 'choose';
  }
}
