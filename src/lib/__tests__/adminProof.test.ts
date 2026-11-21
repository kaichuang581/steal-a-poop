import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_HASH, adminProof, setAdminHashForTests, sha256Hex, useAdmin } from '../admin';

// A made-up password: the real one is never written into the repo.
const TEST_PASSWORD = 'proof-test-password';

describe('the admin proof (what the game server is sent beside an admin avatar)', () => {
  const mem = new Map<string, string>();
  beforeAll(async () => setAdminHashForTests(await sha256Hex(TEST_PASSWORD)));
  afterAll(() => setAdminHashForTests(ADMIN_HASH));
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
    useAdmin.setState({ admin: false });
  });

  it('is nothing while locked, the password once unlocked, and nothing again after Lock', async () => {
    expect(adminProof()).toBeNull();
    expect(await useAdmin.getState().unlock('wrong')).toBe(false);
    expect(adminProof()).toBeNull();
    expect(await useAdmin.getState().unlock(` ${TEST_PASSWORD} `)).toBe(true);
    expect(adminProof()).toBe(TEST_PASSWORD);
    useAdmin.getState().lock();
    expect(adminProof()).toBeNull();
    expect(mem.get('sap:admin-proof')).toBe('""');
  });

  it('is nothing on a device unlocked before the proof existed', () => {
    useAdmin.setState({ admin: true });
    expect(adminProof()).toBeNull();
  });
});
