import { describe, expect, it } from 'vitest';
import { LADDER, shade, shadeHex, solid } from '../paint';
import type { Mat } from '../paint';

// docs/miniature/03, section 1: the ladders are whole, they climb, the ladder arithmetic gives the table back, and no
// colour is pure black or pure white (rule R9).
const light = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mats = Object.keys(LADDER) as Mat[];

describe('the paint ladders', () => {
  it('have 25 materials of five valid colours each, none pure black or pure white', () => {
    expect(mats).toHaveLength(25);
    for (const m of mats) {
      expect(LADDER[m]).toHaveLength(5);
      for (const hex of LADDER[m]) { expect(hex).toMatch(/^#[0-9A-F]{6}$/); expect(['#000000', '#FFFFFF']).not.toContain(hex); }
    }
  });
  it('never get darker from step -2 to step +2', () => {
    for (const m of mats) for (let i = 1; i < 5; i++) expect(light(LADDER[m][i]), `${m} step ${i - 2}`).toBeGreaterThanOrEqual(light(LADDER[m][i - 1]));
  });
  it('are what the ladder arithmetic makes of each step-0 colour, but for snow, whose steps are chosen by hand', () => {
    const near = (a: string, b: string) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);
    for (const m of mats.filter((x) => x !== 'snow')) for (const k of [-2, -1, 0, 1, 2]) expect(near(shadeHex(LADDER[m][2], k), LADDER[m][k + 2]), `${m} ${k}: ${shadeHex(LADDER[m][2], k)} against ${LADDER[m][k + 2]}`).toBe(true);
  });
  it('give the same array for the same arguments, clamp the step, and agree with shade()', () => {
    expect(solid('barnRed', 1)).toBe(solid('barnRed', 1));
    expect(solid('wood', 5)).toBe(solid('wood', 2));
    expect(solid('wood', -9)).toBe(solid('wood', -2));
    expect(shade('#B8473A', 0)).toEqual(solid('barnRed', 0));
    for (let i = 0; i < 3; i++) expect(shade('#B8473A', 1)[i]).toBeCloseTo(solid('barnRed', 1)[i], 2);
  });
});
