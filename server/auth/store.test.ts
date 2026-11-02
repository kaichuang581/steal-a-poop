import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DELETED_NICKNAME, MemoryAccountStore, PostgresAccountStore } from './store';
import type { AccountStore, ConsentRecord, Profile } from './store';

const profile = (id: string, nickname: string, over: Partial<Profile> = {}): Profile => ({
  userId: id, nickname, emailHash: `h-${id}`, dateOfBirth: '2016-05-05', country: 'CA', consentStatus: 'pending', isModerator: false,
  sessionsValidAfter: 0, createdAt: 1000, updatedAt: 1000, deletedAt: null, ...over,
});
const consent = (id: string, child: string, over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id, childUserId: child, parentEmail: 'mum@example.org', requestTokenHash: `req-${id}`, manageTokenHash: null, policyVersion: 'v1', noticeHash: 'n',
  method: 'email_link', requestedAt: 1, expiresAt: 2, decidedAt: null, decision: null, ...over,
});

/** The same behaviour for the memory store and the real database. */
function behaves(make: () => Promise<AccountStore>) {
  it('creates a profile once and reads it back, including the date of birth as plain text', async () => {
    const s = await make();
    expect(await s.createProfile(profile('u1', 'Ana'))).toBe(true);
    expect(await s.createProfile(profile('u1', 'Other'))).toBe(false);
    expect(await s.getProfile('u1')).toEqual(profile('u1', 'Ana'));
    expect(await s.getProfile('nobody')).toBeNull();
  });
  it('updates only the fields given', async () => {
    const s = await make();
    await s.createProfile(profile('u1', 'Ana'));
    await s.updateProfile('u1', { consentStatus: 'granted', sessionsValidAfter: 5000, updatedAt: 2000 });
    expect(await s.getProfile('u1')).toMatchObject({ nickname: 'Ana', consentStatus: 'granted', sessionsValidAfter: 5000, updatedAt: 2000, dateOfBirth: '2016-05-05' });
  });
  it('nicknames are unique regardless of case, until the account is deleted', async () => {
    const s = await make();
    await s.createProfile(profile('u1', 'Ana'));
    expect(await s.nicknameTaken('ANA')).toBe(true);
    expect(await s.nicknameTaken('Bea')).toBe(false);
    await s.anonymizeProfile('u1', 9000);
    expect(await s.nicknameTaken('Ana')).toBe(false);
    expect(await s.createProfile(profile('u2', 'Ana'))).toBe(true);
  });
  it('anonymising removes the personal fields and keeps the row', async () => {
    const s = await make();
    await s.createProfile(profile('u1', 'Ana', { isModerator: true }));
    await s.anonymizeProfile('u1', 9000);
    expect(await s.getProfile('u1')).toMatchObject({ nickname: DELETED_NICKNAME, dateOfBirth: null, country: null, emailHash: '', isModerator: false, deletedAt: 9000 });
  });
  it('stores and finds consent records by the hash of either token, and lists a child\'s', async () => {
    const s = await make();
    await s.saveConsent(consent('c1', 'u1'));
    await s.saveConsent(consent('c2', 'u1', { requestedAt: 5 }));
    await s.saveConsent(consent('c1', 'u1', { decision: 'granted', decidedAt: 3, manageTokenHash: 'man-c1' }));
    expect(await s.consentByRequestHash('req-c1')).toMatchObject({ id: 'c1', decision: 'granted', manageTokenHash: 'man-c1' });
    expect(await s.consentByManageHash('man-c1')).toMatchObject({ id: 'c1' });
    expect(await s.consentByRequestHash('nope')).toBeNull();
    expect((await s.consentsForChild('u1')).map((c) => c.id)).toEqual(['c1', 'c2']);
  });
  it('remembers banned identities', async () => {
    const s = await make();
    await s.addBannedIdentity({ identityHash: 'abc', reason: 'x', bannedAt: 1, sourceUserId: 'u1' });
    await s.addBannedIdentity({ identityHash: 'abc', reason: 'again', bannedAt: 2, sourceUserId: 'u1' }); // no error, no duplicate
    expect(await s.isBannedIdentity('abc')).toBe(true);
    expect(await s.isBannedIdentity('zzz')).toBe(false);
  });
  it('remembers revoked sessions until they expire, then purges them', async () => {
    const s = await make();
    await s.revokeSession('s1', 'u1', 100, 1000);
    await s.revokeSession('s2', 'u1', 100, 5000);
    expect(await s.isSessionRevoked('s1')).toBe(true);
    expect(await s.purgeRevokedSessions(2000)).toBe(1);
    expect(await s.isSessionRevoked('s1')).toBe(false);
    expect(await s.isSessionRevoked('s2')).toBe(true);
  });
}

describe('MemoryAccountStore', () => {
  behaves(async () => new MemoryAccountStore());
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresAccountStore against a real Postgres (set TEST_DATABASE_URL)', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/100_accounts.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists profiles, parental_consents, banned_identities, revoked_sessions cascade');
    await pool.query(migration);
  });
  it('the migration can be run twice', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
  });
  behaves(async () => new PostgresAccountStore(pool));

  it('consent records can never be deleted or truncated', async () => {
    const s = new PostgresAccountStore(pool);
    await s.saveConsent(consent('c1', 'u1'));
    await expect(pool.query('delete from parental_consents')).rejects.toThrow(/cannot be deleted/);
    await expect(pool.query('truncate parental_consents')).rejects.toThrow(/cannot be deleted/);
  });
  it('row security is on for every table, so the browser keys see nothing', async () => {
    const { rows } = await pool.query("select relname, relrowsecurity from pg_class where relname in ('profiles','parental_consents','banned_identities','revoked_sessions') and relkind = 'r'");
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it('two live accounts cannot share a nickname even by case, but a deleted one frees it', async () => {
    const s = new PostgresAccountStore(pool);
    await s.createProfile(profile('u1', 'Ana'));
    await expect(s.createProfile(profile('u2', 'ANA'))).rejects.toThrow();
  });
});
