import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Color, FogExp2, PCFShadowMap, SRGBColorSpace } from 'three';
import type { Group, PerspectiveCamera } from 'three';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { SHEEP_SCALE } from '../scene/layout';
import { buildPen, PEN, penShot, penSpot } from '../scene/pen';
import { Sky } from '../scene/Sky';
import { ScreenAnchor } from '../table/Anchors';
import { platePoint, seatScale } from '../table/BarnTable';
import { AdaptiveCanvas, Effects, LANTERN_LIGHT } from '../table/Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { rng } from '../voxel/primitives';
import { arrive, roam } from './penWander';
import type { RoamMode, Roamer } from './penWander';
import { LOOK } from '../look';

const NIGHT = '#1B2C4A';

export interface PenGuest { id: string; name: string; avatar?: string; you: boolean; host: boolean }

/**
 * The lobby's pen: every player is an animal inside the fence, with the table's name tag over its head; seats nobody has taken
 * are farm sheep. They all wander the pen and graze (penWander.ts). `shift` moves the pen on screen (a share of the
 * width and height) so the panels laid over the picture do not cover it.
 */
export function PenStage({ guests, farmSheep, reduced, phone, shift }: { guests: PenGuest[]; farmSheep: number; reduced: boolean; phone: boolean; shift: [number, number] }) {
  const shot = penShot(phone);
  // One name plank per player, moved over its animal's head every frame by a ScreenAnchor inside the scene.
  const plates = useRef(new Map<string, RefObject<HTMLDivElement | null>>()).current;
  const plateOf = (id: string) => { let r = plates.get(id); if (!r) plates.set(id, (r = { current: null })); return r; };
  // Where every animal in the pen is, by id: each keeps clear of the others.
  const flock = useRef(new Map<string, Roamer>()).current;
  return (
    <div className="absolute inset-0" style={{ background: NIGHT }}>
      <SceneBoundary scene="the pen">
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="pen" resize={{ offsetSize: true }} shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: false }}
        camera={{ fov: shot.fov, position: shot.position, near: 0.1, far: 600 }}
        onCreated={({ camera }) => camera.lookAt(shot.target[0], shot.target[1], shot.target[2])}
      >
        <Frame phone={phone} shift={shift} />
        <Night />
        <Sky hour="night" reduced={reduced} blizzard={false} />
        <Place />
        {guests.map((g, i) => <Animal key={g.id} id={g.id} index={i} guest={g} reduced={reduced} flock={flock} plate={plateOf(g.id)} />)}
        {Array.from({ length: farmSheep }, (_, k) => <Animal key={`farm-${k}`} id={`farm-${k}`} index={9 - k} reduced={reduced} flock={flock} />)}
        <Effects />
        <Unstack plates={plates} />
      </AdaptiveCanvas>
      </SceneBoundary>
      <div className="rm-plates" aria-hidden="true">
        {guests.map((g) => (
          // The table's own name tag (PaintedGame's `.sk-plate`): dark stitched wool, the name, and "you" as it says there.
          <div key={g.id} ref={plateOf(g.id)}>
            <span className="sk-plate rm-plate"><span className="sk-plate-who">{g.name}</span>{g.host && <span className="sk-plate-you">host</span>}{g.you && <span className="sk-plate-you">you</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Name tags never sit on top of each other. When animals stand close, the tag further back on screen (the one whose
 * animal stands higher in the picture) is lifted until it clears the tags in front of it. The lift goes in the CSS
 * `translate` property, which ScreenAnchor's `transform` leaves alone, and eases toward its target so tags glide
 * instead of jumping while the animals wander.
 */
export function Unstack({ plates }: { plates: Map<string, RefObject<HTMLDivElement | null>> }) {
  const lift = useRef(new Map<string, number>()).current;
  useFrame((_, dt) => {
    const items: { id: string; node: HTMLDivElement; l: number; r: number; t: number; b: number }[] = [];
    for (const [id, ref] of plates) {
      const node = ref.current;
      if (!node || node.style.display === 'none' || !node.isConnected) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0) continue;
      const now = lift.get(id) ?? 0; // undo this frame's lift, to work from where the anchor put it
      items.push({ id, node, l: box.left, r: box.right, t: box.top + now, b: box.bottom + now });
    }
    // Front first: the lowest tag on screen keeps its place.
    items.sort((a, b) => b.b - a.b);
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    for (const it of items) {
      let up = 0;
      for (let pass = 0; pass < items.length; pass++) {
        const hit = placed.find((p) => it.l < p.r - 2 && it.r > p.l + 2 && it.t - up < p.b && it.b - up > p.t);
        if (!hit) break;
        up = it.b - hit.t + 3;
      }
      placed.push({ l: it.l, r: it.r, t: it.t - up, b: it.b - up });
      const was = lift.get(it.id) ?? 0;
      const next = was + (up - was) * Math.min(1, dt * 12);
      lift.set(it.id, Math.abs(next - up) < 0.5 ? up : next);
      it.node.style.translate = `0 ${(-(lift.get(it.id) ?? 0)).toFixed(1)}px`;
    }
  });
  return null;
}

/** Holds the shot and slides the picture by `shift`, so the pen sits in the part of the screen the panels leave free. */
function Frame({ phone, shift }: { phone: boolean; shift: [number, number] }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const shot = penShot(phone);
    camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
    camera.fov = shot.fov;
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    camera.setViewOffset(size.width, size.height, -shift[0] * size.width, -shift[1] * size.height, size.width, size.height);
    camera.updateProjectionMatrix();
    return () => camera.clearViewOffset();
  }, [camera, phone, size.width, size.height, shift[0], shift[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** A clear winter night: a cool moon from behind the camera, and the lantern's warm pool over the back corner. */
function Night() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    // Thin air: the ridge is clear and the mountains, three hundred metres off, are still there, blue with distance.
    scene.fog = new FogExp2(NIGHT, 0.0042);
    scene.background = new Color(NIGHT);
  }, [scene]);
  return (
    <>
      <hemisphereLight args={['#A9BEDD', '#3A4660', 1.25]} />
      <directionalLight
        position={[-7, 12, -14]} color="#D3E0F5" intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-10} shadow-camera-near={1} shadow-camera-far={60}
      />
      <pointLight position={[PEN.lamp[0] + 0.1, PEN.lamp[1], PEN.lamp[2] - 0.7]} color={LANTERN_LIGHT.color} intensity={26} distance={12} decay={LANTERN_LIGHT.decay} />
      <pointLight position={[PEN.gateLamp[0], PEN.gateLamp[1] + 0.1, PEN.gateLamp[2] + 0.5]} color={LANTERN_LIGHT.color} intensity={5} distance={7} decay={LANTERN_LIGHT.decay} />
    </>
  );
}

function Place() {
  const w = useMemo(() => buildPen(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 1.4 }), []);
  return (
    <>
      <mesh geometry={w.ground} material={mat} receiveShadow />
      <mesh geometry={w.land} material={mat} receiveShadow />
      <mesh geometry={w.trees} material={mat} castShadow receiveShadow />
      <mesh geometry={w.wood} material={mat} />
      <mesh geometry={w.nature} material={mat} castShadow receiveShadow />
      <mesh geometry={w.mountains} material={mat} />
      <mesh geometry={w.fence} material={mat} castShadow receiveShadow />
      <mesh geometry={w.glow} material={glow} />
      {/* The moon, low over a saddle in the range (the sky's own moon rides too high for this level shot). */}
      <mesh position={[-70, 19, 330]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[6.5, 40]} />
        <meshBasicMaterial color="#FFF3D2" fog={false} />
      </mesh>
    </>
  );
}

/**
 * One animal in the pen: a player's (their avatar, a name plank over it; it hops as it arrives and looks at you when it
 * stands) or a farm sheep. It wanders and grazes by penWander's rules; with reduced motion it stays on its spot.
 */
function Animal({ id, index, guest, reduced, flock, plate }: { id: string; index: number; guest?: PenGuest; reduced: boolean; flock: Map<string, Roamer>; plate?: RefObject<HTMLDivElement | null> }) {
  const group = useRef<Group>(null);
  const rand = useMemo(() => rng(1 + [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)), [id]);
  const me = useRef<Roamer | null>(null);
  const born = useRef<number | null>(null);
  const [pose, setPose] = useState<RoamMode | 'happy'>(guest ? 'happy' : 'idle');
  const shown = useRef(pose);
  useEffect(() => () => { flock.delete(id); }, [flock, id]);
  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime;
    born.current ??= now;
    const r = (me.current ??= arrive(index, now, rand));
    flock.set(id, r);
    // A player's animal hops for its first moments in the pen; after that it does what the others do.
    const fresh = !!guest && now - born.current < 1.6;
    const mode = reduced ? (guest ? 'idle' : 'graze') : roam(r, Math.min(dt, 0.1), now, flock.values(), rand);
    const next = fresh ? 'happy' : mode;
    if (next !== shown.current) { shown.current = next; setPose(next); }
    const g = group.current;
    if (g) { g.position.set(r.x, 0, r.z); g.rotation.y = r.yaw; }
  });
  const c = byId(guest?.avatar);
  const admin = isAdminAvatar(guest?.avatar);
  const model = c ? animalModel(c.animal) : undefined;
  const start = penSpot(index);
  return (
    <group ref={group} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]}>
      <group scale={SHEEP_SCALE * (admin ? 1 : (model ?? animalModel('sheep')).drawScale)}>
        {admin
          ? <AvatarDisc state="idle" reduced={reduced} avatar={guest?.avatar} />
          : <Sheep level={2} state={pose === 'graze' ? 'grazing' : pose} reduced={reduced} lookAt={guest && pose === 'idle' ? 'camera' : undefined} model={model} />}
        {/* The name plank over the head (`platePoint`), 0.1 m higher than the table's plate, in the scaled group's units. */}
        {guest && plate && <ScreenAnchor el={plate} position={penPlate(guest.avatar)} above cull={false} />}
      </group>
    </group>
  );
}

/** The pen's name plank point: the table's plate point, 0.1 m higher, in the animal's scaled group. */
function penPlate(avatar: string | null | undefined): [number, number, number] {
  const p = platePoint(avatar);
  return [p[0], p[1] + 0.1 / seatScale(avatar), p[2]];
}
