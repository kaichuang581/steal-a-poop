import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ACESFilmicToneMapping, BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, PCFSoftShadowMap, PointLight, SpotLight, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import type { Hour } from '../model/types';
import { buildBarn, CAT_SPOT, ROBIN_SPOT } from '../scene/barn';
import { buildDistance } from '../scene/distance';
import { BARN, CAMERA, HEAP, SHEEP_SCALE, seatPosition } from '../scene/layout';
import { ChimneySmoke, Sky, Windmill } from '../scene/Sky';
import { buildYard } from '../scene/yard';
import { icicleModel, shearsModel, tuftGeometry, wolfEyes, wolfModel } from '../voxel/characters';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { BOARD, letterBoardGeometry, pileGeometry, pileWidth, PLATFORM_HEIGHT, platformGeometry } from '../voxel/table';
import { DevStats } from './DevStats';
import { Atmosphere, Effects, LANTERN_LIGHT, Lights } from './Rendering';
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
  /** A bot on its turn: the sheep thinks whenever it has nothing else to do. */
  thinking: boolean;
  label: ReactNode;
}

/** One-shot moments the table animates, each restarted by a new key. */
export interface BarnMoments {
  /** Valid word: a tuft flies from the speaker to the pile; the pile spot and tag pulse. */
  tuftIn?: { key: number; from: number };
  /** Bank: the pile's wool flies onto the banker's back. */
  tuftOut?: { key: number; to: number };
  /** Successful steal: the wolf runs door, pile, stealer, door. */
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
  /** Seat index (as in BarnSeat.index) whose turn it is: that sheep steps toward the pile. */
  speaker: number | null;
  /** 0..1 of the turn left (the icicle's length). */
  fraction: number;
  /** Seconds left on the clock, shown under the letter board. */
  secondsLeft: number | null;
  letter: string;
  isTrap: boolean;
  stealOpen: boolean;
  hour: Hour;
  reduced: boolean;
  phone: boolean;
  blizzard: boolean;
  moments: BarnMoments;
  /** Extra 3D content for a mode's place (pen lanterns, the sheepdog). */
  children?: ReactNode;
}

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

/** The static farm: barn, yard, distance and the lanterns' glow boxes. Shared by the table and the Home backdrop. */
export function Farm({ world: w, reduced, stealOpen }: { world: World; reduced: boolean; stealOpen: boolean }) {
  const { barn, yard, distance } = w;
  const voxMat = useMemo(() => voxelMaterial(), []);
  // Bright enough to pass the bloom threshold, so only the lanterns glow.
  const glowMat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 2.2 }), []);
  return (
    <>
      {barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      {barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}
      <mesh geometry={barn.lanterns} material={glowMat} />
      <mesh geometry={barn.tarp} material={voxMat} />
      <Cat geo={barn.cat} reduced={reduced} frozen={stealOpen} mat={voxMat} />
      <Robin geo={barn.robin} reduced={reduced || stealOpen} mat={voxMat} />
      {yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      <ChimneySmoke from={yard.smokeFrom} />
      <mesh geometry={distance.hills} material={voxMat} receiveShadow />
      <mesh geometry={distance.backHills} material={voxMat} receiveShadow />
      <mesh geometry={distance.mountains} material={voxMat} />
      <Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />
    </>
  );
}

/** ?pov=1 keeps the older camera that glides to whoever's turn it is; the plan's fixed shot is the default. */
const POV = new URLSearchParams(location.search).has('pov');

export function BarnTable(props: Props) {
  const cam = props.phone ? CAMERA.phone : CAMERA.desktop;
  const w = useWorld();
  const tagEl = useRef<HTMLDivElement>(null);
  const clockEl = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState(false);
  const pulseKey = props.moments.tuftIn?.key;
  useEffect(() => {
    if (pulseKey === undefined) return;
    setPop(true);
    const id = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(id);
  }, [pulseKey]);
  if (!w) return <Building />;
  const { pile, letter, isTrap, stealOpen, secondsLeft } = props;
  return (
    <div className="relative size-full">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={props.phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
        camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
        onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
      >
        <Scene {...props} world={w} anchors={{ tag: tagEl, clock: clockEl }} />
      </Canvas>
      {/* The pile's paper tag, anchored to the scene point above the mound and never behind the input bar (plan V3.2 Part 3). */}
      <div ref={tagEl} className="pointer-events-none absolute left-0 top-0 z-[25] flex flex-col items-center" style={{ transform: 'translate3d(-9999px,0,0)', willChange: 'transform' }}>
        <div
          className="flex flex-col items-center"
          style={{ transform: pop ? 'scale(1.15)' : 'scale(1)', transition: 'transform 200ms var(--ease-out)' }}
          data-pile data-tour="pile" aria-label={`Pile ${pile} points`}
        >
          <span className="block size-2.5 rounded-full" style={{ background: 'var(--wood-ink)', boxShadow: '0 1px 0 var(--wood)' }} aria-hidden="true" />
          <div className="sk-paper px-4 py-1 text-center leading-none">
            <div className="sk-display" style={{ fontSize: 44, fontWeight: 800 }}>{pile}</div>
            <div className="sk-hand text-base" style={{ color: 'var(--ink-soft)' }}>wool in the pile</div>
          </div>
        </div>
      </div>
      {/* The clock, just under the letter board (plan V3.2 Part 4). */}
      <div ref={clockEl} className="pointer-events-none absolute left-0 top-0 z-[25]" style={{ transform: 'translate3d(-9999px,0,0)', willChange: 'transform' }}>
        <div
          className="sk-chip sk-num whitespace-nowrap"
          style={{ fontSize: 22, fontWeight: 800, color: stealOpen ? 'var(--coral-dark)' : 'var(--ink)' }}
          data-chain-tile data-tour="chain" aria-label={`Required starting letter ${letter.toUpperCase()}${isTrap ? ', a trap letter' : ''}`}
        >
          {secondsLeft === null ? letter.toUpperCase() : `${secondsLeft.toFixed(1)}s`}
        </div>
      </div>
    </div>
  );
}

type Anchors = { tag: React.RefObject<HTMLDivElement | null>; clock: React.RefObject<HTMLDivElement | null> };

/** Projects the two anchor points every frame and moves their DOM elements; the tag stays `margin` px above the bottom edge. */
function Projection({ anchors, pileHeight, margin }: { anchors: Anchors; pileHeight: number; margin: number }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const place = (el: HTMLDivElement | null, x: number, y: number, z: number, clamp: boolean) => {
      if (!el) return;
      v.set(x, y, z).project(camera);
      const px = ((v.x + 1) / 2) * size.width;
      let py = ((1 - v.y) / 2) * size.height;
      if (clamp) py = Math.min(py, size.height - margin);
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
    };
    place(anchors.tag.current, HEAP[0], PLATFORM_HEIGHT + pileHeight + 0.35, HEAP[2], true);
    place(anchors.clock.current, HEAP[0], BOARD.bottom - 0.22, 1.0, false);
  });
  return null;
}

export function Building() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="sk-paper sk-display px-4 py-2 text-lg">Raising the barn…</div>
    </div>
  );
}

function Scene({ seats, pile, speaker, fraction, letter, isTrap, stealOpen, hour, reduced, phone, blizzard, moments, children, world: w, anchors }: Props & { world: World; anchors: Anchors }) {
  const lamps = useRef<(PointLight | null)[]>([]);
  const n = seats.length;

  // The freeze dims the lanterns to 40% for 2.4 s.
  const freezeAt = useRef(-10);
  const freezeKey = moments.freeze?.key;
  useEffect(() => { if (freezeKey !== undefined) freezeAt.current = performance.now() / 1000; }, [freezeKey]);
  useFrame(({ clock }) => {
    const dim = performance.now() / 1000 - freezeAt.current < 2.4 ? 0.4 : 1;
    const flicker = reduced || stealOpen ? 1 : 1 + Math.sin(clock.elapsedTime * 7.3) * 0.05;
    for (const l of lamps.current) if (l) l.intensity = LANTERN_LIGHT.intensity * dim * flicker;
  });

  // Attention (plan V3.3 Part 3.3): every sheep looks at the speaker's head; the speaker looks at the camera.
  const speakerHead = useMemo((): [number, number, number] | undefined => {
    if (speaker === null) return undefined;
    const p = seatPosition(speaker, n);
    const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
    return [p.x + (dx / len) * 0.35, 0.85 * SHEEP_SCALE, p.z + (dz / len) * 0.35];
  }, [speaker, n]);

  return (
    <>
      {POV ? <CameraRig focus={speaker} n={n} phone={phone} reduced={reduced} /> : <FixedCamera phone={phone} />}
      <Atmosphere hour={hour} />
      <Lights hour={hour} phone={phone} viewYaw={0} lampRef={(i, l) => { lamps.current[i] = l; }} />
      <Sky hour={hour} reduced={reduced} blizzard={blizzard} />
      <Farm world={w} reduced={reduced} stealOpen={stealOpen} />
      <Pile pile={pile} pulseKey={moments.tuftIn?.key} reduced={reduced} />
      <LetterBoard letter={letter} isTrap={isTrap} stealOpen={stealOpen} reduced={reduced} />
      <Projection anchors={anchors} pileHeight={pileHeightFor(pile)} margin={phone ? 140 : 120} />
      <Icicle fraction={fraction} red={stealOpen} reduced={reduced} />
      {stealOpen && <WolfEyes />}
      {seats.map((s) => {
        const p = seatPosition(s.index, n);
        return (
          <SeatGroup key={s.seat} index={s.index} n={n} active={s.index === speaker} reduced={reduced}>
            <Sheep level={s.level} state={s.state} stateKey={s.stateKey} coldFor={s.coldFor} dimmed={s.dimmed} reduced={reduced} still={stealOpen} scarf={s.scarf}
              gustFrom={[0, 0.8, -6]} lookAt={s.index === speaker ? 'camera' : speakerHead} speaking={s.index === speaker} thinking={s.thinking} />
            <Html position={[p.x >= 0 ? 0.95 : -0.95, 0.75, 0]} center zIndexRange={[20, 0]} rotation={[0, -p.yaw, 0]}>{s.label}</Html>
          </SeatGroup>
        );
      })}
      <Moments moments={moments} n={n} reduced={reduced} />
      {children}
      <Effects />
      <DevStats />
    </>
  );
}

/** The plan's shot, re-applied when the viewport changes between phone and desktop. */
function FixedCamera({ phone }: { phone: boolean }) {
  const camera = useThree((s) => s.camera);
  const cam = phone ? CAMERA.phone : CAMERA.desktop;
  useEffect(() => {
    camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    if ('fov' in camera) {
      (camera as { fov: number }).fov = cam.fov;
      (camera as unknown as { updateProjectionMatrix(): void }).updateProjectionMatrix();
    }
  }, [camera, cam]);
  return null;
}

/** A seat: the sheep faces the pile and, on its turn, steps 0.35 m toward it. */
function SeatGroup({ index, n, active, reduced, children }: { index: number; n: number; active: boolean; reduced: boolean; children: ReactNode }) {
  const g = useRef<Group>(null);
  const p = seatPosition(index, n);
  const want = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    if (!g.current) return;
    const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const step = active ? 0.35 : 0;
    want.set(p.x + (dx / len) * step, 0, p.z + (dz / len) * step);
    g.current.position.lerp(want, reduced ? 1 : 1 - Math.exp(-dt * 4));
  });
  return <group ref={g} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE}>{children}</group>;
}

/**
 * The older turn camera: it stands across the pile from the speaker's seat and pulls back between turns. Kept behind
 * ?pov=1; reduced motion cuts instead of gliding.
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

/** The mound's height for a pile of `points`: 0.3 m at the smallest, 0.8 m at the largest. */
function pileHeightFor(points: number): number {
  return 0.3 + ((pileWidth(points) - 0.9) / 1.3) * 0.5;
}

/**
 * The hero: the mound of wool on its wooden platform under its own spotlight, with the count on a paper tag anchored
 * above it (plan V3.2 Part 3). The spot brightens and the tag pops on an accepted word.
 */
function Pile({ pile, pulseKey, reduced }: { pile: number; pulseKey?: number; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const platform = useMemo(() => platformGeometry(), []);
  const width = pileWidth(pile);
  const mound = useMemo(() => pileGeometry(width), [width]);
  const spot = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const pulseAt = useRef(-10);
  useEffect(() => { if (pulseKey !== undefined) pulseAt.current = performance.now() / 1000; }, [pulseKey]);
  useFrame(() => {
    if (!spot.current) return;
    const e = performance.now() / 1000 - pulseAt.current;
    spot.current.intensity = 90 * (e < 0.4 && !reduced ? 1.25 : 1);
  });
  return (
    <group position={[HEAP[0], 0, HEAP[2]]}>
      <mesh geometry={platform} material={mat} castShadow receiveShadow />
      <mesh geometry={mound} material={mat} position={[0, PLATFORM_HEIGHT, 0]} castShadow receiveShadow />
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight ref={spot} position={[0, 6.0, 0]} target={target} color="#FFD9A0" intensity={90} angle={0.42} penumbra={0.7} distance={9} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    </group>
  );
}

/**
 * The starting letter carved on a board hanging from the beam above the pile (an ice block for trap letters),
 * swinging a little with the wind, with the seconds on a chip just under it (plan V3.2 Part 4).
 */
function LetterBoard({ letter, isTrap, stealOpen, reduced }: { letter: string; isTrap: boolean; stealOpen: boolean; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const geo = useMemo(() => letterBoardGeometry(letter, isTrap, BARN.beamY), [letter, isTrap]);
  const iceGeo = useMemo(() => new BoxGeometry(BOARD.width, BOARD.height, 0.24), []);
  const iceMat = useMemo(() => new MeshPhongMaterial({ color: T.ice[1], transparent: true, opacity: 0.5, shininess: 80, depthWrite: false }), []);
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.z = reduced || stealOpen ? 0 : (Math.sin(clock.elapsedTime * 0.7) * 1.5 * Math.PI) / 180;
  });
  const pivotY = BARN.beamY - 0.15;
  const boardMid = BOARD.bottom + BOARD.height / 2 - pivotY;
  return (
    <group ref={g} position={[HEAP[0], pivotY, 1.0]}>
      <mesh geometry={geo} material={mat} castShadow />
      {isTrap && <mesh geometry={iceGeo} material={iceMat} position={[0, boardMid, 0]} />}
    </group>
  );
}

/** The timer: an icicle hanging from the beam beside the letter board, shrinking with the clock, red in the steal window. */
function Icicle({ fraction, red, reduced }: { fraction: number; red: boolean; reduced: boolean }) {
  const m = useMemo(() => icicleModel(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const drip = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    mat.color.set(red ? '#E7705E' : '#8FC4E6');
    if (drip.current) {
      const p = reduced ? 0 : (clock.elapsedTime % 2) / 2;
      drip.current.position.y = -0.8 * fraction - p * 1.2;
      drip.current.visible = !reduced && p < 0.9;
    }
  });
  return (
    <group position={[HEAP[0] + BOARD.width / 2 + 0.7, BARN.beamY - 0.15, 1.0]} scale={1.8}>
      <mesh geometry={m.ice.geo} material={mat} scale={[1, 0.25 + 0.75 * fraction, 1]} />
      <mesh ref={drip} geometry={m.drip} material={mat} />
    </group>
  );
}

function WolfEyes() {
  const geo = useMemo(() => wolfEyes(), []);
  const mat = useMemo(() => voxelMaterial({ emissive: '#FFE066', emissiveIntensity: 1 }), []);
  return <mesh geometry={geo} material={mat} position={[BARN.minX + 0.15, 1.2, BARN.sideDoor.z]} rotation={[0, Math.PI / 2, 0]} />;
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
  const pileTop = [HEAP[0], PLATFORM_HEIGHT + 0.3, HEAP[2]] as const;

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
    run('tuftIn', 0.8, (e, g) => arc(g, seat(moments.tuftIn!.from), pileTop, Math.min(1, e / 0.8), 1.2));
    run('tuftOut', 1.1, (e, g) => arc(g, pileTop, seat(moments.tuftOut!.to), Math.min(1, e / 1.1), 1.6));
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
