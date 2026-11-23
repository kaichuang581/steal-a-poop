import { FESTIVE } from '../../config';
import { useFrame } from '@react-three/fiber';
import { AFTERMATH_MS } from '../../engine/constants';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, DoubleSide, BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, Points, PointsMaterial, Sphere, Vector3,
} from 'three';
import { withRoundedEdges } from '../voxel/rounded';
import { Box3 } from 'three';
import type { Light, LightShadow, Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { santaHat } from '../scene/festive';
import { animalMaterial, voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { FROST, lin, SCARF } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import type { V3 } from '../voxel/primitives';
import { CREAM, iceBlock, sheepModel, TAIL_BACK, windCurl } from '../voxel/sheep';
import type { Brows, Lids, Mouth, Part, SheepModel, WoolLevel } from '../voxel/sheep';
import type { AnimalModel, SigPart } from '../voxel/animals/rig';
import { anchorsOf, scarfCells } from '../voxel/animals/anchors';
import { contactPatch } from '../voxel/contactPatch';
import { useTier } from '../perf/tier';

export type SheepState = 'idle' | 'proud' | 'happy' | 'startled' | 'cold' | 'dazed' | 'freezing' | 'frozen' | 'thawing' | 'sleeping' | 'grazing' | 'thinking' | 'run' | 'jump' | 'bonk' | 'land' | 'walk' | 'flop' | 'perch' | 'lounge';
/** Every state of `SheepState`, in its order, for the checks that step through all of them (tools/scenes/models.ts). */
export const ALL_STATES = ['idle', 'proud', 'happy', 'startled', 'cold', 'dazed', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing', 'thinking', 'run', 'jump', 'bonk', 'land', 'walk', 'flop', 'perch', 'lounge'] as const satisfies readonly SheepState[];
/** Types only, no code: this stops compiling when a state is added to `SheepState` and left out of `ALL_STATES`. */
export type EveryStateListed = Nothing<Exclude<SheepState, (typeof ALL_STATES)[number]>>;
type Nothing<T extends never> = T;
export type { WoolLevel };

/**
 * Coat level: the coat is the sheep's wool balls. A full start is a normal coat, each one lost shears it thinner, and
 * extra ones won from traps fluff it up. Never below 1 at the table: a sheep is never shorn bare (Brian, 2026-11-23:
 * "make it so that the sheep cant go naked"); its wool balls on its tag say how many it has left.
 */
export function coatLevel(lives: number, startLives: number): WoolLevel {
  return Math.max(1, Math.min(4, 2 + (lives - startLives))) as WoolLevel;
}

/** The coat's y offset when it swells by `k` about the legs' tops at `belly`, so the belly stays on the legs. */
export const swellY = (belly: number, k: number) => belly * (1 - k);

/** Seconds each timed state lasts before the sheep goes back to idle. */
/** How long a sheep is dazed after a bomb goes off beside it: the table's beat (the engine's AFTERMATH_MS), in seconds. */
export const DAZED_S = AFTERMATH_MS / 1000;
const DURATION: Partial<Record<SheepState, number>> = { proud: 1.2, happy: 1.6, startled: 0.9, cold: 2, dazed: DAZED_S, freezing: 2.4, thawing: 1.2 };
/** The dream's trot: ms per half-step at the slowest and the fastest run (V4 Part 7.2); `pace` 0..1 picks between. */
const TROT_MS = { slow: 110, fast: 70 };
/** The walk: seconds a half-step. */
export const WALK_HALF_STEP = 0.34;

/** Reserved customisation slots (plan V3 Part 5.4): ids only, no UI, no store. */
export interface SheepLook { woolColour: string; facePattern: string; collar: string; hat: string; scarf: string; bell: string }
export const DEFAULT_LOOK: SheepLook = { woolColour: 'cream', facePattern: 'plain', collar: 'red', hat: 'none', scarf: 'none', bell: 'brass' };

/**
 * Every part's turn and offset for a pose a scene supplies (radians, model units), applied as the frame loop applies its
 * own: the body group about the model's origin, each leg about its pivot (x then z: the swing, then the spread), the head
 * about its pivot inside the neck group, the ears and tail about theirs, the wings (the chicken's) about their roots.
 */
export interface RigPose {
  body: [number, number, number]; bodyAt: [number, number, number];
  head: [number, number, number]; headAt: [number, number, number];
  neck: number; ears: [number, number];
  legs: [number, number][]; legsAt: [number, number, number][];
  tail: [number, number]; wings: [number, number];
  lids: 'open' | 'closed';
}

interface Props {
  level: WoolLevel;
  state: SheepState;
  /** Change to restart a timed state (two banks in a row both hop). */
  stateKey?: number;
  dimmed?: boolean;
  reduced?: boolean;
  /** No idle motion at all (plan V3 Milestone 3). */
  still?: boolean;
  /** Direction the freeze gust comes from, in the sheep's local space (the barn's back doors). */
  gustFrom?: [number, number, number];
  /** Winner's scarf. */
  scarf?: boolean;
  /** Where the head turns (radians about y, clamped to 0.6); Home's hero follows the pointer. A ref is read every frame, with no render. */
  headYaw?: number | { readonly current: number };
  /** Attention (plan V3.3 Part 3.3): a world point to look at, or the camera. Wins over headYaw. */
  lookAt?: [number, number, number] | 'camera';
  /** The current speaker: chest up, tail wagging. */
  speaking?: boolean;
  /** A bot on its turn: whenever the sheep has nothing else to do it thinks (head tilt, one ear up). */
  thinking?: boolean;
  /**
   * The ground-contact patch under the hooves on the Low tier, where animals cast no shadow (plan file 02, change 5).
   * On unless a scene gives the animal ground contact of its own: the dream's runner has its shadow disc, and leaps
   * with its whole group, which would lift the patch off the lane with it.
   */
  contact?: boolean;
  /** The dream's run: 0 at the slowest trot, 1 at full pace (V4 Part 7.2). */
  pace?: number;
  /** Another animal built to the shared rig (src/skin/voxel/animals): the avatar a player wears. Default: the sheep. */
  model?: SheepModel | AnimalModel;
  /**
   * A pose handed in whole, every frame, in place of the state's own (the leaderboards' poses, boards/poses.ts): called
   * with the clock's time and read at once. The state still runs the blink, the face and the idle layer underneath.
   */
  rig?: (t: number) => RigPose;
}

/** The ears hang 20 degrees below level. */
// The ears' rest turn: none, so each animal's ears stand as built, as Brian's sheets draw them (2026-11-18; it was a
// 20 degree droop for the old floppy ears). Poses move them from there.
const DROOP = 0;
/** How much clear ice stands round an animal in its block, each side (file 03, 4.2). */
const ICE_MARGIN = 0.12;
/**
 * The ice block for an animal, and where its middle stands (x and z; the block rests on the floor): one fitted to
 * the animal in its frozen pose (the sheep's too, so its thickest coat stays inside), its hat included, with ICE_MARGIN of ice round it, each side a
 * whole number of voxel pairs so the block stays centred on its grid. Cached by `iceBlock`, per size.
 */
export function iceFit(m: SheepModel | AnimalModel): { size: [number, number, number]; x: number; z: number; sink: number } {
  const { min, max } = anchorsOf(m).frozen;
  const pair = 0.08, up = (v: number) => Math.ceil(v / pair - 1e-6) * pair;
  const w = up(max[0] - min[0] + 2 * ICE_MARGIN);
  // Frozen, the animal leans back and its hooves sink under the floor; the tilted block's high side stands off it. The
  // block goes down into the floor (where nothing of it shows) far enough to hold them on both sides.
  const sink = Math.ceil((Math.max(0, -min[1]) + (w / 2) * Math.sin(TILT)) / 0.04 - 1e-6) * 0.04;
  return { size: [w, up(max[1] + sink + ICE_MARGIN), up(max[2] - min[2] + 2 * ICE_MARGIN)], x: (min[0] + max[0]) / 2, z: (min[2] + max[2]) / 2, sink };
}
/** The block leans 4 degrees about z, as if the sheep was caught mid-run. */
const TILT = (4 * Math.PI) / 180;
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The pose channels every state writes; they are blended between states so no state is a cut. */
const CH = { bodyY: 0, bodyRotX: 1, bodyRotZ: 2, headX: 3, headY: 4, headZ: 5, earL: 6, earR: 7, earBack: 8, eye: 9, puff: 10, legLift: 11, tail: 12, legSwing: 13, squash: 14, legFront: 15, legBack: 16, neckX: 17 } as const;
/** `neckX` (V5.1 Part 4.6) pitches the neck and the head together about the neck's base; species with no neck ignore it. */
const N = 18;
/** A rest pose to blend from before the first state lands: scales at 1, everything else at 0 (never a zero scale). */
function restPose(): Float32Array { const p = new Float32Array(N); p[CH.eye] = 1; p[CH.puff] = 1; p[CH.squash] = 1; return p; }
interface Face { brows: Brows; mouth: Mouth; lids: 'open' | Lids; breath: boolean }
const face0 = (): Face => ({ brows: 'neutral', mouth: 'flat', lids: 'open', breath: false });
const BROWS: Brows[] = ['neutral', 'up', 'worried'];
const MOUTHS: Mouth[] = ['flat', 'smile', 'o', 'chewL', 'chewDown', 'chewR'];
/** The four chewing frames. */
const CHEW: Mouth[] = ['flat', 'chewL', 'chewDown', 'chewR'];

/** The pitch that lifts a tail back (6.2's "tail up"): +0.3 for a tail hanging below its pivot, -0.3 for one above it. */
export function tailLiftOf(m: SheepModel | AnimalModel): number {
  const cells = (m.tail as Part & { cells?: Map<string, { y: number }> }).cells;
  if (!cells?.size) return -0.3;
  let dy = 0;
  for (const c of cells.values()) dy += (c.y + 0.5) * 0.04 - m.tail.pivot[1];
  return dy < 0 ? 0.3 : -0.3;
}

/** The species' channel ranges (V5.1 Part 6.6); every pose is clamped into them, and the pose test checks them. */
type Range = [number, number];
interface Ranges { headX: Range; neckX: Range; headY: number; headZ: number; bodyY: Range; squash: Range; legSwing: number; ears: Range }
const RANGES: Record<string, Ranges> = {
  sheep: { headX: [-0.35, 0.6], neckX: [0, 0], headY: 0.6, headZ: 0.2, bodyY: [0, 0.18], squash: [0.9, 1.06], legSwing: 0.49, ears: [DROOP - 0.3, DROOP + 0.4] },
  // The pig's and the hen's heads are flush with their bodies (Brian's sheets, 2026-11-18): small nods and turns only.
  pig: { headX: [-0.08, 0.12], neckX: [0, 0], headY: 0.15, headZ: 0.06, bodyY: [0, 0.18], squash: [0.9, 1.06], legSwing: 0.49, ears: [-0.5, 0.5] },
  cow: { headX: [-0.3, 0.35], neckX: [-0.15, 0.4], headY: 0.6, headZ: 0.2, bodyY: [0, 0.14], squash: [0.92, 1.05], legSwing: 0.45, ears: [-0.4, 0.4] },
  horse: { headX: [-0.3, 0.25], neckX: [-0.25, 0.6], headY: 0.6, headZ: 0.2, bodyY: [0, 0.16], squash: [0.92, 1.05], legSwing: 0.49, ears: [-0.4, 0.4] },
  goat: { headX: [-0.3, 0.35], neckX: [-0.2, 0.35], headY: 0.6, headZ: 0.25, bodyY: [0, 0.2], squash: [0.9, 1.06], legSwing: 0.49, ears: [-0.5, 0.5] },
  chicken: { headX: [-0.25, 0.03], neckX: [-0.15, 0.45], headY: 0.5, headZ: 0.03, bodyY: [0, 0.16], squash: [0.88, 1.08], legSwing: 0.35, ears: [0, 0] },
};
function clampPose(p: Float32Array, species: string) {
  const r = RANGES[species] ?? RANGES.sheep;
  p[CH.headX] = clamp(p[CH.headX], r.headX[0], r.headX[1]);
  p[CH.neckX] = clamp(p[CH.neckX], r.neckX[0], r.neckX[1]);
  p[CH.headY] = clamp(p[CH.headY], -r.headY, r.headY);
  p[CH.headZ] = clamp(p[CH.headZ], -r.headZ, r.headZ);
  p[CH.bodyY] = clamp(p[CH.bodyY], r.bodyY[0], r.bodyY[1]);
  p[CH.squash] = clamp(p[CH.squash], r.squash[0], r.squash[1]);
  p[CH.legSwing] = clamp(p[CH.legSwing], -r.legSwing, r.legSwing);
  p[CH.earL] = clamp(p[CH.earL], r.ears[0], r.ears[1]);
  p[CH.earR] = clamp(p[CH.earR], r.ears[0], r.ears[1]);
}
/** The grazers chew four frames every 12 s on their idle layer (6.5); the pig sniffs and the chicken bobs instead. */
const GRAZERS = new Set(['sheep', 'cow', 'goat', 'horse']);

// ---------- Fewer draws for the same picture (plan file 17, change 13, step 6) ----------
// Each mesh is a draw call in colour and one more into every shadow map it casts into, and three.js issues the call
// even for a mesh with nothing in it. So: a mesh with no triangles is never visible; parts that never move against
// each other and are drawn alike (one material, the same casting and receiving) are one geometry (`headBundle`); and
// the legs are one geometry while none of them is turned or lifted (`restBundle`). Nothing is rebuilt per frame: each
// bundle is built once for its model and shared by every animal of that species. No voxel, colour, pivot or pose
// changes; a part that moves is always drawn as its own mesh, with its own turn.
//
// What may go in a bundle is decided by where two parts put a face on the same plane (file 18's coincident faces). Of
// two such faces three.js shows the one drawn later; it draws separate meshes nearest first, by the middle of each
// one's geometry, and the triangles of one mesh in the order its parts were joined. So joining parts can change which
// face shows there. A leg that shares a face with the body or with another leg therefore stays a mesh of its own, and
// so do the tail (the fleece), the bell (the collar) and the neck (the coat), even at rest. The head's bundle is
// sorted where the head alone was, and the head is joined last, so it shows over a horn's root as it did from any
// side that root can be seen from.

/** Whether the tail is shown at a coat level: the sheep's goes with its fleece; every other species keeps its own. */
export const tailShown = (level: number, species: string): boolean => level > 0 || species !== 'sheep';
/** Where the tail sits along z: the sheep's moves back with its fleece's back (TAIL_BACK); another species' stays on its rump. */
const tailZ = (m: SheepModel | AnimalModel, species: string, lvl: 1 | 2 | 3 | 4): number => m.tail.pivot[2] - (species === 'sheep' ? TAIL_BACK[lvl] : 0);
/** Whether a geometry has anything to draw. */
const drawn = (g: BufferGeometry): boolean => (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) > 0;
/** A copy of `geo` moved by `by`: what a mesh at that position, with no turn, draws. The model's own geometry is not touched. */
const placed = (geo: BufferGeometry, by: V3): BufferGeometry => geo.clone().translate(by[0], by[1], by[2]);
/** Several geometries as one, in their order. Nothing when fewer than two have anything in them, or they cannot be joined. */
function joined(parts: BufferGeometry[]): BufferGeometry | null {
  const some = parts.filter(drawn);
  if (some.length < 2) return null;
  try { return mergeGeometries(some, false); } catch { return null; }
}
const relTo = (p: Part, to: Part): V3 => [p.pivot[0] - to.pivot[0], p.pivot[1] - to.pivot[1], p.pivot[2] - to.pivot[2]];
/**
 * A geometry's faces, a string each: the way it looks and its box, to a tenth of a millimetre. The mesher writes every
 * face as four vertices of its own; a geometry that is not made so answers with one face that matches anything asked.
 */
function facesOf(g: BufferGeometry, into = new Set<string>()): Set<string> {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  if (!p || !n || p.count % 4) return into.add('?');
  const r = (v: number) => Math.round(v * 1e4);
  for (let i = 0; i < p.count; i += 4) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = i; k < i + 4; k++) [p.getX(k), p.getY(k), p.getZ(k)].forEach((v, d) => { lo[d] = Math.min(lo[d], v); hi[d] = Math.max(hi[d], v); });
    into.add([n.getX(i), n.getY(i), n.getZ(i), ...lo, ...hi].map(r).join());
  }
  return into;
}
const sharesFace = (mine: Set<string>, theirs: Set<string>) => mine.has('?') || theirs.has('?') || [...mine].some((f) => theirs.has(f));

/** Where the hat sits on a head, and how big: on the top of `parts`' box, sized to its width. */
function hatFit(parts: BufferGeometry[]): { at: V3; scale: number } {
  const top = new Box3();
  for (const g of parts) {
    g.computeBoundingBox();
    top.union(g.boundingBox!);
  }
  const c = top.getCenter(new Vector3());
  return { at: [c.x, top.max.y - 0.06, c.z - 0.02], scale: Math.min(1, Math.max(0.55, (top.max.x - top.min.x) / 0.6)) };
}

/** One part of a bundle: its own geometry, and where (and how big) the bundle puts it in the group the bundle is drawn in. */
export interface BundleSource { geo: BufferGeometry; at: V3; scale: number }
const atScale = (s: BundleSource): BufferGeometry => (s.scale === 1 ? placed(s.geo, s.at) : s.geo.clone().scale(s.scale, s.scale, s.scale).translate(s.at[0], s.at[1], s.at[2]));

/**
 * The season's hats (plan file 03, change 4.12; ruling M17): while on, the hat is joined into the head's geometry at
 * build (the head's bundle, and the sheepdog's head through `withHat`); while off, no hat is built at all. They follow
 * `FESTIVE` in src/config.ts.
 */
// `?hats=0` on a development preview page draws the animals bare, to compare them with Brian's sheets.
export const HATS = FESTIVE && !(import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('hats') === '0');

/** What the head's bundle is made of, in the head group's own space, in the order it is joined (the head last). */
function headSources(m: SheepModel | AnimalModel): BundleSource[] {
  const am = m as Partial<AnimalModel>;
  // The hat sits on the measured crown (file 03, 4.7): the same place `hatFit` gave, read from the model's anchors.
  const fit = anchorsOf(m).hat;
  return [
    ...(am.signature ?? []).filter((sp) => sp.where === 'head' && !sp.anim).map((sp) => ({ geo: sp.geo, at: relTo(sp, m.head), scale: 1 })),
    ...(am.worn ? [{ geo: am.worn.geo, at: relTo(am.worn, m.head), scale: 1 }] : []),
    ...(HATS ? [{ geo: santaHat(), at: fit.at, scale: fit.scale }] : []),
    { geo: m.hood.geo, at: [0, 0, 0] as V3, scale: 1 }, { geo: m.head.geo, at: [0, 0, 0] as V3, scale: 1 },
  ].filter((p) => drawn(p.geo));
}

const headBundles = new WeakMap<object, BufferGeometry | null>();
/**
 * Everything that never moves against the head, as one geometry in the head group's own space: the signature parts
 * with no motion of their own (horns), a worn item, the hat where `SantaHat` puts it, the hood and, last, the head. All
 * of them wear the body's material, cast and do not receive, so one mesh draws what the separate ones drew. Its
 * bounding sphere is centred where the hood's was (the head's, for a species with no hood), so three.js sorts it for
 * drawing exactly as it sorted that mesh. Null if they cannot be joined; the component then mounts them one by one,
 * as it always did.
 */
function headBundle(m: SheepModel | AnimalModel): BufferGeometry | null {
  const hit = headBundles.get(m);
  if (hit !== undefined) return hit;
  const g = joined(headSources(m).map(atScale));
  if (g) {
    const lead = drawn(m.hood.geo) ? m.hood.geo : m.head.geo;
    if (!lead.boundingSphere) lead.computeBoundingSphere();
    const c = lead.boundingSphere!.center.clone(), p = g.getAttribute('position'), v = new Vector3();
    let far = 0;
    for (let i = 0; i < p.count; i++) far = Math.max(far, c.distanceToSquared(v.fromBufferAttribute(p, i)));
    g.boundingSphere = new Sphere(c, Math.sqrt(far));
  }
  headBundles.set(m, g);
  return g;
}

/**
 * Species whose legs are never joined. A joined leg's corners are worked out once, on the CPU, where its own mesh's
 * are worked out by the GPU every frame, and the two can round apart by a ten-millionth of a metre. For the pig that
 * was enough to move the edge of its front legs' shadow on the duel's ice by a row of the shadow map (four pixels, 40
 * levels, measured 2026-11-16), so its legs stay four meshes.
 */
const LEGS_APART = new Set<string>(['pig']);
/** The legs' rest bundle: its geometry, and which of the four legs are in it. */
interface Rest { geo: BufferGeometry; legs: boolean[]; sources: BundleSource[] }
const restBundles = new WeakMap<object, Rest | null>();
/**
 * The legs as they stand at rest (no swing, no lift) as one geometry in the body group's own space: each leg where its
 * own mesh puts it when it is not turned. They wear the body's material, cast and receive. Shown only while every leg
 * is exactly at rest, in place of those legs' meshes; a leg that moves is drawn by its own mesh. A leg that shares a
 * face with anything else the body group holds, or with another leg, is left out (the cow's and the horse's near
 * pair, both of the chicken's). Null when fewer than two legs are left, or they cannot be joined; and for a species in
 * `LEGS_APART`.
 */
function restBundle(m: SheepModel | AnimalModel): Rest | null {
  const hit = restBundles.get(m);
  if (hit !== undefined) return hit;
  const am = m as Partial<AnimalModel>;
  if (am.species && LEGS_APART.has(am.species)) { restBundles.set(m, null); return null; }
  // Everything else in the body group, where it stands at rest: the coats and the tail at every coat level.
  const others = new Set<string>();
  for (const l of [1, 2, 3, 4] as const) {
    facesOf(m.wools[l].geo, others);
    facesOf(m.frosts[l].geo, others);
    facesOf(placed(m.tail.geo, [m.tail.pivot[0], m.tail.pivot[1], tailZ(m, am.species ?? 'sheep', l)]), others);
  }
  for (const p of [m.sheared, m.collar, m.bell, ...(am.neck ? [am.neck] : []), ...(am.signature ?? []).filter((sp) => sp.where === 'body')]) facesOf(placed(p.geo, p.pivot), others);
  const legs = m.legs.map((leg) => placed(leg.geo, leg.pivot)), faces = legs.map((g) => facesOf(g));
  const free = legs.map((g, i) => drawn(g) && !sharesFace(faces[i], others) && !faces.some((f, j) => j !== i && drawn(legs[j]) && sharesFace(faces[i], f)));
  const geo = joined(legs.filter((_, i) => free[i]));
  const rest = geo ? { geo, legs: free, sources: m.legs.filter((_, i) => free[i]).map((leg) => ({ geo: leg.geo, at: leg.pivot, scale: 1 })) } : null;
  restBundles.set(m, rest);
  return rest;
}

const eyePairs = new WeakMap<object, BufferGeometry | null>();
const eyeSources = (m: SheepModel | AnimalModel): BundleSource[] => m.eyes.map((e) => ({ geo: e.geo, at: relTo(e, m.head), scale: 1 }));
/**
 * Both eyes as one geometry in the head group's own space, each where its own mesh puts it at its rest size. Shown
 * only while the eyes are exactly that size, in place of their two meshes. The face's parts (eyes, lids, brows,
 * mouths) share a material, so three.js draws them together, nearest first; joining the eyes changes only where they
 * fall in that run, which can show only where an eye puts a face on the same plane as another of the face's parts. So
 * an eye that does, with the other eye or with any lid, brow or mouth, leaves both eyes apart.
 */
function eyePair(m: SheepModel | AnimalModel): BufferGeometry | null {
  const hit = eyePairs.get(m);
  if (hit !== undefined) return hit;
  const eyes = m.eyes.map((e) => placed(e.geo, relTo(e, m.head))), faces = eyes.map((g) => facesOf(g));
  const face = new Set<string>();
  for (const g of [m.lids.closed.geo, m.lids.arc.geo, ...BROWS.map((b) => m.brows[b].geo), ...MOUTHS.map((k) => m.mouths[k].geo)]) facesOf(g, face);
  const apart = sharesFace(faces[0], faces[1]) || faces.some((f) => sharesFace(f, face));
  const g = apart || !eyes.every(drawn) ? null : joined(eyes);
  eyePairs.set(m, g);
  return g;
}

const hatted = new WeakMap<BufferGeometry, BufferGeometry>();
/**
 * A head with the season's hat on it, as one geometry (change 4.12): the hat where `SantaHat` puts it on that head,
 * joined before the head as in the animals' head bundle. The head alone while `HATS` is off, or if the two cannot be
 * joined. For a head drawn by a mesh of its own (the tutorial's sheepdog, table/places.tsx).
 */
export function withHat(head: BufferGeometry): BufferGeometry {
  if (!HATS) return head;
  let g = hatted.get(head);
  if (!g) {
    const fit = hatFit([head]);
    g = joined([atScale({ geo: santaHat(), at: fit.at, scale: fit.scale }), head]) ?? head;
    hatted.set(head, g);
  }
  return g;
}

// ---------- Two shadow draws per animal (plan file 03, change 4.13) ----------
// Each mesh that casts is one more draw into every shadow map it falls in. So the animal's own meshes stop casting,
// and two stand-ins cast for them: one in the body group (the coat, the legs, the tail, the bell, the neck and the
// body's own touches) and one in the head group (the head's bundle, the ears and the head's moving touches). Each is
// those parts' own cells, joined where the part stands at rest, in the group the part hangs in, so it moves with the
// body, the neck, the head and the whole animal exactly as they do. A part that turns on its own pivot (a leg in a
// stride, an ear in a twitch, the tail in a wag, a wing, the beard, the comb, the snout's sniff) is in its stand-in
// only while it is exactly at rest; while it is not, the stand-in is drawn without it and the part casts by itself,
// as every part did before. The coat's breath is the one motion carried by the whole body stand-in: it is drawn at
// the coat's scale while that is within BREATH of 1 (the legs, tail and bell with it, by under a fifth of a voxel at
// the 2.5% the coat breathes); past that (a puff) the coat casts by itself too.
// The stand-ins are on PROXY_LAYER only, which no camera draws, so they never add a colour draw. They are used only
// where every light that casts a shadow in the scene has that layer on its shadow camera (the table's sun and pile
// spot, Home's sun, the duel's moon and spot); in any other scene, and on a canvas whose lights do not, the animal
// casts as it always did. On the Low tier nothing casts (no change).

/** The layer the shadow stand-ins are on. The pile's spot draws its map from this layer too (BarnTable.tsx). */
export const PROXY_LAYER = 1;
/** How far the coat's scale may stand from 1 while the body stand-in carries it. */
const BREATH = 0.03;
/** The movers of the body group and of the head group: a bit set is a part at rest, in its stand-in. */
const B = { coat: 1, legs: 2, tail: 4, bell: 8, neck: 16, wings: 32 } as const;
const H = { ears: 1, moving: 2 } as const;
const ALL_B = 63, ALL_H = 3;
/** Which mover each casting mesh of `Sheep` belongs to (its `userData.shadow`); 'body' and 'head' never move apart. */
type ShadowRole = keyof typeof B | 'body' | 'head' | 'ears' | 'moving';
const isWing = (sp: SigPart) => sp.anim === 'wingL' || sp.anim === 'wingR';

/** `geo` through `m`, with nothing but its corners and its triangles: all a shadow map reads. */
function bareAt(geo: BufferGeometry, m: Matrix4): BufferGeometry {
  const b = new BufferGeometry();
  b.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) b.setIndex(geo.index.clone());
  return b.applyMatrix4(m);
}
const moveTo = (v: V3) => new Matrix4().makeTranslation(v[0], v[1], v[2]);
/** Stand-in parts as one geometry: an empty one when there is nothing, null when they cannot be joined. */
function standIn(parts: BufferGeometry[]): BufferGeometry | null {
  if (parts.length === 0) return new BufferGeometry();
  if (parts.length === 1) return parts[0];
  try { return mergeGeometries(parts, false); } catch { return null; }
}

const standIns = new WeakMap<object, Map<string, BufferGeometry | null>>();
function cachedStandIn(m: SheepModel | AnimalModel, key: string, make: () => BufferGeometry | null): BufferGeometry | null {
  let all = standIns.get(m);
  if (!all) standIns.set(m, (all = new Map()));
  if (!all.has(key)) all.set(key, make());
  return all.get(key)!;
}

/** The body group's stand-in at a coat level, with the movers in `mask` at rest, in the body group's own space. */
function bodyStandIn(m: SheepModel | AnimalModel, level: number, mask: number): BufferGeometry | null {
  return cachedStandIn(m, `b${level}:${mask}`, () => {
    const am = m as Partial<AnimalModel>, species = am.species ?? 'sheep';
    const lvl = Math.max(1, level) as 1 | 2 | 3 | 4;
    const parts: BufferGeometry[] = [];
    const put = (geo: BufferGeometry, at: V3) => { if (drawn(geo)) parts.push(bareAt(geo, moveTo(at))); };
    if (mask & B.coat) {
      if (level > 0) put(m.wools[lvl].geo, [0, 0, 0]);
      if (level === 0 || am.bodyAlways) put(m.sheared.geo, m.sheared.pivot);
    }
    if (mask & B.legs) for (const leg of m.legs) put(leg.geo, leg.pivot);
    if (mask & B.tail && tailShown(level, species)) put(m.tail.geo, [m.tail.pivot[0], m.tail.pivot[1], tailZ(m, species, lvl)]);
    if (mask & B.bell) put(m.bell.geo, m.bell.pivot);
    if (mask & B.neck && am.neck) put(am.neck.geo, am.neck.pivot);
    for (const sp of am.signature ?? []) if (sp.where === 'body' && (!isWing(sp) || mask & B.wings)) put(sp.geo, sp.pivot);
    return standIn(parts);
  });
}

/** The head group's stand-in with the movers in `mask` at rest, in the head group's own space. */
function headStandIn(m: SheepModel | AnimalModel, mask: number): BufferGeometry | null {
  return cachedStandIn(m, `h${mask}`, () => {
    const am = m as Partial<AnimalModel>;
    const parts = headSources(m).map((s) => bareAt(s.geo, moveTo(s.at).multiply(new Matrix4().makeScale(s.scale, s.scale, s.scale))));
    if (mask & H.ears) {
      // As the frame loop stands them at rest: turned about z by DROOP, the right one the other way.
      m.ears.forEach((ear, i) => { if (drawn(ear.geo)) parts.push(bareAt(ear.geo, moveTo(relTo(ear, m.head)).multiply(new Matrix4().makeRotationZ(i === 0 ? DROOP : -DROOP)))); });
    }
    if (mask & H.moving) for (const sp of am.signature ?? []) if (sp.where === 'head' && sp.anim && drawn(sp.geo)) parts.push(bareAt(sp.geo, moveTo(relTo(sp, m.head))));
    return standIn(parts);
  });
}

const sceneProxies = new WeakMap<object, { at: number; on: boolean }>();
/**
 * Whether the stand-ins are drawn in `scene`: every light there that casts has PROXY_LAYER on its shadow camera (and
 * there is one). Looked at again each second, once for every animal in the scene.
 */
function proxiesOn(scene: Object3D, now: number): boolean {
  const hit = sceneProxies.get(scene);
  if (hit && now >= hit.at && now - hit.at < 1) return hit.on;
  let any = false, all = true;
  scene.traverse((o) => {
    const l = o as Light & { shadow?: LightShadow };
    if (!l.isLight || !l.castShadow || !l.shadow) return;
    any = true;
    if (!l.shadow.camera.layers.isEnabled(PROXY_LAYER)) all = false;
  });
  const on = any && all;
  sceneProxies.set(scene, { at: now, on });
  return on;
}

/**
 * The pose for a state at `e` seconds into it: V5.1 Part 6.2's base table for every species, then the species' deltas
 * (6.3, `flavour`), then the ranges (6.6). The idle layer (blink, ear twitch, chew) is passed in; the speaker's chest-up
 * and slow tail wag are laid over idle and thinking.
 */
function poseFor(p: Float32Array, f: Face, live: SheepState, e: number, t: number, moving: boolean, speaking: boolean, blink: boolean, twitch: number, chew: Mouth | null, pace = 0, species = 'sheep') {
  // `t` is already offset by this animal's own phase, so no two move in step.
  p.fill(0);
  p[CH.eye] = 1;
  p[CH.puff] = 1;
  p[CH.squash] = 1;
  p[CH.earL] = DROOP - twitch;
  p[CH.earR] = DROOP;
  f.brows = 'neutral';
  f.mouth = (GRAZERS.has(species) && chew) || 'flat';
  f.lids = blink ? 'closed' : 'open';
  f.breath = false;
  const sway = moving ? Math.sin(t * 0.7) * 0.05 : 0;
  switch (live) {
    case 'idle':
      p[CH.headY] = sway;
      p[CH.headX] = moving ? Math.sin(t * 0.9) * 0.03 : 0;
      break;
    case 'thinking':
      p[CH.headZ] = 0.15;
      p[CH.headY] = sway * 0.6;
      p[CH.earR] = -0.4; // one ear up
      break;
    case 'sleeping':
      f.lids = 'closed';
      f.mouth = 'flat';
      p[CH.headX] = 0.2;
      p[CH.earL] = p[CH.earR] = DROOP + 0.3;
      break;
    // The leaderboards' loungers on their pedestals (Brian, 2026-11-14: "nonchalant poses, like 3rd place sleeping on his
    // belly with his legs dangling off the pedestal"). The pedestal holds the body; these set the legs, head and face.
    case 'flop': // asleep on its belly over an edge, the legs hanging and swinging a little, the head lolled toward us
      f.lids = 'closed';
      f.mouth = 'flat';
      p[CH.headX] = 0.6;
      p[CH.neckX] = 0.5;
      p[CH.headY] = 0.45;
      p[CH.headZ] = 0.12;
      p[CH.earL] = DROOP + 0.3 - twitch;
      p[CH.earR] = DROOP + 0.3;
      p[CH.legFront] = moving ? Math.sin(t * 0.8) * 0.1 : 0;
      p[CH.legBack] = moving ? Math.sin(t * 0.8 + 2) * 0.12 : 0;
      break;
    case 'perch': // sat up on the edge, both pairs of legs over it, heels kicking, chewing, looking off to one side
      p[CH.bodyRotX] = -0.9;
      p[CH.legBack] = 0.7 + (moving ? Math.sin(t * 2.2) * 0.2 : 0);
      p[CH.legFront] = 0.8;
      p[CH.legSwing] = moving ? Math.sin(t * 1.1) * 0.08 : 0;
      p[CH.headX] = 0.6;
      p[CH.neckX] = 0.3;
      p[CH.headY] = 0.45 + sway;
      p[CH.tail] = moving ? Math.sin(t * 1.4) * 0.3 : 0;
      f.mouth = moving ? CHEW[Math.floor(t / 0.35) % 4] : 'flat';
      break;
    case 'lounge': // sat right back, hind legs stretched out along the top, one ear cocked, a smile and a slow blink
      p[CH.bodyRotX] = -1;
      p[CH.legBack] = -0.57;
      p[CH.legFront] = 0.9;
      p[CH.headX] = 0.6;
      p[CH.neckX] = 0.3;
      p[CH.earR] = -0.4;
      p[CH.tail] = moving ? Math.sin(t * 1.4) * 0.3 : 0;
      f.mouth = 'smile';
      if (moving && t % 5 < 0.6) f.lids = 'closed';
      break;
    case 'grazing':
      // The neck and the head go down by the species' own amounts (6.3); the sheep has no neck, so its head does it all.
      p[CH.headX] = 0.6 + (moving ? Math.sin(t * 3.1) * 0.03 : 0);
      f.mouth = moving ? CHEW[Math.floor(t / 0.2) % 4] : 'flat';
      break;
    case 'proud':
      p[CH.headX] = -0.3;
      p[CH.neckX] = -0.1;
      p[CH.puff] = 1.06;
      p[CH.bodyRotX] = -0.05;
      f.mouth = 'smile';
      f.lids = e > 0.4 && e < 0.9 ? 'closed' : 'open'; // one slow blink
      break;
    case 'happy': {
      const hop = e < 0.8 ? Math.abs(Math.sin((e / 0.4) * Math.PI)) * 0.16 : 0;
      p[CH.bodyY] = hop;
      p[CH.legSwing] = hop * 1.5;
      p[CH.tail] = moving ? Math.sin(t * 12) * 0.5 : 0;
      p[CH.earL] = p[CH.earR] = DROOP - 0.25;
      f.lids = 'arc';
      f.mouth = 'smile';
      break;
    }
    case 'startled':
      p[CH.bodyY] = e < 0.3 ? Math.sin((e / 0.3) * Math.PI) * 0.14 : 0;
      p[CH.legSwing] = e < 0.5 ? 0.35 : 0;
      p[CH.headX] = -0.15;
      p[CH.eye] = 1.25;
      p[CH.earBack] = 1;
      f.brows = 'up';
      f.mouth = 'o';
      f.lids = 'open';
      break;
    case 'cold':
      // A hunch; the shiver (+-0.01 at 25 rad/s) is a sideways shake applied with the pose.
      p[CH.bodyRotX] = 0.12;
      p[CH.headX] = 0.25;
      p[CH.earL] = p[CH.earR] = DROOP + 0.3;
      f.brows = 'worried';
      f.mouth = 'flat';
      f.breath = moving;
      break;
    case 'dazed': {
      // The bomb went off beside it: thrown up a little, knocked back onto its haunches, and its head rolls round and
      // round (the table puts the stars over it) until the beat is over and it gets back up.
      const k = clamp01(e / 0.18), up = clamp01((DAZED_S - e) / 0.35), roll = moving ? e * 5.2 : 0.8;
      p[CH.bodyY] = e < 0.25 ? Math.sin((e / 0.25) * Math.PI) * 0.12 : 0;
      p[CH.bodyRotX] = -0.2 * k * up;
      p[CH.legBack] = 0.8 * k * up;
      p[CH.legFront] = -0.22 * k * up;
      p[CH.headX] = 0.08;
      p[CH.headZ] = Math.sin(roll) * 0.22 * up;
      p[CH.headY] = Math.cos(roll) * 0.2 * up;
      p[CH.earL] = p[CH.earR] = DROOP + 0.25;
      f.brows = 'worried';
      f.mouth = 'o';
      f.lids = moving && Math.floor(e / 0.3) % 2 ? 'arc' : 'open';
      break;
    }
    case 'freezing':
      // The shiver grows to +-0.02 as the frost fades in; the eyes close at the end.
      p[CH.bodyRotX] = 0.12;
      p[CH.headX] = 0.25;
      p[CH.earL] = p[CH.earR] = DROOP + 0.3;
      f.brows = 'worried';
      f.lids = e > 2.0 ? 'closed' : 'open';
      break;
    case 'frozen':
      // Caught mid-stride: a front leg up, the body leaning back, inside the block.
      p[CH.legLift] = 0.12;
      p[CH.bodyRotX] = -0.14;
      p[CH.puff] = 1.06;
      p[CH.earBack] = 0.6;
      f.lids = 'closed';
      break;
    case 'thawing':
      // A shake (+-0.03 at 20 rad/s, applied with the pose), two blinks, the ears flapping.
      f.lids = (e > 0.3 && e < 0.42) || (e > 0.6 && e < 0.72) ? 'closed' : 'open';
      p[CH.earL] += moving ? Math.sin(e * 18) * 0.2 : 0;
      p[CH.earR] += moving ? Math.sin(e * 18 + 1) * 0.2 : 0;
      f.mouth = 'smile';
      break;
    // The walk (the lobby's pen): an amble, the trot's pairs at a third of its speed. Legs swing +-17 degrees, the head
    // nods with each step, the tail sways; no smile, no flapping ears. It is an animal going somewhere, not hurrying.
    case 'walk': {
      const w = Math.PI / WALK_HALF_STEP;
      const stride = moving ? Math.sin(t * w) : 0;
      p[CH.legSwing] = stride * 0.3;
      p[CH.bodyY] = moving ? Math.abs(stride) * 0.008 : 0;
      p[CH.headX] = 0.05 + stride * 0.025;
      p[CH.tail] = moving ? Math.sin(t * w * 0.5) * 0.2 : 0;
      break;
    }
    // The run (Counting Sheep): a trot, front-left with back-right, 110 ms a half-step slowing to 70 at full pace; legs
    // swing +-28 degrees, the head bobs, ears flap 8 degrees, the tail wags, the whole body squashes 1.5% at the step.
    case 'run': {
      const half = (TROT_MS.slow + (TROT_MS.fast - TROT_MS.slow) * pace) / 1000;
      const w = Math.PI / half;
      const stride = moving ? Math.sin(t * w) : 0;
      p[CH.legSwing] = stride * 0.49;
      p[CH.bodyY] = moving ? Math.abs(Math.sin(t * w)) * 0.02 : 0;
      p[CH.headX] = moving ? Math.sin(t * w) * 0.04 : 0;
      p[CH.earL] = DROOP - twitch + stride * 0.14;
      p[CH.earR] = DROOP - stride * 0.14;
      p[CH.squash] = 1 + Math.abs(stride) * 0.015;
      p[CH.tail] = moving ? Math.sin(t * w * 0.5) * 0.35 : 0;
      f.mouth = 'smile';
      break;
    }
    case 'jump': {
      // Over the 0.72 s arc: a crouch (squash 0.92 for 80 ms), the back legs drive while the front legs fold forward to
      // 50 degrees and the back legs trail to 40, a stretch at the apex (1.06), then the front legs reach for the snow.
      const u = clamp01(e / 0.72);
      const rise = clamp01(u / 0.3), fall = clamp01((u - 0.55) / 0.45);
      p[CH.squash] = e < 0.08 ? 0.92 : 1 + 0.06 * Math.sin(Math.PI * clamp01((u - 0.1) / 0.8));
      p[CH.legFront] = -0.25 - 0.62 * rise + 0.6 * fall;
      p[CH.legBack] = 0.7 - 0.45 * clamp01(u / 0.5) + 0.45 * fall;
      p[CH.earBack] = -0.2 - 0.5 * fall;
      p[CH.earL] = p[CH.earR] = DROOP - 0.3;
      p[CH.tail] = 0.5 - 0.8 * fall;
      p[CH.headX] = 0.1 - 0.22 * rise + 0.3 * fall;
      p[CH.eye] = 1.2;
      f.mouth = 'smile';
      break;
    }
    case 'land':
      // The legs take the weight (squash 0.90 for 100 ms), the head dips.
      p[CH.squash] = e < 0.1 ? 0.9 : 1;
      p[CH.legFront] = -0.12;
      p[CH.legBack] = 0.14;
      p[CH.headX] = 0.14;
      p[CH.earL] = p[CH.earR] = DROOP + 0.12;
      f.mouth = 'smile';
      break;
    case 'bonk': {
      // Recoil and sit: the back legs fold, the body tips back 15 degrees, ears back, worried brows, an "o", lids arced
      // for 200 ms. (The stage carries the recoil and the stars.)
      const k = clamp01(e / 0.2);
      p[CH.bodyRotX] = -0.26 * k;
      p[CH.legBack] = 1.0 * k; // folded, the hooves still under the belly line (6.6)
      p[CH.legFront] = -0.3 * k;
      p[CH.headX] = 0.1;
      p[CH.earBack] = 1;
      f.brows = 'worried';
      f.mouth = 'o';
      f.lids = e < 0.2 ? 'arc' : 'open';
      break;
    }
  }
  if (speaking && (live === 'idle' || live === 'thinking')) {
    p[CH.puff] = 1.03; // chest up
    p[CH.tail] = moving ? Math.sin(t * 3) * 0.35 : 0; // a slow wag
  }
  flavour(p, f, species, live, e, t, moving);
  clampPose(p, species);
}

/** The species' deltas (V5.1 Part 6.3): only what differs from the base table, never a fork of it. */
function flavour(p: Float32Array, f: Face, species: string, live: SheepState, e: number, t: number, moving: boolean) {
  const calm = live === 'idle' || live === 'thinking' || live === 'proud';
  const pulse = (period: number, len: number) => (moving && t % period < len ? Math.sin(((t % period) / len) * Math.PI) : 0);
  switch (species) {
    case 'sheep':
      if (live === 'frozen') p[CH.legLift] = 0.05; // a short leg lifts less, or its hoof rises past the belly
      break;
    case 'pig':
      if (calm && moving) { p[CH.earL] += Math.sin(t * 1.9) * 0.1; p[CH.earR] += Math.sin(t * 1.9 + 0.4) * 0.1; } // ears flop with the breath
      if (live === 'grazing') { p[CH.headX] = 0.35; p[CH.headZ] = 0; f.mouth = 'flat'; } // rooting: the snout nudges (6.4)
      if (live === 'proud') p[CH.headX] = -0.35; // snout up
      if (live === 'happy') p[CH.tail] = moving ? Math.sin(e * 30) * 0.8 : 0; // the curl spins
      if (live === 'frozen') p[CH.legLift] = 0.05; // a short leg lifts less, or its hoof rises past the belly
      if (live === 'jump') p[CH.earBack] = 0; // the ears already fold forward beside the eyes: they bounce, never swing in
      if (live === 'startled') p[CH.earL] = p[CH.earR] = -0.45; // ears straight up
      break;
    case 'cow':
      if (calm) { p[CH.tail] = moving ? Math.sin(t * 1.4) * 0.35 : 0; if (moving && t % 8 < 0.8) f.mouth = CHEW[Math.floor((t % 8) / 0.2) % 4]; }
      if (calm) p[CH.earL] -= pulse(9, 0.3) * 0.4; // an ear flick (idle and thinking)
      if (live === 'grazing') { p[CH.neckX] = 0.35; p[CH.headX] = 0.3 + (moving ? Math.sin(t * 3.1) * 0.03 : 0); }
      if (live === 'happy') { const hop = e < 0.4 ? Math.sin((e / 0.4) * Math.PI) * 0.12 : 0; p[CH.bodyY] = hop; p[CH.legSwing] = hop * 1.5; } // one hop only
      break;
    case 'horse':
      if (calm) { p[CH.tail] = moving ? Math.sin(t * 1.6) * 0.45 : 0; p[CH.headX] -= pulse(9, 0.5) * 0.25; } // swish, a head toss
      if (live === 'grazing') { p[CH.neckX] = 0.55; p[CH.headX] = 0.15; p[CH.legLift] = pulse(4, 0.4) * 0.06; } // one hoof paws
      if (live === 'proud') { p[CH.neckX] = -0.2; p[CH.earBack] = -0.3; } // neck arched higher, ears forward
      if (live === 'happy' && e < 0.6) { p[CH.legFront] = -0.5; p[CH.bodyRotX] = -0.15; p[CH.headY] = moving ? Math.sin(e * 20) * 0.2 : 0; } // rear, mane shake
      if (live === 'startled') p[CH.tail] = 0; // tail up (drawn with the tail's lift)
      if (live === 'sleeping') p[CH.neckX] = 0.3;
      if (live === 'thinking') p[CH.earBack] = -0.25; // an ear turned to the speaker
      if (live === 'run') p[CH.tail] = -0.4; // mane and tail stream
      break;
    case 'goat':
      if (calm) p[CH.headZ] += pulse(7, 1.2) * 0.15; // a head tilt now and then
      if (live === 'grazing') { p[CH.neckX] = 0.3; p[CH.headX] = 0.3 + (moving ? Math.sin(t * 3.1) * 0.03 : 0); }
      if (live === 'proud') { p[CH.neckX] = -0.15; p[CH.legFront] = 0.3; } // head high, one hoof forward
      if (live === 'happy') p[CH.bodyRotZ] = moving && e < 0.8 ? Math.sin((e / 0.4) * Math.PI) * 0.1 : 0; // two hops with a twist
      if (live === 'thinking') p[CH.eye] = 1.2; // the iris widens
      break;
    case 'chicken': {
      if (calm) p[CH.headX] += moving ? Math.max(0, Math.sin(t * 2.5)) * 0.1 : 0; // the head bob
      if (live === 'grazing') {
        // Pecks: three in 1.2 s, every 3 s; no chewing.
        const c = t % 3, peck = moving && c < 1.2 ? Math.abs(Math.sin((c / 0.4) * Math.PI)) : 0;
        p[CH.neckX] = 0.4 * peck; p[CH.headX] = 0.45 * peck; f.mouth = 'flat';
      }
      if (live === 'proud') p[CH.puff] = 1.08;
      if (live === 'frozen') p[CH.legLift] = 0.03; // a short leg lifts less, or its foot rises past the belly
      if (live === 'startled') p[CH.puff] = 1.1;
      if (live === 'cold') p[CH.puff] = 1.12;
      if (live === 'sleeping') { p[CH.neckX] = 0.35; p[CH.headX] = 0.2; } // the head tucked
      if (live === 'thinking') p[CH.headY] = 0.4; // one eye to the camera
      if (live === 'run') { p[CH.legSwing] = Math.sign(p[CH.legSwing]) * Math.min(Math.abs(p[CH.legSwing]), 0.35); p[CH.bodyRotZ] = p[CH.legSwing] / 0.35 * 0.08; } // the waddle
      break;
    }
    default: break;
  }
}

/**
 * The default sheep with every behaviour of plan V3.3 Part 3.3 (idle, attention, speaker, happy, proud, startled,
 * cold, thinking, sleeping), the freeze sequence and the thaw, all driven from one useFrame. Every state's pose is
 * blended from the previous one over 200 ms with an ease-out, so no state is a cut. Every player uses this same
 * model; only level, state and seat differ. Each coat level is its own fleece built to fit the head and legs, so
 * growing or losing wool swaps the fleece rather than scaling it into the other parts.
 */
export function Sheep({ level, state, stateKey = 0, dimmed = false, reduced = false, still = false, gustFrom = [0, 0.8, -4], scarf = false, headYaw = 0, lookAt, speaking = false, thinking = false, pace = 0, model, contact = true, rig }: Props) {
  const m = model ?? sheepModel();
  // Low tier: no animal casts a shadow; it stands on its contact patch instead (plan file 02, change 5).
  const low = useTier() === 'low';
  const cast = !low;
  const patchMat = useMemo(() => animalMaterial(), []);
  const am = m as Partial<AnimalModel>;
  const species = am.species ?? 'sheep';
  const bodyAlways = am.bodyAlways ?? false;
  const signature: SigPart[] = am.signature ?? [];
  const mat = useMemo(() => animalMaterial(), []);
  // Eyes, brows and mouth frost only lightly, so the scared face still reads through the ice.
  const faceMat = useMemo(() => animalMaterial(), []);
  // A lid lies in its eye's cells (rig.ts, lidsAndBrows), so it is pulled a hair toward the camera to win over the eye.
  const lidMat = useMemo(() => Object.assign(animalMaterial(), { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), []);
  const breathMat = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 })), []);
  const frost = useMemo(() => new Color(FROST), []);
  const white = useMemo(() => new Color('#ffffff'), []);
  const fx = useMemo(() => freezeFx(m), [m]);
  const r = useRef<Record<string, Object3D | null>>({});
  const root = useRef<Group>(null);
  const set = (k: string) => (o: Object3D | null) => { r.current[k] = o; };
  // Animation memory: the state's start, the pose being blended from, and this sheep's own idle timers.
  const anim = useMemo(() => ({
    key: -1, state: '' as SheepState, at: 0, live: '' as SheepState, blendAt: -10, level, levelAt: -10,
    cur: restPose(), from: restPose(), target: restPose(),
    face: face0(), faceFrom: face0(), faceTarget: face0(),
    nextBlink: 2 + Math.random() * 3, blinkAt: -10, phase: Math.random() * 20, rate: 0.82 + Math.random() * 0.36, att: { yaw: 0, pitch: 0 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useMemo(() => new Vector3(), []);
  // "Tail up" turns the tail back, whichever way it grows: a hanging tail pitches +x, one that points up pitches -x.
  const tailLift = useMemo(() => tailLiftOf(m), [m]);
  // Fewer draws, same picture: the head with everything fixed to it as one geometry, and the legs as one for as long
  // as they stand still (the frame loop shows it then, and the legs' own meshes the moment one moves).
  const headGeo = useMemo(() => headBundle(m), [m]);
  const restOf = useMemo(() => restBundle(m), [m]);
  const eyesGeo = useMemo(() => eyePair(m), [m]);

  useFrame(({ clock, camera, scene }, dt) => {
    const t = clock.elapsedTime;
    const a = anim;
    const o = r.current;
    const body = o.body as Group, head = o.head as Group, wool = o.wool as Mesh;
    if (!body || !head || !wool || !root.current) return;
    if (a.key !== stateKey || a.state !== state) a.key = stateKey, a.state = state, a.at = t;
    const e = t - a.at;
    const dur = DURATION[state];
    let live: SheepState = dur !== undefined && e > dur ? (state === 'freezing' ? 'frozen' : 'idle') : state;
    if (live === 'idle' && thinking) live = 'thinking';
    if (a.level !== level) a.level = level, a.levelAt = t;
    const moving = !still && !reduced && live !== 'frozen';

    // The idle layer: a blink every 3.5 to 5 s, an ear twitch every 7 s, a chew every 12 s, each on this sheep's own clock.
    if (moving && t >= a.nextBlink) a.blinkAt = t, a.nextBlink = t + 3.5 + Math.random() * 1.5;
    const blink = t - a.blinkAt < 0.12;
    // Each sheep runs its own clock: a random phase and a rate within ±18%, so sway, breath, twitches and chews drift apart.
    const tp = (t + a.phase) * a.rate;
    const twitch = moving && tp % 7 < 0.25 ? Math.sin(((tp % 7) / 0.25) * Math.PI) * 0.35 : 0;
    const chew = moving && tp % 12 < 0.8 ? CHEW[Math.floor((tp % 12) / 0.2) % 4] : null;

    // This frame's pose, blended over 200 ms from the pose the sheep was in when its state last changed.
    poseFor(a.target, a.faceTarget, live, e, tp, moving, speaking, blink, twitch, chew, pace, species);
    if (live !== a.live) { a.from.set(a.cur); Object.assign(a.faceFrom, a.face); a.live = live; a.blendAt = t; }
    const w = reduced ? 1 : easeOut((t - a.blendAt) / 0.2);
    const c = a.cur;
    for (let i = 0; i < N; i++) c[i] = a.from[i] + (a.target[i] - a.from[i]) * w;
    Object.assign(a.face, w < 0.5 ? a.faceFrom : a.faceTarget);
    const f = a.face;
    // A pose handed in whole (the leaderboards'): its lids win; the state's blink still closes open ones.
    const rp = rig ? rig(t) : null;
    if (rp?.lids === 'closed') f.lids = 'closed';

    // Attention: the head turns (up to 0.6 rad) and tilts toward the speaker or the camera, trailing the target a little.
    const attentive = live === 'idle' || live === 'thinking' || live === 'proud' || live === 'happy' || live === 'cold';
    let wantYaw = 0, wantPitch = 0;
    if (attentive) {
      if (lookAt) {
        if (lookAt === 'camera') v.copy(camera.position); else v.set(lookAt[0], lookAt[1], lookAt[2]);
        root.current.worldToLocal(v);
        const dx = v.x - m.head.pivot[0], dy = v.y - (m.head.pivot[1] + 0.14), dz = v.z - m.head.pivot[2];
        wantYaw = Math.atan2(dx, dz);
        wantPitch = -Math.atan2(dy, Math.hypot(dx, dz));
      } else wantYaw = typeof headYaw === 'number' ? headYaw : headYaw.current;
    }
    wantYaw = clamp(wantYaw, -0.6, 0.6);
    wantPitch = clamp(wantPitch, -0.3, 0.2);
    const ka = reduced ? 1 : 1 - Math.exp(-dt / 0.18);
    a.att.yaw += (wantYaw - a.att.yaw) * ka;
    a.att.pitch += (wantPitch - a.att.pitch) * ka;

    // Apply the pose.
    // Sideways shakes (6.2): the cold shiver +-0.01 at 25 rad/s, growing to +-0.02 while freezing, the thaw's +-0.03 at
    // 20 rad/s; the goat's startle jumps 0.06 sideways (6.3).
    const shiver = !moving ? 0
      : live === 'cold' ? Math.sin(tp * 25) * 0.01
      : live === 'freezing' ? Math.sin(tp * 25) * (0.01 + 0.01 * clamp01(e / 2.4))
      : live === 'thawing' ? Math.sin(e * 20) * 0.03 * (1 - clamp01(e / 1.2))
      : species === 'goat' && live === 'startled' ? Math.sin(clamp01(e / 0.3) * Math.PI) * 0.06 : 0;
    body.position.set(shiver, c[CH.bodyY], 0);
    body.rotation.set(c[CH.bodyRotX], 0, c[CH.bodyRotZ]);
    head.rotation.set(c[CH.headX] + a.att.pitch + (am.headPitch ?? 0), c[CH.headY] + a.att.yaw, c[CH.headZ]);
    if (o.neck) (o.neck as Group).rotation.x = am.neckBase ? c[CH.neckX] : 0;
    (o.earL as Mesh).rotation.set(0, -c[CH.earBack], c[CH.earL]);
    (o.earR as Mesh).rotation.set(0, c[CH.earBack], -c[CH.earR]);
    if (rp) {
      body.position.set(rp.bodyAt[0], rp.bodyAt[1], rp.bodyAt[2]);
      body.rotation.set(rp.body[0], rp.body[1], rp.body[2]);
      const hp = fromNeck(m.head.pivot);
      head.position.set(hp[0] + rp.headAt[0], hp[1] + rp.headAt[1], hp[2] + rp.headAt[2]);
      head.rotation.set(rp.head[0] + (am.headPitch ?? 0), rp.head[1], rp.head[2]);
      if (o.neck) (o.neck as Group).rotation.x = am.neckBase ? rp.neck : 0;
      (o.earL as Mesh).rotation.set(0, 0, rp.ears[0]);
      (o.earR as Mesh).rotation.set(0, 0, -rp.ears[1]);
    }
    // Breathing: the body lobes swell 2.5% either way; the fleece settles into place over half a second when the level changes.
    const breathe = moving && live !== 'freezing' && live !== 'startled' ? Math.sin(tp * (live === 'sleeping' || live === 'flop' ? 1.0 : 1.9)) * 0.025 : 0;
    const settle = reduced ? 1 : 0.94 + 0.06 * easeOut((t - a.levelAt) / 0.5);
    const lvl = Math.max(1, level) as 1 | 2 | 3 | 4;
    if (wool.geometry !== m.wools[lvl].geo) {
      wool.geometry = m.wools[lvl].geo;
      (o.frost as Mesh).geometry = m.frosts[lvl].geo;
    }
    wool.visible = level > 0 && drawn(wool.geometry);
    // Swell about the legs' tops, not the ground: scaled from y 0 the belly rose off the legs with every breath and puff.
    const ws = settle * c[CH.puff] * (1 + breathe);
    wool.scale.set(ws, ws, ws);
    wool.position.y = swellY(m.legs[0].pivot[1], ws);
    (o.sheared as Mesh).visible = (level === 0 || bodyAlways) && drawn(m.sheared.geo);
    // The species' own touches: the snout sniffs, wings flap, the beard wags, the comb wobbles.
    for (const sp of signature) {
      const mesh = o[`sig-${sp.name}`] as Mesh | undefined;
      if (!mesh || !sp.anim) continue;
      if (sp.anim === 'snout') {
        // Two sniffs every 6 s in the calm states; while rooting, a 0.03 m push forward at 2.6 rad/s (6.4).
        const k = moving && tp % 6 < 0.6 && live !== 'grazing' ? 1 + 0.08 * Math.sin((tp % 6) / 0.6 * Math.PI * 2) ** 2 : 1;
        mesh.scale.setScalar(k);
        mesh.position.z = sp.pivot[2] - m.head.pivot[2] + (moving && live === 'grazing' ? Math.max(0, Math.sin(tp * 2.6)) * 0.03 : 0);
      }
      else if (sp.anim === 'wingL' || sp.anim === 'wingR') {
        // About the shoulder root (6.4): held 0.2 in the run, 0.4 proud, 0.6 startled, 0.7 airborne, a 0.9 flap for 1 s happy.
        const dir = sp.anim === 'wingL' ? 1 : -1;
        const open = live === 'happy' ? (moving && e < 1 ? Math.abs(Math.sin(e * 18)) * 0.9 : 0)
          : live === 'run' ? 0.2 : live === 'proud' ? 0.4 : live === 'startled' ? 0.6 : live === 'jump' ? 0.7 : 0;
        mesh.rotation.z = dir * (rp ? rp.wings[sp.anim === 'wingL' ? 0 : 1] : open);
      }
      else if (sp.anim === 'beard') mesh.rotation.x = moving && (live === 'idle' || live === 'grazing') ? Math.sin(tp * 2.2) * 0.12 : 0;
      else if (sp.anim === 'comb') mesh.rotation.z = moving ? Math.sin(tp * 2.5) * 0.08 : 0;
    }
    const tail = o.tail as Mesh;
    // Only the sheep is shorn of its tail: it grows with the fleece. Every other species keeps its own (file 03, 4.1).
    tail.visible = tailShown(level, species) && drawn(m.tail.geo);
    tail.rotation.y = c[CH.tail];
    // The tail lifts when proud (and the horse's when startled); the chicken's fan spreads 1.2 proud and happy, folds 0.9
    // cold, and breathes +-4% at rest (6.4, 6.3).
    tail.rotation.x = live === 'proud' || (species === 'horse' && live === 'startled') ? tailLift : 0;
    if (rp) tail.rotation.set(rp.tail[0], rp.tail[1], 0);
    if (am.tailAnim === 'tailFan') tail.scale.x = live === 'proud' || live === 'happy' ? 1.2 : live === 'cold' ? 0.9 : 1 + (moving ? Math.sin(tp * 1.9) * 0.04 : 0);
    tail.position.z = tailZ(m, species, lvl);
    const fl = o.legFL as Mesh;
    // The trot pairs front-left with back-right; a jump sets the front and back pairs apart.
    fl.rotation.x = -c[CH.legSwing] - c[CH.legLift] * 5 + c[CH.legFront];
    fl.position.y = m.legs[0].pivot[1] + c[CH.legLift];
    (o.legFR as Mesh).rotation.x = c[CH.legSwing] + c[CH.legFront];
    (o.legBL as Mesh).rotation.x = c[CH.legSwing] + c[CH.legBack];
    (o.legBR as Mesh).rotation.x = -c[CH.legSwing] + c[CH.legBack];
    if (rp) {
      // Each leg about its own pivot, moved by its offset: the swing, then the spread (x, then z).
      [fl, o.legFR as Mesh, o.legBL as Mesh, o.legBR as Mesh].forEach((leg, i) => {
        leg.position.set(m.legs[i].pivot[0] + rp.legsAt[i][0], m.legs[i].pivot[1] + rp.legsAt[i][1], m.legs[i].pivot[2] + rp.legsAt[i][2]);
        leg.rotation.set(rp.legs[i][0], 0, rp.legs[i][1]);
      });
    }
    // Squash and stretch on the whole sheep, volume kept: shorter and wider, or taller and narrower. (A scene that hands
    // in its own pose squashes the animal itself, about where its weight bears.)
    const sq = rp ? 1 : Math.max(0.5, c[CH.squash] || 1);
    root.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // The `bell` tag (the sheep's and the cow's) swings about its top (6.4): +-0.3 rad dying away over 0.8 s on happy, jump and bonk; +-0.08 in the run.
    const bell = o.bell as Mesh;
    bell.rotation.x = !moving ? 0
      : live === 'happy' || live === 'jump' || live === 'bonk' ? Math.sin(e * 24) * 0.3 * Math.max(0, 1 - e / 0.8)
      : live === 'run' ? Math.sin(tp * 12) * 0.08 : 0;
    // Standing still (no swing, no lift), the legs are drawn as one mesh (`restBundle`): the same triangles in the same
    // places with the same material and shadows, in one draw call. The moment a leg moves, each is drawn by its own
    // mesh again.
    const fr = o.legFR as Mesh, bl = o.legBL as Mesh, br = o.legBR as Mesh, restMesh = o.rest as Mesh | null | undefined;
    const rest = !rp && restMesh && restOf && c[CH.legLift] === 0 && fl.rotation.x === 0 && fr.rotation.x === 0 && bl.rotation.x === 0 && br.rotation.x === 0 ? restOf.legs : null;
    if (restMesh) restMesh.visible = !!rest;
    fl.visible = !rest?.[0] && drawn(m.legs[0].geo);
    fr.visible = !rest?.[1] && drawn(m.legs[1].geo);
    bl.visible = !rest?.[2] && drawn(m.legs[2].geo);
    br.visible = !rest?.[3] && drawn(m.legs[3].geo);
    bell.visible = drawn(m.bell.geo);
    (o.eyeL as Mesh).scale.setScalar(c[CH.eye]);
    (o.eyeR as Mesh).scale.setScalar(c[CH.eye]);
    // At their rest size the eyes are drawn as one mesh (`eyePair`); the moment they widen, each by its own again.
    const eyesMesh = o.eyes as Mesh | null | undefined, paired = !!eyesMesh && c[CH.eye] === 1;
    const iced = live === 'frozen' || live === 'freezing';
    const shut = f.lids === 'closed' && !iced && drawn(m.lids.closed.geo); // the closed lid fills the eye's cells
    if (eyesMesh) eyesMesh.visible = paired && !shut;
    (o.eyeL as Mesh).visible = !paired && !shut && drawn(m.eyes[0].geo);
    (o.eyeR as Mesh).visible = !paired && !shut && drawn(m.eyes[1].geo);
    // A part with nothing in it (a species with no brow at rest, say) is never shown: an empty mesh is still a draw call.
    (o['lid-closed'] as Mesh).visible = f.lids === 'closed' && !iced && drawn(m.lids.closed.geo);
    (o['lid-arc'] as Mesh).visible = f.lids === 'arc' && !iced && drawn(m.lids.arc.geo);
    for (const b of BROWS) (o[`brow-${b}`] as Mesh).visible = b === f.brows && drawn(m.brows[b].geo);
    for (const k of MOUTHS) (o[`mouth-${k}`] as Mesh).visible = k === f.mouth && drawn(m.mouths[k].geo);
    const breath = o.breath as Mesh;
    breath.visible = f.breath && drawn(m.breath.geo);
    if (f.breath) {
      const p = (tp % 1.6) / 1.6;
      breath.position.set(m.breath.pivot[0], m.breath.pivot[1] + p * 0.1, m.breath.pivot[2] + p * 0.25);
      breath.scale.setScalar(0.6 + p);
      breathMat.opacity = 0.8 * (1 - p);
    }

    // Frost tint multiplies every part; dimming darkens it.
    const tint = live === 'frozen' ? 1 : live === 'freezing' ? (reduced ? (e >= 1.2 ? 1 : 0) : clamp01((e - 0.8) / 0.8)) : live === 'thawing' ? 1 - clamp01(e / 1.2) : 0;
    mat.color.copy(white).lerp(frost, tint);
    faceMat.color.copy(white).lerp(frost, tint * 0.3);
    if (dimmed) { mat.color.multiplyScalar(0.62); faceMat.color.multiplyScalar(0.62); }

    // Shadows (change 4.13): the two stand-ins cast for every part at rest; a part away from its rest casts by itself.
    const pb = o.proxyBody as Mesh | null | undefined, ph = o.proxyHead as Mesh | null | undefined;
    let bm = ALL_B, hm = ALL_H;
    if (!(level === 0 || Math.abs(ws - 1) <= BREATH)) bm &= ~B.coat;
    if (rp || !(c[CH.legLift] === 0 && fl.rotation.x === 0 && fr.rotation.x === 0 && bl.rotation.x === 0 && br.rotation.x === 0)) bm &= ~B.legs;
    // Joined on the CPU, the pig's legs round apart from the GPU's and move its shadow a row (LEGS_APART): they cast alone.
    if (LEGS_APART.has(species)) bm &= ~B.legs;
    if (!(tail.rotation.x === 0 && tail.rotation.y === 0 && tail.scale.x === 1)) bm &= ~B.tail;
    if (bell.rotation.x !== 0) bm &= ~B.bell;
    if (o.neck && (o.neck as Group).rotation.x !== 0) bm &= ~B.neck;
    const earL = o.earL as Mesh, earR = o.earR as Mesh;
    // A blend into the rest pose can land a rounding away from DROOP: a millionth of a radian is at rest.
    if (rp || !(earL.rotation.y === 0 && earR.rotation.y === 0 && Math.abs(earL.rotation.z - DROOP) < 1e-6 && Math.abs(earR.rotation.z + DROOP) < 1e-6)) hm &= ~H.ears;
    for (const sp of signature) {
      const sm = o[`sig-${sp.name}`] as Mesh | undefined;
      if (!sm || !sp.anim) continue;
      const atRest = sm.rotation.x === 0 && sm.rotation.y === 0 && sm.rotation.z === 0 && sm.scale.x === 1 && sm.scale.y === 1 && sm.scale.z === 1
        && sm.position.z === (sp.where === 'head' ? sp.pivot[2] - m.head.pivot[2] : sp.pivot[2]);
      if (!atRest) { if (isWing(sp)) bm &= ~B.wings; else hm &= ~H.moving; }
    }
    const bodyGeo = pb && ph && cast && proxiesOn(scene, t) ? bodyStandIn(m, level, bm) : null;
    const headProxy = bodyGeo ? headStandIn(m, hm) : null;
    const proxied = !!bodyGeo && !!headProxy;
    if (pb && ph) {
      // A stand-in with nothing left in it (every part it holds away from its rest) is not drawn: an empty mesh is a draw.
      pb.visible = proxied && drawn(bodyGeo);
      ph.visible = proxied && drawn(headProxy);
      if (proxied) {
        pb.geometry = bodyGeo;
        ph.geometry = headProxy;
        // The coat's breath, when the coat is in the stand-in.
        if (bm & B.coat && level > 0) { pb.position.y = wool.position.y; pb.scale.copy(wool.scale); }
        else { pb.position.y = 0; pb.scale.setScalar(1); }
      }
    }
    const inStandIn = (role: ShadowRole): boolean => {
      if (!proxied) return false;
      if (role === 'body' || role === 'head') return true;
      if (role === 'ears' || role === 'moving') return (hm & H[role]) !== 0;
      return (bm & B[role]) !== 0;
    };
    body.traverse((x) => { const role = x.userData.shadow as ShadowRole | undefined; if (role) x.castShadow = cast && !inStandIn(role); });

    runFreezeFx(fx, live, e, reduced, gustFrom, state === 'thawing');
    (o.frost as Mesh).visible = level > 0 && ((live === 'freezing' && e >= 0.8 && !reduced) || live === 'frozen') && drawn((o.frost as Mesh).geometry);
    (o.frost as Mesh).scale.setScalar(live === 'freezing' ? clamp01((e - 0.8) / 0.8) : 1);
  });

  const mesh = (key: string, p: Part, role: ShadowRole) => (
    <mesh key={key} ref={set(key)} geometry={p.geo} position={p.pivot} material={mat} castShadow={cast} receiveShadow userData={{ shadow: role }} />
  );
  /** A shadow stand-in: on PROXY_LAYER alone, so only a shadow map draws it; hidden until the frame loop gives it its geometry. */
  const proxy = (key: string) => (o: Object3D | null) => { if (o) o.layers.set(PROXY_LAYER); set(key)(o); };
  const rel = (p: Part): V3 => [p.pivot[0] - m.head.pivot[0], p.pivot[1] - m.head.pivot[1], p.pivot[2] - m.head.pivot[2]];
  // The neck group turns about the neck's base and carries the neck and the head (V5.1 Part 4.6).
  const nb: V3 = am.neckBase ?? [0, 0, 0];
  const fromNeck = (q: V3): V3 => [q[0] - nb[0], q[1] - nb[1], q[2] - nb[2]];

  return (
    <>
    <group ref={root}>
      <group ref={set('body')}>
        <mesh ref={set('wool')} geometry={m.wools[2].geo} material={mat} castShadow={cast} receiveShadow userData={{ shadow: 'coat' }} />
        <mesh ref={proxy('proxyBody')} material={mat} castShadow visible={false} />
        <mesh ref={set('frost')} geometry={m.frosts[2].geo} material={mat} />
        {mesh('sheared', m.sheared, 'coat')}
        {mesh('tail', m.tail, 'tail')}
        {mesh('legFL', m.legs[0], 'legs')}
        {mesh('legFR', m.legs[1], 'legs')}
        {mesh('legBL', m.legs[2], 'legs')}
        {mesh('legBR', m.legs[3], 'legs')}
        {/* The legs at rest as one mesh; hidden until the frame loop finds them so. */}
        {restOf && <mesh ref={set('rest')} geometry={restOf.geo} material={mat} castShadow={cast} receiveShadow visible={false} userData={{ shadow: 'legs' }} />}

        {signature.filter((sp) => sp.where === 'body').map((sp) => <mesh key={sp.name} ref={set(`sig-${sp.name}`)} geometry={sp.geo} position={sp.pivot} material={mat} castShadow={cast} visible={drawn(sp.geo)} userData={{ shadow: isWing(sp) ? 'wings' : 'body' }} />)}
        <mesh geometry={m.collar.geo} position={m.collar.pivot} material={mat} visible={drawn(m.collar.geo)} />
        {mesh('bell', m.bell, 'bell')}
        <group ref={set('neck')} position={nb}>
        {am.neck && <mesh geometry={am.neck.geo} position={fromNeck(am.neck.pivot)} material={mat} castShadow={cast} receiveShadow visible={drawn(am.neck.geo)} userData={{ shadow: 'neck' }} />}
        <group ref={set('head')} position={fromNeck(m.head.pivot)}>
          {/* One mesh for the head and all that is fixed to it (headBundle); the same parts one by one if they could not be joined. */}
          <mesh ref={proxy('proxyHead')} material={mat} castShadow visible={false} />
          {headGeo ? <mesh geometry={headGeo} material={mat} castShadow={cast} userData={{ shadow: 'head' }} /> : <>
            <mesh geometry={m.head.geo} material={mat} castShadow={cast} visible={drawn(m.head.geo)} userData={{ shadow: 'head' }} />
            <mesh geometry={m.hood.geo} material={mat} castShadow={cast} visible={drawn(m.hood.geo)} userData={{ shadow: 'head' }} />
            {HATS && <mesh geometry={santaHat()} material={mat} position={anchorsOf(m).hat.at} scale={anchorsOf(m).hat.scale} castShadow={cast} userData={{ shadow: 'head' }} />}
          </>}
          <mesh ref={set('eyeL')} geometry={m.eyes[0].geo} position={rel(m.eyes[0])} material={faceMat} visible={drawn(m.eyes[0].geo)} />
          <mesh ref={set('eyeR')} geometry={m.eyes[1].geo} position={rel(m.eyes[1])} material={faceMat} visible={drawn(m.eyes[1].geo)} />
          {eyesGeo && <mesh ref={set('eyes')} geometry={eyesGeo} material={faceMat} visible={false} />}
          {(['closed', 'arc'] as Lids[]).map((k) => <mesh key={k} ref={set(`lid-${k}`)} geometry={m.lids[k].geo} material={lidMat} />)}
          {BROWS.map((b) => <mesh key={b} ref={set(`brow-${b}`)} geometry={m.brows[b].geo} material={faceMat} />)}
          {MOUTHS.map((k) => <mesh key={k} ref={set(`mouth-${k}`)} geometry={m.mouths[k].geo} material={faceMat} />)}
          <mesh ref={set('earL')} geometry={m.ears[0].geo} position={rel(m.ears[0])} material={mat} castShadow={cast} visible={drawn(m.ears[0].geo)} userData={{ shadow: 'ears' }} />
          <mesh ref={set('earR')} geometry={m.ears[1].geo} position={rel(m.ears[1])} material={mat} castShadow={cast} visible={drawn(m.ears[1].geo)} userData={{ shadow: 'ears' }} />
          {signature.filter((sp) => sp.where === 'head' && (sp.anim || !headGeo)).map((sp) => <mesh key={sp.name} ref={set(`sig-${sp.name}`)} geometry={sp.geo} position={rel(sp)} material={mat} castShadow={cast} visible={drawn(sp.geo)} userData={{ shadow: sp.anim ? 'moving' : 'head' }} />)}
          {am.worn && !headGeo && <mesh geometry={am.worn.geo} position={rel(am.worn)} material={mat} castShadow={cast} visible={drawn(am.worn.geo)} userData={{ shadow: 'head' }} />}
        </group>
        </group>
        <mesh ref={set('breath')} geometry={m.breath.geo} position={m.breath.pivot} material={breathMat} />
        {scarf && <Scarf model={m} cast={cast} />}
      </group>
      <primitive object={fx.root} />
    </group>
    {/* Outside `root`, so a squash or a stretch never lifts it off the ground. One draw, its geometry shared per model. */}
    {low && contact && <mesh geometry={contactPatch(m)} material={patchMat} receiveShadow />}
    </>
  );
}

/** Everyone's dressed for the season: a hat on the top of the head, sized to whichever animal is wearing it. */
export function SantaHat({ parts, material }: { parts: BufferGeometry[]; material: Material }) {
  const fit = useMemo(() => hatFit(parts), [parts]);
  return <mesh geometry={santaHat()} material={material} position={fit.at} scale={fit.scale} castShadow />;
}

/**
 * The winner's knitted scarf: a red voxel ring around the neck with a hanging end. The sheep wears the one made for it;
 * every other species one tied round its own neck (`scarfCells`, file 03, 4.7: the sheep's hoop missed the goat and
 * the hen entirely).
 */
function Scarf({ model, cast }: { model: SheepModel | AnimalModel; cast: boolean }) {
  const own = useMemo(() => animalScarf(model), [model]);
  const geo = useMemo(() => own ?? scarfGeometry(), [own]);
  const mat = useMemo(() => voxelMaterial(), []);
  return <mesh geometry={geo} material={mat} castShadow={cast} />;
}

const animalScarves = new WeakMap<object, BufferGeometry | null>();
/** A species' own scarf, in model space; null for the sheep. */
function animalScarf(m: SheepModel | AnimalModel): BufferGeometry | null {
  const hit = animalScarves.get(m);
  if (hit !== undefined) return hit;
  const cells = scarfCells(m);
  let geo: BufferGeometry | null = null;
  if (cells.length) {
    const g = new Grid(0.04);
    const red = lin(SCARF), cream = lin(CREAM[0]);
    for (const [x, y, z, stripe] of cells) g.set(x, y, z, stripe ? cream : red);
    geo = buildGeometry(g.map, 0.04);
  }
  animalScarves.set(m, geo);
  return geo;
}

let scarfGeo: BufferGeometry | null = null;
/**
 * The sheep's own scarf, in its model's cells (voxel/sheep.ts): a knit band tied under the chin, round the foot of the
 * head's wool, up each side of the neck behind the ears to the cap, and a striped end hanging down the chest.
 */
function scarfGeometry(): BufferGeometry {
  if (scarfGeo) return scarfGeo;
  const g = new Grid(0.04);
  const red = lin(SCARF), cream = lin(CREAM[0]);
  for (const sx of [-1, 1]) {
    for (let y = 6; y <= 12; y++) g.set(sx * 5, y, 5, y % 3 === 2 ? cream : red); // up the side of the neck
    for (let z = 6; z <= 8; z++) g.set(sx * 4, 6, z, red); // round the foot of the head's wool
  }
  for (let x = -3; x <= 3; x++) g.set(x, 6, 8, red); // under the chin
  for (let y = 3; y <= 5; y++) for (const x of [2, 3]) g.set(x, y, 8, y === 4 ? cream : red); // the hanging end
  scarfGeo = buildGeometry(g.map, 0.04);
  return scarfGeo;
}

/** Objects for the freeze sequence, created once per sheep and shown only while needed. */
function freezeFx(m: SheepModel | AnimalModel) {
  const root = new Group();
  const streakMat = new MeshLambertMaterial({ color: '#D9EEF8', transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
  const streaks = new InstancedMesh(new BoxGeometry(0.04, 0.04, 0.24), streakMat, 40);
  const curlGeo = windCurl();
  const curlMat = withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  const curls = Array.from({ length: 6 }, () => {
    const c = new Mesh(curlGeo, curlMat);
    c.rotation.order = 'YXZ'; // stand up (x), then face out (y)
    return c;
  });
  const snowGeo = new BufferGeometry();
  const snowPos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 2.4;
    snowPos[i * 3 + 1] = Math.random() * 2;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }
  snowGeo.setAttribute('position', new Float32BufferAttribute(snowPos, 3));
  const snow = new Points(snowGeo, new PointsMaterial({ color: '#FFFFFF', size: 0.05, transparent: true, opacity: 0.9 }));
  // The block (plan V3 Part 6): voxel ice, rendered double-sided so its far faces show through and it reads as a
  // solid slab rather than a pane of glass.
  const fit = iceFit(m), size = fit.size;
  const parts = iceBlock(size);
  // A little cool self-light keeps the slab's inner faces (lit from below by the floor colour) reading as ice.
  const iceMat = new MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.42, shininess: 90, specular: '#FFFFFF', emissive: '#9ED2EE', emissiveIntensity: 0.3, depthWrite: false, side: DoubleSide });
  const opaque = voxelMaterial();
  const block = new Group();
  const slab = new Mesh(parts.slab, iceMat);
  const base = new Mesh(parts.base, voxelMaterial({ transparent: true, opacity: 0.85 }));
  const glints = new Mesh(parts.glints, voxelMaterial({ emissive: '#FFFFFF', emissiveIntensity: 0.4 }));
  const icicles = new Mesh(parts.icicles, opaque);
  const cap = new Mesh(parts.cap, opaque);
  const cracks = new Mesh(parts.cracks, opaque);
  // Opaque parts draw before the transparent slab, so the slab is last.
  slab.renderOrder = 1;
  block.add(base, icicles, cap, glints, cracks, slab);
  block.rotation.z = TILT;
  // Rest the lowest corner of the tilted block on the floor.
  block.position.set(fit.x, (size[1] / 2) * Math.cos(TILT) + (size[0] / 2) * Math.sin(TILT) - fit.sink, fit.z);
  // Ten chunks for the thaw.
  const shardMat = new MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.75, shininess: 90, specular: '#FFFFFF', emissive: '#9ED2EE', emissiveIntensity: 0.3, depthWrite: false });
  const shards = Array.from({ length: 10 }, (_, i) => {
    const sh = new Mesh(parts.shards[i % 3], shardMat);
    const a = (i / 10) * Math.PI * 2;
    sh.userData.dir = [Math.cos(a) * (0.8 + (i % 3) * 0.3), 0.8 + (i % 4) * 0.35, Math.sin(a) * (0.8 + (i % 2) * 0.4)];
    sh.userData.y0 = 0.25 + (i % 5) * 0.18;
    sh.scale.setScalar(0.8 + (i % 4) * 0.2);
    return sh;
  });
  root.add(streaks, ...curls, snow, block, ...shards);
  root.visible = false;
  // Drawn once, shrunk to nothing, on the first frames: a Mac's graphics driver builds each material's pipeline only on
  // its first real draw, so the ice block used to stall the frame a second after the bang (Brian, 2026-11-09: "the bomb
  // explosion for the practice gamemode is still super laggy").
  return { root, streaks, curls, snow, block, cracks, shards, warm: 2 };
}

const dummy = new Object3D();
function runFreezeFx(fx: ReturnType<typeof freezeFx>, live: SheepState, e: number, reduced: boolean, gustFrom: [number, number, number], thawing: boolean) {
  const freezing = live === 'freezing';
  const frozen = live === 'frozen';
  if (fx.warm > 0) {
    fx.warm--;
    fx.root.visible = true;
    fx.root.traverse((o) => { o.visible = true; });
    fx.root.scale.setScalar(1e-4);
    return;
  }
  if (fx.root.scale.x !== 1) fx.root.scale.setScalar(1);
  fx.root.visible = freezing || frozen || thawing;
  if (!fx.root.visible) return;
  // Gust: 40 streaks from the doors to the sheep along a sine path (0 to 0.8 s).
  const gust = freezing && !reduced && e < 0.8;
  fx.streaks.visible = gust;
  if (gust) {
    for (let i = 0; i < 40; i++) {
      const p = clamp01(e / 0.8 - (i % 8) * 0.05);
      const lane = (i / 40 - 0.5) * 1.2;
      dummy.position.set(gustFrom[0] * (1 - p) + lane, gustFrom[1] * (1 - p) + 0.6 + Math.sin(p * 9 + i) * 0.15, gustFrom[2] * (1 - p));
      dummy.lookAt(0, 0.6, 0);
      dummy.updateMatrix();
      fx.streaks.setMatrixAt(i, dummy.matrix);
    }
    fx.streaks.instanceMatrix.needsUpdate = true;
  }
  // Wind curls orbit until the block settles, then fade.
  const curlsOn = freezing && !reduced && e < 2.4;
  fx.curls.forEach((c, i) => {
    c.visible = curlsOn;
    const a = e * 2 + (i / 6) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.9, 0.3 + (i % 3) * 0.35, Math.sin(a) * 0.9);
    // Stand the flat spiral up and turn it to face out from the sheep, so it reads as a curl and not a bar.
    c.rotation.set(Math.PI / 2, Math.atan2(-Math.cos(a), -Math.sin(a)), e * 3);
    c.scale.setScalar(e > 2 ? 1 - (e - 2) / 0.4 : 1);
  });
  fx.snow.visible = freezing && !reduced;
  if (fx.snow.visible) fx.snow.position.y = -((e * 0.6) % 2);
  // The block forms 1.2 to 2.0 s, bounces 2.0 to 2.4 s, stays while frozen, breaks on the thaw.
  const blockOn = frozen || (freezing && e >= 1.2);
  fx.block.visible = blockOn && !thawing;
  if (fx.block.visible) {
    const grow = frozen ? 1 : reduced ? 1 : 0.2 + 0.8 * easeOut((e - 1.2) / 0.8);
    const bounce = freezing && e > 2 ? 1 + Math.sin(((e - 2) / 0.4) * Math.PI) * 0.02 : 1;
    fx.block.scale.setScalar(grow * bounce);
    fx.cracks.visible = frozen || e >= 1.8;
    fx.cracks.scale.setScalar(freezing && e >= 1.8 && e < 1.95 ? 1.15 : 1);
  }
  fx.shards.forEach((s) => {
    s.visible = thawing && e < 1.2;
    if (!s.visible) return;
    const [dx, dy, dz] = s.userData.dir as number[];
    s.position.set(dx * e * 0.8, Math.max(0.05, (s.userData.y0 as number) + dy * e - 2.6 * e * e), dz * e * 0.8);
    s.rotation.set(e * dx * 3, e * 2, e * dz * 3);
  });
}

/** Every species on the shared rig is drawn by this one component (V5 Part 4.1). */
export const Animal = Sheep;

/** The pose machinery for tests (V5 Part 4.13 test 9): stepping every state for every species without a renderer. */
export const __rig = { poseFor, restPose, face0, N, CH, RANGES, DURATION, DROOP } as const;

/**
 * For tools/scenes/models.ts: each geometry this component joins from several of a model's parts (milestone 2's
 * bundles), and the parts it was joined from, where the bundle puts each one in the group it is drawn in.
 */
export function bundlesOf(m: SheepModel | AnimalModel): { geo: BufferGeometry; sources: BundleSource[] }[] {
  const out: { geo: BufferGeometry; sources: BundleSource[] }[] = [];
  const head = headBundle(m), rest = restBundle(m), eyes = eyePair(m);
  if (head) out.push({ geo: head, sources: headSources(m) });
  if (rest) out.push({ geo: rest.geo, sources: rest.sources });
  if (eyes) out.push({ geo: eyes, sources: eyeSources(m) });
  return out;
}
