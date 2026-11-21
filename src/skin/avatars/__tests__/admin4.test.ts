import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN4_AVATAR_ID, ADMIN_AVATAR_ID, ageOf, isAdminAvatar, isAvatarId, withAge } from '../../../avatars/ids';
import { SAVE_KEYS } from '../../../lib/savecode';
import { byId } from '../catalog';
import { defaultLookFor, getKaiyanLook, rangesFor, setKaiyanLook } from '../kaiyanLook';
import { AGE, ageData, ageUp, creaseAt } from '../orange';
import { photoUrlFor } from '../photos';

/** The fourth admin avatar (requested by Brian, 2026-11-21): sliders to 12x and an age slider. */
describe('the fourth admin avatar', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
  });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('is an admin avatar the server accepts and the picker never offers; it never travels in a save code', () => {
    expect(isAvatarId(ADMIN4_AVATAR_ID)).toBe(true);
    expect(isAdminAvatar(ADMIN4_AVATAR_ID)).toBe(true);
    expect(byId(ADMIN4_AVATAR_ID)).toBeUndefined();
    expect(SAVE_KEYS.find((k) => k.key === 'sap:avatar')!.valid(ADMIN4_AVATAR_ID)).toBeNull();
  });

  it('ships its own 512 x 1339 picture', () => {
    const file = new URL('../../assets/admin4-forehead.png', import.meta.url);
    expect(existsSync(file)).toBe(true);
    const png = readFileSync(file);
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(1339);
    expect(photoUrlFor(ADMIN4_AVATAR_ID)).not.toBe(photoUrlFor(ADMIN_AVATAR_ID));
  });

  it('opens with forehead and glare at 12x, which are also the top of their sliders; the others keep 1.8 and 2', () => {
    expect(rangesFor(ADMIN4_AVATAR_ID).length.max).toBe(12);
    expect(rangesFor(ADMIN4_AVATAR_ID).glare.max).toBe(12);
    expect(defaultLookFor(ADMIN4_AVATAR_ID)).toEqual({ length: 12, glare: 12 });
    expect(getKaiyanLook(ADMIN4_AVATAR_ID)).toEqual({ length: 12, glare: 12 });
    expect(defaultLookFor(ADMIN_AVATAR_ID)).toEqual({ length: 1.8, glare: 2 });
    expect(rangesFor(ADMIN_AVATAR_ID).length.max).toBe(6);
    setKaiyanLook({ length: 40, glare: 40, age: 99 }, ADMIN4_AVATAR_ID);
    expect(getKaiyanLook(ADMIN4_AVATAR_ID)).toEqual({ length: 12, glare: 12, age: AGE.max });
    setKaiyanLook({ length: 40 }, ADMIN_AVATAR_ID);
    expect(getKaiyanLook(ADMIN_AVATAR_ID).length).toBe(6); // the others still stop at 6
    setKaiyanLook(null, ADMIN4_AVATAR_ID);
    expect(getKaiyanLook(ADMIN4_AVATAR_ID)).toEqual({ length: 12, glare: 12 });
  });

  it('writes its age onto the id in halves, and reads it back only in that form', () => {
    expect(withAge(ADMIN4_AVATAR_ID, 6)).toBe('admin4~12');
    expect(withAge(ADMIN4_AVATAR_ID, 12)).toBe('admin4~24');
    expect(withAge(ADMIN4_AVATAR_ID, 99)).toBe('admin4~24');
    expect(withAge(ADMIN4_AVATAR_ID, 0)).toBe(ADMIN4_AVATAR_ID);
    expect(withAge(ADMIN4_AVATAR_ID, 'old')).toBe(ADMIN4_AVATAR_ID);
    expect(withAge('admin2', 6)).toBe('admin2');
    expect(ageOf('admin4~12')).toBe(6);
    expect(ageOf('admin4~24')).toBe(12);
    for (const bad of ['admin4', 'admin4~0', 'admin4~25', 'admin2~5', 'admin4~x', null]) expect(ageOf(bad)).toBeNull();
    expect(isAvatarId('admin4~12')).toBe(false);
    expect(isAdminAvatar('admin4~12')).toBe(true);
    expect(photoUrlFor('admin4~12')).toBe(photoUrlFor(ADMIN4_AVATAR_ID));
  });

  describe('the age maths', () => {
    const SKIN: [number, number, number] = [214, 170, 140];
    const lum = ([r, g, b]: number[]) => 0.299 * r + 0.587 * g + 0.114 * b;
    it('does nothing at 0 and leaves the backdrop, suit and shirt alone', () => {
      expect(ageUp(...SKIN, 0, 3, 3)).toEqual(SKIN);
      for (const px of [[100, 130, 200], [30, 35, 55], [250, 250, 252]] as [number, number, number][]) expect(ageUp(...px, 12, 9, 9)).toEqual(px);
    });
    it('makes skin steadily darker with the amount, and much darker in a crease', () => {
      let crease = -1, plain = -1;
      for (let y = 0; y < 40 && (crease < 0 || plain < 0); y++) { if (creaseAt(5, y) > 0.95 && crease < 0) crease = y; if (creaseAt(5, y) === 0 && plain < 0) plain = y; }
      expect(crease).toBeGreaterThanOrEqual(0);
      expect(plain).toBeGreaterThanOrEqual(0);
      let prev = lum(SKIN);
      for (let a = AGE.step; a <= AGE.max + 1e-9; a += AGE.step) {
        const l = lum(ageUp(...SKIN, a, 5, plain));
        expect(l).toBeLessThan(prev);
        prev = l;
      }
      expect(lum(ageUp(...SKIN, 12, 5, crease))).toBeLessThan(lum(ageUp(...SKIN, 12, 5, plain)) * 0.7);
    });
    it('keeps channels in range and alpha alone, over a whole row of pixels', () => {
      const d = new Uint8ClampedArray(4 * 64);
      for (let i = 0; i < 64; i++) d.set([214, 170, 140, 77], i * 4);
      ageData(d, 8, 12);
      for (let i = 0; i < 64; i++) { expect(d[i * 4 + 3]).toBe(77); expect(d[i * 4]).toBeLessThan(214); }
    });
  });
});
