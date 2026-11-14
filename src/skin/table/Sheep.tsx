import { useFrame } from '@react-three/fiber';
import { AFTERMATH_MS } from '../../engine/constants';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, DoubleSide, BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, Points, PointsMaterial, Vector3,
} from 'three';
import { withRoundedEdges } from '../voxel/rounded';
import { Box3 } from 'three';
import type { Material } from 'three';
import { santaHat } from '../scene/festive';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { FROST, lin, SCARF } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import type { V3 } from '../voxel/primitives';
import { CREAM, iceBlock, LEVEL_K, sheepModel, windCurl } from '../voxel/sheep';
import type { Brows, Lids, Mouth, Part, SheepModel, WoolLevel } from '../voxel/sheep';
import type { AnimalModel, SigPart } from '../voxel/animals/rig';

export type SheepState = 'idle' | 'proud' | 'happy' | 'startled' | 'cold' | 'dazed' | 'freezing' | 'frozen' | 'thawing' | 'sleeping' | 'grazing' | 'thinking' | 'run' | 'jump' | 'bonk' | 'land';
export type { WoolLevel };

/**
 * Coat level: the coat is the sheep's wool balls. A full start is a normal coat, each one lost shears it thinner, and
 * extra ones won from traps fluff it up.
 */
export function coatLevel(lives: number, startLives: number): WoolLevel {
  return Math.max(0, Math.min(4, 2 + (lives - startLives))) as WoolLevel;
}

/** The coat's y offset when it swells by `k` about the legs' tops at `belly`, so the belly stays on the legs. */
export const swellY = (belly: number, k: number) => belly * (1 - k);

/** Seconds each timed state lasts before the sheep goes back to idle. */
/** How long a sheep is dazed after a bomb goes off beside it: the table's beat (the engine's AFTERMATH_MS), in seconds. */
export const DAZED_S = AFTERMATH_MS / 1000;
const DURATION: Partial<Record<SheepState, number>> = { proud: 1.2, happy: 1.6, startled: 0.9, cold: 2, dazed: DAZED_S, freezing: 2.4, thawing: 1.2 };
/** The dream's trot: ms per half-step at the slowest and the fastest run (V4 Part 7.2); `pace` 0..1 picks between. */
const TROT_MS = { slow: 110, fast: 70 };

/** Reserved customisation slots (plan V3 Part 5.4): ids only, no UI, no store. */
export interface SheepLook { woolColour: string; facePattern: string; collar: string; hat: string; scarf: string; bell: string }
export const DEFAULT_LOOK: SheepLook = { woolColour: 'cream', facePattern: 'plain', collar: 'red', hat: 'none', scarf: 'none', bell: 'brass' };

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
  /** Where the head turns (radians about y, clamped to 0.6); Home's hero follows the pointer. */
  headYaw?: number;
  /** Attention (plan V3.3 Part 3.3): a world point to look at, or the camera. Wins over headYaw. */
  lookAt?: [number, number, number] | 'camera';
  /** The current speaker: chest up, tail wagging. */
  speaking?: boolean;
  /** A bot on its turn: whenever the sheep has nothing else to do it thinks (head tilt, one ear up). */
  thinking?: boolean;
  /** The dream's run: 0 at the slowest trot, 1 at full pace (V4 Part 7.2). */
  pace?: number;
  /** Another animal built to the shared rig (src/skin/voxel/animals): the avatar a player wears. Default: the sheep. */
  model?: SheepModel | AnimalModel;
}

/** The ears hang 20 degrees below level. */
const DROOP = (20 * Math.PI) / 180;
const BLOCK: [number, number, number] = [1.1, 1.2, 1.3];
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
  pig: { headX: [-0.35, 0.45], neckX: [0, 0], headY: 0.6, headZ: 0.2, bodyY: [0, 0.18], squash: [0.9, 1.06], legSwing: 0.49, ears: [-0.5, 0.5] },
  cow: { headX: [-0.3, 0.35], neckX: [-0.15, 0.4], headY: 0.6, headZ: 0.2, bodyY: [0, 0.14], squash: [0.92, 1.05], legSwing: 0.45, ears: [-0.4, 0.4] },
  horse: { headX: [-0.3, 0.25], neckX: [-0.25, 0.6], headY: 0.6, headZ: 0.2, bodyY: [0, 0.16], squash: [0.92, 1.05], legSwing: 0.49, ears: [-0.4, 0.4] },
  goat: { headX: [-0.3, 0.35], neckX: [-0.2, 0.35], headY: 0.6, headZ: 0.25, bodyY: [0, 0.2], squash: [0.9, 1.06], legSwing: 0.49, ears: [-0.5, 0.5] },
  chicken: { headX: [-0.25, 0.5], neckX: [-0.15, 0.45], headY: 0.8, headZ: 0.25, bodyY: [0, 0.16], squash: [0.88, 1.08], legSwing: 0.35, ears: [0, 0] },
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
      if (live === 'frozen') p[CH.legLift] = 0.04; // a short leg lifts less, or its foot rises past the belly
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
export function Sheep({ level, state, stateKey = 0, dimmed = false, reduced = false, still = false, gustFrom = [0, 0.8, -4], scarf = false, headYaw = 0, lookAt, speaking = false, thinking = false, pace = 0, model }: Props) {
  const m = model ?? sheepModel();
  const am = m as Partial<AnimalModel>;
  const species = am.species ?? 'sheep';
  const bodyAlways = am.bodyAlways ?? false;
  const signature: SigPart[] = am.signature ?? [];
  const mat = useMemo(() => voxelMaterial(), []);
  // Eyes, brows and mouth frost only lightly, so the scared face still reads through the ice.
  const faceMat = useMemo(() => voxelMaterial(), []);
  const breathMat = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 })), []);
  const frost = useMemo(() => new Color(FROST), []);
  const white = useMemo(() => new Color('#ffffff'), []);
  const fx = useMemo(() => freezeFx(), []);
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

  useFrame(({ clock, camera }, dt) => {
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
      } else wantYaw = headYaw;
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
    // Breathing: the body lobes swell 2.5% either way; the fleece settles into place over half a second when the level changes.
    const breathe = moving && live !== 'freezing' && live !== 'startled' ? Math.sin(tp * (live === 'sleeping' ? 1.0 : 1.9)) * 0.025 : 0;
    const settle = reduced ? 1 : 0.94 + 0.06 * easeOut((t - a.levelAt) / 0.5);
    const lvl = Math.max(1, level) as 1 | 2 | 3 | 4;
    if (wool.geometry !== m.wools[lvl].geo) {
      wool.geometry = m.wools[lvl].geo;
      (o.frost as Mesh).geometry = m.frosts[lvl].geo;
    }
    wool.visible = level > 0;
    // Swell about the legs' tops, not the ground: scaled from y 0 the belly rose off the legs with every breath and puff.
    const ws = settle * c[CH.puff] * (1 + breathe);
    wool.scale.set(ws, ws, ws);
    wool.position.y = swellY(m.legs[0].pivot[1], ws);
    (o.sheared as Mesh).visible = level === 0 || bodyAlways;
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
        mesh.rotation.z = dir * open;
      }
      else if (sp.anim === 'beard') mesh.rotation.x = moving && (live === 'idle' || live === 'grazing') ? Math.sin(tp * 2.2) * 0.12 : 0;
      else if (sp.anim === 'comb') mesh.rotation.z = moving ? Math.sin(tp * 2.5) * 0.08 : 0;
    }
    const tail = o.tail as Mesh;
    tail.visible = level > 0;
    tail.rotation.y = c[CH.tail];
    // The tail lifts when proud (and the horse's when startled); the chicken's fan spreads 1.2 proud and happy, folds 0.9
    // cold, and breathes +-4% at rest (6.4, 6.3).
    tail.rotation.x = live === 'proud' || (species === 'horse' && live === 'startled') ? tailLift : 0;
    if (am.tailAnim === 'tailFan') tail.scale.x = live === 'proud' || live === 'happy' ? 1.2 : live === 'cold' ? 0.9 : 1 + (moving ? Math.sin(tp * 1.9) * 0.04 : 0);
    tail.position.z = m.tail.pivot[2] - 0.4 * (LEVEL_K[lvl] - 1);
    const fl = o.legFL as Mesh;
    // The trot pairs front-left with back-right; a jump sets the front and back pairs apart.
    fl.rotation.x = -c[CH.legSwing] - c[CH.legLift] * 5 + c[CH.legFront];
    fl.position.y = m.legs[0].pivot[1] + c[CH.legLift];
    (o.legFR as Mesh).rotation.x = c[CH.legSwing] + c[CH.legFront];
    (o.legBL as Mesh).rotation.x = c[CH.legSwing] + c[CH.legBack];
    (o.legBR as Mesh).rotation.x = -c[CH.legSwing] + c[CH.legBack];
    // Squash and stretch on the whole sheep, volume kept: shorter and wider, or taller and narrower.
    const sq = Math.max(0.5, c[CH.squash] || 1);
    root.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // The `bell` tag (the sheep's and the cow's) swings about its top (6.4): +-0.3 rad dying away over 0.8 s on happy, jump and bonk; +-0.08 in the run.
    (o.bell as Mesh).rotation.x = !moving ? 0
      : live === 'happy' || live === 'jump' || live === 'bonk' ? Math.sin(e * 24) * 0.3 * Math.max(0, 1 - e / 0.8)
      : live === 'run' ? Math.sin(tp * 12) * 0.08 : 0;
    (o.eyeL as Mesh).scale.setScalar(c[CH.eye]);
    (o.eyeR as Mesh).scale.setScalar(c[CH.eye]);
    const iced = live === 'frozen' || live === 'freezing';
    (o['lid-closed'] as Mesh).visible = f.lids === 'closed' && !iced;
    (o['lid-arc'] as Mesh).visible = f.lids === 'arc' && !iced;
    for (const b of BROWS) (o[`brow-${b}`] as Mesh).visible = b === f.brows;
    for (const k of MOUTHS) (o[`mouth-${k}`] as Mesh).visible = k === f.mouth;
    const breath = o.breath as Mesh;
    breath.visible = f.breath;
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

    runFreezeFx(fx, live, e, reduced, gustFrom, state === 'thawing');
    (o.frost as Mesh).visible = level > 0 && ((live === 'freezing' && e >= 0.8 && !reduced) || live === 'frozen');
    (o.frost as Mesh).scale.setScalar(live === 'freezing' ? clamp01((e - 0.8) / 0.8) : 1);
  });

  const mesh = (key: string, p: Part, material = mat) => (
    <mesh key={key} ref={set(key)} geometry={p.geo} position={p.pivot} material={material} castShadow receiveShadow />
  );
  const rel = (p: Part): V3 => [p.pivot[0] - m.head.pivot[0], p.pivot[1] - m.head.pivot[1], p.pivot[2] - m.head.pivot[2]];
  // The neck group turns about the neck's base and carries the neck and the head (V5.1 Part 4.6).
  const nb: V3 = am.neckBase ?? [0, 0, 0];
  const fromNeck = (q: V3): V3 => [q[0] - nb[0], q[1] - nb[1], q[2] - nb[2]];

  return (
    <group ref={root}>
      <group ref={set('body')}>
        <mesh ref={set('wool')} geometry={m.wools[2].geo} material={mat} castShadow receiveShadow />
        <mesh ref={set('frost')} geometry={m.frosts[2].geo} material={mat} />
        {mesh('sheared', m.sheared)}
        {mesh('tail', m.tail)}
        {mesh('legFL', m.legs[0])}
        {mesh('legFR', m.legs[1])}
        {mesh('legBL', m.legs[2])}
        {mesh('legBR', m.legs[3])}

        {signature.filter((sp) => sp.where === 'body').map((sp) => <mesh key={sp.name} ref={set(`sig-${sp.name}`)} geometry={sp.geo} position={sp.pivot} material={mat} castShadow />)}
        <mesh geometry={m.collar.geo} position={m.collar.pivot} material={mat} />
        {mesh('bell', m.bell)}
        <group ref={set('neck')} position={nb}>
        {am.neck && <mesh geometry={am.neck.geo} position={fromNeck(am.neck.pivot)} material={mat} castShadow receiveShadow />}
        <group ref={set('head')} position={fromNeck(m.head.pivot)}>
          <mesh geometry={m.head.geo} material={mat} castShadow />
          <mesh geometry={m.hood.geo} material={mat} castShadow />
          <SantaHat parts={[m.head.geo, m.hood.geo]} material={mat} />
          <mesh ref={set('eyeL')} geometry={m.eyes[0].geo} position={rel(m.eyes[0])} material={faceMat} />
          <mesh ref={set('eyeR')} geometry={m.eyes[1].geo} position={rel(m.eyes[1])} material={faceMat} />
          {(['closed', 'arc'] as Lids[]).map((k) => <mesh key={k} ref={set(`lid-${k}`)} geometry={m.lids[k].geo} material={faceMat} />)}
          {BROWS.map((b) => <mesh key={b} ref={set(`brow-${b}`)} geometry={m.brows[b].geo} material={faceMat} />)}
          {MOUTHS.map((k) => <mesh key={k} ref={set(`mouth-${k}`)} geometry={m.mouths[k].geo} material={faceMat} />)}
          <mesh ref={set('earL')} geometry={m.ears[0].geo} position={rel(m.ears[0])} material={mat} castShadow />
          <mesh ref={set('earR')} geometry={m.ears[1].geo} position={rel(m.ears[1])} material={mat} castShadow />
          {signature.filter((sp) => sp.where === 'head').map((sp) => <mesh key={sp.name} ref={set(`sig-${sp.name}`)} geometry={sp.geo} position={rel(sp)} material={mat} castShadow />)}
          {am.worn && <mesh geometry={am.worn.geo} position={rel(am.worn)} material={mat} castShadow />}
        </group>
        </group>
        <mesh ref={set('breath')} geometry={m.breath.geo} position={m.breath.pivot} material={breathMat} />
        {scarf && <Scarf />}
      </group>
      <primitive object={fx.root} />
    </group>
  );
}

/** Everyone's dressed for the season: a hat on the top of the head, sized to whichever animal is wearing it. */
export function SantaHat({ parts, material }: { parts: BufferGeometry[]; material: Material }) {
  const fit = useMemo(() => {
    const top = new Box3();
    for (const g of parts) {
      g.computeBoundingBox();
      top.union(g.boundingBox!);
    }
    const c = top.getCenter(new Vector3());
    return { at: [c.x, top.max.y - 0.06, c.z - 0.02] as [number, number, number], scale: Math.min(1, Math.max(0.55, (top.max.x - top.min.x) / 0.6)) };
  }, [parts]);
  return <mesh geometry={santaHat()} material={material} position={fit.at} scale={fit.scale} castShadow />;
}

/** The winner's knitted scarf: a red voxel ring around the neck with a hanging end. */
function Scarf() {
  const geo = useMemo(() => scarfGeometry(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  return <mesh geometry={geo} position={[0.02, 0.46, 0.5]} material={mat} castShadow />;
}

let scarfGeo: BufferGeometry | null = null;
function scarfGeometry(): BufferGeometry {
  if (scarfGeo) return scarfGeo;
  // A knit band around the neck and a striped hanging end, on the 0.04 m grid.
  const g = new Grid(0.04);
  const red = lin(SCARF), cream = lin(CREAM[0]);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * 7), y = Math.round(Math.sin(a) * 4);
    for (const z of [0, 1]) g.set(x, y, z, Math.floor(i / 4) % 3 === 2 ? cream : red);
  }
  for (let y = 0; y < 7; y++) for (const x of [4, 5]) g.set(x, -4 - y, 2, y % 3 === 2 ? cream : red);
  scarfGeo = buildGeometry(g.map, 0.04);
  return scarfGeo;
}

/** Objects for the freeze sequence, created once per sheep and shown only while needed. */
function freezeFx() {
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
  const parts = iceBlock(BLOCK);
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
  block.position.set(0, (BLOCK[1] / 2) * Math.cos(TILT) + (BLOCK[0] / 2) * Math.sin(TILT), 0);
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
