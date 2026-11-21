import { describe, expect, it } from 'vitest';
import { ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID, ADMIN_AVATAR_ID, baseAvatarId, isAdminAvatar, isAvatarId, orangeOf, withOrange } from '../../../avatars/ids';
import { photoUrlFor } from '../photos';
import { getKaiyanLook, setKaiyanLook } from '../kaiyanLook';

/** Juan's orange amount reaches the room on his avatar id: `admin2~12` is 60%. */
describe("Juan's orange on the avatar id", () => {
  it('writes an amount in twentieths onto Juan and nobody else', () => {
    expect(withOrange(ADMIN2_AVATAR_ID, 0.6)).toBe('admin2~12');
    expect(withOrange(ADMIN2_AVATAR_ID, 1)).toBe('admin2~20');
    expect(withOrange(ADMIN2_AVATAR_ID, 0.05)).toBe('admin2~1');
    expect(withOrange(ADMIN2_AVATAR_ID, 0)).toBe(ADMIN2_AVATAR_ID);
    expect(withOrange(ADMIN2_AVATAR_ID, 0.01)).toBe(ADMIN2_AVATAR_ID); // rounds to nothing
    expect(withOrange(ADMIN2_AVATAR_ID, 9)).toBe('admin2~20');
    expect(withOrange(ADMIN2_AVATAR_ID, -3)).toBe(ADMIN2_AVATAR_ID);
    for (const bad of [Number.NaN, Infinity, '0.5', null, undefined, {}]) expect(withOrange(ADMIN2_AVATAR_ID, bad)).toBe(ADMIN2_AVATAR_ID);
    for (const id of [ADMIN_AVATAR_ID, ADMIN3_AVATAR_ID, 'sheep']) expect(withOrange(id, 0.6)).toBe(id);
  });

  it('reads it back, and only in the form the server writes', () => {
    expect(orangeOf('admin2~12')).toBe(0.6);
    expect(orangeOf('admin2~20')).toBe(1);
    expect(orangeOf('admin2~1')).toBe(0.05);
    for (const bad of ['admin2', 'admin2~0', 'admin2~21', 'admin2~-1', 'admin2~1.5', 'admin2~ab', 'admin2~012', 'kaiyan~5', 'sheep~5', '', null, undefined]) expect(orangeOf(bad)).toBeNull();
  });

  it('is still the same avatar underneath', () => {
    expect(baseAvatarId('admin2~12')).toBe('admin2');
    expect(baseAvatarId('sheep')).toBe('sheep');
    expect(baseAvatarId(null)).toBeNull();
    expect(isAdminAvatar('admin2~12')).toBe(true);
    expect(isAdminAvatar('sheep~12')).toBe(false);
    expect(photoUrlFor('admin2~12')).toBe(photoUrlFor('admin2'));
  });

  it('is never a choice a browser can save or send as an id', () => {
    expect(isAvatarId('admin2~12')).toBe(false);
    expect(isAvatarId('admin2')).toBe(true);
  });

  it("finds Juan's saved look under his id with an orange suffix too", () => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
    };
    setKaiyanLook({ length: 3, orange: 0.4 }, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook('admin2~12')).toEqual(getKaiyanLook(ADMIN2_AVATAR_ID));
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
