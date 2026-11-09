import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Group, MeshBasicMaterial, MeshDepthMaterial, MeshLambertMaterial, PlaneGeometry, PointLight, RepeatWrapping, RGBADepthPacking, SRGBColorSpace, Texture, TextureLoader } from 'three';
import photoUrl from '../assets/kaiyan-forehead.png';
import type { SheepState } from '../table/Sheep';
import { DISC, discPose } from './discPose';
import { SLICE, sliceHeights, useKaiyanLook } from './kaiyanLook';

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

/** The picture as three stacked slices (hair, forehead band, face) on one quad, so the band can be stretched to any
 *  length while the hair and face keep their size (src/skin/avatars/kaiyanLook.ts). */
function pictureGeometry(length: number): PlaneGeometry {
  const w = DISC.radius * 2, s = sliceHeights(length), h = s.hair + s.band + s.face;
  const g = new PlaneGeometry(w, h, 1, 3);
  const ys = [h / 2, h / 2 - s.hair, h / 2 - s.hair - s.band, -h / 2];
  const vs = [1, 1 - SLICE.bandTop, 1 - SLICE.bandBottom, 0];
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) { pos.setY(row * 2 + col, ys[row]); uv.setY(row * 2 + col, vs[row]); }
  pos.needsUpdate = true; uv.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/** The forehead's glow (Brian, 2026-11-08: "an insane shine and glow"; 2026-11-09: adjustable, and brighter): a pulsing
 *  halo over the band, both faces, a star of glare streaks on it and a warm light that throws it on the barn. All of
 *  it scales with `glare` (1 = the 2026-11-08 look) and follows the band's length. */
const unitQuad = new PlaneGeometry(1, 1);
let glowTex: Texture | null = null;
function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,252,230,1)'); r.addColorStop(0.3, 'rgba(255,236,170,0.75)'); r.addColorStop(0.65, 'rgba(255,214,120,0.25)'); r.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  glowTex = new CanvasTexture(c); glowTex.colorSpace = SRGBColorSpace;
  return glowTex;
}
let starTex: Texture | null = null;
/** Glare: a long thin streak across and a shorter one up, crossing in a bright core, like light caught on a lens. */
function starTexture(): Texture {
  if (starTex) return starTex;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!;
  const streak = (sx: number, sy: number, a: number) => {
    g.save(); g.translate(N / 2, N / 2); g.scale(sx, sy);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, N / 2);
    r.addColorStop(0, `rgba(255,255,245,${a})`); r.addColorStop(0.25, `rgba(255,240,190,${a * 0.5})`); r.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = r; g.fillRect(-N / 2, -N / 2, N, N); g.restore();
  };
  g.globalCompositeOperation = 'lighter';
  streak(1, 0.035, 1); streak(0.03, 0.7, 0.85); streak(0.18, 0.18, 0.9);
  starTex = new CanvasTexture(c); starTex.colorSpace = SRGBColorSpace;
  return starTex;
}

export function AvatarDisc({ state, stateKey = 0, reduced = false, still = false, dimmed = false, speaking = false, yaw = 0 }: Props) {
  const { length, glare } = useKaiyanLook();
  const tex = useMemo(() => photoTexture(), []);
  const quad = useMemo(() => pictureGeometry(length), [length]);
  useEffect(() => () => quad.dispose(), [quad]);
  // Where the slices sit: the picture's foot stays on the snow however long the band is. It sways, leans and hops about
  // the height its middle had at length 1 (DISC.rest), never the stretched picture's own middle: a pivot that rose with
  // the forehead swung the feet off his spot with every wiggle (Brian, 2026-11-09: "kaiyan gets placed off his position
  // in the start menu when u adjust his size"). At length 1 this is exactly the old motion.
  const s = sliceHeights(length), h = s.hair + s.band + s.face;
  const rest = DISC.rest;
  const lift = h / 2 + 0.02 - rest; // from the pivot up to the picture's middle
  const bandY = h / 2 - s.hair - s.band / 2;
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
  // The whole head lifts a little with the glare, never so much the photo washes out.
  useEffect(() => { for (const m of mats) m.emissiveIntensity = Math.min(0.6, 0.22 + 0.06 * glare); }, [mats, glare]);
  const glow = useMemo(() => new MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  const star = useMemo(() => new MeshBasicMaterial({ map: starTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  useEffect(() => () => { glow.dispose(); star.dispose(); }, [glow, star]);
  // Past 1 the halo burns hotter than white (toneMapped off), so it whites out and catches the bloom.
  useEffect(() => { glow.color.setScalar(glare); star.color.setScalar(Math.max(1, glare * 0.7)); }, [glow, star, glare]);
  const lamp = useRef<PointLight>(null);
  const root = useRef<Group>(null);
  const stars = useRef<Group>(null);
  const anim = useMemo(() => ({ key: -1, state: '' as SheepState, at: 0, phase: Math.random() * 20 }), []);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (anim.key !== stateKey || anim.state !== state) { anim.key = stateKey; anim.state = state; anim.at = t; }
    const moving = !still && !reduced;
    const p = discPose(state, t - anim.at, t, anim.phase, moving, speaking);
    g.position.y = rest + p.lift;
    g.rotation.set(p.rotX, p.rotY + yaw * 0.5, p.rotZ);
    const o = dimmed ? 0.5 : 1;
    for (const m of mats) m.opacity = o;
    const pulse = moving ? 0.5 + 0.5 * Math.sin(t * 3.2) * Math.sin(t * 1.3 + 0.7) : 0.5;
    glow.opacity = (0.3 + 0.25 * pulse) * o;
    star.opacity = Math.min(1, 0.3 * glare) * (0.55 + 0.45 * pulse) * o;
    if (stars.current && moving) stars.current.rotation.z = t * 0.25;
    if (lamp.current) lamp.current.intensity = (4 + 4 * pulse) * glare * o;
  });
  // The halo covers the band and a little more, widening with the glare; the star grows with it.
  const halo: [number, number, number] = [0.95 * (0.85 + 0.15 * glare), s.band * 1.13 + 0.1 * (glare - 1), 1];
  const starSize = 1.2 + 0.7 * glare;
  return (
    <group ref={root} position={[0, rest, 0]}>
      <group position={[0, lift, 0]}>
      <mesh geometry={quad} material={mats[0]} castShadow customDepthMaterial={depth} />
      <mesh geometry={quad} material={mats[1]} rotation={[0, Math.PI, 0]} />
      {glare > 0 && (
        <>
          <mesh geometry={unitQuad} material={glow} scale={halo} position={[0, bandY, 0.02]} />
          <mesh geometry={unitQuad} material={glow} scale={halo} position={[0, bandY, -0.02]} rotation={[0, Math.PI, 0]} />
          <group ref={stars} position={[0, bandY + s.band * 0.2, 0]}>
            <mesh geometry={unitQuad} material={star} scale={[starSize, starSize, 1]} position={[0, 0, 0.03]} />
            <mesh geometry={unitQuad} material={star} scale={[starSize, starSize, 1]} position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]} />
          </group>
        </>
      )}
      {/* Always there (at 0 with no glare), so moving the slider never changes the scene's light count and recompiles. */}
      <pointLight ref={lamp} position={[0, bandY, 0]} color="#FFE6A8" intensity={7 * glare} distance={4.5 * (0.7 + 0.3 * Math.max(1, glare))} decay={2} />
      </group>
    </group>
  );
}
