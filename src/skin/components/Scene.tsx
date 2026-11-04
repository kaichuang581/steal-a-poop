import { useEffect, useRef } from 'react';
import { LANTERN, PAL, SEASON_LEAF, SNOW, WARM_WOOD, WATER } from '../styles/palette';
import type { ScenePalette } from '../styles/palette';
import type { Hour, Place, Season, Weather } from '../model/types';

interface Props {
  place: Place;
  hour: Hour;
  season: Season;
  /** 0..1 */
  wind: number;
  /** Stops ambient motion and keeps the last frame (steal window). */
  frozen: boolean;
  weather?: Weather;
  /** Reduced motion: one static frame. */
  still?: boolean;
}

/**
 * The painted backdrop: layered hills, sky, a tree, grass, clouds and small lights, drawn procedurally on one canvas.
 * Static layers are baked once per hour/size; only light moving parts are drawn per frame. When painted image assets
 * arrive they replace this behind the same props.
 */
export function Scene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const api = useRef<ReturnType<typeof createScene> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const s = createScene(canvas, () => live.current);
    api.current = s;
    return () => s.destroy();
  }, []);

  useEffect(() => api.current?.rebake(), [props.hour, props.season, props.place]);
  useEffect(() => api.current?.syncRunning(), [props.frozen, props.still]);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" data-scene={props.place} />;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(h: string, k: number) {
  const [r, g, b] = hex2rgb(h);
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `rgb(${f(r + k)},${f(g + k)},${f(b + k)})`;
}
function rgba(h: string, a: number) {
  const [r, g, b] = hex2rgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

let grainCanvas: HTMLCanvasElement | null = null;
function grain() {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  const id = g.createImageData(160, 160);
  const r = rng(7);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 180 + Math.floor(r() * 75);
    id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = Math.floor(r() * 40);
  }
  g.putImageData(id, 0, 0);
  return (grainCanvas = c);
}

type HillFn = (x: number) => number;
const hillFn = (base: number, amp: number, freq: number, phase: number): HillFn => (x) =>
  base + amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.22 + Math.sin(x * freq * 0.47 + phase * 0.3) * 0.4);

function createScene(canvas: HTMLCanvasElement, opts: () => Props) {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, DPR = 1, raf = 0, running = false, t0 = performance.now(), lastT = 0;
  let stat: HTMLCanvasElement | null = null;
  let prevStat: HTMLCanvasElement | null = null;
  let fadeStart = 0;
  let hills: { far: HillFn; mid: HillFn; near: HillFn };
  type Cloud = { x: number; y: number; s: number; v: number; puffs: { dx: number; dy: number; rx: number; ry: number }[] };
  let clouds: Cloud[] = [];
  let blades: { x: number; y: number; len: number; lean: number; ph: number; sp: number; c: number }[] = [];
  let stars: { x: number; y: number; r: number; ph: number }[] = [];
  let flies: { x: number; y: number; vx: number; ph: number; sp: number }[] = [];
  let drops: { x: number; y: number; v: number }[] = [];
  let leaves: { x: number; y: number; vx: number; vy: number; ph: number; c: number }[] = [];
  let tree = { x: 0, y: 0, blobs: [] as { dx: number; dy: number; rx: number; ry: number; c: number }[] };

  const pal = (): ScenePalette => PAL[opts().hour];
  const leafColors = () => (opts().season === 'summer' ? pal().leaf : SEASON_LEAF[opts().season as Exclude<Season, 'summer'>]);
  const groundY = () => (opts().place === 'pier' ? H * 0.8 : H * 0.745);

  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(240, Math.round(r.width));
    H = Math.max(140, Math.round(r.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    hills = { far: hillFn(H * 0.56, H * 0.045, 0.006, 1.2), mid: hillFn(H * 0.64, H * 0.05, 0.0085, 2.6), near: hillFn(H * 0.715, H * 0.035, 0.011, 0.4) };
    seed();
    stat = bake();
    prevStat = null;
    draw(lastT);
  }

  function fillHill(g: CanvasRenderingContext2D, fn: HillFn, color: string, texSeed: number) {
    g.save();
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, fn(x));
    g.lineTo(W, H); g.closePath();
    g.fillStyle = color; g.fill(); g.clip();
    const r = rng(texSeed);
    const n = Math.round(W * 0.9 * (W < 720 ? 0.5 : 1));
    for (let i = 0; i < n; i++) {
      const x = r() * W, top = fn(x), y = top + r() * (H - top) * 0.55;
      g.globalAlpha = 0.08 + r() * 0.08;
      g.fillStyle = tint(color, (r() - 0.5) * 26);
      g.beginPath(); g.ellipse(x, y, 8 + r() * 26, 4 + r() * 10, (r() - 0.5) * 0.8, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.35; g.strokeStyle = tint(color, 34); g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = fn(x) + 1.5; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    g.restore();
  }

  /** Static layers: sky, sun or moon, hills with fog, ground (or water at the pier), the place's frame, grain. */
  function bake() {
    const p = pal();
    const { place, season } = opts();
    const c = document.createElement('canvas');
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    const g = c.getContext('2d')!;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, H * 0.68);
    sky.addColorStop(0, p.skyTop); sky.addColorStop(0.55, p.skyMid); sky.addColorStop(1, p.horizon);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const sx = W * p.sunPos[0], sy = H * p.sunPos[1], sr = Math.min(W, H) * p.sunR;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
    glow.addColorStop(0, rgba(p.sun, 0.55)); glow.addColorStop(0.35, rgba(p.sun, 0.18)); glow.addColorStop(1, rgba(p.sun, 0));
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = p.sun; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    if (opts().hour === 'night') {
      g.fillStyle = p.skyTop; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.82, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    fillHill(g, hills.far, p.far, 31);
    g.save();
    const fog = g.createLinearGradient(0, H * 0.5, 0, H * 0.68);
    fog.addColorStop(0, rgba(p.horizon, 0)); fog.addColorStop(1, rgba(p.horizon, p.fog));
    g.fillStyle = fog; g.fillRect(0, H * 0.48, W, H * 0.22);
    g.restore();
    fillHill(g, hills.mid, p.mid, 52);
    fillHill(g, hills.near, p.near, 73);
    const gy = groundY();
    if (place === 'pier') {
      const water = g.createLinearGradient(0, H * 0.74, 0, H);
      water.addColorStop(0, rgba(WATER[1], 0.95)); water.addColorStop(1, rgba(WATER[0], 1));
      g.fillStyle = water; g.fillRect(0, H * 0.745, W, H * 0.26);
      g.strokeStyle = rgba(p.horizon, 0.35); g.lineWidth = 2;
      const r = rng(5);
      for (let i = 0; i < 40; i++) { const x = r() * W, y = H * 0.76 + r() * H * 0.22; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 + r() * 30, y); g.stroke(); }
      g.fillStyle = WARM_WOOD;
      g.fillRect(W * 0.08, gy, W * 0.84, H * 0.035);
      for (let x = W * 0.1; x < W * 0.92; x += W * 0.12) g.fillRect(x, gy, 8, H - gy);
    } else {
      const gr = g.createLinearGradient(0, H * 0.74, 0, H);
      gr.addColorStop(0, p.near); gr.addColorStop(1, season === 'winter' ? SNOW : p.ground);
      g.fillStyle = gr; g.fillRect(0, gy, W, H - gy);
    }
    if (place === 'porch' || place === 'kitchen') {
      // A wooden frame in the foreground: porch posts and eave, or the kitchen window.
      g.fillStyle = WARM_WOOD;
      const post = Math.max(14, W * 0.025);
      g.fillRect(0, 0, W, H * 0.06);
      g.fillRect(0, 0, post, H); g.fillRect(W - post, 0, post, H);
      if (place === 'kitchen') { g.fillRect(0, H - H * 0.06, W, H * 0.06); g.fillRect(W / 2 - post / 4, 0, post / 2, H * 0.6); }
    }
    if (place === 'teahouse') {
      g.strokeStyle = WARM_WOOD; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, H * 0.06); g.quadraticCurveTo(W / 2, H * 0.16, W, H * 0.06); g.stroke();
      for (let i = 1; i < 8; i++) {
        const x = (W * i) / 8, y = H * 0.06 + Math.sin((i / 8) * Math.PI) * H * 0.1;
        const lg = g.createRadialGradient(x, y + 10, 0, x, y + 10, 30);
        lg.addColorStop(0, rgba(LANTERN, 0.6)); lg.addColorStop(1, rgba(LANTERN, 0));
        g.fillStyle = lg; g.fillRect(x - 30, y - 20, 60, 60);
        g.fillStyle = LANTERN; g.beginPath(); g.ellipse(x, y + 10, 7, 10, 0, 0, Math.PI * 2); g.fill();
      }
    }
    g.save(); g.globalAlpha = 0.07; g.fillStyle = g.createPattern(grain(), 'repeat')!; g.fillRect(0, 0, W, H); g.restore();
    return c;
  }

  /** Moving things are seeded deterministically so screenshots are stable. Phones get fewer of them. */
  function seed() {
    const r = rng(11);
    const phone = W < 720;
    clouds = [];
    const nc = phone ? 3 : Math.max(3, Math.round(W / 230));
    for (let i = 0; i < nc; i++) {
      const puffs = [];
      const np = 5 + Math.floor(r() * 3);
      for (let j = 0; j < np; j++) puffs.push({ dx: (j - np / 2) * 22 + (r() - 0.5) * 12, dy: (r() - 0.5) * 14 - Math.abs(j - np / 2) * 3, rx: 22 + r() * 22, ry: 14 + r() * 10 });
      clouds.push({ x: r() * W, y: H * (0.07 + r() * 0.3), s: 0.55 + r() * 0.9, v: 5 + r() * 9, puffs });
    }
    blades = [];
    if (opts().place !== 'pier') {
      const nb = Math.round((W / 4.2) * (phone ? 0.5 : 1));
      for (let i = 0; i < nb; i++) {
        const x = r() * W;
        blades.push({ x, y: hills.near(x) + 2 + r() * H * 0.07, len: 14 + r() * 30, lean: (r() - 0.5) * 10, ph: r() * 6.28, sp: 0.8 + r() * 0.8, c: Math.floor(r() * 3) });
      }
    }
    stars = Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H * 0.5, r: 0.6 + r() * 1.3, ph: r() * 6.28 }));
    flies = Array.from({ length: phone ? 17 : 34 }, () => ({ x: r() * W, y: H * (0.45 + r() * 0.4), vx: (r() - 0.5) * 8, ph: r() * 6.28, sp: 1 + r() * 2 }));
    drops = Array.from({ length: phone ? 60 : 120 }, () => ({ x: r() * W, y: r() * H, v: 380 + r() * 220 }));
    leaves = [];
    // The tree stands left: player cards sit on the right on wide screens.
    const tx = W * 0.16, ty = hills.near(tx) - 2;
    tree = { x: tx, y: ty, blobs: Array.from({ length: 9 }, () => ({ dx: (r() - 0.5) * 110, dy: -70 - r() * 80, rx: 34 + r() * 30, ry: 26 + r() * 22, c: Math.floor(r() * 3) })) };
  }

  function drawClouds(g: CanvasRenderingContext2D, t: number, p: ScenePalette, wind: number) {
    for (const c of clouds) {
      const x = ((c.x + t * c.v * wind) % (W + 300)) - 150;
      g.save(); g.translate(x, c.y); g.scale(c.s, c.s);
      g.fillStyle = p.cloudShade;
      for (const q of c.puffs) { g.beginPath(); g.ellipse(q.dx, q.dy + 8, q.rx, q.ry, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = p.cloud;
      for (const q of c.puffs) { g.beginPath(); g.ellipse(q.dx, q.dy, q.rx, q.ry, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }
  function drawTree(g: CanvasRenderingContext2D, t: number, p: ScenePalette, wind: number) {
    const sway = Math.sin(t * 0.6) * 2.2 * wind;
    const colors = leafColors();
    g.save(); g.translate(tree.x, tree.y);
    g.fillStyle = tint(p.near, -60);
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -75); g.lineTo(6, -75); g.lineTo(11, 0); g.closePath(); g.fill();
    g.strokeStyle = tint(p.near, -60); g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3, -70); g.lineTo(-30, -105); g.moveTo(3, -72); g.lineTo(28, -110); g.stroke();
    g.translate(sway, 0); g.rotate(sway * 0.004);
    // Winter: bare branches with a little snow on top.
    const blobs = opts().season === 'winter' ? tree.blobs.slice(0, 3).map((b) => ({ ...b, ry: b.ry * 0.35 })) : tree.blobs;
    for (const b of blobs) { g.fillStyle = colors[b.c]; g.globalAlpha = 0.95; g.beginPath(); g.ellipse(b.dx, b.dy, b.rx, b.ry, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.5; g.fillStyle = colors[1];
    for (const b of blobs) { g.beginPath(); g.ellipse(b.dx - b.rx * 0.25, b.dy - b.ry * 0.3, b.rx * 0.45, b.ry * 0.4, -0.5, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function drawGrass(g: CanvasRenderingContext2D, t: number, p: ScenePalette, wind: number) {
    g.lineCap = 'round';
    for (const b of blades) {
      const sway = Math.sin(t * b.sp + b.ph) * 6 * wind + Math.sin(t * 0.4 + b.x * 0.01) * 4 * wind;
      g.strokeStyle = p.grass[b.c]; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + sway * 0.4, b.y - b.len * 0.55, b.x + b.lean + sway, b.y - b.len); g.stroke();
    }
  }
  function drawFlies(g: CanvasRenderingContext2D, t: number, p: ScenePalette) {
    if (!p.flies) return;
    for (let i = 0; i < flies.length * p.flies; i++) {
      const f = flies[i];
      const x = f.x + Math.sin(t * 0.3 + f.ph) * 30 + t * f.vx * 0.4, y = f.y + Math.cos(t * 0.25 + f.ph) * 18;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * f.sp + f.ph));
      const xx = (((x % (W + 40)) + (W + 40)) % (W + 40)) - 20;
      const gl = g.createRadialGradient(xx, y, 0, xx, y, 9);
      gl.addColorStop(0, `rgba(247,226,122,${a})`); gl.addColorStop(1, 'rgba(247,226,122,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(xx, y, 9, 0, Math.PI * 2); g.fill();
    }
  }
  function drawStars(g: CanvasRenderingContext2D, t: number, p: ScenePalette) {
    if (!p.stars) return;
    for (const s of stars) {
      g.fillStyle = `rgba(255,250,230,${p.stars * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph)) * 0.9})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    }
  }
  function drawLeaves(g: CanvasRenderingContext2D, t: number, wind: number, many: boolean) {
    if (opts().hour === 'night') return;
    const colors = leafColors();
    if (leaves.length < (many ? 16 : 6) && Math.random() < (many ? 0.08 : 0.02) * wind) {
      leaves.push({ x: tree.x + (Math.random() - 0.5) * 100, y: tree.y - 110 + Math.random() * 40, vx: 8 + Math.random() * 10, vy: 14 + Math.random() * 10, ph: Math.random() * 6.28, c: Math.floor(Math.random() * 3) });
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.x += (l.vx * wind + Math.sin(t * 2 + l.ph) * 12) / 60;
      l.y += l.vy / 60;
      if (l.y > H * 0.78 || l.x > W + 20) leaves.splice(i, 1);
      else { g.save(); g.translate(l.x, l.y); g.rotate(Math.sin(t * 3 + l.ph)); g.fillStyle = colors[l.c]; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    }
  }
  function drawWeather(g: CanvasRenderingContext2D, t: number, weather: Weather) {
    if (weather === 'mist') {
      g.fillStyle = rgba(pal().horizon, 0.28); g.fillRect(0, H * 0.45, W, H * 0.55);
    } else if (weather === 'rain' || weather === 'snow') {
      g.strokeStyle = 'rgba(159,183,214,0.55)'; g.fillStyle = SNOW; g.lineWidth = 1.2;
      for (const d of drops) {
        const speed = weather === 'snow' ? d.v * 0.12 : d.v;
        const y = (d.y + t * speed) % H;
        const x = (d.x + (weather === 'snow' ? Math.sin(t + d.x) * 10 : y * 0.1)) % W;
        if (weather === 'rain') { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 12); g.stroke(); }
        else { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
      }
    }
  }

  function draw(t: number) {
    const p = pal();
    const { wind, weather = 'none' } = opts();
    ctx.clearRect(0, 0, W, H);
    // Hour change: crossfade the old static layers out over 2 s, never a cut.
    const fade = prevStat ? Math.min(1, (performance.now() - fadeStart) / 2000) : 1;
    if (prevStat && fade < 1) {
      ctx.drawImage(prevStat, 0, 0, W, H);
      ctx.globalAlpha = fade;
    } else prevStat = null;
    if (stat) ctx.drawImage(stat, 0, 0, W, H);
    ctx.globalAlpha = 1;
    drawStars(ctx, t, p);
    drawClouds(ctx, t, p, wind);
    if (opts().place !== 'pier') drawTree(ctx, t, p, wind);
    drawLeaves(ctx, t, wind, weather === 'leaves');
    drawGrass(ctx, t, p, wind);
    drawFlies(ctx, t, p);
    drawWeather(ctx, t, weather);
  }

  function loop(now: number) {
    if (!running) return;
    lastT = (now - t0) / 1000;
    draw(lastT);
    raf = requestAnimationFrame(loop);
  }
  function syncRunning() {
    const { frozen, still } = opts();
    const want = !frozen && !still && !document.hidden;
    if (want && !running) {
      running = true;
      t0 = performance.now() - lastT * 1000;
      raf = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
    if (!running) draw(lastT);
  }
  function rebake() {
    if (!W) return;
    prevStat = stat;
    fadeStart = performance.now();
    seed();
    stat = bake();
    if (!running) {
      // Still frames still crossfade: draw a few frames over the 2 s fade.
      const step = () => { draw(lastT); if (prevStat) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  }

  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = window.setTimeout(resize, 120); };
  const onVis = () => syncRunning();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  resize();
  syncRunning();
  return {
    rebake,
    syncRunning,
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(rt);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
