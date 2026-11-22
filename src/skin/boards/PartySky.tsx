import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry,
  Points, PointsMaterial, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
} from 'three';
import type { PerspectiveCamera, Texture } from 'three';
import { PARTY_SKY } from './sky';

/**
 * The leaderboards' sky (Brian, 2026-11-22: "make the background scenery cooler as well (the sky i mean, not anything
 * else) ... like an anime sky/day/night and give the vibes of more like a party"). It replaces the pale day dome of
 * version 2. A twilight in painted bands, deep indigo with stars at the top through violet and pink to a gold glow
 * below the island, behind the picture like a backdrop; flat cel-shaded clouds drifting along the glow; four
 * searchlights sweeping up from below; and fireworks bursting in the open sky to either side of the podiums. Under
 * reduced motion it is the same picture, still: no fireworks, the lights and clouds at rest, the stars unblinking.
 */

const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };
const texture = (c: HTMLCanvasElement) => { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

/** The backdrop: the bands blended, drawn once, set as the scene's background so it fills the canvas whatever its size. */
function backdrop(): Texture {
  const [c, x] = canvas(4, 512);
  const g = x.createLinearGradient(0, 0, 0, 512);
  for (const [f, col] of PARTY_SKY) g.addColorStop(f, col);
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 512);
  return texture(c);
}

/** A cel-shaded cloud: puffs in a lit pink-white over a lavender underside with a hard line between, a soft outline. */
function cloudTexture(seed: number): Texture {
  const [c, x] = canvas(512, 256);
  const rnd = (k: number) => { const s = Math.sin(seed * 91.7 + k * 12.9) * 43758.5; return s - Math.floor(s); };
  const puffs: [number, number, number][] = [];
  const n = 5 + Math.floor(rnd(1) * 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, r = 46 + rnd(i + 2) * 40 * Math.sin(Math.PI * t) + 20;
    puffs.push([60 + t * 392, 170 - r * 0.55 - rnd(i + 9) * 20, r]);
  }
  const shape = (dx: number, dy: number, grow: number) => {
    x.beginPath();
    for (const [px, py, r] of puffs) { x.moveTo(px + dx + r + grow, py + dy); x.arc(px + dx, py + dy, r + grow, 0, Math.PI * 2); }
    x.rect(60 + dx - grow, 150 + dy, 392 + 2 * grow, 50 + grow);
  };
  x.fillStyle = 'rgba(120, 70, 160, 0.35)'; shape(0, 0, 5); x.fill();        // a soft edge
  x.fillStyle = '#C99BD8'; shape(0, 0, 0); x.fill();                         // the shaded underside
  x.save(); shape(0, 0, 0); x.clip();
  x.fillStyle = '#FFE6F0'; shape(-10, -22, -4); x.fill();                    // the lit tops, cut hard above the shade
  x.fillStyle = '#FFFFFF'; shape(-18, -34, -18); x.fill();                   // a highlight on the crowns
  x.restore();
  return texture(c);
}

/** A searchlight's beam: bright at its foot, fading up its length, soft at its sides. */
function beamTexture(): Texture {
  const [c, x] = canvas(64, 512);
  const g = x.createLinearGradient(0, 512, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
  x.globalCompositeOperation = 'destination-in';
  const s = x.createLinearGradient(0, 0, 64, 0);
  s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.5, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = s; x.fillRect(0, 0, 64, 512);
  return texture(c);
}

/** A round soft spark, for stars and fireworks. */
export function sparkTexture(): Texture {
  const [c, x] = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return texture(c);
}

/** A point `k` times as far as the stage's middle, through a spot of the window (fractions across and down). */
type Place = (fx: number, fy: number, k: number) => Vector3 | null;

const STARS = 220, BURSTS = 4, SPARKS = 90;
/** How far each thing stands, in times the stage's own distance: what is k times as far must be k times as big. */
const K = { stars: 18, beams: 12, clouds: 16, fire: 15 } as const;
const FIRE = ['#FF6FB5', '#FFD45A', '#7FE3FF', '#B98CFF', '#FFFFFF', '#7CFFB2'];
const BEAMS = [{ fx: 0.08, tint: '#FFC2E6', phase: 0 }, { fx: 0.34, tint: '#A6ECFF', phase: 1.7 }, { fx: 0.66, tint: '#FFE6A0', phase: 3.1 }, { fx: 0.92, tint: '#D8B8FF', phase: 4.4 }];
const CLOUDS = [
  { fx: 0.05, fy: 0.72, w: 4.4, seed: 1, speed: 0.6 }, { fx: 0.32, fy: 0.86, w: 5.6, seed: 2, speed: 0.4 },
  { fx: 0.7, fy: 0.78, w: 5, seed: 3, speed: 0.5 }, { fx: 0.98, fy: 0.68, w: 3.8, seed: 4, speed: 0.7 }, { fx: 0.22, fy: 0.55, w: 2.8, seed: 5, speed: 0.8 },
];

/**
 * The sky. `place` turns a spot of the window into a point in the world (the stage's camera, as `Frame` stood it); it
 * is read when the window changes (`version`), so the clouds, lights and fireworks stay where the picture has room.
 */
export function PartySky({ place, version, reduced }: { place: { current: Place | null }; version: number; reduced: boolean }) {
  const scene = useThree((st) => st.scene);
  const camera = useThree((st) => st.camera) as PerspectiveCamera;
  const tex = useMemo(() => ({ sky: backdrop(), beam: beamTexture(), spark: sparkTexture(), clouds: CLOUDS.map((c) => cloudTexture(c.seed)) }), []);
  useEffect(() => {
    const before = scene.background;
    scene.background = tex.sky;
    return () => { scene.background = before; };
  }, [scene, tex]);
  useEffect(() => () => { tex.sky.dispose(); tex.beam.dispose(); tex.spark.dispose(); tex.clouds.forEach((t) => t.dispose()); }, [tex]);

  // Stars: fixed points in the top third of the window, twinkling.
  const stars = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(STARS * 3), 3));
    geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(STARS * 3).fill(1), 3));
    return new Points(geo, new PointsMaterial({ size: 1.6, map: tex.spark, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
  }, [tex]);
  const beams = useMemo(() => BEAMS.map((b) => new Mesh(new PlaneGeometry(1, 1).translate(0, 0.5, 0), new MeshBasicMaterial({ map: tex.beam, color: b.tint, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }))), [tex]);
  const clouds = useMemo(() => CLOUDS.map((_, i) => new Sprite(new SpriteMaterial({ map: tex.clouds[i], transparent: true, depthWrite: false, fog: false }))), [tex]);
  const fire = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(BURSTS * SPARKS * 3), 3));
    geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(BURSTS * SPARKS * 3), 3));
    const dirs = Array.from({ length: SPARKS }, (_, i) => {
      // Evenly round a sphere (a golden-angle spiral), so each burst is a full round flower.
      const y = 1 - (2 * (i + 0.5)) / SPARKS, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
    return { points: new Points(geo, new PointsMaterial({ size: 1.3, map: tex.spark, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false })), dirs };
  }, [tex]);
  const root = useRef<Group>(null);
  const spots = useRef<{ stars: Vector3[]; beams: Vector3[]; clouds: Vector3[] } | null>(null);

  useEffect(() => {
    const at = place.current;
    if (!at) return;
    // Stars across the top third; beams rooted under the picture; clouds along the glow.
    const rnd = (k: number) => { const s = Math.sin(k * 127.1) * 43758.5453; return s - Math.floor(s); };
    const s: Vector3[] = [];
    for (let i = 0; i < STARS; i++) { const p = at(rnd(i + 1), rnd(i + 500) ** 1.4 * 0.5, K.stars); if (p) s.push(p); }
    const pos = stars.geometry.getAttribute('position');
    s.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
    pos.needsUpdate = true;
    stars.geometry.setDrawRange(0, s.length);
    spots.current = {
      stars: s,
      beams: BEAMS.map((b) => at(b.fx, 1.25, K.beams) ?? new Vector3()),
      clouds: CLOUDS.map((c) => at(c.fx, c.fy, K.clouds) ?? new Vector3()),
    };
    // A cloud's width is given as it looks at the stage's distance (metres), so it is drawn K times that far off.
    clouds.forEach((sp, i) => { sp.position.copy(spots.current!.clouds[i]); sp.scale.set(CLOUDS[i].w * K.clouds, CLOUDS[i].w * K.clouds / 2, 1); });
  }, [place, version, stars, clouds]);

  const burstAt = useRef(Array.from({ length: BURSTS }, (_, i) => ({ t: -10 - i, at: new Vector3(), col: new Color() })));
  useFrame(({ clock }) => {
    const sp = spots.current, at = place.current;
    if (!sp || !at) return;
    const t = reduced ? 0 : clock.elapsedTime;
    // Twinkle: each star's brightness on its own slow wave.
    const col = stars.geometry.getAttribute('color');
    for (let i = 0; i < sp.stars.length; i++) { const k = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * (1.3 + (i % 7) * 0.31) + i); col.setXYZ(i, k, k, k * 0.95); }
    col.needsUpdate = true;
    // The searchlights sweep 22 degrees either way, each at its own pace, always turned to face the camera.
    beams.forEach((m, i) => {
      const p = sp.beams[i];
      m.position.copy(p);
      m.quaternion.copy(camera.quaternion);
      m.rotateZ(Math.sin(t * 0.35 + BEAMS[i].phase) * 0.38 + (BEAMS[i].fx - 0.5) * -0.5);
      m.scale.set(0.7 * K.beams, 11 * K.beams, 1);
    });
    // The clouds drift right and come round again.
    clouds.forEach((c, i) => {
      const base = sp.clouds[i], drift = ((t * CLOUDS[i].speed * 0.004 + CLOUDS[i].fx + 0.15) % 1.3) - 0.15;
      const p = reduced ? base : at(drift, CLOUDS[i].fy, K.clouds);
      if (p) c.position.copy(p);
    });
    // Fireworks: a new one every 1.3 s in the open sky either side of the podiums; each opens, falls and fades in 2.2 s.
    const pos = fire.points.geometry.getAttribute('position'), fc = fire.points.geometry.getAttribute('color');
    fire.points.visible = !reduced;
    if (!reduced) {
      const slot = Math.floor(t / 1.3), b = burstAt.current[slot % BURSTS];
      if (b.t !== slot * 1.3) {
        const h = (k: number) => { const s2 = Math.sin(slot * 78.233 + k * 37.719) * 43758.5453; return s2 - Math.floor(s2); };
        const side = h(1) < 0.5 ? 0.06 + h(2) * 0.24 : 0.7 + h(2) * 0.26;
        const p = at(side, 0.08 + h(3) * 0.3, K.fire);
        if (p) { b.t = slot * 1.3; b.at.copy(p); b.col.set(FIRE[Math.floor(h(4) * FIRE.length)]); }
      }
      burstAt.current.forEach((bb, j) => {
        const age = t - bb.t, live = age >= 0 && age < 2.2;
        // As seen at the stage: a flower 1.3 m across, falling 0.15 m a second squared.
        const spread = 0.95 * K.fire * (1 - Math.exp(-age * 3)), fall = 0.15 * K.fire * age * age, fade = live ? Math.max(0, 1 - age / 2.2) ** 1.2 : 0;
        for (let i = 0; i < SPARKS; i++) {
          const d = fire.dirs[i], k = j * SPARKS + i;
          pos.setXYZ(k, bb.at.x + d.x * spread, bb.at.y + d.y * spread - fall, bb.at.z + d.z * spread);
          fc.setXYZ(k, bb.col.r * fade, bb.col.g * fade, bb.col.b * fade);
        }
      });
      pos.needsUpdate = true; fc.needsUpdate = true;
      fire.points.material.size = 0.3 * K.fire;
    }
    stars.material.size = 0.085 * K.stars;
  });

  return (
    <group ref={root}>
      {clouds.map((c, i) => <primitive key={`c${i}`} object={c} renderOrder={-3} />)}
      {beams.map((m, i) => <primitive key={`b${i}`} object={m} renderOrder={-2} />)}
      <primitive object={stars} renderOrder={-1} />
      <primitive object={fire.points} renderOrder={-1} />
    </group>
  );
}
