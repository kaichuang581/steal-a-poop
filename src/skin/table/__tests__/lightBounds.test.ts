import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PCFShadowMap } from 'three';
import { describe, expect, it } from 'vitest';
import { effectsPlan, LIGHT_BOUNDS, lanternIntensity, LANTERN_LIGHT, SUN, sunPlan, TODAY_SUN } from '../Rendering';

// Brian's light limits (plan file 02, change 1): "Keep the hemisphere fill low ... and exposure at 1" (2026-11-08,
// after "all the snow looks completely flat"), and the brighter nights of 2026-11-13 ("make the room a little brighter
// ngl i cant see a thing"). Nothing here may be loosened without a before-and-after he has seen.
describe('the light limits', () => {
  it('keeps the sky fill low, in its two colours', () => {
    expect(LIGHT_BOUNDS.fillSky).toBe('#AEBEDA');
    expect(LIGHT_BOUNDS.fillGround).toBe('#655F5C');
    expect(LIGHT_BOUNDS.fillDay).toBeLessThanOrEqual(0.58);
    expect(LIGHT_BOUNDS.fillNight).toBeLessThanOrEqual(0.62);
  });

  it('keeps the moon at 1.15 or more and the night lanterns at 1.5 times, reaching 19 m', () => {
    expect(LIGHT_BOUNDS.moon).toBeGreaterThanOrEqual(1.15);
    expect(SUN.night.intensity).toBe(LIGHT_BOUNDS.moon);
    expect(LIGHT_BOUNDS.nightLantern).toBe(1.5);
    expect(LIGHT_BOUNDS.nightReach).toBe(19);
    expect(lanternIntensity('night')).toBe(LANTERN_LIGHT.intensity * 1.5);
  });

  it('keeps the sun 20 degrees up and 35 degrees off the camera at every hour, with PCF shadows', () => {
    expect(LIGHT_BOUNDS.sunElevationDeg).toBe(20);
    expect(LIGHT_BOUNDS.sunAzimuthOffsetDeg).toBe(35);
    expect(LIGHT_BOUNDS.shadowType).toBe(PCFShadowMap);
  });

  it('draws every scene canvas at exposure 1 with PCF shadows', () => {
    expect(LIGHT_BOUNDS.exposure).toBe(1);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(join(__dirname, '..', '..'));
    let canvases = 0;
    for (const f of files) {
      // The doors keep their own light (2026-11-08), and their bake's stage is no scene canvas: only a picture maker.
      if (f.endsWith(join('loading', 'DoorsRender.tsx'))) continue;
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/toneMappingExposure:\s*([\d.]+)/g)) { canvases++; expect(Number(m[1]), f).toBe(LIGHT_BOUNDS.exposure); }
      expect(src, f).not.toMatch(/PCFSoftShadowMap|VSMShadowMap|BasicShadowMap/);
    }
    expect(canvases).toBeGreaterThan(3);
  });
});

/** CIEDE2000 between two sRGB hex colours. */
function deltaE2000(a: string, b: string): number {
  const lab = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
    const xyz = [
      (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047,
      c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722,
      (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883,
    ].map((v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116));
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  };
  const [L1, a1, b1] = lab(a), [L2, a2, b2] = lab(b);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (y: number, x: number) => { const v = Math.atan2(y, x) / rad; return v < 0 ? v + 360 : v; };
  const h1 = h(b1, a1p), h2 = h(b2, a2p);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = h2 - h1;
  if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2;
  if (C1p * C2p !== 0) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

// Plan file 02, change 2: the hours differ by key colour, not by strength, angle, fill or exposure.
describe('the hour grades', () => {
  it('reads the reference pair of the formula right', () => {
    expect(deltaE2000('#FFFFFF', '#FFFFFF')).toBe(0);
    expect(deltaE2000('#FF0000', '#00FF00')).toBeGreaterThan(80);
  });

  it('gives dawn and dusk their own key colours, at least 8 apart (they were the same)', () => {
    expect(SUN.dawn.color).toBe('#FFD6C4');
    expect(SUN.dusk.color).toBe('#FFC08A');
    expect(deltaE2000(TODAY_SUN.dawn, TODAY_SUN.dusk)).toBe(0);
    expect(deltaE2000(SUN.dawn.color, SUN.dusk.color)).toBeGreaterThanOrEqual(8);
  });

  it('changes colour only: the strengths are as they were', () => {
    expect(SUN.dawn.intensity).toBe(1.55);
    expect(SUN.dusk.intensity).toBe(1.7);
    expect(SUN.day).toEqual({ color: TODAY_SUN.day, intensity: 1.85 });
    expect(SUN.night).toEqual({ color: TODAY_SUN.night, intensity: 1.15 });
  });
});

// Plan file 02, changes 3 and 4.
describe('the effects by tier', () => {
  it('keeps today on High, a 2048 map and narrower bloom on Medium, 1024 once a shot and no bloom on Low', () => {
    expect(sunPlan('high', false, false, 'home')).toEqual({ size: 4096, redraw: 'clock' });
    expect(sunPlan('high', true, false, 'home')).toEqual({ size: 2048, redraw: 'clock' });
    expect(sunPlan('medium', false, false, 'home')).toEqual({ size: 2048, redraw: 'clock' });
    expect(sunPlan('low', false, false, 'home')).toEqual({ size: 1024, redraw: 'shot' });
    expect(effectsPlan('high', false)).toEqual({ bloomMaxW: 720, tiltShift: true });
    expect(effectsPlan('medium', false)).toEqual({ bloomMaxW: 480, tiltShift: true });
    expect(effectsPlan('low', false)).toEqual({ bloomMaxW: 0, tiltShift: false });
  });

  it('redraws the table every picture on every tier', () => {
    for (const t of ['low', 'medium', 'high'] as const) expect(sunPlan(t, false, false, 'table').redraw).toBe('frame');
  });

  it("draws the wendigo's shot as today on every tier", () => {
    for (const t of ['low', 'medium', 'high'] as const) {
      expect(sunPlan(t, false, true, 'home')).toEqual({ size: 4096, redraw: 'frame' });
      expect(sunPlan(t, true, true, 'home')).toEqual({ size: 2048, redraw: 'frame' });
      expect(effectsPlan(t, true)).toEqual({ bloomMaxW: 720, tiltShift: true });
    }
  });
});
