import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ACESFilmicToneMapping, Color, FogExp2, Group, Object3D, PCFSoftShadowMap, SpotLight, SRGBColorSpace, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { buildDuel, DUEL, duelSeat, duelShot } from '../scene/duel';
import { buildDuelFestive } from '../scene/festive';
import { SHEEP_SCALE } from '../scene/layout';
import { Sky } from '../scene/Sky';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { Bomb } from './BarnTable';
import type { BarnTableProps } from './BarnTable';
import { DevStats } from './DevStats';
import { Festive } from './Festive';
import { Effects, LANTERN_LIGHT } from './Rendering';
import { Sheep } from './Sheep';

const DARK = '#14233C';
const CALM = new Color('#FFD9A0');
const DANGER = new Color('#FF5A3C');

/** How close your clock is to running out: 0 to 1, on your turn only, so the bot's quick turns don't pump the camera. */
const pressureOf = (speaker: number | null, fraction: number) => (speaker === 0 ? Math.min(1, Math.max(0, 1 - fraction)) : 0);

/**
 * The practice run's stage: you and the bot face to face on the ice (src/skin/scene/duel.ts). It takes the barn's props
 * so the game screen can swap it in, and has no pile, ring or speaker swing: only the two of them and the bomb.
 */
export function DuelTable({ bombSize, seats, speaker, fraction, secondsLeft, letter, isTrap, reduced, phone, moments }: BarnTableProps) {
  const open = duelShot(null, 0, phone);
  const [pop, setPop] = useState(false);
  const pulseKey = moments.tuftIn?.key;
  useEffect(() => {
    if (pulseKey === undefined) return;
    setPop(true);
    const id = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(id);
  }, [pulseKey]);
  const heat = Math.max(0, pressureOf(speaker, fraction) - 0.5) * 2;
  return (
    <div className="relative size-full" style={{ background: DARK }}>
      <Canvas
        // Measured without transforms: the game screen zooms in as it opens, which would size the canvas too big for good.
        resize={{ offsetSize: true }}
        shadows={{ type: PCFSoftShadowMap }}
        dpr={phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
        camera={{ fov: open.fov, position: open.position, near: 0.1, far: 900 }}
        onCreated={({ camera }) => camera.lookAt(open.target[0], open.target[1], open.target[2])}
      >
        <Duel bombSize={bombSize} seats={seats} speaker={speaker} fraction={fraction} secondsLeft={secondsLeft} reduced={reduced} phone={phone} boomKey={moments.boom?.key} power={moments.boom?.power} />
      </Canvas>
      {/* The edges of the screen close in red over the last half of your clock. */}
      <div className="pointer-events-none absolute inset-0 z-[4]" style={{ opacity: heat, background: 'radial-gradient(ellipse at center, transparent 42%, rgba(170, 24, 14, 0.8) 100%)' }} aria-hidden="true" />
      <div className={`pointer-events-none absolute left-1/2 z-[25] -translate-x-1/2 ${phone ? 'top-28' : 'top-20'}`}>
        <div className={`sk-letter-card ${pop ? 'sk-letter-pop' : ''}`} data-trap={isTrap || undefined} data-chain-tile aria-label={`Required starting letter ${letter.toUpperCase()}`}>
          <span className="sk-letter-card-label">starts with</span>
          <span className="sk-letter-card-letter">{letter.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

type DuelProps = Pick<BarnTableProps, 'bombSize' | 'seats' | 'speaker' | 'fraction' | 'secondsLeft' | 'reduced' | 'phone'> & { boomKey: number | undefined; power: number | undefined };

function Duel({ bombSize, seats, speaker, fraction, secondsLeft, reduced, phone, boomKey, power }: DuelProps) {
  const pressure = pressureOf(speaker, fraction);
  return (
    <>
      <DuelCamera speaker={speaker} pressure={pressure} phone={phone} reduced={reduced} />
      <Night />
      <Spotlight speaker={speaker} pressure={pressure} reduced={reduced} />
      <Sky hour="night" reduced={reduced} blizzard={false} />
      <Place />
      <Festive geo={buildDuelFestive()} reduced={reduced} />
      <Bomb speaker={speaker} n={2} fraction={fraction} red={pressure > 0.7} reduced={reduced} boomKey={boomKey} secondsLeft={secondsLeft} size={Math.min(bombSize ?? 1, DUEL.maxBomb)} power={power ?? 1} seatAt={duelSeat} />
      {seats.map((s) => {
        const other = duelSeat(s.seat === 0 ? 1 : 0);
        const model = byId(s.avatar);
        return (
          <Stand key={s.seat} seat={s.seat} active={s.index === speaker} reduced={reduced} drawScale={s.avatar === ADMIN_AVATAR_ID ? 1 : animalModel(model?.animal ?? 'sheep').drawScale}>
            {s.avatar === ADMIN_AVATAR_ID ? (
              <AvatarDisc state={s.thinking && s.state === 'idle' ? 'thinking' : s.state} stateKey={s.stateKey} dimmed={s.dimmed} reduced={reduced} speaking={s.index === speaker} />
            ) : (
              <Sheep level={s.level} state={s.state} stateKey={s.stateKey} coldFor={s.coldFor} dimmed={s.dimmed} reduced={reduced} scarf={s.scarf}
                gustFrom={[0, 0.8, -6]} lookAt={[other.x, 0.85 * SHEEP_SCALE, other.z]} speaking={s.index === speaker} thinking={s.thinking}
                model={model ? animalModel(model.animal) : undefined} />
            )}
            {/* Behind the shoulders, clear of the bomb overhead and of the gap between the two faces. */}
            <Html position={[0, 1.45, -0.75]} center zIndexRange={[20, 0]}>{s.label}</Html>
          </Stand>
        );
      })}
      <Effects />
      <DevStats />
    </>
  );
}

/** Black water and a thick night: the fog takes everything past the lake, so the ice is all there is. */
function Night() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new FogExp2(DARK, 0.024);
    scene.background = new Color(DARK);
  }, [scene]);
  return (
    <>
      <hemisphereLight args={['#8FA6C8', '#2A3448', 1.1]} />
      {/* The moon stands behind the camera, so the two faces and the bomb read against the dark. */}
      <directionalLight
        position={[-6, 12, -16]} color="#C9D8F0" intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={1} shadow-camera-far={60}
      />
      {DUEL.lamps.map((p, i) => <pointLight key={i} position={[p[0], p[1], p[2]]} color={LANTERN_LIGHT.color} intensity={14} distance={9} decay={LANTERN_LIGHT.decay} />)}
    </>
  );
}

/** A hard light from above that finds whoever is on turn, and burns red as your clock runs out. */
function Spotlight({ speaker, pressure, reduced }: { speaker: number | null; pressure: number; reduced: boolean }) {
  const spot = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    const s = spot.current;
    if (!s) return;
    const x = speaker === null ? 0 : duelSeat(speaker).x;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
    s.position.x += (x - s.position.x) * k;
    target.position.x = s.position.x;
    s.color.lerpColors(CALM, DANGER, Math.max(0, pressure - 0.4) / 0.6);
  });
  return (
    <>
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight ref={spot} position={[0, 8, -0.6]} target={target} color="#FFD9A0" intensity={170} angle={0.3} penumbra={0.55} distance={14} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    </>
  );
}

function Place() {
  const w = useMemo(() => buildDuel(), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 1.3 }), []);
  return (
    <>
      <mesh geometry={w.ice} material={mat} castShadow receiveShadow />
      <mesh geometry={w.water} material={mat} position={[0, DUEL.waterY, 0]} receiveShadow />
      <mesh geometry={w.floes} material={mat} receiveShadow />
      <mesh geometry={w.shore} material={mat} />
      <mesh geometry={w.pines} material={mat} />
      <mesh geometry={w.posts} material={mat} castShadow />
      <mesh geometry={w.glow} material={glow} />
    </>
  );
}

/** A sheep on its mark, stepping 0.35 m toward the other on its turn. */
function Stand({ seat, active, reduced, drawScale, children }: { seat: number; active: boolean; reduced: boolean; drawScale: number; children: ReactNode }) {
  const g = useRef<Group>(null);
  const p = duelSeat(seat);
  const want = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    if (!g.current) return;
    want.set(p.x - Math.sign(p.x) * (active ? 0.35 : 0), 0, p.z);
    g.current.position.lerp(want, reduced ? 1 : 1 - Math.exp(-dt * 6));
  });
  return <group ref={g} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE * drawScale}>{children}</group>;
}

/** The side-on camera: it eases toward the shot for this turn and this much pressure, and shakes in your last moments. */
function DuelCamera({ speaker, pressure, phone, reduced }: { speaker: number | null; pressure: number; phone: boolean; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aim = useMemo(() => new Vector3(), []);
  const seen = useMemo(() => ({ started: false, target: new Vector3() }), []);
  useFrame(({ clock }, dt) => {
    // Reduced motion holds one steady shot per turn: no push-in, no shake.
    const shot = duelShot(speaker, reduced ? 0 : pressure, phone);
    const k = reduced || !seen.started ? 1 : 1 - Math.exp(-dt * 3.5);
    seen.started = true;
    aim.set(shot.position[0], shot.position[1], shot.position[2]);
    camera.position.lerp(aim, k);
    aim.set(shot.target[0], shot.target[1], shot.target[2]);
    seen.target.lerp(aim, k);
    const shake = reduced ? 0 : Math.max(0, pressure - 0.7) * 0.09;
    const t = clock.elapsedTime * 31;
    camera.lookAt(seen.target.x + Math.sin(t) * shake, seen.target.y + Math.cos(t * 1.3) * shake, seen.target.z);
    if (camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
  });
  return null;
}
