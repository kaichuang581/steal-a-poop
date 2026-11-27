import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { animalModel } from '../animals';
import type { Species } from '../animals/rig';

/**
 * Every animal shows an eye from every side it is looked at (Brian, 2026-11-25, the third time: "fix the eye issue
 * again, it keeps reoccuring. make a permanent fix"). The eyes had been checked from in front only, and Practice, the
 * table's side shots and the pen see heads from the side: there an eye set on the face's front is hidden by the head
 * itself, by an ear, or lost in a dark patch. So this walks the model's own cubes at rest:
 * - from the front both eyes show; from each side, and from 45 degrees to each side, the near eye shows; each also
 *   from a camera 15 degrees above (the game's cameras all look down a little);
 * - "shows" is a face of an eye cube that looks toward the camera with nothing of the animal in the way;
 * - and it must be told from what is round it: beside that face, on the head, a cube clearly lighter than the eye.
 */
const SPECIES: Species[] = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'];
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const lum = (c: readonly number[] | Color) => { const [r, g, b] = c instanceof Color ? [c.r, c.g, c.b] : c; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const FACES: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]];
const UP = Math.sin((15 * Math.PI) / 180);
const VIEWS: { name: string; d: [number, number, number]; eyes: 'both' | 'left' | 'right' }[] = [];
for (const [name, x, z, eyes] of [['front', 0, 1, 'both'], ['left side', -1, 0, 'left'], ['right side', 1, 0, 'right'], ['front left', -0.707, 0.707, 'left'], ['front right', 0.707, 0.707, 'right']] as const) {
  VIEWS.push({ name, d: [x, 0, z], eyes });
  VIEWS.push({ name: `${name}, from above`, d: [x * Math.cos(Math.asin(UP)), UP, z * Math.cos(Math.asin(UP))], eyes });
}

export function eyesSeen(species: Species): string[] {
  const m = animalModel(species);
  const solid = new Map<string, { part: string; c: readonly number[] }>();
  for (const [part, vox] of Object.entries(m.cells)) for (const v of vox.values()) solid.set(key(v.x, v.y, v.z), { part, c: v.c as unknown as readonly number[] });
  const eyeCells = (i: number) => [...m.cells[`eye${i}`].values()];
  /** Whether a face of the cube looks at the camera with nothing between: a march of half-cube steps from the face's middle. */
  const open = (v: { x: number; y: number; z: number }, n: readonly number[], d: readonly number[]) => {
    if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0.2) return false;
    let p = [v.x + 0.5 + n[0] * 0.51, v.y + 0.5 + n[1] * 0.51, v.z + 0.5 + n[2] * 0.51];
    for (let s = 0; s < 120; s++) {
      const hit = solid.get(key(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])));
      if (hit && !hit.part.startsWith('eye')) return false;
      p = [p[0] + d[0] * 0.25, p[1] + d[1] * 0.25, p[2] + d[2] * 0.25];
    }
    return true;
  };
  /** A cube of the animal beside that face, in its plane, clearly lighter or darker than the eye: the eye reads against it. */
  const told = (v: { x: number; y: number; z: number; c: unknown }, n: readonly number[]) => {
    const eye = lum(v.c as readonly number[]);
    for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (a * n[0] + b * n[1] + c * n[2] !== 0) continue;
      // Beside it in its own layer, or (an eye that stands a cube proud of the head: the horse's) in the layer behind.
      for (const back of [0, 1]) {
        const o = solid.get(key(v.x + a - n[0] * back, v.y + b - n[1] * back, v.z + c - n[2] * back));
        if (o && !o.part.startsWith('eye') && Math.abs(lum(o.c) - eye) > 0.12) return true;
      }
    }
    return false;
  };
  const shows = (i: number, d: readonly number[]) => eyeCells(i).some((v) => FACES.some((n) => open(v, n, d) && told(v, n)));
  const bad: string[] = [];
  for (const view of VIEWS) {
    const want = view.eyes === 'both' ? [0, 1] : view.eyes === 'left' ? [0] : [1];
    for (const i of want) if (!shows(i, view.d)) bad.push(`${view.name}: ${i === 0 ? 'left' : 'right'} eye`);
  }
  return bad;
}

describe('an eye is one cube, so no animal ever shows two eyes on one side', () => {
  // Brian, 2026-11-25: "why does the chicken have 4 eyes", "why do all of em have 4 eyes": a second cube round the head's
  // corner, added so a front eye showed from the side, read as a second eye from every angle between.
  for (const species of SPECIES) it(species, () => { const m = animalModel(species); for (const i of [0, 1]) expect(m.cells[`eye${i}`].size, `eye ${i}`).toBe(1); });
});

describe('every animal shows its eyes from the front and from both sides', () => {
  for (const species of SPECIES) it(species, () => { const bad = eyesSeen(species); expect(bad, bad.join('; ')).toEqual([]); });
});
