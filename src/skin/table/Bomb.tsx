import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, PerspectiveCamera, PointLight, PointsMaterial, Quaternion, Vector3 } from 'three';
import { HEAP, SPEAKER_CAMERA, seatPosition, speakerShot } from '../scene/layout';
import { digitGeometry } from '../voxel/characters';
import { BOMB_FUSE_LENGTH, BOMB_NECK_Y, BOMB_RADIUS, BOMB_TOSS_S } from '../voxel/bomb';
import { bombLook } from '../voxel/bombSkins';
import { voxelMaterial } from '../voxel/material';
import { Blast } from './Blast';
import { BombAura, useBombGlow } from './BombAura';
import { BLAST_PALETTE, BOMB_TINT, BURST_SHAPE } from '../shop/catalog';
import { auraOf } from '../shop/bombAura';
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

const PUFF = 40;

interface Ring { mesh: Mesh | null; x: number; z: number; size: number; at: number; leftAt: number }

/**
 * The ice bomb. On every turn it is tossed in a tumbling arc to the new speaker (a fresh one drops from above), hits the
 * floor beside them with a squash and a frosty puff, skids to a stop and wobbles still, and frost spreads on the floor
 * under it. Cold vapour spills off it while it sits there, its fuse burns down with a blue spark, and its seconds glow
 * on its face. The table makes the speaker flinch as it lands (see BOMB_TOSS_S).
 *
 * A Trading Post skin is the same bomb doing the same things as another object: its own model (voxel/bombSkins.ts) and
 * its own way of sitting there (shop/bombAura.ts, BombAura.tsx), a coal shedding embers, a bell that rocks and rings.
 * Only how it looks.
 */
export function Bomb({ speaker, n, fraction, red, reduced, boomKey, secondsLeft, size, power, spotAt = barnSpot }: { spotAt?: (index: number, n: number) => BombSpot; speaker: number | null; n: number; fraction: number; red: boolean; reduced: boolean; boomKey: number | undefined; secondsLeft: number | null; size: number; power: number }) {
  const body = useMemo(() => voxelMaterial({ emissive: '#3f97d6', emissiveIntensity: 0.1 }), []);
  // Trading Post cosmetics: the skin's own model, glow and way of sitting there, and the burst's colours. Only how it looks.
  const equipped = useWallet().equipped;
  const tint = BOMB_TINT[equipped.bomb] ?? BOMB_TINT['bomb-ice'];
  const look = useMemo(() => bombLook(equipped.bomb), [equipped.bomb]);
  const aura = auraOf(equipped.bomb);
  const glowMat = useBombGlow(equipped.bomb);
  const palette = BLAST_PALETTE[equipped.blast];
  useEffect(() => { body.emissive.set(tint.emissive); }, [body, tint]);
  const fuseMat = useMemo(() => voxelMaterial({ emissive: '#9fd8ff', emissiveIntensity: 0.15 }), []);
  const sparkMat = useMemo(() => voxelMaterial({ emissive: '#5fd0ff', emissiveIntensity: 2 }), []);
  const digitMat = useMemo(() => voxelMaterial({ emissive: '#8fe4ff', emissiveIntensity: 0.35 }), []);
  const ringMats = useMemo(() => [0, 1].map(() => voxelMaterial({ transparent: true, opacity: 0, color: '#ffffff', emissive: '#bfe6ff', emissiveIntensity: 0.25 })), []);
  // The skin's fuse and spark glow, the glow of the mark it leaves on the floor (its own: a scorch, coins, a pool of
  // light; see bombSkins.ts) and the puff where it lands, in its own colours.
  const puffTone = useMemo(() => new Color(), []);
  useEffect(() => {
    fuseMat.emissive.set(aura.fuseGlow);
    sparkMat.emissive.set(aura.sparkGlow);
    for (const m of ringMats) m.emissive.set(aura.ring.emissive);
    puffTone.set(aura.puff);
  }, [aura, fuseMat, sparkMat, ringMats, puffTone]);
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
  // The bomb's radius now, and what its aura needs to know: where it is, how big, and whether it is sitting still.
  const rNow = useRef(BOMB_RADIUS * 1.5);
  const auraOn = useRef(false);
  const auraSees = useMemo(() => ({ at: () => group.current?.position ?? null, radius: () => rNow.current, active: () => auraOn.current }), []);
  // It went off: the next one is a fresh bomb, dropped from above, however long the table's beat lasts before it comes.
  const lastBoom = useRef({ key: boomKey, at: -9999 });
  const spent = useRef(false);
  if (boomKey !== lastBoom.current.key) { lastBoom.current = { key: boomKey, at: performance.now() }; spent.current = true; }
  // Where the bomb was when it went off: its spot before the turn moved on.
  const goneFrom = useRef(new Vector3());
  const goneAt = useRef(-9999);
  const origin = useRef((): Vector3 | null => {
    if (performance.now() - goneAt.current < 800) return goneFrom.current;
    return group.current?.position ?? null;
  });
  // Where the bomb last rested before the turn moved on, and how a bomb of any radius rests beside that holder (see
  // BombSpot). Noted by the frame loop the moment the spot changes, before the bomb is moved: `origin` reads the
  // bomb's position, which may already be the next sheep's by the time a burst asks.
  const seenSpot = useRef<BombSpot | null>(null);
  const left = useRef({ from: new Vector3(), spot: null as BombSpot | null, at: -9999 });
  const beside = useRef(new Vector3());
  // Where a Trading Post act happens (a haystack, a snow cloud): the place the bomb went off at, or, given `room`
  // (a radius in metres), where something that wide stands clear of the holder's fleece, as a bomb grown that big
  // would: a haystack comes up beside the sheep, not through it.
  const stage = useRef((room: number): Vector3 | null => {
    const recent = performance.now() - left.current.at < 800;
    const at = recent ? left.current.from : group.current?.position ?? null;
    const held = recent ? left.current.spot : seenSpot.current;
    if (!at) return null;
    if (!room || !held) return beside.current.copy(at);
    const [x, z] = held(room);
    return beside.current.set(x, at.y, z);
  });
  const spot = useMemo(() => (speaker === null ? null : spotAt(speaker, n)), [speaker, n, spotAt]);

  // The puff where it lands: square bits of frost, drawn additive so they fade to nothing. (What comes off it while it
  // sits there, the ice bomb's cold vapour or a skin's own, is BombAura.)
  const fx = useMemo(() => {
    const cloud = (count: number) => {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
      geo.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
      return { geo, vel: new Float32Array(count * 3), age: new Float32Array(count).fill(99), life: new Float32Array(count).fill(1), count };
    };
    return { puff: cloud(PUFF), puffMat: new PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }) };
  }, []);

  useEffect(() => {
    if (!spot || !group.current) return;
    const s = st.current;
    const justExploded = spent.current;
    spent.current = false;
    if (justExploded && performance.now() - lastBoom.current.at < 600) { goneFrom.current.copy(group.current.position); goneAt.current = performance.now(); }
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
    if (spot !== seenSpot.current) {
      if (g && seenSpot.current) { left.current.from.copy(g.position); left.current.spot = seenSpot.current; left.current.at = performance.now(); }
      seenSpot.current = spot;
    }
    if (g) g.visible = spot !== null;
    auraOn.current = false;
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
    rNow.current = r;
    auraOn.current = st.current.phase === 'rest';
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
      // A bell rocks from side to side once it has settled, its lip lifting a little each way.
      const rock = aura.rock && !reduced ? Math.sin(e * 2.6) * aura.rock * Math.min(1, Math.max(0, e - 0.8)) : 0;
      g.position.y += Math.abs(rock) * r * 0.6;
      g.quaternion.setFromAxisAngle(axis, wob).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rattle + rock));
    }
    g.scale.set(scale * sx, scale * sy, scale * sx);

    // The seconds left, in glowing voxel digits on the bomb's face, turned to the camera so they read from any seat.
    if (label.current) {
      const text = secondsLeft === null ? '' : String(Math.max(0, Math.ceil(secondsLeft)));
      if (text !== shown.current && digits.current) { shown.current = text; digits.current.geometry = digitGeometry(text, 0.03); }
      label.current.visible = text !== '';
      label.current.quaternion.copy(g.quaternion).invert().multiply(camera.quaternion);
      const d = camera.position.clone().sub(g.position).normalize().multiplyScalar(aura.face ?? 0.21).applyQuaternion(g.quaternion.clone().invert());
      label.current.position.copy(d);
      digitMat.color.set(red ? '#ff6f55' : aura.digits[0]);
      digitMat.emissive.set(red ? '#ff5a3a' : aura.digits[1]);
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
    stepFx(dt);
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

  function stepFx(dt: number) {
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
      pc.setXYZ(i, puffTone.r * f, puffTone.g * f, puffTone.b * f);
    }
    pp.needsUpdate = true;
    pc.needsUpdate = true;
  }

  return (
    <>
      <Blast boomKey={boomKey} origin={origin.current} stage={stage.current} reduced={reduced} power={power} palette={equipped.blast === 'blast-frost' ? undefined : palette} shape={BURST_SHAPE[equipped.blast] ?? 'ball'} chunk={look.chunk} chunkGlow={tint.emissive} />
      <BombAura id={equipped.bomb} at={auraSees.at} radius={auraSees.radius} active={auraSees.active} glow={glowMat} light={glow} reduced={reduced} />
      {rings.current.map((r, i) => (
        <mesh key={i} ref={(mm) => { r.mesh = mm; }} geometry={look.ground} material={ringMats[i]} visible={false} renderOrder={1} />
      ))}
      {!reduced && <points geometry={fx.puff.geo} material={fx.puffMat} frustumCulled={false} />}
      <pointLight ref={glow} color={aura.light} intensity={0} distance={3} decay={2} />
      <group ref={group} scale={1.5}>
        <mesh geometry={look.body} material={body} castShadow />
        {look.glow && glowMat && <mesh geometry={look.glow} material={glowMat} />}
        <group ref={label}><mesh ref={digits} material={digitMat} /></group>
        <group ref={fuse} position={[0, BOMB_NECK_Y, 0]}>
          <mesh geometry={look.fuse} material={fuseMat} />
          <mesh ref={spark} geometry={look.spark} material={sparkMat} />
        </group>
      </group>
    </>
  );
}
