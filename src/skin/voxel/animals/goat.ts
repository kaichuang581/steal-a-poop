import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, Grid, line } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { barrel, breathAt, cellsOf, collarRing, eyePlate, hollow, leg, lidsAndBrows, mouths, none, part, S, segment, shaded, statsOf, tones, wedge, wrapEye } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';
import { HOOF } from './pig';

/**
 * The goat (V5 Part 8): a compact barrel with a shaggy belly fringe, a wedge head with a Roman nose and a beard, two
 * horns sweeping back and out, long droopy ears, a short upturned tail, and horizontal pupils.
 */
const HORN = ['#6B5D50', '#5A4D42', '#5A4D42'] as const;
export function goatModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const nose = tones(ch.colors.dark);

  // ---- Body: 0.50 x 0.50 x 0.72, chamfer 2, a fringe of two-voxel drops along both belly lines.
  const bg = new Grid(S);
  barrel(bg, [0.02, 0.58, 0], [0.50, 0.50, 0.72], 2, shaded(body, 20, 8), 1);
  hollow(bg);
  const fringeG = new Grid(S);
  const yb = Math.round(0.33 / S);
  for (let z = -8; z <= 8; z += 2) for (const sx of [-1, 1]) {
    // The lowest body voxel along each belly line at this slice; two drops hang under it.
    let x = sx * 5, low = -1;
    for (; Math.abs(x) >= 2; x -= sx) { for (let y = yb - 2; y <= yb + 4; y++) if (bg.has(x, y, z)) { low = y; break; } if (low >= 0) break; }
    if (low < 0) continue;
    for (let k = 1; k <= 2; k++) { fringeG.set(x, low - k, z, lin(body[2])); bg.set(x, low - k, z, lin(body[2])); }
  }
  const bodyPart = part(bg, [0, 0, 0]);
  const fringe: SigPart = { ...part(fringeG, [0, 0, 0]), name: 'fringe', where: 'body', cells: fringeG.map };

  // ---- Neck: 0.24 long at 35 degrees up; the head carried high.
  const ng = new Grid(S);
  segment(ng, [0.02, 0.72, 0.28], [0.02, 0.86, 0.46], 0.22, 0.20, shaded(body, 22, 16));
  const neck = part(ng, [0, 0, 0]);

  // ---- Head: a wedge 0.40 long, 0.28 wide at the back to 0.18, 0.30 tall, with a Roman bump; level.
  const HEAD: V3 = [0, 0.78, 0.42];
  const hg = new Grid(S);
  wedge(hg, [0, 0.78, 0.42], 0.40, 0.28, 0.18, 0.30, shaded(body, 26, 19), 1);
  const zf = Math.round(0.42 / S) + Math.round(0.40 / S) - 1;
  for (const x of [-1, 0]) for (let y = Math.round(0.78 / S) + 1; y <= Math.round(0.78 / S) + 2; y++) hg.set(x, y, zf, lin(nose[1]));
  const eyeY = Math.round(0.78 / S) + 2;
  const places = [wrapEye(hg, -1, eyeY, zf, 5), wrapEye(hg, 1, eyeY, zf, 5)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 'goat', ch.colors.dark);
    const [x, y, z] = place(2, 2, 1);
    return part(g, [(x + 0.5 + (i === 0 ? -0.5 : 0.5)) * S, (y + 0.5) * S, (z + 0.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 5 })), body, HEAD);
  const mouthParts = mouths([-2, Math.round(0.78 / S), zf], 5, 'z', nose[2], HEAD);
  // Beard under the chin, 3 wide x 4 long x 2 deep.
  const beardG = new Grid(S);
  box(beardG, [-0.06, 0.64, (zf - 3) * S], [0.06, 0.80, (zf - 1) * S], () => lin(body[2]));
  const beard: SigPart = { ...part(beardG, HEAD), name: 'beard', where: 'head', anim: 'beard', cells: beardG.map };
  // Horns: two paths of six segments, two voxels thick, rising from the crown then curving back and out.
  const top = Math.round(0.78 / S) + Math.round(0.30 / S);
  const horns = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    const pts: V3[] = [[sx * 0.06, top * S - 0.02, (zf - 8) * S], [sx * 0.07, top * S + 0.06, (zf - 8.5) * S], [sx * 0.09, top * S + 0.11, (zf - 9.5) * S], [sx * 0.12, top * S + 0.14, (zf - 11) * S], [sx * 0.15, top * S + 0.15, (zf - 12.5) * S], [sx * 0.18, top * S + 0.14, (zf - 14) * S]];
    for (let i = 0; i + 1 < pts.length; i++) for (const o of [[0, 0, 0], [S, 0, 0], [0, 0, S], [S, 0, S]] as const) line(g, [pts[i][0] + o[0], pts[i][1], pts[i][2] + o[2]], [pts[i + 1][0] + o[0], pts[i + 1][1], pts[i + 1][2] + o[2]], () => lin(HORN[i < 2 ? 0 : i < 4 ? 1 : 2]));
    return { ...part(g, HEAD), name: sx < 0 ? 'horn0' : 'horn1', where: 'head' as const, cells: g.map } as SigPart;
  });
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: flaps 5 long x 2 wide x 2 thick drooping 30 degrees below horizontal.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let k = 0; k < 5; k++) for (const dz of [0, 1]) for (const dy of [0, 1]) g.set(sx * (3 + k), top - 3 - Math.floor(k * 0.6) + dy, zf - 9 + dz, lin(dz === 1 && dy === 0 ? nose[1] : body[1]));
    return part(g, [sx * 3 * S, (top - 3) * S, (zf - 8.5) * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 3 x 3 x 7.
  const legSpots = [[-0.14, 0.24], [0.18, 0.24], [-0.14, -0.24], [0.18, -0.24]] as const;
  const legs = legSpots.map(([cx, cz]) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 10, body, HOOF, { knee: true });
    hollow(g);
    return part(g, [cx, 0.38, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a stub pointing up and back.
  const tg = new Grid(S);
  box(tg, [-0.02, 0.72, -0.42], [0.06, 0.80, -0.30], () => lin(body[2])); // the base reaches into the rump
  box(tg, [-0.02, 0.80, -0.46], [0.06, 0.88, -0.38], () => lin(body[1]));
  const tail = part(tg, [0.02, 0.78, -0.36]);

  const collar = collarRing([0.02, 0.80, 0.34], 0.12, 0.11, '#C24E45');
  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.24, zTo: 0.20, bellyY: 0.40 }, kind: 'sweater', knit: KNIT.goat,
    neck: { centre: [0.02, 0.80, 0.34], rx: 0.13, ry: 0.12, tails: [0.02, 0.66, 0.42] },
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });
  const breath = breathAt([0.02, 0.82, 0.86]);
  const signature = [...horns, beard];
  const parts = [coats.wools[2], neck, headPart, ...eyes, ...ears, ...legs, tail, collar, ...horns, beard, fringe];
  return {
    species: 'goat', bodyAlways: false, signature, height: 1.06, length: 1.1, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, neck,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: none([0, 0.7, 0.4]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, horn: horns as unknown as CPart[], beard: beard as CPart, fringe: fringe as CPart }),
    stats: statsOf(parts, []),
  };
}
