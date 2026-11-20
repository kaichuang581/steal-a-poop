import type { Character } from '../../avatars/catalog';
import { Grid } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, cube, extentOf, hollow, noMouths, none, part, S, smallEyes, solidSet, statsOf, tones, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { shade } from '../paint';

/** Hooves for the species that keep a dark hoof (kept for any importer). */
export const HOOF = tones('#4A3A3A');
const PINK = ['#F2AFAE', '#E9A0A2', '#D98890', '#B5646F'] as const;

/**
 * The pig, after Brian's six-view sheet (2026-11-18): one long pink box on four stubby legs (its front four slices
 * are the head, flush with the body, so the box reads whole at rest); a snout block with two darker nostrils, one-cell
 * black eyes either side above it, ears lying flat on the crown's front corners and folding down its sides, and a
 * little curl of a tail. Grid cells (0.04 m), drawn at 1.43 (`drawScale`). Faces +z.
 */
export function pigModel(_ch: Character): AnimalModel {
  const pink = shade(PINK[0]);
  const face = tones(PINK[0]);

  // ---- Body: the back thirteen slices of an 11 x 10 x 17 box.
  const bg = new Grid(S);
  cube(bg, [-5, 4, -8], [5, 13, 4], () => pink);
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: the box's front four slices, pivoting at their middle.
  const HEAD: V3 = [0.02, 9 * S, 6.5 * S];
  const hg = new Grid(S);
  cube(hg, [-5, 4, 5], [5, 13, 8], () => pink);
  const sg = new Grid(S);
  cube(sg, [-2, 6, 9], [2, 9, 10], (x, y, z) => shade(z === 10 && y === 8 && Math.abs(x) === 1 ? PINK[3] : PINK[1]));
  const snout: SigPart = { ...part(sg, HEAD), name: 'snout', where: 'head', anim: 'snout', cells: sg.map };
  const { eyes, lids, brows } = smallEyes(hg, 10, 8, '#1E1A19', face, HEAD, { front: 3, rows: 1, cols: 1, glint: false });
  const mouthParts = noMouths(HEAD); // the sheet draws no mouth
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: a slab 4 wide, 1 tall, 3 deep on the crown's front corner, overhanging the side a cell, and a flap
  // down that side 4 rows.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    const [x0, x1] = sx < 0 ? [-6, -3] : [3, 6];
    cube(g, [x0, 14, 6], [x1, 14, 8], () => shade(PINK[1]));
    cube(g, [sx * 6, 10, 6], [sx * 6, 13, 7], () => shade(PINK[2]));
    return part(g, [sx * 4.5 * S + 0.02, 14 * S, 7 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: 3 x 3 stubs under the body, two rows inside the belly, the bottom row darker.
  const legSpots = [[-4, 1], [2, 1], [-4, -7], [2, -7]] as const; // the front pair a cell clear of where the head meets the body (the winner's scarf ties there)
  const legs = legSpots.map(([x0, z0]) => {
    const g = new Grid(S);
    cube(g, [x0, 0, z0], [x0 + 2, 5, z0 + 2], (_x, y) => shade(y === 0 ? PINK[3] : PINK[1]));
    unshare(g, bodySolid);
    return part(g, [(x0 + 1.5) * S, 4 * S, (z0 + 1.5) * S]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a little curl, 2 x 2 x 2 off the top of the rump with a cell over, rooted a cell in.
  const tg = new Grid(S);
  cube(tg, [0, 11, -9], [1, 12, -8], () => shade(PINK[2]));
  cube(tg, [0, 11, -10], [1, 11, -10], () => shade(PINK[2]));
  tg.set(0, 12, -10, shade(PINK[1]));
  tg.set(1, 12, -10, shade(PINK[1]));
  const tail = part(tg, [0.04, 0.46, -0.34]);

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.24, zTo: 0.08, bellyY: 0.32 }, kind: 'sweater', knit: KNIT.pig,
    neck: { centre: [0.02, 0.36, 6 * S + 0.001], rx: 0.24, ry: 0.24, tails: [0.02, 0.2, 0.12], solid: headSolid },
    band: { centre: [0.02, 0.36, 5 * S + 0.001], rx: 0.24, ry: 0.24, solid: headSolid },
    avoid: [hg.map, sg.map, ...ears.map((e) => e.cells)],
    legs: legSpots.map(([x0, z0]) => ({ cx: (x0 + 1.5) * S, cz: (z0 + 1.5) * S, w: 3 })),
  });
  const breath = breathAt([0.02, 7 * S, 11 * S]);
  const parts = [coats.wools[2], headPart, ...eyes, ...ears, ...legs, tail, snout];
  const { height, length } = extentOf([bodyPart, headPart, snout, ...ears, ...legs, tail]);
  return {
    species: 'pig', bodyAlways: false, signature: [snout], height, length, drawScale: 1.43,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar: none(), bell: none([0, 0.44, 0.56]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    // No neck part: the slices either side of where the head meets the body stand in for it, so the winner's scarf
    // (anchors.ts) ties there.
    cells: cellsOf({ body: bodyPart, neck: { ...headPart, cells: new Map([...hg.map, ...bg.map].filter(([, v]) => v.z === 4 || v.z === 5)) }, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar: none(), snout }),
    stats: statsOf(parts, []),
  };
}
