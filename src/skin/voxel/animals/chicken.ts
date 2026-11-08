import type { Character } from '../../avatars/catalog';
import { lin } from '../palette';
import { ellipsoid, Grid, line } from '../primitives';
import type { V3 } from '../primitives';
import { coatsFor, KNIT } from './garments';
import { breathAt, bury, cellsOf, hollow, leg, mouths, none, part, S, segment, smallEyes, solidSet, statsOf, tones } from './rig';
import type { AnimalModel, CPart, SigPart, Tones } from './rig';

/**
 * The chicken (V5.1 Part 5.6, rebuilt): a horizontal, plump body whose breast sits low and forward and whose rump rises
 * toward a raised fan tail; the head a ball on a short neck, ahead of the breast; a horizontal beak with a wattle; a
 * three-bump comb; big teardrop wings over the flanks; two thin legs with toes. Drawn at 1.1 at the table.
 *
 * Where this differs from the sheet's letter: the head's centre is at z 0.34, ahead of the breast as 5.6 asks, but
 * nearer it than the sheet's 0.14 (Brian, 2026-11-07: the neck was reaching out too far); the beak is a two-step wedge
 * (the sheet's 0.08 long), so its ratios in 4.1 are the chicken's own (measure.ts). The torso is 9 rows, not 10 (0.20 to 0.56): with a 7-wide head and the odd widths of a body centred
 * on a cell, only a 9-row torso meets the head, width and leg ratios together; the head and the wings sit a row lower. The beak is drawn with the head (its cells are kept for the tests), so the comb and both wings fit
 * the three signature slots: v5 sliced the list to three and dropped the right wing.
 */
const COMB = ['#C24E45', '#B5443C'] as const;
const BEAK = ['#E8A43A', '#D4922E'] as const;
const HC: V3 = [0.02, 0.58, 0.34]; // the head ball's centre, on a cell's centre so the ball is 7 across every way
export function chickenModel(ch: Character): AnimalModel {
  const body = tones(ch.colors.body);

  // ---- Torso: three ellipsoids, the breast low and forward, the rump high and back; a top line sloping to the tail.
  const bg = new Grid(S);
  const paint = (_x: number, y: number) => lin(y >= 12 ? body[0] : y <= 6 ? body[2] : body[1]);
  ellipsoid(bg, [0.02, 0.38, 0], [0.19, 0.16, 0.26], paint);
  ellipsoid(bg, [0.02, 0.34, 0.16], [0.16, 0.14, 0.14], paint);
  ellipsoid(bg, [0.02, 0.46, -0.16], [0.14, 0.10, 0.12], paint);
  const bodySolid = solidSet(bg);
  hollow(bg);
  const bodyPart = part(bg, [0, 0, 0]);

  // ---- Wings: shells one voxel proud of the flanks between z -0.16 and 0.12, y 0.28 to 0.48, trimmed to a teardrop
  // pointing back (the top line falls two rows toward the back, the bottom rises to meet it); dark, a light edge.
  const z0 = Math.round(-0.16 / S), z1 = Math.round(0.12 / S);
  const wings = ([-1, 1] as const).map((sx) => {
    const g = new Grid(S);
    for (let z = z0; z <= z1; z++) {
      const t = (z1 - z) / (z1 - z0); // 0 at the front, 1 at the back
      const top = Math.round(0.48 / S) - Math.round(2 * t), bottom = Math.round(0.28 / S) + Math.round(3 * t * t);
      for (let y = bottom; y <= top; y++) {
        let edge = 0;
        for (const v of bodySolid) { const [x, yy, zz] = v.split(',').map(Number); if (yy === y && zz === z && x * sx > edge * sx) edge = x; }
        if (!edge) continue;
        const rim = y === bottom || z === z0 || (t > 0.5 && y === top);
        g.set(edge + sx, y, z, lin(rim ? body[0] : body[2]));
      }
    }
    return { ...part(g, [sx * 0.2 + 0.02, 0.46, 0.08]), name: sx < 0 ? 'wingL' : 'wingR', where: 'body' as const, anim: sx < 0 ? ('wingL' as const) : ('wingR' as const), cells: g.map } as SigPart;
  });

  // ---- Tail: five slabs 2 voxels wide from the rump up to (0.02, 0.84, -0.46), fanned +-0.26 rad; dark, light tips.
  const tailG = new Grid(S);
  for (let i = 0; i < 5; i++) {
    const a = ((i - 2) / 2) * 0.26;
    const from: V3 = [0.02 + Math.sin(a) * 0.04, 0.50, -0.24], to: V3 = [0.02 + Math.sin(a) * 0.22, 0.84 - Math.abs(a) * 0.12, -0.46 + Math.abs(a) * 0.06];
    const tipY = Math.round(to[1] / S);
    for (const dx of [0, S]) for (const dy of [0, S]) line(tailG, [from[0] + dx, from[1] + dy, from[2]], [to[0] + dx, to[1] + dy, to[2]], (_x, y) => lin(y >= tipY ? body[0] : body[2]));
  }
  const tail = part(tailG, [0.02, 0.50, -0.24]);

  // ---- Head: a ball 7 across centred at (0.02, 0.58, 0.34), rows 11 to 17, resting on the breast with a short neck
  // still reaching forward (Brian, 2026-11-07: "less protruding"); the beak and the wattle drawn with it.
  const HEAD: V3 = [0.02, 0.48, 0.26]; // the neck joint
  const hg = new Grid(S);
  ellipsoid(hg, HC, [0.14, 0.14, 0.14], (_x, y) => lin(y >= 17 ? body[0] : body[1]));
  const headCells = solidSet(hg);
  const frontAt = (x: number, y: number) => { let z = -99; for (const k of headCells) { const [xx, yy, zz] = k.split(',').map(Number); if (xx === x && yy === y && zz > z) z = zz; } return z; };
  const zf = frontAt(0, 14);
  // Eyes: small and simple (Brian, 2026-11-07), 2 x 2 on the ball's sides at rows 15 and 16, near the front.
  const { eyes, lids, brows } = smallEyes(hg, 15, zf - 1, ch.colors.dark, body, HEAD);
  // Beak: a two-step wedge, so it reads from the side: 3 wide x 2 tall one voxel proud of the face at rows 13 and 14
  // (the upper row lighter, the lower mandible darker), then the tip a second voxel out on the upper row.
  const beakG = new Grid(S);
  for (const x of [-1, 0, 1]) for (const y of [13, 14]) beakG.set(x, y, frontAt(x, y) + 1, lin(y === 14 ? BEAK[0] : BEAK[1]));
  beakG.set(0, 14, frontAt(0, 14) + 2, lin(BEAK[0]));
  // The wattle: a small lobe 2 wide x 2 tall under the chin, below the open beak's voxel (row 12), rooted in the ball's
  // lowest row.
  const wattle = new Grid(S);
  for (const x of [-1, 0]) {
    const z = frontAt(x, 11);
    for (const y of [10, 11]) wattle.set(x, y, z + 1, lin(COMB[1]));
    wattle.set(x, 11, z, lin(COMB[1]));
  }
  for (const g of [beakG, wattle]) for (const v of g.map.values()) hg.set(v.x, v.y, v.z, v.c);
  // Comb: three 2 x 2 x 2 bumps along the crown at rows 18 and 19, the middle one a voxel taller.
  const combG = new Grid(S);
  for (let i = 0; i < 3; i++) for (const dx of [-1, 0]) for (let dy = 0; dy < (i === 1 ? 3 : 2); dy++) for (const dz of [0, 1]) combG.set(dx, 18 + dy, 6 + i * 2 + dz, lin(COMB[dy === 0 ? 1 : 0]));
  // Each column reaches down at most one row to sit on the crown (its root is that whole seat; a root sunk into the
  // ball would share the ball's surface faces and flicker). A column over the ball's front or back, where the crown has
  // curved further away, is left out, so the comb stays on the crown.
  for (const v of [...combG.map.values()]) if (v.y === 18) {
    let y = 17;
    while (y > 16 && !headCells.has(`${v.x},${y},${v.z}`)) y--;
    if (!headCells.has(`${v.x},${y},${v.z}`)) { for (const w of [...combG.map.values()]) if (w.x === v.x && w.z === v.z) combG.del(w.x, w.y, w.z); continue; }
    for (let yy = y + 1; yy < 18; yy++) combG.set(v.x, yy, v.z, lin(COMB[1]));
  }
  const comb: SigPart = { ...part(combG, HEAD), name: 'comb', where: 'head', anim: 'comb', cells: combG.map };
  // No mouth but `o`: one dark voxel under the beak, on the face (an open beak).
  const mouthParts = mouths([0, 12, zf], 1, 'z', '#5A3A1E', HEAD, { beak: true, front: (x, y) => frontAt(x, y) });
  hollow(hg);
  const headPart = part(hg, HEAD);

  // ---- Neck: a short segment from inside the body up into the head ball, 0.14 to 0.12.
  const ng = new Grid(S);
  segment(ng, [0.02, 0.44, 0.18], [0.02, 0.54, 0.30], 0.14, 0.12, () => lin(body[1]));
  const neckSolid = solidSet(ng);
  bury(ng, bodySolid, headCells);
  const neck = part(ng, [0, 0, 0]);

  // ---- Legs: two, 2 x 2 x 7, two voxels inside the belly, in the beak's tones; three toes forward and one back.
  const legTone: Tones = [BEAK[1], BEAK[1], BEAK[1]], toeTone: Tones = [BEAK[1], BEAK[1], BEAK[1]];
  const legSpots = [[-0.04, -0.02], [0.08, -0.02]] as const;
  const legs = [
    ...legSpots.map(([cx, cz]) => { const g = new Grid(S); leg(g, cx, cz, 2, 7, legTone, toeTone, { toes: true, oneTone: true }); bury(g, bodySolid); return part(g, [cx, 0.26, cz]); }),
    none([-0.06, 0.26, -0.1]), none([0.1, 0.26, -0.1]),
  ] as unknown as [CPart, CPart, CPart, CPart];

  // ---- Warmth layers (4.5): a vest over the top only, above the wings, closing at the neck with its band.
  const coats = coatsFor({
    // The vest's cut at 0.48, the wings' top edge (the sheet's 0.54 on its 10-row torso): over the top, above the wings.
    body: bg.map, torso: { zFrom: -0.16, zTo: 0.14, bellyY: 0.48 }, kind: 'vest', knit: KNIT.chicken, clear: wings.map((w) => w.cells),
    neck: { centre: [0.02, 0.50, 0.26], rx: 0.09, ry: 0.08, tails: [0.02, 0.42, 0.30], solid: new Set([...neckSolid, ...headCells]) },
    band: { centre: [0.02, 0.48, 0.22], rx: 0.09, ry: 0.08, solid: new Set([...neckSolid, ...headCells]) },
    avoid: [hg.map],
    legs: legSpots.map(([cx, cz]) => ({ cx, cz, w: 2 })),
  });
  const breath = breathAt([0.02, 0.54, (zf + 3) * S]);
  const signature = [comb, ...wings];
  const parts = [coats.wools[2], neck, headPart, ...eyes, legs[0], legs[1], tail, ...signature];
  return {
    species: 'chicken', bodyAlways: false, signature, tailAnim: 'tailFan', height: 0.86, length: 0.98, drawScale: 1.1,
    wools: coats.wools, frosts: coats.frosts, coatCells: coats.coatCells, garment: coats.garment, neck, neckBase: [0.02, 0.44, 0.18],
    head: headPart, hood: none(HEAD), tail, eyes, lids, brows, mouths: mouthParts, ears: [none(HEAD), none(HEAD)], legs, collar: none(), bell: none([0, 0.6, 0.3]), sheared: bodyPart, breath,
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3, voxels: parts.reduce((n, p) => n + p.voxels, 0),
    cells: cellsOf({ body: bodyPart, neck, head: { ...headPart, cells: new Map([...hg.map].filter(([k]) => !beakG.map.has(k) && !wattle.map.has(k))) }, eye: [...eyes], leg: [legs[0], legs[1]], tail, collar: none(), comb: comb as CPart, beak: { ...headPart, cells: beakG.map }, wattle: { ...headPart, cells: wattle.map }, wing: wings as unknown as CPart[] }),
    stats: statsOf(parts, []),
  };
}
