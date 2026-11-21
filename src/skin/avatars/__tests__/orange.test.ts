import { describe, expect, it } from 'vitest';
import { ORANGE, skinWeight, warmData, warmUp } from '../orange';

const SKIN: [number, number, number] = [214, 170, 140];
const BLUE: [number, number, number] = [100, 130, 200];
const SUIT: [number, number, number] = [30, 35, 55];
const SHIRT: [number, number, number] = [250, 250, 252];

describe("Juan's orange slider", () => {
  it('does nothing at 0', () => {
    expect(warmUp(...SKIN, 0)).toEqual(SKIN);
    const d = new Uint8ClampedArray([...SKIN, 255, ...BLUE, 255]);
    const before = [...d];
    warmData(d, 0);
    expect([...d]).toEqual(before);
  });

  it('turns skin more orange the further it goes: red up, green and blue down, in steps', () => {
    let prev = warmUp(...SKIN, 0);
    for (let a = ORANGE.step; a <= 1.0001; a += ORANGE.step) {
      const next = warmUp(...SKIN, a);
      expect(next[0]).toBeGreaterThanOrEqual(prev[0] - 1e-9);
      expect(next[1]).toBeLessThanOrEqual(prev[1] + 1e-9);
      expect(next[2]).toBeLessThanOrEqual(prev[2] + 1e-9);
      prev = next;
    }
    const full = warmUp(...SKIN, 1);
    expect(full[0]).toBeGreaterThan(SKIN[0]);
    expect(full[1]).toBeLessThan(SKIN[1] - 40);
    expect(full[2]).toBeLessThan(SKIN[2] / 2);
    expect(full[0]).toBeGreaterThan(full[1]); // red over green over blue: orange
    expect(full[1]).toBeGreaterThan(full[2]);
  });

  it('leaves the backdrop, the suit and the shirt alone', () => {
    for (const px of [BLUE, SUIT, SHIRT]) {
      expect(skinWeight(...px)).toBe(0);
      expect(warmUp(...px, 1)).toEqual(px);
    }
    expect(skinWeight(...SKIN)).toBeGreaterThan(0.9);
  });

  it('keeps every channel in range and leaves alpha alone', () => {
    const d = new Uint8ClampedArray([255, 220, 200, 77, 214, 170, 140, 255]);
    warmData(d, 1);
    expect(d[3]).toBe(77);
    expect(d[7]).toBe(255);
    for (const v of d) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255); }
  });
});
