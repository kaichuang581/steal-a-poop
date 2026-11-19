import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Color, FogExp2, PCFShadowMap, SRGBColorSpace } from 'three';
import type { BufferAttribute, BufferGeometry, Group, PerspectiveCamera } from 'three';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { useIsMobile } from '../../ui/hooks';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { cloudSea, island } from '../dream/world';
import { useMotionLevel } from '../hooks/useAmbient';
import { BLAST_PALETTE } from '../shop/catalog';
import { SHEEP_SCALE } from '../scene/layout';
import { Dome } from '../scene/Sky';
import { ScreenAnchor } from '../table/Anchors';
import { blockGeometry, carvedGeometry } from '../table/Podium';
import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { cloudGrid, PROP_VOXEL } from '../voxel/burstProps';
import { buildGeometry } from '../voxel/mesher';
import { voxelMaterial } from '../voxel/material';
import { trophyGeometry } from '../voxel/trophy';
import { LOOK } from '../look';

/**
 * The leaderboards' stage (Brian, 2026-11-14: "dont make the scenery for this one a barn, maybe place them up on
 * pedastals on the sky with nonchalant poses, like 3rd place sleeping on his belly with his legs dangling off the
 * pedastal"). A clear winter sky over a sea of cloud fills the screen; the first three lounge on the victory podium's
 * own timber blocks (gold, silver and bronze bands, gilded numerals), each a metre taller and standing on its own island
 * of snow and cloud. First sits back beside the trophy, second sits on the edge kicking its heels, third is asleep on
 * its belly with its legs hanging down the front. The page lays its board over the right of the sky; the camera is
 * solved from the free part of the screen (`windowEl`) so the three always fill it.
 */
export interface StageSeat { place: 1 | 2 | 3; you: boolean; avatar: string | null; taken: boolean }

/**
 * Each place: its pedestal's height (the podium's block made taller by `lift`), which side it stands, how the animal lies
 * on it and how big it is drawn. The champion's pedestal stands well over the others and the champion is drawn a size up,
 * at the front of its top, so it is the biggest and highest of the three wherever the camera is (second sits on the very
 * edge, nearer the camera, and drew bigger before).
 */
const SEATS = [
  { lift: 1.4, side: 0, state: 'lounge', at: [-0.12, 0.12, 0.34], turn: [0, -0.5, 0.1], size: 1.22 },
  { lift: 1, side: -1, state: 'perch', at: [0, 0.06, 1.11], turn: [0, -0.25, 0], size: 1 },
  { lift: 1, side: 1, state: 'flop', at: [-0.2, -0.34, 0.47], turn: [0, -Math.PI / 2, 0], size: 1 },
] as const;
const HEIGHTS = [2.9, 2.1, 1.8];
/** The camera's distance, and the height it stands at and looks along (level, so every hero is against open sky). */
const D = 16.7;
/**
 * What must fit in the window, in metres: from the islands' undersides (on a narrow screen, from their tops: the sky strip
 * is short and the undersides were a pale band) to the top of the champion's hat.
 */
const LOW = -1.05, LOW_NARROW = -0.3, HIGH = 4.75;
/** The numeral board hangs this far under a pedestal's top, and is this tall. */
const BOARD = 0.4, NUMERAL = 0.66;

export default function BoardStage({ seats, plaques, windowEl }: { seats: StageSeat[]; plaques: ReactNode[]; windowEl: RefObject<HTMLDivElement | null> }) {
  const reduced = useMotionLevel() === 'reduced';
  const phone = useIsMobile();
  const [gap, setGap] = useState(2.2);
  const layer = useRef<HTMLDivElement>(null);
  const anchors = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  return (
    <div className="sk-lb-stage" aria-hidden="true">
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="boards-sky" shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, antialias: true }}
        camera={{ fov: 20, position: [0, (LOW + HIGH) / 2, D], near: 0.5, far: 600 }}
      >
        <Frame windowEl={windowEl} layer={layer} onGap={setGap} />
        <Air phone={phone} />
        {/* The farm's day dome, pressed flat so its deep blue comes down to the heroes' heads. No snowfall up here. */}
        <group scale={[1, 0.3, 1]}><Dome hour="day" /></group>
        <Sea phone={phone} />
        <Puffs reduced={reduced} />
        {SEATS.map((s, i) => (
          <Pedestal key={i} place={(i + 1) as 1 | 2 | 3} x={s.side * gap} seat={seats[i]} reduced={reduced} plaque={anchors[i]} z={i === 2 ? anchors[3] : undefined} />
        ))}
        <MarkDrawn />
      </AdaptiveCanvas>
      <div ref={layer} className="sk-lb-plaques">
        {plaques.map((p, i) => <div key={i} ref={anchors[i]}>{p}</div>)}
        <div ref={anchors[3]}>{seats[2]?.taken && !reduced && <span className="sk-lb-z"><i>z</i><i>z</i><i>z</i></span>}</div>
      </div>
    </div>
  );
}

/**
 * The camera: level, at a fixed distance. The free window's size sets the scale (metres to pixels) so the three fill it,
 * the gap between the pedestals takes up any spare width, and the view is slid so the champion stands on the window's
 * centre line. Written again whenever the window or the canvas changes size.
 */
function Frame({ windowEl, layer, onGap }: { windowEl: RefObject<HTMLDivElement | null>; layer: RefObject<HTMLDivElement | null>; onGap: (g: number) => void }) {
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const gl = useThree((st) => st.gl);
  const size = useThree((st) => st.size);
  useEffect(() => {
    const el = windowEl.current;
    if (!el) return;
    const fit = () => {
      const c = gl.domElement.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!r.width || !r.height || !c.height) return;
      const wide = c.width >= 1000, low = wide ? LOW : LOW_NARROW;
      // Air kept clear over the hats (the lights under the beam) and under the islands.
      const top = wide ? 40 : 6, foot = wide ? 4 : 6;
      const s = Math.min(r.width / 6.8, (r.height - top - foot) / (HIGH - low));
      // Spare width spreads the pedestals (more on a tablet, whose strip is wide and short).
      const g = Math.min(wide ? 2.7 : 3.4, Math.max(1.9, (r.width / s - 2.5) / 2));
      camera.fov = (2 * Math.atan(c.height / (2 * s * D)) * 180) / Math.PI;
      camera.position.set(0, (low + HIGH) / 2, D);
      camera.lookAt(0, (low + HIGH) / 2, 0);
      // The three stand on the window's foot; any spare height is sky over their heads, never a pale floor under them.
      const cx = r.left - c.left + r.width / 2, cy = r.bottom - c.top - foot - ((HIGH - low) / 2) * s;
      camera.setViewOffset(c.width, c.height, c.width / 2 - cx, c.height / 2 - cy, c.width, c.height);
      camera.updateProjectionMatrix();
      layer.current?.style.setProperty('--lb-block', `${Math.round(1.4 * s)}px`);
      onGap(Math.round(g * 100) / 100);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [camera, gl, windowEl, layer, onGap, size.width, size.height]);
  return null;
}

/** A clear winter day, its haze thin enough for the far cloud to show: the farm's own day light, without the barn's lanterns. */
function Air({ phone }: { phone: boolean }) {
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    scene.fog = new FogExp2('#D3E6F4', 0.009);
    scene.background = new Color('#BFE1F3');
  }, [scene]);
  return (
    <>
      <hemisphereLight args={['#AEBEDA', '#8C8A86', 0.7]} />
      <directionalLight position={[-9, 13, 15]} color="#FFE8C8" intensity={1.9} castShadow shadow-mapSize={phone ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-4} shadow-camera-far={60} />
    </>
  );
}

/**
 * The dream's cloud is lilac, for its violet night. Under a day sky that reads as stone, so here every colour keeps a
 * quarter of its tint and is lifted a little: white cloud, cool in its shadows.
 */
function whiten<T extends BufferGeometry>(g: T): T {
  const c = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i), gr = c.getY(i), b = c.getZ(i), l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    c.setXYZ(i, (l + (r - l) * 0.25) * 1.06, (l + (gr - l) * 0.25) * 1.07, (l + (b - l) * 0.25) * 1.1);
  }
  return g;
}

/** The sea of cloud far below, the dream's own bank (built once, whitened), hazed by the distance. */
let sea: BufferGeometry | null = null;
let seaPhone: BufferGeometry | null = null;
function Sea({ phone }: { phone: boolean }) {
  const geo = phone ? (seaPhone ??= whiten(cloudSea(true))) : (sea ??= whiten(cloudSea(false)));
  const mat = useMemo(cloudMaterial, []);
  return <mesh geometry={geo} material={mat} position={[-32, -15, -40]} />;
}

/** White puffs of cloud drifting slowly past, between the pedestals and behind them: x, y, z, size, drift (m a second). */
// Low, below every pedestal's top: they drift behind the timber shafts, never behind a head (cream sheep on white cloud
// lost their outline).
const PUFFS = [[-7, -2.4, -14, 2.4, 0.12], [7.5, -1.6, -18, 2.8, -0.1], [0.5, -3.4, -24, 3.2, 0.07]] as const;
let puff: BufferGeometry | null = null;
const cloudMaterial = () => voxelMaterial({ emissive: '#9FB4D6', emissiveIntensity: 0.4 });
function Puffs({ reduced }: { reduced: boolean }) {
  const geo = (puff ??= buildGeometry(cloudGrid(BLAST_PALETTE['blast-snowfall']).map, PROP_VOXEL));
  const mat = useMemo(cloudMaterial, []);
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    refs.current.forEach((g, i) => {
      // Across and back round again, out of sight beyond 14 m either side.
      if (g) g.position.x = ((PUFFS[i][0] + PUFFS[i][4] * clock.elapsedTime + 14) % 28 + 28) % 28 - 14;
    });
  });
  return <>{PUFFS.map(([x, y, z, k], i) => (
    <group key={i} ref={(g) => { refs.current[i] = g; }} position={[x, y, z]} scale={k}><mesh geometry={geo} material={mat} /></group>
  ))}</>;
}

const blocks: ReturnType<typeof blockGeometry>[] = [], boards: ReturnType<typeof carvedGeometry>[] = [];
const isles: { body: BufferGeometry }[] = [];
let cup: ReturnType<typeof trophyGeometry> | null = null;

/** One place: its island, its pedestal and numeral, whoever holds it lounging on top, and the anchor for its name. */
function Pedestal({ place, x, seat, reduced, plaque, z }: { place: 1 | 2 | 3; x: number; seat?: StageSeat; reduced: boolean; plaque: RefObject<HTMLDivElement | null>; z?: RefObject<HTMLDivElement | null> }) {
  const i = place - 1, s = SEATS[i], top = HEIGHTS[i];
  blocks[i] ??= blockGeometry(place, s.lift);
  boards[i] ??= carvedGeometry(place);
  isles[i] ??= { body: whiten(island('windmill', 2.2, 0.95, 7 + place).body) };
  const mat = useMemo(() => voxelMaterial(), []);
  const cloud = useMemo(cloudMaterial, []);
  const g = useRef<Group>(null);
  // Each island bobs a few centimetres on its own slow clock.
  useFrame(({ clock }) => { if (g.current) g.current.position.y = reduced ? 0 : Math.sin(clock.elapsedTime * 0.5 + place * 1.7) * 0.05; });
  return (
    <group position={[x, 0, 0]}>
      <group ref={g}>
        <mesh geometry={isles[i].body} material={cloud} receiveShadow />
        <mesh geometry={blocks[i]} material={mat} castShadow receiveShadow />
        <mesh geometry={boards[i]} material={mat} position={[0, top - BOARD - NUMERAL, 0.605]} />
        {place === 1 && <Cup />}
        {seat?.taken && <Lounger seat={seat} reduced={reduced} />}
        {/* The name hangs in the middle of the timber between the numeral and the island, on every pedestal alike. */}
        <ScreenAnchor el={plaque} position={[0, (top - BOARD - NUMERAL) / 2, 0.66]} />
        {z && <ScreenAnchor el={z} position={[-0.62, top + 0.62, 0.7]} />}
      </group>
    </group>
  );
}

/** The trophy, standing on the champion's pedestal beside them: never held, never thrown. */
function Cup() {
  const geo = (cup ??= trophyGeometry());
  const gold = useMemo(() => voxelMaterial({ emissive: '#6A4500', emissiveIntensity: 0.35 }), []);
  return (
    <group position={[0.56, HEIGHTS[0], 0]} rotation={[0, -0.35, 0]}>
      <mesh geometry={geo} material={gold} castShadow />
      <pointLight position={[0, 0.5, 0.4]} color="#FFD27A" intensity={6} distance={3} decay={2} />
    </group>
  );
}

/** The one who holds the place, at ease on the pedestal. Everyone is the sheep but you, who wear your own avatar. */
function Lounger({ seat, reduced }: { seat: StageSeat; reduced: boolean }) {
  const s = SEATS[seat.place - 1];
  const admin = seat.you && seat.avatar === ADMIN_AVATAR_ID;
  const model = seat.you ? byId(seat.avatar ?? undefined) : undefined;
  const k = SHEEP_SCALE * s.size * animalModel(model?.animal ?? 'sheep').drawScale;
  const top = HEIGHTS[seat.place - 1];
  // The photo has no legs to hang: it stands on the top facing us, asleep or thinking.
  if (admin) return (
    <group position={[0, top, 0.2]} scale={0.45}>
      <AvatarDisc state={seat.place === 3 ? 'sleeping' : 'thinking'} reduced={reduced} />
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
