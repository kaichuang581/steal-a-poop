import type { Character } from '../../avatars/catalog';
import { lin, T } from '../palette';
import { box, ellipsoid, Grid, helix } from '../primitives';
import type { Paint, V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, cellsOf, hugCollar, eyePlate, frontEye, hollow, leg, lidsAndBrows, mask, mouths, part, S, shaded, solidSet, statsOf, tones } from './rig';
import type { AnimalModel, CPart, SigPart } from './rig';

/**
 * The pig (V5.1 Part 5.2): a low oval barrel with a shoulder and a hip bulge, a square block head whose back sits in
 * the shoulder bulge, a snout disc, floppy ears folding forward beside the eyes, and a curly tail. Faces +z; the
 * centre column is x = 0.
 *
 * Where this differs from the sheet's letter: the torso is one row taller and the head two rows higher (rows 8 to 18):
 * with the sheet's torso the bulges make it 1.69 long for its height (the sheet asks 1.40 to 1.55), and at rows 6 to 16
 * the head's top is 0.94 of the back line (the sheet asks 0.95 or more); the legs stand a voxel nearer the middle, where the belly
 * is low enough to leave the visible leg inside the sheet's 0.30 to 0.45; and there is no separate neck wedge, because
 * at the sheet's z the head and the shoulder bulge already overlap by four voxels, so a wedge between them is hidden.
 */
export const HOOF = tones('#4A3A3A');
const Y0 = 8; // the head's bottom row
export function pigModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);
  const nose = tones(ch.colors.shade); // the snout is the darker pink
  const face = body;
  const cheek = lin(T.pink[1]);

  // ---- Torso: an ellipsoid 0.58 x 0.54 x 0.80, a shoulder and a hip bulge, a lighter belly.
  const bg = new Grid(S);
  const paint = shaded(body, 18, 5);
  ellipsoid(bg, [0, 0.48, 0.02], [0.29, 0.28, 0.38], paint);
  ellipsoid(bg, [0, 0.50, 0.30], [0.26, 0.22, 0.18], paint);
  ellipsoid(bg, [0, 0.52, -0.26], [0.25, 0.22, 0.10], paint);
  mask(bg, [{ c: [0, 0.30, 0], r: [0.22, 0.12, 0.30] }], lin(body[0]), lin(body[1]));
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Head: a box 11 x 11 x 9, chamfer 2, rows 8 to 18, z 8 to 16; the back 0.16 inside the shoulder bulge.
  const HEAD: V3 = [0, Y0 * S + 0.2, 0.34]; // the neck joint: the head's back, at its middle
  const hg = new Grid(S);
  box(hg, [-0.22, Y0 * S, 0.30], [0.22, (Y0 + 11) * S, 0.66], shaded(face, Y0 + 10, Y0), 2);
  const zf = 16; // the front face's voxel column (0.64..0.68)
  // Eyes: 4 x 4 front plates, rows 14 to 17, columns -5..-2 and 2..5.
  const places = [frontEye([-5, Y0 + 6, zf + 1], 4), frontEye([2, Y0 + 6, zf + 1], 4)];
  const eyes = places.map((place, i) => {
    const g = new Grid(S);
    eyePlate(g, place, 4, ch.colors.dark);
    return part(g, [((i === 0 ? -5 : 2) + 2) * S, (Y0 + 8) * S, (zf + 1.5) * S]);
  }) as unknown as [CPart, CPart];
  const { lids, brows } = lidsAndBrows(places.map((place) => ({ place, n: 4 })), face, HEAD, hg);
  // Snout: a disc 6 wide x 4 tall x 2 proud at rows 10 to 13, x -3..2, its corners knocked off; nostrils at row 12.
  const sg = new Grid(S);
  const snoutPaint: Paint = (x, y, z) => ((x === -3 || x === 2) && (y === Y0 + 2 || y === Y0 + 5) ? null : lin(z === zf + 2 && (x === -2 || x === 1) && y === Y0 + 4 ? nose[2] : nose[1]));
  box(sg, [-3 * S, (Y0 + 2) * S, (zf + 1) * S], [3 * S, (Y0 + 6) * S, (zf + 3) * S], snoutPaint);
  const snout: SigPart = { ...part(sg, HEAD), name: 'snout', where: 'head', anim: 'snout', cells: sg.map };
  // Cheeks: 2 x 2 under the outer eye columns at rows 12 and 13, painted on the face.
  for (const x of [-5, -4, 4, 5]) for (const y of [Y0 + 4, Y0 + 5]) if (hg.has(x, y, zf)) hg.set(x, y, zf, cheek);
  // The mouth on row 9 (the second from the bottom), width 5, under the snout, on the chamfered chin's own front.
  const frontAt = (x: number, y: number) => { let z = -99; for (let k = zf; k >= zf - 4; k--) if (hg.has(x, y, k)) { z = k; break; } return z === -99 ? zf : z; };
  const mouthParts = mouths([-2, Y0, zf], 5, 'z', nose[2], HEAD, { front: frontAt });
  const headSolid = solidSet(hg);
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Ears: triangles 5 wide at the root tapering to 1, one thick, rooted in the head's top corners (x 3..7,
  // rows 17 and 18, z 10 and 11), folding forward and down so the tips hang at row 14 just ahead of the face, outside
  // the eyes; the middle of each flap pink.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (const y of [Y0 + 9, Y0 + 10]) for (let x = 3; x <= 6; x++) for (const z of [10, 11]) g.set(sx * x, y, z, lin(body[1]));
    let zPrev = 11;
    for (let k = 1; k <= 4; k++) {
      const w = 5 - k, y = Y0 + 10 - k, xc = 5 + k * 0.5;
      const z = 11 + Math.round(k * 1.5);
      for (let i = 0; i < w; i++) {
        const x = Math.round(xc - w / 2 + i + 0.5);
        const inner = i > 0 && i < w - 1;
        for (let zz = zPrev; zz <= z; zz++) g.set(sx * x, y, zz, lin(inner ? T.pink[1] : body[1]));
      }
      zPrev = z;
    }
    return part(g, [sx * 4 * S, (Y0 + 10) * S, 10.5 * S]);
  }) as unknown as [CPart, CPart];

  // ---- Legs: four, 3 x 3 x 8 with splayed hooves, their tops inside the belly.
  const legSpots = [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]] as const;
  const legs = legSpots.map(([cx, cz]) => {
    const g = new Grid(S);
    leg(g, cx, cz, 3, 8, body, HOOF, { splay: 1 });
    return part(g, [cx, 0.30, cz]);
  }) as unknown as [CPart, CPart, CPart, CPart];

  // ---- Tail: a curl two voxels thick at the rump, pointing up and back.
  const tg = new Grid(S);
  box(tg, [-0.04, 0.48, -0.40], [0.04, 0.56, -0.32], () => lin(body[2])); // the root, inside the rump
  helix(tg, [0, 0.56, -0.38], [0, 0.6, -0.8], () => lin(body[2]), 0.03, 0.02, 1.5);
  helix(tg, [0.04, 0.56, -0.38], [0, 0.6, -0.8], () => lin(body[2]), 0.03, 0.02, 1.5);
  const tail = part(tg, [0, 0.56, -0.38]);

  // ---- Collar: one voxel round the head's back where it leaves the shoulder bulge (4.2.6).
  // It runs over the top and down the sides to the jaw: the head's underside is the chin, not a neck.
  const collar = hugCollar(headSolid, 13, '#C24E45', (_x, y) => y >= Y0 + 3);

  // ---- Warmth layers (4.5): a sweater from behind the shoulders to before the hips, a band at the neck.
  const coats = coatsFor({
    // The belly line at 0.40, not the sheet's 0.34: 4.5 leaves a third of the torso bare, and 0.34 leaves 0.29.
    body: bg.map, torso: { zFrom: -0.22, zTo: 0.22, bellyY: 0.40 }, kind: 'sweater', knit: KNIT.pig,
    // The sheet's neck centre (0, 0.56, 0.36) lies inside the head, so the band, the collar and the scarf ring the
    // head's back in that order, one slice apart, where it leaves the shoulder bulge.
    neck: { centre: [0, Y0 * S + 0.22, 0.58], rx: 0.27, ry: 0.26, tails: [0, Y0 * S - 0.02, 0.64], solid: headSolid },
    band: { centre: [0, Y0 * S + 0.22, 0.46], rx: 0.27, ry: 0.25, solid: headSolid },
    avoid: [hg.map, ...ears.map((e) => e.cells)],
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 3 })),
  });

  const breath = breathAt([0, Y0 * S + 0.16, 0.74]);
  const signature = [snout];
  const parts = [coats.wools[2], headPart, ...eyes, ...ears, ...legs, tail, collar, snout];
  return {
    species: 'pig', bodyAlways: false, signature, height: 0.78, length: 1.06, drawScale: 1, headPitch: 0.14,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment,
    head: headPart, hood: part(new Grid(S), HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears, legs, collar, bell: part(new Grid(S), [0, 0.44, 0.56]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, head: headPart, eye: [...eyes], ear: [...ears], leg: [...legs], tail, collar, snout }),
    stats: statsOf(parts, []),
  };
}
