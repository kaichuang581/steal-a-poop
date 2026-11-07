import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  ACESFilmicToneMapping, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, FogExp2, Group, Mesh, MeshLambertMaterial,
  Object3D, PCFSoftShadowMap, PointLight, Points, PointsMaterial, SRGBColorSpace, Vector3,
} from 'three';
import type { PerspectiveCamera } from 'three';
import { FIELD, JUMP_MS, jumpHeight, takeoffDistance } from '../../dream/dream';
import type { Obstacle } from '../../dream/dream';
import { DISTANCE } from '../scene/layout';
import { Windmill } from '../scene/Sky';
import { useWorld } from '../table/BarnTable';
import { DevStats, devOn } from '../table/DevStats';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { DreamSky } from './DreamSky';
import { atFrame, CHUNK, chunkPlacements, DESKTOP_SHOT, DREAM_FOG, dreamFrame, dreamShot, islandPlace, ISLANDS, islandX, LAYER, PHONE_SHOT, PX, scrollOf, WAKE, WISPS, worldX } from './stage';
import { bonkStar, cloudSea, fenceSign, hills as hillsGeometry, HILLS, island as islandGeometry, lookOf, mountains as mountainsGeometry, MOUNTAINS, obstacle, raftChunk, SEA, shadowDisc, SIGN, signCap, signCell, wisp as wispGeometry } from './world';
import { TYPE_X } from './run';
import { Paper } from '../kit';
import { CheckIcon } from '../components/Icons';

const SLOTS = 4;
const LAND_MS = 200;
const WOOD_TINT = '#FFD7A6';
const SX = FIELD.sheepX, SW = FIELD.sheepW, FW = FIELD.fenceW;
/** The sheep model is about 1.3 m long at scale 1; the logical sheep is 20 px = 0.72 m. */
const SHEEP_SCALE = (FIELD.sheepW * PX) / 1.3;

/** What the stage reads every frame; the screen owns the state and only this view of it is shared. */
export interface StageLive {
  dist: number;
  t: number;
  jumpAt: number | null;
  crashAt: number | null;
  /** A bump short of the last one holds the sheep until this time, and the farmer stirs. */
  stumbleUntil: number;
  /** When the farmer drifted off. */
  asleepAt: number | null;
  speed: number;
  fences: { index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; knockedAt: number | null }[];
}

/** One fence's sign, as React sees it (changes seldom); positions come from the live ref. */
export interface FenceView { index: number; kind: Obstacle; letters: readonly string[]; word: string; locked: boolean; hot: boolean; wrong: boolean }

export type Phase = 'ready' | 'running' | 'crashed' | 'drifting' | 'results';

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
 * The dream, full screen (V4.1): a side-on diorama. The sheep runs along a bright snow lane on a long cloud raft and
 * jumps fences carrying the night's letters. The farmer is not in this scene: he sleeps in his own small canvas.
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
  // A little light of their own: the undersides face away from the moon but must stay pale against the hills.
  const islandMat = useMemo(() => voxelMaterial({ emissive: '#7468B8', emissiveIntensity: 0.84 }), []);
  // Wood keeps its brown under the violet light: a warm tint takes out the blue the moon adds.
  const woodMat = useMemo(() => voxelMaterial({ color: WOOD_TINT, emissive: '#5A4230', emissiveIntensity: 0.55 }), []);
  const geo = useMemo(() => ({
    chunks: Array.from({ length: CHUNK.count }, (_, i) => raftChunk(i)),
    islands: ISLANDS.map((it, i) => { const p = islandPlace(it, phone); return { ...p, ...islandGeometry(it.kind, p.across, p.tall, i + 1) }; }),
    wisps: WISPS.map((w, i) => ({ geo: wispGeometry(i + 1), at: atFrame(phone ? PHONE_SHOT : DESKTOP_SHOT, phone ? 390 / 844 : 16 / 9, w.frame[0], w.frame[1], w.z) })),
    sea: cloudSea(phone), hills: hillsGeometry(), mountains: mountainsGeometry(),
    shadow: shadowDisc(), star: bonkStar(),
  }), [phone]);
  useEffect(() => {
    scene.fog = new FogExp2(DREAM_FOG.color, phone ? DREAM_FOG.phoneDensity : DREAM_FOG.density);
    scene.background = new Color(DREAM_FOG.color);
  }, [scene, phone]);

  // ---- the groups the frame loop moves
  const chunks = useRef<(Group | null)[]>([]);
  const seaBank = useRef<Group>(null);
  const islandRefs = useRef<(Group | null)[]>([]);
  const wispRefs = useRef<(Group | null)[]>([]);
  const hillRange = useRef<Group>(null);
  const mountainRange = useRef<Group>(null);
  const sheep = useRef<Group>(null);
  const sheepShadow = useRef<Mesh>(null);
  const stars = useRef<(Mesh | null)[]>([]);
  const slots = useRef<(Group | null)[]>([]);
  const fenceMeshes = useRef<(Group | null)[]>([]);
  const boards = useRef<(Group | null)[]>([]);
  const lamp = useRef<PointLight>(null);
  const hotSlot = useRef(-1);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const probe = useMemo(() => ({ a: new Vector3(), b: new Vector3(), shown: 0 }), []);
  const [sheepState, setSheepState] = useState<SheepState>('grazing');
  const [stateKey, setStateKey] = useState(0);
  const [pace, setPace] = useState(0);
  const paceRef = useRef(0);
  const anim = useMemo(() => ({ state: 'grazing' as SheepState, landUntil: -1, wasAir: false, snowAt: -10, fenceSnowAt: -10, fenceSnowX: 0, fenceSnowFor: -1 }), []);

  useFrame(({ clock }) => {
    const L = live.current;
    const scroll = scrollOf(L.dist);
    const t = clock.elapsedTime;
    // The raft's ring.
    for (const p of chunkPlacements(scroll)) { const g = chunks.current[p.index]; if (g) g.position.x = p.x; }
    ISLANDS.forEach((it, i) => {
      const g = islandRefs.current[i], p = geo.islands[i];
      if (!g) return;
      g.position.x = islandX(it, scroll, p.x, p.across);
      g.position.y = p.y + (reduced ? 0 : Math.sin((t / it.bob) * Math.PI * 2) * 0.06);
    });
    WISPS.forEach((w, i) => { const g = wispRefs.current[i]; if (g) g.position.x = geo.wisps[i].at[0] - ((scroll * w.factor) % 40); });
    if (seaBank.current) {
      seaBank.current.position.x = -((scroll * SEA.factor) % SEA.period) - 30;
      seaBank.current.position.y = reduced ? 0 : Math.sin((t / 9) * Math.PI * 2) * 0.05;
    }
    if (hillRange.current) hillRange.current.position.x = -((scroll * LAYER.hills) % HILLS.period);
    if (mountainRange.current) mountainRange.current.position.x = -((scroll * LAYER.mountains) % MOUNTAINS.period);

    // The sheep: which state it is in, how high, and knocked back on the bonk.
    const air = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt) * PX;
    const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
    const about = !!ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed) + L.speed * 0.08;
    let want: SheepState = 'run';
    const stumbling = L.t < L.stumbleUntil;
    if (phase === 'ready') want = 'grazing';
    else if (L.asleepAt !== null) want = 'sleeping';
    else if (L.crashAt !== null || stumbling) want = 'bonk';
    else if (L.jumpAt !== null || about) want = 'jump';
    else if (anim.wasAir || L.t < anim.landUntil) { if (anim.wasAir) { anim.landUntil = L.t + LAND_MS; anim.snowAt = t; } want = 'land'; }
    if (L.jumpAt !== null && !anim.wasAir) anim.snowAt = t; // the kick-off throws snow too
    anim.wasAir = L.jumpAt !== null;
    if (want !== anim.state) { anim.state = want; setSheepState(want); setStateKey((k) => k + 1); }
    const p = Math.round(Math.min(1, Math.max(0, (L.speed - 58) / 42)) * 10) / 10;
    if (p !== paceRef.current) { paceRef.current = p; setPace(p); }
    if (sheep.current) {
      const back = L.crashAt !== null ? -0.25 * Math.min(1, (L.t - L.crashAt) / 200) : stumbling ? -0.12 : 0;
      sheep.current.position.set(back, air, 0);
      // The leap in the body: a crouch before take-off, the nose rising then falling along the arc, a stretch at the
      // push and the reach, and a squash that gives on the landing. The model's own legs do the rest.
      const j = L.jumpAt === null ? -1 : Math.min(1, (L.t - L.jumpAt) / JUMP_MS);
      let pitch = 0, tall = 1, long = 1;
      if (!reduced) {
        if (j >= 0) {
          pitch = 0.46 * Math.cos(Math.PI * j);
          const s = Math.abs(2 * j - 1);
          tall = 0.97 + 0.08 * s;
          long = 1.03 - 0.05 * s;
        } else if (about) { tall = 0.84; long = 1.09; pitch = 0.08; }
        else if (L.t < anim.landUntil) {
          const k = (anim.landUntil - L.t) / LAND_MS;
          tall = 1 - 0.2 * k * k;
          long = 1 + 0.12 * k * k;
          pitch = -0.14 * k;
        }
      }
      sheep.current.rotation.z = pitch;
      sheep.current.scale.set(long, tall, 1);
    }
    if (sheepShadow.current) { const k = 1 - 0.4 * Math.min(1, air / (28 * PX)); sheepShadow.current.scale.set(k, 1, k); }
    // Bonk stars orbit 0.25 m above the head from 350 ms.
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = (since >= WAKE.stir || stumbling) && !reduced;
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
      const hitAt = fe.knockedAt ?? (L.crashAt !== null && !fe.passed && !fe.jumped && fe.x < SX + SW && fe.x + FW > SX ? L.crashAt : null);
      const hit = hitAt !== null;
      const f = fenceMeshes.current[slot];
      if (f) {
        const e = hit ? (L.t - hitAt) / 1000 : 0;
        const ang = !hit ? 0 : reduced ? 70 : e < 0.4 ? 78 * easeOut(e / 0.4) : e < 0.55 ? 78 - 8 * ((e - 0.4) / 0.15) : 70;
        f.rotation.z = -(ang * Math.PI) / 180;
        if (hit && anim.fenceSnowFor !== fe.index) { anim.fenceSnowFor = fe.index; anim.fenceSnowAt = t; anim.fenceSnowX = g.position.x; }
      }
      // The sign's board swings on its ropes: a little in the wind, hard for 1.2 s when its fence is bumped.
      const board = boards.current[slot];
      if (board) {
        const e = hitAt !== null ? (L.t - hitAt) / 1000 : 9;
        const knock = reduced || e > 1.2 ? 0 : 15 * Math.sin(e * Math.PI * 2 * 1.4) * (1 - e / 1.2);
        board.rotation.z = ((reduced ? 0 : 1.5 * Math.sin(t * 0.4 * Math.PI * 2 + slot)) + knock) * (Math.PI / 180);
      }
    }
    slots.current.forEach((g, i) => { if (g && !used.has(i)) g.visible = false; });
    if (L.dist < 1) anim.fenceSnowFor = -1;
    // One lantern light, on the active sign's post.
    const hot = hotSlot.current, hg = hot >= 0 ? slots.current[hot] : null;
    if (lamp.current) {
      lamp.current.intensity = hg?.visible ? 0.8 : 0;
      if (hg) { const at = fenceSign(slotViews[hot]?.letters ?? ['']).lanternAt; const k = signScale(phone); lamp.current.position.set(hg.position.x + SIGN_AT[0] + at[0] * k, at[1] * k, SIGN_AT[2] + at[2] * k); }
    }
    // The readability gate (V6 Part 7.5): the letters' cap height, projected, for a sign at TYPE_X and for the active one.
    if (devOn() && t - probe.shown > 0.5) {
      probe.shown = t;
      const capPx = (x: number, n: number) => {
        const k = signScale(phone), cap = signCap(n) * k, z = SIGN_AT[2] + (SIGN.boardZ + signCell(n)) * k;
        probe.a.set(x, SIGN.centre * k + cap / 2, z).project(camera);
        probe.b.set(x, SIGN.centre * k - cap / 2, z).project(camera);
        return Math.abs(probe.a.y - probe.b.y) / 2 * size.height;
      };
      const n = slotViews[hot]?.letters.length ?? 3;
      const typeX = capPx(worldX(TYPE_X) + (FW * PX) / 2 + SIGN_AT[0], n);
      const active = hg?.visible ? capPx(hg.position.x + SIGN_AT[0], n) : 0;
      Object.assign(window, { __signCap: { typeX, active, letters: n } });
      document.getElementById('sk-dev')?.setAttribute('data-sign-cap', `${typeX.toFixed(1)} px at TYPE_X, ${active.toFixed(1)} px active`);
    }

  });

  const slotViews = useMemo(() => Array.from({ length: SLOTS }, (_, slot) => fences.find((v) => v.index % SLOTS === slot) ?? null), [fences]);
  hotSlot.current = slotViews.findIndex((v) => v?.hot);

  return (
    <>
      <DreamCamera phone={phone} landscapePhone={landscapePhone} reduced={reduced} live={live} />
      {/* The plan's 1.4 and 0.5 assume the old light units, and its dark ground colour turns every shaded side navy; these
          land the layers on the value ladder. */}
      <hemisphereLight args={['#6E5FB5', '#A79BE6', 1.7]} />
      <directionalLight
        position={phone ? [-6, 10, 8] : [5, 10, 7]} color="#EAE6FF" intensity={phone ? 4.8 : 4.5} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-6} shadow-camera-right={11} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={1} shadow-camera-far={30}
      />

      <DreamSky shot={dreamShot(phone, landscapePhone)} reduced={reduced} />
      <group ref={seaBank}>
        {[0, 1].map((i) => <mesh key={i} geometry={geo.sea} material={voxMat} position={[i * SEA.period, 0, 0]} />)}
      </group>
      {ISLANDS.map((it, i) => {
        const p = geo.islands[i];
        return (
          <group key={it.id} ref={(el) => { islandRefs.current[i] = el; }} position={[p.x, p.y, it.z]}>
            <mesh geometry={p.body} material={islandMat} />
            {p.props && <mesh geometry={p.props} material={voxMat} />}
            {p.glow && <mesh geometry={p.glow} material={glowMat} />}
            {p.glow && <pointLight position={[p.across * 0.21, 0.95, 0.3]} color="#FFB45A" intensity={0.8} distance={4} decay={2} />}
            {it.kind === 'windmill' && <IslandWindmill />}
          </group>
        );
      })}
      {geo.wisps.map((w, i) => <group key={i} ref={(el) => { wispRefs.current[i] = el; }} position={w.at}><mesh geometry={w.geo} material={voxMat} /></group>)}
      <group ref={hillRange}><mesh geometry={geo.hills} material={voxMat} /></group>
      <group ref={mountainRange}><mesh geometry={geo.mountains} material={voxMat} /></group>

      <group>
        {geo.chunks.map((g, i) => (
          <group key={i} ref={(el) => { chunks.current[i] = el; }}>
            <mesh geometry={g} material={voxMat} receiveShadow />
          </group>
        ))}
        <Dust reduced={reduced} live={live} />
        <pointLight ref={lamp} color="#FFC24B" intensity={0} distance={2.5} decay={2} />

        {/* The obstacles cross the lane; each one's sign stands just beyond it, on the far side. */}
        {slotViews.map((f, slot) => (
          <group key={slot} ref={(el) => { slots.current[slot] = el; }} position={[200, 0, 0]} visible={false}>
            <group position={[0.215, 0, 0]}>
              <group ref={(el) => { fenceMeshes.current[slot] = el; }}>
                {f && <mesh geometry={obstacle(lookOf(f.kind, f.index))} material={woodMat} position={[-0.215, 0, 0]} castShadow receiveShadow />}
              </group>
            </group>
            <Sign view={f} scale={signScale(phone)} boardRef={(el) => { boards.current[slot] = el; }} />
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
    </>
  );
}

/** The yard's windmill, brought to the origin and scaled to stand on island B, facing the camera. */
function IslandWindmill() {
  const w = useWorld();
  const parts = useMemo(() => {
    if (!w) return null;
    const { x, z } = DISTANCE.windmill, h = w.distance.bladesHub;
    const baseY = h[1] - 9.5;
    return { body: w.distance.windmillBody.clone().translate(-x - 0.5, -baseY, -z - 0.5), blades: w.distance.windmillBlades, hub: [0, 9.5, h[2] - z - 0.5] as [number, number, number] };
  }, [w]);
  if (!parts) return null;
  return <group rotation={[0, Math.PI, 0]} scale={0.062}><Windmill body={parts.body} blades={parts.blades} hub={parts.hub} /></group>;
}

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

const shadowMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false });

/** Where each sign stands against its obstacle: just past it, on the far side of the lane. */
const SIGN_AT = [0.1, 0, -1.34] as const;
/**
 * A phone looks down the lane from far off to one side, so a sign at TYPE_X is a long way away: there the whole sign is
 * drawn half as big again, which brings its letters to the readability gate's 16 px (V6 Part 7.5).
 */
const signScale = (phone: boolean) => (phone ? 1.6 : 1);
const INK = '#1E140C';

/**
 * The fence sign (V6 Part 5.1): letters carved into a plank hung from a crossbar. The active one has its lantern lit
 * and its letters warm; a bounce reddens the cuts for a moment, a clear turns them green and pins the word on a slip.
 */
function Sign({ view, scale, boardRef }: { view: FenceView | null; scale: number; boardRef: (g: Group | null) => void }) {
  const key = view?.letters.join('') ?? '';
  const geo = useMemo(() => fenceSign(view?.letters ?? ['']), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const ink = useMemo(() => new MeshLambertMaterial({ color: INK }), []);
  const wood = useMemo(() => voxelMaterial({ color: WOOD_TINT }), []);
  const glass = useMemo(() => [voxelMaterial({ color: '#9A8A70' }), voxelMaterial({ emissive: '#FFC24B', emissiveIntensity: 0.9 })], []);
  useEffect(() => {
    ink.color.set(view?.locked ? T.pine[0] : view?.wrong ? T.collar[0] : INK);
    ink.emissive.set(view?.hot && !view.wrong ? '#2E1C08' : '#000000');
  }, [view?.locked, view?.wrong, view?.hot, ink]);
  const word = view?.locked ? view.word : '';
  return (
    <group position={[...SIGN_AT]} scale={scale}>
      <mesh geometry={geo.post} material={wood} castShadow />
      <mesh geometry={geo.lantern} material={glass[view?.hot ? 1 : 0]} />
      <group ref={boardRef} position={[SIGN.x, SIGN.pivot, 0]}>
        <mesh geometry={geo.board} material={wood} castShadow />
        <mesh geometry={geo.letters} material={ink} />
      </group>
      <Html position={[SIGN.x, SIGN.pivot + 0.32, 0.1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        {word ? <Paper kind="slip" pin="top" seed={word} className="dr-slip" style={{ fontSize: word.length > 10 ? 12 : 16 }}><CheckIcon size={14} />{word.toUpperCase()}</Paper> : null}
      </Html>
    </group>
  );
}

/** The camera holds its shot; on the bump it shakes ±0.03 m for 300 ms (off under reduced motion). */
function DreamCamera({ phone, landscapePhone, reduced, live }: { phone: boolean; landscapePhone?: boolean; reduced: boolean; live: MutableRefObject<StageLive> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const shot = useMemo(() => dreamShot(phone, landscapePhone), [phone, landscapePhone]);
  const target = useMemo(() => new Object3D(), []);
  const size = useThree((s) => s.size);
  useEffect(() => {
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    // For the gate script on a phone: where each layer lands through this camera.
    if (devOn()) Object.assign(window, { __dreamFrame: dreamFrame(shot, size.width / Math.max(1, size.height), phone), __dreamLive: live });
  }, [camera, shot, size, phone, live]);
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

/** Dream dust: 120 motes, lavender and cream, rising and drifting with the lane, each fading in and out over 7 s. */
function Dust({ reduced, live }: { reduced: boolean; live: MutableRefObject<StageLive> }) {
  const sets = useMemo(() => [{ color: '#D9D0FF', n: 80 }, { color: '#FFF1B8', n: 40 }].map((set, k) => {
    const p = new Float32Array(set.n * 3), age = new Float32Array(set.n);
    for (let i = 0; i < set.n; i++) { p.set([-6 + Math.random() * 16, Math.random() * 5, -8 + Math.random() * 10], i * 3); age[i] = Math.random() * 7; }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, age, n: set.n, mat: new PointsMaterial({ color: set.color, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }), k };
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
        a[j] -= laneSpeed * 0.2 * dt; a[j + 1] += 0.3 * dt;
        if (a[j] < -6) a[j] += 16; if (a[j + 1] > 5) a[j + 1] -= 5;
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

