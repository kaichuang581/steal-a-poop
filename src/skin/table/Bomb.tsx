import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Mesh, PerspectiveCamera, PointLight, PointsMaterial, Quaternion, Vector3 } from 'three';
import { HEAP, SPEAKER_CAMERA, seatPosition, speakerShot } from '../scene/layout';
import { digitGeometry } from '../voxel/characters';
import { BOMB_FUSE_LENGTH, BOMB_NECK_Y, BOMB_RADIUS, BOMB_TOSS_S, bombModel } from '../voxel/bomb';
import { voxelMaterial } from '../voxel/material';
import { Blast } from './Blast';
import { BLAST_PALETTE, BOMB_TINT } from '../shop/catalog';
import { useWallet } from '../shop/store';

/** Where the bomb comes to rest beside a holder, given its radius in metres. */
export type BombSpot = (radius: number) => [number, number];

/**
 * The barn's spot: on the floor by the speaker's front hooves, on whichever side of it the turn's camera sees clear
 * (the side nearer the middle of the shot), and far enough out that a swollen bomb doesn't sink into the fleece.
 */
export function barnSpot(index: number, n: number): BombSpot {
  const p = seatPosition(index, n);
  const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  const fx = dx / len, fz = dz / len;
  const sx = p.x + fx * SPEAKER_CAMERA.step, sz = p.z + fz * SPEAKER_CAMERA.step;
  const shot = speakerShot(index, n, false);
  const cam = new PerspectiveCamera(shot.fov, 16 / 9, 0.1, 100);
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateMatrixWorld();
  const at = (side: number, r: number): [number, number] => [sx - fx * 0.05 + fz * side * (0.42 + r), sz - fz * 0.05 - fx * side * (0.42 + r)];
  const off = (side: number) => { const [x, z] = at(side, 0.3); return Math.abs(new Vector3(x, 0.3, z).project(cam).x); };
  const side = off(1) <= off(-1) ? 1 : -1;
  return (r) => at(side, r);
}

const VAPOUR = 36;
const PUFF = 40;

interface Ring { mesh: Mesh | null; x: number; z: number; size: number; at: number; leftAt: number }

/**
 * The ice bomb. On every turn it is tossed in a tumbling arc to the new speaker (a fresh one drops from above), hits the
 * floor beside them with a squash and a frosty puff, skids to a stop and wobbles still, and frost spreads on the floor
 * under it. Cold vapour spills off it while it sits there, its fuse burns down with a blue spark, and its seconds glow
 * on its face. The table makes the speaker flinch as it lands (see BOMB_TOSS_S).
 */
export function Bomb({ speaker, n, fraction, red, reduced, boomKey, secondsLeft, size, power, spotAt = barnSpot }: { spotAt?: (index: number, n: number) => BombSpot; speaker: number | null; n: number; fraction: number; red: boolean; reduced: boolean; boomKey: number | undefined; secondsLeft: number | null; size: number; power: number }) {
  const m = useMemo(() => bombModel(), []);
  const body = useMemo(() => voxelMaterial({ emissive: '#3f97d6', emissiveIntensity: 0.1 }), []);
  // Trading Post cosmetics: a tint on the shell and the burst's colours. Only how it looks.
  const equipped = useWallet().equipped;
  const tint = BOMB_TINT[equipped.bomb] ?? BOMB_TINT['bomb-ice'];
  const palette = BLAST_PALETTE[equipped.blast];
  useEffect(() => { body.color.set(tint.color); body.emissive.set(tint.emissive); }, [body, tint]);
  const fuseMat = useMemo(() => voxelMaterial({ emissive: '#9fd8ff', emissiveIntensity: 0.15 }), []);
  const sparkMat = useMemo(() => voxelMaterial({ emissive: '#5fd0ff', emissiveIntensity: 2 }), []);
  const digitMat = useMemo(() => voxelMaterial({ emissive: '#8fe4ff', emissiveIntensity: 0.35 }), []);
  const ringMats = useMemo(() => [0, 1].map(() => voxelMaterial({ transparent: true, opacity: 0, emissive: '#bfe6ff', emissiveIntensity: 0.25 })), []);
  const group = useRef<Group>(null);
  const label = useRef<Group>(null);
  const digits = useRef<Mesh>(null);
  const shown = useRef('');
  const fuse = useRef<Group>(null);
  const spark = useRef<Mesh>(null);
  const glow = useRef<PointLight>(null);
  const rings = useRef<Ring[]>([0, 1].map(() => ({ mesh: null, x: 0, z: 0, size: 1, at: -99, leftAt: -99 })));
  const ringNext = useRef(0);
  const st = useRef({ phase: 'none' as 'none' | 'toss' | 'drop' | 'rest', t: 0, from: new Vector3(), land: new Vector3(), dir: new Vector3(), landedAt: -99, pending: false });
  const grown = useRef({ cur: size, last: size, pop: 0 });
  const lastBoom = useRef({ key: boomKey, at: -9999 });
  if (boomKey !== lastBoom.current.key) lastBoom.current = { key: boomKey, at: performance.now() };
  // Where the bomb was when it went off: its spot before the turn moved on.
  const goneFrom = useRef(new Vector3());
  const goneAt = useRef(-9999);
  const origin = useRef((): Vector3 | null => {
    if (performance.now() - goneAt.current < 800) return goneFrom.current;
    return group.current?.position ?? null;
  });
  const spot = useMemo(() => (speaker === null ? null : spotAt(speaker, n)), [speaker, n, spotAt]);

  // Vapour spilling off the ice, and the puff where it lands: square bits of frost, drawn additive so they fade to nothing.
  const fx = useMemo(() => {
    const cloud = (count: number) => {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
      geo.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
      return { geo, vel: new Float32Array(count * 3), age: new Float32Array(count).fill(99), life: new Float32Array(count).fill(1), count };
    };
    return {
      vapour: cloud(VAPOUR), puff: cloud(PUFF), next: 0,
      vapourMat: new PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
      puffMat: new PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    };
  }, []);

  useEffect(() => {
    if (!spot || !group.current) return;
    const s = st.current;
    const justExploded = performance.now() - lastBoom.current.at < 600;
    if (justExploded) { goneFrom.current.copy(group.current.position); goneAt.current = performance.now(); }
    // The frost it leaves behind thaws away.
    for (const r of rings.current) if (r.leftAt < r.at) r.leftAt = performance.now() / 1000;
    if (reduced) { s.phase = 'rest'; s.landedAt = -99; s.pending = true; return; }
    s.phase = s.phase === 'none' || justExploded ? 'drop' : 'toss';
    s.t = 0;
    s.pending = true;
    if (s.phase === 'toss') s.from.copy(group.current.position);
  }, [spot, reduced]);

  useFrame(({ clock, camera }, rawDt) => {
    const g = group.current;
    if (g) g.visible = spot !== null;
    if (!g || !spot) return;
    const dt = Math.min(rawDt, 1 / 20);
    const now = clock.elapsedTime;
    const wall = performance.now() / 1000;
    const s = st.current;
    // Each word swells the bomb with a little pop; it eases up to its new size.
    const gr = grown.current;
    if (size > gr.last) gr.pop = 0.35;
    if (size < gr.last) gr.cur = size; // it went off: a fresh small bomb
    gr.last = size;
    gr.cur += (size - gr.cur) * Math.min(1, dt * 7);
    gr.pop = Math.max(0, gr.pop - dt * 1.6);
    const scale = 1.5 * gr.cur * (1 + gr.pop * 0.5);
    const r = BOMB_RADIUS * scale;
    const [rx, rz] = spot(r);
    const rest = new Vector3(rx, r, rz);
    if (s.pending) {
      // Where it first touches down: a little short of its rest, so it skids the last of the way.
      s.dir.set(rest.x - s.from.x, 0, rest.z - s.from.z);
      if (s.phase !== 'toss' || s.dir.lengthSq() < 1e-4) s.dir.set(0, 0, 0); else s.dir.normalize();
      s.pending = false;
    }
    s.land.copy(rest).addScaledVector(s.dir, -0.2);
    let sx = 1, sy = 1;
    g.quaternion.identity();
    if (s.phase === 'toss' || s.phase === 'drop') {
      s.t = Math.min(1, s.t + dt / BOMB_TOSS_S);
      const t = s.t;
      if (s.phase === 'toss') {
        // A lob: straight across, up and over in a parabola, one full forward tumble.
        const dist = Math.hypot(s.land.x - s.from.x, s.land.z - s.from.z);
        g.position.lerpVectors(s.from, s.land, t);
        g.position.y += 4 * t * (1 - t) * (0.9 + dist * 0.12);
        g.quaternion.setFromAxisAngle(new Vector3(s.dir.z, 0, -s.dir.x), Math.PI * 2 * t);
      } else {
        // A fresh bomb falls out of the rafters, picking up speed.
        g.position.copy(s.land);
        g.position.y += 3.2 * (1 - t * t);
        g.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), (1 - t) * 2.5);
      }
      if (t >= 1) land(rest);
    } else if (s.phase === 'rest') {
      const e = wall - s.landedAt;
      // The skid, the little bounce off the floor, the squash and the wobble, all settled in about half a second.
      const u = Math.min(1, e / 0.4);
      g.position.lerpVectors(s.land, rest, 1 - (1 - u) ** 3);
      if (e < 0.22) g.position.y += Math.sin((e / 0.22) * Math.PI) * 0.08;
      const sq = e < 0.6 ? 0.28 * Math.exp(-e * 9) * Math.cos(e * 26) : 0;
      sy = 1 - sq;
      sx = 1 + sq * 0.5;
      g.position.y += r * (sy - 1);
      const axis = s.dir.lengthSq() > 0 ? new Vector3(s.dir.z, 0, -s.dir.x) : new Vector3(1, 0, 0);
      const wob = e < 1.2 ? 0.32 * Math.exp(-e * 5) * Math.sin(e * 16) : 0;
      // Near the end it rattles on the floor.
      const rattle = red && !reduced ? Math.sin(now * 40) * 0.07 : 0;
      g.quaternion.setFromAxisAngle(axis, wob).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rattle));
    }
    g.scale.set(scale * sx, scale * sy, scale * sx);

    // The seconds left, in glowing voxel digits on the bomb's face, turned to the camera so they read from any seat.
    if (label.current) {
      const text = secondsLeft === null ? '' : String(Math.max(0, Math.ceil(secondsLeft)));
      if (text !== shown.current && digits.current) { shown.current = text; digits.current.geometry = digitGeometry(text, 0.03); }
      label.current.visible = text !== '';
      label.current.quaternion.copy(g.quaternion).invert().multiply(camera.quaternion);
      const d = camera.position.clone().sub(g.position).normalize().multiplyScalar(0.21).applyQuaternion(g.quaternion.clone().invert());
      label.current.position.copy(d);
      digitMat.color.set(red ? '#ff6f55' : '#e6f6ff');
      digitMat.emissive.set(red ? '#ff5a3a' : '#8fe4ff');
    }
    // Close to bursting, the ice glows from inside.
    body.emissiveIntensity = red && !reduced ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(now * 16)) : 0.1;
    if (fuse.current) fuse.current.scale.y = Math.max(0.02, Math.min(1, fraction));
    if (spark.current) {
      spark.current.position.y = BOMB_FUSE_LENGTH * Math.max(0.02, Math.min(1, fraction));
      spark.current.visible = reduced || Math.sin(now * 30) > -0.5;
    }
    if (glow.current) {
      glow.current.position.copy(g.position);
      glow.current.intensity = (s.phase === 'rest' || reduced ? 1.4 : 1) * (red ? 1.6 : 1) * (reduced ? 1 : 0.85 + 0.15 * Math.sin(now * 23));
    }

    // The frost on the floor: it spreads out from under the bomb as it lands, and thaws once the bomb has gone.
    for (let i = 0; i < rings.current.length; i++) {
      const ring = rings.current[i];
      if (!ring.mesh) continue;
      const grow = Math.min(1, (wall - ring.at) / 0.5);
      const gone = ring.leftAt >= ring.at ? Math.min(1, (wall - ring.leftAt) / 0.9) : 0;
      const op = (1 - (1 - grow) ** 2) * (1 - gone) * 0.85;
      ringMats[i].opacity = op;
      ring.mesh.visible = op > 0.01;
      ring.mesh.position.set(ring.x, 0.006 + i * 0.002, ring.z);
      ring.mesh.scale.setScalar(ring.size * (0.3 + 0.7 * (1 - (1 - grow) ** 3)));
    }
    stepFx(dt, g.position, r, !reduced && s.phase === 'rest');
  });

  function land(rest: Vector3) {
    const s = st.current;
    s.phase = 'rest';
    s.landedAt = performance.now() / 1000;
    const ring = rings.current[ringNext.current];
    ringNext.current = (ringNext.current + 1) % rings.current.length;
    Object.assign(ring, { x: rest.x, z: rest.z, size: 1.1 * (rest.y / BOMB_RADIUS / 1.5), at: s.landedAt, leftAt: -99 });
    // The puff: frost kicked out low along the floor in a ring.
    const p = fx.puff.geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < PUFF; i++) {
      const a = (i / PUFF) * Math.PI * 2 + Math.random() * 0.3, sp = 0.9 + Math.random() * 1.3;
      p.setXYZ(i, s.land.x + Math.cos(a) * 0.12, 0.04 + Math.random() * 0.1, s.land.z + Math.sin(a) * 0.12);
      fx.puff.vel.set([Math.cos(a) * sp, 0.4 + Math.random() * 1.1, Math.sin(a) * sp], i * 3);
      fx.puff.age[i] = -Math.random() * 0.05;
      fx.puff.life[i] = 0.45 + Math.random() * 0.35;
    }
    p.needsUpdate = true;
  }

  function stepFx(dt: number, at: Vector3, r: number, spill: boolean) {
    // Vapour: a few bits a second roll off the lower half, sink to the floor and spread along it.
    const v = fx.vapour;
    const vp = v.geo.getAttribute('position') as BufferAttribute, vc = v.geo.getAttribute('color') as BufferAttribute;
    if (spill && Math.random() < dt * 14) {
      const i = fx.next = (fx.next + 1) % VAPOUR;
      const a = Math.random() * Math.PI * 2;
      vp.setXYZ(i, at.x + Math.cos(a) * r * 0.9, at.y - r * (0.1 + Math.random() * 0.4), at.z + Math.sin(a) * r * 0.9);
      v.vel.set([Math.cos(a) * 0.08, -0.12 - Math.random() * 0.1, Math.sin(a) * 0.08], i * 3);
      v.age[i] = 0;
      v.life[i] = 1.4 + Math.random() * 0.8;
    }
    for (let i = 0; i < VAPOUR; i++) {
      v.age[i] += dt;
      const k = v.age[i] / v.life[i];
      if (k > 1) { vc.setXYZ(i, 0, 0, 0); continue; }
      let y = vp.getY(i) + v.vel[i * 3 + 1] * dt;
      // On the floor the cold air spreads out instead of falling.
      if (y < 0.03) { y = 0.03; v.vel[i * 3] *= 1 + dt * 2.5; v.vel[i * 3 + 2] *= 1 + dt * 2.5; v.vel[i * 3 + 1] = 0; }
      vp.setXYZ(i, vp.getX(i) + v.vel[i * 3] * dt, y, vp.getZ(i) + v.vel[i * 3 + 2] * dt);
      const f = Math.sin(Math.PI * k) * 0.28;
      vc.setXYZ(i, 0.62 * f, 0.82 * f, f);
    }
    vp.needsUpdate = true;
    vc.needsUpdate = true;
    // The landing puff: thrown out and up, slowed by the air, falling back.
    const pf = fx.puff;
    const pp = pf.geo.getAttribute('position') as BufferAttribute, pc = pf.geo.getAttribute('color') as BufferAttribute;
    for (let i = 0; i < PUFF; i++) {
      pf.age[i] += dt;
      const k = pf.age[i] / pf.life[i];
      if (k < 0 || k > 1) { pc.setXYZ(i, 0, 0, 0); continue; }
      const drag = Math.exp(-dt * 4);
      pf.vel[i * 3] *= drag; pf.vel[i * 3 + 2] *= drag;
      pf.vel[i * 3 + 1] -= 3.2 * dt;
      pp.setXYZ(i, pp.getX(i) + pf.vel[i * 3] * dt, Math.max(0.02, pp.getY(i) + pf.vel[i * 3 + 1] * dt), pp.getZ(i) + pf.vel[i * 3 + 2] * dt);
      const f = 1 - k;
      pc.setXYZ(i, 0.85 * f, 0.95 * f, f);
    }
    pp.needsUpdate = true;
    pc.needsUpdate = true;
  }

  return (
    <>
      <Blast boomKey={boomKey} origin={origin.current} reduced={reduced} power={power} palette={equipped.blast === 'blast-frost' ? undefined : palette} />
      {rings.current.map((r, i) => (
        <mesh key={i} ref={(mm) => { r.mesh = mm; }} geometry={m.frost} material={ringMats[i]} visible={false} renderOrder={1} />
      ))}
      {!reduced && <points geometry={fx.vapour.geo} material={fx.vapourMat} frustumCulled={false} />}
      {!reduced && <points geometry={fx.puff.geo} material={fx.puffMat} frustumCulled={false} />}
      <pointLight ref={glow} color="#8fd8ff" intensity={0} distance={3} decay={2} />
      <group ref={group} scale={1.5}>
        <mesh geometry={m.body} material={body} castShadow />
        <group ref={label}><mesh ref={digits} material={digitMat} /></group>
        <group ref={fuse} position={[0, BOMB_NECK_Y, 0]}>
          <mesh geometry={m.fuse} material={fuseMat} />
          <mesh ref={spark} geometry={m.spark} material={sparkMat} />
        </group>
      </group>
    </>
  );
}
