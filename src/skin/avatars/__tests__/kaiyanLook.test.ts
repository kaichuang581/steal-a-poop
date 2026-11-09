import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DISC } from '../discPose';
import { DEFAULT_LOOK, GLARE, LENGTH, getKaiyanLook, pictureHeight, setKaiyanLook, sliceHeights } from '../kaiyanLook';

describe("Kaiyan's head", () => {
  // The tests run in node: give the settings a localStorage to keep things in.
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
    };
  });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('at length 1 is exactly the picture as it was', () => {
    expect(pictureHeight(1)).toBeCloseTo(DISC.radius * 2 * DISC.tall, 6);
  });

  it('stretches only the forehead band', () => {
    const a = sliceHeights(1), b = sliceHeights(3);
    expect(b.hair).toBe(a.hair);
    expect(b.face).toBe(a.face);
    expect(b.band).toBeCloseTo(a.band * 3, 6);
  });

  it('defaults past the old look: longer and brighter', () => {
    expect(getKaiyanLook()).toEqual(DEFAULT_LOOK);
    expect(DEFAULT_LOOK.length).toBeGreaterThan(1);
    expect(DEFAULT_LOOK.glare).toBeGreaterThan(1);
  });

  it('keeps what is set, within range, and resets', () => {
    setKaiyanLook({ length: 4.2 });
    expect(getKaiyanLook()).toEqual({ length: 4.2, glare: GLARE.def });
    setKaiyanLook({ glare: 99, length: -3 });
    expect(getKaiyanLook()).toEqual({ length: LENGTH.min, glare: GLARE.max });
    setKaiyanLook(null);
    expect(getKaiyanLook()).toEqual(DEFAULT_LOOK);
  });

  it('shrugs off a broken saved value', () => {
    localStorage.setItem('sap:kaiyan-look', '{nope');
    expect(getKaiyanLook()).toEqual(DEFAULT_LOOK);
    localStorage.setItem('sap:kaiyan-look', JSON.stringify({ length: 'long', glare: null }));
    expect(getKaiyanLook()).toEqual(DEFAULT_LOOK);
  });
});
