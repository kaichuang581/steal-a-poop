import { describe, expect, it } from 'vitest';
import type { SessionClaims } from '../contracts';
import { BlockList } from '../blocks';
import { MemoryMailer } from './mailer';
import { DEFAULT_AGE_POLICY, mayChat, mayKeepResults, sha256 } from './policy';
import { RevocationBus } from './revocations';
import { AccountService } from './service';
import { MemoryAccountStore } from './store';
import { isInappropriateName } from '../../src/lib/nickname';

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const claims = (over: Partial<SessionClaims> = {}): SessionClaims => ({
  userId: 'u1', email: 'kid@example.org', sessionId: 's1', issuedAt: NOW - 1000, expiresAt: NOW + 3600_000, authenticatedAt: NOW - 1000, ...over,
});

function setup() {
  const store = new MemoryAccountStore();
  const mailer = new MemoryMailer();
  const svc = new AccountService({
    store, now: () => NOW, mailer, agePolicy: DEFAULT_AGE_POLICY, nicknameAllowed: (n) => !isInappropriateName(n),
    blocks: new BlockList(), bus: new RevocationBus(), appUrl: 'https://game.example/', randomToken: () => 'tok',
  });
  return { svc, store, mailer };
}

describe('username-only sign-up', () => {
  it('makes a profile from a username alone: no age, no country, no parent email, no email sent', async () => {
    const { svc, store, mailer } = setup();
    const out = await svc.createUsernameProfile(claims(), 'Dash');
    expect(out).toMatchObject({ ok: true, profile: { nickname: 'Dash', country: null, consentStatus: 'unconfirmed', leaderboardVisible: false } });
    const stored = (await store.getProfile('u1'))!;
    expect(stored.dateOfBirth).toBeNull();
    expect(stored.emailHash).toBe(sha256('kid@example.org'));
    expect(mailer.sent).toHaveLength(0);
  });

  it('keeps progress but not chat: results are kept, chat and friends stay off', () => {
    expect(mayKeepResults('unconfirmed')).toBe(true);
    expect(mayChat('unconfirmed')).toBe(false);
    expect(mayKeepResults('refused')).toBe(false);
  });

  it('refuses rude names, taken names, a second profile and a missing email', async () => {
    const { svc } = setup();
    expect(await svc.createUsernameProfile(claims(), 'fuck')).toEqual({ ok: false, reason: 'bad_nickname' });
    expect(await svc.createUsernameProfile(claims(), 'x')).toEqual({ ok: false, reason: 'bad_nickname' });
    expect(await svc.createUsernameProfile(claims({ email: null }), 'Dash')).toEqual({ ok: false, reason: 'email_required' });
    expect((await svc.createUsernameProfile(claims(), 'Dash')).ok).toBe(true);
    expect(await svc.createUsernameProfile(claims(), 'Other')).toEqual({ ok: false, reason: 'profile_exists' });
    expect(await svc.createUsernameProfile(claims({ userId: 'u2', email: 'b@example.org' }), 'dash')).toEqual({ ok: false, reason: 'nickname_taken' });
  });
});
