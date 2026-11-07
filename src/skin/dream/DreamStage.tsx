import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import {
  ACESFilmicToneMapping, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, FogExp2, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  Object3D, PCFSoftShadowMap, PlaneGeometry, Points, PointsMaterial, SRGBColorSpace,
} from 'three';
import type { PerspectiveCamera } from 'three';
import { FIELD, jumpHeight, takeoffDistance } from '../../dream/dream';
import { Sky, Windmill } from '../scene/Sky';
import { useWorld } from '../table/BarnTable';
import { DevStats, devOn } from '../table/DevStats';
import { buildBedroomFestive } from '../scene/festive';
import { Festive } from '../table/Festive';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { BED, bedroomGeometry, farmerGeometry, trailPuff } from './bedroom';
import {
  BEDROOM, CHUNK, chunkPlacements, DREAM_SKY, dreamShot, HILLS, ISLANDS, islandX, LAYER, MOON, MOUNTAINS, PX, scrollOf, SEA, TRAIL, WAKE, worldX,
} from './stage';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bonkStar, cloudSea, fence as fenceGeometry, hills as hillsGeometry, island as islandGeometry, laneChunk, mountains as mountainsGeometry, shadowDisc, signLetters, signPost, signRim, wisp } from './world';

const SLOTS = 4;
const SX = FIELD.sheepX, SW = FIELD.sheepW, FW = FIELD.fenceW;
/** The sheep model is about 1.3 m long at scale 1; the logical sheep is 20 px = 0.72 m. */
const SHEEP_SCALE = (FIELD.sheepW * PX) / 1.3;

/** What the stage reads every frame; the screen owns the state and only this view of it is shared. */
export interface StageLive {
  dist: number;
  t: number;
  jumpAt: number | null;
  crashAt: number | null;
  speed: number;
  fences: { index: number; x: number; locked: boolean; passed: boolean; jumped: boolean }[];
}

/** One fence's sign, as React sees it (changes seldom); positions come from the live ref. */
export interface FenceView { index: number; letters: readonly string[]; word: string; locked: boolean; hot: boolean; wrong: boolean }

export type Phase = 'ready' | 'running' | 'crashed' | 'results';

interface Props {
  live: MutableRefObject<StageLive>;
  fences: FenceView[];
  /** The latest sheep counted, to pop over the sheep. */
  pop: { n: number; key: number } | null;
  phase: Phase;
  reduced: boolean;
  phone: boolean;
  landscapePhone?: boolean;
}

/**
 * The dream, full screen (V4 Parts 4 to 7): the farmer asleep in his bed at the bottom-left, three cloud puffs
 * climbing from his head into the dream, where his sheep runs along the snowy top of a floating cloud island and
 * jumps fences carrying the night's letters, past islands with his own barn, windmill and pines. When the sheep bumps
 * a fence he stirs and the dream pops back into his head.
 */
export function DreamStage(props: Props) {
  const shot = dreamShot(props.phone, props.landscapePhone);
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }} dpr={props.phone ? [1, 1.5] : [1, 2]}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
      camera={{ fov: shot.fov, position: [...shot.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(...shot.target)}
    >
      <Scene {...props} />
      <DevStats />
    </Canvas>
  );
}

function Scene({ live, fences, pop, phase, reduced, phone, landscapePhone }: Props) {
  const scene = useThree((s) => s.scene);
  const voxMat = useMemo(() => voxelMaterial(), []);
  const glowMat = useMemo(() => voxelMaterial({ emissive: T.lantern[0], emissiveIntensity: 1.2 }), []);
  const geo = useMemo(() => ({
    chunks: Array.from({ length: CHUNK.count }, (_, i) => laneChunk(i)),
    // The far layers tile: three copies of each merged into one mesh, moved as a whole and wrapped by one period.
    sea: tiled(cloudSea(), SEA.period, 3), hills: tiled(hillsGeometry(), HILLS.period, 3), mountains: tiled(mountainsGeometry(), MOUNTAINS.period, 2),
    islands: ISLANDS.map((it) => islandGeometry(it.kind, it.across, it.tall, it.id)),
    wisps: [1, 2, 3, 4].map((k) => wisp(k)),
    fence: fenceGeometry(), shadow: shadowDisc(), fenceShadow: shadowDisc(0.5, 0.2), star: bonkStar(),
  }), []);
  useEffect(() => {
    scene.fog = new FogExp2(DREAM_SKY.horizon, DREAM_SKY.fogDensity);
    scene.background = new Color(DREAM_SKY.horizon);
  }, [scene]);

  // ---- the groups the frame loop moves
  const dream = useRef<Group>(null);
  const chunks = useRef<(Group | null)[]>([]);
  const seas = useRef<(Group | null)[]>([]);
  const hillRefs = useRef<(Group | null)[]>([]);
  const mountainRefs = useRef<(Group | null)[]>([]);
  const islandRefs = useRef<(Group | null)[]>([]);
  const wispRefs = useRef<(Group | null)[]>([]);
  const sheep = useRef<Group>(null);
  const sheepShadow = useRef<Mesh>(null);
  const stars = useRef<(Mesh | null)[]>([]);
  const slots = useRef<(Group | null)[]>([]);
  const fenceMeshes = useRef<(Group | null)[]>([]);
  const [sheepState, setSheepState] = useState<SheepState>('grazing');
  const [stateKey, setStateKey] = useState(0);
  const [pace, setPace] = useState(0);
  const paceRef = useRef(0);
  const anim = useMemo(() => ({ state: 'grazing' as SheepState, landUntil: -1, wasAir: false, snowAt: -10, fenceSnowAt: -10, fenceSnowX: 0 }), []);

  useFrame(({ clock }) => {
    const L = live.current;
    const scroll = scrollOf(L.dist);
    const t = clock.elapsedTime;
    // The lane ring, the sea, the hills and the mountains, each at its layer's pace.
    for (const p of chunkPlacements(scroll)) { const g = chunks.current[p.index]; if (g) g.position.x = p.x; }
    if (seas.current[0]) seas.current[0].position.x = -((scroll * SEA.factor) % SEA.period);
    if (hillRefs.current[0]) hillRefs.current[0].position.x = -((scroll * LAYER.hills) % HILLS.period) - HILLS.period / 2;
    if (mountainRefs.current[0]) mountainRefs.current[0].position.x = -((scroll * LAYER.mountains) % MOUNTAINS.period) - MOUNTAINS.period / 3;
    ISLANDS.forEach((it, i) => {
      const g = islandRefs.current[i];
      if (!g) return;
      g.position.x = islandX(it, scroll);
      g.position.y = it.y + (reduced ? 0 : Math.sin((t / it.period) * Math.PI * 2 + it.id) * 0.08);
    });
    wispRefs.current.forEach((g, i) => { if (g) g.position.x = ((((i * 7 - scroll * 0.08) + 12) % 24) + 24) % 24 - 12; });

    // The sheep: which state it is in, how high, and knocked back on the bonk.
    const air = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt) * PX;
    const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
    const about = !!ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed) + L.speed * 0.08;
    let want: SheepState = 'run';
    if (phase === 'ready') want = 'grazing';
    else if (L.crashAt !== null) want = 'bonk';
    else if (L.jumpAt !== null || about) want = 'jump';
    else if (anim.wasAir || L.t < anim.landUntil) { if (anim.wasAir) { anim.landUntil = L.t + 100; anim.snowAt = t; } want = 'land'; }
    anim.wasAir = L.jumpAt !== null;
    if (want !== anim.state) { anim.state = want; setSheepState(want); setStateKey((k) => k + 1); }
    const p = Math.round(Math.min(1, Math.max(0, (L.speed - 58) / 42)) * 10) / 10;
    if (p !== paceRef.current) { paceRef.current = p; setPace(p); }
    if (sheep.current) {
      const back = L.crashAt !== null ? -0.25 * Math.min(1, (L.t - L.crashAt) / 200) : 0;
      sheep.current.position.set(back, air, 0);
    }
    if (sheepShadow.current) { const k = 1 - 0.4 * Math.min(1, air / (28 * PX)); sheepShadow.current.scale.set(k, 1, k); }
    // Bonk stars orbit 0.25 m above the head from 350 ms.
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = since >= WAKE.stir && !reduced;
      const a = (t / 1.1) * Math.PI * 2 + (i / 3) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.25, 0.95 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.25);
    });

    // Fences: slot = index % 4; the bumped one tips over about its +x edge.
    const used = new Set<number>();
    for (const fe of L.fences) {
      const slot = fe.index % SLOTS;
      const g = slots.current[slot];
      if (!g) continue;
      used.add(slot);
      g.visible = true;
      g.position.x = worldX(fe.x) + (FW * PX) / 2;
      const hit = L.crashAt !== null && !fe.passed && !fe.jumped && fe.x < SX + SW && fe.x + FW > SX;
      const f = fenceMeshes.current[slot];
      if (f) {
        const e = hit ? (L.t - L.crashAt!) / 1000 : 0;
        const ang = !hit ? 0 : reduced ? 70 : e < 0.4 ? 78 * easeOut(e / 0.4) : e < 0.55 ? 78 - 8 * ((e - 0.4) / 0.15) : 70;
        f.rotation.z = -(ang * Math.PI) / 180;
        if (hit && anim.fenceSnowAt < 0) { anim.fenceSnowAt = t; anim.fenceSnowX = g.position.x; }
      }
    }
    slots.current.forEach((g, i) => { if (g && !used.has(i)) g.visible = false; });
    if (L.crashAt === null) anim.fenceSnowAt = -10;

    // The pop: the dream shrinks toward the top puff from 600 ms, and is hidden at 1100 ms.
    if (dream.current) {
      const top = TRAIL[2].c;
      if (since >= WAKE.pop && !reduced) {
        const k = Math.min(1, (since - WAKE.pop) / WAKE.popMs);
        const sc = 1 - 0.98 * k * k;
        dream.current.scale.setScalar(sc);
        dream.current.position.set(top[0] * (1 - sc), top[1] * (1 - sc), top[2] * (1 - sc));
      } else { dream.current.scale.setScalar(1); dream.current.position.set(0, 0, 0); }
      dream.current.visible = phase !== 'results' && !(since >= WAKE.dark);
    }
  });

  const w = useWorld();
  const slotViews = useMemo(() => Array.from({ length: SLOTS }, (_, slot) => fences.find((v) => v.index % SLOTS === slot) ?? null), [fences]);

  return (
    <>
      <DreamCamera phone={phone} landscapePhone={landscapePhone} reduced={reduced} live={live} />
      {/* One rig for both worlds (decision 16.4): the moon's key light, a lavender sky fill. */}
      <hemisphereLight args={['#8A78D2', '#4E4284', 0.6]} />
      <directionalLight
        position={[4, 9, 6]} color="#CFD8FF" intensity={1.1} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-near={1} shadow-camera-far={40}
      />
      <Sky hour="night" reduced={reduced} blizzard={false} palette="dream" />
      <DreamMoon />
      <NightFade live={live} reduced={reduced} phase={phase} />

      {/* The dream: everything that pops when the farmer wakes. */}
      <group ref={dream}>
        {geo.chunks.map((g, i) => (
          <group key={i} ref={(el) => { chunks.current[i] = el; }}><mesh geometry={g} material={voxMat} castShadow receiveShadow /></group>
        ))}
        <group ref={(el) => { seas.current[0] = el; }}><mesh geometry={geo.sea} material={voxMat} /></group>
        <group ref={(el) => { hillRefs.current[0] = el; }}><mesh geometry={geo.hills} material={voxMat} /></group>
        <group ref={(el) => { mountainRefs.current[0] = el; }}><mesh geometry={geo.mountains} material={voxMat} /></group>
        {ISLANDS.map((it, i) => (
          <group key={it.id} ref={(el) => { islandRefs.current[i] = el; }} position={[it.x, it.y, it.z]}>
            <mesh geometry={geo.islands[i].body} material={voxMat} castShadow receiveShadow />
            {geo.islands[i].glow && <mesh geometry={geo.islands[i].glow} material={glowMat} />}
            {it.kind === 'windmill' && w && (
              <group position={[0.8, 0, 0]} scale={0.28}><Windmill body={w.distance.windmillBody} blades={w.distance.windmillBlades} hub={w.distance.bladesHub} /></group>
            )}
          </group>
        ))}
        {geo.wisps.map((g, i) => (
          <group key={i} ref={(el) => { wispRefs.current[i] = el; }} position={[0, 3.5 + (i % 3) * 0.5, -4 - i]}><mesh geometry={g} material={voxMat} /></group>
        ))}
        <Dust reduced={reduced} live={live} />

        {/* The fences, each with its sign post 0.3 m to its +x side. */}
        {slotViews.map((f, slot) => (
          <group key={slot} ref={(el) => { slots.current[slot] = el; }} position={[200, 0, 0]} visible={false}>
            <group position={[0.215, 0, 0]}>
              <group ref={(el) => { fenceMeshes.current[slot] = el; }}>
                <mesh geometry={geo.fence} material={voxMat} position={[-0.215, 0, 0]} castShadow receiveShadow />
              </group>
            </group>
            <mesh geometry={geo.fenceShadow} material={shadowMat} position={[0, 0.005, 0]} />
            <Sign view={f} />
          </group>
        ))}

        {/* The sheep faces +x and runs on the spot; the world does the moving. */}
        <group ref={sheep}>
          <group rotation={[0, Math.PI / 2, 0]} scale={SHEEP_SCALE}>
            <Sheep level={2} state={sheepState} stateKey={stateKey} reduced={reduced} gustFrom={[0, 0.8, -4]} pace={pace} />
          </group>
          {[0, 1, 2].map((i) => <mesh key={i} ref={(el) => { stars.current[i] = el; }} geometry={geo.star} material={glowMat} visible={false} />)}
          <Html position={[0, 1.4, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            {pop && <span key={pop.key} className="dr-pop sk-display">{pop.n}</span>}
          </Html>
        </group>
        <mesh ref={sheepShadow} geometry={geo.shadow} material={shadowMat} position={[0, 0.005, 0]} />
        <SnowBursts anim={anim} />
      </group>

      {/* The real world: the bedroom, the farmer and the thought trail. */}
      <Bedroom live={live} reduced={reduced} phone={phone} phase={phase} />
    </>
  );
}

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** `copies` of a periodic tile laid side by side (from one period before to one after) as one geometry. */
function tiled(tile: BufferGeometry, period: number, copies: number): BufferGeometry {
  const parts = Array.from({ length: copies }, (_, i) => tile.clone().translate((i - 1) * period, 0, 0));
  return mergeGeometries(parts, false) ?? tile;
}
const shadowMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false });

/** The sign on its post: carved letters, a cream rim when it is the next to clear, red letters on a bounce, green and a paper tag once cleared. */
function Sign({ view }: { view: FenceView | null }) {
  const n = view?.letters.length ?? 1;
  const post = useMemo(() => signPost(n), [n]);
  const rim = useMemo(() => signRim(n), [n]);
  const letters = useMemo(() => (view ? signLetters(view.letters) : null), [view?.letters.join('')]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => new MeshLambertMaterial({ color: '#2A1E14' }), []);
  const voxMat = useMemo(() => voxelMaterial(), []);
  useEffect(() => { mat.color.set(view?.locked ? T.pine[0] : view?.wrong ? T.collar[0] : '#2A1E14'); }, [view?.locked, view?.wrong, mat]);
  return (
    <group position={[0.215 + 0.3, 0, 0]}>
      <mesh geometry={post} material={voxMat} castShadow />
      {letters && <mesh geometry={letters} material={mat} />}
      <mesh geometry={rim} material={voxMat} visible={!!view?.hot} />
      <Html position={[0, 1.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        {view?.locked && view.word ? <span className="dr-tag sk-hand">✓ {view.word.toUpperCase()}</span> : null}
      </Html>
    </group>
  );
}

/** The moon: the 1 m voxel disc tinted, 6 m across, a soft halo behind it and a second disc making it a crescent. */
function DreamMoon() {
  const { disc, halo, crescent } = useMemo(() => {
    const disc = new MeshLambertMaterial({ color: DREAM_SKY.moon, emissive: DREAM_SKY.moon, emissiveIntensity: 0.6, fog: false });
    const crescent = new MeshBasicMaterial({ color: DREAM_SKY.middle, fog: false });
    const haloGeo = new PlaneGeometry(MOON.across * 2.2, MOON.across * 2.2);
    const n = haloGeo.getAttribute('position').count, col = new Float32Array(n * 4);
    const c = new Color(DREAM_SKY.moon);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b, 0], i * 4);
    haloGeo.setAttribute('color', new Float32BufferAttribute(col, 4));
    return { disc, halo: new MeshBasicMaterial({ color: DREAM_SKY.moon, transparent: true, opacity: 0.12, fog: false, depthWrite: false }), crescent };
  }, []);
  const [x, y, z] = MOON.position;
  const r = MOON.across / 2;
  return (
    <group position={[x, y, z]}>
      <mesh material={halo} position={[0, 0, -1]}><circleGeometry args={[r * 2.2, 40]} /></mesh>
      <mesh material={disc}><circleGeometry args={[r, 32]} /></mesh>
      <mesh material={crescent} position={[r * 0.4, r * 0.15, 0.05]}><circleGeometry args={[r, 32]} /></mesh>
    </group>
  );
}

/** The camera holds its shot; on the bump it shakes ±0.03 m for 300 ms (off under reduced motion). */
function DreamCamera({ phone, landscapePhone, reduced, live }: { phone: boolean; landscapePhone?: boolean; reduced: boolean; live: MutableRefObject<StageLive> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  // `?bedcam` (dev only) looks straight at the bedroom, to tune it.
  const shot = useMemo(() => (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bedcam')
    ? { position: [1.6, 2.0, 7.2] as [number, number, number], target: [-0.4, 0.6, 4.3] as [number, number, number], fov: 30 }
    : dreamShot(phone, landscapePhone)), [phone, landscapePhone]);
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => { camera.fov = shot.fov; camera.updateProjectionMatrix(); if (devOn()) (window as unknown as { __dreamCamera?: unknown }).__dreamCamera = camera; }, [camera, shot]);
  useFrame(() => {
    const L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : 9999;
    const sh = !reduced && since < WAKE.shakeMs ? WAKE.shake : 0;
    camera.position.set(shot.position[0] + (Math.random() - 0.5) * 2 * sh, shot.position[1] + (Math.random() - 0.5) * 2 * sh, shot.position[2]);
    target.position.set(shot.target[0], shot.target[1], shot.target[2]);
    camera.lookAt(target.position);
  });
  return null;
}

/** The sky cross-fades to the bedroom's night over the pop: a dark quad on the camera's near plane, and the fog with it. */
function NightFade({ live, reduced, phase }: { live: MutableRefObject<StageLive>; reduced: boolean; phase: Phase }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  // Depth-tested and far away: the sky is behind it, the bedroom and the dream in front, so only the sky goes to night.
  const mat = useMemo(() => new MeshBasicMaterial({ color: BED.night[0], transparent: true, opacity: 0, depthTest: true, depthWrite: false, fog: false }), []);
  const quad = useMemo(() => new Mesh(new PlaneGeometry(900, 900), mat), [mat]);
  const night = useMemo(() => new Color(BED.night[0]), []);
  const horizon = useMemo(() => new Color(DREAM_SKY.horizon), []);
  useEffect(() => { camera.add(quad); quad.position.set(0, 0, -300); quad.renderOrder = 50; scene.add(camera); return () => { camera.remove(quad); }; }, [camera, quad, scene]);
  useFrame(() => {
    const L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    const k = phase === 'results' ? 1 : since < WAKE.pop ? 0 : Math.min(1, (since - WAKE.pop) / (reduced ? 150 : WAKE.popMs));
    mat.opacity = k;
    (scene.fog as FogExp2 | null)?.color.copy(horizon).lerp(night, k);
    if (scene.background instanceof Color) scene.background.copy(horizon).lerp(night, k);
  });
  return null;
}

/** Dream dust: 140 motes, lavender and cream, rising and drifting with the lane, each fading in and out over 7 s. */
function Dust({ reduced, live }: { reduced: boolean; live: MutableRefObject<StageLive> }) {
  const sets = useMemo(() => [{ color: '#D9D0FF', n: 94 }, { color: '#FFF1B8', n: 46 }].map((set, k) => {
    const p = new Float32Array(set.n * 3), age = new Float32Array(set.n);
    for (let i = 0; i < set.n; i++) { p.set([-6 + Math.random() * 16, Math.random() * 6, -3 + Math.random() * 11], i * 3); age[i] = Math.random() * 7; }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, age, n: set.n, mat: new PointsMaterial({ color: set.color, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false }), k };
  }), []);
  const lastDist = useRef(0);
  useFrame((_, delta) => {
    if (reduced) return;
    const dt = Math.min(delta, 0.05);
    const L = live.current;
    const laneSpeed = (L.dist - lastDist.current) * PX / Math.max(dt, 1e-3);
    lastDist.current = L.dist;
    for (const s of sets) {
      const a = (s.geo.getAttribute('position') as BufferAttribute).array as Float32Array;
      let fade = 0;
      for (let i = 0; i < s.n; i++) {
        const j = i * 3;
        a[j] -= laneSpeed * 0.3 * dt; a[j + 1] += 0.4 * dt;
        if (a[j] < -6) a[j] += 16; if (a[j + 1] > 6) a[j + 1] -= 6;
        s.age[i] = (s.age[i] + dt) % 7;
        fade += Math.sin((s.age[i] / 7) * Math.PI);
      }
      s.mat.opacity = 0.35 + 0.4 * (fade / s.n);
      (s.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    }
  });
  useEffect(() => () => sets.forEach((s) => (s.geo.dispose(), s.mat.dispose())), [sets]);
  if (reduced) return null;
  return <>{sets.map((s) => <points key={s.k} geometry={s.geo} material={s.mat} frustumCulled={false} />)}</>;
}

/** Six snow particles from the hooves on a landing, and from a bumped fence's caps. */
function SnowBursts({ anim }: { anim: { snowAt: number; fenceSnowAt: number; fenceSnowX: number } }) {
  const ref = useRef<Points>(null);
  const geo = useMemo(() => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(new Float32Array(12 * 3), 3)); return g; }, []);
  const mat = useMemo(() => new PointsMaterial({ color: '#FFFFFF', size: 0.05, transparent: true, opacity: 0.9, depthWrite: false }), []);
  useFrame(({ clock }) => {
    const a = (geo.getAttribute('position') as BufferAttribute).array as Float32Array;
    const t = clock.elapsedTime;
    const put = (base: number, at: number, x0: number, y0: number) => {
      const e = t - at;
      for (let i = 0; i < 6; i++) {
        const j = (base + i) * 3, on = e >= 0 && e < 0.5;
        const ang = (i / 6) * Math.PI * 2;
        a[j] = on ? x0 + Math.cos(ang) * e * 0.8 : 999; a[j + 1] = on ? y0 + e * 1.2 - 3 * e * e : 999; a[j + 2] = on ? Math.sin(ang) * e * 0.5 : 999;
      }
    };
    put(0, anim.snowAt, 0, 0.05);
    put(6, anim.fenceSnowAt, anim.fenceSnowX, 0.6);
    (geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

/**
 * The bedroom (Part 5.1) and the farmer (5.2) at the bottom-left, under the dream, and the thought trail (5.3).
 * The quilt breathes, one Z leaves the pillow on each exhale, the puffs bob; on the bump the farmer wakes and the
 * puffs shrink into his head in sequence.
 */
function Bedroom({ live, reduced, phone, phase }: { live: MutableRefObject<StageLive>; reduced: boolean; phone: boolean; phase: Phase }) {
  const b = useMemo(() => bedroomGeometry(), []);
  const f = useMemo(() => farmerGeometry(), []);
  const voxMat = useMemo(() => voxelMaterial(), []);
  const smokeMat = useMemo(() => new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }), []);
  const zMats = useMemo(() => [0, 1, 2].map(() => new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })), []);
  const puffs = useMemo(() => TRAIL.map((p, i) => trailPuff(p.r, 40 + i)), []);
  const bump = useRef<Group>(null);
  const asleep = useRef<Mesh>(null);
  const awake = useRef<Mesh>(null);
  const bang = useRef<Mesh>(null);
  const zs = useRef<(Mesh | null)[]>([]);
  const puffRefs = useRef<(Group | null)[]>([]);
  const clock = useRef<Group>(null);
  const smoke = useRef<Mesh>(null);
  useFrame(({ clock: ck }) => {
    const t = ck.elapsedTime;
    const L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    const woke = since >= WAKE.stir || phase === 'results';
    const breath = reduced || woke ? 1 : 1 + 0.035 * (0.5 + 0.5 * Math.sin((t / 3.6) * Math.PI * 2));
    if (bump.current) bump.current.scale.y = breath;
    if (asleep.current) asleep.current.visible = !woke;
    if (awake.current) awake.current.visible = woke;
    if (bang.current) bang.current.visible = since >= WAKE.dark && since < WAKE.dark + 800;
    if (clock.current) clock.current.rotation.z = woke && since < WAKE.dark && !reduced ? Math.sin(t * 30 * Math.PI * 2) * (2 * Math.PI / 180) : 0;
    if (smoke.current && !reduced) smoke.current.position.y = 0.02 * Math.sin(t * 1.3);
    // Z's: one leaves the pillow every 3.6 s; three in flight, rising 0.55 m and drifting 0.25 m to +x over 2.2 s.
    zs.current.forEach((m, i) => {
      if (!m) return;
      if (woke) { m.visible = false; return; }
      m.visible = true;
      const p = reduced ? 0.25 + i * 0.25 : (((t + i * 1.2) % 3.6) / 2.2);
      const on = reduced || p <= 1;
      m.visible = on;
      const q = Math.min(1, p);
      m.position.set(0.2 + q * 0.25, BED.pillowTop + 0.42 + q * 0.55, 0.05);
      zMats[i].opacity = q < 0.6 ? 0.9 : 0.9 * (1 - (q - 0.6) / 0.4);
    });
    // The puffs bob on their own phases; on the pop they shrink into the farmer's head, the top one first.
    puffRefs.current.forEach((g, i) => {
      if (!g) return;
      const p = TRAIL[i];
      const bob = reduced ? 0 : Math.sin((t / 5) * Math.PI * 2 + i * 2) * 0.02;
      let k = 1;
      if (since >= WAKE.pop) k = Math.max(0, 1 - (since - WAKE.pop - (2 - i) * 120) / 300);
      if (phase === 'results') k = 0;
      g.scale.setScalar(Math.max(0.001, k));
      g.position.set(p.c[0], p.c[1] + bob, p.c[2]);
    });
  });
  const scale = phone ? BEDROOM.phoneScale : 1;
  return (
    <>
      <group position={[...(phone ? BEDROOM.phonePosition : BEDROOM.position)]} rotation={[0, BEDROOM.yaw, 0]} scale={scale}>
        <mesh geometry={b.floor} material={voxMat} />
        <Festive geo={buildBedroomFestive()} reduced={reduced} />
        <mesh geometry={b.rug} material={voxMat} />
        <mesh geometry={b.slippers} material={voxMat} />
        <mesh geometry={b.bed} material={voxMat} castShadow />
        <mesh geometry={b.pillow} material={voxMat} castShadow />
        <mesh geometry={b.quiltFlat} material={voxMat} castShadow />
        <group ref={bump} position={[0, BED.mattress.top, 0]}><mesh geometry={b.quiltBump} material={voxMat} position={[0, -BED.mattress.top, 0]} castShadow /></group>
        <mesh geometry={b.table} material={voxMat} castShadow receiveShadow />
        <group ref={clock} position={[0.3, 0.68, -BED.mattress.w / 2 - 0.35]}><mesh geometry={b.clock} material={voxMat} position={[-0.3, -0.68, BED.mattress.w / 2 + 0.35]} /></group>
        <mesh geometry={b.candle} material={voxMat} />
        <mesh ref={smoke} geometry={b.smoke} material={smokeMat} />
        {/* The farmer: built standing, laid down on the pillow, turned 20° toward the camera. */}
        <group position={[0.37, BED.pillowTop + 0.02, 0]} rotation={[(20 * Math.PI) / 180, 0, 0]}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <mesh ref={asleep} geometry={f.asleep} material={voxMat} castShadow />
              <mesh ref={awake} geometry={f.awake} material={voxMat} castShadow visible={false} />
              <mesh geometry={f.cap} material={voxMat} castShadow />
              <mesh geometry={f.body} material={voxMat} />
            </group>
          </group>
        </group>
        <mesh ref={bang} geometry={f.bang} material={voxMat} position={[0.37, BED.pillowTop + 0.5, 0.1]} visible={false} />
        {[0, 1, 2].map((i) => <mesh key={i} ref={(el) => { zs.current[i] = el; }} geometry={f.zs[i]} material={zMats[i]} rotation={[0, 0.3, 0]} />)}
      </group>
      {puffs.map((g, i) => (
        <group key={i} ref={(el) => { puffRefs.current[i] = el; }} position={[...TRAIL[i].c]}><mesh geometry={g} material={voxMat} castShadow /></group>
      ))}
    </>
  );
}

export type { ReactNode };
