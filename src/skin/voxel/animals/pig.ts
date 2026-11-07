import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { box, ellipsoid, Grid, helix } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, collarRing, eyePlate, frontEye, hollow, leg, lidsAndBrows, mask, mouths, none, part, S, shaded, statsOf, tones } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';

/**
 * The pig (V5 Part 5): a smooth, low, slightly oval barrel on four short legs, a wide block head sitting right on
 * the front of the body with a round snout disc, two floppy triangular ears that fall forward over the brow, and a
 * curly tail. Faces +z like the sheep; the centre column is x = 0.
 */
export const HOOF = tones('#4A3A3A');
export function pigModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const nose = tones(ch.colors.shade); // the snout is the darker pink
  const face = body;
  const cheek = lin('#F2B6B0');

  // ---- Body: an ellipsoid 0.60 x 0.58 x 0.80 at y 0.48, a lighter belly, a shoulder bulge where the head sits.
  const bg = new Grid(S);
  ellipsoid(bg, [0, 0.48, 0], [0.30, 0.29, 0.40], shaded(body, 19, 5));
  ellipsoid(bg, [0, 0.50, 0.30], [0.17, 0.13, 0.13], shaded(body, 16, 9));
  mask(bg, [{ c: [0, 0.36, 0], r: [0.22, 0.16, 0.30] }], lin(body[0]), lin(body[1]));
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: a chamfered block 13 x 12 x 9, its front face 0.08 ahead of the body, the back third in the bulge.
  const HEAD: V3 = [0, 0.52, 0.14]; // the neck joint: the head's back-bottom
  const hg = new Grid(S);
  box(hg, [-0.26, 0.32, 0.12], [0.26, 0.80, 0.48], shaded(face, 19, 8), 2);
  const zf = 11; // the front face's voxel column (0.44..0.48)
  // Eyes on the front face, rows 3 to 7 of 12 from the top, one in from each edge, three between.
  const places = [frontEye([-6, 12, zf + 1], 5), frontEye([1, 12, zf + 1], 5)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 5, ch.colors.dark);
    return part(g, [(i === 0 ? -6 : 1) * S + 2.5 * S, 14.5 * S, (zf + 1.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 5 })), face, HEAD);
  // Snout: a chamfered disc 6 x 4 x 2 standing two voxels proud under the eyes, two nostrils.
  const sg = new Grid(S);
  const snoutPaint: Paint = (x, y, z) => ((x === -3 || x === 2) && (y === 8 || y === 11) ? null : lin(z === zf + 2 && (x === -2 || x === 1) && y === 10 ? nose[2] : nose[1]));
  box(sg, [-3 * S, 8 * S, (zf + 1) * S], [3 * S, 12 * S, (zf + 3) * S], snoutPaint);
  const snout: SigPart = { ...part(sg, HEAD), name: 'snout', where: 'head', anim: 'snout' };
  // Cheeks under the outer edge of each eye, painted on the face.
  for (const x of [-6, -5, -4, 4, 5, 6]) for (const y of [10, 11]) hg.set(x, y, zf, cheek);
  const mouthParts = mouths([-2, 8, zf], 5, 'z', nose[2], HEAD);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: triangles 4 wide at the base tapering over 4 tall, tilted forward so the tips hang over the brow.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let k = 0; k < 4; k++) {
      const w = 4 - k;
      const z = 7 + Math.round(k * 0.8);
      for (let i = 0; i < w; i++) {
        const x = sx * (3 + i);
        g.set(x, 19 + k, z - 1, lin(body[2]));
        g.set(x, 19 + k, z, lin(body[1]));
        g.set(x, 19 + k, z + 1, lin('#E9A6A0'));
      }
    }
    return part(g, [sx * 3 * S, 19 * S, 7.5 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 3 x 3 x 5, hooves two voxels.
  const legSpots = [[-0.17, 0.25], [0.17, 0.25], [-0.17, -0.25], [0.17, -0.25]] as const;
  const legs = legSpots.map(([cx, cz]) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 9, body, HOOF, { splay: 1 });
    return part(g, [cx, 0.34, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a curl at the rump, pointing up and back.
  const tg = new Grid(S);
  helix(tg, [0, 0.56, -0.36], [0, 0.6, -0.8], () => lin(body[2]), 0.03, 0.02, 1.5);
  helix(tg, [0.04, 0.56, -0.36], [0, 0.6, -0.8], () => lin(body[2]), 0.03, 0.02, 1.5);
  const tail = part(tg, [0, 0.56, -0.36]);

  // ---- Collar: a one-voxel band at the head's root, the sheep's red.
  const collar = collarRing([0, 0.66, 0.13], 0.22, 0.09, '#C24E45');

  // ---- Warmth layers.
  const coats = coatsFor({
    body: bg.map, torso: { zFrom: -0.26, zTo: 0.24, bellyY: 0.30 }, kind: 'sweater', knit: KNIT.pig,
    neck: { centre: [0, 0.50, 0.10], rx: 0.28, ry: 0.22, tails: [0, 0.40, 0.42] },
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });

  const breath = breathAt([0, 0.40, 0.56]);
  const signature = [snout];
  const parts = [coats.wools[2], headPart, ...eyes, ...ears, ...legs, tail, collar, snout];
  return {
    species: 'pig', bodyAlways: false, signature, height: 0.92, length: 0.90, drawScale: 1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells,
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: none([0, 0.44, 0.56]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, snout }),
    stats: statsOf(parts, []),
  };
}
