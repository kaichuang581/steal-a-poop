import { describe, expect, it } from 'vitest';
import type { SessionClaims } from '../contracts';
import { BlockList } from '../blocks';
import { MemoryMailer } from './mailer';
import { DEFAULT_AGE_POLICY, sha256 } from './policy';
import { RevocationBus } from './revocations';
import type { RevocationReason } from './revocations';
import { AccountService, CONSENT_VALID_MS, RECENT_SIGN_IN_MS, SupabaseAuthAdmin, consentEmailBody } from './service';
import { DELETED_NICKNAME, MemoryAccountStore } from './store';

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
const claims = (over: Partial<SessionClaims> = {}): SessionClaims => ({
  userId: 'u1', email: 'kid@example.org', sessionId: 's1', issuedAt: NOW - 1000, expiresAt: NOW + 3600_000, authenticatedAt: NOW - 1000, ...over,
});
const ADULT = { nickname: 'Ana', dateOfBirth: '1990-05-05', country: 'CA' };
const CHILD = { nickname: 'Kiddo', dateOfBirth: '2016-05-05', country: 'CA', parentEmail: 'mum@example.org' };

function setup(over: { mailer?: MemoryMailer | null; adminFails?: boolean; standing?: () => { suspendedUntil: number | null; openItems: number } } = {}) {
  let t = NOW;
  const store = new MemoryAccountStore();
  const mailer = over.mailer === undefined ? new MemoryMailer() : over.mailer;
  const bus = new RevocationBus();
  const events: [string, string | null, RevocationReason][] = [];
  bus.on((u, s, r) => events.push([u, s, r]));
  const blocks = new BlockList();
  const deleted: string[] = [];
  let n = 0;
  const svc = new AccountService({
    store, now: () => t, mailer, agePolicy: DEFAULT_AGE_POLICY, nicknameAllowed: (nick) => !/blorf/i.test(nick), blocks, bus,
    authAdmin: { deleteUser: async (id) => { if (over.adminFails) throw new Error('down'); deleted.push(id); } },
    appUrl: 'https://game.example/', randomToken: () => `tok${++n}`, standing: over.standing,
  });
  return { svc, store, mailer, bus, events, blocks, deleted, advance: (ms: number) => (t += ms) };
}

describe('finishing sign-up', () => {
  it('an adult gets a profile that can chat at once', async () => {
    const { svc, store } = setup();
    const out = await svc.createProfile(claims({ email: 'ana@example.org' }), ADULT);
    expect(out).toMatchObject({ ok: true, profile: { nickname: 'Ana', country: 'CA', consentStatus: 'not_required' } });
    expect((await store.getProfile('u1'))!.emailHash).toBe(sha256('ana@example.org'));
  });

  it('refuses a second profile, a missing email, and bad input', async () => {
    const { svc } = setup();
    await svc.createProfile(claims({ email: 'ana@example.org' }), ADULT);
    expect(await svc.createProfile(claims({ email: 'ana@example.org' }), ADULT)).toEqual({ ok: false, reason: 'profile_exists' });
    const r = async (input: object, c = claims({ userId: 'u2', email: 'b@example.org' })) => (await svc.createProfile(c, { ...ADULT, nickname: 'Bea', ...input } as never)) as { reason?: string };
    expect((await r({}, claims({ userId: 'u3', email: null }))).reason).toBe('email_required');
    expect((await r({ nickname: 'x' })).reason).toBe('bad_nickname');
    expect((await r({ nickname: 'blorf' })).reason).toBe('bad_nickname'); // the chat filter's rules apply to names
    expect((await r({ nickname: 'ana' })).reason).toBe('nickname_taken'); // any capitalisation
    expect((await r({ dateOfBirth: '2026-02-30' })).reason).toBe('bad_dob');
    expect((await r({ country: 'Canada' })).reason).toBe('bad_country');
  });

  it('a child under 13 gets a pending profile, a stored request, and the parent is emailed a link', async () => {
    const { svc, store, mailer } = setup();
    const out = await svc.createProfile(claims(), CHILD);
    expect(out).toMatchObject({ ok: true, mailed: true, profile: { consentStatus: 'pending' } });
    expect(mailer!.sent).toHaveLength(1);
    const mail = mailer!.sent[0];
    expect(mail.to).toBe('mum@example.org');
    expect(mail.text).toContain('https://game.example/#/consent/tok1');
    expect(mail.text).toContain('Kiddo');
    expect(mail.text).not.toContain('2016'); // the child's date of birth is not put in the email
    const [rec] = await store.consentsForChild('u1');
    expect(rec).toMatchObject({ parentEmail: 'mum@example.org', decision: null, requestTokenHash: sha256('tok1'), policyVersion: expect.any(String) });
    expect(rec.noticeHash).toBe(sha256(consentEmailBody('Kiddo', '{link}'))); // the exact text shown is on record
    expect(JSON.stringify(rec)).not.toContain('tok1'); // only the hash of the token is kept
  });

  it('a child needs a valid parent email that is not their own, and mail must be available', async () => {
    const { svc } = setup();
    const r = async (parentEmail: string | undefined, userId: string, email = 'kid@example.org') =>
      ((await svc.createProfile(claims({ userId, email }), { ...CHILD, nickname: `K${userId}`, parentEmail })) as { reason?: string }).reason;
    expect(await r(undefined, 'a')).toBe('parent_email_required');
    expect(await r('not-an-email', 'b')).toBe('parent_email_invalid');
    expect(await r('KID@example.org', 'c')).toBe('parent_email_same');
    expect(await r('k.i.d+x@example.org', 'd', 'kid@example.org')).toBeUndefined(); // different mailbox on a non-Gmail domain: allowed
    const noMail = setup({ mailer: null });
    expect(await noMail.svc.createProfile(claims(), CHILD)).toEqual({ ok: false, reason: 'consent_unavailable' });
    expect(await noMail.store.getProfile('u1')).toBeNull(); // nothing is left half-made
  });

  it('a country can raise the age of consent', async () => {
    const t = setup();
    const svc = new AccountService({ ...(t.svc as unknown as { d: ConstructorParameters<typeof AccountService>[0] }).d, agePolicy: { ...DEFAULT_AGE_POLICY, byCountry: { DE: 16 } } });
    const out = await svc.createProfile(claims({ email: 'teen@example.org' }), { nickname: 'Teen', dateOfBirth: '2012-01-01', country: 'DE', parentEmail: 'p@example.org' });
    expect(out).toMatchObject({ ok: true, profile: { consentStatus: 'pending' } }); // 14 in a country that sets 16
  });

  it('an unsupported country is refused', async () => {
    const t = setup();
    const svc = new AccountService({ ...(t.svc as unknown as { d: ConstructorParameters<typeof AccountService>[0] }).d, agePolicy: { ...DEFAULT_AGE_POLICY, blockedCountries: ['XX'] } });
    expect(await svc.createProfile(claims(), { ...ADULT, country: 'XX' })).toEqual({ ok: false, reason: 'country_not_supported' });
  });

  it('keeps the profile when the consent email fails to send, and says so', async () => {
    const { svc, mailer } = setup();
    mailer!.send = async () => { throw new Error('smtp down'); };
    expect(await svc.createProfile(claims(), CHILD)).toMatchObject({ ok: true, mailed: false });
    expect(await svc.resendConsent('u1')).toMatchObject({ ok: true });
  });
});

describe('parental consent', () => {
  async function pending() {
    const t = setup();
    await t.svc.createProfile(claims(), CHILD);
    return t;
  }
  it('shows the parent what they are deciding, and nothing for an unknown link', async () => {
    const { svc } = await pending();
    expect(await svc.consentInfo('tok1')).toEqual({ state: 'open', childNickname: 'Kiddo' });
    expect(await svc.consentInfo('nope')).toBeNull();
  });
  it('granting enables chat, keeps the record, emails a withdraw link, and tells open connections to reconnect', async () => {
    const { svc, store, mailer, events } = await pending();
    expect(await svc.decideConsent('tok1', 'grant')).toEqual({ ok: true, state: 'granted' });
    expect((await store.getProfile('u1'))!.consentStatus).toBe('granted');
    const [rec] = await store.consentsForChild('u1');
    expect(rec).toMatchObject({ decision: 'granted', decidedAt: NOW });
    expect(mailer!.sent.at(-1)!.text).toContain('#/consent/manage/tok2');
    expect(events).toContainEqual(['u1', null, 'status']);
  });
  it('refusing keeps the account unable to chat', async () => {
    const { svc, store } = await pending();
    expect(await svc.decideConsent('tok1', 'refuse')).toEqual({ ok: true, state: 'refused' });
    expect((await store.getProfile('u1'))!.consentStatus).toBe('refused');
  });
  it('a parent\'s no is final: an older or newer link cannot turn it into a yes', async () => {
    const { svc, store, advance } = await pending();
    advance(60_000);
    await svc.resendConsent('u1'); // a second link, tok2
    expect(await svc.decideConsent('tok1', 'refuse')).toEqual({ ok: true, state: 'refused' });
    expect(await svc.decideConsent('tok2', 'grant')).toEqual({ ok: false, reason: 'already_decided' });
    expect((await store.getProfile('u1'))!.consentStatus).toBe('refused');
  });
  it('a child can ask for only a handful of consent emails in all', async () => {
    const { svc, advance } = await pending();
    for (let i = 0; i < 4; i++) {
      advance(60_000);
      expect(await svc.resendConsent('u1')).toMatchObject({ ok: true });
    }
    advance(60_000);
    expect(await svc.resendConsent('u1')).toEqual({ ok: false, reason: 'rate_limited' });
  });
  it('a resend respects the per-address mail limit', async () => {
    const { svc } = await pending();
    expect(await svc.resendConsent('u1', () => false)).toEqual({ ok: false, reason: 'rate_limited' });
  });
  it('a link works once, and not after it expires', async () => {
    const a = await pending();
    await a.svc.decideConsent('tok1', 'refuse');
    expect(await a.svc.decideConsent('tok1', 'grant')).toEqual({ ok: false, reason: 'already_decided' });
    const b = await pending();
    b.advance(CONSENT_VALID_MS + 1);
    expect(await b.svc.consentInfo('tok1')).toMatchObject({ state: 'expired' });
    expect(await b.svc.decideConsent('tok1', 'grant')).toEqual({ ok: false, reason: 'expired' });
    expect((await b.store.getProfile('u1'))!.consentStatus).toBe('pending');
    expect(await b.svc.resendConsent('u1')).toMatchObject({ ok: true });
    expect(await b.svc.decideConsent('tok2', 'grant')).toMatchObject({ ok: true });
  });
  it('a parent can withdraw later with the link from the confirmation email, and only after granting', async () => {
    const { svc, store, events } = await pending();
    expect(await svc.withdrawConsent('tok2')).toEqual({ ok: false, reason: 'unknown' });
    await svc.decideConsent('tok1', 'grant');
    expect(await svc.withdrawConsent('tok2')).toEqual({ ok: true });
    expect((await store.getProfile('u1'))!.consentStatus).toBe('withdrawn');
    expect((await store.consentsForChild('u1'))[0].decision).toBe('withdrawn');
    expect(events.filter((e) => e[2] === 'status')).toHaveLength(2);
    expect(await svc.withdrawConsent('tok2')).toEqual({ ok: false, reason: 'not_granted' });
  });
  it('an adult has nothing to resend', async () => {
    const { svc } = setup();
    await svc.createProfile(claims({ email: 'a@example.org' }), ADULT);
    expect(await svc.resendConsent('u1')).toEqual({ ok: false, reason: 'not_pending' });
  });
});

describe('logging out', () => {
  it('ends one session, or all of them, and tells open connections', async () => {
    const { svc, store, events } = setup();
    await svc.createProfile(claims({ email: 'a@example.org' }), ADULT);
    await svc.logout(claims());
    expect(await store.isSessionRevoked('s1')).toBe(true);
    expect(events.at(-1)).toEqual(['u1', 's1', 'logout']);
    await svc.logoutAll(claims({ sessionId: 's2' }));
    expect((await store.getProfile('u1'))!.sessionsValidAfter).toBe(NOW);
    expect(events.at(-1)).toEqual(['u1', null, 'logout']);
  });
  it('logging out everywhere right after sign-up (no profile yet) still ends this session', async () => {
    const { svc, store } = setup();
    await svc.logoutAll(claims());
    expect(await store.isSessionRevoked('s1')).toBe(true);
  });
});

describe('bans', () => {
  it('a banned account\'s email cannot make a new account, however it is typed', async () => {
    const { svc } = setup();
    await svc.createProfile(claims({ email: 'bad.person@gmail.com' }), { ...ADULT, nickname: 'Bad' });
    await svc.recordBan('u1', 'slurs');
    const again = await svc.createProfile(claims({ userId: 'u9', email: 'BadPerson+new@googlemail.com' }), { ...ADULT, nickname: 'Fresh' });
    expect(again).toEqual({ ok: false, reason: 'identity_banned' });
    const other = await svc.createProfile(claims({ userId: 'u10', email: 'someone@example.org' }), { ...ADULT, nickname: 'Other' });
    expect(other).toMatchObject({ ok: true });
  });
  it('recording a ban for someone with no profile does nothing', async () => {
    const { svc, store } = setup();
    await svc.recordBan('ghost', 'x');
    expect(store.banned.size).toBe(0);
  });
});

describe('deleting an account', () => {
  async function adult() {
    const t = setup();
    await t.svc.createProfile(claims({ email: 'a@example.org' }), ADULT);
    t.blocks.block('u1', 'x');
    t.blocks.block('other', 'u1');
    return t;
  }
  it('needs a recent sign-in', async () => {
    const t = await adult();
    t.advance(RECENT_SIGN_IN_MS + 1);
    expect(await t.svc.deleteAccount(claims())).toEqual({ ok: false, reason: 'reauth_required' });
    expect((await t.store.getProfile('u1'))!.deletedAt).toBeNull();
    expect(t.deleted).toEqual([]);
  });
  it('removes the login, the blocks and the personal fields, and rejects the old tokens', async () => {
    const t = await adult();
    expect(await t.svc.deleteAccount(claims())).toEqual({ ok: true });
    expect(t.deleted).toEqual(['u1']);
    expect(t.blocks.list('u1')).toEqual([]);
    expect(t.blocks.list('other')).toEqual(['u1']); // other people's blocks are not this person's data
    const p = (await t.store.getProfile('u1'))!;
    expect(p).toMatchObject({ nickname: DELETED_NICKNAME, dateOfBirth: null, country: null, emailHash: '', deletedAt: NOW });
    expect(p.sessionsValidAfter).toBe(NOW);
    expect(t.events.at(-1)).toEqual(['u1', null, 'logout']);
    expect(await t.store.nicknameTaken('Ana')).toBe(false); // the name is free again
  });
  it('keeps the parental consent record, which is proof that consent was given', async () => {
    const t = setup();
    await t.svc.createProfile(claims(), CHILD);
    await t.svc.decideConsent('tok1', 'grant');
    await t.svc.deleteAccount(claims());
    expect(await t.store.consentsForChild('u1')).toHaveLength(1);
  });
  it('if the login cannot be deleted, nothing else changes and it can be tried again', async () => {
    const t = setup({ adminFails: true });
    await t.svc.createProfile(claims({ email: 'a@example.org' }), ADULT);
    t.blocks.block('u1', 'x');
    expect(await t.svc.deleteAccount(claims())).toEqual({ ok: false, reason: 'try_again' });
    expect(t.blocks.list('u1')).toEqual(['x']);
    expect((await t.store.getProfile('u1'))!.nickname).toBe('Ana');
  });
  it('runs the other modules\' erasers', async () => {
    const t = setup();
    const seen: string[] = [];
    const svc = new AccountService({ ...(t.svc as unknown as { d: ConstructorParameters<typeof AccountService>[0] }).d, erasers: [async (id) => void seen.push(id)] });
    await svc.deleteAccount(claims());
    expect(seen).toEqual(['u1']);
  });
});

describe('deleting an account does not wipe a suspension', () => {
  const HOUR = 3600_000;
  const email = 'Sus.Pended+x@gmail.com';
  async function signedUp(standing: () => { suspendedUntil: number | null; openItems: number }) {
    const t = setup({ standing });
    await t.svc.createProfile(claims({ email }), { ...ADULT, nickname: 'Sus' });
    return t;
  }
  const signUpAgain = (t: Awaited<ReturnType<typeof signedUp>>, userId = 'u2') =>
    t.svc.createProfile(claims({ userId, email: 'suspended@googlemail.com' }), { ...ADULT, nickname: `New${userId}` });

  it('a suspended account that is deleted cannot be re-created, under any spelling of the email, until the suspension would have ended', async () => {
    const t = await signedUp(() => ({ suspendedUntil: NOW + 10 * HOUR, openItems: 0 }));
    await t.svc.deleteAccount(claims());
    expect(await signUpAgain(t)).toEqual({ ok: false, reason: 'identity_restricted' });
    t.advance(9 * HOUR);
    expect(await signUpAgain(t)).toEqual({ ok: false, reason: 'identity_restricted' });
    t.advance(2 * HOUR); // 11 hours: the suspension is over
    const again = await signUpAgain(t);
    expect(again, JSON.stringify(again)).toMatchObject({ ok: true });
  });

  it('only a hash is kept, with the end time, and the deleted profile holds no email', async () => {
    const t = await signedUp(() => ({ suspendedUntil: NOW + HOUR, openItems: 0 }));
    await t.svc.deleteAccount(claims());
    const [hold] = [...t.store.restricted.values()];
    expect(hold).toMatchObject({ reason: 'suspension', until: NOW + HOUR, sourceUserId: 'u1' });
    expect(hold.identityHash).toBe(sha256('suspended@gmail.com'));
    expect(JSON.stringify(hold)).not.toMatch(/gmail|Sus/);
    expect((await t.store.getProfile('u1'))!.emailHash).toBe('');
  });

  it('an account in good standing is not held: deleting it frees the email at once', async () => {
    const t = await signedUp(() => ({ suspendedUntil: null, openItems: 0 }));
    await t.svc.deleteAccount(claims());
    expect(t.store.restricted.size).toBe(0);
    expect(await signUpAgain(t)).toMatchObject({ ok: true });
  });

  it('a suspension AND an open case hold for whichever is longer', async () => {
    const t = await signedUp(() => ({ suspendedUntil: NOW + 10 * HOUR, openItems: 1 }));
    await t.svc.deleteAccount(claims());
    t.advance(11 * HOUR); // the suspension has ended but the case is still open
    expect(await signUpAgain(t)).toEqual({ ok: false, reason: 'identity_restricted' });
    t.advance(7 * 24 * HOUR);
    expect(await signUpAgain(t)).toMatchObject({ ok: true });
  });

  it('an expired suspension does not count, and an open case holds only for the short hold period', async () => {
    const past = await signedUp(() => ({ suspendedUntil: NOW - HOUR, openItems: 0 }));
    await past.svc.deleteAccount(claims());
    expect(past.store.restricted.size).toBe(0);

    const open = await signedUp(() => ({ suspendedUntil: null, openItems: 2 }));
    await open.svc.deleteAccount(claims());
    expect([...open.store.restricted.values()][0]).toMatchObject({ reason: 'open_case', until: NOW + 7 * 24 * HOUR });
    open.advance(6 * 24 * HOUR);
    expect(await signUpAgain(open)).toEqual({ ok: false, reason: 'identity_restricted' });
    open.advance(2 * 24 * HOUR);
    expect(await signUpAgain(open)).toMatchObject({ ok: true });
  });

  it('when a person clears the case, the hold ends at once; while it is still open, it stays', async () => {
    let standing = { suspendedUntil: NOW + 10 * HOUR as number | null, openItems: 1 };
    const t = await signedUp(() => standing);
    await t.svc.deleteAccount(claims());
    await t.svc.refreshRestriction('u1'); // something changed but the suspension still stands
    expect(t.store.restricted.size).toBe(1);
    standing = { suspendedUntil: null, openItems: 0 }; // cleared
    await t.svc.refreshRestriction('u1');
    expect(t.store.restricted.size).toBe(0);
    expect(await signUpAgain(t)).toMatchObject({ ok: true });
  });

  it('a ban is still permanent and the answer does not say which rule applied', async () => {
    const t = await signedUp(() => ({ suspendedUntil: null, openItems: 0 }));
    await t.svc.recordBan('u1', 'slurs');
    await t.svc.deleteAccount(claims());
    t.advance(1000 * 24 * HOUR);
    expect(await signUpAgain(t)).toEqual({ ok: false, reason: 'identity_banned' });
  });

  it('housekeeping drops holds that have run out', async () => {
    const t = await signedUp(() => ({ suspendedUntil: NOW + HOUR, openItems: 0 }));
    await t.svc.deleteAccount(claims());
    t.advance(2 * HOUR);
    expect(await t.svc.purge()).toBeGreaterThanOrEqual(1);
    expect(t.store.restricted.size).toBe(0);
  });

  it('with no moderation information available, deleting works and nothing is held', async () => {
    const t = setup();
    await t.svc.createProfile(claims({ email }), { ...ADULT, nickname: 'Sus' });
    expect(await t.svc.deleteAccount(claims())).toEqual({ ok: true });
    expect(t.store.restricted.size).toBe(0);
  });
});

describe('SupabaseAuthAdmin', () => {
  it('calls the admin delete endpoint with the service key, and treats "already gone" as done', async () => {
    const calls: [string, RequestInit][] = [];
    const respond = (status: number) => (async (u: string, i: RequestInit) => (calls.push([u, i]), { ok: status < 300, status }) as Response) as unknown as typeof fetch;
    await new SupabaseAuthAdmin({ url: 'https://p.supabase.co', serviceKey: 'KEY', fetchImpl: respond(200) }).deleteUser('a/b');
    expect(calls[0][0]).toBe('https://p.supabase.co/auth/v1/admin/users/a%2Fb');
    expect(calls[0][1].method).toBe('DELETE');
    expect((calls[0][1].headers as Record<string, string>).authorization).toBe('Bearer KEY');
    await new SupabaseAuthAdmin({ url: 'u', serviceKey: 'K', fetchImpl: respond(404) }).deleteUser('x');
    await expect(new SupabaseAuthAdmin({ url: 'u', serviceKey: 'K', fetchImpl: respond(500) }).deleteUser('x')).rejects.toThrow();
  });
});
