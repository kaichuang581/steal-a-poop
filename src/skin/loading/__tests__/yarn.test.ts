import { describe, expect, it } from 'vitest';
import { PLY, STRETCH, plyStrand } from '../yarn';
import type { Ctx } from '../yarn';
import { TOTAL, WORD } from '../yarnWord';

/** A stand-in canvas that records every stroke: its style, width and points. */
function recorder() {
  const strokes: { style: string; width: number; pts: number[] }[] = [];
  let pts: number[] = [];
  const ctx = {
    lineCap: 'butt', lineJoin: 'miter', strokeStyle: '', fillStyle: '', lineWidth: 1,
    beginPath() { pts = []; }, moveTo(x: number, y: number) { pts.push(x, y); }, lineTo(x: number, y: number) { pts.push(x, y); },
    quadraticCurveTo(a: number, b: number, x: number, y: number) { pts.push(a, b, x, y); },
    stroke() { strokes.push({ style: String(ctx.strokeStyle), width: ctx.lineWidth, pts }); },
    save() {}, restore() {}, translate() {}, arc() {}, clip() {}, fillRect() {},
  };
  return { ctx: ctx as unknown as Ctx, strokes };
}
const key = (s: { style: string; width: number; pts: number[] }) => `${s.style}|${s.width.toFixed(6)}|${s.pts.map((v) => v.toFixed(6)).join(',')}`;
const hw = PLY.width / 2, pr = hw * 0.56;
/** A ply piece's main stroke (as wide as the ply), and whether it is in front, from where it starts along the word. */
const pieces = (strokes: { style: string; width: number; pts: number[] }[]) => strokes.filter((s) => Math.abs(s.width - pr * 2) < 1e-9 && s.style.endsWith(',1)'));

describe('the yarn', () => {
  it('drawn in 10-unit stretches leaves the same last front piece, everywhere along the word, as drawn whole (no seam)', () => {
    const whole = recorder(), parts = recorder();
    plyStrand(whole.ctx, WORD.pts, 1, 0, TOTAL);
    for (let a = 0; a < TOTAL; a += STRETCH) plyStrand(parts.ctx, WORD.pts, 1, a, Math.min(TOTAL, a + STRETCH));
    // The last stroke drawn starting at each point is what shows there: the same in both.
    const last = (strokes: { style: string; width: number; pts: number[] }[]) => {
      const m = new Map<string, string>();
      for (const s of pieces(strokes)) m.set(`${s.pts[0].toFixed(4)},${s.pts[1].toFixed(4)}`, key(s));
      return m;
    };
    const a = last(whole.strokes), b = last(parts.strokes);
    expect(a.size).toBeGreaterThan(1000);
    expect(b.size).toBe(a.size);
    let differ = 0;
    for (const [at, k] of a) if (b.get(at) !== k) differ++;
    expect(differ).toBe(0);
  });

  it('makes the same calls on every run: no randomness', () => {
    const one = recorder(), two = recorder();
    plyStrand(one.ctx, WORD.pts, 1.5, 300, 420);
    plyStrand(two.ctx, WORD.pts, 1.5, 300, 420);
    expect(one.strokes.map(key)).toEqual(two.strokes.map(key));
    expect(one.strokes.length).toBeGreaterThan(500);
  });

  it('never draws a piece behind after a piece in front within a stretch', () => {
    // Where each ply piece starts and whether it is in front, as 3.2 says: the ply's centre sin(θ) (half-width less
    // the ply's radius) to the side of the word's line, in front when cos(θ) >= 0.
    const startOf = (s: number, ply: number) => {
      const q = WORD.pts[Math.round(s)], th = (s / PLY.pitch) * Math.PI * 2 + ply * Math.PI, off = Math.sin(th) * (hw - pr);
      return { at: `${(q.x - q.ty * off).toFixed(4)},${(q.y + q.tx * off).toFixed(4)}`, front: Math.cos(th) >= 0 };
    };
    for (let a = 0; a < TOTAL; a += 37 * STRETCH) {
      const b = Math.min(TOTAL, a + STRETCH), r = recorder();
      plyStrand(r.ctx, WORD.pts, 1, a, b);
      const drawn = pieces(r.strokes).map((st) => `${st.pts[0].toFixed(4)},${st.pts[1].toFixed(4)}`);
      // Where the two plies cross (sin θ = 0) both start at one point, one in front and one behind: those say nothing.
      const front = (at: string) => {
        const found = new Set<boolean>();
        for (let s = Math.max(0, a - 2); s <= b + 1; s += PLY.step) for (const ply of [0, 1]) { const p = startOf(s, ply); if (p.at === at) found.add(p.front); }
        if (!found.size) throw new Error(`no piece starts at ${at}`);
        return found.size === 1 ? [...found][0] : null;
      };
      const kinds = drawn.map(front).filter((k): k is boolean => k !== null);
      const firstFront = kinds.indexOf(true);
      expect(firstFront).toBeGreaterThan(0); // pieces behind first, then pieces in front
      expect(kinds.slice(firstFront).includes(false)).toBe(false);
    }
  });

  it('has no outline: no stroke wider than a ply, none near black, and nothing stroked over the whole strand', () => {
    const r = recorder();
    plyStrand(r.ctx, WORD.pts, 1, 0, 400);
    for (const s of r.strokes) {
      expect(s.width).toBeLessThanOrEqual(pr * 2 + 1e-9);
      const red = Number(s.style.slice(5).split(',')[0]);
      expect(red / PLY.base[0]).toBeGreaterThan(0.28);
    }
  });
});
