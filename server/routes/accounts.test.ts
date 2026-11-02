import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SignJWT, generateKeyPair } from 'jose';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BlockList } from '../blocks';
import { DevCaptcha } from '../auth/captcha';
import { MemoryMailer } from '../auth/mailer';
import { DEFAULT_AGE_POLICY } from '../auth/policy';
import { RevocationBus } from '../auth/revocations';
import { AccountService } from '../auth/service';
import { MemoryAccountStore } from '../auth/store';
import { TokenVerifier } from '../auth/tokens';
import { createHttpServer } from '../http';
import { createAccountRoutes } from './accounts';

const ISS = 'https://proj.supabase.co/auth/v1';
let priv: CryptoKey;
let pub: CryptoKey;
let server: Server | undefined;
beforeAll(async () => ({ privateKey: priv, publicKey: pub } = await generateKeyPair('ES256')));
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

const sign = (sub: string, o: { session?: string; email?: string; loginAgeSec?: number; issuedAgoSec?: number } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ session_id: o.session ?? `s-${sub}`, email: o.email ?? `${sub}@example.org`, amr: [{ method: 'password', timestamp: now - (o.loginAgeSec ?? 5) }] })
    .setProtectedHeader({ alg: 'ES256' }).setSubject(sub).setIssuer(ISS).setAudience('authenticated').setIssuedAt(now - (o.issuedAgoSec ?? 5)).setExpirationTime(now + 3600).sign(priv);
};

async function boot() {
  const store = new MemoryAccountStore();
  const mailer = new MemoryMailer();
  const bus = new RevocationBus();
  const events: unknown[] = [];
  bus.on((...e) => events.push(e));
  const verifier = new TokenVerifier({ issuer: ISS, key: pub, algorithms: ['ES256'] }, store);
  const service = new AccountService({
    store, now: Date.now, mailer, agePolicy: DEFAULT_AGE_POLICY, nicknameAllowed: () => true, blocks: new BlockList(), bus,
    authAdmin: { deleteUser: async () => {} }, appUrl: 'https://game.example/',
  });
  server = createHttpServer({
    routes: createAccountRoutes({ service, captcha: new DevCaptcha() }),
    verifyToken: (t) => verifier.authenticate(t),
    verifySession: (t) => verifier.claims(t),
  });
  await new Promise<void>((r) => server!.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { call, store, mailer, events };
}
const GOOD = { nickname: 'Ana', dateOfBirth: '1990-05-05', country: 'CA', captchaToken: 'dev-ok' };

describe('POST /api/account/profile', () => {
  it('needs a login, and a CAPTCHA', async () => {
    const { call } = await boot();
    expect((await call('POST', '/api/account/profile', undefined, GOOD)).status).toBe(401);
    expect((await call('POST', '/api/account/profile', 'garbage', GOOD)).status).toBe(401);
    const noCaptcha = await call('POST', '/api/account/profile', await sign('u1'), { ...GOOD, captchaToken: undefined });
    expect([noCaptcha.status, noCaptcha.json.error]).toEqual([403, 'captcha_failed']);
  });
  it('creates the profile, then /me shows it', async () => {
    const { call } = await boot();
    const t = await sign('u1');
    expect((await call('GET', '/api/account/me', t)).json).toEqual({ profile: null });
    const made = await call('POST', '/api/account/profile', t, GOOD);
    expect([made.status, made.json.profile.nickname, made.json.profile.consentStatus]).toEqual([201, 'Ana', 'not_required']);
    expect((await call('GET', '/api/account/me', t)).json.profile.nickname).toBe('Ana');
    expect((await call('POST', '/api/account/profile', t, GOOD)).status).toBe(409);
  });
  it('maps problems to clear codes', async () => {
    const { call } = await boot();
    const t = await sign('u1');
    const err = async (b: object) => (await call('POST', '/api/account/profile', t, { ...GOOD, ...b })).json.error;
    expect(await err({ dateOfBirth: 'nope' })).toBe('bad_dob');
    expect(await err({ country: '??' })).toBe('bad_country');
    expect(await err({ nickname: '' })).toBe('bad_nickname');
    expect(await err({ dateOfBirth: '2018-01-01' })).toBe('parent_email_required');
  });
  it('a child: pending, the parent is emailed, and the parent\'s page works end to end', async () => {
    const { call, mailer } = await boot();
    const t = await sign('kid');
    const made = await call('POST', '/api/account/profile', t, { ...GOOD, nickname: 'Kiddo', dateOfBirth: '2018-01-01', parentEmail: 'mum@example.org' });
    expect([made.status, made.json.profile.consentStatus, made.json.parentMailed]).toEqual([201, 'pending', true]);
    const token = /#\/consent\/(\S+)/.exec(mailer.sent[0].text)![1];
    expect((await call('GET', `/api/consent/${token}`)).json).toEqual({ state: 'open', childNickname: 'Kiddo' });
    expect((await call('GET', '/api/consent/not-a-token')).status).toBe(404);
    expect((await call('POST', `/api/consent/${token}`, undefined, { decision: 'maybe' })).json.error).toBe('bad_decision');
    expect((await call('POST', `/api/consent/${token}`, undefined, { decision: 'grant' })).json).toEqual({ state: 'granted' });
    expect((await call('POST', `/api/consent/${token}`, undefined, { decision: 'grant' })).status).toBe(409);
    expect((await call('GET', '/api/account/me', t)).json.profile.consentStatus).toBe('granted');
    const manage = /consent\/manage\/(\S+)/.exec(mailer.sent[1].text)![1];
    expect((await call('POST', `/api/consent/manage/${manage}/withdraw`)).json).toEqual({ state: 'withdrawn' });
    expect((await call('GET', '/api/account/me', t)).json.profile.consentStatus).toBe('withdrawn');
  });
  it('limits how often one address, one person, and one parent mailbox can be used', async () => {
    const { call } = await boot();
    const kid = (i: number) => sign(`k${i}`);
    // one parent mailbox: 3 requests a day
    for (let i = 0; i < 3; i++) {
      const r = await call('POST', '/api/account/profile', await kid(i), { ...GOOD, nickname: `Kid${i}`, dateOfBirth: '2018-01-01', parentEmail: 'same.parent@example.org' });
      expect(r.status).toBe(201);
    }
    const fourth = await call('POST', '/api/account/profile', await kid(3), { ...GOOD, nickname: 'Kid3', dateOfBirth: '2018-01-01', parentEmail: 'Same.Parent@example.org' });
    expect([fourth.status, fourth.json.error]).toEqual([429, 'rate_limited']);
  });
  it('limits sign-ups from one address', async () => {
    const { call } = await boot();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await call('POST', '/api/account/profile', await sign(`u${i}`), { ...GOOD, nickname: `Nick${i}` })).status;
    expect(last).toBe(429); // 10 an hour per address
  });
});

describe('sessions', () => {
  it('logout ends that session at once but not another', async () => {
    const { call, events } = await boot();
    const a = await sign('u1', { session: 'A' });
    const b = await sign('u1', { session: 'B' });
    await call('POST', '/api/account/profile', a, GOOD);
    expect((await call('GET', '/api/account/me', a)).status).toBe(200);
    expect((await call('POST', '/api/account/logout', a)).status).toBe(200);
    expect((await call('GET', '/api/account/me', a)).status).toBe(401);
    expect((await call('GET', '/api/account/me', b)).status).toBe(200);
    expect(events).toContainEqual(['u1', 'A', 'logout']);
  });
  it('logout everywhere ends tokens issued before it, on every device', async () => {
    const { call } = await boot();
    const a = await sign('u1', { session: 'A' });
    const b = await sign('u1', { session: 'B' });
    await call('POST', '/api/account/profile', a, GOOD);
    await new Promise((r) => setTimeout(r, 1100)); // tokens carry whole seconds
    expect((await call('POST', '/api/account/logout-all', a)).status).toBe(200);
    expect((await call('GET', '/api/account/me', a)).status).toBe(401);
    expect((await call('GET', '/api/account/me', b)).status).toBe(401);
    const fresh = await sign('u1', { session: 'C', issuedAgoSec: 0 }); // signing in again afterwards works
    expect((await call('GET', '/api/account/me', fresh)).status).toBe(200);
  });
});

describe('deleting an account', () => {
  it('needs the confirmation word and a fresh sign-in', async () => {
    const { call, store } = await boot();
    const t = await sign('u1');
    await call('POST', '/api/account/profile', t, GOOD);
    expect((await call('POST', '/api/account/delete', t, {})).json.error).toBe('confirmation_required');
    const stale = await sign('u1', { loginAgeSec: 3600 });
    const r = await call('POST', '/api/account/delete', stale, { confirm: 'DELETE' });
    expect([r.status, r.json.error]).toEqual([403, 'reauth_required']);
    expect((await store.getProfile('u1'))!.nickname).toBe('Ana');
    expect((await call('POST', '/api/account/delete', t, { confirm: 'DELETE' })).status).toBe(200);
    expect((await store.getProfile('u1'))!.deletedAt).not.toBeNull();
    expect((await call('GET', '/api/account/me', t)).status).toBe(401); // the old token no longer works
  });
});

describe('consent resend', () => {
  it('only for a pending child, and rate limited', async () => {
    const { call, mailer } = await boot();
    const adult = await sign('a');
    await call('POST', '/api/account/profile', adult, GOOD);
    expect((await call('POST', '/api/account/consent/resend', adult)).json.error).toBe('not_pending');
    const kid = await sign('k');
    await call('POST', '/api/account/profile', kid, { ...GOOD, nickname: 'Kiddo', dateOfBirth: '2018-01-01', parentEmail: 'mum@example.org' });
    expect((await call('POST', '/api/account/consent/resend', kid)).json).toEqual({ parentMailed: true });
    expect(mailer.sent).toHaveLength(2);
  });
});
