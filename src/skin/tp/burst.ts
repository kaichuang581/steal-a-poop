import { AdditiveBlending, CanvasTexture, Color, Group, Mesh, PointLight, Sprite, SpriteMaterial } from 'three';
import type { Material } from 'three';
import { Gather } from '../dream/models';
import { flatGlow, flatLit } from './models';
import { BURST_COLOURS, BURSTS, TIMINGS } from './models.gen';

/**
 * The ten bursts (docs/trading-post-practice/T3): each is its fullest moment from the pack, cut into its pieces (boxes
 * that touch), moved by one timing for all ten: out from the bomb's middle by 300 ms, then the burst's own ending, gone
 * by 1,400 ms. Nothing is random: every piece's path follows from its place and its index.
 */
export const BURST_OF: Record<string, string> = {
  'blast-frost': 'frost', 'blast-hay': 'hay', 'blast-snowfall': 'snowfall', 'blast-confetti': 'confetti', 'blast-ember': 'ember',
  'blast-bubblegum': 'bubblegum', 'blast-northern': 'northern', 'blast-solstice': 'solstice', 'blast-lantern': 'lantern', 'blast-starlight': 'starlight',
};
export const burstKeyOf = (itemId: string): string => BURST_OF[itemId] ?? 'frost';

export const OUT_MS = TIMINGS.burst.out_ms, TOTAL_MS = TIMINGS.burst.total_ms;
const HOLD: Record<string, number> = TIMINGS.burst.per_burst_hold_ms;
const ORIGIN = [0, 0.25, 0];

type Box = readonly [number, number, number, number, number, number, string, boolean];
/** Boxes that touch (share a face, an edge or overlap) make one piece. */
function piecesOf(boxes: readonly Box[]): Box[][] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const e = 0.01; // a quarter cell: a curtain's thin columns stand that close
  const n = (b: Box, k: number) => b[k] as number;
  const touch = (a: Box, b: Box) => [0, 1, 2].every((k) => n(a, k) <= n(b, k) + n(b, k + 3) + e && n(b, k) <= n(a, k) + n(a, k + 3) + e);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (touch(boxes[i], boxes[j])) parent[find(i)] = find(j);
  const groups = new Map<number, Box[]>();
  boxes.forEach((b, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), b]); });
  return [...groups.values()];
}

type Num6 = [number, number, number, number, number, number];
const boxesOf = (key: string): Num6[] => (BURSTS[key] ?? BURSTS.frost).boxes_at_fullest.map((b) => b.slice(0, 6) as Num6);

/**
 * Where a piece stands on a display stand (ITEMS_REMODEL.md rule 7, T3 section 3): drawn in, never shrunk. Its middle
 * moves to `spread` of its distance from the burst's own middle (across) and from its lowest piece (up), which sits
 * `lift` above the stand; the piece keeps its full size.
 */
export function drawIn(key: string, spread: number, lift = 0.08): (p: readonly [number, number, number]) => [number, number, number] {
  const bs = boxesOf(key);
  const mid = (k: number) => (Math.min(...bs.map((b) => b[k])) + Math.max(...bs.map((b) => b[k] + b[k + 3]))) / 2;
  const mx = mid(0), mz = mid(2);
  const low = Math.min(...bs.map((b) => b[1] + b[4] / 2)), half = Math.min(...bs.map((b) => b[4] / 2));
  return ([x, y, z]) => [(x - mx) * spread, lift + half + (y - low) * spread, (z - mz) * spread];
}

/**
 * A piece's size on a stand. Pieces keep their size (rule 8), except a length past 0.25 m (Northern Lights' curtains
 * stand up to 1.15 m), which draws in with the rest: the detail rule is about how narrow a part may be, not how long.
 */
export const LONG_M = 0.25;
export const standSize = (d: number, spread: number): number => (d > LONG_M ? Math.max(LONG_M, d * spread) : d);

/** How wide and tall a burst stands once drawn in by `spread`, metres, from the stand's top (its lift included). */
export function drawnSize(key: string, spread: number): [number, number] {
  const at = drawIn(key, spread);
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, z, w0, h0, d] of boxesOf(key)) {
    const [cx, cy] = at([x + w0 / 2, y + h0 / 2, z + d / 2]), w = standSize(w0, spread), h = standSize(h0, spread);
    x0 = Math.min(x0, cx - w / 2); x1 = Math.max(x1, cx + w / 2); y1 = Math.max(y1, cy + h / 2);
  }
  return [x1 - x0, y1];
}

/**
 * The draw-in that makes a burst fit a box `w` by `h` metres: the plan's `most` (0.42 on the bench, 0.67 on the Bell
 * Shelf) or less, so a wide or tall burst stays inside its frame. Pieces never shrink (ITEMS_REMODEL.md rule 7).
 */
export function fitSpread(key: string, w: number, h: number, most: number): number {
  const fits = (s: number) => { const [sw, sh] = drawnSize(key, s); return sw <= w && sh <= h; };
  if (fits(most)) return most;
  let lo = 0, hi = most;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  return lo;
}

interface Piece { mesh: Group; home: [number, number, number]; i: number; n: number; delay?: number }
export interface BurstObject {
  group: Group;
  key: string;
  /** Pose every piece at `ms` after the bang (0 to 1,400); 300 is the fullest moment. */
  at(ms: number, reduced?: boolean): void;
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** `spread`: drawn in for a display stand (drawIn), pieces at full size; omitted, the burst as it plays in a game. */
export function makeBurst(key: string, o: { lit?: Material; spread?: number } = {}): BurstObject {
  const data = BURSTS[key] ?? BURSTS.frost;
  const group = new Group();
  group.name = `burst_${key}`;
  const all = piecesOf(data.boxes_at_fullest);
  const pieces: Piece[] = all.map((boxes, i) => {
    // The piece's middle is its origin, so it can turn and shrink about itself.
    const c = [0, 1, 2].map((k) => { const lo = Math.min(...boxes.map((b) => b[k] as number)), hi = Math.max(...boxes.map((b) => (b[k] as number) + (b[k + 3] as number))); return (lo + hi) / 2; }) as [number, number, number];
    const lit = new Gather(), glow = new Gather();
    for (const b of boxes) {
      const col = new Color(data.colours[b[6]] ?? BURST_COLOURS[b[6]] ?? '#FFFFFF');
      // On a stand a long piece draws in with the rest (standSize); in a game every piece is its full size.
      const [w, h, d] = [b[3], b[4], b[5]].map((v) => (o.spread ? standSize(v, o.spread) : v));
      const [bx, by, bz] = [b[0] + b[3] / 2 - c[0], b[1] + b[4] / 2 - c[1], b[2] + b[5] / 2 - c[2]];
      (b[7] ? glow : lit).box([bx - w / 2, by - h / 2, bz - d / 2, bx + w / 2, by + h / 2, bz + d / 2], [col.r, col.g, col.b], 1, b[7]);
    }
    const g = new Group();
    if (!lit.empty) g.add(new Mesh(lit.geometry(), o.lit ?? flatLit));
    if (!glow.empty) g.add(new Mesh(glow.geometry(), flatGlow));
    group.add(g);
    return { mesh: g, home: o.spread ? drawIn(key, o.spread)(c) : c, i, n: all.length };
  });
  // In a game a burst plays with two echoes of itself, so it fills the air (Brian, 2026-11-25: "weak, small, and
  // flimsy"): its mirror image 70 ms later, and a tighter copy at 60% of the distance 140 ms later. Fixed copies of
  // fixed places: still nothing random.
  if (!o.spread) {
    const base = [...pieces];
    for (const { mirror, k, delay } of [{ mirror: true, k: 1, delay: 70 }, { mirror: false, k: 0.6, delay: 140 }]) {
      for (const p of base) {
        const mesh = p.mesh.clone();
        group.add(mesh);
        const [hx, hy, hz] = p.home;
        pieces.push({ mesh, home: [ORIGIN[0] + (hx - ORIGIN[0]) * k * (mirror ? -1 : 1), ORIGIN[1] + (hy - ORIGIN[1]) * k, hz * k], i: p.i + (mirror ? 1 : 2), n: p.n, delay });
      }
    }
  }
  const hold = HOLD[key] ?? 0;
  // The bang (in a game only, not on a stand): a flash of the burst's own light that swells and fades in 350 ms, and a
  // light that lights the sheep for a moment (Brian, 2026-11-25: the bursts were "weak, small, and flimsy").
  const flashColour = new Color(data.colours[data.boxes_at_fullest.find((b) => b[7])?.[6] ?? data.boxes_at_fullest[0][6]] ?? '#FFFFFF').lerp(new Color('#FFFFFF'), 0.55);
  let flash: Sprite | null = null, light: PointLight | null = null;
  if (!o.spread && typeof document !== 'undefined') {
    flash = new Sprite(new SpriteMaterial({ map: flashTexture(), color: flashColour, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    flash.position.set(ORIGIN[0], ORIGIN[1] + 0.2, 0.1);
    light = new PointLight(flashColour, 0, 7, 1.6);
    light.position.set(0, 0.6, 0.4);
    group.add(flash, light);
  }

  function at(ms: number, reduced = false): void {
    group.visible = ms >= 0 && ms < TOTAL_MS;
    if (!group.visible) return;
    if (flash && light) {
      const f = Math.max(0, 1 - ms / 350);
      flash.visible = f > 0;
      flash.scale.setScalar(1 + 2.6 * (1 - f * f));
      flash.material.opacity = f;
      light.intensity = 9 * Math.max(0, 1 - ms / 450);
    }
    for (const p of pieces) {
      const t = reduced ? (ms < 400 ? OUT_MS : OUT_MS + (ms - 400) * 4) : ms - (p.delay ?? 0);
      p.mesh.visible = t >= 0;
      if (t >= 0) pose(p, t, reduced ? Math.max(0, 1 - Math.max(0, ms - 400) / 200) : 1);
    }
  }

  function pose(p: Piece, ms: number, fadeIn: number): void {
    const { mesh: m, home: [hx, hy, hz], i, n } = p;
    const out = ease(ms / OUT_MS);
    const ph = i / Math.max(1, n); // each piece's own beat, from its place in the list
    const [ox, oy] = o.spread ? drawIn(key, o.spread)([ORIGIN[0], ORIGIN[1], 0]) : ORIGIN;
    let x = ox + (hx - ox) * out, y = oy + (hy - oy) * out, z = hz * out;
    // In a game the pieces burst out half again their size and settle by the fullest moment.
    let s = (0.3 + 0.7 * out) * (o.spread ? 1 : 1 + 0.5 * Math.sin(Math.min(1, ms / OUT_MS) * Math.PI)), rx = 0, rz = 0;
    const after = Math.max(0, ms - OUT_MS - hold), span = TOTAL_MS - OUT_MS - hold, u = Math.min(1, after / span);
    switch (key) {
      case 'confetti': y -= 0.9 * u * u; x += 0.06 * Math.sin(u * 9 + ph * 6); rx = u * Math.PI * (3 + (i % 3)); break;
      case 'snowfall': y -= 0.8 * u * u * (u > 0.15 ? 1 : 0); x += 0.1 * Math.sin(u * 8 + ph * 6); break;
      case 'hay': y = Math.max(0.03, y - 0.9 * u * u); rz = Math.min(1, u * 2) * Math.PI * 2 * (i % 2 ? 1 : -1); break;
      case 'lantern': y += 0.5 * u; x += 0.05 * Math.sin(u * 6 + ph * 6); break;
      case 'frost': if (after > 0) { y -= 0.8 * u * u; s *= 1 - 0.5 * Math.min(1, u * 3); } break;
      case 'northern': if (ms < OUT_MS) { s = 1; m.scale.set(1, Math.max(0.01, out), 1); } x += 0.08 * Math.sin(u * 7 - ph * 5); y += 0.4 * u; break;
      case 'starlight': y -= u > 0.3 ? 1.0 * (u - 0.3) ** 2 * 2 : 0; x += u > 0.3 ? -0.3 * (u - 0.3) : 0; s *= u < 0.3 ? 1 + 0.25 * Math.sin(u / 0.3 * Math.PI * 4) : 1; break;
      case 'ember': { const arc = Math.min(1, u * 1.4); y -= 0.9 * arc * arc; x += (hx - ORIGIN[0]) * 0.4 * arc; if (u > 0.3 + ph * 0.6) s = 0; break; }
      case 'bubblegum': x = hx; y = hy; z = hz; s = out; if (after > 0) { const popAt = (i % 3) * 150 + 200; s *= after < popAt ? 1 + 0.06 * Math.sin(after / 40) : 0; } break;
      case 'solstice': s *= 1 + 0.25 * Math.sin(Math.min(1, u * 2) * Math.PI); y -= 0.7 * Math.max(0, u - 0.5) * 2; break;
    }
    // Every piece is gone by the end: the last fifth shrinks it away.
    const fade = Math.min(1, (TOTAL_MS - ms) / 220) * fadeIn;
    s *= Math.max(0, fade);
    m.position.set(x, y, z);
    if (key !== 'northern' || ms >= OUT_MS) m.scale.setScalar(Math.max(0.0001, s));
    else m.scale.x = m.scale.z = Math.max(0.0001, s);
    m.rotation.set(rx, 0, rz);
  }

  at(OUT_MS);
  return { group, key, at };
}

/** A soft round glow for the flash, drawn once. */
let flashTex: CanvasTexture | null = null;
function flashTexture(): CanvasTexture {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (flashTex = new CanvasTexture(c));
}
