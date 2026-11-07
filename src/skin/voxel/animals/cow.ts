import type { Character } from '../../avatars/catalog';
import { lin, T } from '../palette';
import { box, Grid, line } from '../primitives';
import type { Paint } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { barrel, breathAt, cellsOf, collarRing, eyePlate, hollow, leg, lidsAndBrows, mask, mouths, none, part, S, segment, shaded, statsOf, tones, wedge, wrapEye } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { HOOF } from './pig';

/**
 * The cow (V5 Part 6): a long boxy barrel with a square rump, a horizontal wedge head carried low on a short thick
 * neck, a broad pink muzzle, sideways leaf ears, two horn nubs, a bell under the chin, and a tufted tail. Holstein
 * patches as shaped masks in the character's dark tone.
 */
export function cowModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const face = body;
  const muzzle = tones(ch.colors.soft);
  const patch = lin(ch.colors.dark);

  // ---- Body: 0.60 x 0.58 x 0.80, chamfer 3, rounder chest, three patches.
  const bg = new Grid(S);
  barrel(bg, [0.02, 0.58, 0], [0.52, 0.50, 0.66], 3, shaded(body, 20, 8), 0.8);
  mask(bg, [{ c: [-0.22, 0.66, 0.16], r: [0.16, 0.12, 0.14] }, { c: [-0.28, 0.6, 0.06], r: [0.12, 0.10, 0.12] }], patch, lin(body[2]));
  mask(bg, [{ c: [0.26, 0.62, -0.22], r: [0.13, 0.12, 0.14] }], patch, lin(body[2]));
  mask(bg, [{ c: [0.12, 0.86, -0.02], r: [0.17, 0.06, 0.12] }], patch, lin(body[2]));
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Neck: a short thick segment from the chest, 20 degrees down.
  const ng = new Grid(S);
  segment(ng, [0.02, 0.70, 0.30], [0.02, 0.62, 0.50], 0.26, 0.22, shaded(body, 20, 12));
  const neck = part(ng, [0, 0, 0]);

  // ---- Head: a wedge 0.40 long, 0.40 wide at the back to 0.32 at the muzzle, 0.36 tall, at the neck's end.
  const HEAD: V3 = [0, 0.46, 0.44];
  const hg = new Grid(S);
  wedge(hg, [0, 0.46, 0.44], 0.40, 0.40, 0.32, 0.36, shaded(face, 20, 12));
  const zf = Math.round(0.44 / S) + Math.round(0.40 / S) - 1; // the front slice
  // Muzzle: the lower half of the front, 8 wide x 4 tall x 3 deep, in the pink tone; nostril pits; a mouth under it.
  const mz: Paint = (x, y, z) => lin((x === -2 || x === 1) && y === 14 && z === zf ? muzzle[2] : muzzle[1]);
  const muzzleG = new Grid(S);
  box(muzzleG, [-0.16, 0.48, (zf - 2) * S], [0.16, 0.64, (zf + 1) * S], (x, y, z) => ((x === -4 || x === 3) && (y === 12 || y === 15) ? null : mz(x, y, z)));
  for (const v of muzzleG.map.values()) hg.set(v.x, v.y, v.z, v.c);
  // Eyes on the side faces at the front third, rows 3 to 7 of 9 from the top.
  // Eyes: on the sides at the front, their front two columns wrapping onto the face; rows 3 to 7 of 9 from the top.
  const eyeY = Math.round(0.46 / S) + 3;
  const places = [wrapEye(hg, -1, eyeY, zf, 5), wrapEye(hg, 1, eyeY, zf, 5)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 5, ch.colors.dark);
    const [x, y, z] = place(2, 2, 1);
    return part(g, [(x + 0.5 + (i === 0 ? -0.5 : 0.5)) * S, (y + 0.5) * S, (z + 0.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 5 })), face, HEAD);
  const mouthParts = mouths([-3, Math.round(0.46 / S), zf], 7, 'z', muzzle[2], HEAD);
  // Horns: two nubs between the ears, curving a voxel outward; a forelock of three light voxels between them.
  const top = Math.round(0.46 / S) + Math.round(0.36 / S);
  for (const sx of [-1, 1]) { for (const dx of [0, 1]) for (const dz of [0, 1]) { hg.set(sx * 3 + dx, top, zf - 7 + dz, lin(body[0])); hg.set(sx * 4 + dx, top + 1, zf - 7 + dz, lin(body[0])); } }
  for (const x of [-1, 0, 1]) hg.set(x, top, zf - 7, lin(body[0]));
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: leaves 5 long x 3 wide x 2 thick pointing sideways and slightly down from the head's top corners.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let k = 0; k < 5; k++) for (const dz of [0, 1, 2]) for (const dy of [0, 1]) {
      if (k === 4 && (dz === 0 || dz === 2)) continue;
      const x = sx * (4 + k), y = top - 2 - Math.floor(k / 2) + dy, z = zf - 8 + dz;
      g.set(x, y, z, lin(dy === 1 && dz === 1 ? muzzle[1] : body[1]));
    }
    return part(g, [sx * 4 * S, (top - 2) * S, (zf - 7) * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 4 x 4 x 7, knee notch, hooves.
  const legSpots = [[-0.18, 0.26], [0.22, 0.26], [-0.18, -0.26], [0.22, -0.26]] as const;
  const legs = legSpots.map(([cx, cz]) => {
    const g = new Grid(S);
    leg(g, cx, cz, 4, 10, body, HOOF, { knee: true });
    hollow(g);
    return part(g, [cx, 0.38, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a line falling from the rump with a dark tuft.
  const tg = new Grid(S);
  line(tg, [0.02, 0.76, -0.40], [0.02, 0.48, -0.44], () => lin(body[2]));
  line(tg, [0.06, 0.76, -0.40], [0.06, 0.48, -0.44], () => lin(body[2]));
  box(tg, [-0.04, 0.38, -0.50], [0.08, 0.50, -0.38], () => patch, 1);
  const tail = part(tg, [0.02, 0.76, -0.40]);

  // ---- Collar and bell: a one-voxel band at the neck's base, a brass bell under the chin.
  const collar = collarRing([0.02, 0.70, 0.36], 0.13, 0.12, '#C24E45');
  const bellG = new Grid(S);
  box(bellG, [-0.06, 0.52, 0.34], [0.06, 0.64, 0.46], (_x, y) => lin(y === Math.round(0.52 / S) ? T.brass[2] : T.brass[1]));
  const bell = part(bellG, [0, 0, 0]);

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.26, zTo: 0.20, bellyY: 0.46 }, kind: 'blanket-square', knit: KNIT.cow,
    neck: { centre: [0.02, 0.70, 0.36], rx: 0.15, ry: 0.13, tails: [0.02, 0.56, 0.44] },
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 4 })),
  });
  const muzzleSig: SigPart = { ...part(new Grid(S), HEAD), name: 'muzzle', where: 'head', cells: muzzleG.map };
  const breath = breathAt([0.02, 0.56, 0.86]);
  const parts = [coats.wools[2], neck, headPart, ...eyes, ...ears, ...legs, tail, collar, bell];
  return {
    species: 'cow', bodyAlways: false, signature: [muzzleSig], height: 1.0, length: 1.3, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, neck,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell, sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, bell, muzzle: muzzleSig as CPart }),
    stats: statsOf(parts, []),
  };
}
