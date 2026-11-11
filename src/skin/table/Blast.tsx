import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, Points, PointsMaterial, PointLight, Quaternion, Vector3 } from 'three';
import { bombModel } from '../voxel/bomb';
import { voxelMaterial } from '../voxel/material';
import { holdDpr } from './Rendering';

const FLAMES = 420;
const SPARKS = 260;
const SMOKE = 90;
const LIFE = 1.9;
/** The burst cools from white through ice blue to a deep cold blue as it spreads. */
const FLAME_COLORS = ['#ffffff', '#bfe9ff', '#5fb8f5', '#2f7fd6', '#173f8f'].map((c) => new Color(c));
/** Ice crystals glitter white and pale blue as they fall. */
const SPARK_COLORS = ['#ffffff', '#e6f8ff', '#b6e6ff'].map((c) => new Color(c));
const CHUNKS = 46;

interface Cloud { geo: BufferGeometry; vel: Float32Array; age: Float32Array; n: number }

function makeCloud(n: number): Cloud {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
  park(geo);
  return { geo, vel: new Float32Array(n * 3), age: new Float32Array(n).fill(9), n };
}

/**
 * Between bursts one bit is drawn, black (adds nothing) and parked far under the floor (no pixels). The dead bits used to
 * stay in the scene, black and additive, big squares overdrawn at the middle of the barn every frame (Brian, 2026-11-09:
 * "the bomb primarily, it lags the website a lot"), and then nothing was drawn at all. But a Mac's graphics driver builds
 * a material's pipeline only on its first real draw, so the first bang after a page load still froze the frame for up
 * to half a second (Brian, 2026-11-09: "the bomb explosion for the practice gamemode is still super laggy"). One parked
 * draw builds it while the table loads.
 */
const PARKED_Y = -1e4;
function park(geo: BufferGeometry) {
  (geo.getAttribute('position') as BufferAttribute).setXYZ(0, 0, PARKED_Y, 0);
  (geo.getAttribute('color') as BufferAttribute).setXYZ(0, 0, 0, 0);
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('color').needsUpdate = true;
  geo.setDrawRange(0, 1);
}
/** A chunk drawn at zero size: the shell chunks' pipeline (and their shadow's) is built at load, nothing shows. */
const ZERO = new Matrix4().makeScale(0, 0, 0);

/**
 * The ice bomb going off: a cold white flash, a ball of square frost bits that spread and cool from white through ice
 * blue, glittering ice crystals that fly out and drift down, chunks of the shell that tumble and bounce on the floor,
 * and a freezing mist that sinks and spreads. One burst each time `boomKey` changes, from where the bomb was.
 */
export function Blast({ boomKey, origin, reduced, power = 1, palette }: { boomKey: number | undefined; origin: () => Vector3 | null; reduced: boolean; power?: number; palette?: { flame: string[]; spark: string[] } }) {
  // The burst's colours: frost unless a Barn Bazaar burst is worn (cosmetic only).
  const flameColors = useMemo(() => (palette ? palette.flame.map((c) => new Color(c)) : FLAME_COLORS), [palette]);
  const sparkColors = useMemo(() => (palette ? palette.spark.map((c) => new Color(c)) : SPARK_COLORS), [palette]);
  const flames = useMemo(() => makeCloud(FLAMES), []);
  const sparks = useMemo(() => makeCloud(SPARKS), []);
  const flameMat = useMemo(() => new PointsMaterial({ size: 2.3, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const sparkMat = useMemo(() => new PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const smoke = useMemo(() => makeCloud(SMOKE), []);
  const smokeMat = useMemo(() => new PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, blending: AdditiveBlending }), []);
  const flash = useMemo(() => makeCloud(1), []);
  const flashMat = useMemo(() => new PointsMaterial({ size: 6, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const flames3 = useRef<Points>(null);
  const sparks3 = useRef<Points>(null);
  const smoke3 = useRef<Points>(null);
  const light = useRef<PointLight>(null);
  const boost = useRef(1);
  const last = useRef<number | undefined>(boomKey);
  const t0 = useRef(-1);
  const at = useRef(new Vector3());
  // Chunks of the ice shell: real voxel bits that tumble out, bounce on the floor and melt away.
  const chunkMat = useMemo(() => voxelMaterial({ emissive: '#6fbfff', emissiveIntensity: 0.2 }), []);
  const chunks = useRef<InstancedMesh>(null);
  const chunkGeo = useMemo(() => bombModel().chunk, []);
  const ch = useMemo(() => ({
    pos: new Float32Array(CHUNKS * 3), vel: new Float32Array(CHUNKS * 3), axis: Array.from({ length: CHUNKS }, () => new Vector3()),
    spin: new Float32Array(CHUNKS), size: new Float32Array(CHUNKS), m: new Matrix4(), q: new Quaternion(), v: new Vector3(), sc: new Vector3(),
  }), []);

  useEffect(() => {
    if (boomKey === undefined || boomKey === last.current) return;
    last.current = boomKey;
    const o = origin();
    if (!o) return;
    at.current.copy(o);
    t0.current = 0;
    holdDpr((LIFE + 0.8) * 1000); // no resolution change mid-burst
    const seed = (cloud: Cloud, speed: number, lift: number) => {
      const p = cloud.geo.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < cloud.n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.35 + Math.random() * 0.65);
        cloud.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
        cloud.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.9 + lift;
        cloud.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
        p.setXYZ(i, o.x, o.y, o.z);
        cloud.age[i] = -Math.random() * 0.08;
      }
      p.needsUpdate = true;
      cloud.geo.setDrawRange(0, cloud.n);
    };
    const m = 1.7 * (1 + 0.6 * (power - 1));
    flameMat.size = 1.0 * m; // small enough that the frost never piles up to a white screen near the camera
    sparkMat.size = 0.34 * m;
    smokeMat.size = 1.3 * m;
    flashMat.size = 3.2 * m;
    boost.current = power;
    seed(flames, 5.2 * m, 1.3 * m);
    seed(sparks, 12 * m, 2.4 * m);
    seed(smoke, 2.4 * m, 1.4 * m);
    for (let i = 0; i < CHUNKS; i++) {
      const th = Math.random() * Math.PI * 2, up = 0.25 + Math.random() * 0.75, sp = (2.2 + Math.random() * 3.2) * Math.sqrt(m);
      ch.pos.set([o.x, o.y, o.z], i * 3);
      ch.vel.set([Math.cos(th) * sp * (1 - up * 0.5), up * sp * 1.2, Math.sin(th) * sp * (1 - up * 0.5)], i * 3);
      ch.axis[i].set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      ch.spin[i] = (Math.random() - 0.5) * 18;
      ch.size[i] = (1.2 + Math.random() * 1.6) * Math.sqrt(m);
    }
    (flash.geo.getAttribute('position') as BufferAttribute).setXYZ(0, o.x, o.y, o.z);
    (flash.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    flash.geo.setDrawRange(0, 1);
    if (chunks.current) chunks.current.count = CHUNKS;
  }, [boomKey, origin, flames, sparks, smoke, flameMat, sparkMat, smokeMat, flashMat, power, ch]);

  useFrame((_, rawDt) => {
    if (t0.current < 0) return;
    const dt = Math.min(rawDt, 1 / 30); // a slow frame never skips the blast
    t0.current += dt;
    const step = (cloud: Cloud, gravity: number, flame: boolean) => {
      const p = cloud.geo.getAttribute('position') as BufferAttribute;
      const c = cloud.geo.getAttribute('color') as BufferAttribute;
      for (let i = 0; i < cloud.n; i++) {
        cloud.age[i] += dt;
        const a = cloud.age[i];
        if (a < 0 || a > LIFE) { c.setXYZ(i, 0, 0, 0); continue; }
        cloud.vel[i * 3 + 1] -= gravity * dt;
        p.setXYZ(i, p.getX(i) + cloud.vel[i * 3] * dt, p.getY(i) + cloud.vel[i * 3 + 1] * dt, p.getZ(i) + cloud.vel[i * 3 + 2] * dt);
        const k = a / LIFE;
        if (!flame) { cloud.vel[i * 3] *= 1 - dt * 1.2; cloud.vel[i * 3 + 2] *= 1 - dt * 1.2; } // crystals float as they fall
        const col = flame ? flameColors[Math.min(flameColors.length - 1, Math.floor(k * flameColors.length))] : sparkColors[Math.floor(i % 7 === 0 ? 0 : (a * 7) % 3) % sparkColors.length];
        const fade = (1 - k) ** 1.5 * (flame ? 0.2 : 1.0); // blue piles up to white fast when drawn additive
        c.setXYZ(i, col.r * fade, col.g * fade, col.b * fade);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    };
    {
      const c = flash.geo.getAttribute('color') as BufferAttribute;
      const k = Math.max(0, 1 - t0.current / 0.25) * 0.7;
      c.setXYZ(0, 0.8 * k, 0.93 * k, 1.0 * k);
      c.needsUpdate = true;
    }
    step(flames, 0.5, true); // the frost hangs, then settles
    step(sparks, 3.5, false);
    {
      const p = smoke.geo.getAttribute('position') as BufferAttribute;
      const c = smoke.geo.getAttribute('color') as BufferAttribute;
      for (let i = 0; i < SMOKE; i++) {
        smoke.age[i] += dt;
        const a = smoke.age[i];
        if (a < 0.15 || a > LIFE + 0.3) { c.setXYZ(i, 0, 0, 0); continue; }
        // Freezing air is heavy: the mist sinks to the floor and rolls out along it.
        smoke.vel[i * 3 + 1] -= 1.6 * dt;
        let y = p.getY(i) + smoke.vel[i * 3 + 1] * dt * 0.5;
        if (y < 0.15) { y = 0.15; smoke.vel[i * 3 + 1] = 0; smoke.vel[i * 3] *= 1 + dt; smoke.vel[i * 3 + 2] *= 1 + dt; }
        p.setXYZ(i, p.getX(i) + smoke.vel[i * 3] * dt * 0.5, y, p.getZ(i) + smoke.vel[i * 3 + 2] * dt * 0.5);
        const k = 1 - (a - 0.15) / (LIFE + 0.15);
        c.setXYZ(i, 0.16 * k, 0.22 * k, 0.3 * k);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    }
    if (chunks.current) {
      const life = t0.current;
      for (let i = 0; i < CHUNKS; i++) {
        const j = i * 3;
        ch.vel[j + 1] -= 9.8 * dt;
        ch.pos[j] += ch.vel[j] * dt; ch.pos[j + 1] += ch.vel[j + 1] * dt; ch.pos[j + 2] += ch.vel[j + 2] * dt;
        const floor = 0.03 * ch.size[i];
        if (ch.pos[j + 1] < floor) {
          ch.pos[j + 1] = floor;
          ch.vel[j + 1] = Math.abs(ch.vel[j + 1]) > 0.6 ? -ch.vel[j + 1] * 0.35 : 0;
          ch.vel[j] *= 0.6; ch.vel[j + 2] *= 0.6; ch.spin[i] *= 0.6;
        }
        const melt = Math.max(0, Math.min(1, (LIFE + 0.4 - life) / 0.5));
        ch.q.setFromAxisAngle(ch.axis[i], ch.spin[i] * life);
        ch.m.compose(ch.v.set(ch.pos[j], ch.pos[j + 1], ch.pos[j + 2]), ch.q, ch.sc.setScalar(ch.size[i] * melt));
        chunks.current.setMatrixAt(i, ch.m);
      }
      chunks.current.instanceMatrix.needsUpdate = true;
    }
    if (light.current) {
      light.current.position.copy(at.current);
      light.current.intensity = Math.max(0, 1 - t0.current / 0.4) * 110 * boost.current;
    }
    if (t0.current > LIFE + 0.5) {
      t0.current = -1;
      if (light.current) light.current.intensity = 0;
      if (chunks.current) { chunks.current.setMatrixAt(0, ZERO); chunks.current.instanceMatrix.needsUpdate = true; chunks.current.count = 1; }
      for (const c of [flames, sparks, smoke, flash]) park(c.geo);
    }
  });

  if (reduced) return null;
  return (
    <>
      <points ref={flames3} geometry={flames.geo} material={flameMat} frustumCulled={false} />
      <points ref={smoke3} geometry={smoke.geo} material={smokeMat} frustumCulled={false} />
      <points geometry={flash.geo} material={flashMat} frustumCulled={false} />
      <points ref={sparks3} geometry={sparks.geo} material={sparkMat} frustumCulled={false} />
      {/* Always in the scene with one zero-size chunk between bursts, so its pipeline (and its shadow's) is built on
          mount: the first blast used to stall a frame for over 100 ms building them. */}
      <instancedMesh ref={(m) => { chunks.current = m; if (m && t0.current < 0) { m.setMatrixAt(0, ZERO); m.instanceMatrix.needsUpdate = true; m.count = 1; } }} args={[chunkGeo, chunkMat, CHUNKS]} frustumCulled={false} castShadow />
      <pointLight ref={light} color="#9fdcff" intensity={0} distance={70} />
    </>
  );
}
