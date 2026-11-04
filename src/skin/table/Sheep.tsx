import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, Group,
  InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, Points, PointsMaterial,
} from 'three';
import { buildGeometry } from '../voxel/mesher';
import { FROST, lin, SCARF, T } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import { iceDressing, sheepModel, windCurl } from '../voxel/sheep';
import type { Brows, Mouth, Part } from '../voxel/sheep';

export type SheepState = 'idle' | 'proud' | 'happy' | 'startled' | 'cold' | 'freezing' | 'frozen' | 'thawing' | 'sleeping';
export type WoolLevel = 0 | 1 | 2 | 3 | 4;

/** Banked points to wool level (plan V3 Part 5.2). */
export function woolLevel(points: number): WoolLevel {
  return points <= 0 ? 0 : points < 15 ? 1 : points < 40 ? 2 : points < 80 ? 3 : 4;
}
const WOOL_SCALE = [0, 0.8, 1, 1.15, 1.3];

/** Seconds each timed state lasts before the sheep goes back to idle. */
const DURATION: Partial<Record<SheepState, number>> = { proud: 1.2, happy: 1.6, startled: 0.6, cold: 2, freezing: 2.4, thawing: 1.2 };

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
  /** Direction the freeze gust comes from, in the sheep's local space (the barn's back doors). */
  gustFrom?: [number, number, number];
  /** Winner's scarf. */
  scarf?: boolean;
}

const BLOCK: [number, number, number] = [1.5, 1.4, 1.9];
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * The default sheep with every state of plan V3 Part 5.3, including the freeze sequence (Part 6) and the thaw,
 * all driven from one useFrame. Every player uses this same model; only level, state and seat differ.
 */
export function Sheep({ level, state, stateKey = 0, coldFor = 2, dimmed = false, reduced = false, gustFrom = [0, 0.8, -4], scarf = false }: Props) {
  const m = sheepModel();
  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), []);
  const breathMat = useMemo(() => new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }), []);
  const frost = useMemo(() => new Color(FROST), []);
  const white = useMemo(() => new Color('#ffffff'), []);
  const fx = useMemo(() => freezeFx(), []);
  const r = useRef<Record<string, Object3D | null>>({});
  const started = useRef({ key: -1, state: '' as SheepState, at: 0 });
  const set = (k: string) => (o: Object3D | null) => { r.current[k] = o; };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const o = r.current;
    if (started.current.key !== stateKey || started.current.state !== state) started.current = { key: stateKey, state, at: t };
    const e = t - started.current.at;
    const dur = state === 'cold' ? coldFor : DURATION[state];
    const live: SheepState = dur !== undefined && e > dur ? (state === 'freezing' ? 'frozen' : 'idle') : state;

    const body = o.body as Group, head = o.head as Group, wool = o.wool as Mesh;
    if (!body || !head || !wool) return;
    // Defaults for this frame; each state overrides what it needs.
    let brows: Brows = 'neutral', mouth: Mouth = 'flat', eyeScale = 1, woolBoost = 1, lids = false, breathOn = false;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    let legLift = 0, tint = 0;
    const breathe = live === 'frozen' ? 0 : Math.sin(t * (live === 'sleeping' ? 1.2 : 2.2)) * 0.02;
    const blink = (t % 4.2) < 0.12;
    const flick = (t % 9) < 0.25 ? Math.sin(((t % 9) / 0.25) * Math.PI) * 0.26 : 0;

    switch (live) {
      case 'idle':
        head.rotation.x = Math.sin(t * 0.9) * 0.04;
        lids = blink;
        break;
      case 'sleeping':
        lids = true;
        head.rotation.x = 0.12;
        breathOn = true;
        break;
      case 'proud':
        head.rotation.x = -0.25;
        mouth = 'smile';
        break;
      case 'happy':
        body.position.y = Math.abs(Math.sin(e * 9)) * 0.18 * Math.exp(-e * 1.8);
        mouth = 'smile';
        brows = 'scared'; // raised
        break;
      case 'startled':
        body.position.y = Math.sin(clamp01(e / 0.6) * Math.PI) * 0.25;
        woolBoost = 1.18;
        eyeScale = 1.4;
        brows = 'scared';
        mouth = 'grimace';
        break;
      case 'cold':
        body.position.y = -0.05;
        body.position.x = Math.sin(t * 60) * 0.015;
        brows = 'worried';
        breathOn = true;
        break;
      case 'freezing':
      case 'frozen': {
        // 0.5 s: startled, then caught mid-run with a front leg up and the body leaning back. Still from here on.
        const posed = live === 'frozen' || e >= 0.5;
        if (!posed) { woolBoost = 1 + 0.18 * (e / 0.5); eyeScale = 1.2; }
        if (posed) { legLift = 0.12; body.rotation.x = -0.14; }
        eyeScale = posed ? 1.4 : eyeScale;
        brows = 'scared';
        mouth = 'grimace';
        tint = live === 'frozen' ? 1 : reduced ? (e >= 1.2 ? 1 : 0) : clamp01((e - 0.8) / 0.8);
        break;
      }
      case 'thawing':
        tint = 1 - clamp01(e / 1.2);
        body.rotation.z = Math.sin(e * 20) * 0.1 * (1 - clamp01(e / 1.2));
        mouth = 'smile';
        break;
    }

    // Wool level: bare at 0 (sheared body, collar off); at 4 the head lifts.
    const ws = WOOL_SCALE[level] * woolBoost * (1 + (live === 'frozen' ? 0 : breathe));
    wool.visible = level > 0;
    wool.scale.setScalar(Math.max(0.001, ws));
    (o.tail as Mesh).visible = level > 0;
    (o.sheared as Mesh).visible = level === 0;
    (o.collar as Group).visible = level > 0;
    const lift = level === 4 ? (WOOL_SCALE[4] - 1) * 0.28 : 0;
    head.position.set(m.head.pivot[0], m.head.pivot[1] + lift, m.head.pivot[2]);
    (o.earL as Mesh).rotation.z = -0.44 + (live === 'frozen' ? 0 : flick);
    (o.earR as Mesh).rotation.z = 0.44 - (live === 'frozen' ? 0 : flick);
    (o.legFL as Mesh).rotation.x = legLift ? -0.6 : 0;
    (o.legFL as Mesh).position.y = m.legs[0].pivot[1] + legLift;
    (o.bell as Mesh).rotation.x = live === 'proud' ? Math.sin(e * 14) * 0.5 * (1 - e / 1.2) : 0;
    (o.eyeL as Mesh).scale.setScalar(eyeScale);
    (o.eyeR as Mesh).scale.setScalar(eyeScale);
    (o.lids as Mesh).visible = lids && live !== 'frozen' && live !== 'freezing';
    for (const b of ['neutral', 'worried', 'scared'] as Brows[]) (o[`brow-${b}`] as Mesh).visible = b === brows;
    for (const k of ['flat', 'smile', 'grimace'] as Mouth[]) (o[`mouth-${k}`] as Mesh).visible = k === mouth;
    const breath = o.breath as Mesh;
    breath.visible = breathOn;
    if (breathOn) {
      const p = (t % 1.6) / 1.6;
      breath.position.set(0, m.breath.pivot[1] + p * 0.1, m.breath.pivot[2] + p * 0.25);
      breath.scale.setScalar(0.6 + p);
      breathMat.opacity = 0.8 * (1 - p);
    }

    // Frost tint multiplies every part; dimming darkens it.
    mat.color.copy(white).lerp(frost, tint);
    if (dimmed) mat.color.multiplyScalar(0.62);

    runFreezeFx(fx, live, e, reduced, gustFrom, state === 'thawing');
    (o.frost as Mesh).visible = (live === 'freezing' && e >= 0.8 && !reduced) || live === 'frozen';
    (o.frost as Mesh).scale.setScalar(live === 'freezing' ? clamp01((e - 0.8) / 0.8) : 1);
    (o.scarf as Mesh | null)?.position.setY(m.head.pivot[1] - 0.12 + lift);
  });

  const mesh = (key: string, p: Part, material = mat) => (
    <mesh key={key} ref={set(key)} geometry={p.geo} position={p.pivot} material={material} castShadow receiveShadow />
  );
  const rel = (p: Part): [number, number, number] => [p.pivot[0] - m.head.pivot[0], p.pivot[1] - m.head.pivot[1], p.pivot[2] - m.head.pivot[2]];

  return (
    <group>
      <group ref={set('body')}>
        <mesh ref={set('wool')} geometry={m.wool.geo} position={m.wool.pivot} material={mat} castShadow receiveShadow />
        {mesh('tail', m.tail)}
        {mesh('sheared', m.sheared)}
        {mesh('frost', m.frost)}
        <mesh ref={set('legFL')} geometry={m.legs[0].geo} position={m.legs[0].pivot} material={mat} castShadow />
        {mesh('legFR', m.legs[1])}
        {mesh('legBL', m.legs[2])}
        {mesh('legBR', m.legs[3])}
        <group ref={set('head')} position={m.head.pivot}>
          <mesh geometry={m.head.geo} material={mat} castShadow />
          <mesh ref={set('eyeL')} geometry={m.eyes[0].geo} position={rel(m.eyes[0])} material={mat} />
          <mesh ref={set('eyeR')} geometry={m.eyes[1].geo} position={rel(m.eyes[1])} material={mat} />
          <mesh ref={set('lids')} geometry={m.lids.geo} material={mat} />
          {(['neutral', 'worried', 'scared'] as Brows[]).map((b) => <mesh key={b} ref={set(`brow-${b}`)} geometry={m.brows[b].geo} material={mat} />)}
          {(['flat', 'smile', 'grimace'] as Mouth[]).map((k) => <mesh key={k} ref={set(`mouth-${k}`)} geometry={m.mouths[k].geo} material={mat} />)}
          <mesh ref={set('earL')} geometry={m.ears[0].geo} position={rel(m.ears[0])} material={mat} castShadow />
          <mesh ref={set('earR')} geometry={m.ears[1].geo} position={rel(m.ears[1])} material={mat} castShadow />
          <group ref={set('collar')}>
            <mesh geometry={m.collar.geo} material={mat} />
            <mesh ref={set('bell')} geometry={m.bell.geo} position={rel(m.bell)} material={mat} />
          </group>
        </group>
        <mesh ref={set('breath')} geometry={m.breath.geo} position={m.breath.pivot} material={breathMat} />
        {scarf && <Scarf onRef={set('scarf')} />}
      </group>
      <primitive object={fx.root} />
    </group>
  );
}

/** The winner's knitted scarf: a red voxel ring around the neck with a hanging end. */
function Scarf({ onRef }: { onRef: (o: Object3D | null) => void }) {
  const geo = useMemo(() => scarfGeometry(), []);
  return <mesh ref={onRef} geometry={geo} position={[0, 0.54, 0.4]} material={useMemo(() => new MeshLambertMaterial({ vertexColors: true }), [])} castShadow />;
}

let scarfGeo: BufferGeometry | null = null;
function scarfGeometry(): BufferGeometry {
  if (scarfGeo) return scarfGeo;
  // A knit band around the neck and a striped hanging end, on the 0.04 m grid.
  const g = new Grid(0.04);
  const red = lin(SCARF), cream = lin(T.wool[0]);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * 8), y = Math.round(Math.sin(a) * 5);
    for (const z of [0, 1]) g.set(x, y, z, Math.floor(i / 4) % 3 === 2 ? cream : red);
  }
  for (let y = 0; y < 8; y++) for (const x of [5, 6]) g.set(x, -5 - y, 2, y % 3 === 2 ? cream : red);
  scarfGeo = buildGeometry(g.map, 0.04);
  return scarfGeo;
}

/** Objects for the freeze sequence, created once per sheep and shown only while needed. */
function freezeFx() {
  const root = new Group();
  const streakMat = new MeshLambertMaterial({ color: T.ice[0], transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
  const streaks = new InstancedMesh(new BoxGeometry(0.04, 0.04, 0.24), streakMat, 40);
  const curlGeo = windCurl();
  const curlMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  const curls = Array.from({ length: 6 }, () => new Mesh(curlGeo, curlMat));
  const snowGeo = new BufferGeometry();
  const snowPos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 2.4;
    snowPos[i * 3 + 1] = Math.random() * 2;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }
  snowGeo.setAttribute('position', new Float32BufferAttribute(snowPos, 3));
  const snow = new Points(snowGeo, new PointsMaterial({ color: T.snow[0], size: 0.05, transparent: true, opacity: 0.9 }));
  const blockGeo = new BoxGeometry(...BLOCK);
  const block = new Group();
  const ice = new Mesh(blockGeo, new MeshPhongMaterial({ color: T.ice[1], transparent: true, opacity: 0.45, shininess: 80, depthWrite: false }));
  const edges = new LineSegments(new EdgesGeometry(blockGeo), new LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9 }));
  const dressing = iceDressing(BLOCK);
  const dressMat = new MeshLambertMaterial({ vertexColors: true });
  const icicles = new Mesh(dressing.icicles, dressMat);
  const cap = new Mesh(dressing.cap, dressMat);
  const cracks = crackLines();
  block.add(ice, edges, icicles, cap, cracks);
  block.position.set(0, 0.7, 0);
  // Six shards for the thaw.
  const shards = Array.from({ length: 6 }, (_, i) => {
    const s = new Mesh(new BoxGeometry(BLOCK[0] / 2, BLOCK[1] / 2, BLOCK[2] / 3), ice.material);
    s.userData.dir = [((i % 2) - 0.5) * 2, 0.6 + (i % 3) * 0.3, (Math.floor(i / 2) - 1) * 1.2];
    return s;
  });
  root.add(streaks, ...curls, snow, block, ...shards);
  root.visible = false;
  return { root, streaks, curls, snow, block, cracks, shards };
}


function crackLines() {
  const g = new BufferGeometry();
  const z = BLOCK[2] / 2 + 0.005;
  // Two zigzag cracks on the front face.
  const pts = [-0.4, 0.4, -0.25, 0.15, -0.25, 0.15, -0.35, -0.1, -0.35, -0.1, -0.2, -0.35, 0.3, 0.5, 0.42, 0.25, 0.42, 0.25, 0.28, 0.05];
  const pos: number[] = [];
  for (let i = 0; i < pts.length; i += 2) pos.push(pts[i], pts[i + 1], z);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new LineSegments(g, new LineBasicMaterial({ color: '#2F5D8A' }));
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
    fx.block.rotation.z = (6 * Math.PI) / 180;
    fx.cracks.visible = frozen || e >= 1.8;
    fx.cracks.scale.setScalar(freezing && e >= 1.8 && e < 1.95 ? 1.15 : 1);
  }
  fx.shards.forEach((s) => {
    s.visible = thawing && e < 1.2;
    if (!s.visible) return;
    const [dx, dy, dz] = s.userData.dir as number[];
    s.position.set(dx * e * 0.8, 0.7 + dy * e - 2.2 * e * e, dz * e * 0.6);
    s.rotation.set(e * dx * 2, 0, e * dz);
  });
}
