import { describe, expect, it } from 'vitest';
import { CLOUD, cloudGeometry, cloudRing } from '../clouds';
import { POV_SHOTS } from '../homePov';

// docs/depth/DEPTH-PLAN.md, section 9.3: fourteen to twenty clouds, one draw call under 20,000 triangles, and every
// Home shot that holds sky shows three to five of them, wherever the slow turn has carried the ring.
const deg = (r: number) => (r * 180) / Math.PI;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("Home's clouds", () => {
  it('stay inside the triangle budget', () => {
    expect(cloudGeometry().index!.count / 3).toBeLessThanOrEqual(20000);
  });
  it('show three to five in every shot that holds sky, at every turn of the ring', () => {
    const clouds = cloudRing();
    expect(clouds.length).toBe(CLOUD.count);
    // Shots whose frame reaches above 10 degrees and is not the wendigo's paddock (index 2, which has no clouds).
    const skyShots = POV_SHOTS.desktop.map((s, i) => {
      const [px, py, pz] = s.position, [tx, ty, tz] = s.target, run = Math.hypot(tx - px, tz - pz);
      const pitch = deg(Math.atan2(ty - py, run)), half = deg(Math.atan(Math.tan((s.fov / 2) * Math.PI / 180) * 1.6)) * Math.PI / 180;
      return { i, yaw: Math.atan2(tz - pz, tx - px), half, top: pitch + s.fov / 2 };
    }).filter((s) => s.i !== 2 && s.top > 10);
    expect(skyShots.map((s) => s.i)).toEqual(expect.arrayContaining([5, 6, 7]));
    for (const s of skyShots) {
      // The open-sky shots (the farmhouse and the pond) hold every cloud whole under the top of the frame.
      if (s.i === 5 || s.i === 7) for (const c of clouds) expect(c.elevation + deg(Math.atan((c.H * 1.1) / CLOUD.ring)), `shot ${s.i}`).toBeLessThanOrEqual(s.top);
      for (let k = 0; k < 120; k++) {
        const turn = (k / 120) * Math.PI * 2;
        const seen = clouds.filter((c) => Math.abs(wrap(c.az - turn - s.yaw)) < s.half + (c.L * 0.3) / CLOUD.ring).length;
        expect(seen, `shot ${s.i} at a turn of ${deg(turn).toFixed(0)} degrees`).toBeGreaterThanOrEqual(3);
        expect(seen, `shot ${s.i} at a turn of ${deg(turn).toFixed(0)} degrees`).toBeLessThanOrEqual(5);
      }
    }
  });
});
