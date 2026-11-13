import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Euler, InstancedMesh, Matrix4, MeshBasicMaterial, PointsMaterial, PointLight, Quaternion, Vector3 } from 'three';
import type { BurstShape } from '../shop/catalog';
import { bombModel } from '../voxel/bomb';
import { propGrid } from '../voxel/burstProps';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { ACTS, MAX_PROPS } from './burstActs';
import { holdDpr } from './Rendering';

const FLAMES = 420;
const SPARKS = 260;
const SMOKE = 90;
/** How long a bit of the frost ball lasts, in seconds. */
const LIFE = 1.9;
/** The burst cools from white through ice blue to a deep cold blue as it spreads. */
const FLAME_COLORS = ['#ffffff', '#bfe9ff', '#5fb8f5', '#2f7fd6', '#173f8f'].map((c) => new Color(c));
/** Ice crystals glitter white and pale blue as they fall. */
const SPARK_COLORS = ['#ffffff', '#e6f8ff', '#b6e6ff'].map((c) => new Color(c));
/** Pieces of shell when the bomb blows apart, and when it only falls open to let something out. */
const CHUNKS = 46;
const SHELL = 14;
/** The ways a sun's rays run: along the axes and the twelve diagonals between them, as on its model. */
const SPOKES: Vector3[] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  const n = Math.abs(x) + Math.abs(y) + Math.abs(z);
  if (n === 1 || n === 2) SPOKES.push(new Vector3(x, y, z).normalize());
}
/** An aurora: how many upright streaks make its ribbon. */
const RAYS = 60;
const WHITE = new Color(1, 1, 1);
const R = Math.random;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;

interface Cloud { geo: BufferGeometry; vel: Float32Array; age: Float32Array; life: Float32Array; n: number; /** How many of its bits this burst uses. */ live: number }

function makeCloud(n: number): Cloud {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
  park(geo);
  return { geo, vel: new Float32Array(n * 3), age: new Float32Array(n).fill(9), life: new Float32Array(n).fill(LIFE), n, live: n };
}
const pos = (c: Cloud) => c.geo.getAttribute('position') as BufferAttribute;
const col = (c: Cloud) => c.geo.getAttribute('color') as BufferAttribute;

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

/** One thing an act puts up: where it starts, how it moves, when it comes and goes. Times are seconds from the bang. */
interface PropInit {
  x: number; y: number; z: number; size: number;
  vx?: number; vy?: number; vz?: number;
  /** It comes at t0, and starts to go `until` seconds after that. */
  t0?: number; until?: number;
  /** A climb of `rise` metres over `riseT` seconds, easing out. */
  rise?: number; riseT?: number;
  yaw?: number; spin?: number; sway?: number; bob?: number; tilt?: number; pulse?: number;
  /** It goes with a pop (a balloon), not by shrinking away. */
  snap?: boolean; tint?: Color;
}
const FIELDS = ['x', 'y', 'z', 'size', 'vx', 'vy', 'vz', 't0', 'until', 'rise', 'riseT', 'yaw', 'spin', 'sway', 'bob', 'tilt', 'pulse', 'snap', 'phase'] as const;
type Stage = Record<(typeof FIELDS)[number], Float32Array> & { n: number; /** Where each is now, and its scale: x, y, z, s. */ cur: Float32Array };

const propGeos = new Map<string, BufferGeometry | null>();
/** The voxel thing a burst puts up, in its own colours; built once for each burst. */
function propGeometry(shape: BurstShape, palette?: { flame: string[]; spark: string[] }): BufferGeometry | null {
  if (!palette) return null;
  const key = `${shape}|${palette.flame.join()}`;
  if (!propGeos.has(key)) { const g = propGrid(shape, palette); propGeos.set(key, g ? buildGeometry(g.map, g.size) : null); }
  return propGeos.get(key) ?? null;
}

/**
 * What the bomb does when it goes off, at the place it was. The ice bomb's own burst is the explosion: a cold white
 * flash, a ball of square frost bits that spread and cool from white through ice blue, glittering ice crystals that fly
 * out and drift down, chunks of the shell that tumble and bounce on the floor, and a freezing mist that sinks and
 * spreads. A Trading Post burst (`shape`, burstActs.ts) is not an explosion (Brian, 2026-11-12: "the burst doesnt
 * literally have to be an explosion every single time, maybe something pops up"): the shell falls open with a small
 * puff and something appears instead, a haystack, a snow cloud, balloons, a campfire, heather, an aurora overhead, a
 * little sun, paper lanterns, stars. One each time `boomKey` changes.
 */
export function Blast({ boomKey, origin, stage, reduced, power = 1, palette, shape = 'ball', chunk, chunkGlow = '#6fbfff' }: {
  boomKey: number | undefined;
  /** Where the frost blast goes off: the bomb. */
  origin: () => Vector3 | null;
  /**
   * Where an act happens: the place the bomb went off at, or, given `room` (a radius in metres), where something that
   * wide can stand clear beside it. `origin` if not given (the Barn Book's preview has only the one place).
   */
  stage?: (room: number) => Vector3 | null;
  reduced: boolean; power?: number; palette?: { flame: string[]; spark: string[] };
  /** What the burst is (a Trading Post burst); the frost ball unless one is worn. */
  shape?: BurstShape;
  /** A chunk of the bomb's shell in the worn skin's colours, and its glow; the ice bomb's unless one is worn. */
  chunk?: BufferGeometry; chunkGlow?: string;
}) {
  const act = ACTS[shape];
  const get = useThree((s) => s.get);
  // The burst's colours: frost unless a Trading Post burst is worn (cosmetic only).
  const flameColors = useMemo(() => (palette ? palette.flame.map((c) => new Color(c)) : FLAME_COLORS), [palette]);
  const sparkColors = useMemo(() => (palette ? palette.spark.map((c) => new Color(c)) : SPARK_COLORS), [palette]);
  const allColors = useMemo(() => [...sparkColors, ...flameColors.slice(1)], [sparkColors, flameColors]);
  const flames = useMemo(() => makeCloud(FLAMES), []);
  const sparks = useMemo(() => makeCloud(SPARKS), []);
  const flameMat = useMemo(() => new PointsMaterial({ size: 2.3, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const sparkMat = useMemo(() => new PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const smoke = useMemo(() => makeCloud(SMOKE), []);
  const smokeMat = useMemo(() => new PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, blending: AdditiveBlending }), []);
  const flash = useMemo(() => makeCloud(1), []);
  const flashMat = useMemo(() => new PointsMaterial({ size: 6, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }), []);
  const light = useRef<PointLight>(null);
  const boost = useRef(1);
  const last = useRef<number | undefined>(boomKey);
  const t0 = useRef(-1);
  // Where the bomb was, where the act stands (beside the sheep, if it needs the floor), and the camera's own
  // across and toward, flat on the floor, so an aurora spans the view from any seat.
  const at = useRef(new Vector3());
  const stand = useRef(new Vector3());
  const across = useRef(new Vector3(1, 0, 0));
  const toward = useRef(new Vector3(0, 0, 1));
  const glowAt = useRef(new Vector3());
  const grown = useRef(1);
  // An aurora's foot (its height in metres) and how tall its streaks stand, fitted to what the camera sees.
  const sky = useRef({ foot: 4, tall: 2.3 });
  // Chunks of the shell: real voxel bits that tumble out, bounce on the floor and melt away.
  const chunkMat = useMemo(() => voxelMaterial({ emissive: chunkGlow, emissiveIntensity: 0.2 }), [chunkGlow]);
  const chunks = useRef<InstancedMesh>(null);
  const chunkGeo = useMemo(() => chunk ?? bombModel().chunk, [chunk]);
  // The flash, the light and the mist take the burst's own colour (frost blue unless a burst is worn).
  const tint = useMemo(() => (palette ? flameColors[Math.min(1, flameColors.length - 1)] : null), [palette, flameColors]);
  const mist = useMemo(() => { const c = palette ? flameColors[Math.min(3, flameColors.length - 1)] : null; return c ? [c.r * 0.4 + 0.05, c.g * 0.4 + 0.05, c.b * 0.4 + 0.05] : [0.16, 0.22, 0.3]; }, [palette, flameColors]);
  const ch = useMemo(() => ({
    pos: new Float32Array(CHUNKS * 3), vel: new Float32Array(CHUNKS * 3), axis: Array.from({ length: CHUNKS }, () => new Vector3()),
    spin: new Float32Array(CHUNKS), size: new Float32Array(CHUNKS), m: new Matrix4(), q: new Quaternion(), v: new Vector3(), sc: new Vector3(), e: new Euler(),
  }), []);
  // The voxel things an act puts up: one model, drawn as many times as the act needs. Some are lit by the barn like
  // everything in it (a haystack, a campfire); some are drawn unlit, in their own colour whatever the light (a white
  // cloud, a balloon) or over white so the barn's bloom catches them (a sun, a lantern, a star).
  const propGeo = useMemo(() => propGeometry(shape, palette), [shape, palette]);
  const propMat = useMemo(() => (act.unlit ? new MeshBasicMaterial({ vertexColors: true, color: new Color(act.unlit, act.unlit, act.unlit) }) : voxelMaterial()), [act.unlit]);
  const things = useRef<InstancedMesh>(null);
  const pr = useMemo(() => {
    const s = { n: 0, cur: new Float32Array(MAX_PROPS * 4) } as Stage;
    for (const f of FIELDS) s[f] = new Float32Array(MAX_PROPS);
    return s;
  }, []);
  /** Where thing `i` is, `a` seconds after it came. */
  const propPos = (i: number, a: number, out: Vector3) => out.set(
    pr.x[i] + pr.vx[i] * a + Math.sin(a * 1.4 + pr.phase[i]) * pr.sway[i],
    pr.y[i] + pr.rise[i] * (pr.riseT[i] > 0 ? easeOut(a / pr.riseT[i]) : 0) + pr.vy[i] * a + Math.sin(a * 2 + pr.phase[i]) * pr.bob[i],
    pr.z[i] + pr.vz[i] * a + Math.cos(a * 1.1 + pr.phase[i]) * pr.sway[i] * 0.6,
  );

  useEffect(() => {
    if (boomKey === undefined || boomKey === last.current) return;
    last.current = boomKey;
    const place = stage ?? origin;
    const from = act.bang ? origin() : place(0);
    if (!from) return;
    const b = at.current.copy(from);
    const big = 1 + 0.3 * (power - 1); // a bigger bomb, a bigger act
    const o = stand.current.copy((act.room ? place(act.room * big) : null) ?? b);
    const ax = across.current.set(1, 0, 0).applyQuaternion(get().camera.quaternion).setY(0);
    if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0);
    ax.normalize();
    const dz = toward.current.set(-ax.z, 0, ax.x);
    // How high the camera sees over the bomb's place, in metres: an act keeps under it, so a cloud or an aurora is in
    // the picture from a close shot (the ice, a phone) as from a wide one.
    const tmp = new Vector3();
    let seen = b.y, over = 12;
    for (let i = 0; i < 12; i++) { const mid = (seen + over) / 2; if (tmp.set(b.x, mid, b.z).project(get().camera).y < 0.84) seen = mid; else over = mid; }
    const top = Math.max(2.4, Math.min(7, seen));
    grown.current = big;
    boost.current = power;
    t0.current = 0;
    holdDpr(((act.bang ? LIFE : Math.min(act.life, 2.4)) + 0.8) * 1000); // no resolution change mid-burst (an act's tail may)

    const put = (c: Cloud, i: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, wait: number, life: number) => {
      pos(c).setXYZ(i, x, y, z);
      c.vel[i * 3] = vx; c.vel[i * 3 + 1] = vy; c.vel[i * 3 + 2] = vz;
      c.age[i] = -wait; c.life[i] = life;
    };
    /** Takes `live` of a cloud's bits for this burst; the rest stay dead and undrawn. */
    const open = (c: Cloud, live: number) => {
      c.live = Math.min(c.n, live);
      c.age.fill(9, c.live);
      if (c.live === 0) park(c.geo); else { c.geo.setDrawRange(0, c.live); pos(c).needsUpdate = true; }
    };
    const ball = (sp: number): [number, number, number] => {
      const th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1);
      return [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp];
    };
    pr.n = 0;
    const prop = (q: PropInit) => {
      const i = pr.n++;
      for (const f of FIELDS) pr[f][i] = 0;
      pr.x[i] = q.x; pr.y[i] = q.y; pr.z[i] = q.z; pr.size[i] = q.size;
      pr.vx[i] = q.vx ?? 0; pr.vy[i] = q.vy ?? 0; pr.vz[i] = q.vz ?? 0;
      pr.t0[i] = q.t0 ?? 0; pr.until[i] = q.until ?? act.life;
      pr.rise[i] = q.rise ?? 0; pr.riseT[i] = q.riseT ?? 0;
      pr.yaw[i] = q.yaw ?? 0; pr.spin[i] = q.spin ?? 0; pr.sway[i] = q.sway ?? 0; pr.bob[i] = q.bob ?? 0; pr.tilt[i] = q.tilt ?? 0; pr.pulse[i] = q.pulse ?? 0;
      pr.snap[i] = q.snap ? 1 : 0; pr.phase[i] = R() * Math.PI * 2;
      things.current?.setColorAt(i, q.tint ?? WHITE);
      return i;
    };

    if (act.bang) {
      // The explosion: everything thrown from the bomb at once.
      const m = 1.7 * (1 + 0.6 * (power - 1));
      const fling = (c: Cloud, speed: number, lift: number, live: number) => {
        open(c, live);
        for (let i = 0; i < c.live; i++) {
          const th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1), sp = speed * (0.35 + R() * 0.65);
          put(c, i, b.x, b.y, b.z, Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + lift, Math.sin(ph) * Math.sin(th) * sp, R() * 0.08, LIFE);
        }
      };
      flameMat.size = act.fs * m; // small enough that the frost never piles up to a white screen near the camera
      sparkMat.size = act.ss * m;
      smokeMat.size = 1.3 * m;
      flashMat.size = 3.2 * m;
      fling(flames, 5.2 * m, 1.3 * m, act.flames);
      fling(sparks, 12 * m, 2.4 * m, act.sparks);
      fling(smoke, 2.4 * m, 1.4 * m, SMOKE);
      if (light.current && tint) light.current.color.copy(tint);
      for (let i = 0; i < CHUNKS; i++) {
        const th = R() * Math.PI * 2, up = 0.25 + R() * 0.75, sp = (2.2 + R() * 3.2) * Math.sqrt(m);
        ch.pos.set([b.x, b.y, b.z], i * 3);
        ch.vel.set([Math.cos(th) * sp * (1 - up * 0.5), up * sp * 1.2, Math.sin(th) * sp * (1 - up * 0.5)], i * 3);
        ch.axis[i].set(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
        ch.spin[i] = (R() - 0.5) * 18;
        ch.size[i] = (1.2 + R() * 1.6) * Math.sqrt(m);
      }
      pos(flash).setXYZ(0, b.x, b.y, b.z);
      pos(flash).needsUpdate = true;
      flash.geo.setDrawRange(0, 1);
      if (chunks.current) chunks.current.count = CHUNKS;
      return;
    }

    // An act. The shell falls open: a small soft puff, and a few pieces that hop a little way and melt.
    flameMat.size = act.fs * 1.7 * big;
    sparkMat.size = act.ss * 1.7 * big;
    smokeMat.size = 0.8 * big;
    open(flames, act.flames);
    open(sparks, act.sparks);
    open(smoke, SMOKE);
    for (let i = 0; i < SMOKE; i++) { const [vx, vy, vz] = ball(1.1 + R() * 1.9); put(smoke, i, b.x, b.y, b.z, vx, vy * 0.7 + 0.5, vz, 0, 0.35 + R() * 0.25); }
    for (let i = 0; i < SHELL; i++) {
      const th = (i / SHELL) * Math.PI * 2 + R() * 0.4, sp = 1.5 + R() * 1.1;
      ch.pos.set([b.x, b.y, b.z], i * 3);
      ch.vel.set([Math.cos(th) * sp, 1.8 + R() * 1.6, Math.sin(th) * sp], i * 3);
      ch.axis[i].set(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
      ch.spin[i] = (R() - 0.5) * 12;
      ch.size[i] = (0.9 + R() * 0.9) * Math.sqrt(big);
    }
    if (chunks.current) chunks.current.count = SHELL;
    if (light.current) light.current.color.copy(flameColors[Math.min(2, flameColors.length - 1)]);
    glowAt.current.set(o.x, 1, o.z);
    const turn = () => R() * Math.PI * 2;

    if (shape === 'haystack') {
      // A haystack pops up, and throws two forkfuls of straw off its top that flutter down and lie on the floor.
      prop({ x: o.x, y: 0, z: o.z, size: 1.4 * big, until: 2.35, yaw: turn() });
      const toss = Math.sqrt(2 * act.sg * Math.min(4.2, top - 0.8));
      for (let i = 0; i < sparks.live; i++) {
        const second = i >= 170, th = turn(), r = R() * 2.4;
        put(sparks, i, o.x + Math.cos(th) * 0.35 * R(), (0.7 + R() * 0.25) * big, o.z + Math.sin(th) * 0.35 * R(), Math.cos(th) * r, toss * (second ? 0.8 : 1) * (0.55 + R() * 0.45), Math.sin(th) * r, (second ? 1.05 : 0.12) + R() * 0.16, 1.5 + R() * 0.5);
      }
      // Chaff kicked out low along the floor as it lands.
      for (let i = 0; i < flames.live; i++) { const th = turn(), sp = 1.6 + R() * 1.6; put(flames, i, o.x + Math.cos(th) * 0.5, 0.12 + R() * 0.2, o.z + Math.sin(th) * 0.5, Math.cos(th) * sp, 0.2 + R() * 0.6, Math.sin(th) * sp, R() * 0.08, 0.55 + R() * 0.3); }
    } else if (shape === 'snowcloud') {
      // A snow cloud floats up from where the bomb was, and snows.
      const up = Math.min(3.2 * big, top - 0.75 - b.y);
      prop({ x: b.x, y: b.y, z: b.z, rise: up, riseT: 0.6, size: 1.2 * big, bob: 0.07, until: 3 });
      for (let i = 0; i < sparks.live; i++) {
        const along = (R() - 0.5) * 2.1 * big, deep = (R() - 0.5) * 0.95 * big;
        put(sparks, i, b.x + ax.x * along + dz.x * deep, b.y + up - 0.25, b.z + ax.z * along + dz.z * deep, (R() - 0.5) * 0.3, -(1.4 + R() * 0.8), (R() - 0.5) * 0.3, 0.55 + R() * 1.9, 2.7);
      }
    } else if (shape === 'balloons') {
      // Balloons float up out of the shell, drift apart, and pop into confetti one after another.
      for (let n = 0; n < act.props; n++) {
        const until = 1.1 + R() * 1.3;
        const th = (n / act.props) * Math.PI * 2 + R() * 0.5, out = 0.35 + R() * 0.75;
        prop({ x: b.x + Math.cos(th) * 0.3, y: b.y * 0.5, z: b.z + Math.sin(th) * 0.3, vx: Math.cos(th) * out, vy: Math.min(2.2, (top - 1.2) / 2.2) * (0.7 + R() * 0.45), vz: Math.sin(th) * out, sway: 0.2, tilt: 0.13, size: (0.95 + R() * 0.3) * big, t0: n * 0.09, until, snap: true, tint: allColors[n % allColors.length] });
      }
      for (let i = 0; i < sparks.live; i++) {
        if (i >= act.props * 24) { // a first toss from the shell itself
          const th = turn(), r = R() * 1.4;
          put(sparks, i, b.x, b.y, b.z, Math.cos(th) * r, 3.5 + R() * 3, Math.sin(th) * r, R() * 0.1, 1.4 + R() * 0.4);
          continue;
        }
        const n = i % act.props, [vx, vy, vz] = ball(1.2 + R() * 2.4);
        propPos(n, pr.until[n], tmp);
        put(sparks, i, tmp.x, tmp.y + 0.4 * pr.size[n], tmp.z, vx, vy + 0.8, vz, pr.t0[n] + pr.until[n], 1.1 + R() * 0.5);
      }
    } else if (shape === 'campfire') {
      // A campfire: flames climb off the logs for a couple of seconds, embers wander up, and the barn is lit by it.
      prop({ x: o.x, y: 0, z: o.z, size: 1.1 * big, until: 2.8, yaw: turn() });
      for (let i = 0; i < flames.live; i++) {
        const th = turn(), r = Math.sqrt(R()) * 0.5 * big;
        put(flames, i, o.x + Math.cos(th) * r, (0.22 + R() * 0.12) * big, o.z + Math.sin(th) * r, -Math.cos(th) * r * 1.1, 1.5 + R() * 1.6, -Math.sin(th) * r * 1.1, 0.15 + R() * 2.3, 0.5 + R() * 0.35);
      }
      for (let i = 0; i < sparks.live; i++) put(sparks, i, o.x + (R() - 0.5) * 0.6, 0.7 + R() * 0.8, o.z + (R() - 0.5) * 0.6, (R() - 0.5) * 1.2, 1.4 + R() * 1.4, (R() - 0.5) * 1.2, 0.3 + R() * 2.2, 1 + R() * 0.6);
      glowAt.current.set(o.x, 1.1, o.z);
    } else if (shape === 'heather') {
      // A patch of heather springs up, the middle first, behind a ripple of light along the floor, and sheds petals.
      for (let n = 0; n < act.props; n++) {
        const ring = n === 0 ? 0 : n < 6 ? 1 : 2, th = (ring === 1 ? (n - 1) / 5 : (n - 6) / 8) * Math.PI * 2 + R() * 0.4, rad = [0, 0.48, 0.92][ring] * big * (0.9 + R() * 0.2);
        prop({ x: o.x + Math.cos(th) * rad, y: 0, z: o.z + Math.sin(th) * rad, size: [1.6, 1.3, 1][ring] * big * (0.9 + R() * 0.25), t0: 0.05 + ring * 0.2 + R() * 0.12, until: 2.5 + R() * 0.25 - ring * 0.2, yaw: turn(), tilt: 0.05 });
      }
      for (let i = 0; i < flames.live; i++) { const th = (i / flames.live) * Math.PI * 2, sp = (2.6 + R() * 0.4) * big; put(flames, i, o.x, 0.14, o.z, Math.cos(th) * sp, 0, Math.sin(th) * sp, 0, 0.75); }
      for (let i = 0; i < sparks.live; i++) {
        const n = i % act.props;
        put(sparks, i, pr.x[n] + (R() - 0.5) * 0.4, (0.4 + R() * 0.35) * pr.size[n], pr.z[n] + (R() - 0.5) * 0.4, (R() - 0.5) * 0.7, 0.5 + R() * 0.8, (R() - 0.5) * 0.7, pr.t0[n] + 0.5 + R() * 1.4, 1.2 + R() * 0.5);
      }
      glowAt.current.set(o.x, 0.9, o.z);
    } else if (shape === 'aurora') {
      // An aurora: light climbs from the shell and is drawn open like a curtain into a waving ribbon overhead (posed
      // each frame; a ribbon bit keeps where it is along, how far up, and how tall its streak is, in its velocity
      // slots). The ribbon is RAYS upright streaks side by side, each a stack of bits. Stars come out round it.
      const span = top - b.y, per = flames.live / RAYS;
      const foot = sky.current.foot = b.y + Math.max(1.2, span * 0.5), high = sky.current.tall = Math.max(0.8, Math.min(2.3 * big, span * 0.4));
      const tall = Array.from({ length: RAYS }, () => 0.7 + R() * 0.6);
      for (let i = 0; i < flames.live; i++) {
        const ray = i % RAYS, up = Math.floor(i / RAYS);
        put(flames, i, b.x, b.y, b.z, ((ray + 0.5) / RAYS) * 2 - 1, (up + 0.5 + (R() - 0.5) * 0.3) / per, tall[ray], 0, act.life);
      }
      for (let i = 0; i < sparks.live; i++) {
        const u = R() * 2 - 1, along = u * 6.6 * big, deep = (R() - 0.5) * 4;
        put(sparks, i, b.x + ax.x * along + dz.x * deep, foot - 0.3 + R() * high * 1.9, b.z + ax.z * along + dz.z * deep, 0, 0, 0, 0.7 + Math.abs(u) * 0.5 + R() * 0.8, 1.8 + R() * 0.8);
      }
      glowAt.current.set(b.x, foot, b.z);
    } else if (shape === 'sun') {
      // A little sun rises out of the shell, turning, its rays streaming off it (posed each frame), motes drifting away.
      prop({ x: b.x, y: b.y, z: b.z, rise: Math.min(2.7 * big, top - 1 - b.y), riseT: 0.9, size: 1.25 * big, spin: 0.55, bob: 0.05, until: 3.05 });
      for (let i = 0; i < flames.live; i++) put(flames, i, b.x, b.y, b.z, R(), 0, 0, 0, act.life);
      for (let i = 0; i < sparks.live; i++) {
        const wait = 0.3 + R() * 2.3, [dx, dy, dzz] = ball(1);
        propPos(0, wait, tmp);
        const r = (0.7 + R() * 0.5) * pr.size[0], sp = 0.5 + R() * 0.9;
        put(sparks, i, tmp.x + dx * r, tmp.y + dy * r, tmp.z + dzz * r, dx * sp, dy * sp, dzz * sp, wait, 1 + R() * 0.5);
      }
    } else if (shape === 'lanterns') {
      // Paper lanterns are let go one after another and drift up and apart, each in its own glow, shedding sparks.
      for (let n = 0; n < act.props; n++) {
        const t = n * 0.17 + R() * 0.05;
        prop({ x: b.x + (R() - 0.5) * 0.9, y: 0.12, z: b.z + (R() - 0.5) * 0.9, vx: (R() - 0.5) * 1.3, vy: Math.min(1.6, (top - 0.9) / 3.2) * (0.75 + R() * 0.45), vz: (R() - 0.5) * 1.3, sway: 0.16, tilt: 0.08, spin: (R() - 0.5) * 0.8, size: (0.9 + R() * 0.3) * big, t0: t, until: 3.3 - t + R() * 0.3 });
      }
      for (let i = 0; i < sparks.live; i++) {
        const n = i % act.props, a = 0.3 + R() * 2.4;
        propPos(n, a, tmp);
        put(sparks, i, tmp.x + (R() - 0.5) * 0.3, tmp.y + 0.1, tmp.z + (R() - 0.5) * 0.3, (R() - 0.5) * 0.4, -0.1 - R() * 0.4, (R() - 0.5) * 0.4, pr.t0[n] + a, 0.9 + R() * 0.5);
      }
    } else if (shape === 'stars') {
      // Stars come out one by one in the air round where the bomb was, each with a sparkle, and wink out again.
      for (let n = 0; n < act.props; n++) {
        const th = turn(), rad = (1.1 + R() * 2.7) * big, along = Math.cos(th) * rad, deep = Math.sin(th) * rad * 0.5, t = 0.05 + n * 0.09 + R() * 0.04;
        prop({ x: b.x + ax.x * along + dz.x * deep, y: 0.8 + R() * (Math.min(1 + 3.6 * big, top - 0.4) - 0.8), z: b.z + ax.z * along + dz.z * deep, size: (0.55 + R() * 0.6) * big, t0: t, until: 2.6 + R() * 0.7 - t, yaw: turn(), spin: (R() - 0.5) * 2.4, bob: 0.06, pulse: 0.1, tint: allColors[n % Math.min(5, allColors.length)] });
      }
      for (let i = 0; i < sparks.live; i++) {
        const [vx, vy, vz] = ball(0.8 + R() * 1.6);
        if (i >= act.props * 20) { put(sparks, i, b.x, b.y, b.z, vx, Math.abs(vy) + 1, vz, R() * 0.1, 0.9 + R() * 0.5); continue; }
        const n = i % act.props;
        put(sparks, i, pr.x[n], pr.y[n], pr.z[n], vx, vy, vz, pr.t0[n] + R() * 0.08, 0.9 + R() * 0.7);
      }
      glowAt.current.set(b.x, b.y + 2.6, b.z);
    }
    if (things.current) {
      things.current.count = Math.max(1, pr.n);
      if (things.current.instanceColor) things.current.instanceColor.needsUpdate = true;
    }
  }, [boomKey, origin, flames, sparks, smoke, flameMat, sparkMat, smokeMat, flashMat, power, ch, shape, act, tint]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, rawDt) => {
    if (t0.current < 0) return;
    const dt = Math.min(rawDt, 1 / 30); // a slow frame never skips the blast
    t0.current += dt;
    const t = t0.current, b = at.current, big = grown.current;
    // An act's light fades out together at its end; a frost bit runs its own life.
    const env = act.bang ? 1 : clamp01((act.life - t) / 0.45);
    const step = (cloud: Cloud, gravity: number, drag: number, flame: boolean) => {
      const p = pos(cloud), c = col(cloud);
      for (let i = 0; i < cloud.live; i++) {
        cloud.age[i] += dt;
        const a = cloud.age[i], life = cloud.life[i], j = i * 3;
        if (a < 0 || a > life) { c.setXYZ(i, 0, 0, 0); continue; }
        cloud.vel[j + 1] -= gravity * dt;
        let y = p.getY(i) + cloud.vel[j + 1] * dt;
        // Straw, snow and confetti come to rest on the floor.
        const down = !!act.lands && !flame && y <= 0.06;
        if (down) { y = 0.06; cloud.vel[j] = 0; cloud.vel[j + 1] = 0; cloud.vel[j + 2] = 0; }
        // Small bits flutter as they fall (straw, confetti, snow, petals); the frost ball's crystals only float.
        const sway = flame || down ? 0 : Math.sin(a * 6 + i) * act.sway * dt;
        p.setXYZ(i, p.getX(i) + cloud.vel[j] * dt + sway, y, p.getZ(i) + cloud.vel[j + 2] * dt);
        const k = a / life;
        if (drag) {
          const keep = Math.max(0, 1 - dt * drag);
          cloud.vel[j] *= keep; cloud.vel[j + 2] *= keep;
          if (act.hang && !flame) cloud.vel[j + 1] *= keep; // a star's sparkle stops dead and hangs
        }
        // A worn burst leaves its white heat sooner, so its own colours are what is seen; the frost ball is as it was.
        const heat = act.bang ? k : Math.pow(k, 0.5);
        const tone = flame ? flameColors[Math.min(flameColors.length - 1, Math.floor(heat * flameColors.length))]
          : act.fixed ? (act.fixed === 'all' ? allColors : sparkColors)[i % (act.fixed === 'all' ? allColors : sparkColors).length]
            : sparkColors[Math.floor(i % 7 === 0 ? 0 : (a * 7) % 3) % sparkColors.length];
        // Blue piles up to white fast when drawn additive, so a glowing bit is dim; a small bit of an act stays bright
        // until it is nearly gone, so straw and confetti read as things and not as sparks.
        let fade = (flame || act.bang ? (1 - k) ** 1.5 : Math.min(1, (1 - k) * 2.5)) * (flame ? act.glow : act.sb ?? 1) * env;
        if (act.twinkle && !flame) fade *= 0.5 + 0.5 * Math.sin(a * 24 + i * 1.7);
        c.setXYZ(i, tone.r * fade, tone.g * fade, tone.b * fade);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    };

    // The voxel things: each pops up with a little overshoot, moves as it was told, and goes.
    const mesh = things.current;
    if (mesh && pr.n) {
      for (let i = 0; i < pr.n; i++) {
        const a = t - pr.t0[i];
        let s = 0;
        if (a > 0) {
          const u = Math.min(1, a / 0.34) - 1, gone = a - pr.until[i];
          const leave = gone <= 0 ? 1 : pr.snap[i] ? (gone < 0.07 ? 1 + gone * 4 : 0) : Math.max(0, 1 - gone / 0.35) ** 2;
          s = pr.size[i] * (1 + 2.70158 * u ** 3 + 1.70158 * u ** 2) * leave * (1 + pr.pulse[i] * Math.sin(a * 9 + pr.phase[i]));
        }
        propPos(i, Math.max(0, a), ch.v);
        pr.cur.set([ch.v.x, ch.v.y, ch.v.z, s], i * 4);
        ch.q.setFromEuler(ch.e.set(Math.sin(a * 1.7 + pr.phase[i]) * pr.tilt[i], pr.yaw[i] + pr.spin[i] * a, Math.cos(a * 1.3 + pr.phase[i]) * pr.tilt[i]));
        mesh.setMatrixAt(i, ch.m.compose(ch.v, ch.q, ch.sc.setScalar(s)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    if (act.bang) {
      const c = col(flash);
      const k = Math.max(0, 1 - t / 0.25) * 0.7;
      if (tint) c.setXYZ(0, tint.r * k, tint.g * k, tint.b * k); else c.setXYZ(0, 0.8 * k, 0.93 * k, 1.0 * k);
      c.needsUpdate = true;
    }

    if (shape === 'aurora') {
      // The ribbon: each bit is put where its streak is now. The light climbs first, then the curtain is drawn open
      // sideways from the middle. It hangs in folds that drift along it (the streaks bunch up and shine there), its
      // foot rises and falls, and its top is ragged.
      const p = pos(flames), c = col(flames), ax = across.current, dz = toward.current, { foot, tall: high } = sky.current, wide = 6.2 * big, wave = high / 2.3;
      const climb = easeOut(t / 0.4);
      for (let i = 0; i < flames.live; i++) {
        const u = flames.vel[i * 3], v = flames.vel[i * 3 + 1], own = flames.vel[i * 3 + 2];
        const drawn = easeOut((t - 0.25 - Math.abs(u) * 0.35) / 0.65);
        const tall = (0.83 + 0.3 * Math.sin(u * 2.6 + t * 1.1)) * own * high;
        const along = (u * wide + Math.sin(u * 7 + t * 0.8) * 0.5) * drawn, side = Math.sin(u * 3.1 + t * 1.3) * 0.8 * drawn;
        const y = foot + (Math.sin(u * 2.2 + t * 1.1) * 0.45 + Math.sin(u * 6.3 - t * 0.9) * 0.15) * wave + v * tall;
        p.setXYZ(i, b.x + ax.x * along + dz.x * side, b.y + (y - b.y) * climb, b.z + ax.z * along + dz.z * side);
        // Pale at the foot, green, then blue, violet at the top; brighter low down, and in bands that drift along it.
        const tone = flameColors[v < 0.1 ? 1 : v < 0.46 ? 2 : v < 0.74 ? 3 : 4];
        const f = env * climb * act.glow * (1 - v * 0.55) * (0.62 + 0.38 * Math.sin(u * 13 - t * 1.9)) * (0.35 + 0.65 * drawn);
        c.setXYZ(i, tone.r * f, tone.g * f, tone.b * f);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    } else if (shape === 'sun') {
      // The rays: bits streaming out along the sun's spokes, turning with it, fading as they go.
      const p = pos(flames), c = col(flames), s = pr.cur[3], turn = pr.yaw[0] + pr.spin[0] * (t - pr.t0[0]), cs = Math.cos(turn), sn = Math.sin(turn);
      const shine = clamp01(s / pr.size[0]);
      for (let i = 0; i < flames.live; i++) {
        const k = SPOKES[i % SPOKES.length], frac = (flames.vel[i * 3] + t * 0.45) % 1, d = (0.8 + frac * 1.5) * s;
        p.setXYZ(i, pr.cur[0] + (k.x * cs + k.z * sn) * d, pr.cur[1] + k.y * d, pr.cur[2] + (k.z * cs - k.x * sn) * d);
        const tone = flameColors[frac < 0.3 ? 1 : frac < 0.65 ? 2 : 3], f = env * shine * act.glow * (1 - frac) ** 1.2;
        c.setXYZ(i, tone.r * f, tone.g * f, tone.b * f);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
      glowAt.current.set(pr.cur[0], pr.cur[1], pr.cur[2]);
    } else if (shape === 'lanterns') {
      // The lanterns' light on the barn climbs with them.
      let y = 0, lit = 0;
      for (let n = 0; n < pr.n; n++) if (pr.cur[n * 4 + 3] > 0) { y += pr.cur[n * 4 + 1]; lit++; }
      if (lit) glowAt.current.set(b.x, y / lit, b.z);
    } else {
      step(flames, act.fg, act.fd, true); // the frost hangs, then settles
    }
    step(sparks, act.sg, act.sd, false);

    {
      const p = pos(smoke), c = col(smoke);
      if (act.bang) {
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
          c.setXYZ(i, mist[0] * k, mist[1] * k, mist[2] * k);
        }
      } else {
        // The puff as the shell falls open: out a little way, slowing, gone in half a second.
        const pale = flameColors[Math.min(1, flameColors.length - 1)], keep = Math.max(0, 1 - dt * 4);
        for (let i = 0; i < SMOKE; i++) {
          smoke.age[i] += dt;
          const a = smoke.age[i], j = i * 3;
          if (a > smoke.life[i]) { c.setXYZ(i, 0, 0, 0); continue; }
          smoke.vel[j] *= keep; smoke.vel[j + 1] *= keep; smoke.vel[j + 2] *= keep;
          p.setXYZ(i, p.getX(i) + smoke.vel[j] * dt, p.getY(i) + smoke.vel[j + 1] * dt, p.getZ(i) + smoke.vel[j + 2] * dt);
          const k = 1 - a / smoke.life[i];
          c.setXYZ(i, pale.r * k * 0.6, pale.g * k * 0.6, pale.b * k * 0.6);
        }
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    }
    if (chunks.current) {
      const n = act.bang ? CHUNKS : SHELL;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        ch.vel[j + 1] -= 9.8 * dt;
        ch.pos[j] += ch.vel[j] * dt; ch.pos[j + 1] += ch.vel[j + 1] * dt; ch.pos[j + 2] += ch.vel[j + 2] * dt;
        const floor = 0.03 * ch.size[i];
        if (ch.pos[j + 1] < floor) {
          ch.pos[j + 1] = floor;
          ch.vel[j + 1] = Math.abs(ch.vel[j + 1]) > 0.6 ? -ch.vel[j + 1] * 0.35 : 0;
          ch.vel[j] *= 0.6; ch.vel[j + 2] *= 0.6; ch.spin[i] *= 0.6;
        }
        const melt = act.bang ? clamp01((LIFE + 0.4 - t) / 0.5) : clamp01((1.5 - t) / 0.4);
        ch.q.setFromAxisAngle(ch.axis[i], ch.spin[i] * t);
        ch.m.compose(ch.v.set(ch.pos[j], ch.pos[j + 1], ch.pos[j + 2]), ch.q, ch.sc.setScalar(ch.size[i] * melt));
        chunks.current.setMatrixAt(i, ch.m);
      }
      chunks.current.instanceMatrix.needsUpdate = true;
    }
    if (light.current) {
      if (act.bang) {
        light.current.position.copy(b);
        light.current.intensity = Math.max(0, 1 - t / 0.4) * 110 * boost.current;
      } else {
        // No flash: a light that comes up, stays (a fire's flickers) and goes with the act.
        light.current.position.copy(glowAt.current);
        light.current.intensity = act.light * big * clamp01(t / 0.6) * env * (shape === 'campfire' ? 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 17) : 1);
      }
    }
    if (t > act.life) {
      t0.current = -1;
      if (light.current) light.current.intensity = 0;
      if (chunks.current) { chunks.current.setMatrixAt(0, ZERO); chunks.current.instanceMatrix.needsUpdate = true; chunks.current.count = 1; }
      if (mesh) { mesh.setMatrixAt(0, ZERO); mesh.instanceMatrix.needsUpdate = true; mesh.count = 1; }
      for (const c of [flames, sparks, smoke, flash]) park(c.geo);
    }
  });

  if (reduced) return null;
  return (
    <>
      <points geometry={flames.geo} material={flameMat} frustumCulled={false} />
      <points geometry={smoke.geo} material={smokeMat} frustumCulled={false} />
      <points geometry={flash.geo} material={flashMat} frustumCulled={false} />
      <points geometry={sparks.geo} material={sparkMat} frustumCulled={false} />
      {/* Always in the scene with one zero-size chunk between bursts, so its pipeline (and its shadow's) is built on
          mount: the first blast used to stall a frame for over 100 ms building them. The act's things likewise. */}
      <instancedMesh key={chunkGeo.uuid} ref={(m) => { chunks.current = m; if (m && t0.current < 0) { m.setMatrixAt(0, ZERO); m.instanceMatrix.needsUpdate = true; m.count = 1; } }} args={[chunkGeo, chunkMat, CHUNKS]} frustumCulled={false} castShadow />
      {propGeo && (
        <instancedMesh
          key={propGeo.uuid} args={[propGeo, propMat, MAX_PROPS]} frustumCulled={false} castShadow={!act.unlit} dispose={null}
          ref={(m) => { things.current = m; if (m && t0.current < 0) { m.setMatrixAt(0, ZERO); m.setColorAt(0, WHITE); m.instanceMatrix.needsUpdate = true; m.count = 1; } }}
        />
      )}
      <pointLight ref={light} color="#9fdcff" intensity={0} distance={70} />
    </>
  );
}
