import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, Grid, line } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { addCavity, barrel, breathAt, bury, cavityOf, cellsOf, hugCollar, hollow, leg, mouths, part, S, segment, shaded, sockets, smallEyes, solidSet, statsOf, tones, wedge, unshare } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { HOOF } from './pig';
import { DEFAULT_FACES } from './faces';
import type { Faces } from './faces';

/**
 * The goat (V5.1 Part 5.5): a compact barrel with a shaggy belly fringe, a neck rising 35 degrees, a level wedge head
 * with a Roman nose and a beard, two horns rising then sweeping back and out, drooping ears, a short upturned tail and
 * horizontal pupils.
 *
 * The sheet's numbers miss its own ratio table (a 7-wide head is 0.64 of an 11-wide torso, the table allows 0.58):
 * solved for the table, the torso is 13 wide, 13 tall and 20 long (0.52 x 0.52 x 0.80 m) and the head 7 wide, 7 tall
 * with its bump, and 9 long.
 */
const HORN = ['#6B5D50', '#5A4D42', '#473C33'] as const;
const TY = 9; // the torso's bottom row (y 0.36)
const HY = 21; // the head's bottom row (y 0.84)
/**
 * Face switches (plan file 03, 4.11), off until Brian ticks the goat's row on the face sheet. GOAT_MOUTH: the mouth 3
 * wide (the muzzle's width) in a tone halfway between the muzzle's and its dark, flush in the muzzle instead of a
 * near-black bar 5 wide standing one voxel proud. GOAT_HORNS: the horns drawn one row behind the ears, so their roots
 * no longer interleave with the ears' columns.
 */
export const GOAT_MOUTH = false;
export const GOAT_HORNS = false;
export function goatModel(ch: Character, faces: Faces = DEFAULT_FACES): AnimalModel {
  const flushMouth = GOAT_MOUTH || faces.has('goatMouth');
  const hornsBack = GOAT_HORNS || faces.has('goatHorns');
  const body = tones(ch.colors.body);
  const nose = tones(ch.colors.dark);

  // ---- Torso: a barrel 0.52 x 0.52 x 0.72 (0.80 with its rounded ends), chamfer 2, rows 9 to 21.
  const bg = new Grid(S);
  barrel(bg, [0.02, (TY + 6.5) * S, 0], [0.52, 0.52, 0.72], 2, shaded(body, TY + 12, TY), 1);
  const legSpots = [[-0.13, 0.20], [0.17, 0.20], [-0.13, -0.20], [0.17, -0.20]] as const;
  sockets(bg, legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })), 11, 10); // shoulders and hips over the legs (4.2.3)
  const bodySolid = solidSet(bg);
  hollow(bg);
  // The belly fringe: two-voxel drops every two voxels along both belly edges between z -0.30 and 0.30, dark tone.
  const fringeG = new Grid(S);
  for (let z = -7; z <= 7; z += 2) for (const sx of [-1, 1]) {
    let edge = 0;
    for (const v of bg.map.values()) if (v.y === TY && v.z === z && v.x * sx > edge * sx) edge = v.x;
    if (!edge) continue;
    for (let k = 1; k <= 2; k++) fringeG.set(edge, TY - k, z, lin(body[2]));
  }
  const fringe: SigPart = { ...part(fringeG, [0, 0, 0]), name: 'fringe', where: 'body', cells: fringeG.map };
  // The fringe is drawn with the body at every level, but the torso's measures (4.1) read the barrel alone.
  const shown = new Grid(S);
  for (const g of [bg, fringeG]) for (const v of g.map.values()) shown.set(v.x, v.y, v.z, v.c);
  addCavity(shown.map, cavityOf(bg.map));
  const bodyPart = { ...part(shown, [0, 0, 0]), cells: bg.map };

  // ---- Head: a wedge 9 long, 7 wide at the back to 5 at the front, 6 tall with a Roman bump (rows 21 to 27), level.
  const HEAD: V3 = [0, HY * S, 0.48];
  const hg = new Grid(S);
  const zb = Math.round(0.48 / S), zf = zb + 8;
  const paint: Paint = (x, y, z) => (z === zf && y <= HY + 2 && Math.abs(x) <= 1 ? lin(nose[1]) : shaded(body, HY + 6, HY)(x, y, z));
  wedge(hg, HEAD, 0.36, 0.28, 0.20, 0.24, paint, 1);
  // Eyes: small and simple (Brian, 2026-11-07), 2 x 2 on the sides at rows 24 and 25, the front third.
  const { eyes, lids, brows } = smallEyes(hg, HY + 3, zb + 5, ch.colors.dark, body, HEAD, { proud: true });
  // The mouth on row 22, width 5; chewing on rows 21 and 22, on the wedge's front with its corners knocked off.
  const frontAt = (x: number, y: number) => { for (let k = zf; k >= zf - 4; k--) if (hg.has(x, y, k)) return k; return zf; };
  const mouthParts = flushMouth ? flushMouths(hg, nose, HEAD, frontAt) : mouths([-2, HY, zf], 5, 'z', nose[2], HEAD, { front: frontAt });
  // Beard: 3 wide x 4 down x 2 deep under the chin at the front, dark tone.
  const beardG = new Grid(S);
  box(beardG, [-0.04, (HY - 4) * S, (zf - 2) * S], [0.08, HY * S, zf * S], () => lin(body[2]));
  const beard: SigPart = { ...part(beardG, [0, HY * S, (zf - 1) * S]), name: 'beard', where: 'head', anim: 'beard', cells: beardG.map };
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Horns: two curves 2 voxels thick from the crown's back corners, rising 0.12 then sweeping back and out.
  const crown = (HY + 6) * S; // the top of the crown's back (the bump is at the front)
  const horns = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    const dz = 0.48 - 0.46; // the sheet's head starts at z 0.46; ours at 0.48
    const pts: V3[] = [[0.06, -0.06, 0.56], [0.07, 0, 0.54], [0.09, 0.08, 0.50], [0.12, 0.12, 0.44], [0.16, 0.12, 0.36], [0.20, 0.10, 0.30]].map(([x, y, z]) => [sx * x + 0.02, crown + y, z + dz] as V3);
    for (let i = 0; i + 1 < pts.length; i++) for (const o of [[0, 0], [S, 0], [0, S], [S, S]] as const) {
      line(g, [pts[i][0] + o[0] * sx, pts[i][1], pts[i][2] + o[1]], [pts[i + 1][0] + o[0] * sx, pts[i + 1][1], pts[i + 1][2] + o[1]], () => lin(HORN[i < 2 ? 0 : i < 4 ? 1 : 2]));
    }
    // GOAT_HORNS: the root starts among the ears' columns (z zb + 1 to zb + 2) and the curve sweeps back through them;
    // moved back whole until its front row is the row behind the ears' (zb), it rises from the back of the crown.
    if (hornsBack) {
      const k = Math.max(...[...g.map.values()].map((v) => v.z)) - zb;
      const cells = [...g.map.values()];
      for (const v of cells) g.del(v.x, v.y, v.z);
      for (const v of cells) g.set(v.x, v.y, v.z - k, v.c);
    }
    return { ...part(g, HEAD), name: sx < 0 ? 'horn0' : 'horn1', where: 'head' as const, cells: g.map } as SigPart;
  });

  // ---- Neck: rising 35 degrees from the chest (buried three voxels) into the head's back, sections 0.22 to 0.18.
  const NECK_BASE: V3 = [0.02, 0.76, 0.30];
  const ng = new Grid(S);
  segment(ng, NECK_BASE, [0.02, 0.94, 0.56], 0.24, 0.20, shaded(body, HY + 2, HY - 6));
  const neckSolid = solidSet(ng);
  hollow(ng);
  bury(ng, bodySolid, headSolid);
  const neck = part(ng, [0, 0, 0]);

  // ---- Ears: flaps 5 long x 2 wide x 1 thick, drooping 30 degrees from the crown's back corners, pink inside.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    let yPrev = HY + 4;
    for (let k = 0; k < 6; k++) for (const dz of [0, 1]) {
      const x = sx * (2 + k), y = HY + 4 - Math.floor(k * 0.6);
      g.set(x, y, zb + 1 + dz, lin(dz === 1 && k > 2 ? nose[0] : body[1]));
      for (let yy = y + 1; yy <= yPrev; yy++) g.set(x, yy, zb + 1 + dz, lin(body[1])); // the step down stays face-joined
      if (k < 2) g.set(x, y + 1, zb + 1 + dz, lin(body[1])); // the root, two rows deep in the head
      if (dz === 1) yPrev = y;
    }
    return part(g, [sx * 3 * S, (HY + 4) * S, (zb + 1.5) * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 3 x 3 x 11, a knee notch, hooves; tops two voxels inside the belly.
  const legs = legSpots.map(([cx, cz]) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 11, body, HOOF, { knee: true, oneTone: true });
    hollow(g);
    bury(g, bodySolid);
    return part(g, [cx, 0.42, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a stub 2 x 2 x 3 pointing up and back from the rump.
  const tg = new Grid(S);
  box(tg, [0, 0.76, -0.42], [0.08, 0.84, -0.34], () => lin(body[2])); // the root, inside the rump
  box(tg, [0, 0.84, -0.46], [0.08, 0.96, -0.38], () => lin(body[1]));
  bury(tg, bodySolid);
  unshare(tg, bodySolid, 'cap'); // the stub's root is too small to lose a cell
  const tail = part(tg, [0.04, 0.84, -0.40]);

  // ---- Collar (4.2.6) round the neck one voxel in front of the chest; the sweater's band at the chest; the scarf above.
  const collar = hugCollar(neckSolid, 11, '#C24E45');
  const coats = coatsFor({
    body: shown.map, torso: { zFrom: -0.24, zTo: 0.22, bellyY: 0.56 }, kind: 'sweater', knit: KNIT.goat,
    neck: { centre: [0.02, 0.90, 0.48], rx: 0.15, ry: 0.17, tails: [0.02, 0.72, 0.54], solid: new Set([...neckSolid, ...headSolid]) }, // round the throat: the neck is short in z
    band: { centre: [0.02, 0.83, 0.40], rx: 0.15, ry: 0.16, solid: neckSolid },
    // Moved back, the horns' roots reach the sweater's neck: it keeps off them as it does the head and the ears.
    avoid: [hg.map, ...ears.map((e) => e.cells), ...(hornsBack ? horns.map((h) => h.cells) : [])],
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });
  const breath = breathAt([0.02, (HY + 1) * S, (zf + 1) * S]);
  const signature = [...horns, beard];
  const parts = [coats.wools[2], neck, headPart, ...eyes, ...ears, ...legs, tail, collar, ...horns, beard];
  return {
    species: 'goat', bodyAlways: false, signature, height: 1.2, length: 1.12, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment, neck, neckBase: NECK_BASE,
    head: headPart, hood: part(new Grid(S), HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: part(new Grid(S), [0, 0.7, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, horn: horns as unknown as CPart[], beard: beard as CPart, fringe: fringe as CPart }),
    stats: statsOf(parts, []),
  };
}

/**
 * GOAT_MOUTH: every mouth a plate filling the muzzle's front 3 x 3 (columns -1 to 1, rows HY to HY + 2) in place of the
 * head's own surface cells there, which are taken out: the mouth's cells in the ink, the rest of the plate in the
 * muzzle's tone. So the face stays whole whichever mouth shows (the component always shows one), nothing stands
 * proud, and no cell is in two parts. The ink is halfway between the muzzle's tone and its dark: a mouth in the
 * muzzle's own tone, flush, could not be seen.
 */
function flushMouths(hg: Grid, nose: [string, string, string], pivot: V3, frontAt: (x: number, y: number) => number) {
  const plate: V3[] = [];
  for (let x = -1; x <= 1; x++) for (let y = HY; y <= HY + 2; y++) plate.push([x, y, frontAt(x, y)]);
  const muzzle = lin(nose[1]), dark = lin(nose[2]);
  const ink = muzzle.map((c, i) => (c + dark[i]) / 2) as typeof muzzle;
  // The flat, smile, o and chewing shapes of `mouths`, 3 wide, as (column 0..2, row 0..2) on the plate.
  const ms = mouths([0, 0, 0], 3, 'z', '#000000', pivot);
  const out = {} as typeof ms;
  for (const k of Object.keys(ms) as (keyof typeof ms)[]) {
    const on = new Set([...(ms[k].cells?.values() ?? [])].map((v) => `${v.x - 1},${v.y + HY}`));
    const g = new Grid(S);
    for (const [x, y, z] of plate) g.set(x, y, z, on.has(`${x},${y}`) ? ink : muzzle);
    out[k] = part(g, pivot);
  }
  for (const [x, y, z] of plate) hg.del(x, y, z);
  return out;
}
