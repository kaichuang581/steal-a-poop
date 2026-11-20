import { ACESFilmicToneMapping } from 'three';
import { describe, expect, it } from 'vitest';
import { POV_SHOTS } from '../../scene/homePov';
import { PADDOCK_SHOT } from '../../voxel/unseen';
import { farEdge, HAZE_FIT, LIGHT_BOUNDS, SHADOW_FIT, DAYLIGHT, shotLight } from '../Rendering';

// docs/miniature/02: the haze and the sun's shadow box are fitted to each Home shot by day and at dawn; dusk, night and
// the wendigo's paddock shot are what they were; exposure stays 1 everywhere (T0-inventory.md, section 3).
const DOORWAY = { position: [-12.5, 7, 23], target: [0.6, 1.6, 4.5], fov: 26 };

describe("a Home shot's light", () => {
  it("fits the haze to the farm rectangle's far edge: the plan's doorway figures (66 m, 0.0076)", () => {
    expect(farEdge(DOORWAY, 1.6)).toBeCloseTo(66, 0);
    expect(shotLight(DOORWAY, 'day').haze).toBeCloseTo(0.0076, 4);
  });

  it('keeps every fitted haze and shadow box inside its range, on every shot', () => {
    for (const shot of [...POV_SHOTS.desktop, ...POV_SHOTS.phone]) for (const low of [false, true]) {
      const l = shotLight(shot, 'day', { low, aspect: 1.6 });
      expect(l.haze).toBeGreaterThanOrEqual(HAZE_FIT.min);
      expect(l.haze).toBeLessThanOrEqual(HAZE_FIT.max);
      expect(l.half).toBeGreaterThanOrEqual(SHADOW_FIT.min);
      expect(l.half).toBeLessThanOrEqual(low ? SHADOW_FIT.maxLow : SHADOW_FIT.max);
      expect(l.centre).toEqual([shot.target[0], shot.target[2]]);
    }
    expect(shotLight(DOORWAY, 'day').half).toBeCloseTo(23, 0);
  });

  it("hands the wendigo's paddock shot the light it always had, at every hour", () => {
    for (const hour of ['dawn', 'day', 'dusk', 'night'] as const) {
      const l = shotLight(POV_SHOTS.desktop[PADDOCK_SHOT], hour, { paddock: true });
      expect(l).toMatchObject({ haze: 0.012, half: 20, centre: [0, 0], exposure: 1, toneMapping: ACESFilmicToneMapping, sunElevationDeg: LIGHT_BOUNDS.sunElevationDeg, sunAzimuthOffsetDeg: LIGHT_BOUNDS.sunAzimuthOffsetDeg });
    }
  });

  it('leaves dusk and night unfitted, and exposure at 1 at every hour', () => {
    for (const hour of ['dusk', 'night'] as const) expect(shotLight(DOORWAY, hour)).toMatchObject({ haze: 0.006, half: 20, centre: [0, 0] });
    for (const hour of ['dawn', 'day', 'dusk', 'night'] as const) expect(DAYLIGHT[hour].exposure).toBe(LIGHT_BOUNDS.exposure);
  });
});
