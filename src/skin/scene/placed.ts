/**
 * The placement manifest (plan file 18, section 4.3): everything the painted game sets down with a mesh transform, and
 * every lamp light, written out so that a check can ask where each one stands. Nothing in the game imports this file,
 * and nothing may: it is read by src/skin/__tests__/integrity.test.ts (arithmetic, inside `npm test`) and by the scene
 * checker's place and lights stages (tools/scenes/place.ts and lights.ts, `npm run check:scenes`), which cast the rays.
 *
 * Every position is read from the game's own constant. Where the game keeps a number inside a component or a builder
 * and does not export it, the entry works the number out the way the game does and says so in `copied`: the line it
 * was read from, word for word. The test and both stages look for that line in that file, so a copy cannot go stale
 * quietly; an export of the constant would let the copy go (each one is a place a later milestone can tighten).
 *
 * The sizes (how wide a sheep stands, how tall a hen is) are no constant of the game: they are measured from the
 * models (`FEET` below), and the place stage measures them again from the models it builds and stops if they differ.
 */
import { CANDLE, CLOCK, LAMP } from '../dream/bedroom';
import { ISLANDS, islandPlace } from '../dream/stage';
import { barnSpot } from '../table/Bomb';
import { HEN_Y, LIVESTOCK } from '../table/Farmstead';
import { animalModel } from '../voxel/animals';
import { BOMB_RADIUS } from '../voxel/bomb';
import { BOARD } from '../voxel/table';
import { CAT_SPOT, ROBIN_SPOT } from './barn';
import { DUEL, duelSeat } from './duel';
import { HOME_CAMERA } from './homePov';
import { BARN, HEAP, SHEEP_SCALE, SPEAKER_CAMERA, seatPosition } from './layout';
import { PEN, penSpot } from './pen';

type V3 = readonly [number, number, number];

/** The scenes of the scene checker (tools/scenes/build.ts). */
export type PlacedScene = 'table' | 'farm' | 'duel' | 'pen' | 'bedroom' | 'dream' | 'podium';
/** What a placed thing rests on. `bedding` is hay or straw; `post` is anything narrow that carries it (a post, an arm). */
export type Support = 'floor' | 'beam' | 'bedding' | 'post';

/** A line of the game this file works a number out from, because the game does not export the number. */
export interface Copied { file: string; text: string }

export interface Placed {
  /** `<scene>:<what>`. An entry of docs/visual-overhaul/EXEMPT.json excuses one by this id, exactly. */
  id: string;
  /** The one scene it is drawn in. Something drawn in two (the barn's cat) is two entries. */
  scene: PlacedScene;
  /**
   * The middle of the face that meets its support, in world metres: under its feet for a thing that stands, at the
   * top of its hook for a thing that hangs (`hangs`).
   */
  position: V3;
  /** Width and depth, in metres, of what meets the support (round an animal's hooves), before `yaw`. */
  footprint: readonly [w: number, d: number];
  support: Support;
  /** How tall the thing is over its footprint (how far it hangs down under it, for `hangs`): the footprint box's height. */
  height: number;
  /** Its turn about y, in radians, three.js's sense. Left out: none. */
  yaw?: number;
  /** Its support is over it: the rays are cast up from `position`, and the box hangs down from it. */
  hangs?: true;
  /**
   * The voxels that are the thing itself, so they are not taken for its support or for another prop: the name of the
   * scene's thing (tools/scenes/build.ts), or what the game calls the mesh it is built into ("barn.lanterns"), or the
   * start of that name up to a dot or a bracket ("festive" is festive.decor, festive.star and every festive.bulbs[n]).
   * Left out for animals and the bomb, which are models and not part of a scene's voxels.
   */
  own?: string;
  /** One of several arrangements of the same scene (a table of four, a table of five): entries of different sets are never drawn together. */
  set?: string;
  /** Drawn only on this seat's turn (the sheep that has stepped in, the bomb at its hooves), or never on it (the same sheep at rest). */
  onTurn?: number;
  offTurn?: number;
  /** The game's constant or function the position was read from. */
  from: string;
  /** Set where that number is not exported: the line it was worked out from. */
  copied?: Copied;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sizes, measured from the models
// ---------------------------------------------------------------------------------------------------------------------

/**
 * How each animal stands, in model units (one unit is a metre at scale 1): the rectangle round its hooves, and the
 * height of its back at coat level 2, the level the farm, the pen and a full set of lives draw. Measured from
 * `animalModel(species)` on 2026-11-16: `across` is twice the furthest a leg reaches from the middle on x, `along` the
 * same on z, `tall` the top of `wools.2`. tools/scenes/place.ts measures them again and stops if a model has changed.
 */
export const FEET = {
  sheep: { across: 0.32, along: 0.48, tall: 0.64 },
  pig: { across: 0.4, along: 0.56, tall: 0.6 },
  cow: { across: 0.48, along: 0.64, tall: 0.76 },
  goat: { across: 0.4, along: 0.56, tall: 0.84 },
  horse: { across: 0.48, along: 0.8, tall: 0.76 },
  chicken: { across: 0.32, along: 0.24, tall: 0.52 },
} as const;
export type Species = keyof typeof FEET;
/** The sheepdog sits: the rectangle round its body and paws, and the top of its body (`sheepdogModel()`), measured the same day. */
export const SHEEPDOG_SITS = { across: 0.32, along: 0.64, tall: 0.64 } as const;
/** The sheep at coat level 3 (Home's doorway sheep): the top of `wools.3`. Its hooves are the same. */
export const SHEEP_TALL_AT_3 = 0.68;

/** An animal's footprint and height where it is drawn at `scale` times its own drawScale. */
const stands = (species: Species, scale: number, tall: number = FEET[species].tall) => {
  const k = scale * animalModel(species).drawScale;
  return { footprint: [FEET[species].across * k, FEET[species].along * k] as const, height: tall * k };
};

// ---------------------------------------------------------------------------------------------------------------------
// The barn: the table, and the same barn on Home's farm
// ---------------------------------------------------------------------------------------------------------------------

/** The barn's, the ice's and the pen's voxels are on a 0.1 m grid; a thing built into one cell stands on the middle of that cell. */
const CELL = 0.1;
/** Where `box` (voxel/primitives.ts) starts a box asked for at `v` metres: on the nearest cell, by the same sum. */
const snap = (v: number) => Math.round(v / CELL) * CELL;

/** What `Farm` in table/BarnTable.tsx sets down, and what the barn's builders stand in it: drawn at the table and on Home alike. */
function barn(scene: 'table' | 'farm'): Placed[] {
  const out: Placed[] = [
    // The robin stands on two feet, one 0.04 m voxel each, side by side; it is three voxels tall.
    {
      id: `${scene}:robin`, scene, position: ROBIN_SPOT, footprint: [0.08, 0.04], height: 0.12, support: 'beam', own: 'barn.robin',
      from: 'ROBIN_SPOT in scene/barn.ts',
    },
    {
      id: `${scene}:cat`, scene, position: CAT_SPOT, footprint: [0.48, 0.24], height: 0.24, support: 'bedding', own: 'cat',
      from: 'CAT_SPOT in scene/barn.ts',
    },
  ];
  // The two leaves of the back door, standing open. Each is built along its own x from its hinge.
  for (const side of [-1, 1] as const) {
    const hinge: V3 = [side * BARN.backDoor.maxX, 0, BARN.maxZ + 0.25], yaw = side * 1.75;
    const wide = BARN.backDoor.maxX, thick = 0.4;
    // The leaf's middle in its own frame, turned as three.js turns it.
    const lx = -side * (wide / 2), lz = 0.1;
    out.push({
      id: `${scene}:door leaf ${side < 0 ? 'left' : 'right'}`, scene,
      position: [hinge[0] + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0, hinge[2] - lx * Math.sin(yaw) + lz * Math.cos(yaw)],
      footprint: [wide, thick], yaw, height: BARN.backDoor.height + 0.1, support: 'floor', own: `barn.doorLeaves[${side < 0 ? 0 : 1}]`,
      from: 'the hinge and openYaw of buildBarn().doorLeaves in scene/barn.ts',
      copied: { file: 'src/skin/scene/barn.ts', text: 'hinge: [side * BARN.backDoor.maxX, 0, BARN.maxZ + 0.25] as [number, number, number], openYaw: side * 1.75,' },
    });
  }
  // The two lanterns hang from the cross beam by a wire one cell thick, which runs up to the beam's underside.
  BARN.lanterns.forEach((L, i) => {
    const top = BARN.beamY - CELL;
    out.push({
      id: `${scene}:lantern ${i}`, scene, position: [snap(L[0]) + CELL / 2, top, snap(L[2]) + CELL / 2], footprint: [CELL, CELL], height: top - (L[1] - 3 * CELL),
      support: 'beam', hangs: true, own: 'barn.lanterns',
      from: 'BARN.lanterns and BARN.beamY in scene/layout.ts',
      copied: { file: 'src/skin/scene/barn.ts', text: 'for (let y = cy + 3; y < I(BARN.beamY) - 1; y++) g.set(cx, y, cz, wire); // hook up to the beam\'s underside' },
    });
  });
  // The wheelbarrow in the right back corner, built into the barn's props cell by cell: its tray is 9 cells by 8, its
  // rim 7 cells up. It is here because three placed things stand in or against it (plan file 18, section 3, problem 4).
  const tray = { x0: 26, x1: 34, z0: 57, z1: 64, top: 6 };
  out.push({
    id: `${scene}:wheelbarrow`, scene, position: [((tray.x0 + tray.x1 + 1) / 2) * CELL, 0, ((tray.z0 + tray.z1 + 1) / 2) * CELL],
    footprint: [(tray.x1 - tray.x0 + 1) * CELL, (tray.z1 - tray.z0 + 1) * CELL], height: (tray.top + 1) * CELL, support: 'floor', own: 'barn.static[4]',
    from: 'the wheelbarrow of props() in scene/barn.ts (barn.static[4] is the barn\'s props)',
    copied: { file: 'src/skin/scene/barn.ts', text: 'fill(g, 26, 34, 3, 6, 57, 64, (x, y, z) => {' },
  });
  // The season's corner of the barn (buildFestive): a small tree and two presents, by the wheelbarrow and the bales.
  const tree = { x: 4.5, z: BARN.maxZ - 1.6, tall: 2.6 };
  out.push({
    id: `${scene}:barn tree`, scene, position: [tree.x, 0, tree.z], footprint: [tree.tall * 0.34 * 2, tree.tall * 0.34 * 2], height: tree.tall, support: 'floor', own: 'festive',
    from: 'buildFestive in scene/festive.ts (its lowest tier is height * 0.34 wide each way)',
    copied: { file: 'src/skin/scene/festive.ts', text: 'd.tree(4.5, BARN.maxZ - 1.6, 2.6);' },
  });
  const presents: [x: number, z: number, w: number, h: number, text: string][] = [
    [3.36, BARN.maxZ - 1.7, 0.5, 0.4, 'd.present(3.36, BARN.maxZ - 1.7, 0.5, 0.4, T.collar[1], GOLD);'],
    [2.9, BARN.maxZ - 2.25, 0.6, 0.5, 'd.present(2.9, BARN.maxZ - 2.25, 0.6, 0.5, T.pine[1], T.snow[1]);'],
  ];
  presents.forEach(([x, z, w, h, text], i) => out.push({
    id: `${scene}:barn present ${i + 1}`, scene, position: [x, 0, z], footprint: [w, w], height: h + CELL, support: 'floor', own: 'festive',
    from: 'buildFestive in scene/festive.ts (a present is w wide each way and h tall, with a knot one cell high)',
    copied: { file: 'src/skin/scene/festive.ts', text },
  }));
  return out;
}

/**
 * The letter board: hung from its hook by two ropes, each 0.04 m thick and 0.35 m to a side of the middle
 * (letterBoardGeometry in voxel/table.ts), so what meets the support is the span of the two rope ends. The board's
 * foot is at BOARD.bottom when the hook is 0.15 m under the beam's height.
 */
function letterBoard(scene: 'table' | 'duel', hook: V3, beamY: number, support: Support, from: string, copied?: Copied): Placed {
  return {
    id: `${scene}:letter board`, scene, position: hook, footprint: [0.35 * 2 + 0.04, 0.04], height: beamY - 0.15 - BOARD.bottom,
    support, hangs: true, own: 'letterBoard', from, ...(copied ? { copied } : {}),
  };
}

/** Where a seat's animal stands once it has stepped in for its turn: `step` metres toward the pile, as SeatGroup and barnSpot do. */
function steppedIn(index: number, n: number): { x: number; z: number; yaw: number } {
  const p = seatPosition(index, n);
  const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  return { x: p.x + (dx / len) * SPEAKER_CAMERA.step, z: p.z + (dz / len) * SPEAKER_CAMERA.step, yaw: p.yaw };
}

/** The bomb at size 1: `Bomb` draws its model at 1.5, so it is BOMB_RADIUS * 1.5 round, and rests on the floor. */
const BOMB_R = BOMB_RADIUS * 1.5;

function table(): Placed[] {
  const out: Placed[] = barn('table');
  out.push(letterBoard('table', [HEAP[0], BARN.beamY - 0.15, 1.0], BARN.beamY, 'beam', 'the default hook of LetterBoard in table/BarnTable.tsx',
    { file: 'src/skin/table/BarnTable.tsx', text: 'export function LetterBoard({ letter, isTrap, reduced, beamY = BARN.beamY, hook = [HEAP[0], BARN.beamY - 0.15, 1.0] }: {' }));
  out.push({
    id: 'table:sheepdog', scene: 'table', position: [2.25, 0, BARN.maxZ - 1.2], yaw: Math.PI + 0.6,
    footprint: [SHEEPDOG_SITS.across, SHEEPDOG_SITS.along], height: SHEEPDOG_SITS.tall, support: 'floor',
    from: 'Sheepdog in table/places.tsx (the tutorial)',
    copied: { file: 'src/skin/table/places.tsx', text: '<group ref={root} position={[2.25, 0, BARN.maxZ - 1.2]} rotation={[0, Math.PI + 0.6, 0]}>' },
  });
  // The ring, for every table size: each seat at rest, the same seat stepped in on its turn, and the bomb at its hooves.
  const sheep = stands('sheep', SHEEP_SCALE);
  for (let n = 2; n <= 10; n++) {
    const set = `${n} seats`;
    for (let i = 0; i < n; i++) {
      const rest = seatPosition(i, n), step = steppedIn(i, n), [bx, bz] = barnSpot(i, n)(BOMB_R);
      out.push({
        id: `table:seat ${i} of ${n}`, scene: 'table', set, offTurn: i, position: [rest.x, 0, rest.z], yaw: rest.yaw, ...sheep, support: 'floor',
        from: 'seatPosition in scene/layout.ts, drawn at SHEEP_SCALE by SeatGroup in table/BarnTable.tsx',
      });
      out.push({
        id: `table:seat ${i} of ${n}, stepped in`, scene: 'table', set, onTurn: i, position: [step.x, 0, step.z], yaw: step.yaw, ...sheep, support: 'floor',
        from: 'seatPosition and SPEAKER_CAMERA.step in scene/layout.ts',
        copied: { file: 'src/skin/table/BarnTable.tsx', text: 'const step = active ? 0.35 : 0;' },
      });
      out.push({
        // The bomb is round: the square round it is laid along its holder's own axes, so its corners do not reach further than it does.
        id: `table:bomb at seat ${i} of ${n}`, scene: 'table', set, onTurn: i, position: [bx, 0, bz], yaw: step.yaw, footprint: [BOMB_R * 2, BOMB_R * 2], height: BOMB_R * 2, support: 'floor',
        from: 'barnSpot in table/Bomb.tsx, for a bomb of size 1 (BOMB_RADIUS * 1.5)',
      });
    }
  }
  return out;
}

function farm(): Placed[] {
  const out: Placed[] = barn('farm');
  // The player's animal in front of the doors, and a second sheep half inside the doorway (FarmBackdrop).
  const hero: V3 = [0, 0, BARN.maxZ + 1.2], cam = HOME_CAMERA.desktop;
  out.push({
    id: 'farm:hero', scene: 'farm', position: hero, yaw: Math.atan2(cam.position[0] - hero[0], cam.position[2] - hero[2]), ...stands('sheep', 1.5), support: 'floor',
    from: 'the hero of FarmBackdrop in table/FarmBackdrop.tsx (the sheep; a worn avatar stands on the same spot)',
    copied: { file: 'src/skin/table/FarmBackdrop.tsx', text: 'const hero: [number, number, number] = [0, 0, BARN.maxZ + 1.2];' },
  });
  out.push({
    // At x 1.9, clear of the wheelbarrow now the sheep is longer (Brian's sheet, 2026-11-18).
    id: 'farm:doorway sheep', scene: 'farm', position: [1.9, 0, BARN.maxZ - 1.4], yaw: Math.PI / 2, ...stands('sheep', 1.5, SHEEP_TALL_AT_3), support: 'floor',
    from: 'the second sheep of FarmBackdrop in table/FarmBackdrop.tsx (coat level 3)',
    copied: { file: 'src/skin/table/FarmBackdrop.tsx', text: '<group position={[1.9, 0, BARN.maxZ - 1.4]} rotation={[0, Math.PI / 2, 0]} scale={1.5 * animalModel(\'sheep\').drawScale}>' },
  });
  // Who lives on the farm. The hens stand on the straw of their run (HEN_Y); everyone else on the land.
  LIVESTOCK.forEach(([animal, x, z, facing], i) => out.push({
    id: `farm:livestock ${i} (${animal})`, scene: 'farm', position: [x, animal === 'chicken' ? HEN_Y : 0, z], yaw: facing, ...stands(animal as Species, 1.5), support: animal === 'chicken' ? 'bedding' : 'floor',
    from: `LIVESTOCK[${i}] in table/Farmstead.tsx, drawn at 1.5 times its drawScale`,
    copied: { file: 'src/skin/table/Farmstead.tsx', text: 'rotation={[0, facing, 0]} scale={1.5 * animalModel(animal).drawScale}>' },
  }));
  return out;
}

function duel(): Placed[] {
  const out: Placed[] = [letterBoard('duel', DUEL.hook, DUEL.hook[1] + 0.65, 'post', 'DUEL.hook in scene/duel.ts',
    { file: 'src/skin/table/DuelTable.tsx', text: 'const DUEL_BEAM = BOARD.bottom + BOARD.height + 0.35;' })];
  const sheep = stands('sheep', SHEEP_SCALE);
  for (const i of [0, 1]) {
    const p = duelSeat(i), toward = -Math.sign(p.x);
    out.push({
      id: `duel:seat ${i}`, scene: 'duel', offTurn: i, position: [p.x, 0, p.z], yaw: p.yaw, ...sheep, support: 'floor',
      from: 'duelSeat in scene/duel.ts, drawn at SHEEP_SCALE by Stand in table/DuelTable.tsx',
    });
    out.push({
      id: `duel:seat ${i}, stepped in`, scene: 'duel', onTurn: i, position: [p.x + toward * 0.35, 0, p.z], yaw: p.yaw, ...sheep, support: 'floor',
      from: 'duelSeat in scene/duel.ts and the step of Stand in table/DuelTable.tsx',
      copied: { file: 'src/skin/table/DuelTable.tsx', text: 'want.set(p.x - Math.sign(p.x) * (active ? 0.35 : 0), 0, p.z);' },
    });
    out.push({
      id: `duel:bomb at seat ${i}`, scene: 'duel', onTurn: i, position: [p.x + toward * (0.85 + BOMB_R), 0, -0.3], yaw: p.yaw, footprint: [BOMB_R * 2, BOMB_R * 2], height: BOMB_R * 2, support: 'floor',
      from: 'duelSpot in table/DuelTable.tsx, for a bomb of size 1 (BOMB_RADIUS * 1.5)',
      copied: { file: 'src/skin/table/DuelTable.tsx', text: 'return (r) => [p.x + fwd * (0.85 + r), -0.3];' },
    });
  }
  // The two lanterns at the spit's ends: each glass sits on its post, 0.2 m under the lamp's own height.
  DUEL.lamps.forEach(([x, y, z], i) => out.push({
    id: `duel:lamp ${i}`, scene: 'duel', position: [x, snap(y - 0.2), z], footprint: [0.2, 0.2], height: snap(y + 0.3) - snap(y - 0.2), support: 'post', own: 'duel.glow',
    from: 'DUEL.lamps in scene/duel.ts',
    copied: { file: 'src/skin/scene/duel.ts', text: 'box(glow, [x - 0.1, y - 0.2, z - 0.1], [x + 0.1, y + 0.3, z + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 63)));' },
  }));
  return out;
}

function pen(): Placed[] {
  const out: Placed[] = [];
  const sheep = stands('sheep', SHEEP_SCALE);
  // Where each animal starts, on the pen's straw. After that it wanders (rooms/penWander.ts), which no entry follows.
  for (let i = 0; i < 10; i++) {
    const p = penSpot(i);
    out.push({
      id: `pen:animal ${i}`, scene: 'pen', position: [p.x, 0, p.z], yaw: p.yaw, ...sheep, support: 'bedding',
      from: 'penSpot in scene/pen.ts, drawn at SHEEP_SCALE by Animal in rooms/PenStage.tsx',
    });
  }
  // The tall lantern's glass hangs from its post's arm by an iron hanger one cell thick, on an iron lid as wide as the
  // glass: what meets the support is the glass's top under the lid's middle cell. The gate's lantern sits on the gate's right post.
  const [lx, ly, lz] = PEN.lamp, [qx, qy, qz] = PEN.gateLamp;
  out.push({
    id: 'pen:tall lantern', scene: 'pen', position: [snap(lx - 0.05) + CELL / 2, snap(ly + 0.2), snap(lz - 0.7) + CELL / 2], footprint: [CELL, CELL],
    height: snap(ly + 0.2) - snap(ly - 0.15), support: 'post', hangs: true, own: 'pen.glow',
    from: 'PEN.lamp in scene/pen.ts (the glass under its lid)',
    copied: { file: 'src/skin/scene/pen.ts', text: 'box(g, [lx - 0.15, ly + 0.2, lz - 0.8], [lx + 0.15, ly + 0.3, lz - 0.5], iron);' },
  });
  out.push({
    id: 'pen:gate lantern', scene: 'pen', position: [qx, snap(qy - 0.15), qz], footprint: [0.2, 0.2], height: snap(qy + 0.1) - snap(qy - 0.15), support: 'post', own: 'pen.glow',
    from: 'PEN.gateLamp in scene/pen.ts',
    copied: { file: 'src/skin/scene/pen.ts', text: 'box(glow, [qx - 0.1, qy - 0.15, qz - 0.1], [qx + 0.1, qy + 0.1, qz + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 48)));' },
  });
  return out;
}

function bedroom(): Placed[] {
  // The alarm clock on the nightstand. Its group is set 0.025 m over CLOCK.y because its feet are one cell under its origin.
  return [{
    id: 'bedroom:clock', scene: 'bedroom', position: [CLOCK.x, CLOCK.y, CLOCK.z], yaw: CLOCK.turn, footprint: [0.15, 0.125], height: 0.25, support: 'floor', own: 'clock',
    from: 'CLOCK in dream/bedroom.ts',
    copied: { file: 'src/skin/dream/BedroomBubble.tsx', text: '<group ref={clock} position={[CLOCK.x, CLOCK.y + 0.025, CLOCK.z]} rotation={[0, CLOCK.turn, 0]}>' },
  }];
}

/** The winning screen's layout, which table/Podium.tsx keeps to itself: every number below is copied, each beside the line it came from. */
const PODIUM = {
  file: 'src/skin/table/Podium.tsx',
  STEP: { w: 1.4, d: 1.2 }, HEIGHT: [1.5, 1.1, 0.8], CRATE: 0.55,
  /** [x, y, z, turn] of each hay bale, and the three lines they are written on. */
  BALES: [
    [-6.6, 0, -1.6, 0], [-5.55, 0, -1.6, 0], [-6.1, 0.5, -1.6, 0.05], [-7.2, 0, -0.6, 1.57], [-6.6, 1, -1.6, -0.04],
    [6.6, 0, -1.6, 0], [5.55, 0, -1.6, 0], [6.1, 0.5, -1.6, -0.06], [7.2, 0, -0.6, 1.57], [6.6, 1, -1.6, 0.03],
    [-4.9, 0, 1.6, 0.4], [5.1, 0, 1.4, -0.3],
  ] as [number, number, number, number][],
  baleLines: [
    '[-6.6, 0, -1.6, 0], [-5.55, 0, -1.6, 0], [-6.1, 0.5, -1.6, 0.05], [-7.2, 0, -0.6, 1.57], [-6.6, 1, -1.6, -0.04],',
    '[6.6, 0, -1.6, 0], [5.55, 0, -1.6, 0], [6.1, 0.5, -1.6, -0.06], [7.2, 0, -0.6, 1.57], [6.6, 1, -1.6, 0.03],',
    '[-4.9, 0, 1.6, 0.4], [5.1, 0, 1.4, -0.3],',
  ],
  /** One bale: 1.0 m long, 0.6 m deep and 0.5 m tall (baleGeometry). */
  bale: { long: 1.0, deep: 0.6, tall: 0.5 },
  spotLines: [
    'if (place === 1) return [0, HEIGHT[0], 0];',
    'if (place === 2) return [-STEP.w - 0.06, HEIGHT[1], 0];',
    'if (place === 3) return [STEP.w + 0.06, HEIGHT[2], 0];',
    'const k = place - 4, side = k % 2 ? 1 : -1; return [side * (3.05 + Math.floor(k / 2) * 1.3), CRATE, 0.5];',
  ],
};

function podiumSpot(place: number): V3 {
  const { STEP, HEIGHT, CRATE } = PODIUM;
  if (place === 1) return [0, HEIGHT[0], 0];
  if (place === 2) return [-STEP.w - 0.06, HEIGHT[1], 0];
  if (place === 3) return [STEP.w + 0.06, HEIGHT[2], 0];
  const k = place - 4, side = k % 2 ? 1 : -1;
  return [side * (3.05 + Math.floor(k / 2) * 1.3), CRATE, 0.5];
}

function podium(): Placed[] {
  const out: Placed[] = [];
  PODIUM.BALES.forEach(([x, y, z, turn], i) => out.push({
    id: `podium:bale ${i}`, scene: 'podium', position: [x, y, z], yaw: turn, footprint: [PODIUM.bale.long, PODIUM.bale.deep], height: PODIUM.bale.tall,
    support: y > 0 ? 'bedding' : 'floor', own: `podium.bale[${i}]`,
    from: 'BALES in table/Podium.tsx',
    copied: { file: PODIUM.file, text: PODIUM.baleLines[i < 5 ? 0 : i < 10 ? 1 : 2] },
  }));
  // The ten places: the top three on their timber, the rest on crates. Everyone is the sheep here.
  const sheep = stands('sheep', SHEEP_SCALE);
  for (let place = 1; place <= 10; place++) out.push({
    id: `podium:place ${place}`, scene: 'podium', position: podiumSpot(place), ...sheep, support: 'post',
    from: 'spot(place) in table/Podium.tsx, drawn at SHEEP_SCALE by Dancer',
    copied: { file: PODIUM.file, text: PODIUM.spotLines[Math.min(place, 4) - 1] },
  });
  return out;
}

/** Everything the game sets down with a mesh transform, scene by scene. */
export const PLACED: readonly Placed[] = [...table(), ...farm(), ...duel(), ...pen(), ...bedroom(), ...podium()];

/** Lines of the game the copied numbers above also rest on: the podium's sizes, the scales things are drawn at, how a box is set on the grid. */
export const ALSO_COPIED: readonly Copied[] = [
  { file: PODIUM.file, text: 'const STEP = { w: 1.4, d: 1.2 };' },
  { file: PODIUM.file, text: 'const HEIGHT = [1.5, 1.1, 0.8];' },
  { file: PODIUM.file, text: 'const CRATE = 0.55;' },
  { file: PODIUM.file, text: 'const [x, y, z] = spot(entry.place);' },
  { file: 'src/skin/table/BarnTable.tsx', text: 'return <group ref={g} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE * drawScale}>{children}</group>;' },
  { file: 'src/skin/table/Bomb.tsx', text: '<group ref={group} scale={1.5}>' },
  { file: 'src/skin/table/DuelTable.tsx', text: 'const fwd = -Math.sign(p.x);' },
  { file: 'src/skin/scene/barn.ts', text: 'const statics = yield* each([w, b, f, bl, p], (g) => buildGeometry(g.map, S));' },
  { file: 'src/skin/voxel/table.ts', text: 'const rx = Math.round((sx * 0.35) / s);' },
  { file: 'src/skin/voxel/primitives.ts', text: 'const a = min.map((v) => Math.round(v / g.size));' },
];

/**
 * Things a scene's meshes set down or move that have no entry above, each with why. Nobody judges where these stand:
 * the place stage counts and names them, and a thing that is neither placed nor listed here is counted the same way.
 */
export const NOT_PLACED: Readonly<Record<PlacedScene, Readonly<Record<string, string>>>> = {
  table: { 'distance.windmillBlades': 'its hub is a number buildDistance works out and does not export (bladesHub)' },
  farm: { 'distance.windmillBlades': 'its hub is a number buildDistance works out and does not export (bladesHub)' },
  duel: {},
  pen: {},
  bedroom: {
    quilt: 'it lies on the farmer, in the bed: none of the four supports is a thing tucked into another',
    farmer: 'he lies tilted in the bed, under the quilt and into the pillow: none of the four supports fits, and a tilted thing has no boxes',
  },
  dream: {
    raft: 'the lane and the farm on it drift on cloud by design; it is the ground of this scene',
    'cloud sea': 'cloud, far below the lane, by design',
    'island A': 'an island hanging in the sky by design',
    'island B': 'an island hanging in the sky by design',
    'island B windmill blades': 'they turn on the island windmill\'s hub, which DreamStage works out from buildDistance().bladesHub',
    'island C': 'an island hanging in the sky by design',
    'wisp[0]': 'a wisp of cloud crossing the sky',
    'wisp[1]': 'a wisp of cloud crossing the sky',
    'dream.hills': 'the far range, behind the cloud sea',
    'dream.mountains': 'the far range, behind the cloud sea',
  },
  podium: {},
};

/**
 * The pairs of entries whose footprint boxes run into each other today. On 2026-11-16 these were the wheelbarrow corner
 * of the barn (eight pairs); plan file 18 (section 4.7, fix 3) moved them apart in milestone 3, so none is left. The
 * integrity test wants exactly these and no other. This list may only shrink, and the test holds its own copy of the
 * list as it stood on 2026-11-16, so nothing can be added.
 */
export const KNOWN_OVERLAPS: readonly (readonly [string, string])[] = [];

/** True when two entries can be on screen at once: the same scene, the same arrangement, and turns that agree. */
export function together(a: Placed, b: Placed): boolean {
  if (a.scene !== b.scene) return false;
  if (a.set !== undefined && b.set !== undefined && a.set !== b.set) return false;
  if (a.onTurn !== undefined && b.onTurn !== undefined && a.onTurn !== b.onTurn) return false;
  if ((a.onTurn !== undefined && b.offTurn === a.onTurn) || (b.onTurn !== undefined && a.offTurn === b.onTurn)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// The lights
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One point or spot light of the game. `element` is the JSX that mounts it, from its opening `<` on, word for word:
 * the test finds every `<pointLight` and `<spotLight` under src/skin and wants an entry on each. An element that mounts
 * several lights (one for each lantern) has an entry for each.
 *
 * A light is one of three things:
 *   lamp     it belongs to a lamp built of voxels: `position` must be within 0.35 m of the voxels of `mounts`;
 *   fill     it has no lamp and is not meant to have one (a spotlight from above, a bounce off the snow): `fill` says why;
 *   unseen   it has a lamp, and the scene checker cannot lay that lamp out to measure (it is not voxels, or it rides
 *            a model, or its scene is not built): `unseen` says why. These are counted as not checked, never as passing.
 */
export interface Light {
  id: string;
  element: Copied;
  kind: 'point' | 'spot';
  lamp?: {
    scene: PlacedScene;
    /** In world metres, or in `thing`'s own frame when the light is mounted inside a thing's group. */
    position: V3;
    thing?: string;
    /** The same in the build a touch device or a narrow screen draws, where it differs. */
    coarse?: V3;
    /** What the game calls the meshes the lamp's glass is built into. */
    mounts: readonly string[];
  };
  /** A second line of the game the position rests on, where there is one. */
  copied?: Copied;
  fill?: string;
  unseen?: string;
}

const el = (file: string, text: string): Copied => ({ file: `src/skin/${file}`, text });
const LANTERNS = el('table/Rendering.tsx', '<pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]}');
const DUEL_LAMPS = el('table/DuelTable.tsx', '<pointLight key={i} position={[p[0], p[1], p[2]]}');
const islandA = ISLANDS.find((it) => it.kind === 'pine-lantern')!;

export const LIGHTS: readonly Light[] = [
  // The barn's two lanterns (Lights in table/Rendering.tsx), at the table and on Home. On Home the lights are let down
  // to 2.5 m (lowerLamp in table/FarmBackdrop.tsx), under lanterns that stay where they hang.
  ...BARN.lanterns.map((p, i): Light => ({
    id: `table:lantern ${i}`, kind: 'point', element: LANTERNS,
    lamp: { scene: 'table', position: [p[0], p[1] - 0.3, p[2]], mounts: ['barn.lanterns'] },
  })),
  ...BARN.lanterns.map((p, i): Light => ({
    id: `farm:lantern ${i}`, kind: 'point', element: LANTERNS,
    lamp: { scene: 'farm', position: [p[0], 2.5, p[2]], mounts: ['barn.lanterns'] },
    copied: { file: 'src/skin/table/FarmBackdrop.tsx', text: 'const lowerLamp = (_: number, lamp: PointLight | null) => { if (lamp) lamp.position.y = 2.5; };' },
  })),
  { id: 'table:speaker spot', kind: 'spot', element: el('table/BarnTable.tsx', '<spotLight ref={spot} position={[0, 6.0, 0]}'), fill: 'a spotlight from the rafters on whoever is on turn; no lamp is drawn for it' },
  { id: 'farm:door spill', kind: 'spot', element: el('table/FarmBackdrop.tsx', '<spotLight ref={spot} position={[0, 3.2, BARN.maxZ - 0.4]}'), fill: 'the warm light that falls out of the doorway onto the path' },
  { id: 'farm:door bounce', kind: 'point', element: el('table/FarmBackdrop.tsx', '<pointLight ref={bounce} position={[...DOOR_LIGHT.bounceAt]}'), fill: 'that light bounced back off the snow, so the hero\'s face is not a silhouette' },
  // Practice: the ice.
  ...DUEL.lamps.map((p, i): Light => ({
    id: `duel:lamp ${i}`, kind: 'point', element: DUEL_LAMPS,
    lamp: { scene: 'duel', position: [p[0], p[1], p[2]], mounts: ['duel.glow'] },
  })),
  { id: 'duel:board light', kind: 'point', element: el('table/DuelTable.tsx', '<pointLight position={[0, BOARD_BOTTOM + 0.3, -1.1]}'), fill: 'a warm light in front of the letter board, whose face the moon does not reach' },
  { id: 'duel:speaker spot', kind: 'spot', element: el('table/DuelTable.tsx', '<spotLight ref={spot} position={[0, 8, -0.6]}'), fill: 'the hard light from above that finds whoever is on turn' },
  // The lobby's pen.
  {
    id: 'pen:tall lantern', kind: 'point', element: el('rooms/PenStage.tsx', '<pointLight position={[PEN.lamp[0] + 0.1, PEN.lamp[1], PEN.lamp[2] - 0.7]}'),
    lamp: { scene: 'pen', position: [PEN.lamp[0] + 0.1, PEN.lamp[1], PEN.lamp[2] - 0.7], mounts: ['pen.glow'] },
  },
  {
    id: 'pen:gate lantern', kind: 'point', element: el('rooms/PenStage.tsx', '<pointLight position={[PEN.gateLamp[0], PEN.gateLamp[1] + 0.1, PEN.gateLamp[2] + 0.5]}'),
    lamp: { scene: 'pen', position: [PEN.gateLamp[0], PEN.gateLamp[1] + 0.1, PEN.gateLamp[2] + 0.5], mounts: ['pen.glow'] },
  },
  // The farmer's bedroom.
  { id: 'bedroom:room side', kind: 'point', element: el('dream/BedroomBubble.tsx', '<pointLight position={[1.4, 1.5, 0.9]}'), fill: 'the lamp\'s glow from the room side, so his face reads whichever way he lies' },
  {
    id: 'bedroom:oil lamp', kind: 'point', element: el('dream/BedroomBubble.tsx', '<pointLight ref={lampLight} position={[LAMP.x + 0.08, LAMP.y + 0.3, LAMP.z + 0.12]}'),
    lamp: { scene: 'bedroom', position: [LAMP.x + 0.08, LAMP.y + 0.3, LAMP.z + 0.12], mounts: ['bedroom.lampGlass', 'bedroom.glow'] },
  },
  {
    id: 'bedroom:candle', kind: 'point', element: el('dream/BedroomBubble.tsx', '<pointLight ref={candle} position={[CANDLE.x, CANDLE.y + 0.25, CANDLE.z + 0.15]}'),
    lamp: { scene: 'bedroom', position: [CANDLE.x, CANDLE.y + 0.25, CANDLE.z + 0.15], mounts: ['bedroom.glow'] },
  },
  // Counting Sheep. Only the island with the lantern has a glow and a light.
  {
    id: `dream:island ${islandA.id} lantern`, kind: 'point', element: el('dream/DreamStage.tsx', '<pointLight position={[p.across * 0.21, 0.95, 0.3]}'),
    lamp: {
      scene: 'dream', thing: `island ${islandA.id}`, mounts: [`island[${islandA.id}].glow`],
      position: [islandPlace(islandA).across * 0.21, 0.95, 0.3], coarse: [islandPlace(islandA, true).across * 0.21, 0.95, 0.3],
    },
  },
  { id: 'dream:sign lantern', kind: 'point', element: el('dream/DreamStage.tsx', '<pointLight ref={lamp} color='), unseen: 'it is moved to the lantern of the sign in play, and the signs come and go with the night: they are models, not part of the scene' },
  // The winning screen.
  { id: 'podium:hayloft lanterns', kind: 'point', element: el('table/Podium.tsx', '<pointLight position={[0, -0.3, 0.2]}'), unseen: 'its three lanterns are three.js boxes on the hayloft beam, not voxels: the scene checker does not lay them out' },
  { id: 'podium:trophy', kind: 'point', element: el('table/Podium.tsx', '<pointLight position={[0, 0.5, 0.3]}'), unseen: 'it rides the winner\'s trophy, which is a model the winner holds up, not part of the scene' },
  { id: 'podium:stage spot', kind: 'spot', element: el('table/Podium.tsx', '<spotLight position={[0, 8, 6]}'), fill: 'the stage\'s key light, from over the audience' },
  { id: 'podium:front fill', kind: 'point', element: el('table/Podium.tsx', '<pointLight position={[0, 3.2, 2.4]}'), fill: 'a warm light in front of the podium, on the dancers\' faces' },
  // What rides a model, and the pages that are not a scene.
  { id: 'bomb glow', kind: 'point', element: el('table/Bomb.tsx', '<pointLight ref={glow} color={aura.light}'), unseen: 'it is moved to the bomb every frame; the bomb is a model, not part of a scene' },
  { id: 'burst flash', kind: 'point', element: el('table/Blast.tsx', '<pointLight ref={light} color='), fill: 'the flash of a burst: it is dark between bursts and there is nothing to hang it on' },
  { id: 'admin photo glare', kind: 'point', element: el('avatars/AvatarDisc.tsx', '<pointLight ref={lamp} position={[0, bandY, 0]}'), unseen: 'it rides the admin\'s photo disc, the one thing in the game that is not voxels' },
  { id: 'leaderboards:trophy', kind: 'point', element: el('boards/BoardStage.tsx', '<pointLight position={[0, 0.5, 0.4]}'), unseen: 'it stands by the trophy on first place\'s pedestal in the leaderboards\' sky, a scene the checker does not build' },
  { id: 'barn book:preview', kind: 'point', element: el('shop/PreviewStage.tsx', '<pointLight ref={lamp} color={auraOf(item.id).light}'), unseen: 'it lights the bomb on the Barn Book\'s stand; the preview is not one of the seven scenes' },
  { id: 'door bake', kind: 'point', element: el('loading/DoorsRender.tsx', '<pointLight position={[cx - 1.6, cy + 1.3, 1.6]}'), fill: 'the warm side light of the page that bakes the loading doors (development builds only); the doorway has no lantern' },
];
