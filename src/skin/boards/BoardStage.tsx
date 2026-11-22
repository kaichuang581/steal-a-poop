import { useFrame, useThree } from '@react-three/fiber';
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { AdditiveBlending, Box3, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, FogExp2, MeshBasicMaterial, PCFShadowMap, Points, PointsMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Group, PerspectiveCamera } from 'three';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import type { Species } from '../voxel/animals/rig';
import { buildGeometry } from '../voxel/mesher';
import { voxelMaterial } from '../voxel/material';
import { LOOK } from '../look';
import { FAR_SPOTS, inWindow, jumpFor, onCanvas, skyBehind, solveCamera, worldAt } from './frame';
import type { FarName } from './frame';
import { CELL, CRATE, CRATE_HEIGHTS, FAR, farIsland, farLights, islandGeometry, stageLayout } from './island';
import type { IslandGeo, StageLayout } from './island';
import { emptyRig, inCrate, NAP, placement, POSES, rigOf, sample, STAGGER } from './poses';
import type { Place } from './poses';
import { podiumGeometry, podiumVoxels } from './podium';
import { FestivalSky } from './FestivalSky';
import { Prize } from './Prize';
import { PARTY_FOG } from './sky';

/**
 * The leaderboards' stage (docs/leaderboards/LEADERBOARDS-PLAN.md section 8, Brian, 2026-11-21; its 8.1 and 8.4
 * replaced by docs/leaderboards/LEADERBOARDS-PLAN-V3.md and his message of 2026-11-22). Three podiums of gold, silver
 * and bronze (podium.ts) stand on one snowy island (island.ts) under a party sky (PartySky.tsx), three small islands far
 * off. On them the first three hold this stage's own poses (poses.ts), one size for all: first with its arms up in a V
 * and the trophy floating and glowing over it (Prize.tsx), second sat on its podium's edge clapping, third asleep as a
 * loaf. The camera (frame.ts) looks straight on and 10 degrees down through a long lens, slid so the podiums are centred
 * in the part of the screen the board leaves (`windowEl`). Each name plate hangs on its podium's front, 10 px over its
 * foot, all three on one line; they, the third's "z"s, the far islands and the sky's things are placed when the window
 * or the camera changes, never each frame.
 */
export interface StageSeat { place: 1 | 2 | 3; you: boolean; avatar: string | null; taken: boolean }

/** Where the stage's three places stand in `stageLayout`'s list (second on the left, first in the middle, third right). */
const COLUMN = [1, 0, 2] as const;
const RAD = Math.PI / 180;
/** Pines sway 1.5 degrees each way, every 5.0 s (left) and 6.2 s (right); the rocks bob 0.04 m; the far islands 0.06 m (4.3, 4.4, 4.5). */
const SWAY = { deg: 1.5, periods: [5, 6.2] }, ROCK = { m: 0.04, periods: [4, 5.2] }, DRIFT = { m: 0.06, periods: { A: 7, B: 8.5, C: 10 } as Record<FarName, number> };

/**
 * Development only: `?lbAnimal=cow` puts that species in every place, and `?lbTime=1.2` holds every loop at that many
 * seconds after its own start, for the pull request's pictures.
 */
const DEV = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const DEV_ANIMAL = (DEV?.get('lbAnimal') ?? null) as Species | null;
const DEV_TIME = DEV?.get('lbTime') != null ? Number(DEV.get('lbTime')) : null;

/** Which animal holds a place: you wear your own; everyone else is the sheep (the boards carry names, not avatars). */
const speciesOf = (seat?: StageSeat): Species => DEV_ANIMAL ?? (seat?.you ? ((byId(seat.avatar ?? undefined)?.animal ?? 'sheep') as Species) : 'sheep');

export default function BoardStage({ seats, plates, windowEl, phone, reduced, u }: {
  seats: StageSeat[]; plates: ReactNode[]; windowEl: RefObject<HTMLDivElement | null>; phone: boolean; reduced: boolean; u: number;
}) {
  const layout = useMemo(() => stageLayout(phone), [phone]);
  // One stable set of anchors, so a new board (a tab pressed) never re-runs the camera and the plates' placing.
  const anchors = useRef([createRef<HTMLDivElement>(), createRef<HTMLDivElement>(), createRef<HTMLDivElement>()]).current;
  const fars = useRef<Record<FarName, Vector3 | null>>({ A: null, B: null, C: null }).current;
  const jumps = useRef(new Map<Species, number>()).current;
  const z = useRef<HTMLDivElement>(null);
  // A spot of the window as a point in the world, for the sky's clouds, lights and fireworks; renewed with the camera.
  const place = useRef<((fx: number, fy: number, k: number) => Vector3 | null) | null>(null);
  const [skyVersion, setSkyVersion] = useState(0);
  const onPlaced = useCallback(() => setSkyVersion((v) => v + 1), []);
  const kinds = [speciesOf(seats[0]), speciesOf(seats[1]), speciesOf(seats[2])] as const;
  // A new holder of a place takes its rest pose at once and starts its loop from 0 (3.1): its key changes.
  const who = (s?: StageSeat) => `${s?.taken ? 1 : 0}|${s?.you ? 1 : 0}|${s?.avatar ?? ''}|${speciesOf(s)}`;
  return (
    <div className="lb-stage" aria-hidden="true">
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="boards-sky" shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }}
        camera={{ fov: 28, position: [0, 4, 15], near: 0.5, far: 600 }}
      >
        <Frame windowEl={windowEl} layout={layout} phone={phone} u={u} anchors={anchors} z={z} fars={fars} jumps={jumps} champ={kinds[0]} nap={kinds[2]}
          place={place} onPlaced={onPlaced} />
        <Air />
        <FestivalSky place={place} version={skyVersion} reduced={reduced} />
        <Ground layout={layout} phone={phone} reduced={reduced} />
        {(Object.keys(FAR_SPOTS) as FarName[]).map((n) => <Far key={n} name={n} phone={phone} reduced={reduced} fars={fars} />)}
        {([1, 2, 3] as const).map((p) => (
          <Podium key={p} place={p} x={layout.x[COLUMN[p - 1]]} reduced={reduced}>
            {seats[p - 1]?.taken && <Lounger key={who(seats[p - 1])} seat={seats[p - 1]} species={kinds[p - 1]} reduced={reduced} jumps={jumps} />}
          </Podium>
        ))}
        <MarkDrawn />
      </AdaptiveCanvas>
      <div className="lb-plates">
        {plates.map((p, i) => <div key={i} ref={anchors[i]} className="lb-plate-at">{p}</div>)}
        <div ref={z} className="lb-plate-at">
          {seats[2]?.taken && !(seats[2].you && isAdminAvatar(seats[2].avatar)) && (
            <span key={who(seats[2])} className="lb-z" data-still={reduced || DEV_TIME != null ? '' : undefined}><i>z</i><i>z</i><i>z</i></span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Stands the camera (frame.ts) whenever the window or the canvas changes size, and at no other time; then puts each
 * plate on its crate, the third's "z"s over its head, and the far islands in their places, and works out how high the
 * champion may hop so its trophy stays under the lights.
 */
function Frame({ windowEl, layout, phone, u, anchors, z, fars, jumps, champ, nap, place, onPlaced }: {
  windowEl: RefObject<HTMLDivElement | null>; layout: StageLayout; phone: boolean; u: number;
  anchors: RefObject<HTMLDivElement | null>[]; z: RefObject<HTMLDivElement | null>; fars: Record<FarName, Vector3 | null>;
  jumps: Map<Species, number>; champ: Species; nap: Species;
  place: { current: ((fx: number, fy: number, k: number) => Vector3 | null) | null }; onPlaced: () => void;
}) {
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const gl = useThree((st) => st.gl);
  const size = useThree((st) => st.size);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    const el = windowEl.current;
    if (!el) return;
    const fit = () => {
      const c = gl.domElement.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!r.width || !r.height || !c.height || !c.width) return;
      const cw = c.width, ch = c.height, win = { left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height };
      const solved = solveCamera(camera, cw, ch, win, u, phone, layout, groundOf(layout, phone).foot);
      jumps.set(champ, jumpFor(champ, camera, cw, ch, solved.limit));
      const at = (x: number, y: number, zz: number) => onCanvas(camera, cw, ch, x, y, zz);
      // The plates: each centred on its crate's front face, 10 px over its foot; as wide as the crate allows.
      [0, 1, 2].forEach((i) => {
        const node = anchors[i].current;
        if (!node) return;
        const x = layout.x[COLUMN[i]], [fx, fy] = at(x, 0, CRATE.d / 2), w = at(x + CRATE.w / 2, 0, CRATE.d / 2)[0] - at(x - CRATE.w / 2, 0, CRATE.d / 2)[0];
        node.style.transform = `translate3d(${fx.toFixed(1)}px, ${(fy - 10 * u).toFixed(1)}px, 0)`;
        node.style.setProperty('--crate-w', `${Math.round(w)}px`);
        node.style.setProperty('--left', `${Math.round(fx)}px`);
        node.style.setProperty('--right', `${Math.round(cw - fx)}px`);
        // Too narrow for the rosette, the badge and the whole figure: the badge steps out (boards.css).
        if (!phone && w < 106 * u + 8) node.dataset.narrow = ''; else delete node.dataset.narrow;
      });
      // Third place's letters rise from 0.1 H over the top of its head, on its right (3.5).
      if (z.current) {
        const m = animalModel(nap), pl = placement(nap, 3), x3 = layout.x[COLUMN[2]];
        const box = new Box3().setFromPoints(inCrate(m, NAP, rigOf(m, NAP, NAP.rest, pl.fit), pl.k, pl.at).get('head')!);
        const [hx, hy] = at(x3 + box.max.x, CRATE_HEIGHTS[2] + box.max.y + 0.1 * pl.H, (box.min.z + box.max.z) / 2);
        const H = at(x3, CRATE_HEIGHTS[2] + pl.H, 0)[1] - at(x3, CRATE_HEIGHTS[2], 0)[1];
        z.current.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0)`;
        z.current.style.setProperty('--zh', `${Math.abs(H).toFixed(1)}px`);
      }
      // The far islands: each middle on its place in the window, as far off as 4.5 says.
      (Object.keys(FAR_SPOTS) as FarName[]).forEach((n) => {
        const [fx, fy] = inWindow(n);
        fars[n] = worldAt(camera, cw, ch, win.left + fx * win.width, win.top + fy * win.height, FAR_SPOTS[n].k);
      });
      // The sky's things are placed by the same spots of the window, much further off.
      place.current = (fx, fy, k) => worldAt(camera, cw, ch, win.left + fx * win.width, win.top + fy * win.height, k);
      onPlaced();
      invalidate();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [camera, gl, windowEl, layout, phone, u, anchors, z, fars, jumps, champ, nap, place, onPlaced, invalidate, size.width, size.height]);
  return null;
}

/**
 * The festival night's light (Brian, 2026-11-22): a warm key from the upper left, as from the festival's lanterns, that
 * throws the shadows; a cool fill from the night sky over a warm ground; the moon's pale blue on the edges from behind;
 * and the festival's glow from below and in front, warm on the island's underside. A thin plum haze.
 */
function Air() {
  const scene = useThree((st) => st.scene);
  useEffect(() => { scene.fog = new FogExp2(PARTY_FOG, 0.008); }, [scene]);
  return (
    <>
      <hemisphereLight args={['#8C96E2', '#D38C6C', 0.85]} />
      <directionalLight position={[-9, 13, 15]} color="#FFD9B0" intensity={1.75} castShadow shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={7} shadow-camera-bottom={-4.5} shadow-camera-far={60} />
      <directionalLight position={[7, 8, -10]} color="#A9C4FF" intensity={0.85} />
      <directionalLight position={[0, -5, 8]} color="#FF946A" intensity={0.4} />
    </>
  );
}

const grounds = new Map<string, IslandGeo>();
const groundOf = (layout: StageLayout, phone: boolean) => {
  const key = phone ? 'phone' : 'desk';
  let geo = grounds.get(key);
  if (!geo) grounds.set(key, (geo = islandGeometry(layout)));
  return geo;
};
/**
 * The island under the crates with everything fixed on it; the lantern and its lit glass, its light inside the glass;
 * the icicles; the two pines, each swaying about its trunk's foot; the two rocks under the tip, bobbing.
 */
function Ground({ layout, phone, reduced }: { layout: StageLayout; phone: boolean; reduced: boolean }) {
  const geo = groundOf(layout, phone);
  const mat = useMemo(() => voxelMaterial(), []);
  const lit = useMemo(() => voxelMaterial({ emissive: '#FFB45A', emissiveIntensity: 0.85 }), []);
  const pines = useRef<(Group | null)[]>([]), rocks = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    pines.current.forEach((g, i) => { if (g) g.rotation.z = SWAY.deg * RAD * Math.sin((2 * Math.PI * t) / SWAY.periods[i]); });
    rocks.current.forEach((g, i) => { if (g) g.position.y = geo.rocks[i].at[1] + ROCK.m * Math.sin((2 * Math.PI * t) / ROCK.periods[i]); });
  });
  return (
    <group>
      <mesh geometry={geo.body} material={mat} castShadow receiveShadow />
      {/* The underside's bands take no shadow (under the rim's they were one grey, and 4.3 wants them told apart) and cast
          none (it would fall on nothing in view); nor do the small lantern's iron and the podiums' trim. */}
      <mesh geometry={geo.under} material={mat} />
      <mesh geometry={geo.lantern} material={mat} />
      <mesh geometry={geo.glass} material={lit} />
      {geo.icicles && <mesh geometry={geo.icicles} material={mat} />}
      <pointLight position={geo.lamp} color="#FFD27A" intensity={0.6} distance={1.4} decay={2} />
      {geo.pines.map((p, i) => (
        <group key={i} ref={(g) => { pines.current[i] = g; }} position={p.at}>
          <mesh geometry={p.geo} material={mat} castShadow receiveShadow />
        </group>
      ))}
      {geo.rocks.map((r, i) => (
        <group key={i} ref={(g) => { rocks.current[i] = g; }} position={r.at}>
          <mesh geometry={r.geo} material={mat} />
        </group>
      ))}
    </group>
  );
}

const farGeos = new Map<string, { geo: BufferGeometry; mid: Vector3 }>();
/**
 * A small island far off (4.5), its colours mixed toward the sky behind it, for a material that takes no light and no
 * haze; its middle on the point `Frame` worked out for it, bobbing 0.06 m.
 */
function Far({ name, phone, reduced, fars }: { name: FarName; phone: boolean; reduced: boolean; fars: Record<FarName, Vector3 | null> }) {
  const key = `${name}|${phone}`;
  let hit = farGeos.get(key);
  if (!hit) {
    const sky = skyBehind(name);
    const geo = buildGeometry(farIsland(FAR[name], [sky.r, sky.g, sky.b]).map, CELL, { ao: false, merge: true });
    geo.computeBoundingBox();
    farGeos.set(key, (hit = { geo, mid: geo.boundingBox!.getCenter(new Vector3()) }));
  }
  const { geo, mid } = hit;
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, fog: false }), []);
  // Its string of festival lights: warm white, red and gold in turn, points that keep their size however far off.
  const lights = useMemo(() => {
    const at = farLights(FAR[name]), cols = ['#FFE9B8', '#FF6A5A', '#FFC65C'].map((c) => new Color(c));
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(at.flat(), 3));
    g.setAttribute('color', new Float32BufferAttribute(at.flatMap((_, i) => cols[i % 3].toArray()), 3));
    return new Points(g, new PointsMaterial({ size: 4.5, sizeAttenuation: false, map: glowDot(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
  }, [name]);
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current, at = fars[name];
    if (!g || !at) return;
    g.position.copy(at).sub(mid);
    if (!reduced) g.position.y += DRIFT.m * Math.sin((2 * Math.PI * clock.elapsedTime) / DRIFT.periods[name]);
  });
  return <group ref={ref} position={[0, -999, 0]}><mesh geometry={geo} material={mat} /><primitive object={lights} /></group>;
}

/** A small soft dot, drawn once, for the far islands' lights. */
let dot: CanvasTexture | null = null;
const glowDot = () => {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d')!, g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  dot = new CanvasTexture(c); dot.colorSpace = SRGBColorSpace;
  return dot;
};

/** A soft warm glow, drawn once, for the podiums' lanterns. */
let lanternGlow: CanvasTexture | null = null;
const glowMap = () => {
  if (lanternGlow) return lanternGlow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,170,110,0.55)'); g.addColorStop(0.45, 'rgba(255,120,70,0.18)'); g.addColorStop(1, 'rgba(255,100,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  lanternGlow = new CanvasTexture(c); lanternGlow.colorSpace = SRGBColorSpace;
  return lanternGlow;
};

/**
 * One place: its festival stage (podium.ts) standing on the island, its two paper lanterns lit from within with a soft
 * glow round each that breathes a little (still under reduced motion), and whoever holds it on top.
 */
function Podium({ place, x, reduced, children }: { place: Place; x: number; reduced: boolean; children?: ReactNode }) {
  const top = CRATE_HEIGHTS[place - 1], geo = podiumGeometry(place, top);
  const mat = useMemo(() => voxelMaterial(), []);
  const paper = useMemo(() => voxelMaterial({ emissive: '#FF6A3A', emissiveIntensity: 0.7 }), []);
  const boxes = useMemo(() => podiumVoxels(place, top).lanterns, [place, top]);
  // Both lanterns' glows in one draw: soft points that keep their size on screen to the lantern's.
  const glows = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(boxes.flatMap((b) => [(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2 - 0.03, (b.z[0] + b.z[1]) / 2]), 3));
    return new Points(g, new PointsMaterial({ size: 0.62, map: glowMap(), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  }, [boxes]);
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    glows.material.size = 0.62 * (1 + 0.06 * Math.sin(t * 2.3 + place));
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geo.body} material={mat} castShadow receiveShadow />
      <mesh geometry={geo.trim} material={mat} />
      <mesh geometry={geo.paper} material={paper} />
      <primitive object={glows} renderOrder={1} />
      <group position={[0, top, 0]}>{children}</group>
    </group>
  );
}

/**
 * The one who holds the place, in this stage's pose for it (poses.ts), on its own clock: the loops start 0, 0.8 and 1.6 s
 * after the screen opens, stand still while the tab is hidden, and hold the rest pose under reduced motion. The Sheep
 * component turns the parts (its `rig`); this group lifts the whole avatar for the hop and squashes and pulses it about
 * where its weight bears. The trophy is held in the same group, so it rises and squashes with the hooves that hold it.
 */
function Lounger({ seat, species, reduced, jumps }: { seat: StageSeat; species: Species; reduced: boolean; jumps: Map<Species, number> }) {
  const place = seat.place, def = POSES[place];
  const m = animalModel(species);
  const pl = placement(species, place);
  const pose = useRef(sample(def, 0));
  const out = useRef(emptyRig());
  const clock = useRef({ t: 0, last: NaN });
  const wrap = useRef<Group>(null), held = useRef<Group>(null);
  const rig = useMemo(() => (t: number) => {
    const c = clock.current;
    const dt = Number.isNaN(c.last) ? 0 : Math.min(0.1, Math.max(0, t - c.last));
    c.last = t;
    if (typeof document === 'undefined' || !document.hidden) c.t += dt;
    const lt = DEV_TIME ?? c.t - STAGGER[place];
    if (reduced || lt < 0) sample(def, 0, 0, pose.current);
    else sample(def, lt, Math.floor(lt / def.loop), pose.current);
    return rigOf(m, def, pose.current, pl.fit, out.current);
  }, [def, m, pl, place, reduced]);
  useFrame(() => {
    const p = pose.current, w = wrap.current;
    if (!w) return;
    const j = place === 1 ? jumps.get(species) ?? 1 : 1;
    w.position.set(pl.pivot[0], pl.pivot[1] + p.lift * pl.H * j, pl.pivot[2]);
    w.scale.set(p.pulse / Math.sqrt(p.squash), p.pulse * p.squash, p.pulse / Math.sqrt(p.squash));
    if (held.current) {
      held.current.position.set(pl.trophy[0], pl.trophy[1] + p.trophyLift * pl.H * j, pl.trophy[2]);
      held.current.rotation.z = -p.trophyRoll * RAD;
    }
  });
  // The photo has no legs to pose: it stands on the top facing us, asleep or thinking, as since 2026-11-14.
  if (seat.you && isAdminAvatar(seat.avatar)) return (
    <group position={[0, 0, 0.2]} scale={0.45}>
      <AvatarDisc state={place === 3 ? 'sleeping' : 'thinking'} reduced={reduced} avatar={seat.avatar} />
    </group>
  );
  return (
    <group ref={wrap}>
      <group position={[-pl.pivot[0], -pl.pivot[1], -pl.pivot[2]]}>
        <group position={pl.at} rotation={[0, def.turn * RAD, 0]}>
          <group scale={pl.k}>
            <Sheep level={2} state={place === 3 ? 'sleeping' : 'idle'} still reduced={reduced} scarf={place === 1} model={m} rig={rig} />
          </group>
        </group>
        {place === 1 && (
          <group ref={held} position={pl.trophy}>
            <Prize reduced={reduced} />
          </group>
        )}
      </group>
    </group>
  );
}
