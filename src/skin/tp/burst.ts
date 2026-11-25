import { Color, Group, Mesh } from 'three';
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

interface Piece { mesh: Group; home: [number, number, number]; i: number; n: number }
export interface BurstObject {
  group: Group;
  key: string;
  /** Pose every piece at `ms` after the bang (0 to 1,400); 300 is the fullest moment. */
  at(ms: number, reduced?: boolean): void;
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export function makeBurst(key: string, o: { lit?: Material } = {}): BurstObject {
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
      (b[7] ? glow : lit).box([b[0] - c[0], b[1] - c[1], b[2] - c[2], b[0] + b[3] - c[0], b[1] + b[4] - c[1], b[2] + b[5] - c[2]], [col.r, col.g, col.b], 1, b[7]);
    }
    const g = new Group();
    if (!lit.empty) g.add(new Mesh(lit.geometry(), o.lit ?? flatLit));
    if (!glow.empty) g.add(new Mesh(glow.geometry(), flatGlow));
    group.add(g);
    return { mesh: g, home: c, i, n: all.length };
  });
  const hold = HOLD[key] ?? 0;

  function at(ms: number, reduced = false): void {
    group.visible = ms >= 0 && ms < TOTAL_MS;
    if (!group.visible) return;
    for (const p of pieces) pose(p, reduced ? (ms < 400 ? OUT_MS : OUT_MS + (ms - 400) * 4) : ms, reduced ? Math.max(0, 1 - Math.max(0, ms - 400) / 200) : 1);
  }

  function pose(p: Piece, ms: number, fadeIn: number): void {
    const { mesh: m, home: [hx, hy, hz], i, n } = p;
    const out = ease(ms / OUT_MS);
    const ph = i / Math.max(1, n); // each piece's own beat, from its place in the list
    let x = ORIGIN[0] + (hx - ORIGIN[0]) * out, y = ORIGIN[1] + (hy - ORIGIN[1]) * out, z = hz * out;
    let s = 0.3 + 0.7 * out, rx = 0, rz = 0;
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
