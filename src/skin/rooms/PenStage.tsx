import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { ACESFilmicToneMapping, Color, FogExp2, PCFShadowMap, SRGBColorSpace } from 'three';
import type { PerspectiveCamera } from 'three';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { SHEEP_SCALE } from '../scene/layout';
import { buildPen, PEN, penShot, penSpot } from '../scene/pen';
import { Sky } from '../scene/Sky';
import { ScreenAnchor } from '../table/Anchors';
import { nameplateY } from '../table/BarnTable';
import { AdaptiveCanvas, Effects, LANTERN_LIGHT } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';

const NIGHT = '#1B2C4A';

export interface PenGuest { id: string; name: string; avatar?: string; you: boolean; host: boolean }

/**
 * The lobby's pen: every player is an animal inside the fence, with a name plank over its head; seats nobody has taken
 * are farm sheep grazing at the back. `shift` moves the pen on screen (a share of the width and height) so the panels
 * laid over the picture do not cover it.
 */
export function PenStage({ guests, farmSheep, reduced, phone, shift }: { guests: PenGuest[]; farmSheep: number; reduced: boolean; phone: boolean; shift: [number, number] }) {
  const shot = penShot(phone);
  // One name plank per player, moved over its animal's head every frame by a ScreenAnchor inside the scene.
  const plates = useRef(new Map<string, RefObject<HTMLDivElement | null>>()).current;
  const plateOf = (id: string) => { let r = plates.get(id); if (!r) plates.set(id, (r = { current: null })); return r; };
  return (
    <div className="absolute inset-0" style={{ background: NIGHT }}>
      <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="pen" resize={{ offsetSize: true }} shadows={{ type: PCFShadowMap }}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: false }}
        camera={{ fov: shot.fov, position: shot.position, near: 0.1, far: 600 }}
        onCreated={({ camera }) => camera.lookAt(shot.target[0], shot.target[1], shot.target[2])}
      >
        <Frame phone={phone} shift={shift} />
        <Night />
        <Sky hour="night" reduced={reduced} blizzard={false} />
        <Place />
        {guests.map((g, i) => <Guest key={g.id} guest={g} index={i} reduced={reduced} plate={plateOf(g.id)} />)}
        {Array.from({ length: farmSheep }, (_, k) => {
          const p = penSpot(9 - k);
          return (
            <group key={`farm-${k}`} position={[p.x, 0, p.z]} rotation={[0, p.yaw + 0.9 * (k % 2 ? 1 : -1), 0]} scale={SHEEP_SCALE}>
              <Sheep level={2} state="grazing" reduced={reduced} />
            </group>
          );
        })}
        <Effects />
      </AdaptiveCanvas>
      <div className="rm-plates" aria-hidden="true">
        {guests.map((g) => (
          <div key={g.id} ref={plateOf(g.id)}><span className={`rm-plate kit-plank kit-plank--label ${g.you ? 'rm-plate--you' : ''}`}>{g.name}{g.host && <i>host</i>}</span></div>
        ))}
      </div>
    </div>
  );
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
    scene.fog = new FogExp2(NIGHT, 0.018);
    scene.background = new Color(NIGHT);
  }, [scene]);
  return (
    <>
      <hemisphereLight args={['#A9BEDD', '#3A4660', 1.25]} />
      <directionalLight
        position={[-7, 12, -14]} color="#D3E0F5" intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-near={1} shadow-camera-far={60}
      />
      <pointLight position={[PEN.lamp[0] + 0.1, PEN.lamp[1], PEN.lamp[2] - 0.7]} color={LANTERN_LIGHT.color} intensity={26} distance={11} decay={LANTERN_LIGHT.decay} />
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
      <mesh geometry={w.land} material={mat} />
      <mesh geometry={w.pines} material={mat} castShadow />
      <mesh geometry={w.fence} material={mat} castShadow receiveShadow />
      <mesh geometry={w.glow} material={glow} />
    </>
  );
}

/** One player's animal on its spot. It hops as it arrives, then stands and looks at you. */
function Guest({ guest, index, reduced, plate }: { guest: PenGuest; index: number; reduced: boolean; plate: RefObject<HTMLDivElement | null> }) {
  const p = penSpot(index);
  const c = byId(guest.avatar);
  const admin = guest.avatar === ADMIN_AVATAR_ID;
  const model = c ? animalModel(c.animal) : undefined;
  // 'happy' for the first moments in the pen, then idle.
  const born = useRef<number | null>(null);
  const state = useRef<'happy' | 'idle'>('happy');
  const key = useRef(0);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    if (state.current === 'happy' && clock.elapsedTime - born.current > 1.6) { state.current = 'idle'; key.current += 1; }
  });
  return (
    <group position={[p.x, 0, p.z]}>
      <group rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE * (admin ? 1 : (model?.drawScale ?? 1))}>
        {admin
          ? <AvatarDisc state="idle" reduced={reduced} />
          : <Sheep level={2} state={reduced ? 'idle' : state.current} stateKey={key.current} reduced={reduced} lookAt="camera" model={model} />}
      </group>
      <ScreenAnchor el={plate} position={[0, nameplateY(guest.avatar) + 0.1, 0]} above cull={false} />
    </group>
  );
}
