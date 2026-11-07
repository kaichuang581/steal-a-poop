import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, PointLight, Vector3 } from 'three';

const FLAMES = 140;
const SPARKS = 90;
const LIFE = 1.1;
const FLAME_COLORS = ['#fff2b0', '#ffd04a', '#ff9a2a', '#ff5a1e', '#c8321a'].map((c) => new Color(c));

interface Cloud { geo: BufferGeometry; vel: Float32Array; age: Float32Array; n: number }

function makeCloud(n: number): Cloud {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
  return { geo, vel: new Float32Array(n * 3), age: new Float32Array(n).fill(9), n };
}

/**
 * A bomb going off: a flash of light, a ball of square flame bits that rise and cool from white through orange to red,
 * and fast sparks that fly out and fall. One burst each time `boomKey` changes, from where the bomb was.
 */
export function Blast({ boomKey, origin, reduced }: { boomKey: number | undefined; origin: () => Vector3 | null; reduced: boolean }) {
  const flames = useMemo(() => makeCloud(FLAMES), []);
  const sparks = useMemo(() => makeCloud(SPARKS), []);
  const flameMat = useMemo(() => new PointsMaterial({ size: 0.95, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const sparkMat = useMemo(() => new PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const flash = useMemo(() => makeCloud(1), []);
  const flashMat = useMemo(() => new PointsMaterial({ size: 4.2, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const flames3 = useRef<Points>(null);
  const sparks3 = useRef<Points>(null);
  const light = useRef<PointLight>(null);
  const last = useRef<number | undefined>(boomKey);
  const t0 = useRef(-1);
  const at = useRef(new Vector3());

  useEffect(() => {
    if (boomKey === undefined || boomKey === last.current) return;
    last.current = boomKey;
    const o = origin();
    if (!o) return;
    at.current.copy(o);
    t0.current = 0;
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
    };
    seed(flames, 3.2, 0.9);
    seed(sparks, 7.5, 1.6);
    (flash.geo.getAttribute('position') as BufferAttribute).setXYZ(0, o.x, o.y, o.z);
    (flash.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }, [boomKey, origin, flames, sparks]);

  useFrame((_, dt) => {
    if (t0.current < 0) return;
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
        const col = flame ? FLAME_COLORS[Math.min(FLAME_COLORS.length - 1, Math.floor(k * FLAME_COLORS.length))] : FLAME_COLORS[Math.min(2, Math.floor(k * 3))];
        const fade = (1 - k) * (flame ? 1.2 : 1.5);
        c.setXYZ(i, col.r * fade, col.g * fade, col.b * fade);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    };
    {
      const c = flash.geo.getAttribute('color') as BufferAttribute;
      const k = Math.max(0, 1 - t0.current / 0.28);
      c.setXYZ(0, 1.0 * k, 0.8 * k, 0.4 * k);
      c.needsUpdate = true;
    }
    step(flames, -0.9, true); // flames keep rising a little
    step(sparks, 7, false);
    if (light.current) {
      light.current.position.copy(at.current);
      light.current.intensity = Math.max(0, 1 - t0.current / 0.35) * 40;
    }
    if (t0.current > LIFE + 0.2) { t0.current = -1; if (light.current) light.current.intensity = 0; }
  });

  if (reduced) return null;
  return (
    <>
      <points ref={flames3} geometry={flames.geo} material={flameMat} frustumCulled={false} />
      <points geometry={flash.geo} material={flashMat} frustumCulled={false} />
      <points ref={sparks3} geometry={sparks.geo} material={sparkMat} frustumCulled={false} />
      <pointLight ref={light} color="#ffb04a" intensity={0} distance={14} />
    </>
  );
}
