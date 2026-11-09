import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_HASH, isAdmin, setAdminHashForTests, sha256Hex, useAdmin } from '../admin';

// A made-up password: the real one is never written into the repo.
const TEST_PASSWORD = 'test-only-password';

describe('admin access', () => {
  beforeAll(async () => setAdminHashForTests(await sha256Hex(TEST_PASSWORD)));
  afterAll(() => setAdminHashForTests(ADMIN_HASH));

  it('starts locked, opens only to the one password, and locks again', async () => {
    expect(isAdmin()).toBe(false);
    expect(await useAdmin.getState().unlock('kai')).toBe(false);
    expect(await useAdmin.getState().unlock('')).toBe(false);
    expect(isAdmin()).toBe(false);
    expect(await useAdmin.getState().unlock(` ${TEST_PASSWORD} `)).toBe(true);
    expect(isAdmin()).toBe(true);
    useAdmin.getState().lock();
    expect(isAdmin()).toBe(false);
  });

  it('ships only a hash, and not the one that leaked', () => {
    expect(ADMIN_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(ADMIN_HASH).not.toBe('4303a4957aae4dbf0d0c392f5e0bb4690b8b8be1f032f07d5692b960c8248f90');
  });
});
