import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../../auth/authStore';
import { AGE_CHECK_KEY, checkPasses, gateStep, loadAgeCheck, saveAgeCheck } from '../gate';

const profile = (over: Partial<Profile> = {}): Profile => ({ nickname: 'Maya', country: 'US', consentStatus: 'not_required', createdAt: 0, ...over });
const check = (age: number, country = 'US', parent = false) => ({ age, country, parent, at: 1 });

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('the first-visit form', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('greets a new visitor with the three ways in', () => {
    expect(gateStep('signedOut', null, null)).toBe('choose');
    expect(gateStep('off', null, null)).toBe('choose');
  });

  it('lets a guest in once this browser has the answers, if old enough or a parent agreed', () => {
    expect(gateStep('signedOut', null, check(14))).toBeNull();
    expect(gateStep('signedOut', null, check(10))).toBe('choose');
    expect(gateStep('signedOut', null, check(10, 'US', true))).toBeNull();
    expect(gateStep('off', null, check(15, 'DE'))).toBe('choose');
  });

  it('asks a new account for its username, country and age', () => {
    expect(gateStep('needsProfile', null, check(30))).toBe('profile');
  });

  it('lets a set-up account in on any device, whatever this browser says', () => {
    expect(gateStep('ready', profile(), null)).toBeNull();
    expect(gateStep('ready', profile({ consentStatus: 'granted' }), null)).toBeNull();
  });

  it('asks an older account for the answers it never gave, and stops one a parent refused', () => {
    expect(gateStep('ready', profile({ consentStatus: 'unconfirmed', country: null }), null)).toBe('age');
    expect(gateStep('ready', profile({ consentStatus: 'pending' }), null)).toBe('age');
    expect(gateStep('ready', profile({ consentStatus: 'refused' }), null)).toBe('refused');
    expect(gateStep('ready', profile({ consentStatus: 'withdrawn' }), null)).toBe('refused');
  });

  it('waits while the saved sign-in is checked', () => {
    expect(gateStep('loading', null, null)).toBe('wait');
  });

  it('keeps a guest\'s answers in this browser, and ignores damaged ones', () => {
    saveAgeCheck(check(9, 'GB', true));
    expect(loadAgeCheck()).toEqual(check(9, 'GB', true));
    expect(checkPasses(loadAgeCheck())).toBe(true);
    localStorage.setItem(AGE_CHECK_KEY, '{"age":"nine"}');
    expect(loadAgeCheck()).toBeNull();
  });
});
