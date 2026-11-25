import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { useFrame, useThree } from '@react-three/fiber';
import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import {
  BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, FogExp2, Group, Mesh, MeshLambertMaterial,
  PCFShadowMap, PointLight, Points, PointsMaterial, SRGBColorSpace,
} from 'three';
import type { OrthographicCamera } from 'three';
import { FIELD, JUMP_MS, takeoffDistance } from '../../dream/dream';
import type { Obstacle } from '../../dream/dream';
import { DISTANCE } from '../scene/layout';
import { Windmill } from '../scene/Sky';
import { useWorld } from '../table/BarnTable';
import { ScreenAnchor } from '../table/Anchors';
import { DevStats, devOn } from '../table/DevStats';
import { isAdminAvatar } from '../../avatars/ids';
import { byId } from '../avatars/catalog';
import { useAvatar } from '../avatars/store';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { useKaiyanLook } from '../avatars/kaiyanLook';
import { photoHeight } from '../avatars/photos';
import { animalModel } from '../voxel/animals';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { DreamSky } from './DreamSky';
import { ART, CAMERA_Z, CHUNK, chunkPlacements, DISC_MAX_H, DREAM_FOG, drawnLift, dreamView, frameToWorld, islandPlace, ISLANDS, islandX, LAYER, leapPitch, PX, RECOIL, scrollOf, SHEEP_ART, SHEEP_CENTRE, SHEEP_SCALE, signRows, signScale, WAKE, WISPS, worldX } from './stage';
import type { DreamView } from './stage';
import { bonkStar, FAR_Z, hills as hillsLayer, HILLS, island as islandGeometry, lookOf, mountains as mountainsLayer, MOUNTAINS, obstacle, raftChunk, SEA, seaLayer, shadowDisc, signPost, wisp as wispGeometry } from './world';
import { signHeight, signWidth } from './frame';
import { LOOK } from '../look';

const SLOTS = 4;
const LAND_MS = 200;
const WOOD_TINT = '#FFD7A6';
const SX = FIELD.sheepX, SW = FIELD.sheepW, FW = FIELD.fenceW;
/** The photo leans into the leap less than the sheep's nose rises: it is a tall flat picture pivoting at its foot. */
const DISC_PITCH = 0.35;

/** What the stage reads every frame; the screen owns the state and only this view of it is shared. */
export interface StageLive {
  dist: number;
  t: number;
  jumpAt: number | null;
  crashAt: number | null;
  /** A bump short of the last one holds the sheep until this time, and the farmer stirs. */
  stumbleUntil: number;
  /** When the dream ended with the farmer still asleep (a bump he slept through). */
  asleepAt: number | null;
  /** When he went out cold (the night's fence mark): from then on he sleeps deep. */
  deepAt?: number | null;
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
  /** How many pictures a second the dream is drawn at (the frame governor): 0 once the bedroom covers it whole. */
  fps?: number;
  /** The interface's unit and whether it is the phone's layout: the signs' boards are laid out with them. */
  ui: { u: number; phone: boolean };
}

/**
 * The dream, full screen (V4.1): a side-on diorama. The sheep runs along a bright snow lane on a long cloud raft and
 * jumps fences carrying the night's letters. The farmer is not in this scene: he sleeps in his own small canvas.
 */
export function DreamStage(props: Props) {
  // Orthographic, looking along -z; DreamCamera sets its zoom and place from the stage's size (plan file 09, 4.2).
  // The count over the sheep and the signs' boards are HTML laid over the canvas (drei's Html unmounted its own roots
  // while React was rendering and threw on leaving the dream): the count pinned by ScreenAnchor, each board moved by the
  // frame loop to its post's arm.
  const tags = useMemo<Tags>(() => ({ root: createRef(), pop: createRef(), signs: Array.from({ length: SLOTS }, () => createRef<HTMLDivElement>()) }), []);
  const slotViews = Array.from({ length: SLOTS }, (_, slot) => props.fences.find((v) => v.index % SLOTS === slot) ?? null);
  return (
    <>
    <SceneBoundary scene="the dream">
    <AdaptiveCanvas maxDpr={props.phone ? 1.5 : 2} memory="dream" fps={props.fps}
      shadows={{ type: PCFShadowMap }}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: true }}
      orthographic camera={{ position: [0, 0, CAMERA_Z], near: 0.1, far: 900, zoom: 100 }}
    >
      <Scene {...props} tags={tags} />
      <MarkDrawn />
      <DevStats />
    </AdaptiveCanvas>
    </SceneBoundary>
    <div ref={tags.root} className="dr-tags" aria-hidden="true">
      <div ref={tags.pop} className="dr-tag">{props.pop && <span key={props.pop.key} className="dr-pop sk-display">{props.pop.n}</span>}</div>
      {slotViews.map((f, slot) => <div key={slot} ref={tags.signs[slot]} className="dr-tag dr-sign-tag">{f && <SignBoard view={f} />}</div>)}
    </div>
    </>
  );
}

interface Tags { root: RefObject<HTMLDivElement | null>; pop: RefObject<HTMLDivElement | null>; signs: RefObject<HTMLDivElement | null>[] }

/**
 * A sign's board (docs/dream/02-layout-and-interface.md, section 6), the same in every stage because it is the thing
 * you read: a bar on two chains, the letters your word must start with as lantern tiles, three sunk squares for the
 * letters that are yours, and a plank your accepted word lands on. It has no cap.
 */
function SignBoard({ view }: { view: FenceView }) {
  const word = view.locked ? view.word.toUpperCase() : '';
  return (
    <div className="dr-sign" data-wrong={view.wrong || undefined} data-done={view.locked || undefined}>
      <i className="dr-sign-bar" /><i className="dr-sign-chain" /><i className="dr-sign-chain" data-r />
      <div className="dr-sign-board">
        <div className="dr-sign-letters">
          {view.letters.map((ch, i) => <span key={i} className="dr-tile dr-tile--lantern">{ch.toUpperCase()}</span>)}
          <span className="dr-sign-dots"><i /><i /><i /></span>
        </div>
        <div className="dr-sign-plank" style={{ '--n': Math.max(1, word.length) } as React.CSSProperties}>
          {[...word].map((ch, i) => <span key={i} className="dr-sign-word">{ch}</span>)}
        </div>
      </div>
    </div>
  );
}

function Scene({ live, fences, phase, reduced, phone, tags, ui }: Props & { tags: Tags }) {
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const view = useMemo(() => dreamView(Math.max(1, size.width), Math.max(1, size.height), phone), [size.width, size.height, phone]);
  const voxMat = useMemo(() => voxelMaterial(), []);
  const glowMat = useMemo(() => voxelMaterial({ emissive: T.lantern[0], emissiveIntensity: 1.2 }), []);
  // A little light of their own: the undersides face away from the moon but must stay pale against the hills.
  const islandMat = useMemo(() => voxelMaterial({ emissive: '#7468B8', emissiveIntensity: 0.84 }), []);
  // Wood keeps its brown under the violet light: a warm tint takes out the blue the moon adds.
  const woodMat = useMemo(() => voxelMaterial({ color: WOOD_TINT, emissive: '#5A4230', emissiveIntensity: 0.55 }), []);
  const geo = useMemo(() => ({
    chunks: Array.from({ length: CHUNK.count }, (_, i) => raftChunk(i)),
    shadow: shadowDisc(), star: bonkStar(),
  }), []);
  // The far layers are flat and sized to the frame (plan file 09, 4.4), so they follow its size too.
  const far = useMemo(() => ({ sea: seaLayer(view), hills: hillsLayer(view), mountains: mountainsLayer(view) }), [view]);
  useEffect(() => () => { far.sea.dispose(); far.hills.dispose(); far.mountains.dispose(); }, [far]);
  // The islands and wisps are placed by shares of the frame, so they follow its size.
  const sky = useMemo(() => ({
    islands: ISLANDS.map((it, i) => { const p = islandPlace(it, phone, view); return { ...p, ...islandGeometry(it.kind, p.across, p.tall, i + 1) }; }),
    wisps: WISPS.map((w, i) => ({ geo: wispGeometry(i + 1), at: [...frameToWorld(view, w.frame[0], w.frame[1]), w.z] as [number, number, number] })),
  }), [view, phone]);
  useEffect(() => () => sky.islands.forEach((p) => { p.body.dispose(); p.props?.dispose(); p.glow?.dispose(); }), [sky]);
  useEffect(() => {
    scene.fog = new FogExp2(DREAM_FOG.color, DREAM_FOG.density);
    scene.background = new Color(DREAM_FOG.color);
  }, [scene]);

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
  // The signs' posts: tall enough that the board hangs clear of the sheep's head. A window too short for the whole
  // board (a small phone with its keyboard up) drops the word plank.
  const sign = useMemo(() => {
    const scale = signScale(phone), gap = ui.phone ? 10 : 16 * ui.u;
    const roomy = view.ground - (ui.phone ? 52 : 60 * ui.u) >= ART * SHEEP_ART.hat * view.s + gap + signHeight(ui.phone, ui.u, true);
    const rows = signRows(view, signHeight(ui.phone, ui.u, roomy), gap, scale);
    const half = (n: number) => Math.max(1, Math.ceil(signWidth(n, ui.phone, ui.u) / 2 / (0.1 * scale * view.zoom)) - 1);
    return { scale, rows, plank: roomy, half };
  }, [view, phone, ui.phone, ui.u]);
  const signState = useRef<string[]>([]);
  useEffect(() => { tags.root.current?.toggleAttribute('data-compact', !sign.plank); }, [tags, sign.plank]);
  const lamp = useRef<PointLight>(null);
  const hotSlot = useRef(-1);
  const [sheepState, setSheepState] = useState<SheepState>('grazing');
  // The worn avatar runs the dream (V5.1 Part 6.7), drawn at its own scale. The admin's photo runs too (Brian,
  // 2026-11-09), trotting and leaping as a picture facing the camera (discPose's dream states).
  const avatar = useAvatar();
  const admin = isAdminAvatar(avatar);
  const runner = !admin && byId(avatar) ? animalModel(byId(avatar)!.animal) : undefined;
  const { length } = useKaiyanLook(avatar);
  const discScale = Math.min(SHEEP_SCALE, DISC_MAX_H / photoHeight(avatar, length));
  // The bonk stars circle the head and the count pops over it, so both rise with a tall picture. The photo faces the
  // camera, which looks straight across the lane.
  const headY = admin ? photoHeight(avatar, length) * discScale + 0.08 : 0.95;
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
      const g = islandRefs.current[i], p = sky.islands[i];
      if (!g) return;
      g.position.x = islandX(it, scroll, p.x, p.across, view);
      g.position.y = p.y + (reduced ? 0 : Math.sin((t / it.bob) * Math.PI * 2) * 0.06);
    });
    WISPS.forEach((w, i) => { const g = wispRefs.current[i]; if (g) g.position.x = sky.wisps[i].at[0] - ((scroll * w.factor) % 40); });
    if (seaBank.current) {
      seaBank.current.position.x = -((scroll * SEA.factor) % SEA.period);
      seaBank.current.position.y = reduced ? 0 : Math.sin((t / 9) * Math.PI * 2) * 0.05;
    }
    if (hillRange.current) hillRange.current.position.x = -((scroll * LAYER.hills) % HILLS.period);
    if (mountainRange.current) mountainRange.current.position.x = -((scroll * LAYER.mountains) % MOUNTAINS.period);

    // The sheep: which state it is in, how high (the rules' arc drawn ART times taller), and knocked back on the bonk.
    const air = L.jumpAt === null ? 0 : drawnLift(L.t - L.jumpAt) * PX;
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
      const back = L.crashAt !== null ? -RECOIL.m * Math.min(1, (L.t - L.crashAt) / RECOIL.ms) : stumbling ? -0.12 : 0;
      sheep.current.position.set(worldX(SHEEP_CENTRE) + back, air, 0);
      // The leap in the body: a crouch before take-off, the nose rising then falling along the arc, a stretch at the
      // push and the reach, and a squash that gives on the landing. The model's own legs do the rest.
      const j = L.jumpAt === null ? -1 : Math.min(1, (L.t - L.jumpAt) / JUMP_MS);
      let pitch = 0, tall = 1, long = 1;
      if (!reduced) {
        if (j >= 0) {
          pitch = leapPitch(j);
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
      sheep.current.rotation.z = admin ? pitch * DISC_PITCH : pitch;
      sheep.current.scale.set(long, tall, 1);
    }
    if (sheepShadow.current) { const k = ART * (1 - 0.4 * Math.min(1, air / (ART * 28 * PX))); sheepShadow.current.scale.set(k, 1, k); }
    // Bonk stars orbit 0.25 m above the head from 350 ms.
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = (since >= WAKE.stir || stumbling) && !reduced;
      const a = (t / 1.1) * Math.PI * 2 + (i / 3) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.25, headY + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.25);
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
      // The sign's board, HTML hung from the post's arm: where the arm is on screen, and what its fence is doing. It
      // blinks when an unanswered fence is close, is knocked askew by a bump, and gives way to the sheep leaping past it.
      const tag = tags.signs[slot].current;
      if (tag) {
        const n = slotViews[slot]?.letters.length ?? 1, post = signPost(sign.rows, sign.half(n));
        const sx = (g.position.x + SIGN_AT[0] + post.hang[0] * sign.scale - view.camX) * view.zoom + view.w / 2;
        const sy = view.ground - post.hang[1] * sign.scale * view.zoom;
        tag.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
        const close = !fe.locked && !fe.passed && L.speed > 0 && (fe.x - (SX + SW)) / L.speed < CLOSE_S;
        const state = `${hit ? 'k' : ''}${close && !hit ? 'c' : ''}${fe.jumped && !fe.passed ? 'j' : ''}`;
        if (signState.current[slot] !== state) {
          signState.current[slot] = state;
          tag.toggleAttribute('data-knock', hit);
          tag.toggleAttribute('data-close', close && !hit);
          tag.toggleAttribute('data-clear', fe.jumped && !fe.passed);
        }
      }
    }
    slots.current.forEach((g, i) => {
      if (!g || used.has(i)) return;
      g.visible = false;
      const tag = tags.signs[i].current;
      if (tag && signState.current[i] !== 'off') { signState.current[i] = 'off'; tag.style.transform = 'translate3d(-9999px, 0, 0)'; }
    });
    if (L.dist < 1) anim.fenceSnowFor = -1;
    // One lantern light, on the active sign's post.
    const hot = hotSlot.current, hg = hot >= 0 ? slots.current[hot] : null;
    if (lamp.current) {
      lamp.current.intensity = hg?.visible ? 0.8 : 0;
      if (hg) { const at = signPost(sign.rows, sign.half(slotViews[hot]?.letters.length ?? 1)).lanternAt, k = sign.scale; lamp.current.position.set(hg.position.x + SIGN_AT[0] + at[0] * k, at[1] * k, SIGN_AT[2] + at[2] * k); }
    }
  });

  const slotViews = useMemo(() => Array.from({ length: SLOTS }, (_, slot) => fences.find((v) => v.index % SLOTS === slot) ?? null), [fences]);
  hotSlot.current = slotViews.findIndex((v) => v?.hot);

  return (
    <>
      <DreamCamera view={view} reduced={reduced} live={live} />
      {/* The plan's 1.4 and 0.5 assume the old light units, and its dark ground colour turns every shaded side navy; these
          land the layers on the value ladder. */}
      <hemisphereLight args={['#6E5FB5', '#A79BE6', 1.7]} />
      <directionalLight
        position={[5, 10, 7]} color="#EAE6FF" intensity={4.5} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-6} shadow-camera-right={11} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={1} shadow-camera-far={30}
      />

      <DreamSky view={view} reduced={reduced} />
      <group ref={seaBank}><mesh geometry={far.sea} material={voxMat} position={[0, 0, FAR_Z.sea]} /></group>
      {ISLANDS.map((it, i) => {
        const p = sky.islands[i];
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
      {sky.wisps.map((w, i) => <group key={i} ref={(el) => { wispRefs.current[i] = el; }} position={w.at}><mesh geometry={w.geo} material={voxMat} /></group>)}
      <group ref={hillRange}><mesh geometry={far.hills} material={voxMat} position={[0, 0, FAR_Z.hills]} /></group>
      <group ref={mountainRange}><mesh geometry={far.mountains} material={voxMat} position={[0, 0, FAR_Z.mountains]} /></group>

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
            {/* Drawn ART times the rules' size about its centre and the ground line; it tips over about its +x edge. */}
            <group scale={ART}>
              <group position={[0.215, 0, 0]}>
                <group ref={(el) => { fenceMeshes.current[slot] = el; }}>
                  {f && <mesh geometry={obstacle(lookOf(f.kind, f.index))} material={woodMat} position={[-0.215, 0, 0]} castShadow receiveShadow />}
                </group>
              </group>
            </group>
            <Sign hot={!!f?.hot} rows={sign.rows} half={sign.half(f?.letters.length ?? 1)} scale={sign.scale} />
          </group>
        ))}

        {/* The sheep faces +x and runs on the spot; the world does the moving. It stands on the rules' box centre, drawn
            ART times its size about its feet, its own drawn middle on that centre (plan file 09, 4.2). */}
        <group ref={sheep}>
          <group scale={ART}>
            {admin ? (
              // Facing the camera, which looks straight across the lane.
              <group scale={discScale}>
                <AvatarDisc state={sheepState} stateKey={stateKey} reduced={reduced} pace={pace} avatar={avatar} />
              </group>
            ) : (
              <group position={[-SHEEP_ART.mid * PX, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={SHEEP_SCALE * (runner ?? animalModel('sheep')).drawScale}>
                <Sheep level={2} state={sheepState} stateKey={stateKey} reduced={reduced} gustFrom={[0, 0.8, -4]} pace={pace} model={runner} contact={false} />
              </group>
            )}
            {[0, 1, 2].map((i) => <mesh key={i} ref={(el) => { stars.current[i] = el; }} geometry={geo.star} material={glowMat} visible={false} />)}
          </group>
          <ScreenAnchor el={tags.pop} position={[0, ART * headY + 0.45, 0]} cull={false} />
        </group>
        <mesh ref={sheepShadow} geometry={geo.shadow} material={shadowMat} position={[worldX(SHEEP_CENTRE), 0.005, 0]} />
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
/** An unanswered fence this many seconds off is close: its sign's outline blinks (the farmer stirs at the same mark). */
const CLOSE_S = 1.5;

/**
 * The sign's post (docs/dream/02-layout-and-interface.md, section 6): the same post and arm as before, taller, with its
 * lantern lit on the active sign. The board that hangs from the arm is `SignBoard`, HTML over the canvas.
 */
function Sign({ hot, rows, half, scale }: { hot: boolean; rows: number; half: number; scale: number }) {
  const geo = useMemo(() => signPost(rows, half), [rows, half]);
  const wood = useMemo(() => voxelMaterial({ color: WOOD_TINT }), []);
  const glass = useMemo(() => [voxelMaterial({ color: '#9A8A70' }), voxelMaterial({ emissive: '#FFC24B', emissiveIntensity: 0.9 })], []);
  return (
    <group position={[...SIGN_AT]} scale={scale}>
      <mesh geometry={geo.post} material={wood} castShadow />
      <mesh geometry={geo.lantern} material={glass[hot ? 1 : 0]} />
    </group>
  );
}

/**
 * The side view (plan file 09, 4.2): an orthographic camera looking along -z, its zoom the stage's CSS px per metre and
 * its place the frame's centre, from the stage's size. On the bump it shakes ±0.03 m for 300 ms (off under reduced
 * motion).
 */
function DreamCamera({ view, reduced, live }: { view: DreamView; reduced: boolean; live: MutableRefObject<StageLive> }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  useEffect(() => {
    camera.zoom = view.zoom;
    camera.position.set(view.camX, view.camY, CAMERA_Z);
    camera.rotation.set(0, 0, 0);
    camera.updateProjectionMatrix();
    if (devOn()) Object.assign(window, { __dreamLive: live });
  }, [camera, view, live]);
  useFrame(() => {
    const L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : 9999;
    const sh = !reduced && since < WAKE.shakeMs ? WAKE.shake : 0;
    camera.position.set(view.camX + (Math.random() - 0.5) * 2 * sh, view.camY + (Math.random() - 0.5) * 2 * sh, CAMERA_Z);
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

