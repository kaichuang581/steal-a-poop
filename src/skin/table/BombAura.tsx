import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, PointsMaterial, Quaternion, Vector3 } from 'three';
import type { MeshLambertMaterial, PointLight } from 'three';
import { auraOf } from '../shop/bombAura';
import type { BombAura as Aura } from '../shop/bombAura';
import { glintGeometry } from '../voxel/bombSkins';
import { voxelMaterial } from '../voxel/material';

const BITS = 48;
const GLINTS = 6;
/** How many bits one ring off a bell is made of. */
const RING = 16;
const ZERO = new Matrix4().makeScale(0, 0, 0);
const R = Math.random;

/** The material of a skin's glowing parts (a coal's cracks, a gem's edges), or null if it has none. BombAura makes it throb. */
export function useBombGlow(id: string): MeshLambertMaterial | null {
  const glow = auraOf(id).glow;
  return useMemo(() => (glow ? voxelMaterial({ emissive: glow.colors[0], emissiveIntensity: glow.base }) : null), [glow]);
}

/**
 * What a bomb skin does while it sits there (shop/bombAura.ts): the bits that come off it (the ice bomb's cold vapour,
 * a coal's embers, gold's dust, a gem's sparkle, a bell's rings, a small aurora), the stars that flash on its surface,
 * and the throb of its glowing parts. Drawn in the world, not on the bomb, so nothing is dragged along when the bomb
 * is tossed. `at` is the bomb's middle, `radius` its size now, `active` whether it is at rest; `floor` is the height
 * of the floor it stands on. Under reduced motion only the glow shows, still.
 */
export function BombAura({ id, at, radius, active, floor = 0, glow, light, reduced }: {
  id: string; at: () => Vector3 | null; radius: () => number; active: () => boolean; floor?: number;
  glow?: MeshLambertMaterial | null; light?: { current: PointLight | null }; reduced: boolean;
}) {
  const aura: Aura = auraOf(id);
  const colors = useMemo(() => aura.colors.map((c) => new Color(c)), [aura]);
  const glowColors = useMemo(() => (aura.glow?.colors ?? []).map((c) => new Color(c)), [aura]);
  const glintColors = useMemo(() => (aura.glints?.colors ?? []).map((c) => new Color(c).multiplyScalar(1.6)), [aura]);
  const bits = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(BITS * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(BITS * 3), 3));
    return { geo, vel: new Float32Array(BITS * 3), age: new Float32Array(BITS).fill(99), life: new Float32Array(BITS).fill(1), tone: new Uint8Array(BITS), next: 0, rung: 0 };
  }, []);
  const bitMat = useMemo(() => new PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  useEffect(() => { bitMat.size = aura.size; bits.age.fill(99); }, [aura, bitMat, bits]);
  // The glints: small flat stars drawn unlit and over white, so they are light. Always in the scene with one at zero
  // size, so the first one never stalls a frame (see Blast.tsx).
  const stars = useRef<InstancedMesh>(null);
  const starGeo = useMemo(() => glintGeometry(), []);
  const starMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true }), []);
  const gl = useMemo(() => ({
    dir: Array.from({ length: GLINTS }, () => new Vector3()), age: new Float32Array(GLINTS).fill(99), life: new Float32Array(GLINTS).fill(1),
    size: new Float32Array(GLINTS), tone: new Uint8Array(GLINTS), m: new Matrix4(), q: new Quaternion(), spin: new Quaternion(), v: new Vector3(), s: new Vector3(), to: new Vector3(), z: new Vector3(0, 0, 1),
  }), []);
  const hue = useMemo(() => new Color(), []);

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20), t = clock.elapsedTime;
    // The glowing parts throb, and pass through their colours if they have several; the bomb's light goes with them.
    if (glow && aura.glow) {
      const g = aura.glow;
      if (glowColors.length > 1 && !reduced) {
        const u = t / (g.every ?? 1), i = Math.floor(u) % glowColors.length;
        hue.copy(glowColors[i]).lerp(glowColors[(i + 1) % glowColors.length], u - Math.floor(u));
        glow.emissive.copy(hue);
        light?.current?.color.copy(hue);
      }
      glow.emissiveIntensity = reduced ? g.base : g.base + g.pulse * (0.5 + 0.5 * Math.sin(t * g.speed));
    }
    if (reduced) return;
    const c = at(), on = !!c && active(), r = radius();
    const p = bits.geo.getAttribute('position') as BufferAttribute, col = bits.geo.getAttribute('color') as BufferAttribute;
    const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) => {
      const i = bits.next = (bits.next + 1) % BITS;
      p.setXYZ(i, x, y, z);
      bits.vel.set([vx, vy, vz], i * 3);
      bits.age[i] = 0; bits.life[i] = life; bits.tone[i] = Math.floor(R() * colors.length);
    };
    if (on && c) {
      const a = R() * Math.PI * 2, up = R(), flat = Math.sqrt(1 - up * up);
      const dx = Math.cos(a) * flat, dz = Math.sin(a) * flat;
      if (aura.bits === 'rings') {
        // A bell rings: every so often a ring of light rolls out along the floor from under its lip.
        if (t - bits.rung > aura.rate) {
          bits.rung = t;
          for (let k = 0; k < RING; k++) { const b = (k / RING) * Math.PI * 2; spawn(c.x + Math.cos(b) * r * 1.05, floor + 0.04, c.z + Math.sin(b) * r * 1.05, Math.cos(b) * 0.75, 0, Math.sin(b) * 0.75, 0.9); }
        }
      } else if (R() < dt * aura.rate) {
        if (aura.bits === 'vapour') spawn(c.x + Math.cos(a) * r * 0.9, c.y - r * (0.1 + R() * 0.4), c.z + Math.sin(a) * r * 0.9, Math.cos(a) * 0.08, -0.12 - R() * 0.1, Math.sin(a) * 0.08, 1.4 + R() * 0.8);
        else if (aura.bits === 'embers') spawn(c.x + dx * r * 0.95, c.y + up * r * 0.95, c.z + dz * r * 0.95, dx * 0.1, 0.25 + R() * 0.35, dz * 0.1, 0.9 + R() * 0.6);
        else if (aura.bits === 'dust') spawn(c.x + dx * r, c.y + up * r, c.z + dz * r, dx * 0.12, -0.05 - R() * 0.2, dz * 0.12, 1 + R() * 0.6);
        else if (aura.bits === 'wisps') { const along = (R() - 0.5) * 2.6 * r; spawn(c.x + along, c.y + r * (0.7 + R() * 0.5), c.z + (R() - 0.5) * 0.4 * r, 0, 0.22 + R() * 0.2, 0, 1.3 + R() * 0.7); }
        else {
          // Motes and sparkle hang in the air all round it.
          const y = (R() * 2 - 1), f = Math.sqrt(1 - y * y), d = r * (1.1 + R() * 0.6), still = aura.bits === 'sparkle';
          spawn(c.x + Math.cos(a) * f * d, Math.max(floor + 0.03, c.y + y * d), c.z + Math.sin(a) * f * d, still ? 0 : (R() - 0.5) * 0.06, still ? 0 : 0.04 + R() * 0.1, still ? 0 : (R() - 0.5) * 0.06, still ? 0.45 + R() * 0.45 : 2 + R() * 1.2);
        }
      }
    }
    const kind = aura.bits;
    for (let i = 0; i < BITS; i++) {
      bits.age[i] += dt;
      const a = bits.age[i], k = a / bits.life[i], j = i * 3;
      if (k > 1) { col.setXYZ(i, 0, 0, 0); continue; }
      let y = p.getY(i) + bits.vel[j + 1] * dt, x = p.getX(i) + bits.vel[j] * dt, f = Math.sin(Math.PI * k);
      let tone = colors[bits.tone[i] % colors.length];
      if (kind === 'vapour') {
        // On the floor the cold air spreads out instead of falling.
        if (y < floor + 0.03) { y = floor + 0.03; bits.vel[j] *= 1 + dt * 2.5; bits.vel[j + 2] *= 1 + dt * 2.5; bits.vel[j + 1] = 0; }
        f *= 0.28;
      } else if (kind === 'embers') {
        bits.vel[j + 1] += 0.3 * dt;
        x += Math.sin(a * 7 + i) * 0.15 * dt;
        f = (1 - k) * (0.6 + 0.4 * Math.sin(a * 30 + i));
      } else if (kind === 'dust') {
        bits.vel[j + 1] -= 0.25 * dt;
        y = Math.max(floor + 0.02, y);
        f *= 0.5 + 0.5 * Math.sin(a * 26 + i * 2);
      } else if (kind === 'sparkle') {
        f *= 0.5 + 0.5 * Math.sin(a * 40 + i);
      } else if (kind === 'rings') {
        f = (1 - k) ** 1.5 * 0.8;
      } else if (kind === 'wisps') {
        // The aurora: each bit sways as it climbs, and passes from green through blue to violet.
        x += Math.sin(a * 3 + i) * 0.25 * dt;
        tone = colors[Math.min(colors.length - 1, Math.floor(k * colors.length))];
        f *= 0.6;
      } else {
        f *= 0.55 * (0.7 + 0.3 * Math.sin(a * 5 + i));
      }
      p.setXYZ(i, x, y, p.getZ(i) + bits.vel[j + 2] * dt);
      col.setXYZ(i, tone.r * f, tone.g * f, tone.b * f);
    }
    p.needsUpdate = true;
    col.needsUpdate = true;

    // Glints: a star flashes on the side of the bomb that faces the camera, turning as it comes and goes.
    const mesh = stars.current;
    if (!mesh || !aura.glints) return;
    if (on && c && R() < dt * aura.glints.rate) {
      const i = gl.age.findIndex((v, n) => v > gl.life[n]);
      if (i >= 0) {
        gl.to.copy(camera.position).sub(c).normalize();
        gl.dir[i].set(R() - 0.5, R() - 0.5, R() - 0.5).normalize().addScaledVector(gl.to, 0.9).normalize();
        gl.age[i] = 0; gl.life[i] = 0.4 + R() * 0.35; gl.size[i] = (0.9 + R() * 0.9) * (aura.glints.size ?? 1); gl.tone[i] = Math.floor(R() * glintColors.length);
        mesh.setColorAt(i, glintColors[gl.tone[i]]);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    for (let i = 0; i < GLINTS; i++) {
      gl.age[i] += dt;
      const k = gl.age[i] / gl.life[i];
      if (k > 1 || !c) { mesh.setMatrixAt(i, ZERO); continue; }
      const s = Math.sin(Math.PI * k) * gl.size[i] * (r / 0.33);
      gl.q.copy(camera.quaternion).multiply(gl.spin.setFromAxisAngle(gl.z, k * 1.2));
      mesh.setMatrixAt(i, gl.m.compose(gl.v.copy(c).addScaledVector(gl.dir[i], r * 1.1), gl.q, gl.s.setScalar(s)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (reduced) return null;
  return (
    <>
      <points geometry={bits.geo} material={bitMat} frustumCulled={false} />
      {aura.glints && (
        <instancedMesh
          args={[starGeo, starMat, GLINTS]} frustumCulled={false} dispose={null}
          ref={(m) => { stars.current = m; if (m) { for (let i = 0; i < GLINTS; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, glintColors[0] ?? new Color(1, 1, 1)); } m.instanceMatrix.needsUpdate = true; } }}
        />
      )}
    </>
  );
}
