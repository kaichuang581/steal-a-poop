import type { Character } from '../../avatars/catalog';
import { Grid } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, cube, extentOf, hollow, noMouths, none, part, S, smallEyes, solidSet, statsOf, tones, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import type { Faces } from './faces';
import { shade } from '../paint';

const COAT = ['#F1EFEB', '#E2E0DC', '#CFCCC7'] as const;
const HORN = ['#ADA090', '#968776'] as const;
const HOOF = '#8E8A85';
const NOSE = '#6E6862';

/**
 * The goat, after Brian's six-view sheet (2026-11-18): a pale grey box on four square legs with grey hooves and a
 * paler band low on its flanks and chest; a square head over the chest on a short neck that slants back; a paler
 * muzzle block with a dark nostril bar; one-cell black eyes; ears straight out to the sides, drooping at the tips;
 * two grey-brown horns rising and sweeping back; a stepped beard; a tail pointing up and back. Grid cells (0.04 m),
 * drawn at 1.25 (`drawScale`). Faces +z.
 */
export function goatModel(_ch: Character, _faces?: Faces): AnimalModel {
  const coat = shade(COAT[1]);
  const face = tones(COAT[1]);

  // ---- Body: 11 wide, 9 tall, 15 long; the bottom two rows and the chest under the head paler.
  const bg = new Grid(S);
  cube(bg, [-5, 6, -7], [5, 14, 7], (x, y, z) => shade(y <= 7 || (z === 7 && y <= 11 && Math.abs(x) <= 3) ? COAT[0] : COAT[1]));
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: 9 wide, 8 tall, 5 deep, its back over the chest; the muzzle 5 x 3, 3 proud, its nostril bar dark.
  const HEAD: V3 = [0.02, 12 * S, 6 * S];
  const hg = new Grid(S);
  cube(hg, [-4, 12, 6], [4, 19, 10], () => coat);
  const muzzleG = new Grid(S);
  cube(muzzleG, [-2, 12, 11], [2, 14, 13], (x, y, z) => shade(z === 13 && y === 13 && Math.abs(x) <= 1 ? NOSE : COAT[0]));
  for (const v of muzzleG.map.values()) hg.set(v.x, v.y, v.z, v.c);
  const { eyes, lids, brows } = smallEyes(hg, 15, 10, '#1E1A19', face, HEAD, { front: 3, rows: 1, cols: 1, glint: false });
  const mouthParts = noMouths(HEAD); // the sheet draws no mouth
  // Beard: 3 wide, stepping in under the muzzle: three rows at the front, two, then one.
  const beardG = new Grid(S);
  cube(beardG, [-1, 11, 9], [1, 11, 11], () => shade(COAT[0]));
  cube(beardG, [-1, 10, 10], [1, 10, 11], () => shade(COAT[0]));
  cube(beardG, [-1, 9, 10], [1, 9, 10], () => shade(COAT[0]));
  const beard: SigPart = { ...part(beardG, [0.02, 12 * S, 10 * S]), name: 'beard', where: 'head', anim: 'beard', cells: beardG.map };
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Horns: 2 x 1 across, rising from the crown's back half and sweeping back; rooted a row into the crown.
  const horns = ([-1, 1] as const).map((sx, i) => {
    const g = new Grid(S);
    const [x0, x1] = sx < 0 ? [-3, -2] : [2, 3];
    const paint = (_x: number, y: number) => shade(HORN[y >= 22 ? 0 : 1]);
    cube(g, [x0, 19, 7], [x1, 20, 8], paint);
    cube(g, [x0, 21, 6], [x1, 21, 7], paint);
    cube(g, [x0, 22, 4], [x1, 22, 6], paint);
    return { ...part(g, HEAD), name: i === 0 ? 'horn0' : 'horn1', where: 'head' as const, cells: g.map } as SigPart;
  });

  // ---- Ears: 3 out, 2 tall, 2 deep from the head's sides, the tip a row lower.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    cube(g, [sx < 0 ? -6 : 5, 16, 7], [sx < 0 ? -5 : 6, 17, 8], () => coat);
    cube(g, [sx * 7, 15, 7], [sx * 7, 16, 8], () => shade(COAT[2]));
    return part(g, [sx * 4.5 * S + 0.02, 17 * S, 8 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Neck: 7 wide behind the head, slanting back as it falls to the withers.
  const NECK_BASE: V3 = [0.02, 14 * S, 4 * S];
  const ng = new Grid(S);
  cube(ng, [-3, 13, 2], [3, 15, 5], () => coat);
  cube(ng, [-3, 16, 4], [3, 17, 5], () => coat);
  cube(ng, [-3, 18, 5], [3, 18, 5], () => coat);
  unshare(ng, bodySolid);
  const neck = part(ng, [0, 0, 0]);

  // ---- Legs: 3 x 3, two rows inside the belly, a grey hoof.
  const legSpots = [[-4, 4], [2, 4], [-4, -6], [2, -6]] as const;
  const legs = legSpots.map(([x0, z0]) => {
    const g = new Grid(S);
    cube(g, [x0, 0, z0], [x0 + 2, 7, z0 + 2], (_x, y) => shade(y === 0 ? HOOF : COAT[1]));
    unshare(g, bodySolid);
    return part(g, [(x0 + 1.5) * S, 6 * S, (z0 + 1.5) * S]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: 3 wide, up and back off the top of the rump, rooted two rows into it.
  const tg = new Grid(S);
  cube(tg, [-1, 13, -8], [1, 16, -7], () => coat);
  cube(tg, [-1, 16, -9], [1, 17, -9], () => coat);
  const tail = part(tg, [0.02, 0.56, -0.3]);

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.16, zTo: 0.08, bellyY: 0.36 }, kind: 'sweater', knit: KNIT.goat,
    neck: { centre: [0.02, 0.64, 7 * S + 0.001], rx: 0.18, ry: 0.2, tails: [0.02, 0.4, 0.3], solid: headSolid },
    band: { centre: [0.02, 0.64, 6 * S + 0.001], rx: 0.18, ry: 0.2, solid: headSolid },
    avoid: [hg.map, beardG.map, tg.map, ng.map, ...ears.map((e) => e.cells), ...horns.map((h) => h.cells)],
    legs: legSpots.map(([x0, z0]) => ({ cx: (x0 + 1.5) * S, cz: (z0 + 1.5) * S, w: 3 })),
  });
  const breath = breathAt([0.02, 13 * S, 14 * S]);
  const signature = [...horns, beard];
  const parts = [coats.wools[2], neck, headPart, ...eyes, ...ears, ...legs, tail, ...horns, beard];
  const { height, length } = extentOf([bodyPart, neck, headPart, beard, ...horns, ...ears, ...legs, tail]);
  return {
    species: 'goat', bodyAlways: false, signature, height, length, drawScale: 1.25,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment, neck, neckBase: NECK_BASE,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar: none(), bell: none([0, 0.7, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar: none(), horn: horns as unknown as CPart[], beard: beard as CPart }),
    stats: statsOf(parts, []),
  };
}
