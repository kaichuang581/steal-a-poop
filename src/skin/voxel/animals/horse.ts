import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, Grid, line } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { barrel, breathAt, bury, cellsOf, hugCollar, hollow, leg, mouths, part, S, segment, shaded, smallEyes, solidSet, statsOf, tones, wedge } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { HOOF } from './pig';

/**
 * The horse (V5.1 Part 5.4): the tallest animal; a long barrel, a neck rising at 49 degrees from the shoulders with a
 * mane ridge along its top and a forelock, a long level wedge head with a blaze, small upright ears, long legs with
 * socks on two diagonal legs, and a long tail in the mane's colour.
 *
 * The sheet's numbers miss its own ratio table (the wedge's widths are odd, so a 6-wide head is 7): solved for the
 * table, the head is 7 wide, 8 tall and 13 long and the torso 13 wide, 14 tall and 26 long (0.52 x 0.56 x 1.04 m with its rounded ends).
 */
const TY = 11; // the torso's bottom row (y 0.44)
const HY = 26; // the head's bottom row (y 1.04)
export function horseModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const mane = tones(ch.colors.pop);
  const nose = tones(ch.colors.soft);
  const blaze = lin(body[0]);

  // ---- Torso: a barrel 0.52 x 0.56 x 0.96 (1.04 with its rounded ends), chamfer 3, rounder 1, rows 11 to 24.
  const bg = new Grid(S);
  barrel(bg, [0.02, (TY + 7) * S, 0], [0.52, 0.56, 0.96], 3, shaded(body, TY + 13, TY), 1);
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: a wedge 13 long, 7 wide at the back to 5 at the muzzle, 8 tall (rows 26 to 33), level.
  const HEAD: V3 = [0, HY * S, 0.62];
  const hg = new Grid(S);
  const zb = Math.round(0.62 / S), zf = zb + 12;
  // The blaze: two columns down the front face's upper half; the muzzle: the front three slices in the nose tone.
  const paint: Paint = (x, y, z) => {
    if (z >= zf - 2 && y <= HY + 3) return lin(nose[1]);
    if (z === zf && (x === 0 || x === -1) && y > HY + 3) return blaze;
    return shaded(body, HY + 7, HY)(x, y, z);
  };
  wedge(hg, HEAD, 0.52, 0.28, 0.20, 0.32, paint);
  for (const x of [-1, 1]) hg.set(x, HY + 2, zf, lin(nose[2])); // nostrils
  // Eyes: beady (Brian, 2026-11-07), small 2 x 2 dark eyes with a glint on the sides of the long head, one voxel proud
  // so they show from in front.
  const { eyes, lids, brows } = smallEyes(hg, HY + 4, zb + 6, ch.colors.dark, body, HEAD, { proud: true });
  // The mouth on row 27 (the second from the bottom), width 5, on the wedge's front with its corners knocked off.
  const frontAt = (x: number, y: number) => { for (let k = zf; k >= zf - 4; k--) if (hg.has(x, y, k)) return k; return zf; };
  const mouthParts = mouths([-2, HY, zf], 5, 'z', nose[2], HEAD, { front: frontAt });
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Neck: rising 49 degrees from the chest (buried three voxels) into the head's back, sections 0.28 to 0.20.
  const NECK_BASE: V3 = [0.02, 0.90, 0.40];
  const NECK_TOP: V3 = [0.02, 1.18, 0.68];
  const ng = new Grid(S);
  segment(ng, NECK_BASE, NECK_TOP, 0.28, 0.20, shaded(body, 30, 22));
  const neckSolid = solidSet(ng);
  hollow(ng);
  bury(ng, bodySolid, headSolid);
  const neck = part(ng, [0, 0, 0]);

  // ---- Mane: a ridge 2 wide x 3 tall along the neck's top from the withers to the poll, and a forelock 3 x 2 x 2.
  const mg = new Grid(S);
  const ridgeFrom: V3 = [0, NECK_BASE[1] + 0.12, NECK_BASE[2] - 0.08], ridgeTo: V3 = [0, NECK_TOP[1] + 0.10, NECK_TOP[2] - 0.04];
  for (const dx of [0, S]) for (const dy of [0, S, 2 * S]) line(mg, [ridgeFrom[0] + dx, ridgeFrom[1] + dy, ridgeFrom[2]], [ridgeTo[0] + dx, ridgeTo[1] + dy, ridgeTo[2]], () => lin(dy === 2 * S ? mane[2] : mane[1]));
  box(mg, [-0.04, (HY + 7) * S, (zb + 4) * S], [0.08, (HY + 9) * S, (zb + 6) * S], () => lin(mane[1])); // the forelock
  for (const v of [...mg.map.values()]) if (bodySolid.has(`${v.x},${v.y},${v.z}`) || headSolid.has(`${v.x},${v.y},${v.z}`)) mg.del(v.x, v.y, v.z);
  const maneSig: SigPart = { ...part(mg, [0, 0, 0]), name: 'mane', where: 'body', cells: mg.map };

  // ---- Ears: 3 wide x 4 tall x 1, upright at the crown's back corners, one pink inner column.
  const top = HY + 8;
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let k = -1; k < 4; k++) {
      const w = k < 1 ? 3 : k < 3 ? 2 : 1;
      for (let i = 0; i < w; i++) for (const dz of k < 1 ? [0, 1] : [0]) g.set(sx * (1 + i), top + k, zb + 2 + dz, lin(i === 1 && k >= 0 && k < 3 && dz === 0 ? nose[1] : body[2]));
    }
    return part(g, [sx * 2 * S, top * S, (zb + 2.5) * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: 3 x 3 x 13, a knee notch, light socks above the hoof on the front-left and back-right, hooves.
  // At the sheet's z (0.34) the barrel's chamfered ends lift the belly over the leg and it shows too long.
  const legSpots = [[-0.15, 0.24], [0.19, 0.24], [-0.15, -0.24], [0.19, -0.24]] as const;
  const legs = legSpots.map(([cx, cz], i) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 13, body, HOOF, { knee: true, oneTone: true, sock: i === 0 || i === 3 ? body[0] : undefined });
    hollow(g);
    bury(g, bodySolid);
    return part(g, [cx, 0.50, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: two voxels thick from the rump, 0.40 long, flaring three voxels at the end, in the mane's colour.
  const tg = new Grid(S);
  box(tg, [-0.02, 0.86, -0.50], [0.06, 0.94, -0.42], () => lin(mane[1])); // the root, inside the rump
  for (const dx of [0, 0.04]) for (const dy of [0, 0.04]) line(tg, [dx, 0.92 + dy, -0.50], [dx, 0.56 + dy, -0.62], () => lin(mane[1]));
  box(tg, [-0.04, 0.46, -0.66], [0.08, 0.58, -0.58], () => lin(mane[2])); // the flare, solid so every voxel joins
  const tail = part(tg, [0.02, 0.92, -0.50]);

  // ---- Collar (4.2.6): a ring round the neck's section one voxel in front of the chest.
  const collar = hugCollar(neckSolid, Math.round(0.58 / S), '#C24E45');
  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.30, zTo: 0.26, bellyY: 0.60 }, kind: 'blanket-saddle', knit: KNIT.horse,
    neck: { centre: [0.02, 1.02, 0.52], rx: 0.17, ry: 0.21, tails: [0.02, 0.84, 0.60], solid: neckSolid },
    avoid: [hg.map, ...ears.map((e) => e.cells)],
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });
  const blazeSig: SigPart = { ...part(new Grid(S), HEAD), name: 'blaze', where: 'head', cells: new Map([...hg.map].filter(([, v]) => v.c === blaze)) };
  const breath = breathAt([0.02, (HY + 1) * S, (zf + 1) * S]);
  const parts = [coats.wools[2], neck, maneSig, headPart, ...eyes, ...ears, ...legs, tail, collar];
  const sock = (l: CPart) => ({ ...l, cells: new Map([...l.cells].filter(([, v]) => v.y >= 2 && v.y < 5)) }) as CPart;
  return {
    species: 'horse', bodyAlways: false, signature: [maneSig, blazeSig], height: 1.5, length: 1.5, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment, neck, neckBase: NECK_BASE,
    head: headPart, hood: part(new Grid(S), HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: part(new Grid(S), [0, 0.8, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, mane: maneSig as CPart, blaze: blazeSig as CPart, sock0: sock(legs[0]), sock1: sock(legs[3]) }),
    stats: statsOf(parts, []),
  };
}
