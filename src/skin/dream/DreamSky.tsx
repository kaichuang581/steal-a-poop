import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, PlaneGeometry, PointsMaterial, SphereGeometry,
  BufferGeometry,
} from 'three';
import type { Mesh } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import type { Shot } from './stage';
import { atFrame, moonFrame, SKY_STOPS } from './stage';

const SKY_R = 420;
const MOON = { colour: '#FFF1B8', across: 4.5, z: -130 };
/** The plan's 0.30 lifts the sky past gate G1 at (80, 8), so the ribbons are fainter. */
const AURORA = { colours: ['#F2A7D8', '#8FE3D9'] as const, opacity: 0.07, z: -150 };

function skyColour(deg: number, out: Color, a: Color, b: Color): Color {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [d1, c1] = SKY_STOPS[i];
    if (deg > d1) continue;
    const [d0, c0] = SKY_STOPS[i - 1];
    return out.copy(a.set(c0)).lerp(b.set(c1), (deg - d0) / (d1 - d0));
  }
  return out.set(SKY_STOPS[SKY_STOPS.length - 1][1]);
}

/** The dream's sky (V4.1 Part 4.3): the gradient, stars, a cream crescent moon with its halo, and a faint aurora. */
export function DreamSky({ shot, reduced }: { shot: Shot; reduced: boolean }) {
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  return (
    <>
      <Dome shot={shot} />
      <Stars shot={shot} reduced={reduced} />
      <Moon shot={shot} aspect={aspect} />
      <Aurora shot={shot} aspect={aspect} reduced={reduced} />
    </>
  );
}

function Dome({ shot }: { shot: Shot }) {
  const { geo, mat } = useMemo(() => {
    const geo = new SphereGeometry(SKY_R, 32, 180);
    const pos = geo.getAttribute('position'), col = new Float32Array(pos.count * 3);
    const c = new Color(), a = new Color(), b = new Color();
    for (let i = 0; i < pos.count; i++) {
      skyColour((Math.asin(pos.getY(i) / SKY_R) * 180) / Math.PI, c, a, b);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    return { geo, mat: new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false, toneMapped: false }) };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} position={[...shot.position]} renderOrder={-10} />;
}

/**
 * 180 stars. The plan keeps them to the top of the dome, but the camera never looks that high, so they are spread over
 * the part of the sky it does see. A third twinkle; the rest hold still, so the sky never goes out.
 */
function Stars({ shot, reduced }: { shot: Shot; reduced: boolean }) {
  const sets = useMemo(() => [120, 60].map((n, k) => {
    const p = new Float32Array(n * 3);
    let seed = 7 + k * 31;
    const look = Math.atan2(shot.target[0] - shot.position[0], shot.position[2] - shot.target[2]);
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const az = look + (r() - 0.5) * 1.1, el = (7 + r() * 6) * (Math.PI / 180), R = SKY_R * 0.95;
      p.set([shot.position[0] + Math.sin(az) * Math.cos(el) * R, shot.position[1] + Math.sin(el) * R, shot.position[2] - Math.cos(az) * Math.cos(el) * R], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, mat: new PointsMaterial({ color: '#FFFFFF', size: 3, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false, toneMapped: false }) };
  }), [shot]);
  useFrame(({ clock }) => { if (!reduced) sets[1].mat.opacity = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 1.4); });
  useEffect(() => () => sets.forEach((s) => (s.geo.dispose(), s.mat.dispose())), [sets]);
  return <>{sets.map((s, i) => <points key={i} geometry={s.geo} material={s.mat} renderOrder={-9} />)}</>;
}

function Moon({ shot, aspect }: { shot: Shot; aspect: number }) {
  // Larger on a phone, where the far layers are further along the camera's line.
  const across = MOON.across * (aspect < 1 ? 1.5 : 1);
  const { disc, discMat, haloMat } = useMemo(() => {
    // A crescent: the disc with a second disc taken out of it from the upper right, cut deep enough to read as a crescent at this size.
    const g = new Grid(0.25), r = across / 2 / 0.25, c = lin(MOON.colour), off = r * 0.85;
    for (let x = -16; x < 16; x++) for (let y = -16; y < 16; y++) {
      const inDisc = (x + 0.5) ** 2 + (y + 0.5) ** 2 <= r * r, bitten = (x + 0.5 - off) ** 2 + (y + 0.5 - off) ** 2 <= r * r;
      if (inDisc && !bitten) g.set(x, y, 0, c);
    }
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const ctx = t.getContext('2d')!, grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,241,184,0.16)');
    grad.addColorStop(1, 'rgba(255,241,184,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return {
      disc: buildGeometry(g.map, 0.25),
      discMat: new MeshBasicMaterial({ color: MOON.colour, fog: false, toneMapped: false }),
      haloMat: new MeshBasicMaterial({ map: new CanvasTexture(t), transparent: true, blending: AdditiveBlending, fog: false, depthWrite: false, toneMapped: false }),
    };
  }, [across]);
  useEffect(() => () => { disc.dispose(); discMat.dispose(); haloMat.map?.dispose(); haloMat.dispose(); }, [disc, discMat, haloMat]);
  const [mx, my] = moonFrame(aspect);
  const at = atFrame(shot, aspect, mx, my, MOON.z);
  const r = across / 2;
  return (
    <group position={at}>
      <mesh material={haloMat} position={[0, 0, -2]}><planeGeometry args={[r * 4.4, r * 4.4]} /></mesh>
      <mesh geometry={disc} material={discMat} />
    </group>
  );
}

/** Two ribbons low on the right of the sky, behind the mountains, drifting. */
function Aurora({ shot, aspect, reduced }: { shot: Shot; aspect: number; reduced: boolean }) {
  const ribbons = useMemo(() => [0, 1].map((k) => {
    const left = atFrame(shot, aspect, 52 + k * 8, 16, AURORA.z), right = atFrame(shot, aspect, 100 + k * 4, 16, AURORA.z), top = atFrame(shot, aspect, 70, 4 + k * 2, AURORA.z);
    const w = right[0] - left[0], h = top[1] - left[1];
    const geo = new PlaneGeometry(w, h, 48, 5);
    const pos = geo.getAttribute('position'), n = pos.count, col = new Float32Array(n * 4);
    const a = new Color(AURORA.colours[0]), b = new Color(AURORA.colours[1]), c = new Color();
    for (let i = 0; i < n; i++) {
      const u = pos.getX(i) / w + 0.5, v = pos.getY(i) / h + 0.5;
      c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(u * 6 + k * 2));
      col.set([c.r, c.g, c.b, Math.sin(Math.PI * v) ** 1.5 * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(u * 11 + k))], i * 4);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 4));
    return { geo, base: Float32Array.from(pos.array as Float32Array), at: [left[0] + w / 2, left[1] + h / 2, AURORA.z] as [number, number, number], k };
  }), [shot, aspect]);
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: AURORA.opacity, side: DoubleSide, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }), []);
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    for (const r of ribbons) {
      const pos = r.geo.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setY(i, r.base[i * 3 + 1] + Math.sin(r.base[i * 3] * 0.05 + t * 0.3 + r.k) * 0.9);
      pos.needsUpdate = true;
    }
  });
  useEffect(() => () => { ribbons.forEach((r) => r.geo.dispose()); mat.dispose(); }, [ribbons, mat]);
  return <>{ribbons.map((r, i) => <mesh key={i} ref={(el) => { refs.current[i] = el; }} geometry={r.geo} material={mat} position={r.at} renderOrder={-8} />)}</>;
}
