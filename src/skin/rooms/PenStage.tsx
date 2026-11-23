import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Color, FogExp2, PCFShadowMap, SRGBColorSpace } from 'three';
import { Vector3 } from 'three';
import type { BufferGeometry, Group, Material, PerspectiveCamera } from 'three';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { SHEEP_SCALE } from '../scene/layout';
import { buildMats, buildPen, MATS, matSpot, PEN, penShot } from '../scene/pen';
import { Sky } from '../scene/Sky';
import { ScreenAnchor } from '../table/Anchors';
import { nameplateY, platePoint, seatScale } from '../table/BarnTable';
import { AdaptiveCanvas, Effects, LANTERN_LIGHT } from '../table/Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { Crown } from './penArt';
import { penUnit } from './unit';
import { LOOK } from '../look';

const NIGHT = '#1B2C4A';

export interface PenGuest { id: string; name: string; avatar?: string; you: boolean; host: boolean }
/** Where on the canvas (CSS pixels) the pen and its plates must sit: the space the screen's panels leave. */
export interface PenFrame { left: number; top: number; right: number; bottom: number }

/**
 * The lobby's pen (docs/pen/PEN-PLAN.md, section 8): every player is their animal standing on the straw mat of their
 * seat (the order they joined, as the list shows), facing the camera, with a name plate over its head; an empty mat is
 * a free place. A player who joins drops onto their mat; one who leaves hops off; when the game starts the gate swings
 * open and everyone turns to it. The camera looks down 20 degrees and is fitted so the pen and its plates fill `fill`
 * of `frame`'s width (or all of its height), centred in it.
 */
export function PenStage({ guests, max, reduced, phone, frame, opening = false, fill = 0.72 }: {
  guests: PenGuest[]; max: number; reduced: boolean; phone: boolean; frame: PenFrame | null; opening?: boolean; fill?: number;
}) {
  const shot = penShot(phone);
  // One name plate per player, moved over its animal's head every frame by a ScreenAnchor inside the scene.
  const plates = useRef(new Map<string, RefObject<HTMLDivElement | null>>()).current;
  const plateOf = (id: string) => { let r = plates.get(id); if (!r) plates.set(id, (r = { current: null })); return r; };
  const gone = useLeavers(guests, reduced);
  // Where each player's face is on screen, by id, for the plates to keep clear of (8.3).
  const faces = useRef(new Map<string, Rect>()).current;
  const plateY = Math.max(...guests.map((g) => plateWorldY(g.avatar)), plateWorldY('sheep'));
  const platesEl = useRef<HTMLDivElement>(null);
  return (
    <div className="pn-stage" style={{ background: NIGHT }}>
      <SceneBoundary scene="the pen">
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="pen" resize={{ offsetSize: true }} shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: false }}
        camera={{ fov: shot.fov, position: shot.position, near: 0.1, far: 600 }}
        onCreated={({ camera }) => camera.lookAt(shot.target[0], shot.target[1], shot.target[2])}
      >
        <Frame phone={phone} frame={frame} fill={fill} plateY={plateY} max={max} plates={platesEl} />
        <Night />
        <Sky hour="night" reduced={reduced} blizzard={false} />
        <Place max={max} opening={opening} reduced={reduced} />
        {guests.map((g, i) => <Animal key={g.id} guest={g} seat={i} max={max} reduced={reduced} opening={opening} plate={plateOf(g.id)} faces={faces} />)}
        {gone.map((v) => <Animal key={`gone:${v.guest.id}`} guest={v.guest} seat={v.seat} max={max} reduced={reduced} opening={false} leaving />)}
        <Effects />
        <Unstack plates={plates} faces={faces} />
      </AdaptiveCanvas>
      </SceneBoundary>
      <div className="pn-plates" aria-hidden="true" ref={platesEl}>
        {guests.map((g) => (
          // A slab that is not a button: yours lantern, everyone else's wool; the host's has the crown (section 8.3).
          <div key={g.id} ref={plateOf(g.id)} data-anchor>
            <span className={`pn-plate hm-slab hm-knit rc-static ${g.you ? 'hm-slab--lantern' : ''}`} data-reduced={reduced || undefined}>
              {g.host && <Crown />}<b>{g.name}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The plate's height over the mat, in metres: the table's plate point (over the head's centre) and 0.12 of the animal's height over it. */
function plateWorldY(avatar: string | null | undefined): number {
  return MATS.top + nameplateY(avatar) + 0.12 * (isAdminAvatar(avatar) ? animalModel('sheep').height : animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep').height) * seatScale(avatar);
}

/** Players who have just left, kept 300 ms so their animal can hop off its mat (none under reduced motion). */
function useLeavers(guests: PenGuest[], reduced: boolean): { guest: PenGuest; seat: number }[] {
  const [gone, setGone] = useState<{ guest: PenGuest; seat: number }[]>([]);
  const last = useRef(new Map<string, { guest: PenGuest; seat: number }>());
  const timers = useRef<number[]>([]);
  const ids = guests.map((g) => g.id).join('\n');
  useEffect(() => {
    const now = new Map(guests.map((g, seat) => [g.id, { guest: g, seat }]));
    const left = [...last.current.entries()].filter(([id]) => !now.has(id)).map(([, v]) => v);
    last.current = now;
    if (!left.length || reduced) return;
    setGone((x) => [...x, ...left]);
    timers.current.push(window.setTimeout(() => setGone((x) => x.filter((v) => !left.includes(v))), 320));
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return gone;
}

/**
 * Name plates never sit on top of each other (section 8.3). Where two overlap, the one further back on screen (higher in
 * the picture) is lifted by its own height plus 4 until it clears the plates in front of it. The lift goes in the CSS
 * `translate` property, which ScreenAnchor's `transform` leaves alone, and eases toward its target so tags glide
 * instead of jumping while the animals wander.
 */
export function Unstack({ plates, faces }: { plates: Map<string, RefObject<HTMLDivElement | null>>; faces?: Map<string, Rect> }) {
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
    const placed: Rect[] = [];
    for (const it of items) {
      let up = 0;
      // Other plates already placed, and every face but this plate's own animal's.
      const clear = [...placed, ...[...(faces ?? [])].filter(([id]) => id !== it.id).map(([, f]) => f)];
      for (let pass = 0; pass < clear.length + 1; pass++) {
        const hit = clear.find((p) => it.l < p.r - 2 && it.r > p.l + 2 && it.t - up < p.b && it.b - up > p.t);
        if (!hit) break;
        up = it.b - hit.t + 4;
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

const FIT = new Vector3(), FACE = new Vector3();
interface Rect { l: number; r: number; t: number; b: number }
/**
 * Holds the shot (section 8.2: down 20 degrees) and fits it to `frame`. The distance is the least of three: the animals
 * on the front row (their mats' ends and half an animal past them) `fill` of the frame's width, the whole fence inside
 * the frame's width, and the plates' tops (two plates high: side by side they may step up one, 8.3) to the gate's foot
 * inside its height. A view offset then centres that in the frame. Recomputed when the canvas or the frame changes.
 */
function Frame({ phone, frame, fill, plateY, max, plates }: { phone: boolean; frame: PenFrame | null; fill: number; plateY: number; max: number; plates: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const { left = 0, top = 0, right = size.width, bottom = size.height } = frame ?? {};
  useEffect(() => {
    const W = size.width, H = size.height;
    if (W < 2 || H < 2) return;
    const platePx = 2 * (phone ? 31 : 36) * penUnit(W, H, !phone) + 4; // two plates (face, side, shadow) and the gap between them (pen.css)
    const backZ = max > MATS.perRow ? MATS.back : MATS.front;
    const xs = Array.from({ length: max }, (_, i) => matSpot(i, max).x);
    const wide = Math.max(...xs.map(Math.abs)) + 0.55;
    const project = (x: number, y: number, z: number) => {
      FIT.set(x, y, z).project(camera);
      return [((FIT.x + 1) / 2) * W, ((1 - FIT.y) / 2) * H] as const;
    };
    const measure = (dist: number) => {
      const shot = penShot(phone, dist);
      camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
      camera.fov = shot.fov;
      camera.aspect = W / H;
      camera.clearViewOffset();
      camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const animals = project(wide, 0.4, MATS.front)[0] - project(-wide, 0.4, MATS.front)[0];
      const fence = project(PEN.halfX, 0, -PEN.halfZ)[0] - project(-PEN.halfX, 0, -PEN.halfZ)[0];
      const t = project(0, plateY, backZ)[1] - platePx, b = project(0, 0, -PEN.halfZ)[1];
      return { animals: Math.abs(animals), fence: Math.abs(fence), t, b, cx: project(0, 0.4, 0)[0] };
    };
    const fw = Math.max(40, right - left), fh = Math.max(40, bottom - top);
    let dist = phone ? 17 : 14; // penShot's own guess
    for (let k = 0; k < 6; k++) {
      const m = measure(dist);
      dist *= Math.max(m.animals / (fill * fw), m.fence / fw, (m.b - m.t) / fh);
    }
    const m = measure(dist);
    // A plate is never wider than two places: then the plates of one row need two levels at most, which the fit above
    // leaves room for; a long name ends in "…" (a phone's ten-player pen stacked them up into the lights).
    const a0 = matSpot(0, max), a1 = matSpot(1, max);
    const step = Math.abs(project(a0.x, plateY, a0.z)[0] - project(a1.x, plateY, a1.z)[0]);
    plates.current?.style.setProperty('--plate-max', `${Math.max(64, 2 * step - 8).toFixed(0)}px`);
    camera.setViewOffset(W, H, m.cx - (left + right) / 2, (m.t + m.b) / 2 - (top + bottom) / 2, W, H);
    camera.updateProjectionMatrix();
    return () => camera.clearViewOffset();
  }, [camera, phone, size.width, size.height, left, top, right, bottom, fill, plateY, max]);
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

function Place({ max, opening, reduced }: { max: number; opening: boolean; reduced: boolean }) {
  const w = useMemo(() => buildPen(), []);
  const m = useMemo(() => buildMats(max), [max]);
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
      <mesh geometry={m.mats} material={mat} receiveShadow />
      <mesh geometry={m.numbers} material={mat} receiveShadow />
      <Gate left={w.gateL} right={w.gateR} material={mat} opening={opening} reduced={reduced} />
      {/* The moon, low over a saddle in the range (the sky's own moon rides too high for this level shot). */}
      <mesh position={[-70, 19, 330]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[6.5, 40]} />
        <meshBasicMaterial color="#FFF3D2" fog={false} />
      </mesh>
    </>
  );
}

/** The gate's two leaves on their posts. When the game starts they swing outward 100 degrees in 500 ms, easing out (8.4); never under reduced motion. */
function Gate({ left, right, material, opening, reduced }: { left: BufferGeometry; right: BufferGeometry; material: Material; opening: boolean; reduced: boolean }) {
  const l = useRef<Group>(null), r = useRef<Group>(null), at = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const on = opening && !reduced;
    if (!on) at.current = null;
    else at.current ??= clock.elapsedTime;
    const t = at.current === null ? 0 : Math.min(1, (clock.elapsedTime - at.current) / 0.5);
    const a = (1 - (1 - t) ** 3) * ((100 * Math.PI) / 180);
    if (l.current) l.current.rotation.y = a;
    if (r.current) r.current.rotation.y = -a;
  });
  const G = PEN.gate / 2, Z = -PEN.halfZ;
  return (
    <>
      <group ref={l} position={[-G, 0, Z]}><mesh geometry={left} material={material} castShadow receiveShadow /></group>
      <group ref={r} position={[G, 0, Z]}><mesh geometry={right} material={material} castShadow receiveShadow /></group>
    </>
  );
}

/**
 * One player's animal on its mat (8.1), facing the camera. It drops onto the mat from 0.6 m with a small squash as it
 * lands (350 ms), moves along when the seats before it empty, hops off and shrinks away when its player leaves
 * (300 ms), and turns to the gate when it opens (8.4). Under reduced motion it simply appears and goes.
 */
function Animal({ guest, seat, max, reduced, opening, plate, faces, leaving = false }: {
  guest: PenGuest; seat: number; max: number; reduced: boolean; opening: boolean; plate?: RefObject<HTMLDivElement | null>; faces?: Map<string, Rect>; leaving?: boolean;
}) {
  const group = useRef<Group>(null), body = useRef<Group>(null), head = useRef<Group>(null);
  useEffect(() => () => { faces?.delete(guest.id); }, [faces, guest.id]);
  const at = useRef<{ x: number; z: number; yaw: number; born: number } | null>(null);
  useFrame(({ clock, camera, size }, dt) => {
    const g = group.current, b = body.current;
    if (!g || !b) return;
    // The face on screen: under the hat, from 0.1 of the animal's height below the plate's point to 0.42, as wide as tall.
    if (faces && head.current) {
      const top = head.current.localToWorld(FACE.set(0, -0.1 * headH, 0)).project(camera), tx = ((top.x + 1) / 2) * size.width, ty = ((1 - top.y) / 2) * size.height;
      const bot = head.current.localToWorld(FACE.set(0, -0.42 * headH, 0)).project(camera), by = ((1 - bot.y) / 2) * size.height;
      const half = (by - ty) * 0.6;
      faces.set(guest.id, { l: tx - half, r: tx + half, t: ty, b: by });
    }
    const now = clock.elapsedTime, spot = matSpot(seat, max);
    const s = (at.current ??= { x: spot.x, z: spot.z, yaw: spot.yaw, born: now });
    const k = reduced ? 1 : Math.min(1, dt * 7);
    const far = Math.hypot(spot.x - s.x, spot.z - s.z);
    s.x += (spot.x - s.x) * k; s.z += (spot.z - s.z) * k;
    const aim = opening ? Math.atan2(0 - s.x, -PEN.halfZ - s.z) : spot.yaw;
    let turn = aim - s.yaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    s.yaw += turn * (reduced ? 1 : Math.min(1, dt * 8));
    const t = (now - s.born) / (leaving ? 0.3 : 0.35);
    let y = reduced ? 0 : Math.min(0.3, far * 0.5), sy = 1, sxz = 1;
    if (!reduced && t < 1) {
      if (leaving) { y = 0.3 * Math.sin((t * Math.PI) / 2); sxz = sy = 1 - t; }
      else if (t < 0.7) y = 0.6 * (1 - (t / 0.7) ** 2);
      else { const q = Math.sin((Math.PI * (t - 0.7)) / 0.3); sy = 1 - 0.18 * q; sxz = 1 + 0.1 * q; }
    } else if (leaving) sxz = sy = 0.0001;
    g.position.set(s.x, MATS.top + y, s.z);
    g.rotation.y = s.yaw;
    b.scale.set(sxz, sy, sxz);
  });
  const c = byId(guest.avatar);
  const admin = isAdminAvatar(guest.avatar);
  const model = c ? animalModel(c.animal) : undefined;
  const start = matSpot(seat, max);
  const headH = (admin ? animalModel('sheep') : model ?? animalModel('sheep')).height;
  return (
    <group ref={group} position={[start.x, MATS.top, start.z]} rotation={[0, start.yaw, 0]}>
      <group ref={body}>
        <group scale={SHEEP_SCALE * (admin ? 1 : (model ?? animalModel('sheep')).drawScale)}>
          {admin
            ? <AvatarDisc state="idle" reduced={reduced} avatar={guest.avatar} />
            : <Sheep level={2} state="idle" reduced={reduced} lookAt={opening ? undefined : 'camera'} model={model} />}
          {plate && <ScreenAnchor el={plate} position={penPlate(guest.avatar)} above cull={false} />}
          {faces && <group ref={head} position={platePoint(guest.avatar)} />}
        </group>
      </group>
    </group>
  );
}

/** The plate's point: the table's plate point over the head, and 0.12 of the animal's height above it, in its scaled group. */
function penPlate(avatar: string | null | undefined): [number, number, number] {
  const p = platePoint(avatar);
  const h = (isAdminAvatar(avatar) ? animalModel('sheep') : animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep')).height;
  return [p[0], p[1] + 0.12 * h, p[2]];
}
