import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, Points,
  PointsMaterial, SRGBColorSpace, ShaderMaterial, Sprite, SpriteMaterial, Vector2, Vector3,
} from 'three';
import { NearestFilter } from 'three';
import type { Texture } from 'three';
import { spritePoints } from './points';
import { MOON, PARTY_SKY } from './sky';

/**
 * The leaderboards' sky: a festival night (Brian, 2026-11-22: "make the background scenery cooler ... (the sky i mean,
 * not anything else) ... like an anime sky/day/night", then "go more for the vibe of like those anime festivals while
 * still being somewhat cohesive"). Behind the picture, painted bands from night blue to the warm glow of the festival
 * below the island; a pixel moon with a far island in front of it; stars, a few of them with a cross of light; paper
 * sky lanterns rising and swaying; and fireworks: a rocket climbs as a spark and
 * opens as a peony, a chrysanthemum, a ring or a golden willow, sparks trailing, the willow's glittering as it falls.
 * Everything is placed by spots of the window and sized by a share of the window's width, so it composes the same at
 * every size. Under reduced motion it is one still picture: no fireworks, the lanterns where they are, the stars steady.
 */

/** A spot of the window (fractions across and down) as a point `k` times as far as the stage. */
export type Place = (fx: number, fy: number, k: number) => Vector3 | null;

const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };
const texture = (c: HTMLCanvasElement) => { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
/** A repeatable random number for `k` and `seed`: the sky is the same each time it is opened. */
const hash = (k: number, seed = 0) => { const s = Math.sin(k * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };

/** The bands blended, with the festival's warm glow rising from behind the island. */
function backdrop(): Texture {
  const [c, x] = canvas(256, 1024);
  const g = x.createLinearGradient(0, 0, 0, 1024);
  for (const [f, col] of PARTY_SKY) g.addColorStop(f, col);
  x.fillStyle = g; x.fillRect(0, 0, 256, 1024);
  const glow = x.createRadialGradient(128, 1100, 40, 128, 1100, 560);
  glow.addColorStop(0, 'rgba(255,176,110,0.55)'); glow.addColorStop(1, 'rgba(255,140,100,0)');
  x.fillStyle = glow; x.fillRect(0, 0, 256, 1024);
  return texture(c);
}

/**
 * The moon in the game's own blocky make (Brian, 2026-11-22: the painted moon was "so out of theme"): a pixel disc 22
 * pixels across, cream, its lower right a step darker, four square craters each with a lit pixel above it, and a glow
 * in two flat steps round it. Drawn on 32 x 32 and magnified with no smoothing, so every pixel stays a square.
 */
const MOON_PX = 32, MOON_R = 11;
function moonTexture(): Texture {
  const [c, x] = canvas(MOON_PX, MOON_PX);
  const at = (px: number, py: number) => Math.hypot(px + 0.5 - MOON_PX / 2, py + 0.5 - MOON_PX / 2);
  for (let py = 0; py < MOON_PX; py++) for (let px = 0; px < MOON_PX; px++) {
    const d = at(px, py);
    if (d <= MOON_R) {
      const lit = Math.hypot(px + 0.5 - (MOON_PX / 2 - 3), py + 0.5 - (MOON_PX / 2 - 3)) <= MOON_R;
      x.fillStyle = lit ? '#FBEFC8' : '#E6CF96';
    } else if (d <= MOON_R + 2) x.fillStyle = 'rgba(255, 206, 110, 0.26)';   // a warm yellow, so over the blue it
    else if (d <= MOON_R + 4) x.fillStyle = 'rgba(255, 196, 100, 0.11)';    // reads as glow, not grey
    else continue;
    x.fillRect(px, py, 1, 1);
  }
  for (const [cx, cy, w, h] of [[11, 11, 3, 2], [18, 14, 2, 2], [13, 19, 2, 2], [19, 9, 1, 1]]) {
    x.fillStyle = '#E4CC92'; x.fillRect(cx, cy, w, h);
    x.fillStyle = '#FFF8E2'; x.fillRect(cx, cy - 1, w, 1);
  }
  const t = texture(c);
  t.magFilter = NearestFilter; t.minFilter = NearestFilter; t.generateMipmaps = false;
  return t;
}

/** A paper sky lantern, lit: a soft glow, a tapered body warm at its heart, a dark rim at its open foot. */
function lanternTexture(): Texture {
  const [c, x] = canvas(96, 96);
  x.translate(16, 0);
  // Drawn for adding onto the night: deep warm colours, so the sky's blue under them does not wash them pink.
  const glow = x.createRadialGradient(32, 54, 6, 32, 54, 34);
  glow.addColorStop(0, 'rgba(255,130,40,0.55)'); glow.addColorStop(0.5, 'rgba(220,90,20,0.2)'); glow.addColorStop(1, 'rgba(200,80,20,0)');
  x.fillStyle = glow; x.fillRect(-16, 0, 96, 96);
  const body = x.createLinearGradient(0, 30, 0, 76);
  body.addColorStop(0, '#FFC25A'); body.addColorStop(0.5, '#FF8C22'); body.addColorStop(1, '#B8440E');
  x.fillStyle = body;
  x.beginPath(); x.moveTo(22, 30); x.lineTo(42, 30); x.quadraticCurveTo(46, 30, 47, 36); x.lineTo(50, 72); x.lineTo(14, 72); x.lineTo(17, 36); x.quadraticCurveTo(18, 30, 22, 30); x.fill();
  x.fillStyle = '#5A1C06'; x.fillRect(14, 72, 36, 4);
  x.fillStyle = '#FFE7A0'; x.fillRect(29, 64, 6, 5);
  return texture(c);
}

/** A soft round spark, for the fireworks' flash. */
function sparkTexture(): Texture {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return texture(c);
}

/** The stars' look: a soft dot, the brightest with a cross of light; each twinkles on its own slow wave. */
const starMaterial = () => new ShaderMaterial({
  uniforms: { time: { value: 0 }, ratio: { value: 1 } },
  vertexShader: `
    attribute float size; attribute float phase; attribute vec3 tint;
    uniform float time; uniform float ratio;
    varying float vB; varying vec3 vTint; varying float vCross;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      vB = 0.7 + 0.3 * sin(time * (0.7 + phase * 0.9) + phase * 6.2831);
      vTint = tint; vCross = step(3.2, size);
      gl_PointSize = size * ratio * (vCross > 0.5 ? 3.0 : 1.0);
    }`,
  fragmentShader: `
    varying float vB; varying vec3 vTint; varying float vCross;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float core = smoothstep(vCross > 0.5 ? 0.17 : 0.5, 0.0, d);
      float arm = vCross * max(smoothstep(0.045, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)), smoothstep(0.045, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
      float a = clamp(core + arm * 0.8, 0.0, 1.0) * vB;
      gl_FragColor = vec4(vTint * a, a);
    }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending,
});

const STARS = 170, LANTERNS = 24, SHELLS = 3, SPARKS = 72;
const FIRE = ['#FF5C6A', '#FFD36B', '#7CF2A0', '#7FC6FF', '#C890FF', '#FF92D0', '#FFFFFF'];
type Kind = 'peony' | 'chrysanthemum' | 'ring' | 'willow';
const KINDS: Record<Kind, { life: number; radius: number; drag: number; fall: number; tail: number; glitter: boolean }> = {
  // Radius and fall in shares of the window's width: a burst opens to about a tenth of it and droops a little as it
  // fades, the willow most, so the shape stays a flower (a stronger pull read as rain).
  peony: { life: 2.0, radius: 0.1, drag: 3.2, fall: 0.008, tail: 0.09, glitter: false },
  chrysanthemum: { life: 2.4, radius: 0.115, drag: 2.8, fall: 0.01, tail: 0.2, glitter: true },
  ring: { life: 1.8, radius: 0.095, drag: 3.2, fall: 0.008, tail: 0.1, glitter: false },
  willow: { life: 2.8, radius: 0.11, drag: 2.2, fall: 0.016, tail: 0.3, glitter: true },
};
const CLIMB = 0.95, EVERY = 1.7;

export function FestivalSky({ place, version, reduced }: { place: { current: Place | null }; version: number; reduced: boolean }) {
  const scene = useThree((st) => st.scene);
  const gl = useThree((st) => st.gl);
  const tex = useMemo(() => ({ sky: backdrop(), moon: moonTexture(), lantern: lanternTexture(), spark: sparkTexture() }), []);
  useEffect(() => {
    const before = scene.background;
    scene.background = tex.sky;
    return () => { scene.background = before; };
  }, [scene, tex]);
  useEffect(() => () => { tex.sky.dispose(); tex.moon.dispose(); tex.lantern.dispose(); tex.spark.dispose(); }, [tex]);

  const parts = useMemo(() => {
    const sprite = (map: Texture, additive = false) => new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, ...(additive ? { blending: AdditiveBlending } : {}) }));
    // Stars: thicker toward the top, fewer toward the glow; a few large ones carry a cross of light.
    const stars = new Points(new BufferGeometry(), starMaterial());
    const sp = new Float32Array(STARS * 3), size = new Float32Array(STARS), phase = new Float32Array(STARS), tint = new Float32Array(STARS * 3);
    const tints = [new Color('#FFFFFF'), new Color('#FFF1C9'), new Color('#CFE0FF')];
    for (let i = 0; i < STARS; i++) {
      const big = hash(i, 9) > 0.94;
      size[i] = big ? 3.6 + hash(i, 4) * 1.2 : 1.2 + hash(i, 5) * 1.6;
      phase[i] = hash(i, 6);
      const t = tints[Math.floor(hash(i, 7) * 3)];
      tint.set([t.r, t.g, t.b], i * 3);
    }
    stars.geometry.setAttribute('position', new Float32BufferAttribute(sp, 3));
    stars.geometry.setAttribute('size', new Float32BufferAttribute(size, 1));
    stars.geometry.setAttribute('phase', new Float32BufferAttribute(phase, 1));
    stars.geometry.setAttribute('tint', new Float32BufferAttribute(tint, 3));
    stars.frustumCulled = false;
    const lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
    lines.geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(SHELLS * (SPARKS + 1) * 6), 3));
    lines.geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(SHELLS * (SPARKS + 1) * 6), 3));
    lines.frustumCulled = false;
    const heads = new Points(new BufferGeometry(), new PointsMaterial({ size: 3, sizeAttenuation: false, map: tex.spark, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
    heads.geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(SHELLS * (SPARKS + 1) * 3), 3));
    heads.geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(SHELLS * (SPARKS + 1) * 3), 3));
    heads.frustumCulled = false;
    return {
      stars, lines, heads,
      moon: sprite(tex.moon),
      // All the lanterns in one draw; light added, so a faint one is a dim glow, never grey.
      lanterns: (() => {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(new Float32Array(LANTERNS * 3), 3));
        g.setAttribute('size', new Float32BufferAttribute(new Float32Array(LANTERNS), 1));
        g.setAttribute('alpha', new Float32BufferAttribute(new Float32Array(LANTERNS), 1));
        const pts = new Points(g, spritePoints(tex.lantern));
        pts.frustumCulled = false;
        return pts;
      })(),
      flashes: Array.from({ length: SHELLS }, () => sprite(tex.spark, true)),
    };
  }, [tex]);

  /** The world length of a share of the window's width at depth k, here (for sizing things by the window). */
  const unit = useRef(new Map<number, number>());
  useEffect(() => {
    const at = place.current;
    if (!at) return;
    unit.current.clear();
    for (const k of [6, 8, 10, 12, 14, 16, 22]) {
      const a = at(0.45, 0.4, k), b = at(0.55, 0.4, k);
      if (a && b) unit.current.set(k, a.distanceTo(b) * 10);
    }
    const u = (k: number) => unit.current.get(k) ?? 1;
    // The stars, fixed: across the top, thinning down to the glow.
    const pos = parts.stars.geometry.getAttribute('position');
    for (let i = 0; i < STARS; i++) {
      const p = at(hash(i, 1), hash(i, 2) ** 1.6 * 0.62, 22);
      if (p) pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    // The moon, behind the far island C.
    const m = at(MOON.fx, MOON.fy, 22);
    if (m) { parts.moon.position.copy(m); parts.moon.scale.setScalar(u(22) * MOON.size * (MOON_PX / (2 * MOON_R))); }
  }, [place, version, parts]);

  const shells = useRef(Array.from({ length: SHELLS }, () => ({ slot: -1, start: -99, fx: 0, fy: 0, kind: 'peony' as Kind, c1: new Color(), c2: new Color(), dirs: [] as Vector3[] })));
  const v = useMemo(() => ({ b: new Vector3(), p: new Vector3(), q: new Vector3(), buf: new Vector2() }), []);
  useFrame(({ clock }) => {
    const at = place.current;
    if (!at || !unit.current.size) return;
    const u = (k: number) => unit.current.get(k) ?? 1;
    const t = reduced ? 0 : clock.elapsedTime;
    (parts.stars.material as ShaderMaterial).uniforms.time.value = t;
    (parts.stars.material as ShaderMaterial).uniforms.ratio.value = gl.getPixelRatio();
    // Sky lanterns rise from below the island and drift, the nearer ones larger, brighter and quicker.
    const lPos = parts.lanterns.geometry.getAttribute('position'), lSize = parts.lanterns.geometry.getAttribute('size'), lAlpha = parts.lanterns.geometry.getAttribute('alpha');
    (parts.lanterns.material as ShaderMaterial).uniforms.scale.value = gl.getDrawingBufferSize(v.buf).y / 2;
    for (let i = 0; i < LANTERNS; i++) {
      const k = [8, 10, 12, 14][i % 4], rise = 0.018 + hash(i, 11) * 0.012 * (10 / k);
      const fy = 1.08 - ((hash(i, 12) + t * rise) % 1.16), fx = hash(i, 13) * 0.96 + 0.02 + Math.sin(t * 0.4 + i) * 0.008;
      const p = at(fx, fy, k);
      if (!p) continue;
      lPos.setXYZ(i, p.x, p.y, p.z);
      lSize.setX(i, u(k) * (0.03 + hash(i, 14) * 0.012) * 1.5);
      // Fading in as it clears the island's glow, and out as it nears the lights along the top.
      lAlpha.setX(i, (0.6 + 0.4 * (8 / k)) * Math.min(1, (1.08 - fy) * 4, Math.max(0, (fy - 0.1) * 5)) * (0.9 + 0.1 * Math.sin(t * 3 + i)));
    }
    lPos.needsUpdate = lSize.needsUpdate = lAlpha.needsUpdate = true;
    // Fireworks: a shell every 1.7 s, either side of the podiums, never on the moon.
    const lp = parts.lines.geometry.getAttribute('position'), lc = parts.lines.geometry.getAttribute('color');
    const hp = parts.heads.geometry.getAttribute('position'), hc = parts.heads.geometry.getAttribute('color');
    parts.lines.visible = parts.heads.visible = !reduced;
    parts.flashes.forEach((f) => (f.visible = !reduced));
    if (reduced) return;
    const slot = Math.floor(t / EVERY);
    for (let n = slot; n > slot - SHELLS; n--) {
      const s = shells.current[((n % SHELLS) + SHELLS) % SHELLS];
      if (s.slot === n || n < 0) continue;
      const left = n % 2 === 0;
      s.slot = n; s.start = n * EVERY;
      // Where the sky is open: left of the stage, high, or beyond the moon by the board. Never over the moon, the
      // trophy or the podiums (between the trophy and the moon there is no room for a whole flower).
      const h1 = hash(n, 21), h2 = hash(n, 22);
      if (left) { s.fx = 0.05 + h1 * 0.22; s.fy = 0.1 + h2 * 0.2; }
      else { s.fx = 0.93 + h1 * 0.05; s.fy = 0.08 + h2 * 0.22; }
      s.kind = (['peony', 'chrysanthemum', 'ring', 'willow', 'peony', 'chrysanthemum'] as Kind[])[Math.floor(hash(n, 23) * 6)];
      s.c1.set(s.kind === 'willow' ? '#FFC65C' : FIRE[Math.floor(hash(n, 24) * FIRE.length)]);
      s.c2.set(s.kind === 'willow' ? '#FF9C3A' : FIRE[Math.floor(hash(n, 25) * FIRE.length)]);
      s.dirs = Array.from({ length: SPARKS }, (_, i) => {
        if (s.kind === 'ring') { const a = (i / SPARKS) * Math.PI * 2; return new Vector3(Math.cos(a), Math.sin(a) * 0.92, Math.sin(a) * 0.2); }
        const y = 1 - (2 * (i + 0.5)) / SPARKS, r = Math.sqrt(1 - y * y), a = i * 2.39996;
        return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      });
    }
    shells.current.forEach((s, j) => {
      const base = j * (SPARKS + 1), age = t - s.start, K = KINDS[s.kind], U = u(12);
      const burst = age - CLIMB, live = age >= 0 && burst < K.life;
      const b = at(s.fx, s.fy, 12);
      const flash = parts.flashes[j];
      // The rocket: a warm spark climbing on its trail, slowing as it nears the top.
      const climbing = live && age < CLIMB && b;
      const lift = (a: number) => { const e = 1 - (1 - Math.min(1, a / CLIMB)) ** 2; return at(s.fx + Math.sin(a * 18) * 0.002, 1.06 + (s.fy - 1.06) * e, 12); };
      // A short trail: a spark climbing, not a line drawn up the sky.
      const head = climbing ? lift(age) : null, tail = climbing ? lift(Math.max(0, age - 0.06)) : null;
      if (head && tail) {
        lp.setXYZ(base * 2, tail.x, tail.y, tail.z); lp.setXYZ(base * 2 + 1, head.x, head.y, head.z);
        lc.setXYZ(base * 2, 0, 0, 0); lc.setXYZ(base * 2 + 1, 0.9, 0.7, 0.45);
        hp.setXYZ(base, head.x, head.y, head.z); hc.setXYZ(base, 1, 0.9, 0.7);
      } else { lc.setXYZ(base * 2, 0, 0, 0); lc.setXYZ(base * 2 + 1, 0, 0, 0); hc.setXYZ(base, 0, 0, 0); }
      // The burst: each spark flies out, slowed by the air and pulled down, its trail behind it; the colour turns at
      // 45% of its life; it fades, and in the glittering kinds it flickers as it goes.
      const open = live && burst >= 0 && b;
      flash.visible = !!open && burst < 0.5;
      if (open) { flash.position.copy(b); flash.scale.setScalar(U * 0.07 * (1 + burst * 4)); flash.material.color.copy(s.c1); flash.material.opacity = Math.exp(-burst * 12) * 0.9; }
      for (let i = 0; i < SPARKS; i++) {
        const k = base + 1 + i;
        if (!open) { lc.setXYZ(k * 2, 0, 0, 0); lc.setXYZ(k * 2 + 1, 0, 0, 0); hc.setXYZ(k, 0, 0, 0); continue; }
        // Peonies and chrysanthemums carry an inner ring in the second colour (the pistil), at half the reach.
        const pistil = (s.kind === 'peony' || s.kind === 'chrysanthemum') && i % 3 === 0;
        const d = s.dirs[i], R = U * K.radius * (pistil ? 0.5 : 0.94 + hash(i, s.slot) * 0.12), G = U * K.fall;
        const where = (a: number, out: Vector3) => out.copy(b).addScaledVector(d, R * (1 - Math.exp(-K.drag * a))).setY(b.y + d.y * R * (1 - Math.exp(-K.drag * a)) - G * a * a);
        where(burst, v.p); where(Math.max(0, burst - K.tail), v.q);
        const life = burst / K.life, fade = (1 - life) ** 1.4;
        const flick = K.glitter && life > 0.5 ? (hash(i + Math.floor(t * 14), s.slot) > 0.45 ? 1 : 0.25) : 1;
        const c = pistil ? s.c2 : life < 0.45 ? s.c1 : s.c2, f = fade * flick;
        lp.setXYZ(k * 2, v.q.x, v.q.y, v.q.z); lp.setXYZ(k * 2 + 1, v.p.x, v.p.y, v.p.z);
        lc.setXYZ(k * 2, c.r * f * 0.08, c.g * f * 0.08, c.b * f * 0.08); lc.setXYZ(k * 2 + 1, c.r * f, c.g * f, c.b * f);
        hp.setXYZ(k, v.p.x, v.p.y, v.p.z); hc.setXYZ(k, Math.min(1, c.r * f + 0.25 * f), Math.min(1, c.g * f + 0.25 * f), Math.min(1, c.b * f + 0.25 * f));
      }
    });
    lp.needsUpdate = lc.needsUpdate = hp.needsUpdate = hc.needsUpdate = true;
  });

  return (
    <group>
      <primitive object={parts.stars} renderOrder={-5} />
      <primitive object={parts.moon} renderOrder={-4} />
      <primitive object={parts.lanterns} renderOrder={-2} />
      <primitive object={parts.lines} renderOrder={-1} />
      <primitive object={parts.heads} renderOrder={-1} />
      {parts.flashes.map((f, i) => <primitive key={`f${i}`} object={f} renderOrder={-1} />)}
    </group>
  );
}
