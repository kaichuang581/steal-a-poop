import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute, FogExp2, Group, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, PointsMaterial, SphereGeometry,
} from 'three';
import { DISTANCE } from '../scene/layout';
import { LANTERN_LIGHT } from '../table/Rendering';
import { voxelMaterial } from '../voxel/material';
import { rng } from '../voxel/primitives';
import {
  CLOUD_SHEEP, CLOUD_SHEEP_SPAN, CLOUD_SHEEP_SPEED, CLOUDS, cloudBlob, cloudSheep, DREAM_SKY, dreamLantern, dreamMoon, ISLANDS, LANE_Z, MOON,
  skyIsland, sleepZ,
} from './stage';
import type { Afloat } from './stage';

/**
 * The dream's sky and everything that floats in it. The yard's night sky is a winter's; this one is a sleeper's:
 * violet from zenith to nadir with no horizon line (the farm floats, so there is sky below it too), a moon far too big
 * and too close, stars that twinkle, a sea of clouds beneath and islands of snow and pines adrift at every height,
 * sheep-shaped clouds crossing the way the hero runs, paper lanterns drifting up from the farm, and glowing motes
 * rising where the snow would fall.
 */
export function DreamSky({ reduced }: { reduced: boolean }) {
  return (
    <group>
      <DreamFog />
      <Dome />
      <Stars reduced={reduced} />
      <Moon />
      <Afloats items={CLOUDS} build={cloudBlob} bob={2.4} sway={6} period={23} reduced={reduced} />
      <Afloats items={ISLANDS} build={skyIsland} bob={1.4} sway={3} period={17} reduced={reduced} shadows />
      <SheepClouds reduced={reduced} />
      <Motes count={reduced ? 160 : 520} reduced={reduced} />
    </group>
  );
}

function DreamFog() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new FogExp2(DREAM_SKY.horizon, DREAM_SKY.fogDensity);
    scene.background = new Color(DREAM_SKY.horizon);
  }, [scene]);
  return null;
}

/** The dome, coloured through three stops: deep indigo overhead, lavender at the horizon, violet below. */
function Dome() {
  const R = DISTANCE.skyRadius;
  const geo = useMemo(() => {
    const g = new SphereGeometry(R, 48, 32);
    const pos = g.getAttribute('position'), n = pos.count, col = new Float32Array(n * 3);
    const zenith = new Color(DREAM_SKY.zenith), horizon = new Color(DREAM_SKY.horizon), nadir = new Color(DREAM_SKY.nadir), c = new Color();
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i) / R;
      if (y >= 0) c.copy(horizon).lerp(zenith, Math.sqrt(Math.min(1, y / 0.6)));
      else c.copy(horizon).lerp(nadir, Math.sqrt(Math.min(1, -y / 0.35)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    return g;
  }, [R]);
  const mat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} renderOrder={-10} />;
}

/** Stars in two layers that breathe against each other, so the sky twinkles without a shader. */
function Stars({ reduced }: { reduced: boolean }) {
  const layers = useMemo(() => [0, 1].map((layer) => {
    const r = rng(707 + layer), n = 700, p = new Float32Array(n * 3), R = DISTANCE.skyRadius * 0.95;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, y = -0.2 + r() * 1.2, s = Math.sqrt(1 - y * y);
      p.set([Math.cos(a) * s * R, y * R, Math.sin(a) * s * R], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    const mat = new PointsMaterial({ color: layer ? '#FFE9F4' : '#EEF0FF', size: layer ? 2.4 : 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false });
    return { geo, mat };
  }), []);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    layers[0].mat.opacity = 0.6 + 0.3 * Math.sin(t * 1.3);
    layers[1].mat.opacity = 0.6 + 0.3 * Math.sin(t * 0.9 + 2);
  });
  useEffect(() => () => layers.forEach(({ geo, mat }) => (geo.dispose(), mat.dispose())), [layers]);
  return <>{layers.map(({ geo, mat }, i) => <points key={i} geometry={geo} material={mat} />)}</>;
}

/** The moon, lit from within, with a soft rose halo behind it. */
function Moon() {
  const { geo, mat, halo, haloMat } = useMemo(() => {
    const geo = dreamMoon();
    const mat = new MeshLambertMaterial({ vertexColors: true, emissive: '#E9DFCB', emissiveIntensity: 0.72, fog: false });
    const halo = new CircleGeometry(MOON.haloRadius, 48);
    const pos = halo.getAttribute('position'), n = pos.count, col = new Float32Array(n * 4);
    const c = new Color(DREAM_SKY.halo);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b, i === 0 ? 0.32 : 0], i * 4);
    halo.setAttribute('color', new Float32BufferAttribute(col, 4));
    const haloMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
    return { geo, mat, halo, haloMat };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose(), halo.dispose(), haloMat.dispose()), [geo, mat, halo, haloMat]);
  const [x, y, z] = MOON.position;
  return (
    <group position={[x, y, z]}>
      <mesh geometry={halo} material={haloMat} position={[0, 0, 6]} rotation={[0, Math.PI, 0]} renderOrder={-9} />
      <mesh geometry={geo} material={mat} scale={MOON.scale} />
    </group>
  );
}

/** Voxel things adrift: each at its spot, bobbing and swaying on its own slow period. */
function Afloats({ items, build, bob, sway, period, reduced, shadows }: {
  items: readonly Afloat[]; build: (seed: number) => BufferGeometry; bob: number; sway: number; period: number; reduced: boolean; shadows?: boolean;
}) {
  const geos = useMemo(() => items.map((it) => build(it.seed)), [items, build]);
  const mat = useMemo(() => voxelMaterial(), []);
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const it = items[i], ph = it.seed * 1.37;
      g.position.set(it.x + Math.sin(t / period + ph) * sway, it.y + Math.sin(t / (period * 0.6) + ph) * bob, it.z);
      g.rotation.z = Math.sin(t / (period * 0.8) + ph) * 0.02;
    });
  });
  useEffect(() => () => (geos.forEach((g) => g.dispose()), mat.dispose()), [geos, mat]);
  return (
    <>
      {items.map((it, i) => (
        <group key={it.seed} ref={(el) => { refs.current[i] = el; }} position={[it.x, it.y, it.z]} scale={it.scale}>
          <mesh geometry={geos[i]} material={mat} castShadow={shadows} receiveShadow={shadows} />
        </group>
      ))}
    </>
  );
}

/** Sheep-shaped clouds crossing the sky toward -x, the way the hero runs, coming round again from the far side. */
function SheepClouds({ reduced }: { reduced: boolean }) {
  const geo = useMemo(() => cloudSheep(1), []);
  const mat = useMemo(() => voxelMaterial(), []);
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime, half = CLOUD_SHEEP_SPAN / 2;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const it = CLOUD_SHEEP[i];
      const x = ((((it.x - t * CLOUD_SHEEP_SPEED * it.scale + half) % CLOUD_SHEEP_SPAN) + CLOUD_SHEEP_SPAN) % CLOUD_SHEEP_SPAN) - half;
      g.position.set(x, it.y + Math.sin(t * 0.4 + it.seed) * 1.2, it.z);
    });
  });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return (
    <>
      {CLOUD_SHEEP.map((it, i) => (
        <group key={it.seed} ref={(el) => { refs.current[i] = el; }} position={[it.x, it.y, it.z]} scale={it.scale}>
          <mesh geometry={geo} material={mat} />
        </group>
      ))}
    </>
  );
}

/** Glowing motes where snow would fall: they rise, sway and pulse over the lane and the farm. */
function Motes({ count, reduced }: { count: number; reduced: boolean }) {
  const sets = useMemo(() => [
    { color: '#E4D6FF', size: 0.14, share: 0.8 },
    { color: '#FFD98A', size: 0.1, share: 0.2 },
  ].map((set, k) => {
    const n = Math.round(count * set.share), r = rng(2201 + k), p = new Float32Array(n * 3), speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p.set([-34 + r() * 68, r() * 16, LANE_Z - 10 + r() * 60], i * 3);
      speed[i] = 0.15 + r() * 0.3;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    const mat = new PointsMaterial({ color: set.color, size: set.size, transparent: true, opacity: 0.8, depthWrite: false });
    return { geo, mat, speed, n };
  }), [count]);
  useFrame(({ clock }, delta) => {
    if (reduced) return;
    const dt = Math.min(delta, 0.05), t = clock.elapsedTime;
    sets.forEach(({ geo, mat, speed, n }, k) => {
      mat.opacity = 0.55 + 0.3 * Math.sin(t * 1.1 + k * 2);
      const pos = geo.getAttribute('position') as BufferAttribute, a = pos.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        a[j] += Math.sin(t * 0.5 + i) * 0.3 * dt;
        a[j + 1] += speed[i] * dt;
        if (a[j + 1] > 16) a[j + 1] -= 16;
      }
      pos.needsUpdate = true;
    });
  });
  useEffect(() => () => sets.forEach(({ geo, mat }) => (geo.dispose(), mat.dispose())), [sets]);
  return <>{sets.map(({ geo, mat }, i) => <points key={i} geometry={geo} material={mat} frustumCulled={false} />)}</>;
}

const LANTERNS = 7, LANTERN_LIFE = 26;

/** Paper lanterns drifting up from the farm's yard, cycling forever; placed in the farm's own frame. */
export function DriftingLanterns({ reduced }: { reduced: boolean }) {
  const geo = useMemo(() => dreamLantern(), []);
  const mat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 1.8 }), []);
  const spots = useMemo(() => {
    const r = rng(909);
    return Array.from({ length: LANTERNS }, () => ({ x: -30 + r() * 60, z: 4 + r() * 36, ph: r() }));
  }, []);
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const s = spots[i];
      const p = reduced ? (0.3 + s.ph * 0.5) : (t / LANTERN_LIFE + s.ph) % 1;
      m.position.set(s.x + Math.sin(p * 5 + i) * 1.5, 1.5 + p * 22, s.z + Math.cos(p * 4 + i) * 1.2);
      m.rotation.y = p * 3 + i;
      m.rotation.z = Math.sin(p * 7 + i) * 0.1;
    });
  });
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return (
    <group>
      {spots.map((_, i) => <mesh key={i} ref={(m) => { refs.current[i] = m; }} geometry={geo} material={mat} />)}
    </group>
  );
}

const ZS = 3, Z_LIFE = 5.5;

/** Sleepy Zs floating up from the farmhouse chimney (the farmer is the one dreaming this), cycling forever. */
export function SleepZs({ from, reduced }: { from: [number, number, number]; reduced: boolean }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const { geo, mats } = useMemo(() => {
    const geo = sleepZ();
    geo.center();
    const mats = Array.from({ length: ZS }, () => new MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, emissive: '#6E5AA0', emissiveIntensity: 0.6 }));
    return { geo, mats };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = reduced ? 0.25 + i * 0.25 : (t / Z_LIFE + i / ZS) % 1;
      m.position.set(from[0] - p * 1.6 + Math.sin(p * 5 + i) * 0.3, from[1] + 0.6 + p * 5, from[2]);
      m.scale.setScalar(0.5 + p * 1.5);
      m.rotation.z = Math.sin(p * 4 + i) * 0.25;
      (m.material as MeshLambertMaterial).opacity = 0.9 * (1 - p) * Math.min(1, p * 6);
    });
  });
  useEffect(() => () => (geo.dispose(), mats.forEach((m) => m.dispose())), [geo, mats]);
  return (
    <group>
      {mats.map((mat, i) => <mesh key={i} ref={(m) => { refs.current[i] = m; }} geometry={geo} material={mat} />)}
    </group>
  );
}
