import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, DoubleSide, Group, InstancedMesh,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, PCFSoftShadowMap, Points, PointsMaterial, SRGBColorSpace, Vector3,
} from 'three';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { byId } from '../avatars/catalog';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { SHEEP_SCALE } from '../scene/layout';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { lin } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import { letterMask } from '../voxel/table';
import { trophyGeometry } from '../voxel/trophy';
import { ScreenAnchor, SlipLayer, useSlipRefs } from './Anchors';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

/**
 * The victory screen (Brian, 2026-11-08): the barn turned into a stage. Everyone stands on a block of barn timber with
 * their place carved into its front and gilded (the top three tall and trimmed gold, silver and bronze; the rest on low
 * crates), on a straw floor between stacked hay bales, in front of the barn's red doors under the hayloft beam and its
 * lanterns. Lantern beams sweep the stage, straw and a little confetti drift down, and the winner holds the trophy up.
 * Every animal has its own dance. Festive only in passing: a wreath on the doors and one short string of warm lights.
 * Names hang on black nameplates under the carved numbers. Its own small canvas over the table.
 */
export interface PodiumEntry { key: string; name: string; place: number; avatar: string | null; level: WoolLevel; isYou: boolean }

const S = 0.1;
const STEP = { w: 1.4, d: 1.2 };
const HEIGHT = [1.5, 1.1, 0.8];
const CRATE = 0.55;
const heightOf = (place: number) => (place <= 3 ? HEIGHT[place - 1] : CRATE);
/** Where a place stands: x, the top it stands on, z. 1st in the middle, 2nd left, 3rd right, the rest on crates either side. */
function spot(place: number): [number, number, number] {
  if (place === 1) return [0, HEIGHT[0], 0];
  if (place === 2) return [-STEP.w - 0.06, HEIGHT[1], 0];
  if (place === 3) return [STEP.w + 0.06, HEIGHT[2], 0];
  const k = place - 4, side = k % 2 ? 1 : -1;
  return [side * (3.05 + Math.floor(k / 2) * 1.3), CRATE, 0.5];
}

const C = (h: string) => lin(h);
const TRIM = ['#E8B23A', '#C9CED6', '#C07A3E'];
const TRIM_DARK = ['#A8761E', '#8E949E', '#86512A'];

/** The block: barn planks with dark seams, a metal band round the top for the top three, a cloth top (straw on a crate). */
function blockGeometry(place: number): BufferGeometry {
  const top3 = place <= 3, w = Math.round((top3 ? STEP.w : 1.1) / S), d = Math.round((top3 ? STEP.d : 0.9) / S), h = Math.round(heightOf(place) / S);
  const plank = [C('#8C5A2E'), C('#7A4B26'), C('#94633A'), C('#83532B')], seam = C('#4A2E16');
  const trim = top3 ? C(TRIM[place - 1]) : C('#6B4423'), trimDark = top3 ? C(TRIM_DARK[place - 1]) : C('#4A2E16');
  const cloth = [C('#A8322C'), C('#8A2722')], straw = [C('#D9B66A'), C('#C9A253')];
  const g = new Grid(S);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) {
    const shell = x === 0 || x === w - 1 || z === 0 || z === d - 1 || y === 0 || y === h - 1;
    if (!shell) continue;
    const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    let c = (x % 3 === 0 && z === d - 1) || (z % 3 === 0 && (x === 0 || x === w - 1)) ? seam : plank[Math.floor(hash3(x, y >> 2, z, 3) * plank.length)];
    if (y === h - 1) c = edge ? trim : top3 ? cloth[(x + z) % 2] : straw[Math.floor(hash3(x, 0, z, 5) * 2)];
    else if (y === h - 2 && edge) c = trimDark;
    else if (y === 0) c = seam;
    g.set(x, y, z, c);
  }
  return buildGeometry(g.map, S).translate(-w * S / 2, 0, -d * S / 2);
}

/** The front board's height for a place: most of a tall block, a strip on a crate. */
const boardHeight = (place: number) => Math.min(heightOf(place) - 0.14, place <= 3 ? 0.66 : 0.4);
/** The place, carved into a front board and gilded in the groove: Fraunces digits on a 0.03 m grid. */
const P = 0.03;
function carvedGeometry(place: number): BufferGeometry {
  const top3 = place <= 3, w = Math.round(((top3 ? STEP.w : 1.1) - 0.2) / P), h = Math.round(boardHeight(place) / P), digitH = Math.round(h * 0.86);
  const masks = String(place).split('').map((ch) => letterMask(ch, digitH));
  const width = masks.reduce((n, m) => n + (m[0]?.length ?? 0), 0) + (masks.length - 1) * 2;
  const x0 = Math.floor((w - width) / 2), y0 = Math.floor((h - masks[0].length) / 2);
  const carved = new Set<string>();
  let ox = x0;
  for (const m of masks) {
    // Each stroke cut a cell wider all round, so thin serifs read from across the barn.
    m.forEach((row, r) => row.forEach((on, c) => { if (on) for (const [dx, dy] of digitH >= 16 ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]]) carved.add(`${ox + c + dx},${h - 1 - (y0 + r) + dy}`); }));
    ox += (m[0]?.length ?? 0) + 2;
  }
  const board = [C('#A06A3A'), C('#94613A'), C('#A87444')], gold = top3 ? C(['#FFD25A', '#F2F5FA', '#F0A868'][place - 1]) : C('#F4D48A'), groove = C('#3A2410');
  const g = new Grid(P);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    // The groove: the face is cut away and the gilt sits a cell back; the cut's upper and left rims are in shadow.
    if (carved.has(`${x},${y}`)) { g.set(x, y, 0, gold); continue; }
    const rim = carved.has(`${x},${y - 1}`) || carved.has(`${x + 1},${y}`);
    g.set(x, y, 0, board[Math.floor(hash3(x >> 3, y, 0, 7) * 3)]);
    g.set(x, y, 1, rim ? groove : board[Math.floor(hash3(x >> 3, y, 1, 7) * 3)]);
  }
  return buildGeometry(g.map, P, { ao: false }).translate(-w * P / 2, 0, 0);
}

/** The barn's back wall: red boards with dark seams. */
function wallGeometry(): BufferGeometry {
  const W = 0.25, g = new Grid(W);
  const red = [C('#7E2A1E'), C('#6E2419'), C('#88301F')], seam = C('#3A140E');
  for (let x = -44; x < 44; x++) for (let y = 0; y < 28; y++) g.set(x, y, 0, x % 4 === 0 ? seam : red[Math.floor(hash3(x >> 2, y >> 3, 0, 4) * 3)]);
  return buildGeometry(g.map, W, { ao: false });
}

/** The big barn doors on the back wall: red boards in a white frame with the white cross on each, a white header over
 *  them, and a wreath hung on the right-hand door. On a finer grid so the cross runs clean. */
function doorsGeometry(): BufferGeometry {
  const D = 0.125, g = new Grid(D);
  const red = [C('#8A2E20'), C('#7A2719'), C('#933522')], white = C('#EAE1D0'), seam = C('#4A1A10');
  const leafW = 26, h = 30; // each door, in cells; the two meet at x = 0
  for (let x = -leafW; x < leafW; x++) for (let y = 0; y < h + 2; y++) {
    if (y >= h) { g.set(x, y, 0, white); continue; } // the header
    const lx = x < 0 ? x + leafW : x;
    const frame = lx < 2 || lx >= leafW - 2 || y < 2 || y >= h - 2;
    const t = (y - 2) / (h - 5), d1 = Math.abs(lx - (2 + t * (leafW - 5))), d2 = Math.abs(lx - (leafW - 3 - t * (leafW - 5)));
    const cross = !frame && (d1 < 1.4 || d2 < 1.4);
    g.set(x, y, 0, frame || cross ? white : lx % 4 === 0 ? seam : red[Math.floor(hash3(x >> 2, y >> 3, 0, 9) * 3)]);
  }
  // The wreath: a ring of greens with a red bow, standing proud of the right-hand door.
  const green = [C('#2F5A3C'), C('#24402D'), C('#3E6E4A')], bow = C('#A8322C');
  for (let a = 0; a < 64; a++) {
    const th = (a / 64) * Math.PI * 2;
    for (const r of [3.4, 4.3, 5.1]) g.set(Math.round(13 + Math.cos(th) * r), Math.round(17 + Math.sin(th) * r), 1, green[(a + Math.round(r)) % 3]);
  }
  for (const [x, y] of [[12, 12], [13, 12], [14, 12], [11, 13], [15, 13], [13, 11], [12, 10], [14, 10]]) g.set(x, y, 2, bow);
  return buildGeometry(g.map, D, { ao: false });
}

/** A straw floor: loose gold straw in four tones with darker patches, and stray tufts lying on top. */
function floorGeometry(): BufferGeometry {
  const g = new Grid(S), straw = [C('#D9B66A'), C('#C9A253'), C('#E4C47E'), C('#B88F44')], dirt = C('#8A6A3A');
  for (let x = -90; x < 90; x++) for (let z = -32; z < 40; z++) {
    g.set(x, 0, z, hash3(x >> 1, 0, z >> 1, 11) < 0.06 ? dirt : straw[Math.floor(hash3(x, 0, z, 12) * straw.length)]);
    if (hash3(x, 1, z, 13) < 0.09) g.set(x, 1, z, straw[Math.floor(hash3(x, 1, z, 14) * straw.length)]);
  }
  return buildGeometry(g.map, S, { ao: false }).translate(0, -S, 0);
}

/** A hay bale: straw packed tight with two twine bands. */
function baleGeometry(): BufferGeometry {
  const g = new Grid(S), straw = [C('#D9B66A'), C('#C9A253'), C('#E4C47E')], twine = C('#7A5A30');
  for (let x = 0; x < 10; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 6; z++) {
    g.set(x, y, z, x === 2 || x === 7 ? twine : straw[Math.floor(hash3(x, y, z, 21) * straw.length)]);
  }
  return buildGeometry(g.map, S).translate(-0.5, 0, -0.3);
}
/** Two stacks of bales either side of the stage and a loose one in front of each: x, y, z, turn. */
const BALES: [number, number, number, number][] = [
  [-6.6, 0, -1.6, 0], [-5.55, 0, -1.6, 0], [-6.1, 0.5, -1.6, 0.05], [-7.2, 0, -0.6, 1.57], [-6.6, 1, -1.6, -0.04],
  [6.6, 0, -1.6, 0], [5.55, 0, -1.6, 0], [6.1, 0.5, -1.6, -0.06], [7.2, 0, -0.6, 1.57], [6.6, 1, -1.6, 0.03],
  [-4.9, 0, 1.6, 0.4], [5.1, 0, 1.4, -0.3],
];

/** The hayloft beam with three hanging lanterns and one short string of warm lights. */
function Loft() {
  const beam = useMemo(() => new BoxGeometry(18, 0.35, 0.35), []);
  const wood = useMemo(() => new MeshLambertMaterial({ color: '#5A3A1E' }), []);
  const glass = useMemo(() => new MeshLambertMaterial({ color: '#FFD98A', emissive: '#FFB84A', emissiveIntensity: 2.2 }), []);
  const iron = useMemo(() => new MeshLambertMaterial({ color: '#2B2420' }), []);
  const box = useMemo(() => new BoxGeometry(0.22, 0.3, 0.22), []);
  const cap = useMemo(() => new BoxGeometry(0.28, 0.06, 0.28), []);
  const rope = useMemo(() => new BoxGeometry(0.03, 0.5, 0.03), []);
  const bulb = useMemo(() => new BoxGeometry(0.09, 0.12, 0.09), []);
  const bulbMat = useMemo(() => new MeshLambertMaterial({ color: '#FFE2A0', emissive: '#FFC870', emissiveIntensity: 1.8 }), []);
  return (
    <group position={[0, 4.9, -1.2]}>
      <mesh geometry={beam} material={wood} />
      {[-3.6, 0, 3.6].map((x) => (
        <group key={x} position={[x, -0.45, 0]}>
          <mesh geometry={rope} material={iron} position={[0, 0.2, 0]} />
          <mesh geometry={cap} material={iron} position={[0, -0.05, 0]} />
          <mesh geometry={box} material={glass} position={[0, -0.24, 0]} />
          <pointLight position={[0, -0.3, 0.2]} color="#FFB86A" intensity={9} distance={7} decay={2} />
        </group>
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} geometry={bulb} material={bulbMat} position={[-3 + i * 0.5, -0.22 - Math.sin((i / 12) * Math.PI) * 0.35, 0.2]} />
      ))}
    </group>
  );
}

/** Two lantern beams sweeping slowly across the stage and crossing on the winner. */
function Beams({ reduced }: { reduced: boolean }) {
  const cone = useMemo(() => new ConeGeometry(1.1, 7, 24, 1, true).translate(0, -3.5, 0), []);
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#FFD98A', transparent: true, opacity: 0.045, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), []);
  const a = useRef<Group>(null), b = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, k = reduced ? 0 : 1;
    if (a.current) a.current.rotation.set(0.15, 0, -0.45 + Math.sin(t * 0.5) * 0.22 * k);
    if (b.current) b.current.rotation.set(0.15, 0, 0.45 - Math.sin(t * 0.5 + 1) * 0.22 * k);
  });
  return (
    <>
      <group ref={a} position={[-4.2, 6.4, 0.5]}><mesh geometry={cone} material={mat} /></group>
      <group ref={b} position={[4.2, 6.4, 0.5]}><mesh geometry={cone} material={mat} /></group>
    </>
  );
}

/** Straw stalks, and a little confetti, drifting down over the stage. */
function Drift({ reduced }: { reduced: boolean }) {
  const N = 160;
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new BoxGeometry(0.05, 0.05, 0.012), []);
  const mat = useMemo(() => new MeshLambertMaterial(), []);
  const bits = useMemo(() => Array.from({ length: N }, (_, i) => ({
    x: (Math.random() - 0.5) * 11, y: Math.random() * 6.5, z: (Math.random() - 0.5) * 3 + 0.6,
    v: 0.4 + Math.random() * 0.5, spin: (Math.random() - 0.5) * 7, sway: Math.random() * 6, straw: i % 3 !== 0,
  })), []);
  const o = useMemo(() => new Object3D(), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const strawC = ['#E4C47E', '#D9B66A', '#C9A253'].map((c) => new Color(c)), party = ['#E8B23A', '#A8322C', '#F4ECDD', '#2F5A3C'].map((c) => new Color(c));
    bits.forEach((b, i) => m.setColorAt(i, b.straw ? strawC[i % 3] : party[i % 4]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [bits]);
  useFrame(({ clock }, dt) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime;
    bits.forEach((b, i) => {
      if (!reduced) { b.y -= b.v * Math.min(dt, 0.05); if (b.y < 0) b.y += 6.5; }
      o.position.set(b.x + Math.sin(t * 1.2 + b.sway) * 0.18, b.y, b.z);
      o.rotation.set(t * b.spin, t * b.spin * 0.6, b.sway);
      o.scale.set(b.straw ? 0.6 : 1, b.straw ? 3.2 : 1, 1);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, N]} />;
}

/** Glints twinkling round the trophy. */
function Glints({ reduced }: { reduced: boolean }) {
  const N = 24;
  const geo = useMemo(() => {
    const g = new BufferGeometry(), p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.45; p.set([Math.cos(a) * r, Math.random() * 0.9, Math.sin(a) * r * 0.5], i * 3); }
    g.setAttribute('position', new BufferAttribute(p, 3));
    return g;
  }, []);
  const mat = useMemo(() => new PointsMaterial({ color: '#FFF1B8', size: 0.07, transparent: true, blending: AdditiveBlending, depthWrite: false }), []);
  const ref = useRef<Points>(null);
  useFrame(({ clock }) => {
    mat.opacity = reduced ? 0.7 : 0.45 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 3.1));
    if (ref.current && !reduced) ref.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

/** Each place its own dance, as [lift, x sway, pitch, yaw, roll] at time t. */
type Move = (t: number) => [number, number, number, number, number];
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const DANCES: Move[] = [
  // The winner: big leaps, and every other leap a full spin in the air.
  (t) => { const ph = (t * 0.9) % 2, leap = Math.abs(Math.sin(t * Math.PI * 0.9)); return [leap * 0.38, 0, -leap * 0.15, ph > 1 ? ease(ph - 1) * Math.PI * 2 : 0, 0]; },
  // A side-to-side shuffle with a bounce on every step.
  (t) => [Math.abs(Math.sin(t * 5)) * 0.07, Math.sin(t * 2.5) * 0.22, 0, Math.sin(t * 2.5) * 0.25, Math.sin(t * 2.5) * 0.14],
  // The twist: round and back, low and quick.
  (t) => [Math.abs(Math.sin(t * 6)) * 0.04, 0, 0.05, Math.sin(t * 6) * 0.7, 0],
  // Headbanging: rocking hard nose-down on the beat.
  (t) => [Math.max(0, Math.sin(t * 4.4)) * 0.06, 0, Math.sin(t * 4.4) * 0.3, 0, 0],
  // Hop-turns: a hop and a quarter turn, again and again.
  (t) => { const n = t / 0.75, p = n % 1; return [Math.sin(p * Math.PI) * 0.18, 0, 0, (Math.floor(n) + ease(p)) * (Math.PI / 2), 0]; },
  // The wobble: rolling side to side like a jelly.
  (t) => [Math.abs(Math.sin(t * 3.2)) * 0.08, 0, 0, Math.sin(t * 1.1) * 0.3, Math.sin(t * 3.2) * 0.32],
  // The glide: sliding back and forth, half turned to the crowd.
  (t) => [Math.abs(Math.sin(t * 6)) * 0.03, Math.sin(t * 1.4) * 0.3, -0.05, -Math.PI * 0.15, 0],
];

function Dancer({ entry, reduced }: { entry: PodiumEntry; reduced: boolean }) {
  const g = useRef<Group>(null);
  const cup = useRef<Group>(null);
  const [x, y, z] = spot(entry.place);
  const move = DANCES[(entry.place - 1) % DANCES.length];
  const phase = entry.place * 0.61;
  const admin = entry.avatar === ADMIN_AVATAR_ID;
  const model = byId(entry.avatar ?? undefined);
  const drawScale = admin ? 1 : animalModel(model?.animal ?? 'sheep').drawScale;
  const trophy = useMemo(() => trophyGeometry(), []);
  const gold = useMemo(() => voxelMaterial({ emissive: '#6A4500', emissiveIntensity: 0.35 }), []);
  const [mood, setMood] = useState<{ state: SheepState; key: number }>({ state: entry.place === 1 ? 'proud' : 'happy', key: 0 });
  // The faces and legs: a fresh cheer every couple of seconds, each animal on its own clock.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setMood((m) => ({ state: m.state === 'happy' ? 'proud' : 'happy', key: m.key + 1 })), 1500 + entry.place * 230);
    return () => clearInterval(id);
  }, [reduced, entry.place]);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase;
    const [lift, sway, pitch, yaw, roll] = reduced ? [0, 0, 0, 0, 0] : move(t);
    g.current.position.set(x + sway, y + lift, z);
    g.current.rotation.set(pitch, yaw, roll);
    if (cup.current) {
      // Held up in front, and every few seconds thrust right up over the head; it keeps facing out through the spins.
      const up = reduced ? 1 : Math.max(0, Math.sin(clock.elapsedTime * 1.4)) ** 2;
      cup.current.position.set(0, 0.95 * SHEEP_SCALE + up * 0.8, 0.62 + (1 - up) * 0.12);
      cup.current.rotation.set(0, -yaw + clock.elapsedTime * (reduced ? 0 : 0.5), 0);
    }
  });
  return (
    <group ref={g} position={[x, y, z]}>
      <group scale={SHEEP_SCALE * drawScale}>
        {admin
          ? <AvatarDisc state="happy" stateKey={mood.key} reduced={reduced} speaking />
          : <Sheep level={entry.level} state={mood.state} stateKey={mood.key} reduced={reduced} scarf={entry.place === 1} lookAt="camera" speaking
              model={model ? animalModel(model.animal) : undefined} />}
      </group>
      {entry.place === 1 && (
        <group ref={cup}>
          <mesh geometry={trophy} material={gold} castShadow scale={1.3} />
          <Glints reduced={reduced} />
          <pointLight position={[0, 0.5, 0.3]} color="#FFD27A" intensity={7} distance={3.2} decay={2} />
        </group>
      )}
    </group>
  );
}

/** The camera: the whole stage in view; when the scoreboard is up it eases so the podium sits beside the board. */
function Rig({ phone, aside }: { phone: boolean; aside: boolean }) {
  const camera = useThree((st) => st.camera);
  const look = useMemo(() => new Vector3(), []);
  const at = useMemo(() => ({ x: aside && !phone ? 2.7 : 0, y: aside && phone ? -2.4 : 0 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const tx = aside && !phone ? 2.7 : 0, ty = aside && phone ? -2.4 : 0;
    const k = 1 - Math.exp(-dt * 2.5);
    at.x += (tx - at.x) * k; at.y += (ty - at.y) * k;
    if (phone) camera.position.set(at.x, 3.4 + at.y, 14.5); else camera.position.set(at.x, 3.0, 11.8);
    look.set(at.x, 1.6 + at.y, 0);
    camera.lookAt(look);
  });
  return null;
}

function Scene({ entries, reduced, anchors }: { entries: PodiumEntry[]; reduced: boolean; anchors: ReturnType<typeof useSlipRefs> }) {
  const places = useMemo(() => entries.map((e) => e.place).join(','), [entries]);
  const blocks = useMemo(() => entries.map((e) => blockGeometry(e.place)), [places]); // eslint-disable-line react-hooks/exhaustive-deps
  const carved = useMemo(() => entries.map((e) => carvedGeometry(e.place)), [places]); // eslint-disable-line react-hooks/exhaustive-deps
  const wall = useMemo(() => wallGeometry(), []);
  const doors = useMemo(() => doorsGeometry(), []);
  const floor = useMemo(() => floorGeometry(), []);
  const bale = useMemo(() => baleGeometry(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  return (
    <>
      <color attach="background" args={['#170D07']} />
      <fog attach="fog" args={['#170D07', 12, 26]} />
      <hemisphereLight args={['#FFE2B0', '#3A2414', 0.75]} />
      <ambientLight intensity={0.2} />
      <spotLight position={[0, 8, 6]} angle={0.5} penumbra={0.7} intensity={150} decay={2} color="#FFE6B8" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 3.2, 2.4]} intensity={10} distance={6} decay={2} color="#FFD08A" />
      <mesh geometry={floor} material={mat} receiveShadow />
      <mesh geometry={wall} material={mat} position={[0, 0, -3.2]} />
      <mesh geometry={doors} material={mat} position={[0, 0, -2.94]} />
      {BALES.map(([x, y, z, r], i) => <mesh key={i} geometry={bale} material={mat} position={[x, y, z]} rotation={[0, r, 0]} castShadow receiveShadow />)}
      <Loft />
      <Beams reduced={reduced} />
      {entries.map((e, i) => {
        const [x, , z] = spot(e.place);
        const front = (e.place <= 3 ? STEP.d : 0.9) / 2;
        const boardY = (heightOf(e.place) - boardHeight(e.place)) / 2;
        return (
          <group key={e.key} position={[x, 0, z]}>
            <mesh geometry={blocks[i]} material={mat} castShadow receiveShadow />
            <mesh geometry={carved[i]} material={mat} position={[0, boardY, front + 0.005]} />
            {/* The nameplate hangs just under the carved board. */}
            <ScreenAnchor el={anchors(e.place)} position={e.place <= 3 ? [0, boardY - 0.1, front + 0.06] : [0, boardY - 0.06, front + 0.06]} cull />
          </group>
        );
      })}
      {entries.map((e) => <Dancer key={e.key} entry={e} reduced={reduced} />)}
      <Drift reduced={reduced} />
    </>
  );
}

export function Podium({ entries, reduced, phone, aside = false }: { entries: PodiumEntry[]; reduced: boolean; phone: boolean; aside?: boolean }) {
  const anchors = useSlipRefs();
  return (
    <div className="sk-podium" aria-label="The podium">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }} dpr={phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, antialias: true }}
        camera={{ fov: phone ? 58 : 40, position: phone ? [0, 3.4, 14.5] : [0, 3.0, 11.8], near: 0.1, far: 60 }}
      >
        <Rig phone={phone} aside={aside} />
        <Scene entries={entries} reduced={reduced} anchors={anchors} />
      </Canvas>
      <SlipLayer refFor={anchors} seats={entries.map((e) => ({
        seat: e.place,
        label: <span className="sk-pod-name" data-place={e.place}>{e.name}{e.isYou ? ' (you)' : ''}</span>,
      }))} />
    </div>
  );
}
