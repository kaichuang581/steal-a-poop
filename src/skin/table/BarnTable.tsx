import { Billboard, Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Color, Fog, Group, Mesh, MeshLambertMaterial, NoToneMapping, PCFShadowMap, PointLight, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import type { Hour } from '../model/types';
import { buildBarn, CAT_SPOT, ROBIN_SPOT } from '../scene/barn';
import { buildDistance } from '../scene/distance';
import { BARN, CAMERA, HEAP, SHEEP_SCALE, seatPosition } from '../scene/layout';
import { ChimneySmoke, Sky, Windmill } from '../scene/Sky';
import { buildYard } from '../scene/yard';
import { digitGeometry, heapModel, icicleModel, shearsModel, tuftGeometry, wolfEyes, wolfModel } from '../voxel/characters';
import { voxelMaterial } from '../voxel/material';
import { DevStats } from './DevStats';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

export interface BarnSeat {
  seat: number;
  index: number;
  level: WoolLevel;
  state: SheepState;
  stateKey: number;
  coldFor?: number;
  dimmed: boolean;
  scarf: boolean;
  label: ReactNode;
}

/** One-shot moments the table animates, each restarted by a new key. */
export interface BarnMoments {
  /** Valid word: a tuft flies from the speaker to the heap. */
  tuftIn?: { key: number; from: number };
  /** Bank: the heap's wool flies onto the banker's back. */
  tuftOut?: { key: number; to: number };
  /** Successful steal: the wolf runs door, heap, stealer, door. */
  wolf?: { key: number; to: number };
  /** Failed steal: shears come down on the stealer and tufts fly off. */
  shears?: { key: number; at: number };
  /** Time out: a cold gust blows a tuft off the sheep and out of the back door. */
  gust?: { key: number; at: number };
  /** Last life lost: lantern flames dim to 40% for the freeze. */
  freeze?: { key: number };
}

interface Props {
  seats: BarnSeat[];
  pile: number;
  /** Seat index (as in BarnSeat.index) whose turn it is; the camera frames them and the icicle hangs over them. */
  speaker: number | null;
  /** 0..1 of the turn left (the icicle's length). */
  fraction: number;
  stealOpen: boolean;
  hour: Hour;
  reduced: boolean;
  phone: boolean;
  blizzard: boolean;
  moments: BarnMoments;
  /** Extra 3D content for a mode's place (pen lanterns, the sheepdog). */
  children?: ReactNode;
}

const FOG: Record<Hour, string> = { dawn: '#F3C9B5', day: '#BFE1F3', dusk: '#D08AA2', night: '#273B66' };
const SUN: Record<Hour, { color: string; intensity: number; pos: [number, number, number] }> = {
  dawn: { color: '#FFD9A0', intensity: 1.2, pos: [-18, 10, 30] },
  day: { color: '#FFF6E0', intensity: 1.7, pos: [8, 22, 14] },
  dusk: { color: '#FFB36B', intensity: 1.0, pos: [22, 8, 30] },
  night: { color: '#9FB7D6', intensity: 0.5, pos: [-6, 20, 20] },
};

/** World-static voxel content, built once per page and shared by the table and the Home backdrop. */
export type World = ReturnType<typeof buildWorld>;
let world: World | null = null;
function buildWorld() {
  const t0 = performance.now();
  const barn = buildBarn();
  const yard = buildYard();
  const distance = buildDistance();
  const ms = performance.now() - t0;
  return { barn, yard, distance, ms };
}

/** The world, built on the first call after paint so the page is not blank-blocked while it builds. */
export function useWorld(): World | null {
  const [w, setW] = useState(world);
  useEffect(() => {
    if (world) return;
    const id = setTimeout(() => { world ??= buildWorld(); setW(world); }, 0);
    return () => clearTimeout(id);
  }, []);
  return w;
}

export function worldBuildMs(): number | null {
  return world?.ms ?? null;
}

/** The static farm: barn, yard, distance and the lanterns' glow. Shared by the table and the Home backdrop. */
export function Farm({ world: w, hour, reduced, stealOpen, lampRef }: { world: World; hour: Hour; reduced: boolean; stealOpen: boolean; lampRef?: (i: number, l: PointLight | null) => void }) {
  const { barn, yard, distance } = w;
  const voxMat = useMemo(() => voxelMaterial(), []);
  const glowMat = useMemo(() => voxelMaterial({ emissive: '#FFC24B', emissiveIntensity: 0.8 }), []);
  const sun = SUN[hour];
  return (
    <>
      <hemisphereLight args={['#DCE6F2', '#8E3A31', hour === 'night' ? 0.55 : 0.7]} />
      <directionalLight
        position={sun.pos} color={sun.color} intensity={sun.intensity} castShadow
        shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.01}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-far={80}
      />
      {BARN.lanterns.map((p, i) => (
        <pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]} color="#FFC24B" intensity={9} distance={14} decay={1.2} />
      ))}
      {barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      {barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}
      <mesh geometry={barn.lanterns} material={glowMat} />
      <mesh geometry={barn.tarp} material={voxMat} />
      <Cat geo={barn.cat} reduced={reduced} frozen={stealOpen} mat={voxMat} />
      <Robin geo={barn.robin} reduced={reduced || stealOpen} mat={voxMat} />
      {yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      <ChimneySmoke from={yard.smokeFrom} />
      <mesh geometry={distance.hills} material={voxMat} receiveShadow />
      <mesh geometry={distance.mountains} material={voxMat} />
      <Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />
    </>
  );
}

export function BarnTable(props: Props) {
  const cam = props.phone ? CAMERA.phone : CAMERA.desktop;
  const w = useWorld();
  if (!w) return <Building />;
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 1.5]}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: NoToneMapping, antialias: true }}
      camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
    >
      <Scene {...props} world={w} />
    </Canvas>
  );
}

export function Building() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="sk-paper sk-display px-4 py-2 text-lg">Raising the barn…</div>
    </div>
  );
}

function Scene({ seats, pile, speaker, fraction, stealOpen, hour, reduced, phone, blizzard, moments, children, world: w }: Props & { world: World }) {
  const scene = useThree((s) => s.scene);
  const lamps = useRef<(PointLight | null)[]>([]);
  const n = seats.length;
  const pos = (i: number) => seatPosition(i, n);

  useEffect(() => {
    scene.fog = new Fog(FOG[hour], 30, 210);
    scene.background = new Color(FOG[hour]);
  }, [scene, hour]);

  // The freeze dims the lanterns to 40% for 2.4 s.
  const freezeAt = useRef(-10);
  const freezeKey = moments.freeze?.key;
  useEffect(() => { if (freezeKey !== undefined) freezeAt.current = performance.now() / 1000; }, [freezeKey]);
  useFrame(({ clock }) => {
    const dim = performance.now() / 1000 - freezeAt.current < 2.4 ? 0.4 : 1;
    const flicker = reduced || stealOpen ? 1 : 1 + Math.sin(clock.elapsedTime * 7.3) * 0.05;
    for (const l of lamps.current) if (l) l.intensity = 9 * dim * flicker;
  });

  return (
    <>
      <CameraRig focus={speaker} n={n} phone={phone} reduced={reduced} />
      <Sky hour={hour} reduced={reduced} blizzard={blizzard} />
      <Farm world={w} hour={hour} reduced={reduced} stealOpen={stealOpen} lampRef={(i, l) => { lamps.current[i] = l; }} />
      <Heap pile={pile} />
      {stealOpen && <WolfEyes />}
      {speaker !== null && <Icicle at={pos(speaker)} fraction={fraction} red={stealOpen} reduced={reduced} />}
      {seats.map((s) => {
        const p = pos(s.index);
        return (
          <group key={s.seat} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE}>
            <Sheep level={s.level} state={s.state} stateKey={s.stateKey} coldFor={s.coldFor} dimmed={s.dimmed} reduced={reduced} still={stealOpen} scarf={s.scarf}
              gustFrom={[0, 0.8, -6]} />
            <Html position={[0, 1.3, 0]} center zIndexRange={[20, 0]}>{s.label}</Html>
          </group>
        );
      })}
      <Moments moments={moments} n={n} reduced={reduced} />
      {children}
      <DevStats />
    </>
  );
}

/**
 * The camera looks at whoever's turn it is: it stands across the heap from their seat, a little above, so you see
 * their face with the heap in front. Between turns it pulls back to the wide shot from outside the open front.
 * Reduced motion cuts instead of gliding.
 */
function CameraRig({ focus, n, phone, reduced }: { focus: number | null; n: number; phone: boolean; reduced: boolean }) {
  const look = useRef<Vector3 | null>(null);
  const wide = phone ? CAMERA.phone : CAMERA.desktop;
  useFrame(({ camera }, dt) => {
    const pos = new Vector3();
    const target = new Vector3();
    if (focus === null) {
      pos.set(wide.position[0], wide.position[1], wide.position[2]);
      target.set(wide.target[0], wide.target[1], wide.target[2]);
    } else {
      const p = seatPosition(focus, n);
      const dir = new Vector3(p.x - HEAP[0], 0, p.z - HEAP[2]).normalize();
      const back = phone ? 3.8 : 3.2;
      pos.set(HEAP[0] - dir.x * back, phone ? 3.0 : 2.6, HEAP[2] - dir.z * back);
      target.set(p.x, 1.0, p.z);
    }
    look.current ??= target.clone();
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

function Heap({ pile }: { pile: number }) {
  const heapGeometry = useMemo(() => heapModel(), []);
  const level = Math.min(8, Math.ceil(pile / 8));
  const digits = useMemo(() => digitGeometry(String(pile), 0.05), [pile]);
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => voxelMaterial({ emissive: '#FFC24B', emissiveIntensity: 0.35 }), []);
  return (
    <group position={[HEAP[0], 0.02, HEAP[2]]}>
      <mesh geometry={heapGeometry(level)} material={mat} castShadow receiveShadow />
      <Billboard position={[0, 1.15 + level * 0.06, 0]}>
        <mesh geometry={digits} material={glow} />
      </Billboard>
      <Html position={[0, 0.05, 0]} center zIndexRange={[10, 0]}>
        <div className="sk-chip pointer-events-none text-xs" data-pile data-tour="pile" aria-label={`Pile ${pile} points`}>the heap</div>
      </Html>
    </group>
  );
}

function WolfEyes() {
  const geo = useMemo(() => wolfEyes(), []);
  const mat = useMemo(() => voxelMaterial({ emissive: '#FFE066', emissiveIntensity: 1 }), []);
  return <mesh geometry={geo} material={mat} position={[BARN.minX + 0.15, 1.2, BARN.sideDoor.z]} rotation={[0, Math.PI / 2, 0]} />;
}

function Icicle({ at, fraction, red, reduced }: { at: { x: number; z: number }; fraction: number; red: boolean; reduced: boolean }) {
  const m = useMemo(() => icicleModel(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const drip = useRef<Mesh>(null);
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    mat.color.set(red ? '#E7705E' : '#FFFFFF');
    if (g.current) {
      g.current.position.x += (at.x - g.current.position.x) * 0.15;
      g.current.position.z += (at.z - g.current.position.z) * 0.15;
    }
    if (drip.current) {
      const p = reduced ? 0 : (clock.elapsedTime % 2) / 2;
      drip.current.position.y = -0.8 * fraction - p * 1.2;
      drip.current.visible = !reduced && p < 0.9;
    }
  });
  return (
    <group ref={g} position={[at.x, 3.25, at.z]}>
      <mesh geometry={m.ice.geo} material={mat} scale={[1, 0.25 + 0.75 * fraction, 1]} />
      <mesh ref={drip} geometry={m.drip} material={mat} />
    </group>
  );
}

function Cat({ geo, reduced, frozen, mat }: { geo: { body: BufferGeometry; tail: BufferGeometry; tailPivot: [number, number, number] }; reduced: boolean; frozen: boolean; mat: MeshLambertMaterial }) {
  const body = useRef<Mesh>(null);
  const tail = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (reduced || frozen) return;
    const t = clock.elapsedTime;
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 1.4) * 0.02;
    if (tail.current) tail.current.rotation.z = Math.sin(t * 0.8) * 0.15;
  });
  return (
    <group position={CAT_SPOT}>
      <mesh ref={body} geometry={geo.body} material={mat} castShadow />
      <mesh ref={tail} geometry={geo.tail} material={mat} position={geo.tailPivot} castShadow />
    </group>
  );
}

function Robin({ geo, reduced, mat }: { geo: BufferGeometry; reduced: boolean; mat: MeshLambertMaterial }) {
  const r = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!r.current || reduced) return;
    const t = clock.elapsedTime % 12;
    r.current.position.y = ROBIN_SPOT[1] + (t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 0.12 : 0);
    r.current.position.x = ROBIN_SPOT[0] + (t < 0.4 ? t * 0.4 : 0.16) * (Math.floor(Date.now() / 12000) % 2 ? 1 : -1);
  });
  return <mesh ref={r} geometry={geo} material={mat} position={ROBIN_SPOT} castShadow />;
}

/** Tufts, the wolf run, the shears and the gust, each a short one-shot from its key. */
function Moments({ moments, n, reduced }: { moments: BarnMoments; n: number; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const tuft = useMemo(() => tuftGeometry(3), []);
  const wolf = useMemo(() => wolfModel(), []);
  const shears = useMemo(() => shearsModel(), []);
  const at = useRef<Record<string, { key: number; t0: number }>>({});
  const refs = useRef<Record<string, Group | null>>({});
  const set = (k: string) => (g: Group | null) => { refs.current[k] = g; };
  const seat = (i: number) => { const p = seatPosition(i, n); return [p.x, 0, p.z] as const; };

  useFrame(() => {
    const now = performance.now() / 1000;
    const run = (name: keyof BarnMoments, len: number, fn: (e: number, g: Group) => void) => {
      const m = moments[name];
      const g = refs.current[name];
      if (!g) return;
      if (!m) { g.visible = false; return; }
      if (at.current[name]?.key !== m.key) at.current[name] = { key: m.key, t0: now };
      const e = now - at.current[name].t0;
      g.visible = e < len && !(reduced && name === 'wolf');
      if (g.visible) fn(e, g);
    };
    const arc = (g: Group, a: readonly number[], b: readonly number[], p: number, h: number) =>
      g.position.set(a[0] + (b[0] - a[0]) * p, 0.9 + Math.sin(p * Math.PI) * h + (a[1] + (b[1] - a[1]) * p), a[2] + (b[2] - a[2]) * p);
    run('tuftIn', 0.8, (e, g) => arc(g, seat(moments.tuftIn!.from), HEAP, Math.min(1, e / 0.8), 1.2));
    run('tuftOut', 1.1, (e, g) => arc(g, HEAP, seat(moments.tuftOut!.to), Math.min(1, e / 1.1), 1.6));
    run('gust', 0.9, (e, g) => arc(g, seat(moments.gust!.at), [0, 1.2, BARN.maxZ + 2], Math.min(1, e / 0.9), 0.6));
    run('wolf', 1.3, (e, g) => {
      const door = [BARN.minX - 0.5, 0, BARN.sideDoor.z] as const;
      const to = seat(moments.wolf!.to);
      const pts = [door, HEAP, to, door];
      const p = Math.min(0.999, e / 1.3) * 3;
      const i = Math.floor(p), f = p - i;
      const a = pts[i], b = pts[i + 1];
      g.position.set(a[0] + (b[0] - a[0]) * f, Math.abs(Math.sin(p * Math.PI * 2)) * 0.12, a[2] + (b[2] - a[2]) * f);
      g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
    });
    run('shears', 0.9, (e, g) => {
      const s = seat(moments.shears!.at);
      g.position.set(s[0], 2.2 - Math.min(1, e / 0.35) * 1.0, s[2]);
      const blades = g.children;
      const snip = Math.abs(Math.sin(e * 18)) * 0.5;
      if (blades[0]) blades[0].rotation.y = snip;
      if (blades[1]) blades[1].rotation.y = -snip;
    });
  });

  return (
    <>
      <group ref={set('tuftIn')} visible={false}><mesh geometry={tuft} material={mat} /></group>
      <group ref={set('tuftOut')} visible={false}>
        {[0, 1, 2].map((i) => <mesh key={i} geometry={tuft} material={mat} position={[i * 0.12 - 0.12, i * 0.05, 0]} />)}
      </group>
      <group ref={set('gust')} visible={false}><mesh geometry={tuft} material={mat} /></group>
      <group ref={set('wolf')} visible={false} scale={1.4}>
        {[wolf.body, wolf.head, wolf.tail, wolf.eyes, ...wolf.legs].map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} castShadow />)}
        <mesh geometry={tuft} material={mat} position={[0, 0.75, 0.45]} scale={2.2} />
      </group>
      <group ref={set('shears')} visible={false} scale={1.4}>
        <mesh geometry={shears.bladeA.geo} position={shears.bladeA.pivot} material={mat} />
        <mesh geometry={shears.bladeB.geo} position={shears.bladeB.pivot} material={mat} />
      </group>
    </>
  );
}
