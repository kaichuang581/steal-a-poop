// ---------------------------------------------------------------------------------------------------------------------
// The fourteen shots (plan file 04, section 4.3; milestone 8): each has one subject in the frame's clear part, and
// nothing presses against the lens. Projection only, no WebGL.
// ---------------------------------------------------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { POV_SHOTS } from '../homePov';
import type { PovShot } from '../homePov';
import { BARN, YARD } from '../layout';
import { FARM, buildFarmstead } from '../farmstead';
import { WENDIGO_AT, groundAt } from '../countryside';
import { buildBarn } from '../barn';
import { buildYard } from '../yard';
import { buildFarmFestive, buildFestive } from '../festive';
import { HEN_Y, LIVESTOCK } from '../../table/Farmstead';
import { animalModel } from '../../voxel/animals';
import { anchorsOf } from '../../voxel/animals/anchors';
import type { Animal } from '../../avatars/catalog';
import type { BufferGeometry } from 'three';

type P3 = readonly [number, number, number];
interface Box3 { min: P3; max: P3 }

/**
 * The clear strip under the title on a phone, measured in the browser at 390 x 844 on 2026-11-17 (Home, a returning
 * player, ?pov=0, the dev server): the title block (tiles, tag line, the update plate and the word of the day) ends at
 * 246 px; the name plate stands under it, x 113 to 278 px, y 296 to 342 px; the menu's board (its snow) starts at
 * 353 px. What no interface covers is 246 to 296 px across the whole width (and 342 to 353 px beside the plate).
 */
const PHONE_STRIP = { top: 246 / 844, bottom: 296 / 844 };
/** Where the name plate and the menu stand on that screen, as shares of it (for the record, and for Brian's choice). */
const PHONE_UI = { plate: { x: [113 / 390, 278 / 390], y: [296 / 844, 342 / 844] }, menuTop: 353 / 844 } as const;
/** Computer frames: the menu covers the left, so subjects keep inside x 40 to 97% and y 15 to 92%. */
const COMPUTER_CLEAR = { x: [0.4, 0.97], y: [0.15, 0.92] } as const;
/** Paddock animals in shot 2: inside x 42 to 97% and y 30 to 92%, and none within 5% of the frame of the wendigo's box. */
const PADDOCK_CLEAR = { x: [0.42, 0.97], y: [0.3, 0.92], wendigo: 0.05 } as const;
/** The aspect ratios a computer frame is judged at (the gate's 1280 x 800 and a 16:9 screen), and the phone's. */
const COMPUTER_ASPECTS = [1280 / 800, 16 / 9];
const PHONE_ASPECT = 390 / 844;
/** The game's drift (`Drift` in table/FarmBackdrop.tsx): 0.25 m across and 0.12 m up and down. */
const DRIFT = [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.12], [0, -0.12], [0.18, 0.085], [-0.18, -0.085], [0.18, -0.085], [-0.18, 0.085]] as const;

/** Each animal's box at scale 1 (measured from animalModel's geometry: half its width, its back and front, its height). */
/** Each farm animal's box as its model measures it (bounds, in model metres), and the uniform scale it is drawn at. */
const ANIMAL_BOX = (animal: string) => {
  const m = animalModel(animal as Animal), { min, max } = anchorsOf(m).bounds;
  return { w: Math.max(-min[0], max[0]), z: [min[2], max[2]] as const, h: m.height, s: 1.5 * m.drawScale };
};
/** The eight corners of a farm animal as Farmstead stands it (1.5 times its drawScale, turned by its facing), with 0.15 m for the hat. */
function animalCorners([animal, x, z, facing]: (typeof LIVESTOCK)[number]): P3[] {
  const b = ANIMAL_BOX(animal), s = b.s, y0 = animal === 'chicken' ? HEN_Y : 0, c = Math.cos(facing), n = Math.sin(facing);
  const out: P3[] = [];
  for (const lx of [-b.w, b.w]) for (const lz of b.z) for (const ly of [0, b.h + 0.1]) out.push([x + (lx * c + lz * n) * s, y0 + ly * s, z + (-lx * n + lz * c) * s]);
  return out;
}
const corners = (b: Box3): P3[] => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c & 1 ? b.max[0] : b.min[0], c & 2 ? b.max[1] : b.min[1], c & 4 ? b.max[2] : b.min[2]] as const);
/** The hero: the sheep at scale 1.5, 1.2 m in front of the doors, turned to whichever camera (so a box that holds any turn). */
const HERO = corners({ min: [-0.84, 0, BARN.maxZ + 1.2 - 0.84], max: [0.84, 1.65, BARN.maxZ + 1.2 + 0.84] });
/** The barn's red: walls, roof and ridge. */
const BARN_RED = corners({ min: [BARN.minX - 0.2, 0, BARN.minZ - 0.45], max: [BARN.maxX + 0.2, 6.8, BARN.maxZ + 0.2] });
/** The farmhouse: its walls and its roof to the ridge (`farmhouse` in scene/yard.ts). */
const FARMHOUSE = corners({ min: [YARD.farmhouse.x - YARD.farmhouse.halfX, 0, YARD.farmhouse.z - YARD.farmhouse.halfZ], max: [YARD.farmhouse.x + YARD.farmhouse.halfX + YARD.farmhouse.porch, 6.4, YARD.farmhouse.z + YARD.farmhouse.halfZ] });
const HENS = LIVESTOCK.filter(([a, x, z]) => a === 'chicken' && x >= FARM.run.minX && x <= FARM.run.maxX && z >= FARM.run.minZ && z <= FARM.run.maxZ);
const inPaddock = ([, x, z]: (typeof LIVESTOCK)[number]) => x >= FARM.paddock.minX && x <= FARM.paddock.maxX && z >= FARM.paddock.minZ && z <= FARM.paddock.maxZ;
/** What the phone draws: the first three of LIVESTOCK (Farmstead.tsx). */
const PHONE_STOCK = LIVESTOCK.slice(0, 3);

/** One subject per shot, as its corners in metres. */
const SUBJECTS: { desktop: { name: string; corners: P3[] }[]; phone: { name: string; corners: P3[] }[] } = {
  desktop: [
    { name: 'the avatar in the doorway', corners: HERO },
    { name: "the barn's red", corners: BARN_RED },
    { name: 'the paddock animals (judged one by one)', corners: LIVESTOCK.filter(inPaddock).flatMap(animalCorners) },
    { name: 'the avatar, over its shoulder', corners: HERO },
    { name: 'the hens', corners: HENS.flatMap(animalCorners) },
    { name: 'the farmhouse', corners: FARMHOUSE },
    { name: 'the avatar, down the path', corners: HERO },
    { name: 'the barn, across the pond', corners: BARN_RED },
  ],
  phone: [
    { name: 'the avatar in the doorway', corners: HERO },
    { name: "the barn's red", corners: BARN_RED },
    { name: 'the paddock animals', corners: PHONE_STOCK.filter(inPaddock).flatMap(animalCorners) },
    { name: 'the avatar, through the barn', corners: HERO },
    { name: 'the hen', corners: PHONE_STOCK.filter(([a]) => a === 'chicken').flatMap(animalCorners) },
    { name: 'the avatar, down the path', corners: HERO },
  ],
};

/** three's camera in numbers: where a point lands, x and y as shares of the frame from its top left, or null behind the lens. */
function projector(position: P3, target: P3, fov: number, aspect: number) {
  const f = norm([target[0] - position[0], target[1] - position[1], target[2] - position[2]]);
  const r = norm([-f[2], 0, f[0]]), u: P3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan((fov * Math.PI) / 360);
  return (p: P3): [number, number] | null => {
    const d: P3 = [p[0] - position[0], p[1] - position[1], p[2] - position[2]];
    const z = dot(d, f);
    if (z < 0.1) return null;
    return [0.5 + dot(d, r) / z / (2 * t * aspect), 0.5 - dot(d, u) / z / (2 * t)];
  };
}
function norm(v: P3): P3 { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function dot(a: P3, b: P3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** Every place a shot's camera reaches: along its push in fifths, each with the drift's nine places. */
function places(shot: PovShot): P3[] {
  const out: P3[] = [];
  for (let k = 0; k <= 1.0001; k += 0.2) for (const [dx, dy] of DRIFT) out.push([shot.position[0] + shot.push[0] * k + dx, shot.position[1] + shot.push[1] * k + dy, shot.position[2] + shot.push[2] * k]);
  return out;
}
/** The subject's box in the frame at the worst of every place: [left, right, top, bottom] as shares, or null if behind. */
function frameBox(shot: PovShot, pts: readonly P3[], aspect: number): [number, number, number, number] | null {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const at of places(shot)) {
    const see = projector(at, shot.target, shot.fov, aspect);
    for (const p of pts) {
      const q = see(p);
      if (!q) return null;
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
  }
  return [x0, x1, y0, y1];
}
const pct = (b: [number, number, number, number] | null) => (b ? `x ${(b[0] * 100).toFixed(1)} to ${(b[1] * 100).toFixed(1)}%, y ${(b[2] * 100).toFixed(1)} to ${(b[3] * 100).toFixed(1)}%` : 'behind the lens');

describe('the fourteen shots: one subject in the clear part of the frame (plan file 04, section 4.3)', () => {
  it('has 8 computer shots and 6 phone shots, each with its subject', () => {
    expect(POV_SHOTS.desktop).toHaveLength(8);
    expect(POV_SHOTS.phone).toHaveLength(6);
    expect(HENS.length).toBeGreaterThan(0);
    for (const s of [...SUBJECTS.desktop, ...SUBJECTS.phone]) expect(s.corners.length, s.name).toBeGreaterThan(0);
  });

  it('keeps every computer subject inside x 40 to 97% and y 15 to 92% over its travel and drift', () => {
    const bad: string[] = [];
    POV_SHOTS.desktop.forEach((shot, i) => {
      if (i === 2) return; // the paddock: its animals are judged one by one below
      for (const aspect of COMPUTER_ASPECTS) {
        const b = frameBox(shot, SUBJECTS.desktop[i].corners, aspect);
        if (!b || b[0] < COMPUTER_CLEAR.x[0] || b[1] > COMPUTER_CLEAR.x[1] || b[2] < COMPUTER_CLEAR.y[0] || b[3] > COMPUTER_CLEAR.y[1]) bad.push(`computer ${i} (${SUBJECTS.desktop[i].name}) at ${aspect.toFixed(2)}: ${pct(b)}`);
      }
    });
    expect(bad).toEqual([]);
  });

  it('keeps each paddock animal of shot 2 inside x 42 to 97% and y 30 to 92%, clear of the wendigo by 5% of the frame', () => {
    const shot = POV_SHOTS.desktop[2];
    // The wendigo's box as the scene checker draws it (tools/scenes/wendigo.ts): 0.8 m each side of WENDIGO_AT, across
    // the camera's line, from 0.05 m under the ground to 3.4 m above that.
    const ground = groundAt(WENDIGO_AT[0], WENDIGO_AT[1]) - 0.05;
    const bad: string[] = [];
    for (const aspect of COMPUTER_ASPECTS) {
      let w: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const at of places(shot)) {
        const dx = at[0] - WENDIGO_AT[0], dz = at[2] - WENDIGO_AT[1], l = Math.hypot(dx, dz), across = [dz / l, -dx / l];
        const pts: P3[] = [];
        for (const s of [-0.8, 0.8]) for (const y of [ground, ground + 3.4]) pts.push([WENDIGO_AT[0] + across[0] * s, y, WENDIGO_AT[1] + across[1] * s]);
        const b = frameBox({ ...shot, position: at, push: [0, 0, 0] }, pts, aspect)!;
        w = [Math.min(w[0], b[0]), Math.max(w[1], b[1]), Math.min(w[2], b[2]), Math.max(w[3], b[3])];
      }
      LIVESTOCK.forEach((stock, i) => {
        if (!inPaddock(stock)) return;
        const b = frameBox(shot, animalCorners(stock), aspect);
        const name = `LIVESTOCK[${i}] (${stock[0]}) at ${aspect.toFixed(2)}: ${pct(b)}`;
        if (!b || b[0] < PADDOCK_CLEAR.x[0] || b[1] > PADDOCK_CLEAR.x[1] || b[2] < PADDOCK_CLEAR.y[0] || b[3] > PADDOCK_CLEAR.y[1]) bad.push(name);
        else {
          const m = PADDOCK_CLEAR.wendigo;
          if (b[0] < w[1] + m && b[1] > w[0] - m && b[2] < w[3] + m && b[3] > w[2] - m) bad.push(`${name} is within 5% of the wendigo's box (${pct(w)})`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('measures every phone subject against the clear strip under the title at 390 x 844 (all waiting for Brian)', () => {
    // No phone subject fits today, and none can by a small move: the strip is 50 px tall, and the avatar alone is
    // about 160 px at the opening shot. Recomposing the phone tour (or moving the name plate) is Brian's call at the
    // milestone 8 stop, so every shot is listed as waiting; each must still miss, and one that comes to fit is taken off.
    expect(PHONE_UI.plate.y[0]).toBe(PHONE_STRIP.bottom);
    const WAITING = new Set([0, 1, 2, 3, 4, 5]);
    const waiting = new Set<number>();
    const bad: string[] = [];
    POV_SHOTS.phone.forEach((shot, i) => {
      const subject = SUBJECTS.phone[i];
      // The paddock shot never moves: each animal the phone draws there must sit in the strip on its own.
      const groups = i === 2 ? PHONE_STOCK.filter(inPaddock).map(animalCorners) : [subject.corners];
      for (const pts of groups) {
        const b = frameBox(shot, pts, PHONE_ASPECT);
        if (!b || b[0] < 0.03 || b[1] > 0.97 || b[2] < PHONE_STRIP.top || b[3] > PHONE_STRIP.bottom) {
          if (WAITING.has(i)) waiting.add(i);
          else bad.push(`phone ${i} (${subject.name}): ${pct(b)}`);
        }
      }
    });
    expect(bad).toEqual([]);
    expect([...waiting].sort()).toEqual([...WAITING]);
  });
});

/** Every axis-aligned quad of a voxel geometry, as boxes (min x, y, z, max x, y, z): the two triangles of a face share one. */
function quadBoxes(geos: BufferGeometry[], near: Box3): number[] {
  const out: number[] = [];
  for (const g of geos) {
    const pos = g.getAttribute('position'), index = g.getIndex();
    const count = index ? index.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      let a = Infinity, b = Infinity, c = Infinity, d = -Infinity, e = -Infinity, f = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(t + k) : t + k;
        const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        a = Math.min(a, x); b = Math.min(b, y); c = Math.min(c, z); d = Math.max(d, x); e = Math.max(e, y); f = Math.max(f, z);
      }
      if (d < near.min[0] || a > near.max[0] || e < near.min[1] || b > near.max[1] || f < near.min[2] || c > near.max[2]) continue;
      out.push(a, b, c, d, e, f);
    }
  }
  return out;
}
const geometries = (o: unknown, out: BufferGeometry[] = [], seen = new Set<unknown>()): BufferGeometry[] => {
  if (!o || typeof o !== 'object' || seen.has(o)) return out;
  seen.add(o);
  if ((o as BufferGeometry).isBufferGeometry) { out.push(o as BufferGeometry); return out; }
  for (const [k, v] of Object.entries(o)) if (k !== 'doorLeaves' && k !== 'cat' && k !== 'robin' && k !== 'parts') geometries(v, out, seen);
  return out;
};

/** The shots this milestone pulls back from what they pressed against, and the least room any shot may have. */
const LENS = { need: 1.0, drift: 0.25 };
/** The clearance all round at the base, for the shots the plan keeps (shot 2 never moves): they may not fall below it. */
const LENS_TODAY: Record<string, number> = { 'computer 2': 0.71, 'computer 3': 0.75, 'phone 4': 0.81, 'phone 5': 0.85 };

describe('the fourteen shots: nothing within 1.0 m of the lens (plan file 04, section 4.3)', () => {
  it('keeps every voxel of the barn, yard, farm and season, and every farm animal, 1.0 m from each lens over its travel and a 0.25 m drift', () => {
    const geos = [buildBarn(), buildYard(), buildFarmstead(), buildFestive(), buildFarmFestive()].flatMap((b) => geometries(b));
    const bad: string[] = [];
    for (const [device, shots] of [['computer', POV_SHOTS.desktop], ['phone', POV_SHOTS.phone]] as const) {
      shots.forEach((shot, i) => {
        const name = `${device} ${i}`;
        const pts: P3[] = [];
        // The drift sways the lens across and up (0.25 m by 0.12 m in the game): judged here as 0.25 m both ways.
        for (let k = 0; k <= 1.0001; k += 0.05)
          for (let j = 0; j <= 16; j++) {
            const r = j === 16 ? 0 : LENS.drift, t = (j / 16) * Math.PI * 2;
            pts.push([shot.position[0] + shot.push[0] * k + Math.cos(t) * r, shot.position[1] + shot.push[1] * k + Math.sin(t) * r, shot.position[2] + shot.push[2] * k]);
          }
        const lo = [0, 1, 2].map((a) => Math.min(...pts.map((p) => p[a])) - LENS.need - 1.5) as unknown as P3;
        const hi = [0, 1, 2].map((a) => Math.max(...pts.map((p) => p[a])) + LENS.need + 1.5) as unknown as P3;
        const B = quadBoxes(geos, { min: lo, max: hi });
        // Farm animals stand where LIVESTOCK puts them: their boxes count too.
        for (const stock of device === 'phone' ? PHONE_STOCK : LIVESTOCK) {
          const c = animalCorners(stock);
          B.push(...[0, 1, 2].map((a) => Math.min(...c.map((p) => p[a]))), ...[0, 1, 2].map((a) => Math.max(...c.map((p) => p[a]))));
        }
        let least = Infinity, at = '';
        for (const p of pts) for (let j = 0; j < B.length; j += 6) {
          const d = Math.hypot(Math.max(B[j] - p[0], 0, p[0] - B[j + 3]), Math.max(B[j + 1] - p[1], 0, p[1] - B[j + 4]), Math.max(B[j + 2] - p[2], 0, p[2] - B[j + 5]));
          if (d < least) { least = d; at = `lens (${p.map((v) => v.toFixed(2))}) to (${[0, 1, 2].map((a) => ((B[j + a] + B[j + a + 3]) / 2).toFixed(2))})`; }
        }
        const floor = Math.min(LENS.need, LENS_TODAY[name] ?? LENS.need);
        if (process.env.LENS_REPORT) console.log(`${name}: ${least.toFixed(3)} m, ${at}`);
        if (least < floor - 1e-6) bad.push(`${name}: ${least.toFixed(3)} m, needs ${floor} m: ${at}`);
      });
    }
    expect(bad).toEqual([]);
  }, 120_000);
});
