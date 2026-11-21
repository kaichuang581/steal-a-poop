import { useThree } from '@react-three/fiber';
import { createRef, useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Color, FogExp2, MeshBasicMaterial, PCFShadowMap, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry, PerspectiveCamera } from 'three';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { SHEEP_SCALE } from '../scene/layout';
import { Dome } from '../scene/Sky';
import { blockGeometry, carvedGeometry } from '../table/Podium';
import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { trophyGeometry } from '../voxel/trophy';
import { LOOK } from '../look';
import { CRATE, CRATE_HEIGHTS, farIsland, islandGeometry, stageLayout } from './island';
import type { IslandGeo, StageLayout } from './island';

/**
 * The leaderboards' stage (docs/leaderboards/LEADERBOARDS-PLAN.md, section 8, Brian, 2026-11-21). The podium's three
 * timber crates stand side by side on one snowy island (island.ts) in a clear winter sky, with two small pale islands far
 * behind; no clouds. The first three lounge on them (the 2026-11-14 poses: first sits back beside the trophy, second sits
 * on the edge kicking its heels, third is asleep on its belly). The camera looks straight on and 10 degrees down through a
 * long lens (28 degrees), so the three crates are drawn the same width, and it is slid so the crates are centred in the
 * part of the screen the board leaves (`windowEl`). Each name plate hangs on its crate's front, 10 px over its foot, all
 * three on one line; they are placed when the window or the camera changes, never each frame.
 */
export interface StageSeat { place: 1 | 2 | 3; you: boolean; avatar: string | null; taken: boolean }

/**
 * How each place's holder lies on its crate (x, y, z from the middle of the crate's top), turned, and drawn a size up
 * for the champion. Third lies along its crate's top with nothing over the sides: asleep on its belly it measures about
 * 1.84 m nose to tail at the second's size, longer than the 1.4 m crate, so it is drawn at 0.76 of it and centred (its
 * head used to hang off the left). Its legs still hang down the crate's front, as the pose has them.
 */
const SEATS = [
  { lift: 1.4, state: 'lounge', at: [-0.12, 0.12, 0.34], turn: [0, -0.5, 0.1], size: 1.22 },
  { lift: 1, state: 'perch', at: [0, 0.06, 1.11], turn: [0, -0.25, 0], size: 1 },
  { lift: 1, state: 'flop', at: [0.18, -0.26, 0.47], turn: [0, -Math.PI / 2, 0], size: 0.76 },
] as const;
/** Where the stage's three places stand in `stageLayout`'s list (second on the left, first in the middle, third right). */
const COLUMN = [1, 0, 2] as const;
/** The camera: 10 degrees down, 28 degrees of view top to bottom. */
const PITCH = (10 * Math.PI) / 180, FOV = 28;
/** The highest point of the champion and the cup on its crate, and what the camera looks at. */
const TOP = CRATE_HEIGHTS[0] + 2, TOP_Z = -0.3, AIM = 1.7;
/** The numeral board hangs this far under a crate's top, and is this tall. */
const BOARD = 0.4, NUMERAL = 0.66;
/** The far islands: about three times as far away as the main one, up and left (35%) and lower and right (25%). */
const FAR = [{ at: [-7, 3, -30], k: 0.35 }, { at: [9, 0, -30], k: 0.25 }] as const;
const SKY = '#BFE1F3';

export default function BoardStage({ seats, plates, windowEl, phone, reduced, u }: {
  seats: StageSeat[]; plates: ReactNode[]; windowEl: RefObject<HTMLDivElement | null>; phone: boolean; reduced: boolean; u: number;
}) {
  const layout = useMemo(() => stageLayout(phone), [phone]);
  // One stable set of anchors, so a new board (a tab pressed) never re-runs the camera and the plates' placing.
  const anchors = useRef([createRef<HTMLDivElement>(), createRef<HTMLDivElement>(), createRef<HTMLDivElement>()]).current;
  const z = useRef<HTMLDivElement>(null);
  return (
    <div className="lb-stage" aria-hidden="true">
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="boards-sky" shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }}
        camera={{ fov: FOV, position: [0, 4, 15], near: 0.5, far: 600 }}
      >
        <Frame windowEl={windowEl} layout={layout} phone={phone} u={u} anchors={anchors} z={z} />
        <Air />
        {/* The farm's day dome, pressed flat so its deep blue comes down to the heroes' heads. No snowfall, no cloud. */}
        <group scale={[1, 0.3, 1]}><Dome hour="day" /></group>
        <Ground layout={layout} phone={phone} />
        {FAR.map((f, i) => <Far key={i} layout={layout} k={f.k} at={f.at} />)}
        {SEATS.map((_, i) => (
          <Crate key={i} place={(i + 1) as 1 | 2 | 3} x={layout.x[COLUMN[i]]} seat={seats[i]} reduced={reduced} />
        ))}
        <MarkDrawn />
      </AdaptiveCanvas>
      <div className="lb-plates">
        {plates.map((p, i) => <div key={i} ref={anchors[i]} className="lb-plate-at">{p}</div>)}
        <div ref={z} className="lb-plate-at">{seats[2]?.taken && !reduced && <span className="lb-z"><i>z</i><i>z</i><i>z</i></span>}</div>
      </div>
    </div>
  );
}

/**
 * The camera, solved from the window the board leaves: the crates and the three on them fill 70% of its width on a
 * computer and 92% on a phone (less only where the window is too short for them), straight on and 10 degrees down;
 * slid so the crates are centred across it and the champion's head stays 24 px under its top. Then each plate is put on
 * its crate. Run again whenever the window or the canvas changes size, and at no other time.
 */
function Frame({ windowEl, layout, phone, u, anchors, z }: {
  windowEl: RefObject<HTMLDivElement | null>; layout: StageLayout; phone: boolean; u: number;
  anchors: RefObject<HTMLDivElement | null>[]; z: RefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const gl = useThree((st) => st.gl);
  const size = useThree((st) => st.size);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    const el = windowEl.current;
    if (!el) return;
    const v = new Vector3();
    const fit = () => {
      const c = gl.domElement.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!r.width || !r.height || !c.height || !c.width) return;
      const f = c.height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
      const halfSpan = Math.abs(layout.x[2]) + CRATE.w / 2 + 0.12; // the crates, and the sheep a little over their sides
      const margin = 24 * u, foot = 14 * u;
      let d = (f * 2 * halfSpan) / ((phone ? 0.92 : 0.7) * r.width);
      const place = () => {
        camera.fov = FOV;
        camera.aspect = c.width / c.height;
        camera.clearViewOffset();
        camera.position.set(0, AIM + d * Math.sin(PITCH), d * Math.cos(PITCH));
        camera.lookAt(0, AIM, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      };
      /** A point's distance from the picture's middle, in pixels (x right, y down), before the slide. */
      const px = (x: number, y: number, zz: number) => { v.set(x, y, zz).project(camera); return [(v.x * c.width) / 2, (-v.y * c.height) / 2] as const; };
      // Too short a window for that: back the camera off until the champion's head and the crates' feet both fit.
      for (let k = 0; k < 3; k++) {
        place();
        const span = px(0, 0, CRATE.d / 2)[1] - px(0, TOP, TOP_Z)[1], room = r.height - margin - foot;
        if (span <= room) break;
        d *= span / room;
      }
      place();
      const cx = r.left - c.left + r.width / 2, cy = r.top - c.top + margin - px(0, TOP, TOP_Z)[1];
      camera.setViewOffset(c.width, c.height, c.width / 2 - cx, c.height / 2 - cy, c.width, c.height);
      camera.updateProjectionMatrix();
      // The plates: each centred on its crate's front face, 10 px over its foot; as wide as the crate allows.
      const at = (x: number, y: number, zz: number) => { v.set(x, y, zz).project(camera); return [((v.x + 1) / 2) * c.width, ((1 - v.y) / 2) * c.height] as const; };
      [0, 1, 2].forEach((i) => {
        const node = anchors[i].current;
        if (!node) return;
        const x = layout.x[COLUMN[i]], [fx, fy] = at(x, 0, CRATE.d / 2), w = at(x + CRATE.w / 2, 0, CRATE.d / 2)[0] - at(x - CRATE.w / 2, 0, CRATE.d / 2)[0];
        node.style.transform = `translate3d(${fx.toFixed(1)}px, ${(fy - 10 * u).toFixed(1)}px, 0)`;
        node.style.setProperty('--crate-w', `${Math.round(w)}px`);
        node.style.setProperty('--left', `${Math.round(fx)}px`);
        node.style.setProperty('--right', `${Math.round(c.width - fx)}px`);
      });
      // Third place's letters, off the top of its head.
      if (z.current) { const [hx, hy] = at(layout.x[COLUMN[2]] - 0.35, CRATE_HEIGHTS[2] + 0.45, 0.7); z.current.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0)`; z.current.style.setProperty('--crate-w', `${Math.round(at(1, 0, 0)[0] - at(0, 0, 0)[0])}px`); }
      invalidate();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [camera, gl, windowEl, layout, phone, u, anchors, z, invalidate, size.width, size.height]);
  return null;
}

/** A clear winter day: the farm's own day light and its haze, thin enough for the far islands to show. */
function Air() {
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    scene.fog = new FogExp2('#D3E6F4', 0.009);
    scene.background = new Color(SKY);
  }, [scene]);
  return (
    <>
      <hemisphereLight args={['#AEBEDA', '#8C8A86', 0.7]} />
      <directionalLight position={[-9, 13, 15]} color="#FFE8C8" intensity={1.9} castShadow shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={7} shadow-camera-bottom={-4} shadow-camera-far={60} />
    </>
  );
}

const grounds = new Map<string, IslandGeo>();
/** The island under the crates, with everything on it; the lantern's glass lit, and its light inside it. */
function Ground({ layout, phone }: { layout: StageLayout; phone: boolean }) {
  const key = phone ? 'phone' : 'desk';
  let geo = grounds.get(key);
  if (!geo) grounds.set(key, (geo = islandGeometry(layout)));
  const mat = useMemo(() => voxelMaterial(), []);
  const lit = useMemo(() => voxelMaterial({ emissive: '#FFB45A', emissiveIntensity: 0.85 }), []);
  return (
    <group>
      <mesh geometry={geo.body} material={mat} castShadow receiveShadow />
      <mesh geometry={geo.glow} material={lit} />
      <pointLight position={geo.lamp} color="#FFD27A" intensity={1.2} distance={2.2} decay={2} />
    </group>
  );
}

/** The sky's colour mixed toward `to` by `k`, as a colour for a material that takes no light. */
const mix = (to: string, k: number) => { const a = new Color(SKY), b = new Color(to); return a.lerp(b, k); };
const fars = new Map<string, BufferGeometry>();
/** A small island far off, in two flat pale tones, out of the haze's reach. */
function Far({ layout, k, at }: { layout: StageLayout; k: number; at: readonly [number, number, number] }) {
  const key = `${layout.halfW}:${k}`;
  let geo = fars.get(key);
  if (!geo) {
    const top = mix('#EEE9E1', 0.6), under = mix('#9A9087', 0.45);
    fars.set(key, (geo = farIsland(layout, k, [top.r, top.g, top.b], [under.r, under.g, under.b])));
  }
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, fog: false }), []);
  return <mesh geometry={geo} material={mat} position={[at[0], at[1], at[2]]} />;
}

const blocks: ReturnType<typeof blockGeometry>[] = [], boards: ReturnType<typeof carvedGeometry>[] = [];
let cup: ReturnType<typeof trophyGeometry> | null = null;

/** One place: its crate and numeral standing on the island, and whoever holds it at ease on top. */
function Crate({ place, x, seat, reduced }: { place: 1 | 2 | 3; x: number; seat?: StageSeat; reduced: boolean }) {
  const i = place - 1, top = CRATE_HEIGHTS[i];
  blocks[i] ??= blockGeometry(place, SEATS[i].lift);
  boards[i] ??= carvedGeometry(place);
  const mat = useMemo(() => voxelMaterial(), []);
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={blocks[i]} material={mat} castShadow receiveShadow />
      <mesh geometry={boards[i]} material={mat} position={[0, top - BOARD - NUMERAL, CRATE.d / 2 + 0.005]} />
      {place === 1 && <Cup />}
      {seat?.taken && <Lounger seat={seat} reduced={reduced} />}
    </group>
  );
}

/** The trophy, standing on the champion's crate beside them. It keeps its own shine; no light of its own on the wool. */
function Cup() {
  const geo = (cup ??= trophyGeometry());
  const gold = useMemo(() => voxelMaterial({ emissive: '#6A4500', emissiveIntensity: 0.35 }), []);
  return <mesh geometry={geo} material={gold} position={[0.56, CRATE_HEIGHTS[0], 0]} rotation={[0, -0.35, 0]} castShadow />;
}

/** The one who holds the place, at ease on the crate. Everyone is the sheep but you, who wear your own avatar. */
function Lounger({ seat, reduced }: { seat: StageSeat; reduced: boolean }) {
  const s = SEATS[seat.place - 1];
  const admin = seat.you && isAdminAvatar(seat.avatar);
  const model = seat.you ? byId(seat.avatar ?? undefined) : undefined;
  const k = SHEEP_SCALE * s.size * animalModel(model?.animal ?? 'sheep').drawScale;
  const top = CRATE_HEIGHTS[seat.place - 1];
  // The photo has no legs to hang: it stands on the top facing us, asleep or thinking.
  if (admin) return (
    <group position={[0, top, 0.2]} scale={0.45}>
      <AvatarDisc state={seat.place === 3 ? 'sleeping' : 'thinking'} reduced={reduced} avatar={seat.avatar} />
    </group>
  );
  return (
    <group position={[s.at[0], top + s.at[1], s.at[2]]} rotation={[s.turn[0], s.turn[1], s.turn[2]]}>
      <group scale={k}>
        <Sheep level={2} state={s.state as SheepState} reduced={reduced} scarf={seat.place === 1} model={model ? animalModel(model.animal) : undefined} />
      </group>
    </group>
  );
}
