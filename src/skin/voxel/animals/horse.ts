import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, Grid, line } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { barrel, breathAt, cellsOf, collarRing, eyePlate, hollow, leg, lidsAndBrows, mouths, none, part, S, segment, shaded, statsOf, tones, wedge, wrapEye } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { HOOF } from './pig';

/**
 * The horse (V5 Part 7): the tallest animal; a smooth barrel, an arched neck rising from the shoulders with a mane
 * along it, a long wedge head with a blaze, small upright ears, long legs with socks on two diagonal legs, and a
 * long tail in the mane's colour.
 */
export function horseModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const mane = tones(ch.colors.pop);
  const nose = tones(ch.colors.soft);
  const blaze = lin(body[0]);

  // ---- Body: 0.52 x 0.56 x 0.84, chamfer 3, at y 0.64.
  const bg = new Grid(S);
  barrel(bg, [0.02, 0.64, 0], [0.50, 0.52, 0.78], 3, shaded(body, 22, 10), 1);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Neck: rising at 50 degrees from the shoulders, with the mane ridge along its top.
  const ng = new Grid(S);
  segment(ng, [0.02, 0.78, 0.28], [0.02, 1.02, 0.52], 0.28, 0.22, shaded(body, 26, 18));
  const neck = part(ng, [0, 0, 0]);
  const mg = new Grid(S);
  line(mg, [0, 0.94, 0.26], [0, 1.18, 0.52], () => lin(mane[1]));
  line(mg, [0.04, 0.94, 0.26], [0.04, 1.18, 0.52], () => lin(mane[1]));
  line(mg, [0, 0.98, 0.26], [0, 1.22, 0.52], () => lin(mane[2]));
  line(mg, [0.04, 0.98, 0.26], [0.04, 1.22, 0.52], () => lin(mane[2]));
  box(mg, [-0.04, 1.14, 0.52], [0.08, 1.22, 0.60], () => lin(mane[1])); // the forelock between the ears
  const maneSig: SigPart = { ...part(mg, [0, 0, 0]), name: 'mane', where: 'body' };

  // ---- Head: a wedge 0.44 long from 0.28 wide to 0.20 at the muzzle, 0.30 tall, level at the neck's top.
  const HEAD: V3 = [0, 0.90, 0.50];
  const hg = new Grid(S);
  const paint: Paint = (x, y, z) => (Math.abs(x) <= 0 && y >= Math.round(0.96 / S) && z > Math.round(0.50 / S) + 3 ? blaze : shaded(body, 29, 22)(x, y, z));
  wedge(hg, [0, 0.90, 0.50], 0.44, 0.28, 0.20, 0.30, paint);
  const zf = Math.round(0.50 / S) + Math.round(0.44 / S) - 1;
  // The blaze down the face's front and over the muzzle, the muzzle in the nose tone, nostrils, a mouth.
  for (let y = Math.round(0.90 / S); y < Math.round(1.20 / S); y++) for (const x of [0]) if (hg.has(x, y, zf)) hg.set(x, y, zf, blaze);
  for (let z = zf - 2; z <= zf; z++) for (let x = -2; x <= 2; x++) for (let y = Math.round(0.90 / S); y < Math.round(0.90 / S) + 4; y++) if (hg.has(x, y, z) && z === zf) hg.set(x, y, z, lin(nose[1]));
  for (const x of [-1, 1]) hg.set(x, Math.round(0.90 / S) + 2, zf, lin(nose[2]));
  const eyeY = Math.round(0.90 / S) + 1;
  const places = [wrapEye(hg, -1, eyeY, zf, 5), wrapEye(hg, 1, eyeY, zf, 5)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 5, ch.colors.dark);
    const [x, y, z] = place(2, 2, 1);
    return part(g, [(x + 0.5 + (i === 0 ? -0.5 : 0.5)) * S, (y + 0.5) * S, (z + 0.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 5 })), body, HEAD);
  const mouthParts = mouths([-2, Math.round(0.90 / S), zf], 5, 'z', nose[2], HEAD);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: upright triangles 3 wide x 4 tall x 2 thick on the crown, turned out a little.
  const top = Math.round(0.90 / S) + Math.round(0.30 / S);
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let k = 0; k < 4; k++) { const w = Math.max(1, 3 - k); for (let i = 0; i < w; i++) for (const dz of [0, 1]) g.set(sx * (1 + i) + (sx < 0 ? -0 : 0), top + k, zf - 9 + dz, lin(dz === 1 && k < 3 ? '#C9908A' : body[2])); }
    return part(g, [sx * 2 * S, top * S, (zf - 8.5) * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 3 x 3 x 9, socks on the front-left and back-right, hooves.
  const legSpots = [[-0.16, 0.28], [0.20, 0.28], [-0.16, -0.28], [0.20, -0.28]] as const;
  const legs = legSpots.map(([cx, cz], i) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 12, body, HOOF, { knee: true, sock: i === 0 || i === 3 ? body[0] : undefined });
    hollow(g);
    return part(g, [cx, 0.46, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: two voxels thick falling from the rump with a flare at the end, the mane's colour.
  const tg = new Grid(S);
  for (const dx of [0, 0.04]) line(tg, [dx, 0.82, -0.40], [dx, 0.50, -0.50], () => lin(mane[1]));
  box(tg, [-0.04, 0.44, -0.56], [0.08, 0.54, -0.46], () => lin(mane[2]), 1);
  const tail = part(tg, [0.02, 0.82, -0.40]);

  const collar = collarRing([0.02, 0.84, 0.30], 0.15, 0.13, '#C24E45');
  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.28, zTo: 0.20, bellyY: 0.50 }, kind: 'blanket-saddle', knit: KNIT.horse,
    neck: { centre: [0.02, 0.86, 0.32], rx: 0.16, ry: 0.14, tails: [0.02, 0.72, 0.40] },
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });
  const blazeSig: SigPart = { ...part(new Grid(S), HEAD), name: 'blaze', where: 'head', cells: new Map([...hg.map].filter(([, v]) => v.c === blaze)) };
  const breath = breathAt([0.02, 0.94, 0.96]);
  const parts = [coats.wools[2], neck, maneSig, headPart, ...eyes, ...ears, ...legs, tail, collar];
  return {
    species: 'horse', bodyAlways: false, signature: [maneSig, blazeSig], height: 1.2, length: 1.1, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, neck,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: none([0, 0.8, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, mane: maneSig as CPart, blaze: blazeSig as CPart, sock0: { ...legs[0], cells: new Map([...legs[0].cells].filter(([, v]) => v.y >= 2 && v.y < 5)) } as CPart, sock1: { ...legs[3], cells: new Map([...legs[3].cells].filter(([, v]) => v.y >= 2 && v.y < 5)) } as CPart }),
    stats: statsOf(parts, []),
  };
}
