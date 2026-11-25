import { describe, expect, it } from 'vitest';
import { harmonize, LADDER, oklch, shade, shadeHex, shadeRaw, solid } from '../paint';
import type { Mat } from '../paint';

// docs/miniature/03, section 1: the ladders are whole, they climb, the ladder arithmetic gives the table back, and no
// colour is pure black or pure white (rule R9).
const light = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const mats = Object.keys(LADDER) as Mat[];

describe('the paint ladders', () => {
  it('have 27 materials of five valid colours each, none pure black or pure white', () => {
    expect(mats).toHaveLength(27); // 26, and fir (the depth plan's 8.4) for Counting Sheep's wreath (docs/dream/v3)
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
    // brass +2 is past what a screen shows, and the plan's table keeps its own (docs/depth section 3.2).
    for (const m of mats.filter((x) => x !== 'snow')) for (const k of [-2, -1, 0, 1, 2]) if (!(m === 'brass' && k === 2)) expect(near(shadeHex(LADDER[m][2], k), LADDER[m][k + 2]), `${m} ${k}: ${shadeHex(LADDER[m][2], k)} against ${LADDER[m][k + 2]}`).toBe(true);
  });
  it('give the same array for the same arguments, clamp the step, and agree with shade()', () => {
    expect(solid('barnRed', 1)).toBe(solid('barnRed', 1));
    expect(solid('wood', 5)).toBe(solid('wood', 2));
    expect(solid('wood', -9)).toBe(solid('wood', -2));
    expect(shadeRaw('#B75946', 0)).toEqual(solid('barnRed', 0));
    for (let i = 0; i < 3; i++) expect(shadeRaw('#B75946', 1)[i]).toBeCloseTo(solid('barnRed', 1)[i], 1);
  });
});

// docs/depth/DEPTH-PLAN.md, section 3.6: the palette's rules on every colour, and the neighbours that touch.
const LARGE: Mat[] = ['snow', 'barnRed', 'trimWhite', 'slate', 'wood', 'darkWood', 'roofBrown', 'stone', 'pine', 'houseCream', 'wool', 'ice'];
const MEDIUM: Mat[] = ['hay', 'straw', 'coopYellow', 'tractorRed', 'giftGreen', 'reed', 'glass', 'iron', 'fir'];
const ACCENT: Mat[] = ['scarfRed', 'carrot', 'brass', 'pink', 'faceDark', 'ink'];
const L = (m: Mat, k: number) => oklch(LADDER[m][k + 2])[0];
// R4 by area; R5 lets the reds (hue 25 to 35) reach 0.13 and holds the greens (150 to 175) to 0.085.
const cap = (m: Mat) => {
  const [, , h] = oklch(LADDER[m][2]);
  if (h >= 150 && h <= 175) return 0.085;
  if (h >= 25 && h <= 35 && !ACCENT.includes(m)) return 0.13;
  return LARGE.includes(m) ? 0.1 : MEDIUM.includes(m) ? 0.12 : 0.14;
};

describe('the palette (depth plan P)', () => {
  it('sorts every material into one size class', () => {
    expect([...LARGE, ...MEDIUM, ...ACCENT].sort()).toEqual([...mats].sort());
  });
  it('R3: no pure white or black: step 0 lives in 0.28 to 0.95, every step in 0.26 to 0.95', () => {
    for (const m of mats) {
      expect(L(m, 0), m).toBeGreaterThanOrEqual(0.28);
      for (const k of [-2, -1, 0, 1, 2]) { expect(L(m, k), `${m} ${k}`).toBeGreaterThanOrEqual(0.255); expect(L(m, k), `${m} ${k}`).toBeLessThanOrEqual(0.952); }
    }
  });
  it('R4 and R5: colour strength under its class at step 0, and the darker steps no more than 8% richer', () => {
    for (const m of mats) for (const k of [-2, -1, 0, 1, 2]) expect(oklch(LADDER[m][k + 2])[1], `${m} ${k}`).toBeLessThanOrEqual(cap(m) * (k < 0 ? 1.09 : 1.005));
  });
  it('R6: no dead greys: every near-grey is warm', () => {
    for (const m of mats) {
      const [, C, h] = oklch(LADDER[m][2]);
      if (C < 0.025) { expect(C, m).toBeGreaterThanOrEqual(0.011); expect(h, m).toBeGreaterThanOrEqual(15); expect(h, m).toBeLessThanOrEqual(85); }
    }
  });
  it('keeps big neighbours within 0.40, stripes within 0.36 and the window glass within 0.47', () => {
    const gap = (a: Mat, ka: number, b: Mat, kb: number) => Math.abs(L(a, ka) - L(b, kb));
    expect(gap('snow', 1, 'slate', 0)).toBeLessThanOrEqual(0.4);
    expect(gap('trimWhite', 0, 'barnRed', 0)).toBeLessThanOrEqual(0.4);
    expect(gap('snow', 1, 'wood', 1)).toBeLessThanOrEqual(0.4);
    expect(gap('snow', -1, 'pine', 0)).toBeLessThanOrEqual(0.36);
    expect(gap('trimWhite', 1, 'scarfRed', 0)).toBeLessThanOrEqual(0.36);
    expect(gap('trimWhite', 0, 'glass', 0)).toBeLessThanOrEqual(0.47);
  });
  it("harmonize() brings a sheet's loud colours into the palette and leaves its places alone", () => {
    const [Lb, Cb] = oklch(harmonize('#F2D21B')); // the hens' beak
    expect(Cb).toBeLessThanOrEqual(0.131); expect(Lb).toBeLessThanOrEqual(0.93);
    expect(oklch(harmonize('#141212'))[0]).toBeGreaterThanOrEqual(0.279); // eye black: a deep warm brown
    const [, Cg, hg] = oklch(harmonize('#3FBF5F')); // a pure green leans teal
    expect(Cg).toBeLessThanOrEqual(0.086); expect(hg).toBeGreaterThan(155);
    const [, Cs, hs] = oklch(harmonize('#808080')); // a dead grey takes warmth
    expect(Cs).toBeGreaterThanOrEqual(0.011); expect(Math.abs(hs - 55)).toBeLessThan(3);
    expect(shade('#141212')).not.toEqual(shadeRaw('#141212'));
  });
});
