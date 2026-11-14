import { describe, expect, it } from 'vitest';
import type { SessionClaims } from '../contracts';
import { BlockList } from '../blocks';
import { MemoryMailer } from './mailer';
import { DEFAULT_AGE_POLICY, mayChat, sha256 } from './policy';
import { RevocationBus } from './revocations';
import { AccountService, ON_SCREEN_NOTICE } from './service';
import { MemoryAccountStore } from './store';
import { consentAgeTable } from '../../src/lib/ageRules';

// The sign-up form of 2026-11-14: country and age, and a parent's click on the child's screen when the country's rules
// say so. One click per account, then everything is open.
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
const claims = (over: Partial<SessionClaims> = {}): SessionClaims => ({
  userId: 'u1', email: 'kid@example.org', sessionId: 's1', issuedAt: NOW - 1000, expiresAt: NOW + 3600_000, authenticatedAt: NOW - 1000, ...over,
});

function setup() {
  const store = new MemoryAccountStore();
  const mailer = new MemoryMailer();
  const bus = new RevocationBus();
  const svc = new AccountService({
    store, now: () => NOW, mailer, agePolicy: { ...DEFAULT_AGE_POLICY, byCountry: consentAgeTable() }, nicknameAllowed: () => true,
    blocks: new BlockList(), bus, appUrl: 'https://game.example/', randomToken: () => 'tok',
  });
  return { svc, store, mailer };
}

describe('sign-up with an age and the parent button', () => {
  it('a player old enough for their country needs nobody: open at once, no record, no email', async () => {
    const { svc, store, mailer } = setup();
    const out = await svc.createProfile(claims(), { nickname: 'Maya', age: 14, country: 'US' });
    expect(out).toMatchObject({ ok: true, profile: { consentStatus: 'not_required', leaderboardVisible: true, country: 'US' } });
    expect((await store.getProfile('u1'))!.dateOfBirth).toBeNull();
    expect(await store.consentsForChild('u1')).toEqual([]);
    expect(mailer.sent).toHaveLength(0);
  });

  it('a younger player is refused until a parent presses the button', async () => {
    const { svc } = setup();
    expect(await svc.createProfile(claims(), { nickname: 'Maya', age: 12, country: 'US' })).toEqual({ ok: false, reason: 'parent_consent_required' });
  });

  it('the parent\'s click opens everything at once and is kept as a record of what was shown', async () => {
    const { svc, store, mailer } = setup();
    const out = await svc.createProfile(claims(), { nickname: 'Maya', age: 9, country: 'US', parentConsent: true });
    expect(out).toMatchObject({ ok: true, profile: { consentStatus: 'granted', leaderboardVisible: true } });
    expect(mayChat('granted')).toBe(true);
    const [rec] = await store.consentsForChild('u1');
    expect(rec).toMatchObject({ method: 'on_screen', decision: 'granted', decidedAt: NOW, noticeHash: sha256(ON_SCREEN_NOTICE), parentEmail: '' });
    expect(mailer.sent).toHaveLength(0);
  });

  it('follows the country: 15 needs a parent in Germany, not in the US', async () => {
    const { svc } = setup();
    expect(await svc.createProfile(claims(), { nickname: 'Max', age: 15, country: 'DE' })).toEqual({ ok: false, reason: 'parent_consent_required' });
    expect(await svc.createProfile(claims(), { nickname: 'Max', age: 15, country: 'US' })).toMatchObject({ ok: true, profile: { consentStatus: 'not_required' } });
  });

  it('refuses an age that is not a whole number in range', async () => {
    const { svc } = setup();
    for (const age of [3, 12.5, 200, Number.NaN]) {
      expect(await svc.createProfile(claims(), { nickname: 'Maya', age, country: 'US', parentConsent: true })).toEqual({ ok: false, reason: 'bad_age' });
    }
  });

  it('a player whose parent agreed may show themselves on the leaderboards', async () => {
    const { svc } = setup();
    await svc.createProfile(claims(), { nickname: 'Maya', age: 9, country: 'US', parentConsent: true });
    expect(await svc.setLeaderboardVisible('u1', true)).toBe('ok');
  });
});

describe('the age step for older accounts', () => {
  it('a username-only account gives its country and age once, then is open', async () => {
    const { svc, store } = setup();
    await svc.createUsernameProfile(claims(), 'Dash');
    expect(await svc.confirmAge('u1', { age: 11, country: 'GB' })).toEqual({ ok: false, reason: 'parent_consent_required' });
    const out = await svc.confirmAge('u1', { age: 11, country: 'GB', parentConsent: true });
    expect(out).toMatchObject({ ok: true, profile: { consentStatus: 'granted', country: 'GB' } });
    expect((await store.consentsForChild('u1'))[0]).toMatchObject({ method: 'on_screen', decision: 'granted' });
  });

  it('an account waiting on a parent\'s email can be agreed to on screen instead', async () => {
    const { svc } = setup();
    await svc.createProfile(claims(), { nickname: 'Maya', dateOfBirth: '2016-01-01', country: 'US', parentEmail: 'mum@example.org' });
    expect(await svc.confirmAge('u1', { age: 10, country: 'US', parentConsent: true })).toMatchObject({ ok: true, profile: { consentStatus: 'granted' } });
  });

  it('a parent who said no by email is not overruled by the button', async () => {
    const { svc, store } = setup();
    await svc.createUsernameProfile(claims(), 'Dash');
    await store.updateProfile('u1', { consentStatus: 'refused' });
    expect(await svc.confirmAge('u1', { age: 10, country: 'US', parentConsent: true })).toEqual({ ok: false, reason: 'parent_refused' });
  });

  it('an adult just gives the two answers', async () => {
    const { svc } = setup();
    await svc.createUsernameProfile(claims(), 'Dash');
    expect(await svc.confirmAge('u1', { age: 18, country: 'FR' })).toMatchObject({ ok: true, profile: { consentStatus: 'not_required' } });
  });
});
