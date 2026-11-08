import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, BoxGeometry, Color, Group, InstancedMesh, MeshLambertMaterial, Object3D, PCFSoftShadowMap, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { byId } from '../avatars/catalog';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { SHEEP_SCALE } from '../scene/layout';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { lin } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import { trophyGeometry } from '../voxel/trophy';
import { ScreenAnchor, SlipLayer, useSlipRefs } from './Anchors';
import { Sheep } from './Sheep';
import type { WoolLevel } from './Sheep';

/**
 * The winning screen (Brian, 2026-11-08): the top three dance on a podium in the barn, the winner holding up a big golden
 * trophy, the rest dance on the hay either side; confetti falls. Each place has its number and the player's name on a
 * black nameplate, laid over the scene under their step. Its own small canvas over the table, like the dream's bedroom.
 */
export interface PodiumEntry { key: string; name: string; place: number; avatar: string | null; level: WoolLevel; isYou: boolean }

const STEP = { w: 1.3, d: 1.1, h: [0.9, 0.62, 0.42] };
/** Where a place stands: x, the top it stands on, z. 1st in the middle, 2nd left, 3rd right, the rest on the hay. */
function spot(place: number): [number, number, number] {
  if (place === 1) return [0, STEP.h[0], 0];
  if (place === 2) return [-STEP.w - 0.05, STEP.h[1], 0];
  if (place === 3) return [STEP.w + 0.05, STEP.h[2], 0];
  const k = place - 4, side = k % 2 ? 1 : -1;
  return [side * (2.85 + Math.floor(k / 2) * 1.25), 0, 0.6];
}

const C = (h: string) => lin(h);
function stepGeometry(place: 1 | 2 | 3): BufferGeometry {
  const S = 0.1, w = 13, d = 11, h = Math.round(STEP.h[place - 1] / S);
  const trim = C(['#E8B23A', '#C9CED6', '#C07A3E'][place - 1]), trimDark = C(['#A8761E', '#8E949E', '#86512A'][place - 1]);
  const plank = [C('#8C5A2E'), C('#7A4B26'), C('#94633A')], felt = C('#A8322C'), feltDark = C('#8A2722');
  const g = new Grid(S);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) {
    const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    let c = plank[(Math.floor(x / 2) + Math.floor(hash3(x >> 1, 0, 0, 3) * 3)) % 3];
    if (y === h - 1) c = edge ? trim : hash3(x, y, z, 5) < 0.5 ? felt : feltDark;
    else if (y === h - 2 && edge) c = trimDark;
    else if (y === 0) c = C('#4A2E16');
    g.set(x, y, z, c);
  }
  return buildGeometry(g.map, S).translate(-w * S / 2, 0, -d * S / 2);
}

/** The barn's back wall behind the podium: red boards, dark seams, and a sagging string of lights. */
function wallGeometry(): BufferGeometry {
  const S = 0.25, g = new Grid(S);
  const red = [C('#7E2A1E'), C('#6E2419'), C('#88301F')], seam = C('#3A140E');
  for (let x = -40; x < 40; x++) for (let y = 0; y < 26; y++) g.set(x, y, 0, x % 4 === 0 ? seam : red[Math.floor(hash3(x >> 2, y >> 3, 0, 4) * 3)]);
  return buildGeometry(g.map, S, { ao: false }).translate(0, 0, 0);
}
const BULBS = ['#FF5A4A', '#FFD25A', '#6FD68A', '#6FB4FF', '#FF8FD0'];

function Bulbs() {
  const mats = useMemo(() => BULBS.map((c) => new MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 })), []);
  const box = useMemo(() => new BoxGeometry(0.14, 0.18, 0.14), []);
  return (
    <group position={[0, 0, -2.85]}>
      {Array.from({ length: 31 }, (_, i) => {
        const x = -7.5 + i * 0.5, y = 4.7 - Math.cos(((i % 10) / 10) * Math.PI * 2) * -0.28 - 0.28;
        return <mesh key={i} geometry={box} material={mats[i % mats.length]} position={[x, y, 0]} />;
      })}
    </group>
  );
}

function Confetti({ reduced }: { reduced: boolean }) {
  const N = 140;
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new BoxGeometry(0.06, 0.06, 0.015), []);
  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: false }), []);
  const bits = useMemo(() => Array.from({ length: N }, () => ({
    x: (Math.random() - 0.5) * 9, y: Math.random() * 6, z: (Math.random() - 0.5) * 3 + 0.5,
    v: 0.5 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 8, sway: Math.random() * 6,
  })), []);
  const o = useMemo(() => new Object3D(), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const cols = ['#E8B23A', '#A8322C', '#F4ECDD', '#2F5A3C', '#78B6E0'].map((c) => new Color(c));
    for (let i = 0; i < N; i++) m.setColorAt(i, cols[i % cols.length]);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  useFrame(({ clock }, dt) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const b = bits[i];
      if (!reduced) { b.y -= b.v * Math.min(dt, 0.05); if (b.y < 0) b.y += 6; }
      o.position.set(b.x + Math.sin(t * 1.3 + b.sway) * 0.15, b.y, b.z);
      o.rotation.set(t * b.spin, t * b.spin * 0.7, b.sway);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, N]} />;
}

/** One dancer: bounces on the beat, sways and turns a little, each on its own phase; the winner holds the trophy up. */
function Dancer({ entry, reduced, beat }: { entry: PodiumEntry; reduced: boolean; beat: number }) {
  const g = useRef<Group>(null);
  const cup = useRef<Group>(null);
  const [x, y, z] = spot(entry.place);
  const phase = entry.place * 0.37;
  const admin = entry.avatar === ADMIN_AVATAR_ID;
  const model = byId(entry.avatar ?? undefined);
  const drawScale = admin ? 1 : animalModel(model?.animal ?? 'sheep').drawScale;
  const trophy = useMemo(() => trophyGeometry(), []);
  const gold = useMemo(() => voxelMaterial({ emissive: '#6A4500', emissiveIntensity: 0.35 }), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase;
    const k = reduced ? 0 : 1, beatT = t * Math.PI * 2.2;
    g.current.position.set(x, y + Math.abs(Math.sin(beatT)) * 0.14 * k * (entry.place === 1 ? 1.3 : 1), z);
    g.current.rotation.set(0, Math.sin(t * 1.1) * 0.35 * k, Math.sin(beatT / 2) * 0.1 * k);
    if (cup.current) {
      // Held up in front, and every few seconds thrust right up over the head.
      const lift = reduced ? 0 : Math.max(0, Math.sin(clock.elapsedTime * 1.6)) ** 2;
      cup.current.position.set(0, 0.95 * SHEEP_SCALE + lift * 0.75, 0.62 + (1 - lift) * 0.12);
      cup.current.rotation.set(0, clock.elapsedTime * (reduced ? 0 : 0.6), Math.sin(beatT) * 0.08 * k);
    }
  });
  return (
    <group ref={g} position={[x, y, z]}>
      <group scale={SHEEP_SCALE * drawScale}>
        {admin
          ? <AvatarDisc state="happy" stateKey={beat} reduced={reduced} speaking />
          : <Sheep level={entry.level} state="happy" stateKey={beat} reduced={reduced} scarf={entry.place === 1} lookAt="camera" speaking
              model={model ? animalModel(model.animal) : undefined} />}
      </group>
      {entry.place === 1 && (
        <group ref={cup}>
          <mesh geometry={trophy} material={gold} castShadow scale={1.25} />
          <pointLight position={[0, 0.5, 0.3]} color="#FFD27A" intensity={6} distance={3} decay={2} />
        </group>
      )}
    </group>
  );
}

/** The camera: the whole podium and the hay either side in view; when the scoreboard is up it eases so the podium
 *  sits beside the board (left of it on a wide screen, above it on a phone). */
function Rig({ phone, aside }: { phone: boolean; aside: boolean }) {
  const camera = useThree((st) => st.camera);
  const look = useMemo(() => new Vector3(), []);
  const at = useMemo(() => ({ x: 0, y: 0 }), []);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2.5);
    const tx = aside && !phone ? 2.4 : 0, ty = aside && phone ? -2.2 : 0;
    at.x += (tx - at.x) * k; at.y += (ty - at.y) * k;
    if (phone) camera.position.set(at.x, 2.6 + at.y, 11.5); else camera.position.set(at.x, 2.4, 10.2);
    look.set(at.x, 1.15 + at.y, 0);
    camera.lookAt(look);
  });
  return null;
}

function Scene({ entries, reduced, anchors }: { entries: PodiumEntry[]; reduced: boolean; anchors: ReturnType<typeof useSlipRefs> }) {
  const steps = useMemo(() => [stepGeometry(1), stepGeometry(2), stepGeometry(3)], []);
  const wall = useMemo(() => wallGeometry(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const floor = useMemo(() => new BoxGeometry(24, 0.1, 10), []);
  const hay = useMemo(() => new MeshLambertMaterial({ color: '#B8894A' }), []);
  const [beat, setBeat] = useState(0);
  useEffect(() => { if (reduced) return; const id = window.setInterval(() => setBeat((b) => b + 1), 1700); return () => clearInterval(id); }, [reduced]);
  const anchorAt = (place: number): [number, number, number] => {
    const [x, , ] = spot(place);
    return place <= 3 ? [x, STEP.h[place - 1] * 0.5, STEP.d / 2 + 0.02] : [x, 0.2, 0.55 + 0.6];
  };
  return (
    <>
      <color attach="background" args={['#1A0F09']} />
      <fog attach="fog" args={['#1A0F09', 9, 20]} />
      <hemisphereLight args={['#FFE2B0', '#3A2414', 0.9]} />
      <ambientLight intensity={0.25} />
      <spotLight position={[0, 7, 5]} angle={0.55} penumbra={0.6} intensity={120} decay={2} color="#FFE6B8" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 3, 2]} intensity={14} distance={9} decay={2} color="#FFB870" />
      <pointLight position={[4, 3, 2]} intensity={14} distance={9} decay={2} color="#FFB870" />
      <mesh geometry={floor} material={hay} position={[0, -0.05, 0]} receiveShadow />
      <mesh geometry={wall} material={mat} position={[0, 0, -3]} />
      <Bulbs />
      {[1, 2, 3].map((p) => {
        const [x] = spot(p);
        return <mesh key={p} geometry={steps[p - 1]} material={mat} position={[x, 0, 0]} castShadow receiveShadow />;
      })}
      {entries.map((e) => <Dancer key={e.key} entry={e} reduced={reduced} beat={beat} />)}
      {entries.map((e) => <ScreenAnchor key={`a${e.key}`} el={anchors(e.place)} position={anchorAt(e.place)} cull />)}
      <Confetti reduced={reduced} />
    </>
  );
}

export function Podium({ entries, reduced, phone, aside = false }: { entries: PodiumEntry[]; reduced: boolean; phone: boolean; aside?: boolean }) {
  const anchors = useSlipRefs();
  const cam = phone ? { position: [0, 2.6, 11.5] as const, fov: 58 } : { position: [0, 2.4, 10.2] as const, fov: 40 };
  return (
    <div className="sk-podium" aria-label="The podium">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }} dpr={phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, antialias: true }}
        camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 60 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.15, 0)}
      >
        <Rig phone={phone} aside={aside} />
        <Scene entries={entries} reduced={reduced} anchors={anchors} />
      </Canvas>
      <SlipLayer refFor={anchors} seats={entries.map((e) => ({
        seat: e.place,
        label: (
          <div className="sk-pod-label" data-place={e.place}>
            <b className="sk-pod-num">{e.place}</b>
            <span className="sk-pod-name">{e.name}{e.isYou ? ' (you)' : ''}</span>
          </div>
        ),
      }))} />
    </div>
  );
}

