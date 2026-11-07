import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, ellipsoid, Grid, line } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, eyePlate, hollow, leg, lidsAndBrows, mouths, none, part, S, statsOf, tones, wrapEye } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';

/**
 * The chicken (V5 Part 9): an egg on two thin legs, a small ball head on a short neck, a tiny horizontal beak, a
 * three-bump comb, a wattle, two flat wings against the flanks, and a fan tail rising at the back. Drawn at 1.15 at
 * the table so it keeps presence beside the others.
 */
const COMB = ['#C24E45', '#B5443C', '#B5443C'] as const;
const BEAK = ['#E8A43A', '#D4922E', '#D4922E'] as const;
export function chickenModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);

  // ---- Body: an egg, its back lifted (the tilt), on the 0.04 m grid.
  const bg = new Grid(S);
  ellipsoid(bg, [0.02, 0.42, 0], [0.22, 0.24, 0.28], (_x, y) => lin(y > Math.round(0.56 / S) ? body[0] : body[1]));
  ellipsoid(bg, [0.02, 0.50, -0.14], [0.16, 0.16, 0.16], () => lin(body[1])); // the lifted back
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);
  // Wings: flat ellipsoids on the flanks in the dark tone with a light edge.
  const wings = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    ellipsoid(g, [sx * 0.22 + 0.02, 0.44, -0.02], [0.04, 0.09, 0.13], (_x, y, z) => lin(Math.abs(y - Math.round(0.44 / S)) >= 2 || Math.abs(z) >= 3 ? body[0] : body[2]));
    return { ...part(g, [sx * 0.22, 0.52, 0.06]), name: sx < 0 ? 'wingL' : 'wingR', where: 'body' as const, anim: sx < 0 ? ('wingL' as const) : ('wingR' as const), cells: g.map } as SigPart;
  });
  // Tail: a fan of five slabs rising at 45 degrees, spreading.
  const tailG = new Grid(S);
  for (let i = 0; i < 5; i++) {
    const a = ((i - 2) / 2) * 0.26;
    line(tailG, [0.02 + Math.sin(a) * 0.04, 0.54, -0.24], [0.02 + Math.sin(a) * 0.16, 0.74, -0.40 + Math.abs(a) * 0.1], () => lin(body[2]));
    line(tailG, [0.06 + Math.sin(a) * 0.04, 0.54, -0.24], [0.06 + Math.sin(a) * 0.16, 0.74, -0.40 + Math.abs(a) * 0.1], () => lin(body[2]));
  }
  const tail = part(tailG, [0.02, 0.54, -0.24]);

  // ---- Neck and head: a short box up from the body's front top, a ball of radius 0.16 at y 0.72.
  const ng = new Grid(S);
  box(ng, [-0.04, 0.54, 0.10], [0.08, 0.66, 0.22], () => lin(body[1]));
  const neck = part(ng, [0, 0, 0]);
  const HEAD: V3 = [0, 0.60, 0.12];
  const hg = new Grid(S);
  ellipsoid(hg, [0.02, 0.72, 0.16], [0.16, 0.16, 0.16], (_x, y) => lin(y > Math.round(0.78 / S) ? body[0] : body[1]));
  // Beak: a small horizontal taper at the front, lower half.
  const zf = Math.round(0.16 / S) + 4;
  const beakG = new Grid(S);
  for (let k = 0; k < 3; k++) for (let x = -1 + (k > 1 ? 1 : 0); x <= 0 - (k > 1 ? 0 : 0); x++) for (let y = 0; y < 2 - (k > 1 ? 1 : 0); y++) beakG.set(x, Math.round(0.68 / S) + y, zf + 1 + k, lin(BEAK[k === 0 ? 0 : 1]));
  const beak: SigPart = { ...part(beakG, HEAD), name: 'beak', where: 'head', cells: beakG.map };
  // Comb: three 2 x 2 x 2 bumps along the crown; a wattle under the beak.
  const combG = new Grid(S);
  const crown = Math.round(0.88 / S);
  for (let i = 0; i < 3; i++) for (const dx of [-1, 0]) for (const dy of [0, 1]) for (const dz of [0, 1]) combG.set(dx, crown - 1 + dy + (i === 1 ? 1 : 0), zf - 4 - i * 2 + dz, lin(COMB[dy === 0 ? 1 : 0]));
  for (const dx of [-1, 0]) for (let dy = 0; dy < 3; dy++) combG.set(dx, Math.round(0.68 / S) - 1 - dy, zf, lin(COMB[dy === 2 ? 2 : 1]));
  const comb: SigPart = { ...part(combG, HEAD), name: 'comb', where: 'head', anim: 'comb', cells: combG.map };
  // Eyes: 4 x 4, on the sides at the front, one column wrapping onto the front.
  const eyeY = Math.round(0.70 / S);
  const places = [wrapEye(hg, -1, eyeY, zf, 4), wrapEye(hg, 1, eyeY, zf, 4)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 4, ch.colors.dark);
    const [x, y, z] = place(2, 2, 1);
    return part(g, [(x + 0.5 + (i === 0 ? -0.5 : 0.5)) * S, (y + 0.5) * S, (z + 0.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 4 })), body, HEAD);
  const mouthParts = mouths([-1, Math.round(0.66 / S), zf + 2], 2, 'z', BEAK[2], HEAD);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Legs: two, 2 x 2 x 6 in the beak tone, three toes forward and one back.
  const legSpots = [[-0.04, 0.02], [0.08, 0.02]] as const;
  const legs = [
    ...legSpots.map(([cx, cz]) => { const g = new Grid(S); leg(g, cx, cz, 2, 7, tones(BEAK[1]), tones(BEAK[2]), { toes: true }); return part(g, [cx, 0.26, cz]); }),
    none([-0.06, 0.26, -0.1]), none([0.1, 0.26, -0.1]),
  ] as unknown as [CPart, CPart, CPart, CPart];

  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.14, zTo: 0.10, bellyY: 0.36 }, kind: 'vest', knit: KNIT.chicken,
    neck: { centre: [0.02, 0.60, 0.16], rx: 0.09, ry: 0.07, tails: [0.02, 0.52, 0.24] },
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 2 })),
  });
  const breath = breathAt([0.02, 0.70, 0.40]);
  const signature = [comb, beak, ...wings];
  const parts = [coats.wools[2], neck, headPart, ...eyes, ...legs, tail, comb, beak, ...wings];
  return {
    species: 'chicken', bodyAlways: false, signature: signature.slice(0, 3), height: 0.94, length: 0.8, drawScale: 1.15,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, neck,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears: [none(HEAD), none(HEAD)], legs, collar: none(), bell: none([0, 0.6, 0.3]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], leg: [legs[0], legs[1]], tail, collar: none(), comb: comb as CPart, beak: beak as CPart, wing: wings as unknown as CPart[] }),
    stats: statsOf(parts, []),
  };
}
