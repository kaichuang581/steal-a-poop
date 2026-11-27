import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { AdditiveBlending, BoxGeometry, CanvasTexture, Color, Fog, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { PerspectiveCamera } from 'three';
import { FESTIVE } from '../../../config';
import { byId } from '../../avatars/catalog';
import { isAdminAvatar } from '../../../avatars/ids';
import { LOOK } from '../../look';
import { getTier } from '../../perf/tier';
import { SceneBoundary } from '../../perf/SceneBoundary';
import { SHEEP_SCALE } from '../../scene/layout';
import { AdaptiveCanvas, MarkDrawn } from '../../table/Rendering';
import { Sheepdog } from '../../table/places';
import { Sheep } from '../../table/Sheep';
import type { SheepState } from '../../table/Sheep';
import { turnClockDrawn } from '../../model/turnClock';
import { animalModel } from '../../voxel/animals';
import { tokenColour, toGeometry } from '../../dream/models';
import { GLOW } from '../../dream/models.gen';
import { makeBomb, skinOf } from '../bomb';
import { burstKeyOf, makeBurst } from '../burst';
import { placeShiftCamera } from '../camera';
import { partBit, tpMesh, tpObject } from '../models';
import { TIMINGS } from '../models.gen';
import { RINK } from '../rink.gen';
import { BOARD_H, BOARD_W, drawBoard } from './board';
import type { BoardState } from './board';
import { buildRink, tintAt } from './scene';
import type { Glow } from './scene';

/**
 * Practice's place (docs/trading-post-practice P1 to P4): the farm's pond swept into a rink, seen by the level shift
 * camera. You stand at x -1.7, the bot at +1.7; the worn bomb sits by whoever holds it and hops across on every word;
 * the coach, the game's own sheepdog, sits on a high chair by the chalkboard. The board's face is a canvas (board.ts);
 * everything a player reads off the scene (plates, bubbles, the coach's words, the tile rack) is HTML pinned to
 * projected points by `RinkPins`.
 */
export const RINK_CAM = { CAM: 9, run: { eye: 2.7, A: 210, line: 0.7 }, report: { eye: 4.8, A: 420, line: 1.75 }, phone: { A: 0.21, Areport: 0.577, lineReport: 1.09 } } as const;
/** The phone's tile strip over the keyboard, px: the scene is laid out in the height above it. */
export const PHONE_RACK_PX = 64;
const SIDE = RINK.sheep_x_m;
/** The night's stars in the top of the sky: fixed places on a golden-angle walk, so the sky is the same every run. */
const STARS: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [((i * 61.8) % 100), 2 + ((i * 38.2) % 40), i % 4 ? 2 : 3]);

export interface RinkCamState {
  /** performance.now() the crane up to the report began, or null during the run. */
  craneAt: number | null;
  /** performance.now() of the last bang, for the 6 px shake. */
  shakeAt: number;
}

/** The camera numbers for a window at crane share `u` (0 the run, 1 the report). */
export function rinkCamera(W: number, H: number, phone: boolean, u: number, visibleH = H): { A: number; eye: number; line: number } {
  const { run, report, phone: ph } = RINK_CAM;
  const fit = Math.min(W / 1440, H / 900);
  const A0 = phone ? ph.A * W : run.A * fit, A1 = phone ? ph.Areport * W : report.A * fit;
  const below = phone ? visibleH - PHONE_RACK_PX : H;
  const line0 = (run.line * below) / H, line1 = phone ? (ph.lineReport * visibleH) / H : report.line;
  const e = u * u * (3 - 2 * u);
  return { A: A0 + (A1 - A0) * e, eye: run.eye + (report.eye - run.eye) * e, line: line0 + (line1 - line0) * e };
}

export interface RinkSceneProps {
  /** Seat 0 is you, seat 1 the bot. */
  states: [{ state: SheepState; key: number }, { state: SheepState; key: number }];
  avatar: string | null;
  bot: 'easy' | 'medium' | 'hard';
  /** Who holds the bomb: 0, 1, or null between turns. */
  holder: number | null;
  /** The worn skin and burst (catalogue ids). */
  bomb: string; blast: string;
  boomKey: number | undefined;
  /** The seat that went off, for the ice block. */
  frozenSeat: number | null;
  frozenAt: number;
  board: RefObject<BoardState>;
  cam: RefObject<RinkCamState>;
  /** The coach's moments: when he last blew (and how many times), when he turned to the clock, whether he leans in. */
  coach: RefObject<{ blowAt: number; blows: number; lookAt: number; lean: boolean }>;
  pins: Pin[];
  reduced: boolean;
  phone: boolean;
  fps?: number;
}

/**
 * An HTML element pinned to a scene point by its bottom centre ('above'), its centre, its right middle ('left', it
 * stands to the left of the point), its top centre ('below') or its bottom left ('foot'). 'above' and 'left' keep it
 * 10 px inside the window. `depthVar` writes the px per metre at that depth into --rk-a.
 */
export interface Pin { el: RefObject<HTMLElement | null>; at: () => readonly [number, number, number] | null; mode: 'above' | 'centre' | 'left' | 'below' | 'foot'; depthVar?: boolean }

export function RinkTable(p: RinkSceneProps) {
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(${RINK.sky.top}, ${RINK.sky.mid} 55%, ${RINK.sky.horizon})` }}>
      {STARS.map(([x, y, s], i) => <i key={i} className="rk-star" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s }} />)}
      <SceneBoundary scene="the rink">
        <AdaptiveCanvas maxDpr={p.phone ? 1.5 : 2} memory="rink" fps={p.fps}
          resize={{ offsetSize: true }}
          gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: true, alpha: true }}
          camera={{ position: [0, 2.7, 9], near: 0.5, far: 400 }}
        >
          <MarkDrawn />
          <Rink {...p} />
        </AdaptiveCanvas>
      </SceneBoundary>
    </div>
  );
}

const flat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const glowMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });

function Rink(p: RinkSceneProps) {
  const scene = useThree((s) => s.scene);
  const low = useMemo(() => getTier() === 'low', []);
  const built = useMemo(() => buildRink(FESTIVE, low), [low]);
  useEffect(() => { scene.fog = new Fog(RINK.sky.fog, RINK.fog.start_m, RINK.fog.end_m / RINK.fog.most); scene.background = null; }, [scene]);
  return (
    <>
      <RinkCamera cam={p.cam} phone={p.phone} reduced={p.reduced} pins={p.pins} />
      {/* The night's light for the animals (P1 section 4): a cool sky over a dark ground, a moon from in front. */}
      <hemisphereLight args={['#A9BCF0', '#2A3150', 1.35]} />
      <directionalLight position={[-3, 6, 8]} color="#C9D6F5" intensity={1.1} />
      <mesh geometry={built.lit} material={flat} />
      <mesh geometry={built.glow} material={glowMat} />
      <Glows glows={built.glows} reduced={p.reduced} />
      <Board board={p.board} reduced={p.reduced} />
      <Coach coach={p.coach} reduced={p.reduced} />
      <Duellists {...p} />
      <RinkBomb {...p} />
    </>
  );
}

/** The level camera, the crane to the report and the bang's shake; then every pinned element moved to its point. */
function RinkCamera({ cam, phone, reduced, pins }: { cam: RefObject<RinkCamState>; phone: boolean; reduced: boolean; pins: Pin[] }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useFrame(({ size }) => {
    const c = cam.current!, now = performance.now();
    const u = c.craneAt === null ? 0 : reduced ? 1 : Math.min(1, (now - c.craneAt) / TIMINGS.practice.report.camera_crane_ms);
    const visible = phone && typeof visualViewport !== 'undefined' && visualViewport ? Math.min(size.height, visualViewport.height) : size.height;
    const { A, eye, line } = rinkCamera(size.width, size.height, phone, u, visible);
    const sk = reduced ? 0 : Math.max(0, 1 - (now - c.shakeAt) / TIMINGS.burst.shake_ms);
    const shake = sk > 0 ? (TIMINGS.burst.shake_px * sk * Math.sin(now / 17)) / A : 0;
    placeShiftCamera(camera, A, size.width, size.height, eye, RINK_CAM.CAM, line, shake);
    const horizon = line * size.height - A * eye;
    for (const pin of pins) place(pin, shake, eye, horizon, size.width, A);
  }, -1);
  return null;
}

function place(pin: Pin, camX: number, eye: number, horizon: number, W: number, A: number) {
  const node = pin.el.current, at = pin.at();
  if (!node) return;
  if (!at) { if (node.style.visibility !== 'hidden') node.style.visibility = 'hidden'; return; }
  if (node.style.visibility) node.style.visibility = '';
  // Straight from the plan's mapping (P1 section 2): the camera never turns, so x and y follow from the depth alone.
  const k = RINK_CAM.CAM / (RINK_CAM.CAM - at[2]);
  let x = W / 2 + A * (at[0] - camX) * k;
  const y = horizon - A * (at[1] - eye) * k, w = node.offsetWidth;
  if (pin.mode === 'above') x = Math.min(Math.max(x, w / 2 + 10), W - w / 2 - 10);
  if (pin.mode === 'left') x = Math.max(x, w + 10);
  const tx = { above: ' translate(-50%, -100%)', centre: ' translate(-50%, -50%)', left: ' translate(-100%, -50%)', below: ' translate(-50%, 0)', foot: ' translate(0, -100%)' }[pin.mode];
  node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)${tx}`;
  if (pin.depthVar) node.style.setProperty('--rk-a', (A * k).toFixed(2));
}

/** Lantern glows: soft sprites, never real lights (P1 section 4), breathing a little. */
function Glows({ glows, reduced }: { glows: Glow[]; reduced: boolean }) {
  const tex = useMemo(() => radial(), []);
  const sprites = useMemo(() => glows.map((g) => {
    const s = new Sprite(new SpriteMaterial({ map: tex, color: new Color(...g.rgb), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: g.strength, toneMapped: false, fog: false }));
    s.position.set(...g.at); s.scale.setScalar(g.radius * 2);
    return s;
  }), [glows, tex]);
  useFrame(({ clock }) => { if (!reduced) for (const [i, s] of sprites.entries()) (s.material as SpriteMaterial).opacity = glows[i].strength * (0.96 + 0.04 * Math.sin(clock.elapsedTime * 2.1)); });
  return <>{sprites.map((s, i) => <primitive key={i} object={s} />)}</>;
}
function radial(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The chalkboard: the model without its cards, and the face's canvas laid over it, redrawn only while something moves. */
function Board({ board, reduced }: { board: RefObject<BoardState>; reduced: boolean }) {
  const { group, canvas, tex } = useMemo(() => {
    const g = new Group();
    const mm = tpMesh('tallyBoard', { festive: FESTIVE, parts: partBit('body', 'face', ...(FESTIVE ? ['season'] : [])) });
    const lit = toGeometry(mm.lit);
    relightGeo(lit, tintAt(-4.3));
    g.add(new Mesh(lit, flat));
    if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), glowMat));
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_W; canvas.height = BOARD_H;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new Mesh(new PlaneGeometry(2.4, 1.2), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false }));
    face.position.set(0, 2.1, 0.06);
    g.add(face);
    g.position.set(0, 0, -4.3);
    return { group: g, canvas, tex };
  }, []);
  const last = useRef<{ s: BoardState | null; moving: boolean; fonts: number }>({ s: null, moving: false, fonts: 0 });
  useEffect(() => { void document.fonts?.ready.then(() => { last.current.fonts++; last.current.s = null; }); }, []);
  useFrame(() => {
    const s = board.current;
    if (!s) return;
    const l = last.current;
    if (s === l.s && !l.moving) return;
    l.moving = drawBoard(canvas.getContext('2d')!, s, performance.now(), reduced);
    l.s = s;
    tex.needsUpdate = true;
  });
  return <primitive object={group} />;
}

/** The board's own mesh keeps the night's face light, as the rest of the rink does (scene.ts). */
function relightGeo(g: ReturnType<typeof toGeometry>, tint: number) {
  const col = g.getAttribute('color'), nor = g.getAttribute('normal');
  const L = RINK.light;
  for (let i = 0; i < col.count; i++) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const l = ny > 0.5 ? L.top : ny < -0.5 ? L.bottom : Math.abs(nz) > 0.5 ? L.front : nx < 0 ? L.left : L.right;
    const s = ny > 0.5 ? 1 : ny < -0.5 ? 0.78 : Math.abs(nx) > 0.5 ? (nx > 0 ? 0.93 : 0.88) : nz > 0 ? 0.91 : 0.86;
    col.setXYZ(i, (col.getX(i) / s) * l[0] * tint, (col.getY(i) / s) * l[1] * tint, (col.getZ(i) / s) * l[2] * tint);
  }
}

/** The sheepdog's size on the chair, and the middle of his length (metres, the model's own, from its hind end). */
const COACH = { scale: 0.75, mid: 0.3 } as const;

/** The coach: the game's sheepdog on the high chair's cushion, facing the ice, his whistle on its cord (P2 section 2). */
function Coach({ coach, reduced }: { coach: RinkSceneProps['coach']; reduced: boolean }) {
  const lean = useRef<Group>(null), whistle = useRef<Group>(null), puffs = useRef<Group>(null);
  const w = useMemo(() => tpObject('whistle', { festive: true }, flat), []);
  const cubes = useMemo(() => [0, 1, 2].map(() => new Mesh(new BoxGeometry(0.03, 0.03, 0.03), new MeshBasicMaterial({ color: '#F3EEE6', toneMapped: false, transparent: true }))), []);
  useFrame(() => {
    const c = coach.current!, now = performance.now();
    if (lean.current) {
      const want = c.lean && !reduced ? -0.105 : 0; // 6 degrees forward, toward +x
      lean.current.rotation.z += (want - lean.current.rotation.z) * 0.2;
      lean.current.rotation.y = !reduced && now - c.lookAt < 400 ? -0.35 : 0;
    }
    // The whistle rises to the mouth over 150 ms, holds 300 ms, drops; twice for the bang, 250 ms apart.
    const { whistle_raise_ms: up, whistle_hold_ms: hold, puff_ms } = TIMINGS.practice.speed_up;
    let lift = 0, puffT = -1;
    for (let b = 0; b < c.blows; b++) {
      const e = now - c.blowAt - b * (up + hold + 250);
      if (e >= 0 && e < up * 2 + hold) lift = Math.max(lift, e < up ? e / up : e < up + hold ? 1 : 1 - (e - up - hold) / up);
      if (e >= up && e < up + puff_ms) puffT = (e - up) / puff_ms;
    }
    if (whistle.current) whistle.current.position.set(-1.9, 2.0 + lift * 0.12, -3.2);
    if (puffs.current) {
      puffs.current.visible = puffT >= 0 && !reduced;
      cubes.forEach((m, i) => { m.position.set(0.18 + puffT * (0.15 + i * 0.05), 0.08 + puffT * (0.05 * (i - 1)), 0); (m.material as MeshBasicMaterial).opacity = 1 - puffT; });
    }
  });
  return (
    <>
      <group ref={lean} position={[-2.15, 1.75, -3.35]}>
        {/* He stands on the 0.7 m seat, not past it: the model is 0.92 m nose to tail from its hind end, so at 0.75 it is
            0.69 m long, centred on the cushion (Brian, 2026-11-25: "the dog is floating"). */}
        <Sheepdog reduced={reduced} at={[-COACH.mid * COACH.scale, 0, 0]} yaw={Math.PI / 2} scale={COACH.scale} />
      </group>
      <group ref={whistle}>
        <primitive object={w} />
        <group ref={puffs}>{cubes.map((m, i) => <primitive key={i} object={m} />)}</group>
      </group>
    </>
  );
}

/** You and the bot, face to face, the bot in its bib (P3 section 1), each standing in its chalk ring. */
function Duellists({ states, avatar, bot, frozenSeat, frozenAt, reduced, cam }: RinkSceneProps) {
  const you = byId(avatar ?? undefined);
  const youModel = !isAdminAvatar(avatar) && you ? animalModel(you.animal) : undefined;
  const bib = useMemo(() => tpObject(`bib${bot[0].toUpperCase()}${bot.slice(1)}`, { festive: true }, flat), [bot]);
  return (
    <>
      {[0, 1].map((seat) => {
        const x = seat === 0 ? -SIDE : SIDE, model = seat === 0 ? youModel : undefined;
        const scale = SHEEP_SCALE * (model ? animalModel(you!.animal).drawScale : 1);
        return (
          <group key={seat} position={[x, 0, 0]} rotation={[0, seat === 0 ? Math.PI / 2 : -Math.PI / 2, 0]} scale={scale}>
            <Sheep level={4} state={states[seat].state} stateKey={states[seat].key} reduced={reduced} block={false}
              lookAt={[seat === 0 ? SIDE : -SIDE, 0.85 * SHEEP_SCALE, 0]} model={model} />
            {/* The bib, fitted to this sheep's body box: the pack's stand-in faced +x with its sides to the camera (z); this
                one faces +z, so the bib turns a quarter round, its panels a little wider than the wool and its top on the back. */}
            {seat === 1 && <primitive object={bib} rotation={[0, Math.PI / 2, 0]} position={[0, 0.08, -0.05]} scale={[0.8, 0.64, 1.1]} />}
          </group>
        );
      })}
      <IceBlock seat={frozenSeat} at={frozenAt} reduced={reduced} cam={cam} />
    </>
  );
}

/** The fitted ice block (P3 section 7): frost edges, a snow cap and icicles, clear faces at 22% of ice 0; it grows from the hooves up in 260 ms. */
function IceBlock({ seat, at, reduced, cam }: { seat: number | null; at: number; reduced: boolean; cam: RefObject<RinkCamState> }) {
  const g = useMemo(() => {
    const root = new Group();
    root.add(tpObject('iceBlock', { festive: true }, flat));
    const glass = new Mesh(new BoxGeometry(1.4, 1.5, 0.8), new MeshBasicMaterial({ color: new Color(...tokenColour('ice:0', GLOW)), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
    glass.position.y = 0.8;
    root.add(glass);
    return root;
  }, []);
  useFrame(() => {
    // Gone once the camera has craned up to the report: its snow cap would otherwise clip the window's lower corner.
    const crane = cam.current!.craneAt;
    g.visible = seat !== null && (crane === null || performance.now() - crane < TIMINGS.practice.report.camera_crane_ms * 0.5);
    if (!g.visible || seat === null) return;
    g.position.set(seat === 0 ? -SIDE : SIDE, 0, 0);
    const k = reduced ? 1 : Math.min(1, (performance.now() - at) / TIMINGS.practice.frozen.ice_grows_ms);
    g.scale.set(1, Math.max(0.001, k), 1);
  });
  return <primitive object={g} />;
}

/** The worn bomb by its holder, hopping across on every turn, its fuse and face live; the worn burst when it goes off. */
function RinkBomb({ holder, bomb, blast, boomKey, cam, coach, reduced }: RinkSceneProps) {
  const b = useMemo(() => makeBomb(skinOf(bomb).key, { lit: flat }), [bomb]);
  const burst = useMemo(() => makeBurst(burstKeyOf(blast), { lit: flat }), [blast]);
  const chips = useMemo(() => {
    const m = new MeshBasicMaterial({ color: new Color(...tokenColour('ice:2', GLOW)), toneMapped: false });
    return [-0.5, -0.32, -0.15, 0.15, 0.32, 0.5].map(() => new Mesh(new BoxGeometry(0.05, 0.05, 0.05), m));
  }, []);
  const st = useRef({ seat: holder, from: 0, to: 0, at: -1e9, boom: boomKey, boomAt: -1e9, bx: 0, spent: false });
  const spotX = (seat: number | null) => (seat === 1 ? RINK.bomb_at_m.bot[0] : RINK.bomb_at_m.player[0]);
  useFrame(() => {
    const s = st.current, now = performance.now(), P = TIMINGS.practice.pass;
    if (boomKey !== s.boom) {
      s.boom = boomKey; s.boomAt = now; s.bx = b.group.position.x; s.spent = true;
      cam.current!.shakeAt = now;
      coach.current!.blowAt = now; coach.current!.blows = 2;
    }
    if (holder !== null && holder !== s.seat) {
      s.from = s.seat === null ? spotX(holder) : spotX(s.seat); s.to = spotX(holder); s.at = now; s.seat = holder;
    }
    const sinceBoom = now - s.boomAt;
    // The bang: the bomb is gone, the burst plays where it stood.
    burst.group.position.set(s.bx, 0, RINK.bomb_at_m.player[2]);
    burst.group.scale.setScalar(1.9); // bigger than the plan's, so the bang carries (Brian, 2026-11-25)
    burst.at(sinceBoom, reduced);
    // Gone from the bang until someone holds a fresh bomb (a run ends on it, so for good there).
    if (holder !== null) s.spent = false;
    const gone = s.spent;
    b.group.visible = !gone;
    const e = now - s.at, u = Math.min(1, e / P.hop_ms);
    let x = s.to, y = 0, sx = 1, sy = 1, ry = 0;
    if (u < 1 && !reduced) {
      x = s.from + (s.to - s.from) * u; y = 4 * P.hop_peak_m * u * (1 - u); ry = Math.PI * 2 * u;
    } else if (reduced && u < 1) {
      x = s.to;
    }
    const land = e - P.hop_ms;
    if (!reduced && land >= 0 && land < P.land_squash_ms) { const k = Math.sin((land / P.land_squash_ms) * Math.PI); sx = 1 + (P.land_squash[0] - 1) * k; sy = 1 + (P.land_squash[1] - 1) * k; }
    // The six ice chips spring from under it as it lands, and are gone in 380 ms.
    const ce = land / P.ice_chip_life_ms;
    const peaks = [0.1, 0.22, 0.3, 0.3, 0.22, 0.1];
    chips.forEach((c, i) => { c.visible = !reduced && ce >= 0 && ce < 1 && !gone; c.position.set(x + [-0.5, -0.32, -0.15, 0.15, 0.32, 0.5][i] * ce, 4 * peaks[i] * ce * (1 - ce), RINK.bomb_at_m.player[2]); });
    const { secondsLeft, fraction } = turnClockDrawn();
    const danger = secondsLeft !== null && secondsLeft <= TIMINGS.bomb.danger_from_s && holder !== null;
    const wob = danger && !reduced ? (TIMINGS.bomb.wobble_deg * Math.PI / 180) * Math.sin(now / 1000 * Math.PI * 2 * TIMINGS.bomb.wobble_hz) : 0;
    b.group.position.set(x, y, RINK.bomb_at_m.player[2]);
    b.group.rotation.set(0, ry, wob);
    b.group.scale.set(sx, sy, sx);
    b.setSeconds(secondsLeft === null ? null : Math.max(0, secondsLeft), danger);
    b.setFuse(holder === null || secondsLeft === null ? 1 : fraction);
    b.setSpark(danger ? TIMINGS.bomb.spark_scale_in_danger : 1);
    coach.current!.lean = danger && holder === 0;
  });
  return (
    <>
      <primitive object={b.group} />
      <primitive object={burst.group} />
      {chips.map((c, i) => <primitive key={i} object={c} />)}
    </>
  );
}
