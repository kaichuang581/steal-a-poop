import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID, ADMIN_AVATAR_ID, ADMIN_AVATAR_IDS, AVATAR_IDS, isAdminAvatar, isAvatarId } from '../../../avatars/ids';
import { useAdmin } from '../../../lib/admin';
import { SAVE_KEYS } from '../../../lib/savecode';
import { byId } from '../catalog';
import { DEFAULT_LOOK, GLARE, LENGTH, getKaiyanLook, pictureHeight, setKaiyanLook } from '../kaiyanLook';
import { isPlainPhoto, isTallPhoto, photoHeight, photoUrlFor } from '../photos';
import { getAvatar, setAvatar } from '../store';

/** The third admin avatar (requested by Brian, 2026-11-21): another photo with Kaiyan's long forehead and glare. */
describe('the third admin avatar', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
    useAdmin.setState({ admin: false });
  });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('is an admin avatar the server accepts and the picker never offers', () => {
    expect(ADMIN_AVATAR_IDS).toEqual([ADMIN_AVATAR_ID, ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID]);
    expect(isAvatarId(ADMIN3_AVATAR_ID)).toBe(true);
    expect(AVATAR_IDS).toContain(ADMIN3_AVATAR_ID);
    expect(isAdminAvatar(ADMIN3_AVATAR_ID)).toBe(true);
    expect(byId(ADMIN3_AVATAR_ID)).toBeUndefined();
  });

  it('is a tall photo like Kaiyan\'s, with its own picture; the second one stays plain', () => {
    expect(isTallPhoto(ADMIN3_AVATAR_ID)).toBe(true);
    expect(isTallPhoto(ADMIN_AVATAR_ID)).toBe(true);
    expect(isTallPhoto(ADMIN2_AVATAR_ID)).toBe(false);
    expect(isTallPhoto('sheep')).toBe(false);
    expect(isTallPhoto(null)).toBe(false);
    expect(isPlainPhoto(ADMIN3_AVATAR_ID)).toBe(false);
    expect(new Set([ADMIN_AVATAR_ID, ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID].map(photoUrlFor)).size).toBe(3);
    expect(photoHeight(ADMIN3_AVATAR_ID, 3)).toBe(pictureHeight(3));
  });

  it('ships its picture: a 512 x 1339 PNG, the same three slices as Kaiyan\'s', () => {
    for (const name of ['admin3-forehead.png', 'kaiyan-forehead.png']) {
      const file = new URL(`../../assets/${name}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      const png = readFileSync(file);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(512);
      expect(png.readUInt32BE(20)).toBe(1339);
    }
  });

  it('keeps its own forehead and glare, apart from Kaiyan\'s', () => {
    expect(getKaiyanLook(ADMIN3_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    setKaiyanLook({ length: 4, glare: GLARE.max }, ADMIN3_AVATAR_ID);
    expect(getKaiyanLook(ADMIN3_AVATAR_ID)).toEqual({ length: 4, glare: GLARE.max });
    expect(getKaiyanLook(ADMIN_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    expect(getKaiyanLook()).toEqual(DEFAULT_LOOK);
    setKaiyanLook({ length: LENGTH.min }, ADMIN_AVATAR_ID);
    expect(getKaiyanLook(ADMIN3_AVATAR_ID).length).toBe(4);
    expect(getKaiyanLook(ADMIN_AVATAR_ID).length).toBe(LENGTH.min);
    expect(mem.has('sap:admin3-look')).toBe(true);
    expect(mem.has('sap:kaiyan-look')).toBe(true);
    setKaiyanLook(null, ADMIN3_AVATAR_ID);
    expect(getKaiyanLook(ADMIN3_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    expect(getKaiyanLook(ADMIN_AVATAR_ID).length).toBe(LENGTH.min);
  });

  it('shrugs off a broken saved value, and an unknown id reads Kaiyan\'s', () => {
    mem.set('sap:admin3-look', '{nope');
    expect(getKaiyanLook(ADMIN3_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    setKaiyanLook({ length: 2.5 }, ADMIN_AVATAR_ID);
    expect(getKaiyanLook('constructor')).toEqual(getKaiyanLook(ADMIN_AVATAR_ID));
  });

  it('never travels in a save code, and is worn only while admin is unlocked', () => {
    const spec = SAVE_KEYS.find((k) => k.key === 'sap:avatar')!;
    expect(spec.valid(ADMIN3_AVATAR_ID)).toBeNull();
    setAvatar(ADMIN3_AVATAR_ID);
    expect(getAvatar()).toBeNull();
    useAdmin.setState({ admin: true });
    expect(getAvatar()).toBe(ADMIN3_AVATAR_ID);
    useAdmin.setState({ admin: false });
    expect(getAvatar()).toBeNull();
  });
});
