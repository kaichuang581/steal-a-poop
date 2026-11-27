import type { Character } from '../../avatars/catalog';
import { Grid } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, cube, extentOf, hollow, noMouths, none, part, S, smallEyes, solidSet, statsOf, step, stepHex, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import type { Faces } from './faces';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shade } from '../paint';

const COAT = ['#B0663A', '#A0582A', '#864822'] as [string, string, string]; // the sheet's brown
const DARK = ['#3A281D', '#2B1D15', '#1F1410'] as const;

/**
 * The horse, after Brian's six-view sheet (2026-11-18): the tallest animal. A long brown box on four square legs with
 * dark hooves a cell wider than the leg; a flat neck leaning forward off the shoulders; a head box held a little
 * nose-down with a narrower snout whose front and underside are dark; one-cell eyes on the head's sides; two small
 * upright ears; a dark mane over the crown that steps down the back of the neck to the withers; a dark tail off the top
 * of the rump that steps down and back. Grid cells (0.04 m), drawn at 1.24 (`drawScale`). Faces +z.
 */
export function horseModel(_ch: Character, _faces?: Faces): AnimalModel {
  const coat = shade(COAT[1]);
  const dark = shade(DARK[1]);

  // ---- Body: 11 wide, 9 tall, 20 long.
  const bg = new Grid(S);
  cube(bg, [-5, 9, -10], [5, 17, 9], () => coat);
  step(bg, -1, (v) => v.y === 9); // the belly row
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: 7 wide, 6 tall, 6 long; the snout 5 wide, 4 tall, 5 long, its bottom flush with the head's, dark over its
  // front two slices and along its underside; the mane's top two rows over the crown (they turn with the head).
  const HEAD: V3 = [0.02, 22 * S, 8 * S];
  const hg = new Grid(S);
  cube(hg, [-3, 22, 8], [3, 27, 13], () => coat);
  const snoutPaint: Paint = (x, y, z) => (z >= 17 || (z >= 15 && y <= 22) ? (z === 18 && y === 24 && Math.abs(x) === 1 ? shade(DARK[2]) : shade(DARK[0])) : coat);
  cube(hg, [-2, 22, 14], [2, 25, 18], snoutPaint);
  step(hg, 1, (v) => v.c === coat); // the head, not the snout's dark
  cube(hg, [-1, 28, 7], [1, 29, 13], () => dark); // the forelock, the crown's whole length
  cube(hg, [-1, 24, 7], [1, 27, 7], () => dark); // the mane over the back of the head, down to the neck's
  step(hg, -1, (v) => v.c === dark);
  const { eyes, lids, brows } = smallEyes(hg, 25, 11, '#1E1A19', COAT.map((h) => stepHex(h, 1)) as [string, string, string], HEAD, { rows: 1, cols: 1, glint: false, proud: true });
  const mouthParts = noMouths(HEAD); // the sheet draws no mouth
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Neck: one straight block, 5 wide and 6 deep, leaning forward (TILT) from inside the shoulders to under the head.
  // Built upright about the neck's foot and the finished mesh turned, so its faces stay flat (the sheet's flat
  // rectangle). `cells` holds the turned block snapped back to the grid, for the checks and the scarf.
  const NECK_BASE: V3 = [0.02, 17 * S, 7 * S];
  const NECK_FOOT: V3 = [0, 14 * S, 6 * S];
  const TILT = 0.3;
  const ng = new Grid(S);
  cube(ng, [-2, 14, 3], [2, 24, 8], () => coat); // its top runs up inside the head
  // Its cells: every grid cell whose centre, turned back upright, falls inside the block (a solid, face-connected set).
  const neckCells = new Grid(S);
  const [cy, cz, cos, sin] = [NECK_FOOT[1] / S, NECK_FOOT[2] / S, Math.cos(TILT), Math.sin(TILT)];
  for (let y = 12; y <= 27; y++) for (let z = 1; z <= 14; z++) {
    const ry = y + 0.5 - cy, rz = z + 0.5 - cz;
    const uy = cy + ry * cos + rz * sin, uz = cz - ry * sin + rz * cos;
    if (uy >= 14 && uy < 25 && uz >= 3 && uz < 9) for (let x = -2; x <= 2; x++) neckCells.set(x, y, z, coat);
  }
  const neckGeo = part(ng, NECK_FOOT).geo;
  neckGeo.rotateX(TILT);
  // Mane: 3 wide, standing two cells proud of the neck's back face on every row from the withers to behind the ears,
  // so it steps back a cell every two or three rows as the sheet's does (square to the world, not the neck). One colour.
  const mg = new Grid(S);
  for (let y = 17; y <= 27; y++) {
    const zb = Math.floor(cz - 3 * cos + (y + 0.5 - cy - 3 * sin) * (sin / cos)); // the back face's z at this row
    cube(mg, [-1, y, zb - 2], [1, y, zb], () => dark);
  }
  step(mg, -1);
  const neck = { geo: mergeGeometries([neckGeo, part(mg, NECK_FOOT).geo], false)!, pivot: NECK_FOOT, voxels: ng.count + mg.count, cells: new Map([...neckCells.map, ...mg.map]) };
  const neckSolid = new Set(neckCells.map.keys());
  const maneSig: SigPart = { ...part(new Grid(S), [0, 0, 0]), name: 'mane', where: 'body', cells: mg.map }; // drawn with the neck

  // ---- Ears: 2 wide, 3 tall, 1 deep, upright on the crown's back corners, rooted a row into it.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    cube(g, [sx < 0 ? -3 : 2, 27, 10], [sx < 0 ? -2 : 3, 30, 10], (_x, y) => shade(y === 30 ? COAT[2] : COAT[1]));
    step(g, -1);
    return part(g, [sx * 2.5 * S + 0.02, 28 * S, 10.5 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: 3 x 3, a row up inside the belly; the hoof two rows tall, a cell wider out to the side and forward.
  const legSpots = [[-4, 6], [2, 6], [-4, -9], [2, -9]] as const; // each pair a cell in from its end of the body
  const legs = legSpots.map(([x0, z0]) => {
    const g = new Grid(S);
    const out = x0 < 0 ? -1 : 0;
    cube(g, [x0, 2, z0], [x0 + 2, 9, z0 + 2], () => coat);
    cube(g, [x0 + out, 0, z0], [x0 + 3 + out, 1, z0 + 3], () => shade(DARK[1]));
    step(g, -1, (v) => v.y > 1); // the leg, not its hoof
    unshare(g, bodySolid);
    return part(g, [(x0 + 1.5) * S, 9 * S, (z0 + 1.5) * S]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: 3 wide, off the top of the rump, stepping down and back.
  const tg = new Grid(S);
  cube(tg, [-1, 17, -11], [1, 19, -9], () => dark);
  cube(tg, [-1, 14, -12], [1, 16, -10], () => dark);
  cube(tg, [-1, 11, -13], [1, 13, -11], () => dark);
  cube(tg, [-1, 8, -14], [1, 10, -12], () => dark);
  step(tg, -1);
  for (const v of [...tg.map.values()]) if (bodySolid.has(`${v.x},${v.y},${v.z}`) && v.z > -10) tg.del(v.x, v.y, v.z);
  const tail = part(tg, [0.02, 0.72, -0.4]);

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.28, zTo: 0.12, bellyY: 0.48 }, kind: 'blanket-saddle', knit: KNIT.horse,
    neck: { centre: [0.02, 1.0, 8 * S + 0.001], rx: 0.16, ry: 0.18, tails: [0.02, 0.8, 0.32], solid: new Set([...headSolid, ...neckSolid]) },
    avoid: [hg.map, neck.cells, tg.map, ...ears.map((e) => e.cells)],
    legs: legSpots.map(([x0, z0]) => ({ cx: (x0 + 1.5) * S, cz: (z0 + 1.5) * S, w: 3 })),
  });
  const breath = breathAt([0.02, 22 * S, 19 * S]);
  const parts = [coats.wools[2], neck, maneSig, headPart, ...eyes, ...ears, ...legs, tail];
  const { height, length } = extentOf([bodyPart, neck, maneSig, headPart, ...ears, ...legs, tail]);
  return {
    species: 'horse', bodyAlways: false, signature: [maneSig], height, length, drawScale: 1.24, headPitch: 0.15,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment, neck, neckBase: NECK_BASE,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar: none(), bell: none([0, 0.8, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar: none(), mane: maneSig as CPart }),
    stats: statsOf(parts, []),
  };
}
