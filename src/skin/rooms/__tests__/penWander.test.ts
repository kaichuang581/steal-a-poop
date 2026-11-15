import { describe, expect, it } from 'vitest';
import { PEN, PEN_WALK } from '../../scene/pen';
import { rng } from '../../voxel/primitives';
import { arrive, roam } from '../penWander';
import type { Roamer } from '../penWander';

/** Six animals let loose for `seconds`, stepped at 30 frames a second; calls `each` after every step. */
function run(seconds: number, each: (flock: Roamer[], now: number) => void) {
  const rand = rng(11);
  const flock = Array.from({ length: 6 }, (_, i) => arrive(i, 0, rand));
  for (let f = 1; f <= seconds * 30; f++) {
    const now = f / 30;
    for (const r of flock) roam(r, 1 / 30, now, flock, rand);
    each(flock, now);
  }
  return flock;
}

describe("the pen's wandering animals", () => {
  it('never leave the pen, and never walk through the rack or the trough', () => {
    run(180, (flock) => {
      for (const r of flock) {
        expect(Math.abs(r.x)).toBeLessThanOrEqual(PEN_WALK.x + 1e-6);
        expect(r.z).toBeGreaterThanOrEqual(PEN_WALK.z0 - 1e-6);
        expect(r.z).toBeLessThanOrEqual(PEN_WALK.z1 + 1e-6);
      }
    });
    expect(PEN_WALK.x).toBeLessThan(PEN.halfX);
    expect(PEN_WALK.z1).toBeLessThan(PEN.rack[2] - 0.6);
  });

  it('all of them walk, stand and graze in three minutes, and each covers real ground', () => {
    const seen = new Map<Roamer, Set<string>>();
    const walked = new Map<Roamer, number>();
    const last = new Map<Roamer, [number, number]>();
    const flock = run(180, (animals) => {
      for (const r of animals) {
        (seen.get(r) ?? seen.set(r, new Set()).get(r)!).add(r.mode);
        const was = last.get(r) ?? [r.x, r.z];
        walked.set(r, (walked.get(r) ?? 0) + Math.hypot(r.x - was[0], r.z - was[1]));
        last.set(r, [r.x, r.z]);
      }
    });
    for (const r of flock) {
      expect([...seen.get(r)!].sort()).toEqual(['graze', 'idle', 'walk']);
      expect(walked.get(r)!).toBeGreaterThan(12);
    }
  });

  it('graze with their muzzles on a tuft of grass, one animal to a tuft', () => {
    let grazes = 0;
    run(240, (flock) => {
      const at = new Set<number>();
      for (const r of flock) {
        if (r.mode !== 'graze') continue;
        grazes++;
        expect(r.tuft).not.toBeNull();
        expect(at.has(r.tuft!)).toBe(false);
        at.add(r.tuft!);
        // The head is about 0.6 m in front of the feet: that point lies on the tuft.
        const [gx, gz] = PEN.grass[r.tuft!];
        expect(Math.hypot(r.x + Math.sin(r.yaw) * 0.62 - gx, r.z + Math.cos(r.yaw) * 0.62 - gz)).toBeLessThan(0.75);
      }
    });
    expect(grazes).toBeGreaterThan(300);
  });

  it('do not stand on top of each other', () => {
    let crowded = 0, frames = 0;
    run(180, (flock) => {
      frames++;
      for (let i = 0; i < flock.length; i++) for (let j = i + 1; j < flock.length; j++) if (Math.hypot(flock[i].x - flock[j].x, flock[i].z - flock[j].z) < 0.45) crowded++;
    });
    expect(crowded / frames).toBeLessThan(0.02);
  });
});
