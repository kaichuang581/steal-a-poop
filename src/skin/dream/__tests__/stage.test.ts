import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { FIELD, JUMP_HEIGHT } from '../../../dream/dream';
import { YARD } from '../../scene/layout';
import { triangles } from '../../voxel/mesher';
import {
  CLOUD_SHEEP, CLOUDS, cloudBlob, cloudSheep, dreamLantern, dreamMoon, dreamShot, FARM_BASE, fenceCentreX, fenceWorldX, FILLER_BASES, FILLER_HALF,
  fillerChunk, fillerClouds, ISLANDS, LANE_Z, MOON, PX, ringX, scrollOf, SIDE_SHOT, skyIsland, sleepZ, STRIP, WRAP,
} from '../stage';

function screenX(shot: ReturnType<typeof dreamShot>, aspect: number, p: [number, number, number]) {
  const cam = new PerspectiveCamera(shot.fov, aspect, 0.1, 900);
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateMatrixWorld();
  return new Vector3(...p).project(cam);
}

describe('the dream stage', () => {
  it('lays the logical field over the farm: the sheep is a metre, a fence 0.8 m, the jump clears it', () => {
    expect(FIELD.sheepW * PX).toBeCloseTo(1);
    expect(FIELD.fenceH * PX).toBeCloseTo(0.8);
    expect(JUMP_HEIGHT * PX).toBeGreaterThan(FIELD.fenceH * PX);
  });

  it('fences come from screen right (-x) toward the sheep at x = 0, and the world rolls the other way', () => {
    expect(fenceWorldX(FIELD.sheepX)).toBeCloseTo(0);
    expect(fenceWorldX(FIELD.sheepX + 100)).toBeCloseTo(-5);
    expect(fenceCentreX(FIELD.sheepX + 100)).toBeCloseTo(-5 - (FIELD.fenceW * PX) / 2);
    expect(scrollOf(0)).toBe(0);
    expect(scrollOf(100)).toBeCloseTo(5);
    expect(scrollOf((WRAP / PX) * 3 + 20)).toBeCloseTo(1);
  });

  it('every piece of the ring stays within half a wrap of the sheep, and the farm and the fillers do not overlap', () => {
    for (let dist = 0; dist < (WRAP / PX) * 2; dist += 37) {
      const s = scrollOf(dist);
      const farm = ringX(FARM_BASE, s);
      expect(Math.abs(farm)).toBeLessThanOrEqual(WRAP / 2);
      for (const b of FILLER_BASES) {
        const f = ringX(b, s);
        expect(Math.abs(f)).toBeLessThanOrEqual(WRAP / 2);
        // The farm's yard spans 40 m either side of its origin; a filler 16 m either side of its base.
        const gap = Math.min(Math.abs(f - farm), WRAP - Math.abs(f - farm));
        expect(gap).toBeGreaterThanOrEqual(40 + FILLER_HALF - 1e-9);
      }
    }
  });

  it('frames the sheep a quarter of the way in from the left on any desktop aspect, with the lane in view', () => {
    for (const aspect of [1, 4 / 3, 16 / 9, 21 / 9]) {
      const shot = dreamShot(false, aspect);
      const sheep = screenX(shot, aspect, [0, 0.5, LANE_Z]);
      expect(sheep.x).toBeGreaterThan(-0.7);
      expect(sheep.x).toBeLessThan(-0.3);
      expect(Math.abs(sheep.y)).toBeLessThan(0.9);
      // A fence FIELD.fenceW px wide a few metres ahead is on screen too.
      const ahead = screenX(shot, aspect, [-3, 0.4, LANE_Z]);
      expect(Math.abs(ahead.x)).toBeLessThan(1);
      expect(shot.fov).toBe(SIDE_SHOT.fov);
    }
  });

  it('on a phone the camera looks down the lane from behind the sheep, so the fences ahead are in frame', () => {
    const aspect = 390 / 844;
    const shot = dreamShot(true, aspect);
    const sheep = screenX(shot, aspect, [0, 0.5, LANE_Z]);
    const far = screenX(shot, aspect, [-12, 0.4, LANE_Z]);
    expect(Math.abs(sheep.x)).toBeLessThan(1);
    expect(Math.abs(sheep.y)).toBeLessThan(1);
    expect(Math.abs(far.x)).toBeLessThan(1);
    expect(Math.abs(far.y)).toBeLessThan(1);
  });
});

describe('the dream: everything afloat', () => {
  it('keeps the far scenery beyond the yard, so nothing floats across the lane', () => {
    for (const it of [...ISLANDS, ...CLOUDS, ...CLOUD_SHEEP]) expect(it.z).toBeGreaterThan(YARD.maxZ + 20);
  });
  it('builds the dream pieces as real voxel geometry', () => {
    for (const geo of [skyIsland(1), cloudBlob(11), cloudSheep(1), dreamLantern(), sleepZ(), dreamMoon(), fillerClouds(1)]) expect(triangles(geo)).toBeGreaterThan(10);
  });
  it('lets the filler between farms carry only the lane strip (no ground beyond its edge)', () => {
    const land = fillerChunk(1);
    const pos = land.getAttribute('position');
    let groundBeyond = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > STRIP.maxZ + 4 && Math.abs(pos.getY(i)) < 0.05) groundBeyond++;
    expect(groundBeyond).toBe(0);
  });
  it('keeps the moon in frame on a wide screen', () => {
    const shot = dreamShot(false, 16 / 9);
    const dx = MOON.position[0] - shot.position[0], dz = MOON.position[2] - shot.position[2];
    const yaw = Math.atan2(dx, dz) - Math.atan2(shot.target[0] - shot.position[0], shot.target[2] - shot.position[2]);
    const halfH = Math.atan(Math.tan((shot.fov / 2) * Math.PI / 180) * (16 / 9));
    expect(Math.abs(yaw)).toBeLessThan(halfH);
  });
});
