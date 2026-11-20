import type { Character } from '../../avatars/catalog';
import { Grid } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, cube, extentOf, hollow, inBlocks, noMouths, none, part, S, smallEyes, solidSet, statsOf, tones, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import type { Faces } from './faces';
import { shade } from '../paint';

const PINK = ['#F0B4AE', '#E7A7A2', '#8C5A55'] as const;
const HORN = '#D9BE8E';
const WHITE = '#F4F2EE';
const BLACK = '#211E1E'; // the sheet's near-black, a shade over the palette floor (DARKEST)
const EAR_IN = '#5A4640';

/**
 * The cow, after Brian's six-view sheet (2026-11-18): a deep white box on four square legs with black hooves; a square
 * head on its front, its top a little over the back, black over its left half and that side's top (both eyes are drawn,
 * one on the white, one on the black, as the sheet has them); a wide pink muzzle with two nostrils; L-shaped tan horns;
 * long black ears straight out to the sides with dark insides; stepped black patches over the shoulders and back,
 * with a white stripe down the middle of the rump; a pink udder with four teats; a short black tail. Grid cells (0.04 m),
 * drawn at 1.3 (`drawScale`). Faces +z; the centre column is x = 0.
 */
export function cowModel(_ch: Character, _faces?: Faces): AnimalModel {
  const white = shade(WHITE), black = shade(BLACK);
  const face = tones(WHITE);

  // ---- Body: 13 wide, 11 tall, 18 long. Patches as 3D blocks, so each wraps its corner onto the top and front.
  const PATCHES: [V3, V3][] = [
    [[2, 9, 5], [6, 17, 8]], [[2, 9, 2], [6, 12, 4]], // the left shoulder
    [[-6, 8, 4], [-2, 17, 8]], [[-6, 10, 1], [-2, 13, 3]], // the right shoulder
    [[-6, 16, 3], [6, 17, 8]], // over the withers
    [[2, 14, -9], [6, 17, -1]], [[2, 12, -7], [6, 13, -1]], [[-6, 14, -9], [-2, 17, -1]], [[-6, 12, -7], [-2, 13, -1]], // the rump, a white stripe between
    [[3, 9, -9], [6, 11, -7]], [[-6, 9, -9], [-3, 11, -7]], // low on the haunches
  ];
  const bodyPaint: Paint = (x, y, z) => (inBlocks(PATCHES, x, y, z) ? black : white);
  const bg = new Grid(S);
  cube(bg, [-6, 7, -9], [6, 17, 8], bodyPaint);
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: 9 wide, 8 tall, 6 deep, black over its left side and the left of its brow.
  const HEAD: V3 = [0.02, 12 * S, 9 * S]; // its back-bottom edge: a nod swings the face forward, never into the chest
  const hg = new Grid(S);
  cube(hg, [-4, 12, 9], [4, 19, 14], (x, y) => (x >= 2 && y >= 14 ? black : white));
  // Muzzle: 7 wide, 4 tall, 2 proud, pink; two nostrils in its upper row.
  const muzzleG = new Grid(S);
  cube(muzzleG, [-3, 12, 15], [3, 15, 16], (x, y, z) => shade(z === 16 && y === 14 && Math.abs(x) === 2 ? PINK[2] : PINK[0]));
  for (const v of muzzleG.map.values()) hg.set(v.x, v.y, v.z, v.c);
  const { eyes, lids, brows } = smallEyes(hg, 17, 14, '#141212', face, HEAD, { front: 3, rows: 1, cols: 1, glint: false });
  const mouthParts = noMouths(HEAD); // the sheet draws no mouth
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Horns: tan Ls, one cell across: up two from the crown's outer corners, a foot turned in at the bottom.
  // Rooted a row into the crown.
  const hornG = new Grid(S);
  for (const sx of [-1, 1]) {
    cube(hornG, [sx * 4, 19, 10], [sx * 4, 21, 10], () => shade(HORN));
    cube(hornG, [sx * 3, 19, 10], [sx * 3, 20, 10], () => shade(HORN));
  }
  const horns: SigPart = { ...part(hornG, HEAD), name: 'horns', where: 'head', cells: hornG.map };

  // ---- Ears: black, 4 out, 3 tall, 2 deep, straight out from the crown's sides, a dark inside on the front.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    cube(g, [sx < 0 ? -8 : 5, 17, 10], [sx < 0 ? -5 : 8, 19, 11], (x, y, z) => (z === 11 && y === 18 && Math.abs(x) >= 6 && Math.abs(x) <= 7 ? shade(EAR_IN) : black));
    return part(g, [sx * 4.5 * S + 0.02, 18 * S, 10.5 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: 3 x 3, two rows up inside the belly, the bottom two rows black.
  const legSpots = [[-5, 4], [3, 4], [-5, -8], [3, -8]] as const;
  const legs = legSpots.map(([x0, z0]) => {
    const g = new Grid(S);
    cube(g, [x0, 0, z0], [x0 + 2, 8, z0 + 2], (_x, y) => (y <= 1 ? black : white));
    unshare(g, bodySolid);
    return part(g, [(x0 + 1.5) * S, 7 * S, (z0 + 1.5) * S]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Udder: pink, 5 x 2 x 3 under the belly toward the back legs, four teats under it.
  const ug = new Grid(S);
  cube(ug, [-2, 5, -5], [2, 6, -3], () => shade(PINK[1]));
  for (const x of [-2, 2]) for (const z of [-5, -3]) ug.set(x, 4, z, shade(PINK[1]));
  const udder: SigPart = { ...part(ug, [0, 0, 0]), name: 'udder', where: 'body', cells: ug.map };

  // ---- Tail: a short black stub out of the rump, rooted a cell in.
  const tg = new Grid(S);
  cube(tg, [0, 9, -10], [0, 10, -9], () => black);
  const tail = part(tg, [0.02, 0.4, -0.38]);

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.24, zTo: 0.16, bellyY: 0.4 }, kind: 'blanket-square', knit: KNIT.cow,
    neck: { centre: [0.02, 0.62, 10 * S + 0.001], rx: 0.2, ry: 0.2, tails: [0.02, 0.4, 0.42], solid: headSolid },
    avoid: [hg.map, hornG.map, ...ears.map((e) => e.cells)],
    legs: legSpots.map(([x0, z0]) => ({ cx: (x0 + 1.5) * S, cz: (z0 + 1.5) * S, w: 3 })),
  });
  const muzzleSig: SigPart = { ...part(new Grid(S), HEAD), name: 'muzzle', where: 'head', cells: muzzleG.map };
  const breath = breathAt([0.02, 13 * S, 17 * S]);
  const parts = [coats.wools[2], headPart, horns, ...eyes, ...ears, ...legs, tail, udder];
  const { height, length } = extentOf([bodyPart, headPart, horns, ...ears, ...legs, tail]);
  const collar = none(), bell = none([0.02, 0.4, 0.42]);
  return {
    species: 'cow', bodyAlways: false, signature: [muzzleSig, horns, udder], height, length, drawScale: 1.3,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell, sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    // No neck part: the head's two slices ahead of the ears and horns stand in for it, so the winner's scarf (anchors.ts) ties there.
    cells: cellsOf({ body: bodyPart, neck: { ...headPart, cells: new Map([...hg.map].filter(([, v]) => v.z >= 12 && v.z <= 13)) }, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, bell, muzzle: muzzleSig as CPart, horns: horns as CPart, udder: udder as CPart }),
    stats: statsOf(parts, []),
  };
}
