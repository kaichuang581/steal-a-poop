import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MeshDepthMaterial, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, RGBADepthPacking, SRGBColorSpace, Texture, TextureLoader } from 'three';
import photoUrl from '../assets/kaiyan.png';
import type { SheepState } from '../table/Sheep';
import { DISC, discPose } from './discPose';

/**
 * The admin avatar at the table or on the farm, in place of the sheep: the photo itself and nothing else, a flat
 * picture with no thickness standing on the snow facing the way the sheep would, the same picture seen from behind.
 * Nothing is drawn around or over it; it only wiggles, hops, leans and turns right round (src/skin/avatars/discPose.ts).
 */
interface Props {
  state: SheepState;
  stateKey?: number;
  reduced?: boolean;
  still?: boolean;
  dimmed?: boolean;
  speaking?: boolean;
  /** The home hero follows the pointer a little (radians). */
  yaw?: number;
}

let photo: Texture | null = null;
function photoTexture(): Texture {
  if (!photo) {
    photo = new TextureLoader().load(photoUrl);
    photo.colorSpace = SRGBColorSpace;
    photo.anisotropy = 4;
  }
  return photo;
}

const quad = new PlaneGeometry(DISC.radius * 2, DISC.radius * 2 * DISC.tall);

export function AvatarDisc({ state, stateKey = 0, reduced = false, still = false, dimmed = false, speaking = false, yaw = 0 }: Props) {
  const tex = useMemo(() => photoTexture(), []);
  const { mats, depth } = useMemo(() => {
    // The back shows the same picture the right way round: a mirrored copy, since the quad is seen from behind.
    const back = tex.clone();
    back.wrapS = RepeatWrapping; back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
    const face = (t: Texture) => new MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.28, transparent: true, alphaTest: 0.5 });
    // The shadow follows the picture's own edge, not the square it is painted on.
    const depth = new MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: RGBADepthPacking });
    return { mats: [face(tex), face(back)], depth };
  }, [tex]);
  useEffect(() => () => { mats.forEach((m) => m.dispose()); depth.dispose(); }, [mats, depth]);
  const root = useRef<Group>(null);
  const anim = useMemo(() => ({ key: -1, state: '' as SheepState, at: 0, phase: Math.random() * 20 }), []);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (anim.key !== stateKey || anim.state !== state) { anim.key = stateKey; anim.state = state; anim.at = t; }
    const p = discPose(state, t - anim.at, t, anim.phase, !still && !reduced, speaking);
    g.position.y = DISC.rest + p.lift;
    g.rotation.set(p.rotX, p.rotY + yaw * 0.5, p.rotZ);
    const o = dimmed ? 0.5 : 1;
    for (const m of mats) m.opacity = o;
  });
  return (
    <group ref={root} position={[0, DISC.rest, 0]}>
      <mesh geometry={quad} material={mats[0]} castShadow customDepthMaterial={depth} />
      <mesh geometry={quad} material={mats[1]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}
