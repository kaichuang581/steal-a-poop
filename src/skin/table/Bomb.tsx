import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, PointLight, PointsMaterial, Quaternion, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { turnClockDrawn } from '../model/turnClock';
import { boardHang, FRAMING, HEAP, SHEEP_SCALE, SPEAKER_CAMERA, seatPosition, shotCamera, speakerShot, TABLE_SCREENS, tableFrame } from '../scene/layout';
import type { ScreenBox, SpeakerBody } from '../scene/layout';
import { anchorsOf } from '../voxel/animals/anchors';
import { animalModel } from '../voxel/animals';
import { BOMB_NECK_Y, BOMB_RADIUS, BOMB_TOSS_S } from '../voxel/bomb';
import { bombLook } from '../voxel/bombSkins';
import { voxelMaterial } from '../voxel/material';
import { TpBlast } from './TpBlast';
import { makeBomb, SKIN_OF } from '../tp/bomb';
import { burstKeyOf } from '../tp/burst';
import { auraOf } from '../shop/bombAura';
import { useWallet } from '../shop/store';

/** Where the bomb comes to rest beside a holder, given its radius in metres. */
export type BombSpot = (radius: number) => [number, number];

/**
 * The floating letters' box (`.sk-input-bar`), in pixels on the screens the table is solved for (TABLE_SCREENS), as the
 * browser drew it at a six-seat table on your turn: left, top, right, bottom.
 */
export const LETTERS_BOX = { desktop: { x0: 256, y0: 627, x1: 1024, y1: 788 }, phone: { x0: 8, y0: 689, x1: 382, y1: 832 } };
/** The bomb's sizes (model/bombCharge.ts `bombSize`): fresh, and as swollen as it gets. */
export const BOMB_SIZES = [1, 1.4, 1.8, 2.2, 2.6, 3.0, 3.2];
/** How far from the frame's centre the bomb would rather rest: a share of the half-width. */
export const BOMB_OFF_CENTRE = 0.25;

const sheepBody = (): SpeakerBody => {
  const m = animalModel('sheep'), a = anchorsOf(m);
  return { min: a.bounds.min, max: a.bounds.max, plate: a.plate, scale: SHEEP_SCALE * m.drawScale, ratio: 1 };
};

/** The bomb's box on screen at its rest beside the holder: its body up to the neck the fuse leaves from (the fuse is a thin line that burns down). */
export function bombBox(cam: PerspectiveCamera, x: number, z: number, size: number, W: number, H: number): ScreenBox {
  const scale = 1.5 * size, r = BOMB_RADIUS * scale, top = r + BOMB_NECK_Y * scale;
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const v = new Vector3();
  for (const dx of [-r, r]) for (const y of [0, top]) for (const dz of [-r, r]) {
    v.set(x + dx, y, z + dz).project(cam);
    const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
    b.x0 = Math.min(b.x0, px); b.x1 = Math.max(b.x1, px); b.y0 = Math.min(b.y0, py); b.y1 = Math.max(b.y1, py);
  }
  return b;
}

const meets = (a: ScreenBox, b: ScreenBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The barn's spot: on the floor by the speaker's front hooves, far enough out that a swollen bomb doesn't sink into the
 * fleece (0.42 m plus its radius), on the side whose box stays in frame clear of the floating letters (`LETTERS_BOX`)
 * and of the plate and bubble over the speaker, through the turn's real shot (the framing's camera and crop, on this
 * kind of screen; plan files 06 4.3 and 07 4.2). A side is judged by how far up the bomb's sizes it stays clear, from a
 * fresh bomb (`clearUpTo`): the side that stays clear the longest; of two equal ones the one whose centre is at least
 * `BOMB_OFF_CENTRE` of the half-width from the frame's centre, then the one nearer the middle. Where neither side is
 * clear even for a fresh bomb, today's choice: the side nearer the middle of the shot. Never lifted, never off the floor.
 */
export function barnSpot(index: number, n: number, phone = false, body: SpeakerBody = sheepBody()): BombSpot {
  const side = barnSide(index, n, phone, body).side;
  const { at } = besideHooves(index, n);
  return (r) => at(side, r);
}

/** The point beside the speaker's front hooves, `side` 1 or -1, for a bomb of radius `r`. */
function besideHooves(index: number, n: number) {
  const p = seatPosition(index, n);
  const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  const fx = dx / len, fz = dz / len;
  const sx = p.x + fx * SPEAKER_CAMERA.step, sz = p.z + fz * SPEAKER_CAMERA.step;
  return { at: (side: number, r: number): [number, number] => [sx - fx * 0.05 + fz * side * (0.42 + r), sz - fz * 0.05 - fx * side * (0.42 + r)] };
}

/** How `barnSpot` chose: the side, today's side, and for each side (1, -1) how many of `BOMB_SIZES` it stays clear for. */
export function barnSide(index: number, n: number, phone = false, body: SpeakerBody = sheepBody()): { side: number; today: number; clearUpTo: Record<number, number> } {
  const { at } = besideHooves(index, n);
  const { W, H } = phone ? TABLE_SCREENS.phone : TABLE_SCREENS.desktop;
  const cam = shotCamera(speakerShot(index, n, phone, SPEAKER_CAMERA.headY * body.ratio), W, H);
  const letters = phone ? LETTERS_BOX.phone : LETTERS_BOX.desktop;
  const plate = tableFrame(FRAMING, index, n, phone, W, H, body, boardHang(index, n, phone, body)).plate;
  const centreX = (side: number) => { const [x, z] = at(side, BOMB_RADIUS * 1.5); return new Vector3(x, BOMB_RADIUS * 1.5, z).project(cam).x; };
  const clearAt = (side: number, size: number) => {
    const [x, z] = at(side, BOMB_RADIUS * 1.5 * size);
    const b = bombBox(cam, x, z, size, W, H);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return cx > 0 && cx < W && cy > 0 && cy < H && !meets(b, letters) && !meets(b, plate);
  };
  const upTo = (side: number) => { let k = 0; while (k < BOMB_SIZES.length && clearAt(side, BOMB_SIZES[k])) k++; return k; };
  const clearUpTo: Record<number, number> = { 1: upTo(1), [-1]: upTo(-1) };
  const today = Math.abs(centreX(1)) <= Math.abs(centreX(-1)) ? 1 : -1;
  const best = Math.max(clearUpTo[1], clearUpTo[-1]);
  if (!best) return { side: today, today, clearUpTo };
  const ok = [today, -today].filter((s) => clearUpTo[s] === best);
  return { side: ok.find((s) => Math.abs(centreX(s)) >= BOMB_OFF_CENTRE) ?? ok[0], today, clearUpTo };
}

const PUFF = 40;

interface Ring { mesh: Mesh | null; x: number; z: number; size: number; at: number; leftAt: number }

/**
 * The ice bomb. On every turn it is tossed in a tumbling arc to the new speaker (a fresh one drops from above), hits the
 * floor beside them with a squash and a frosty puff, skids to a stop and wobbles still, and frost spreads on the floor
 * under it. Cold vapour spills off it while it sits there, its fuse burns down with a blue spark, and its seconds glow
 * on its face. The table makes the speaker flinch as it lands (see BOMB_TOSS_S).
 *
 * The bomb is the worn skin's model (docs/trading-post-practice/T2, src/skin/tp/bomb.ts): its seconds on its flat face,
 * its 12-piece fuse burning down, the danger colour, wobble and bigger spark in the last 3 seconds. When it goes off
 * the worn burst plays where it stood (T3, TpBlast). Only how it looks.
 */
export function Bomb({ speaker, n, phone = false, red, reduced, boomKey, size, power, spotAt = barnSpot }: { spotAt?: (index: number, n: number, phone: boolean) => BombSpot; phone?: boolean; speaker: number | null; n: number; fraction: number; red: boolean; reduced: boolean; boomKey: number | undefined; secondsLeft: number | null; size: number; power: number }) {
  // The worn skin (docs/trading-post-practice/T2): its own model with the seconds on its flat face and a fuse of 12
  // pieces that burns down, built once per skin. Its mark is hidden in a game. Only how it looks.
  const equipped = useWallet().equipped;
  const look = useMemo(() => bombLook(equipped.bomb), [equipped.bomb]);
  const aura = auraOf(equipped.bomb);
  const lit = useMemo(() => voxelMaterial({}), []);
  const skin = useMemo(() => makeBomb(SKIN_OF[equipped.bomb] ?? 'ice', { lit }), [equipped.bomb, lit]);
  const ringMats = useMemo(() => [0, 1].map(() => voxelMaterial({ transparent: true, opacity: 0, color: '#ffffff', emissive: '#bfe6ff', emissiveIntensity: 0.25 })), []);
  // The glow of the frost it leaves on the floor and the puff where it lands, in the skin's own colours.
  const puffTone = useMemo(() => new Color(), []);
  useEffect(() => {
    for (const m of ringMats) m.emissive.set(aura.ring.emissive);
    puffTone.set(aura.puff);
  }, [aura, ringMats, puffTone]);
  const group = useRef<Group>(null);
  const face = useRef<Group>(null);
  const glow = useRef<PointLight>(null);
  const rings = useRef<Ring[]>([0, 1].map(() => ({ mesh: null, x: 0, z: 0, size: 1, at: -99, leftAt: -99 })));
  const ringNext = useRef(0);
  const st = useRef({ phase: 'none' as 'none' | 'toss' | 'drop' | 'rest', t: 0, from: new Vector3(), land: new Vector3(), dir: new Vector3(), landedAt: -99, pending: false });
  const grown = useRef({ cur: size, last: size, pop: 0 });
  // The bomb's radius now, and what its aura needs to know: where it is, how big, and whether it is sitting still.
  const rNow = useRef(BOMB_RADIUS * 1.5);
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
  const spot = useMemo(() => (speaker === null ? null : spotAt(speaker, n, phone)), [speaker, n, phone, spotAt]);

  // The puff where it lands: square bits of frost, drawn additive so they fade to nothing. (What comes off it while it
  // sits there is the skin's own model now.)
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
    rNow.current = r;
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

    // The clock, read from the store as the bomb is drawn (model/turnClock.ts): the screen above renders a few times a
    // second, not every frame, so the `fraction` and `secondsLeft` it passes are only as fresh as its last render.
    const { fraction, secondsLeft } = turnClockDrawn();
    // The seconds on the face (T2): in the skin's danger colour for the last 3, when it also wobbles and its spark
    // grows. The skin turns about its own upright to face the camera, so its face reads from any seat.
    const danger = secondsLeft !== null && secondsLeft <= 3;
    skin.setSeconds(secondsLeft, danger);
    skin.setFuse(Math.max(0, Math.min(1, fraction)));
    skin.setSpark(danger ? 1.6 : 1);
    if (face.current) {
      const d = camera.position.clone().sub(g.position).applyQuaternion(g.quaternion.clone().invert());
      const wob = danger && !reduced ? (1.5 * Math.PI / 180) * Math.sin(now * Math.PI * 8) : 0;
      face.current.rotation.set(0, Math.atan2(d.x, d.z), wob);
    }
    if (glow.current) {
      glow.current.position.copy(g.position);
      glow.current.position.y += BOMB_RADIUS * scale;
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
      <TpBlast boomKey={boomKey} origin={origin.current} burst={burstKeyOf(equipped.blast)} reduced={reduced} scale={(2 * BOMB_RADIUS * 1.5 * power) / 0.5} />
      {rings.current.map((r, i) => (
        <mesh key={i} ref={(mm) => { r.mesh = mm; }} geometry={look.ground} material={ringMats[i]} visible={false} renderOrder={1} />
      ))}
      {!reduced && <points geometry={fx.puff.geo} material={fx.puffMat} frustumCulled={false} />}
      <pointLight ref={glow} color={aura.light} intensity={0} distance={3} decay={2} />
      <group ref={group} scale={1.5}>
        {/* The pack's bomb is 0.5 m across with its middle 0.25 m up; here the group's origin is the middle and its radius BOMB_RADIUS. */}
        <group ref={face} scale={BOMB_RADIUS / 0.25}>
          <primitive object={skin.group} position={[0, -skin.centreY, 0]} />
        </group>
      </group>
    </>
  );
}
