import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, PlaneGeometry, PointsMaterial,
  BufferGeometry,
} from 'three';
import { Vector3 } from 'three';
import type { Mesh } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin } from '../voxel/palette';
import { Grid } from '../voxel/primitives';
import type { DreamView } from './stage';
import { frameMetres, frameToWorld, moonFrame, SKY_STOPS } from './stage';

/** The sky stands far behind everything, flat to the camera (plan file 09, 4.6: restated by frame height). */
const SKY_Z = -400;
/** The moon is 6% of the frame's height across (as today's 62 px of 1,080); its crescent is cut 18 cells across. */
const MOON = { colour: '#FFF1B8', across: 0.06, z: -380 };
/** The plan's 0.30 lifts the sky past gate G1 at (80, 8), so the ribbons are fainter. */
const AURORA = { colours: ['#F2A7D8', '#8FE3D9'] as const, opacity: 0.07, z: -390 };
/** The shake moves the camera 0.03 m: the sky is cut a little larger than the frame. */
const BLEED = 1.06;

/** The sky's colour `f` of the way from the frame's top to the ground line. */
function skyColour(f: number, out: Color, a: Color, b: Color): Color {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [d1, c1] = SKY_STOPS[i];
    if (f > d1) continue;
    const [d0, c0] = SKY_STOPS[i - 1];
    return out.copy(a.set(c0)).lerp(b.set(c1), Math.max(0, (f - d0) / (d1 - d0)));
  }
  return out.set(SKY_STOPS[SKY_STOPS.length - 1][1]);
}

/** The dream's sky (V4.1 Part 4.3): the gradient, stars, a cream crescent moon with its halo, and a faint aurora. */
export function DreamSky({ view, reduced }: { view: DreamView; reduced: boolean }) {
  return (
    <>
      <Dome view={view} />
      <Stars view={view} reduced={reduced} />
      {!reduced && !GATE && <ShootingStar view={view} />}
      <Moon view={view} />
      <Aurora view={view} reduced={reduced} />
    </>
  );
}

/** A world point at a share of the frame, on the plane `z`. */
const at = (view: DreamView, xPct: number, yPct: number, z: number): [number, number, number] => [...frameToWorld(view, xPct, yPct), z];

/** The gradient: a flat backdrop the size of the frame, coloured by height down to the ground line and past it. */
function Dome({ view }: { view: DreamView }) {
  const { geo, mat } = useMemo(() => {
    const [w, h] = frameMetres(view);
    const geo = new PlaneGeometry(w * BLEED, h * BLEED, 1, 96);
    const pos = geo.getAttribute('position'), col = new Float32Array(pos.count * 3);
    const c = new Color(), a = new Color(), b = new Color();
    for (let i = 0; i < pos.count; i++) {
      // Plane y runs from -h/2 (bottom) to h/2 (top); the share is of the way down from the top to the ground line.
      const fromTop = h / 2 - pos.getY(i) - (h * (BLEED - 1)) / 2;
      skyColour((fromTop * view.zoom) / view.ground, c, a, b);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    return { geo, mat: new MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, toneMapped: false }) };
  }, [view]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} position={at(view, 50, 50, SKY_Z)} renderOrder={-10} />;
}

/**
 * 190 stars over the top of the sky, down to a fifth of the way to the ground line (where today's 7 to 13 degrees
 * landed). Two smaller sets twinkle out of step; the rest hold still, so the sky never goes out.
 */
function Stars({ view, reduced }: { view: DreamView; reduced: boolean }) {
  const sets = useMemo(() => [110, 45, 35].map((n, k) => {
    const p = new Float32Array(n * 3);
    let seed = 7 + k * 31;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const low = ((view.ground / view.h) * 100) / 5;
    for (let i = 0; i < n; i++) p.set(at(view, r() * 100, r() * low, SKY_Z + 5), i * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, mat: new PointsMaterial({ color: '#FFFFFF', size: 3, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false, toneMapped: false }) };
  }), [view]);
  // Two sets twinkle at different rates and phases, so the sky shimmers rather than pulsing all at once.
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    sets[1].mat.opacity = 0.65 + 0.35 * Math.sin(t * 1.4);
    sets[2].mat.opacity = 0.6 + 0.4 * Math.sin(t * 0.9 + 2.1);
  });
  useEffect(() => () => sets.forEach((s) => (s.geo.dispose(), s.mat.dispose())), [sets]);
  return <>{sets.map((s, i) => <points key={i} geometry={s.geo} material={s.mat} renderOrder={-9} />)}</>;
}

function Moon({ view }: { view: DreamView }) {
  const aspect = view.w / Math.max(1, view.h);
  const across = MOON.across * frameMetres(view)[1], cell = across / 18;
  const { disc, discMat, haloMat } = useMemo(() => {
    // A crescent: the disc with a second disc taken out of it from the upper right, cut deep enough to read as a crescent at this size.
    const g = new Grid(cell), r = 9, c = lin(MOON.colour), off = r * 0.85;
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
      disc: buildGeometry(g.map, cell),
      discMat: new MeshBasicMaterial({ color: MOON.colour, fog: false, toneMapped: false }),
      haloMat: new MeshBasicMaterial({ map: new CanvasTexture(t), transparent: true, blending: AdditiveBlending, fog: false, depthWrite: false, toneMapped: false }),
    };
  }, [across, cell]);
  useEffect(() => () => { disc.dispose(); discMat.dispose(); haloMat.map?.dispose(); haloMat.dispose(); }, [disc, discMat, haloMat]);
  const [mx, my] = moonFrame(aspect);
  const r = across / 2;
  return (
    <group position={at(view, mx, my, MOON.z)}>
      <mesh material={haloMat} position={[0, 0, -2]}><planeGeometry args={[r * 4.4, r * 4.4]} /></mesh>
      <mesh geometry={disc} material={discMat} />
    </group>
  );
}

/** Two ribbons low on the right of the sky, behind the mountains, drifting. */
function Aurora({ view, reduced }: { view: DreamView; reduced: boolean }) {
  const ribbons = useMemo(() => [0, 1].map((k) => {
    const left = at(view, 52 + k * 8, 16, AURORA.z), right = at(view, 100 + k * 4, 16, AURORA.z), top = at(view, 70, 4 + k * 2, AURORA.z);
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
  }), [view]);
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: AURORA.opacity, side: DoubleSide, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }), []);
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    for (const r of ribbons) {
      const pos = r.geo.getAttribute('position') as BufferAttribute;
      const w = r.geo.parameters.width, h = r.geo.parameters.height;
      for (let i = 0; i < pos.count; i++) pos.setY(i, r.base[i * 3 + 1] + Math.sin((r.base[i * 3] / w) * 3 + t * 0.3 + r.k) * h * 0.25);
      pos.needsUpdate = true;
    }
  });
  useEffect(() => () => { ribbons.forEach((r) => r.geo.dispose()); mat.dispose(); }, [ribbons, mat]);
  return <>{ribbons.map((r, i) => <mesh key={i} ref={(el) => { refs.current[i] = el; }} geometry={r.geo} material={mat} position={r.at} renderOrder={-8} />)}</>;
}

/** The gate script (V4.1 Part 10) samples the sky; nothing passing through it may land in a sample. */
const GATE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dreamSeed');

/**
 * Now and then a shooting star: one at a time, every 6 to 14 s, a short streak down across the upper sky the camera sees,
 * bright at its head and fading to nothing at its tail, in and out in under a second. A quad rebuilt each frame,
 * additive, so its black tail adds nothing.
 */
function ShootingStar({ view }: { view: DreamView }) {
  const { geo, mat } = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    return { geo, mat: new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: DoubleSide }) };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const mesh = useRef<Mesh>(null);
  const s = useMemo(() => ({ next: 4 + Math.random() * 5, t0: -1, a: new Vector3(), b: new Vector3(), head: new Vector3(), tail: new Vector3(), side: new Vector3(), view: new Vector3() }), []);
  const DUR = 0.85, WIDTH = frameMetres(view)[1] * 0.006;
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    if (s.t0 < 0) {
      m.visible = false;
      if (t < s.next) return;
      // Start somewhere high in the sky in view, and fall a little to one side.
      const x = 15 + Math.random() * 70, y = 2 + Math.random() * 8, dir = Math.random() < 0.5 ? -1 : 1;
      s.a.set(...at(view, x, y, SKY_Z + 10));
      s.b.set(...at(view, x + dir * 12, y + 7, SKY_Z + 10));
      s.t0 = t;
    }
    const k = (t - s.t0) / DUR;
    if (k >= 1) { s.t0 = -1; s.next = t + 6 + Math.random() * 8; m.visible = false; return; }
    m.visible = true;
    s.head.lerpVectors(s.a, s.b, k);
    s.tail.lerpVectors(s.a, s.b, Math.max(0, k - 0.3));
    s.view.set(0, 0, 1);
    s.side.subVectors(s.head, s.tail).cross(s.view).normalize().multiplyScalar(WIDTH / 2);
    const p = geo.getAttribute('position') as BufferAttribute, c = geo.getAttribute('color') as BufferAttribute;
    p.setXYZ(0, s.tail.x + s.side.x * 0.2, s.tail.y + s.side.y * 0.2, s.tail.z + s.side.z * 0.2);
    p.setXYZ(1, s.tail.x - s.side.x * 0.2, s.tail.y - s.side.y * 0.2, s.tail.z - s.side.z * 0.2);
    p.setXYZ(2, s.head.x + s.side.x, s.head.y + s.side.y, s.head.z + s.side.z);
    p.setXYZ(3, s.head.x - s.side.x, s.head.y - s.side.y, s.head.z - s.side.z);
    // Fade in and out over the streak's life; the tail is black, which adds nothing.
    const glow = Math.sin(Math.PI * k);
    for (const i of [0, 1]) c.setXYZ(i, 0, 0, 0);
    for (const i of [2, 3]) c.setXYZ(i, glow, glow * 0.95, glow * 0.8);
    p.needsUpdate = true;
    c.needsUpdate = true;
    geo.computeBoundingSphere();
  });
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-8} frustumCulled={false} />;
}
