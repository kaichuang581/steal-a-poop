import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN5_AVATAR_ID, ADMIN6_AVATAR_ID, ADMIN_AVATAR_IDS, isAdminAvatar, isAvatarId } from '../../../avatars/ids';
import { SAVE_KEYS } from '../../../lib/savecode';
import { byId } from '../catalog';
import { EYES, FACES, JAW, RED, redData, redden, warpFace } from '../faceTweaks';
import type { FaceSpec } from '../faceTweaks';
import { defaultLookFor, getKaiyanLook, rangesFor, setKaiyanLook } from '../kaiyanLook';
import { photoUrlFor } from '../photos';

const W = 64, H = 64;
const SPEC: FaceSpec = { eyes: [[20, 12], [44, 12]], eyeR: 8, jaw: { cx: 32, from: 30, chin: 46, end: 56 } };

/** An image of one colour with a few chosen pixels set to white. */
function picture(white: [number, number][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) d.set([20, 20, 20, 255], i * 4);
  for (const [x, y] of white) d.set([255, 255, 255, 255], (y * W + x) * 4);
  return d;
}
const count = (d: Uint8ClampedArray, y: number) => { let n = 0; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] > 128) n++; return n; };

describe('the fifth and sixth admin avatars', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
  });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('are admin avatars the server accepts, never in the picker or a save code', () => {
    for (const id of [ADMIN5_AVATAR_ID, ADMIN6_AVATAR_ID]) {
      expect(ADMIN_AVATAR_IDS).toContain(id);
      expect(isAvatarId(id)).toBe(true);
      expect(isAdminAvatar(id)).toBe(true);
      expect(byId(id)).toBeUndefined();
      expect(SAVE_KEYS.find((k) => k.key === 'sap:avatar')!.valid(id)).toBeNull();
    }
  });

  it('each have their own 512 x 1339 picture, a face spec inside it, and the usual 6x ranges', () => {
    for (const id of [ADMIN5_AVATAR_ID, ADMIN6_AVATAR_ID]) {
      const file = new URL(`../../assets/${id}-forehead.png`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      const png = readFileSync(file);
      expect(png.readUInt32BE(16)).toBe(512);
      expect(png.readUInt32BE(20)).toBe(1339);
      const f = FACES[id];
      expect(f.eyes).toHaveLength(2);
      for (const [x, y] of f.eyes) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(512); expect(y).toBeGreaterThan(1041); expect(y).toBeLessThan(1339); }
      expect(f.jaw.from).toBeLessThan(f.jaw.chin);
      expect(f.jaw.chin).toBeLessThan(f.jaw.end);
      expect(f.jaw.end).toBeLessThan(1339);
      expect(rangesFor(id).length.max).toBe(6);
      expect(defaultLookFor(id)).toEqual({ length: 1.8, glare: 2 });
    }
    expect(photoUrlFor(ADMIN5_AVATAR_ID)).not.toBe(photoUrlFor(ADMIN6_AVATAR_ID));
  });

  it('keep their own six sliders apart, omitting each while it is 0', () => {
    setKaiyanLook({ length: 3, glare: 4, orange: 0.5, red: 0.25, eyes: -0.4, jaw: 0.7 }, ADMIN5_AVATAR_ID);
    expect(getKaiyanLook(ADMIN5_AVATAR_ID)).toEqual({ length: 3, glare: 4, orange: 0.5, red: 0.25, eyes: -0.4, jaw: 0.7 });
    expect(getKaiyanLook(ADMIN6_AVATAR_ID)).toEqual(defaultLookFor(ADMIN6_AVATAR_ID));
    expect(mem.has('sap:admin5-look')).toBe(true);
    setKaiyanLook({ red: 0, eyes: 0, jaw: 0, orange: 0 }, ADMIN5_AVATAR_ID);
    expect(JSON.parse(mem.get('sap:admin5-look')!)).toEqual({ length: 3, glare: 4 });
    setKaiyanLook({ eyes: 9, jaw: -9, red: 9 }, ADMIN6_AVATAR_ID);
    expect(getKaiyanLook(ADMIN6_AVATAR_ID)).toMatchObject({ eyes: EYES.max, jaw: JAW.min, red: RED.max });
    setKaiyanLook(null, ADMIN6_AVATAR_ID);
    expect(getKaiyanLook(ADMIN6_AVATAR_ID)).toEqual(defaultLookFor(ADMIN6_AVATAR_ID));
  });

  describe('the red', () => {
    const SKIN: [number, number, number] = [214, 170, 140];
    it('is nothing at 0, pushes skin redder the more it is, and leaves the backdrop, suit and shirt alone', () => {
      expect(redden(...SKIN, 0)).toEqual(SKIN);
      const half = redden(...SKIN, 0.5), full = redden(...SKIN, 1);
      expect(full[0]).toBeGreaterThan(half[0]);
      expect(full[1]).toBeLessThan(half[1]);
      expect(full[1]).toBeLessThan(SKIN[1] / 2);
      for (const px of [[100, 130, 200], [30, 35, 55], [250, 250, 252]] as [number, number, number][]) expect(redden(...px, 1)).toEqual(px);
    });
    it('keeps alpha and range over a row of pixels', () => {
      const d = new Uint8ClampedArray([255, 220, 200, 77, 214, 170, 140, 255]);
      redData(d, 1);
      expect(d[3]).toBe(77);
      expect(d[7]).toBe(255);
    });
  });

  describe('the eyes and the jaw', () => {
    it('are the photo when both are 0', () => {
      const src = picture([[20, 12], [21, 12], [32, 40]]);
      expect([...warpFace(src, W, H, SPEC, 0, 0)]).toEqual([...src]);
    });
    it('make an eye bigger (positive) or smaller (negative) about its centre and touch nothing far from it', () => {
      const ring: [number, number][] = [];
      for (let a = 0; a < 16; a++) ring.push([Math.round(20 + 3 * Math.cos(a / 16 * Math.PI * 2)), Math.round(12 + 3 * Math.sin(a / 16 * Math.PI * 2))]);
      const src = picture(ring);
      const spread = (d: Uint8ClampedArray) => { let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] > 128) m = Math.max(m, Math.hypot(x - 20, y - 12)); return m; };
      const big = warpFace(src, W, H, SPEC, 1, 0), small = warpFace(src, W, H, SPEC, -1, 0);
      expect(spread(big)).toBeGreaterThan(spread(src));
      expect(spread(small)).toBeLessThan(spread(src));
      for (const d of [big, small]) for (let x = 0; x < W; x++) expect(d[(60 * W + x) * 4]).toBe(20);
    });
    it('make the jaw fatter (positive) or more chiselled (negative) at the cheeks and chin, and leave the forehead alone', () => {
      const bar: [number, number][] = [];
      for (const y of [40, 20]) for (let x = 26; x <= 37; x++) bar.push([x, y]);
      const src = picture(bar);
      const fat = warpFace(src, W, H, SPEC, 0, 1), thin = warpFace(src, W, H, SPEC, 0, -1);
      expect(count(src, 40)).toBe(12);
      expect(count(fat, 40)).toBeGreaterThan(12);
      expect(count(thin, 40)).toBeLessThan(12);
      expect(count(fat, 20)).toBe(12); // above the cheeks: untouched
      expect(count(thin, 20)).toBe(12);
    });
    it('keep every channel in range', () => {
      const d = warpFace(picture([[10, 40], [50, 40]]), W, H, SPEC, 1, 1);
      for (const v of d) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255); }
    });
  });
});
