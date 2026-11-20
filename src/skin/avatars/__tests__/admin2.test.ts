import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN2_AVATAR_ID, ADMIN_AVATAR_ID, ADMIN_AVATAR_IDS, AVATAR_IDS, isAdminAvatar, isAvatarId } from '../../../avatars/ids';
import { useAdmin } from '../../../lib/admin';
import { SAVE_KEYS } from '../../../lib/savecode';
import { byId, CHARACTERS } from '../catalog';
import { photoHeight, PLAIN_PHOTO, isPlainPhoto, photoUrlFor } from '../photos';
import { pictureHeight } from '../kaiyanLook';
import { getAvatar, setAvatar } from '../store';

/** The second admin avatar (requested by Brian, 2026-11-20): a plain photo beside Kaiyan's, admin-only like it. */
describe('the second admin avatar', () => {
  it('is an admin avatar the server accepts and the picker never offers', () => {
    expect(ADMIN_AVATAR_IDS).toEqual([ADMIN_AVATAR_ID, ADMIN2_AVATAR_ID]);
    expect(isAvatarId(ADMIN2_AVATAR_ID)).toBe(true);
    expect(AVATAR_IDS).toContain(ADMIN2_AVATAR_ID);
    expect(isAdminAvatar(ADMIN2_AVATAR_ID)).toBe(true);
    expect(isAdminAvatar(ADMIN_AVATAR_ID)).toBe(true);
    expect(isAdminAvatar('sheep')).toBe(false);
    expect(isAdminAvatar(null)).toBe(false);
    expect(byId(ADMIN2_AVATAR_ID)).toBeUndefined();
    expect(CHARACTERS.some((c) => (c.id as string) === ADMIN2_AVATAR_ID)).toBe(false);
  });

  it('is a plain square photo: its own picture, no forehead stretch', () => {
    expect(isPlainPhoto(ADMIN2_AVATAR_ID)).toBe(true);
    expect(isPlainPhoto(ADMIN_AVATAR_ID)).toBe(false);
    expect(photoUrlFor(ADMIN2_AVATAR_ID)).not.toBe(photoUrlFor(ADMIN_AVATAR_ID));
    // Kaiyan's length setting changes his height; the plain photo ignores it.
    expect(photoHeight(ADMIN2_AVATAR_ID, 0.1)).toBe(PLAIN_PHOTO.size);
    expect(photoHeight(ADMIN2_AVATAR_ID, 6)).toBe(PLAIN_PHOTO.size);
    expect(photoHeight(ADMIN_AVATAR_ID, 1.8)).toBe(pictureHeight(1.8));
  });

  it('ships its picture: a 512 x 512 PNG', () => {
    const file = new URL('../../assets/admin2.png', import.meta.url);
    expect(existsSync(file)).toBe(true);
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });

  it('never travels in a save code, like Kaiyan', () => {
    const spec = SAVE_KEYS.find((k) => k.key === 'sap:avatar')!;
    expect(spec.valid(ADMIN2_AVATAR_ID)).toBeNull();
    expect(spec.valid(ADMIN_AVATAR_ID)).toBeNull();
    expect(spec.valid('goat')).toBe('goat');
  });

  describe('worn only while admin is unlocked', () => {
    const mem = new Map<string, string>();
    beforeEach(() => {
      mem.clear();
      (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
      };
      useAdmin.setState({ admin: false });
    });
    it('is taken off when admin is locked, and put back when unlocked', () => {
      setAvatar(ADMIN2_AVATAR_ID);
      expect(getAvatar()).toBeNull();
      useAdmin.setState({ admin: true });
      expect(getAvatar()).toBe(ADMIN2_AVATAR_ID);
      useAdmin.setState({ admin: false });
      expect(getAvatar()).toBeNull();
    });
  });
});
