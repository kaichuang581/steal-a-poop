import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, PointsMaterial, SphereGeometry,
} from 'three';
import { withRoundedEdges } from '../voxel/rounded';
import { buildGeometry } from '../voxel/mesher';
import { lin, T } from '../voxel/palette';
import { ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import { DISTANCE } from './layout';

export type Hour = 'dawn' | 'day' | 'dusk' | 'night';

/** Sky gradient per hour: [top, bottom (horizon)], as v2. */
const SKY: Record<Hour, [string, string]> = {
  dawn: ['#9FB7D6', '#F3C9B5'],
  day: ['#78B4E6', '#BFE1F3'],
  dusk: ['#5E5A94', '#D08AA2'],
  night: ['#101B3A', '#273B66'],
};
const AURORA: Record<Hour, number> = { dawn: 0, day: 0, dusk: 0.22, night: 0.85 };

/** The dream's sky (V4 Part 6.1): an hour-independent palette, fewer and twinkling stars, a tinted moon, no snow. */
export type SkyPalette = 'hour' | 'dream';
export const DREAM_PALETTE = { top: '#5B4AA6', middle: '#8A78D2', horizon: '#D2C6F4', moon: '#FFF1B8', aurora: ['#F2A7D8', '#8FE3D9'] as const };

interface SkyProps { hour: Hour; reduced: boolean; blizzard: boolean; palette?: SkyPalette }

export function Sky({ hour, reduced, blizzard, palette = 'hour' }: SkyProps) {
  const dream = palette === 'dream';
  return (
    <group>
      <Dome hour={hour} palette={palette} />
      {(hour === 'night' || dream) && <Stars count={dream ? 180 : 900} twinkle={dream && !reduced} />}
      {hour === 'night' && !dream && <Moon />}
      {dream ? <Aurora opacity={0.35} reduced={reduced} dream /> : AURORA[hour] > 0 && <Aurora opacity={AURORA[hour]} reduced={reduced} />}
      {!dream && <Snowfall count={reduced ? 400 : 1600} blizzard={blizzard} />}
    </group>
  );
}

function Dome({ hour, palette = 'hour' }: { hour: Hour; palette?: SkyPalette }) {
  const R = DISTANCE.skyRadius;
  const geo = useMemo(() => {
    const g = new SphereGeometry(R, 48, 24);
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
    return g;
  }, [R]);
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }), []);
  useEffect(() => {
    const dream = palette === 'dream';
    const top = new Color(dream ? DREAM_PALETTE.top : SKY[hour][0]), bottom = new Color(dream ? DREAM_PALETTE.horizon : SKY[hour][1]), mid = new Color(DREAM_PALETTE.middle), c = new Color();
    const pos = geo.getAttribute('position'), col = geo.getAttribute('color') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, pos.getY(i) / (R * 0.55)));
      // The dream's gradient has its middle tone at 55% of the way up.
      if (dream) { if (t < 0.55) c.copy(bottom).lerp(mid, t / 0.55); else c.copy(mid).lerp(top, (t - 0.55) / 0.45); }
      else c.copy(bottom).lerp(top, Math.sqrt(t));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }, [hour, geo, R, palette]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} renderOrder={-10} />;
}

function Stars({ count = 900, twinkle = false }: { count?: number; twinkle?: boolean }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(404), n = count, p = new Float32Array(n * 3), R = DISTANCE.skyRadius * 0.95;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, y = 0.08 + r() * 0.92, s = Math.sqrt(1 - y * y);
      p.set([Math.cos(a) * s * R, y * R, Math.sin(a) * s * R], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, mat: new PointsMaterial({ color: '#F4F6FF', size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }) };
  }, [count]);
  useFrame(({ clock }) => { if (twinkle) mat.opacity = 0.65 + 0.3 * Math.sin(clock.elapsedTime * 1.4); });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <points geometry={geo} material={mat} />;
}

/** The moon: a 1 m voxel disc about 6 m across with three darker crater voxels, facing the camera. */
function Moon() {
  const { geo, mat } = useMemo(() => {
    const g = new Grid(1);
    for (let x = -3; x < 3; x++) for (let y = -3; y < 3; y++) if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= 9.5) g.set(x, y, 0, lin('#F4F1E4'));
    for (const [x, y] of [[-2, 0], [0, 1], [1, -2]]) g.set(x, y, 0, lin('#D3CDBA'));
    const geo = buildGeometry(g.map, 1);
    // Lit from within so it reads at night; vertex colours keep the craters.
    return { geo, mat: new MeshLambertMaterial({ vertexColors: true, emissive: '#B8B4A4', fog: false }) };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} position={[-80, 130, 300]} />;
}

function Aurora({ opacity, reduced, dream = false }: { opacity: number; reduced: boolean; dream?: boolean }) {
  const { geo, mat, base } = useMemo(() => {
    const geo = new PlaneGeometry(360, 70, 60, 6);
    const pos = geo.getAttribute('position'), n = pos.count, col = new Float32Array(n * 4);
    const green = new Color(dream ? DREAM_PALETTE.aurora[0] : '#5BE3A0'), teal = new Color(dream ? DREAM_PALETTE.aurora[1] : '#3FB8C9'), c = new Color();
    for (let i = 0; i < n; i++) {
      const u = pos.getX(i) / 360 + 0.5, v = pos.getY(i) / 70 + 0.5;
      c.copy(green).lerp(teal, 0.5 + 0.5 * Math.sin(u * 7));
      const a = Math.sin(Math.PI * v) ** 1.5 * (0.55 + 0.45 * Math.sin(u * 11 + 1)) * Math.sin(Math.PI * u);
      col.set([c.r, c.g, c.b, Math.max(0, a)], i * 4);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 4));
    const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, side: DoubleSide, depthWrite: false, blending: AdditiveBlending, fog: false });
    return { geo, mat, base: Float32Array.from(pos.array as Float32Array) };
  }, [dream]);
  mat.opacity = opacity;
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime, pos = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      pos.setY(i, base[i * 3 + 1] + Math.sin(x * 0.02 + t * 0.3) * 4);
      pos.setZ(i, Math.sin(x * 0.03 + t * 0.4) * 12);
    }
    pos.needsUpdate = true;
  });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  // The dream's ribbons lie low on the right, behind the islands.
  return <mesh geometry={geo} material={mat} position={dream ? [120, 40, -330] : [0, 110, 330]} rotation={dream ? [0, Math.PI, 0] : [0, 0, 0]} scale={dream ? 0.6 : 1} renderOrder={-9} />;
}

/** Snow over the yard: points drifting down and sideways, wrapped in a box x ±30, y 0..18, z 7..60. */
function Snowfall({ count, blizzard }: { count: number; blizzard: boolean }) {
  const { geo, mat, speed } = useMemo(() => {
    const r = rng(1601 + count), p = new Float32Array(count * 3), speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p.set([-30 + r() * 60, r() * 18, 7 + r() * 53], i * 3);
      speed[i] = 0.6 + r() * 0.7;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    return { geo, speed, mat: new PointsMaterial({ color: '#FFFFFF', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }) };
  }, [count]);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05), t = clock.elapsedTime;
    const fall = blizzard ? 3 : 1, side = blizzard ? 6 : 0.35;
    const pos = geo.getAttribute('position') as BufferAttribute, a = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      a[k] += (side + Math.sin(t * 0.7 + i) * 0.25) * dt;
      a[k + 1] -= speed[i] * fall * dt;
      if (a[k + 1] < 0) a[k + 1] += 18;
      if (a[k] > 30) a[k] -= 60;
      else if (a[k] < -30) a[k] += 60;
    }
    pos.needsUpdate = true;
  });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

const PUFFS = 6, PUFF_LIFE = 6;

/** Chimney smoke: a few 0.20 m voxel puffs rising, drifting, growing and fading, cycling forever. */
export function ChimneySmoke({ from }: { from: [number, number, number] }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const { geo, mats } = useMemo(() => {
    const g = new Grid(0.2);
    ellipsoid(g, [0, 0, 0], [0.3, 0.25, 0.3], (x, y, z) => lin(hash3(x, y, z, 5) > 0.5 ? '#E9ECF2' : T.stone[0]));
    const geo = buildGeometry(g.map, 0.2);
    geo.center();
    const mats = Array.from({ length: PUFFS }, () => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false })));
    return { geo, mats };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t / PUFF_LIFE + i / PUFFS) % 1;
      m.position.set(from[0] + p * 1.2 + Math.sin(p * 4 + i) * 0.2, from[1] + p * 3.2, from[2] + Math.cos(p * 3 + i) * 0.15);
      m.scale.setScalar(0.6 + p * 1.6);
      (m.material as MeshLambertMaterial).opacity = 0.75 * (1 - p) * Math.min(1, p * 8);
    });
  });
  useEffect(() => () => (geo.dispose(), mats.forEach((m) => m.dispose())), [geo, mats]);
  return (
    <group>
      {mats.map((mat, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} geometry={geo} material={mat} />
      ))}
    </group>
  );
}

/** The distant windmill: static body, blades (built around the origin) placed at the hub and turned once per 40 s. */
export function Windmill({ body, blades, hub }: { body: BufferGeometry; blades: BufferGeometry; hub: [number, number, number] }) {
  const ref = useRef<Group>(null);
  const mat = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true })), []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -(clock.elapsedTime / 40) * Math.PI * 2;
  });
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      <mesh geometry={body} material={mat} castShadow receiveShadow />
      <group ref={ref} position={hub}>
        <mesh geometry={blades} material={mat} castShadow />
      </group>
    </group>
  );
}
