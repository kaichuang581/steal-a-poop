import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { Grid } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, cube, extentOf, hollow, noMouths, none, part, S, smallEyes, solidSet, statsOf, tones, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import type { Faces } from './faces';

const WHITE = ['#F4F3F0', '#ECEBE7', '#DCDAD5'] as const;
const RED = '#D42A1F';
const WATTLE = '#C8281E';
const BEAK = ['#F2D21B', '#E0B417'] as const;
const FOOT = ['#EE8A23', '#D46E19'] as const;

/**
 * The chicken, after Brian's six-view sheet (2026-11-18): one tall white box, its top edges stepped in; a narrow band
 * under it on two short orange legs with three-toed feet; a yellow beak block (lighter on top) with a red wattle under
 * it; one-cell black eyes near the face's outer edges; a thin red comb along the crown; a wing panel on each side and a
 * tail block low on the back. The upper five rows are the head, flush with the body, so the box reads whole at rest.
 * No mouth: the sheet has none (every mouth frame is empty). Grid cells (0.04 m), drawn at 1.1 (`drawScale`). Faces +z.
 */
export function chickenModel(_ch: Character, _faces?: Faces): AnimalModel {
  const white = lin(WHITE[1]);
  const face = tones(WHITE[1]);

  // ---- Body: 9 wide, the five rows under the head and a narrower band under those.
  const bg = new Grid(S);
  cube(bg, [-4, 3, -4], [4, 7, 4], () => white);
  cube(bg, [-3, 2, -3], [3, 2, 3], () => lin(WHITE[2]));
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Wings: panels a cell proud of each side, 4 tall and 5 long, a row under the head and a row over the box's
  // bottom; the bottom back corner stepped off.
  const wings = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    cube(g, [sx * 5, 4, -2], [sx * 5, 7, 2], (_x, y, z) => (y <= 5 && z === -2 ? null : lin(WHITE[2])));
    return { ...part(g, [sx * 0.2 + 0.02, 0.24, 0]), name: sx < 0 ? 'wingL' : 'wingR', where: 'body' as const, anim: sx < 0 ? ('wingL' as const) : ('wingR' as const), cells: g.map } as SigPart;
  });

  // ---- Tail: a block 3 wide, 3 tall, 2 deep on the back, its bottom row one deep, a one-cell nub on top; rooted a
  // cell into the body.
  const tailG = new Grid(S);
  cube(tailG, [-1, 5, -6], [1, 7, -5], () => white);
  cube(tailG, [-1, 4, -5], [1, 4, -5], () => white);
  cube(tailG, [0, 8, -6], [0, 8, -5], () => white);
  cube(tailG, [-1, 4, -4], [1, 7, -4], () => white);
  const tail = part(tailG, [0.02, 0.24, -0.18]);

  // ---- Head: 9 wide, 5 tall, 9 deep, its top row stepped in a cell at the sides and back; it pivots at its middle bottom.
  const HEAD: V3 = [0.02, 8 * S, 0.02];
  const hg = new Grid(S);
  cube(hg, [-4, 8, -4], [4, 11, 4], () => white);
  cube(hg, [-3, 12, -3], [3, 12, 4], () => white);
  const { eyes, lids, brows } = smallEyes(hg, 10, 4, '#141212', face, HEAD, { front: 3, rows: 1, cols: 1, glint: false });
  const beakG = new Grid(S);
  cube(beakG, [-1, 8, 5], [1, 9, 6], (_x, y) => lin(y === 9 ? BEAK[0] : BEAK[1]));
  const wattle = new Grid(S);
  cube(wattle, [0, 6, 5], [0, 7, 5], () => lin(WATTLE));
  for (const g of [beakG, wattle]) for (const v of g.map.values()) hg.set(v.x, v.y, v.z, v.c);
  // Comb: one cell across, two tall and four long along the crown's front half, rooted a row into it.
  const combG = new Grid(S);
  cube(combG, [0, 12, 0], [0, 14, 3], () => lin(RED));
  const comb: SigPart = { ...part(combG, HEAD), name: 'comb', where: 'head', anim: 'comb', cells: combG.map };
  const mouthParts = noMouths(HEAD); // the sheet draws no mouth
  const headCells = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Legs: one cell, up into the band; a foot three wide and three long, the middle toe lighter.
  const legSpots = [[-2, 0], [2, 0]] as const;
  const legs = [
    ...legSpots.map(([x0, z0]) => {
      const g = new Grid(S);
      cube(g, [x0, 0, z0], [x0, 3, z0], () => lin(FOOT[0]));
      cube(g, [x0 - 1, 0, z0], [x0 + 1, 0, z0 + 2], (x) => lin(x === x0 ? FOOT[0] : FOOT[1]));
      unshare(g, bodySolid);
      return part(g, [(x0 + 0.5) * S, 2 * S, (z0 + 0.5) * S]);
    }),
    none([-0.06, 0.08, -0.1]), none([0.1, 0.08, -0.1]),
  ] as unknown as [CPart, CPart, CPart, CPart];

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.16, zTo: 0.04, bellyY: 0.12 }, kind: 'vest', knit: KNIT.chicken, clear: wings.map((w) => w.cells),
    neck: { centre: [0.02, 0.4, -3 * S + 0.001], rx: 0.2, ry: 0.16, tails: [0.02, 0.24, 0], solid: headCells },
    band: { centre: [0.02, 0.4, -4 * S + 0.001], rx: 0.2, ry: 0.16, solid: headCells },
    avoid: [hg.map, combG.map, tailG.map],
    legs: legSpots.map(([x0, z0]) => ({ cx: (x0 + 0.5) * S, cz: (z0 + 0.5) * S, w: 1 })),
  });
  const breath = breathAt([0.02, 9 * S, 7 * S]);
  const signature = [comb, ...wings];
  const parts = [coats.wools[2], headPart, ...eyes, legs[0], legs[1], tail, ...signature];
  const { height, length } = extentOf([bodyPart, headPart, comb, tail, legs[0], legs[1]]);
  return {
    species: 'chicken', bodyAlways: false, signature, tailAnim: 'tailFan', height, length, drawScale: 1.1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears: [none(HEAD), none(HEAD)], legs, collar: none(), bell: none([0, 0.6, 0.3]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    // No neck part: the head's back two slices stand in for it, so the winner's scarf (anchors.ts) ties there.
    cells: cellsOf({ body: bodyPart, neck: { ...headPart, cells: new Map([...hg.map].filter(([k, v]) => v.z <= -3 && !wattle.map.has(k))) }, head: { ...headPart, cells: new Map([...hg.map].filter(([k]) => !beakG.map.has(k) && !wattle.map.has(k))) }, eye: [...eyes], leg: [legs[0], legs[1]], tail, collar: none(), comb: comb as CPart, beak: { ...headPart, cells: beakG.map }, wattle: { ...headPart, cells: wattle.map }, wing: wings as unknown as CPart[] }),
    stats: statsOf(parts, []),
  };
}
