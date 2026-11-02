import { SignJWT, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { TokenVerifier } from './tokens';
import { MemoryAccountStore } from './store';
import type { Profile } from './store';

const ISS = 'https://proj.supabase.co/auth/v1';
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
let priv: CryptoKey;
let pub: CryptoKey;
let otherPriv: CryptoKey;

beforeAll(async () => {
  ({ privateKey: priv, publicKey: pub } = await generateKeyPair('ES256'));
  ({ privateKey: otherPriv } = await generateKeyPair('ES256'));
});

async function token(over: Record<string, unknown> = {}, opts: { key?: CryptoKey; alg?: string; iss?: string; aud?: string; iat?: number; exp?: number } = {}) {
  const iat = opts.iat ?? Math.floor(NOW / 1000) - 60;
  return new SignJWT({ session_id: 's1', email: 'ana@example.org', amr: [{ method: 'password', timestamp: iat }], ...over })
    .setProtectedHeader({ alg: opts.alg ?? 'ES256' })
    .setSubject('u1').setIssuer(opts.iss ?? ISS).setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt(iat).setExpirationTime(opts.exp ?? iat + 3600)
    .sign(opts.key ?? priv);
}
const profile = (over: Partial<Profile> = {}): Profile => ({
  userId: 'u1', nickname: 'Ana', emailHash: 'h', dateOfBirth: '2000-01-01', country: 'CA', consentStatus: 'not_required',
  isModerator: false, sessionsValidAfter: 0, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
});
function setup() {
  const store = new MemoryAccountStore();
  const v = new TokenVerifier({ issuer: ISS, key: pub, algorithms: ['ES256'], now: () => NOW }, store);
  return { store, v };
}

describe('TokenVerifier.claims', () => {
  it('accepts a good token and reads the login details', async () => {
    const { v } = setup();
    const c = await v.claims(await token());
    expect(c).toMatchObject({ userId: 'u1', email: 'ana@example.org', sessionId: 's1' });
    expect(c!.expiresAt - c!.issuedAt).toBe(3600_000);
    expect(c!.authenticatedAt).toBe(c!.issuedAt);
  });
  it('refuses a token signed by another key, the wrong issuer or audience, or an expired one', async () => {
    const { v } = setup();
    expect(await v.claims(await token({}, { key: otherPriv }))).toBeNull();
    expect(await v.claims(await token({}, { iss: 'https://evil.example/auth/v1' }))).toBeNull();
    expect(await v.claims(await token({}, { aud: 'anon' }))).toBeNull();
    expect(await v.claims(await token({}, { iat: Math.floor(NOW / 1000) - 7200, exp: Math.floor(NOW / 1000) - 3600 }))).toBeNull();
  });
  it('refuses garbage, an unsigned token, and a token with the algorithm swapped to none', async () => {
    const { v } = setup();
    expect(await v.claims('nope')).toBeNull();
    expect(await v.claims('')).toBeNull();
    const body = Buffer.from(JSON.stringify({ sub: 'u1', iss: ISS, aud: 'authenticated', session_id: 's1', iat: 1, exp: 9999999999 })).toString('base64url');
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${body}.`;
    expect(await v.claims(none)).toBeNull();
  });
  it('refuses a token without a subject or session id', async () => {
    const { v } = setup();
    expect(await v.claims(await token({ session_id: undefined }))).toBeNull();
    expect(await v.claims(await token({ session_id: '' }))).toBeNull();
  });
  it('refuses a session that was logged out, but not other sessions', async () => {
    const { v, store } = setup();
    await store.revokeSession('s1', 'u1', NOW, NOW + 3600_000);
    expect(await v.claims(await token())).toBeNull();
    expect(await v.claims(await token({ session_id: 's2' }))).not.toBeNull();
  });
  it('refuses tokens issued before "log out everywhere", accepts newer ones', async () => {
    const { v, store } = setup();
    await store.createProfile(profile({ sessionsValidAfter: NOW - 30_000 }));
    expect(await v.claims(await token({}, { iat: Math.floor(NOW / 1000) - 60 }))).toBeNull();
    expect(await v.claims(await token({}, { iat: Math.floor(NOW / 1000) - 10 }))).not.toBeNull();
  });
  it('refuses a deleted account', async () => {
    const { v, store } = setup();
    await store.createProfile(profile({ deletedAt: NOW - 1 }));
    expect(await v.claims(await token())).toBeNull();
  });
  it('reads when the person last proved who they are, not when the token was refreshed', async () => {
    const { v } = setup();
    const loginAt = Math.floor(NOW / 1000) - 3000;
    const c = await v.claims(await token({ amr: [{ method: 'password', timestamp: loginAt }] }, { iat: Math.floor(NOW / 1000) - 5 }));
    expect(c!.authenticatedAt).toBe(loginAt * 1000);
    expect(c!.issuedAt).toBeGreaterThan(c!.authenticatedAt);
  });
});

describe('TokenVerifier.authenticate', () => {
  it('needs a profile', async () => {
    const { v } = setup();
    expect(await v.authenticate(await token())).toBeNull();
  });
  it('builds the player from the profile, with the session for expiry', async () => {
    const { v, store } = setup();
    await store.createProfile(profile({ isModerator: true }));
    const u = await v.authenticate(await token());
    expect(u).toMatchObject({ userId: 'u1', name: 'Ana', chatAllowed: true, resultsAllowed: true, isModerator: true, country: 'CA' });
    expect(u!.session).toMatchObject({ id: 's1' });
  });
  it('a child without a parent\'s consent can play but not chat, and results are not stored', async () => {
    const { v, store } = setup();
    await store.createProfile(profile({ consentStatus: 'pending' }));
    expect(await v.authenticate(await token())).toMatchObject({ chatAllowed: false, resultsAllowed: false });
    await store.updateProfile('u1', { consentStatus: 'granted' });
    expect(await v.authenticate(await token())).toMatchObject({ chatAllowed: true });
    await store.updateProfile('u1', { consentStatus: 'withdrawn' });
    expect(await v.authenticate(await token())).toMatchObject({ chatAllowed: false });
  });
});

describe('TokenVerifier with a shared secret (legacy projects)', () => {
  it('verifies HS256 and refuses a different secret', async () => {
    const store = new MemoryAccountStore();
    const v = new TokenVerifier({ issuer: ISS, jwtSecret: 'x'.repeat(40), now: () => NOW }, store);
    const sign = (secret: string) =>
      new SignJWT({ session_id: 's1' }).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setIssuer(ISS).setAudience('authenticated')
        .setIssuedAt(Math.floor(NOW / 1000) - 5).setExpirationTime(Math.floor(NOW / 1000) + 600).sign(new TextEncoder().encode(secret));
    expect(await v.claims(await sign('x'.repeat(40)))).not.toBeNull();
    expect(await v.claims(await sign('y'.repeat(40)))).toBeNull();
  });
  it('will not be built without any key', () => {
    expect(() => new TokenVerifier({ issuer: ISS }, new MemoryAccountStore())).toThrow();
  });
});
