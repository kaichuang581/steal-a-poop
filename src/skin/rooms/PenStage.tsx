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
import { buildMats, buildPen, MATS, matSpot, PEN, penShot, penStep } from '../scene/pen';
import type { PenPace } from '../scene/pen';
import { getKaiyanLook, pictureHeight } from '../avatars/kaiyanLook';
import { anchorsOf } from '../voxel/animals/anchors';
import { Sky } from '../scene/Sky';
import { ScreenAnchor } from '../table/Anchors';
import { seatScale } from '../table/BarnTable';
import { AdaptiveCanvas, Effects, LANTERN_LIGHT } from '../table/Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { Crown } from './penArt';
import { penUnit } from './unit';
import { LOOK } from '../look';
import './penPlates.css';

const NIGHT = '#1B2C4A';

export interface PenGuest { id: string; name: string; avatar?: string; you: boolean; host: boolean }
/** Where on the canvas (CSS pixels) the pen and its plates must sit: the space the screen's panels leave. */
export interface PenFrame { left: number; top: number; right: number; bottom: number }

/**
 * The lobby's pen (docs/pen/PEN-PLAN.md, section 8): every player is their animal standing on the straw mat of their
 * seat (the order they joined, as the list shows), facing the camera, with a name plate over its head; an empty mat is
 * a free place. A player who joins drops onto their mat; one who leaves hops off; when the game starts the gate swings
 * open and everyone turns to it. The camera looks down 20 degrees and is fitted so the pen and its plates fill `fill`
 * of `frame`'s width (or all of its height), centred in it (docs/pen/PEN-PLAN-V3.md, 9.7: 84%).
 */
export function PenStage({ guests, max, reduced, phone, frame, opening = false, fill = 0.84 }: {
  guests: PenGuest[]; max: number; reduced: boolean; phone: boolean; frame: PenFrame | null; opening?: boolean; fill?: number;
}) {
  const shot = penShot(phone);
  // One name plate per player, moved over its animal's head every frame by a ScreenAnchor inside the scene.
  const plates = useRef(new Map<string, RefObject<HTMLDivElement | null>>()).current;
  const plateOf = (id: string) => { let r = plates.get(id); if (!r) plates.set(id, (r = { current: null })); return r; };
  const gone = useLeavers(guests, reduced);
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
        {guests.map((g, i) => <Animal key={g.id} guest={g} seat={i} max={max} reduced={reduced} opening={opening} plate={plateOf(g.id)} />)}
        {gone.map((v) => <Animal key={`gone:${v.guest.id}`} guest={v.guest} seat={v.seat} max={max} reduced={reduced} opening={false} leaving />)}
        <Effects />
        <Unstack plates={plates} />
      </AdaptiveCanvas>
      </SceneBoundary>
      <PenPlates guests={guests} reduced={reduced} plateOf={plateOf} ref={platesEl} />
    </div>
  );
}

/**
 * Every player's name plate, one each, every time (docs/pen/PEN-PLAN-V3.md, 9.3): HTML over the canvas, so it stays
 * crisp, moved over its animal's head by that animal's ScreenAnchor. A slab that is not a button: yours lantern,
 * everyone else's wool; the host's has the crown.
 */
export function PenPlates({ guests, reduced, plateOf, ref }: {
  guests: PenGuest[]; reduced: boolean; plateOf: (id: string) => RefObject<HTMLDivElement | null>; ref?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="pn-plates" aria-hidden="true" ref={ref}>
      {guests.map((g) => (
        <div key={g.id} ref={plateOf(g.id)} data-anchor>
          <span className={`pn-plate hm-slab hm-knit rc-static ${g.you ? 'hm-slab--lantern' : ''}`} data-reduced={reduced || undefined}>
            {g.host && <Crown onLantern={g.you} />}<b>{g.name}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

/** The plate's height over the ground, in metres (`penPlate`, scaled as the animal is). */
function plateWorldY(avatar: string | null | undefined): number {
  return MATS.top + penPlate(avatar)[1] * seatScale(avatar);
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
    const placed: Rect[] = [];
    for (const it of items) {
      let up = 0;
      // Only other plates: a plate lifted clear of the faces behind it floated far over its own head (V3 P3, 9.3).
      const clear = placed;
      for (let pass = 0; pass < clear.length + 1; pass++) {
        const hit = clear.find((p) => it.l < p.r - 2 && it.r > p.l + 2 && it.t - up < p.b && it.b - up > p.t);
        if (!hit) break;
        up = it.b - hit.t + 4;
      }
      placed.push({ l: it.l, r: it.r, t: it.t - up, b: it.b - up });
      const was = lift.get(it.id) ?? 0;
      const next = was + (up - was) * Math.min(1, dt * 12);
      lift.set(it.id, Math.abs(next - up) < 0.5 ? up : next);
      it.node.style.translate = `0 ${-Math.round(lift.get(it.id) ?? 0)}px`; // whole pixels, or the plate's text goes soft
    }
  });
  return null;
}

const FIT = new Vector3();
interface Rect { l: number; r: number; t: number; b: number }
/**
 * Holds the shot (section 8.2: down 20 degrees) and fits it to `frame`. The distance is the least of three: the animals
 * on the front row (their mats' ends and half an animal past them) `fill` of the frame's width, the whole fence inside
 * the canvas (its ends may pass under the panels: kept inside the frame, the animals stopped at 73% of it, V3 9.7), and
 * the plates' tops (two plates high: side by side they may step up one, 8.3) to the gate's foot
 * inside its height. A view offset then centres that in the frame. Recomputed when the canvas or the frame changes.
 */
function Frame({ phone, frame, fill, plateY, max, plates }: { phone: boolean; frame: PenFrame | null; fill: number; plateY: number; max: number; plates: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const { left = 0, top = 0, right = size.width, bottom = size.height } = frame ?? {};
  useEffect(() => {
    const W = size.width, H = size.height;
    if (W < 2 || H < 2) return;
    const platePx = 2 * (phone ? 27 : 29) * penUnit(W, H, !phone) + 4; // two plates (face, side and shadow: 24 + 3 or 26 + 3) and the gap between them (penPlates.css)
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
      dist *= Math.max(m.animals / (fill * fw), m.fence / (W - 32), (m.b - m.t) / fh);
    }
    const m = measure(dist);
    // A plate is never wider than two places: then the plates of one row need two levels at most, which the fit above
    // leaves room for; a long name ends in "…" (a phone's ten-player pen stacked them up into the lights).
    const a0 = matSpot(0, max), a1 = matSpot(1, max);
    const step = Math.abs(project(a0.x, plateY, a0.z)[0] - project(a1.x, plateY, a1.z)[0]);
    plates.current?.style.setProperty('--plate-max', `${Math.max(64, 2 * step - 8).toFixed(0)}px`);
    // The gate's foot sits on the frame's bottom, 20 over the button (docs/pen/PEN-PLAN-V3.md 9.7): fitted by width, the
    // pen has height to spare, and centred it left a band of bare snow over the button (S7); the spare goes to the sky.
    // On a phone, and wherever the fit was set by the height, this is the same as centring.
    camera.setViewOffset(W, H, m.cx - (left + right) / 2, phone ? (m.t + m.b) / 2 - (top + bottom) / 2 : m.b - bottom, W, H);
    camera.updateProjectionMatrix();
    return () => camera.clearViewOffset();
  }, [camera, phone, size.width, size.height, left, top, right, bottom, fill, plateY, max]);
  return null;
}

/** A clear winter night: a cool moon from behind the camera, the tall lantern's warm pool over the back corner and a small one at the front-right corner. */
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
      {/* The small corner lantern: half the gate lantern's light, reaching 2.5 m at most (V3 9.4), so it lights its own corner and not the snow before the gate. */}
      <pointLight position={[PEN.cornerLamp[0] + 0.3, PEN.cornerLamp[1] + 0.1, PEN.cornerLamp[2] + 0.3]} color={LANTERN_LIGHT.color} intensity={2.5} distance={2.5} decay={LANTERN_LIGHT.decay} />
    </>
  );
}

function Place({ max, opening, reduced }: { max: number; opening: boolean; reduced: boolean }) {
  const w = useMemo(() => buildPen(), []);
  const m = useMemo(() => buildMats(max), [max]);
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 1.4 }), []);
  // The corner lantern glows under BLOOM_THRESHOLD (table/Rendering.tsx): lit, but no bloom (V3 9.4).
  const dimGlow = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 0.3 }), []);
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
      <mesh geometry={w.dimGlow} material={dimGlow} />
      <mesh geometry={w.drift} material={mat} receiveShadow />
      <mesh geometry={m.mats} material={mat} receiveShadow />
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
function Animal({ guest, seat, max, reduced, opening, plate, leaving = false }: {
  guest: PenGuest; seat: number; max: number; reduced: boolean; opening: boolean; plate?: RefObject<HTMLDivElement | null>; leaving?: boolean;
}) {
  const group = useRef<Group>(null), body = useRef<Group>(null);
  const at = useRef<PenPace | null>(null);
  useFrame(({ clock }, dt) => {
    const g = group.current, b = body.current;
    if (!g || !b) return;
    const p = penStep(at.current, seat, max, clock.elapsedTime, dt, { reduced, opening, leaving });
    at.current = p.pace;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw;
    b.scale.set(p.sxz, p.sy, p.sxz);
  });
  const c = byId(guest.avatar);
  const admin = isAdminAvatar(guest.avatar);
  const model = c ? animalModel(c.animal) : undefined;
  const start = matSpot(seat, max);
  return (
    <group ref={group} position={[start.x, MATS.top, start.z]} rotation={[0, start.yaw, 0]}>
      <group ref={body}>
        <group scale={SHEEP_SCALE * (admin ? 1 : (model ?? animalModel('sheep')).drawScale)} position={standOffset(guest.avatar)}>
          {admin
            ? <AvatarDisc state="idle" reduced={reduced} still avatar={guest.avatar} />
            : <Sheep level={2} state="idle" reduced={reduced} lookAt={opening ? undefined : 'camera'} model={model} />}
          {plate && <ScreenAnchor el={plate} position={penPlate(guest.avatar)} above cull={false} snap />}
        </group>
      </group>
    </group>
  );
}

/**
 * How far to set the model back so its hooves stand centred on the group's origin, in the group's parent (metres): a
 * model's legs are not centred on its origin (the sheep's stood 0.085 m off it, the pig's 0.12 m), so an animal stood
 * off its mat's centre. The plate rides inside the moved group and keeps over the head.
 */
export function standOffset(avatar: string | null | undefined): [number, number, number] {
  if (isAdminAvatar(avatar)) return [0, 0, 0];
  const m = animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep'), k = SHEEP_SCALE * m.drawScale;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const l of m.legs) {
    if (!l.geo.getAttribute('position')?.count) continue; // the hen has two legs; the other two are empty
    l.geo.computeBoundingBox();
    const b = l.geo.boundingBox!;
    x0 = Math.min(x0, b.min.x + l.pivot[0]); x1 = Math.max(x1, b.max.x + l.pivot[0]);
    z0 = Math.min(z0, b.min.z + l.pivot[2]); z1 = Math.max(z1, b.max.z + l.pivot[2]);
  }
  return [-((x0 + x1) / 2) * k, 0, -((z0 + z1) / 2) * k];
}

/**
 * Where the plate's bottom centre stands, in the animal's scaled group (V3 9.3): over the hat's tip, 0.12 of the animal's
 * height (hat included) above it. An admin's photo is as tall as this device draws it: its plate goes over the picture's
 * real top. (The table's plate point stops at the 2026-11-08 head height, which left the pen's plate halfway down a
 * long forehead, beside the face rather than over it.)
 */
export function penPlate(avatar: string | null | undefined): [number, number, number] {
  if (isAdminAvatar(avatar)) return [0, 1.12 * pictureHeight(getKaiyanLook(avatar).length), 0];
  const a = anchorsOf(animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep'));
  return [a.hatTip[0], a.hatTip[1] + 0.12 * a.top, a.hatTip[2]];
}
