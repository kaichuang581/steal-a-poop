import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, DoubleSide, BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedMesh, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, Points, PointsMaterial, Vector3,
} from 'three';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { FROST, lin, SCARF } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import type { V3 } from '../voxel/primitives';
import { CREAM, HEAD_PIVOT, iceBlock, LEVEL_K, sheepModel, windCurl } from '../voxel/sheep';
import type { Brows, Lids, Mouth, Part, WoolLevel } from '../voxel/sheep';

export type SheepState = 'idle' | 'proud' | 'happy' | 'startled' | 'cold' | 'freezing' | 'frozen' | 'thawing' | 'sleeping' | 'grazing' | 'thinking';
export type { WoolLevel };

/**
 * Coat level: the coat is the sheep's wool balls. A full start is a normal coat, each one lost shears it thinner, and
 * extra ones won from steals and traps fluff it up.
 */
export function coatLevel(lives: number, startLives: number): WoolLevel {
  return Math.max(0, Math.min(4, 2 + (lives - startLives))) as WoolLevel;
}

/** Seconds each timed state lasts before the sheep goes back to idle. */
const DURATION: Partial<Record<SheepState, number>> = { proud: 1.2, happy: 1.6, startled: 0.9, cold: 2, freezing: 2.4, thawing: 1.2 };

/** Reserved customisation slots (plan V3 Part 5.4): ids only, no UI, no store. */
export interface SheepLook { woolColour: string; facePattern: string; collar: string; hat: string; scarf: string; bell: string }
export const DEFAULT_LOOK: SheepLook = { woolColour: 'cream', facePattern: 'plain', collar: 'red', hat: 'none', scarf: 'none', bell: 'brass' };

interface Props {
  level: WoolLevel;
  state: SheepState;
  /** Change to restart a timed state (two banks in a row both hop). */
  stateKey?: number;
  /** Seconds a cold state lasts (failed steal 3 s, time-out 2 s). */
  coldFor?: number;
  dimmed?: boolean;
  reduced?: boolean;
  /** Steal window: no idle motion at all (plan V3 Milestone 3). */
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
  /** A bot on its turn: whenever the sheep has nothing else to do it thinks (head tilt, one ear up, a thought bubble). */
  thinking?: boolean;
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
const CH = { bodyY: 0, bodyRotX: 1, bodyRotZ: 2, headX: 3, headY: 4, headZ: 5, earL: 6, earR: 7, earBack: 8, eye: 9, puff: 10, legLift: 11, tail: 12, legSwing: 13 } as const;
const N = 14;
interface Face { brows: Brows; mouth: Mouth; lids: 'open' | Lids; breath: boolean; bubble: boolean }
const face0 = (): Face => ({ brows: 'neutral', mouth: 'flat', lids: 'open', breath: false, bubble: false });
const BROWS: Brows[] = ['neutral', 'up', 'worried'];
const MOUTHS: Mouth[] = ['flat', 'smile', 'o', 'chewL', 'chewDown', 'chewR'];
/** The four chewing frames. */
const CHEW: Mouth[] = ['flat', 'chewL', 'chewDown', 'chewR'];

/**
 * The pose for a state at `e` seconds into it (plan V3.3 Part 3.3). The idle layer (blink, ear twitch, chew) is
 * passed in; the speaker's chest-up and tail wag are added on top of idle and thinking.
 */
function poseFor(p: Float32Array, f: Face, live: SheepState, e: number, t: number, moving: boolean, speaking: boolean, blink: boolean, twitch: number, chew: Mouth | null) {
  // `t` is already offset by this sheep's own phase, so no two sheep move in step.
  p.fill(0);
  p[CH.eye] = 1;
  p[CH.puff] = 1;
  p[CH.earL] = DROOP - twitch;
  p[CH.earR] = DROOP;
  f.brows = 'neutral';
  f.mouth = chew ?? 'flat';
  f.lids = blink ? 'closed' : 'open';
  f.breath = false;
  f.bubble = false;
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
      f.bubble = true;
      break;
    case 'sleeping':
      f.lids = 'closed';
      f.mouth = 'flat';
      p[CH.headX] = 0.2;
      p[CH.earL] = p[CH.earR] = DROOP + 0.3;
      break;
    case 'grazing':
      p[CH.headX] = 0.6 + (moving ? Math.sin(t * 3.1) * 0.03 : 0);
      f.mouth = moving ? CHEW[Math.floor(t / 0.2) % 4] : 'flat';
      break;
    case 'proud':
      p[CH.headX] = -0.3;
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
      p[CH.bodyY] = Math.sin(clamp01(e / 0.5) * Math.PI) * 0.22;
      p[CH.legSwing] = e < 0.5 ? 0.35 : 0;
      p[CH.eye] = 1.35;
      p[CH.earBack] = 0.9;
      f.brows = 'up';
      f.mouth = 'o';
      f.lids = 'open';
      break;
    case 'cold':
      p[CH.bodyY] = -0.04;
      p[CH.bodyRotX] = 0.08;
      p[CH.headX] = 0.15;
      p[CH.earL] = p[CH.earR] = DROOP + 0.3;
      f.brows = 'worried';
      f.mouth = 'flat';
      f.breath = moving;
      break;
    case 'freezing':
    case 'frozen': {
      // 0.5 s: startled, then caught mid-run with a front leg up and the body leaning back. Still from here on.
      const posed = live === 'frozen' || e >= 0.5;
      p[CH.puff] = posed ? 1.06 : 1 + 0.06 * (e / 0.5);
      p[CH.eye] = posed ? 1.4 : 1.2;
      if (posed) { p[CH.legLift] = 0.12; p[CH.bodyRotX] = -0.14; }
      p[CH.earBack] = 0.6;
      f.brows = 'up';
      f.mouth = 'o';
      f.lids = 'open';
      break;
    }
    case 'thawing':
      p[CH.bodyRotZ] = moving ? Math.sin(e * 20) * 0.1 * (1 - clamp01(e / 1.2)) : 0;
      f.mouth = 'smile';
      break;
  }
  if (speaking && (live === 'idle' || live === 'thinking')) {
    p[CH.bodyRotX] -= 0.06;
    p[CH.bodyY] += 0.02;
    p[CH.tail] = moving ? Math.sin(t * 9) * 0.45 : 0;
  }
}

/**
 * The default sheep with every behaviour of plan V3.3 Part 3.3 (idle, attention, speaker, happy, proud, startled,
 * cold, thinking, sleeping), the freeze sequence and the thaw, all driven from one useFrame. Every state's pose is
 * blended from the previous one over 200 ms with an ease-out, so no state is a cut. Every player uses this same
 * model; only level, state and seat differ. Each coat level is its own fleece built to fit the head and legs, so
 * growing or losing wool swaps the fleece rather than scaling it into the other parts.
 */
export function Sheep({ level, state, stateKey = 0, coldFor = 2, dimmed = false, reduced = false, still = false, gustFrom = [0, 0.8, -4], scarf = false, headYaw = 0, lookAt, speaking = false, thinking = false }: Props) {
  const m = sheepModel();
  const mat = useMemo(() => voxelMaterial(), []);
  // Eyes, brows and mouth frost only lightly, so the scared face still reads through the ice.
  const faceMat = useMemo(() => voxelMaterial(), []);
  const breathMat = useMemo(() => new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }), []);
  const frost = useMemo(() => new Color(FROST), []);
  const white = useMemo(() => new Color('#ffffff'), []);
  const fx = useMemo(() => freezeFx(), []);
  const r = useRef<Record<string, Object3D | null>>({});
  const root = useRef<Group>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const set = (k: string) => (o: Object3D | null) => { r.current[k] = o; };
  // The thought bubble is HTML; it mounts the first time this sheep thinks and stays (hidden) from then on.
  const everThought = useRef(false);
  if (thinking || state === 'thinking') everThought.current = true;
  // Animation memory: the state's start, the pose being blended from, and this sheep's own idle timers.
  const anim = useMemo(() => ({
    key: -1, state: '' as SheepState, at: 0, live: '' as SheepState, blendAt: -10, level, levelAt: -10,
    cur: new Float32Array(N), from: new Float32Array(N), target: new Float32Array(N),
    face: face0(), faceFrom: face0(), faceTarget: face0(),
    nextBlink: 2 + Math.random() * 3, blinkAt: -10, phase: Math.random() * 20, rate: 0.82 + Math.random() * 0.36, att: { yaw: 0, pitch: 0 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useMemo(() => new Vector3(), []);

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    const a = anim;
    const o = r.current;
    const body = o.body as Group, head = o.head as Group, wool = o.wool as Mesh;
    if (!body || !head || !wool || !root.current) return;
    if (a.key !== stateKey || a.state !== state) a.key = stateKey, a.state = state, a.at = t;
    const e = t - a.at;
    const dur = state === 'cold' ? coldFor : DURATION[state];
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
    poseFor(a.target, a.faceTarget, live, e, tp, moving, speaking, blink, twitch, chew);
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
        const dx = v.x - HEAD_PIVOT[0], dy = v.y - (HEAD_PIVOT[1] + 0.14), dz = v.z - HEAD_PIVOT[2];
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
    const shiver = live === 'cold' && moving ? Math.sin(tp * 60) * 0.012 : 0;
    body.position.set(shiver, c[CH.bodyY], 0);
    body.rotation.set(c[CH.bodyRotX], 0, c[CH.bodyRotZ]);
    head.rotation.set(c[CH.headX] + a.att.pitch, c[CH.headY] + a.att.yaw, c[CH.headZ]);
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
    const ws = settle * c[CH.puff] * (1 + breathe);
    wool.scale.set(ws, ws, ws);
    (o.sheared as Mesh).visible = level === 0;
    const tail = o.tail as Mesh;
    tail.visible = level > 0;
    tail.rotation.y = c[CH.tail];
    tail.position.z = m.tail.pivot[2] - 0.4 * (LEVEL_K[lvl] - 1);
    const fl = o.legFL as Mesh;
    fl.rotation.x = -c[CH.legSwing] - c[CH.legLift] * 5;
    fl.position.y = m.legs[0].pivot[1] + c[CH.legLift];
    (o.legFR as Mesh).rotation.x = -c[CH.legSwing];
    (o.legBL as Mesh).rotation.x = c[CH.legSwing];
    (o.legBR as Mesh).rotation.x = c[CH.legSwing];
    (o.bell as Mesh).rotation.x = moving && (live === 'happy' || live === 'proud') ? Math.sin(e * 24) * 0.6 * Math.max(0, 1 - e / 1.2) : 0;
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
    if (bubble.current) bubble.current.style.opacity = f.bubble ? '1' : '0';

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
        <mesh geometry={m.collar.geo} position={m.collar.pivot} material={mat} />
        {mesh('bell', m.bell)}
        <group ref={set('head')} position={m.head.pivot}>
          <mesh geometry={m.head.geo} material={mat} castShadow />
          <mesh geometry={m.hood.geo} material={mat} castShadow />
          <mesh ref={set('eyeL')} geometry={m.eyes[0].geo} position={rel(m.eyes[0])} material={faceMat} />
          <mesh ref={set('eyeR')} geometry={m.eyes[1].geo} position={rel(m.eyes[1])} material={faceMat} />
          {(['closed', 'arc'] as Lids[]).map((k) => <mesh key={k} ref={set(`lid-${k}`)} geometry={m.lids[k].geo} material={faceMat} />)}
          {BROWS.map((b) => <mesh key={b} ref={set(`brow-${b}`)} geometry={m.brows[b].geo} material={faceMat} />)}
          {MOUTHS.map((k) => <mesh key={k} ref={set(`mouth-${k}`)} geometry={m.mouths[k].geo} material={faceMat} />)}
          <mesh ref={set('earL')} geometry={m.ears[0].geo} position={rel(m.ears[0])} material={mat} castShadow />
          <mesh ref={set('earR')} geometry={m.ears[1].geo} position={rel(m.ears[1])} material={mat} castShadow />
        </group>
        <mesh ref={set('breath')} geometry={m.breath.geo} position={m.breath.pivot} material={breathMat} />
        {scarf && <Scarf />}
        {everThought.current && (
          <Html position={[0.45, 1.15, 0.45]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={bubble} className="sk-think" aria-hidden="true">…</div>
          </Html>
        )}
      </group>
      <primitive object={fx.root} />
    </group>
  );
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
  const curlMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
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
  return { root, streaks, curls, snow, block, cracks, shards };
}

const dummy = new Object3D();
function runFreezeFx(fx: ReturnType<typeof freezeFx>, live: SheepState, e: number, reduced: boolean, gustFrom: [number, number, number], thawing: boolean) {
  const freezing = live === 'freezing';
  const frozen = live === 'frozen';
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
