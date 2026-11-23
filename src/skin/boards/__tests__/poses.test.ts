import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { animalModel } from '../../voxel/animals';
import type { Species } from '../../voxel/animals/rig';
import { CRATE, CRATE_HEIGHTS } from '../island';
import { CHAMPION, GOOD_SPORT, inCrate, mayOverhang, NAP, placement, POSES, rigOf, sample, STAGGER } from '../poses';
import type { Place } from '../poses';
import { podiumVoxels } from '../podium';

// docs/leaderboards/LEADERBOARDS-PLAN-V3.md, sections 3 and 5.2 (Brian, 2026-11-22): the three poses, for every species.
const SPECIES: Species[] = ['sheep', 'pig', 'cow', 'goat', 'horse', 'chicken'];
/** Each loop's keyframes and the moments its waves peak or touch (3.3 to 3.5). */
const TIMES: Record<Place, number[]> = {
  1: [0, 0.16, 0.4, 0.62, 0.7, 0.86, 0.9225, 1.0475, 1.1725, 1.2975, 1.36, 1.88, 2.39],
  2: [0, 0.075, 0.15, 0.225, 0.3, 0.375, 0.45, 0.6, 0.975, 1.35, 1.725, 2.1, 2.475, 2.99],
  3: [0, 0.8, 1.6, 1.65, 1.7, 2.4, 3.19],
};
/** The number's sign on the second podium's front, from its top, and its lanterns (podium.ts). */
const NUMERAL = podiumVoxels(2, CRATE_HEIGHTS[1]).numeral, LANTERNS = podiumVoxels(2, CRATE_HEIGHTS[1]).lanterns;

/** Every part's points in crate-local metres (x across, y up from the top, z to the camera) at `t` seconds into the loop. */
function pose(species: Species, place: Place, t: number, loop = 0) {
  const m = animalModel(species), def = POSES[place], pl = placement(species, place);
  const p = sample(def, t, loop);
  const pts = inCrate(m, def, rigOf(m, def, p, pl.fit), pl.k, pl.at);
  // The stage's own group: the hop, then squash and pulse about the point the weight bears on (BoardStage, Lounger).
  const pivot = new Vector3(...pl.pivot), sx = p.pulse / Math.sqrt(p.squash), sy = p.pulse * p.squash;
  for (const list of pts.values()) for (const v of list) {
    v.sub(pivot).multiply(new Vector3(sx, sy, sx)).add(pivot);
    v.y += p.lift * pl.H;
  }
  return { pts, pl, p };
}
const lowest = (pts: Vector3[]) => Math.min(...pts.map((v) => v.y));

describe('the leaderboards\' poses (version 3)', () => {
  it('are this stage\'s own, named as the plan names them, with its loop lengths and staggered starts', () => {
    expect([CHAMPION.name, GOOD_SPORT.name, NAP.name]).toEqual(['lbChampion', 'lbGoodSport', 'lbNap']);
    expect([CHAMPION.loop, GOOD_SPORT.loop, NAP.loop]).toEqual([2.4, 3, 3.2]);
    expect(STAGGER).toEqual({ 1: 0, 2: 0.8, 3: 1.6 });
    expect([CHAMPION.turn, GOOD_SPORT.turn, NAP.turn]).toEqual([0, 10, -25]);
    expect(NAP.lids).toBe('closed');
  });

  it('draws a species at one size in all three places (Brian, 2026-11-22: "the sizes ... are too mismatched")', () => {
    for (const species of SPECIES) {
      const [a, b, c] = ([1, 2, 3] as const).map((p) => placement(species, p));
      expect(b.k).toBeCloseTo(a.k, 9);
      expect(c.k).toBeCloseTo(a.k, 9);
    }
  });

  it('the champion raises both front legs in a V, the trophy floating over its head', () => {
    expect(CHAMPION.rest.frontL).toBeGreaterThan(165);
    expect(CHAMPION.rest.frontIn).toBeLessThan(-30);
    expect(CHAMPION.rest.frontL).toBe(CHAMPION.rest.frontR);
  });

  it('each loop starts and ends at its rest pose, so a loop runs on without a jump', () => {
    for (const place of [1, 2, 3] as const) {
      const def = POSES[place], a = sample(def, 0), b = sample(def, def.loop - 1e-6);
      for (const k of Object.keys(a) as (keyof typeof a)[]) expect(b[k], `${def.name} ${k}`).toBeCloseTo(a[k], 2);
    }
  });

  it('the champion hops: crouch 0.94, 0.2 H up at 0.4 s with the trophy 0.04 H higher, lands at 0.93, rests', () => {
    expect(sample(CHAMPION, 0.16).squash).toBeCloseTo(0.94, 3);
    const top = sample(CHAMPION, 0.4);
    expect([top.lift, top.squash, top.trophyLift]).toEqual([0.2, 1.04, 0.04]);
    expect(sample(CHAMPION, 0.62).lift).toBeCloseTo(0, 6);
    expect(sample(CHAMPION, 0.7).squash).toBeCloseTo(0.93, 3);
    expect(Math.abs(sample(CHAMPION, 0.9225).trophyRoll)).toBeCloseTo(8, 0);
  });

  it('the good sport\'s front hooves touch at 0.15 and 0.45 s, with a pulse and a nod; its hind legs swing opposite', () => {
    for (const t of [0.15, 0.45]) {
      const p = sample(GOOD_SPORT, t);
      expect(p.frontIn).toBeCloseTo(GOOD_SPORT.rest.frontIn, 1);
      expect(p.pulse).toBeCloseTo(1.02, 3);
      expect(p.headTip).toBeCloseTo(GOOD_SPORT.rest.headTip + 4, 1);
    }
    expect(sample(GOOD_SPORT, 0.3).frontIn).toBeCloseTo(GOOD_SPORT.rest.frontIn - 22, 0);
    const q = sample(GOOD_SPORT, 0.375);
    expect(q.hindL - 40).toBeCloseTo(-(q.hindR - 40), 6);
    expect(Math.abs(q.hindL - 40)).toBeCloseTo(12, 0);
  });

  it('the nap breathes 3.5% and its ear twitches only every third loop, at 1.6 s', () => {
    expect(sample(NAP, 1.6).squash).toBeCloseTo(1.035, 3);
    expect(sample(NAP, 1.7, 0).ears).toBeCloseTo(NAP.rest.ears + 15, 1);
    expect(sample(NAP, 1.7, 1).ears).toBeCloseTo(NAP.rest.ears, 6);
  });

  for (const species of SPECIES) {
    for (const place of [1, 2, 3] as const) {
      const def = POSES[place];
      describe(`${species} in ${place === 1 ? 'first' : place === 2 ? 'second' : 'third'} (${def.name})`, () => {
        it('bears its weight on the top: 0 +- 0.01 m at rest and on landing', () => {
          for (const t of place === 1 ? [0, 0.62, 0.7] : [0]) {
            const { pts } = pose(species, place, t);
            const bearing = place === 1
              ? (species === 'chicken' ? ['leg0', 'leg1'] : ['leg2', 'leg3']).flatMap((r) => pts.get(r as never)!)
              : pts.get('body')!;
            expect(Math.abs(lowest(bearing)), `t ${t}`).toBeLessThanOrEqual(0.01);
            // Nothing below the top but what may hang over its edges, and the tail: the pig's, the goat's and the horse's hang
            // lower than the rump or the belly, so sitting or lying the tip rests inside the top, behind the body.
            const rest = [...pts].filter(([role]) => !mayOverhang(place, role, species) && role !== 'tail').flatMap(([, list]) => list);
            expect(lowest(rest), `t ${t}`).toBeGreaterThanOrEqual(-0.01);
          }
        });

        it('passes none of the top\'s edges, at every keyframe, but with the parts 3.1 allows', () => {
          const margin = place === 3 ? 0.03 * CRATE.w : 0;
          for (const t of TIMES[place]) {
            const { pts } = pose(species, place, t);
            for (const [role, list] of pts) {
              if (mayOverhang(place, role, species)) continue;
              for (const v of list) {
                expect(Math.abs(v.x), `${role} x at ${t}`).toBeLessThanOrEqual(CRATE.w / 2 - margin + 0.005);
                expect(Math.abs(v.z), `${role} z at ${t}`).toBeLessThanOrEqual(CRATE.d / 2 - margin + 0.005);
              }
            }
          }
        });

        it('keeps out of its name plate, which hangs at the crate\'s foot', () => {
          for (const t of TIMES[place]) {
            const all = [...pose(species, place, t).pts.values()].flat();
            expect(lowest(all)).toBeGreaterThan(-(CRATE_HEIGHTS[place - 1] - 0.8));
          }
        });

        if (place === 2) it('swings its hind legs clear of the front face and above the carved number', () => {
          for (const t of TIMES[2]) {
            const { pts } = pose(species, 2, t);
            for (const role of species === 'chicken' ? ['leg0', 'leg1'] : ['leg2', 'leg3']) for (const v of pts.get(role as never)!) {
              if (v.y < -0.003) expect(v.z, `${role} at ${t}`).toBeGreaterThanOrEqual(CRATE.d / 2 + 0.01);
              if (Math.abs(v.x) < NUMERAL.half && v.z < CRATE.d / 2 + 0.12) expect(v.y, `${role} at ${t}`).toBeGreaterThan(NUMERAL.top + 0.03 * CRATE.w);
              // Clear of the podium's two lanterns (their boxes are from the podium's foot; the legs' from its top).
              for (const l of LANTERNS) {
                const inside = v.x > l.x[0] && v.x < l.x[1] && v.y + CRATE_HEIGHTS[1] > l.y[0] && v.y + CRATE_HEIGHTS[1] < l.y[1] && v.z > l.z[0] && v.z < l.z[1];
                expect(inside, `${role} at ${t} in a lantern`).toBe(false);
              }
            }
          }
        });

        if (place === 1) it('holds the trophy over its head, 0.06 H above the top of its hat', () => {
          const { pts, pl } = pose(species, 1, 0);
          const head = pts.get('head')!, hat = pts.get('hat') ?? [];
          const top = Math.max(...[...head, ...hat].map((v) => v.y));
          expect(pl.trophy[1] - top).toBeCloseTo(0.06 * pl.H, 3);
          const mid = (Math.min(...head.map((v) => v.x)) + Math.max(...head.map((v) => v.x))) / 2;
          expect(pl.trophy[0]).toBeCloseTo(mid, 2);
        });

        if (place === 3) it('lies with its face in view: its head never below the top, its eyes shut', () => {
          const { pts } = pose(species, 3, 0);
          expect(lowest(pts.get('head')!)).toBeGreaterThanOrEqual(-0.01);
          expect(rigOf(animalModel(species), NAP, sample(NAP, 0)).lids).toBe('closed');
        });
      });
    }
  }
});
