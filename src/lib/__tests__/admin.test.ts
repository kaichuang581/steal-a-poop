import { describe, expect, it } from 'vitest';
import { ADMIN_HASH, isAdmin, sha256Hex, useAdmin } from '../admin';

describe('admin access', () => {
  it('starts locked, opens only to the one password, and locks again', async () => {
    expect(isAdmin()).toBe(false);
    expect(await useAdmin.getState().unlock('kai')).toBe(false);
    expect(await useAdmin.getState().unlock('')).toBe(false);
    expect(isAdmin()).toBe(false);
    expect(await useAdmin.getState().unlock(' kaichuangissmelly ')).toBe(true);
    expect(isAdmin()).toBe(true);
    useAdmin.getState().lock();
    expect(isAdmin()).toBe(false);
  });

  it('keeps only a hash of the password', async () => {
    expect(await sha256Hex('kaichuangissmelly')).toBe(ADMIN_HASH);
    expect(ADMIN_HASH).not.toContain('smelly');
  });
});
