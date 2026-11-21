import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN2_AVATAR_ID, ADMIN_AVATAR_ID, ADMIN_AVATAR_IDS, AVATAR_IDS, isAdminAvatar, isAvatarId } from '../../../avatars/ids';
import { useAdmin } from '../../../lib/admin';
import { SAVE_KEYS } from '../../../lib/savecode';
import { byId, CHARACTERS } from '../catalog';
import { DEFAULT_LOOK, getKaiyanLook, pictureHeight, setKaiyanLook } from '../kaiyanLook';
import { ORANGE } from '../orange';
import { isTallPhoto, photoHeight, photoUrlFor } from '../photos';
import { getAvatar, setAvatar } from '../store';

/** The second admin avatar, Juan (requested by Brian, 2026-11-20; a tall photo with a forehead, glare and orange slider from 2026-11-21). */
describe('the second admin avatar (Juan)', () => {
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
    expect(ADMIN_AVATAR_IDS).toContain(ADMIN_AVATAR_ID);
    expect(ADMIN_AVATAR_IDS).toContain(ADMIN2_AVATAR_ID);
    expect(isAvatarId(ADMIN2_AVATAR_ID)).toBe(true);
    expect(AVATAR_IDS).toContain(ADMIN2_AVATAR_ID);
    expect(isAdminAvatar(ADMIN2_AVATAR_ID)).toBe(true);
    expect(isAdminAvatar('sheep')).toBe(false);
    expect(isAdminAvatar(null)).toBe(false);
    expect(byId(ADMIN2_AVATAR_ID)).toBeUndefined();
    expect(CHARACTERS.some((c) => (c.id as string) === ADMIN2_AVATAR_ID)).toBe(false);
  });

  it('is a tall photo like Kaiyan\'s, with its own picture, whose forehead length changes its height', () => {
    expect(isTallPhoto(ADMIN2_AVATAR_ID)).toBe(true);
    expect(photoUrlFor(ADMIN2_AVATAR_ID)).not.toBe(photoUrlFor(ADMIN_AVATAR_ID));
    expect(photoHeight(ADMIN2_AVATAR_ID, 3)).toBe(pictureHeight(3));
    expect(photoHeight(ADMIN2_AVATAR_ID, 6)).toBeGreaterThan(photoHeight(ADMIN2_AVATAR_ID, 1));
  });

  it('ships its picture: a 512 x 1339 PNG, and the old square one is gone', () => {
    const file = new URL('../../assets/admin2-forehead.png', import.meta.url);
    expect(existsSync(file)).toBe(true);
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(1339);
    expect(existsSync(new URL('../../assets/admin2.png', import.meta.url))).toBe(false);
  });

  it('keeps its own forehead, glare and orange, apart from Kaiyan\'s', () => {
    expect(getKaiyanLook(ADMIN2_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    setKaiyanLook({ length: 3, glare: 5, orange: 0.6 }, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook(ADMIN2_AVATAR_ID)).toEqual({ length: 3, glare: 5, orange: 0.6 });
    expect(getKaiyanLook(ADMIN_AVATAR_ID)).toEqual(DEFAULT_LOOK);
    expect(mem.has('sap:admin2-look')).toBe(true);
    setKaiyanLook(null, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook(ADMIN2_AVATAR_ID)).toEqual(DEFAULT_LOOK);
  });

  it('keeps the orange slider within its range, and leaves it out of the saved value at 0', () => {
    setKaiyanLook({ orange: 9 }, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook(ADMIN2_AVATAR_ID).orange).toBe(ORANGE.max);
    setKaiyanLook({ orange: -4 }, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook(ADMIN2_AVATAR_ID).orange).toBeUndefined();
    expect(JSON.parse(mem.get('sap:admin2-look')!)).not.toHaveProperty('orange');
    setKaiyanLook({ orange: 0.4 }, ADMIN2_AVATAR_ID);
    setKaiyanLook({ glare: 1 }, ADMIN2_AVATAR_ID);
    expect(getKaiyanLook(ADMIN2_AVATAR_ID).orange).toBe(0.4); // changing another slider keeps it
  });

  it('never travels in a save code', () => {
    const spec = SAVE_KEYS.find((k) => k.key === 'sap:avatar')!;
    expect(spec.valid(ADMIN2_AVATAR_ID)).toBeNull();
    expect(spec.valid(ADMIN_AVATAR_ID)).toBeNull();
    expect(spec.valid('goat')).toBe('goat');
  });

  it('is worn only while admin is unlocked', () => {
    setAvatar(ADMIN2_AVATAR_ID);
    expect(getAvatar()).toBeNull();
    useAdmin.setState({ admin: true });
    expect(getAvatar()).toBe(ADMIN2_AVATAR_ID);
    useAdmin.setState({ admin: false });
    expect(getAvatar()).toBeNull();
  });
});
