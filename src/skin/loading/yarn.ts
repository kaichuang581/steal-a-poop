/**
 * The loading screen's yarn, drawn on a canvas (docs/landing/LANDING-PLAN.md 3.2 and 3.3, Appendices B and C): the
 * prototype's own code, ported as it is, every number kept. Yarn as it is made: two plies twisted round each other,
 * each a round strand of fine fibres, lit from the upper left; no outline, no stripes, no gloss. And the yarn ball's
 * wraps, which tools/renderYarnBall.mjs bakes into public/loading/yarn-ball.webp. No imports.
 */

/** One place along the word (yarnWord.ts `Sample`), in word units. */
interface Pt { x: number; y: number; s: number; tx: number; ty: number }
/** What of a 2D context this file uses: a canvas's, or a stand-in that records the calls. */
export type Ctx = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'stroke' | 'save' | 'restore' | 'translate' | 'arc' | 'clip' | 'fillRect'>
  & { lineCap: CanvasLineCap; lineJoin: CanvasLineJoin; strokeStyle: string | CanvasGradient | CanvasPattern; fillStyle: string | CanvasGradient | CanvasPattern; lineWidth: number };

export const PLY = { width: 10, pitch: 26, base: [196, 74, 58] as const, fibres: 7, fibreTwist: 9, haloLen: 1.4, haloEvery: 1.8, step: 0.25 };
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const colour = (base: readonly number[], f: number, a = 1) => `rgba(${base.map((v) => Math.max(0, Math.min(255, v * f)) | 0).join(',')},${a})`;

// plyStrand() lays the strand along a line of samples ({x, y, s, tx, ty} in word units, k px per unit) from s = a to
// s = b, so it can be drawn a little at a time: what is drawn later lies on top, as a later pass of real yarn does.
// Every "random" number is a hash of the place along the strand, so pieces give the same picture as the whole.
export function plyStrand(ctx: Ctx, pts: readonly Pt[], k: number, a: number, b: number, o: Partial<typeof PLY> & { halo?: boolean } = {}) {
  const F = Object.assign({}, PLY, o), hw = F.width / 2, pr = hw * 0.56, Lx = -Math.SQRT1_2, Ly = -Math.SQRT1_2;
  const at = (s: number, ply: number) => {
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(s / (pts[1].s - pts[0].s)))), q = pts[i], nx = -q.ty, ny = q.tx;
    const th = (s / F.pitch) * Math.PI * 2 + ply * Math.PI, off = Math.sin(th) * (hw - pr);
    return { x: (q.x + nx * off) * k, y: (q.y + ny * off) * k, depth: Math.cos(th), nx, ny, th, q };
  };
  ctx.lineCap = 'round';
  const piece = (s: number, ply: number, front: boolean) => {
    const p = at(s, ply), q = at(s + F.step, ply);
    if ((p.depth >= 0) !== front) return;
    const facing = p.nx * Lx + p.ny * Ly, lit = 0.62 + 0.28 * p.depth + 0.18 * Math.max(0, facing) * Math.sin(p.th);
    ctx.strokeStyle = colour(F.base, lit); ctx.lineWidth = pr * 2 * k;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    const sg = facing > 0 ? 1 : -1, ox = sg * p.nx * pr * 0.35 * k, oy = sg * p.ny * pr * 0.35 * k;   // the ply's roundness
    ctx.strokeStyle = colour(F.base, lit * 1.14, 0.55); ctx.lineWidth = pr * 0.9 * k;
    ctx.beginPath(); ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(q.x + ox, q.y + oy); ctx.stroke();
  };
  const steps = (from: number, to: number, fn: (s: number) => void) => { for (let s = Math.ceil(from / F.step - 1e-9) * F.step; s + F.step <= to + 1e-9; s += F.step) fn(s); };
  // every piece behind first, then every piece in front (and the front of the unit before `a` again, so stretches
  // join without a seam): no piece behind is ever drawn over one in front
  steps(a, b, (s) => { piece(s, 0, false); piece(s, 1, false); });
  steps(Math.max(0, a - 1), b, (s) => {
    piece(s, 0, true); piece(s, 1, true);
    for (let ply = 0; ply < 2; ply++) for (let f = 0; f < F.fibres; f++) {   // fibres, twisting the other way
      const ph = hash(f * 7 + ply * 101) * Math.PI * 2, t1 = ph - (s / F.fibreTwist) * Math.PI * 2, t2 = ph - ((s + F.step) / F.fibreTwist) * Math.PI * 2;
      const p = at(s, ply), q = at(s + F.step, ply);
      if (Math.cos(t1) < 0.2 || p.depth < 0.15) continue;
      const o1 = Math.sin(t1) * pr * 0.8 * k, o2 = Math.sin(t2) * pr * 0.8 * k;
      ctx.strokeStyle = colour(F.base, (0.85 + hash(f + ply * 13) * 0.35) * (0.8 + 0.3 * p.depth), 0.22); ctx.lineWidth = 0.3 * k;
      ctx.beginPath(); ctx.moveTo(p.x + p.nx * o1, p.y + p.ny * o1); ctx.lineTo(q.x + q.nx * o2, q.y + q.ny * o2); ctx.stroke();
    }
    const h = hash(Math.round(s / F.step) + 0.5);                          // now and then a loose fibre end
    if (s >= a && o.halo !== false && h < F.step / F.haloEvery) {
      const q = at(s, 0).q, side = hash(s * 3.1) < 0.5 ? -1 : 1, nx = -q.ty * side, ny = q.tx * side, len = (0.5 + hash(s * 5.7) * F.haloLen) * k;
      const ox = (q.x + nx * (hw - 0.4)) * k, oy = (q.y + ny * (hw - 0.4)) * k, lean = (hash(s * 9.3) - 0.3) * 1.2;
      ctx.strokeStyle = colour(F.base, 1.05, 0.28 + hash(s * 2.2) * 0.2); ctx.lineWidth = 0.22 * k;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + nx * len * 0.5, oy + ny * len * 0.5, ox + (nx + q.tx * lean) * len, oy + (ny + q.ty * lean) * len); ctx.stroke();
    }
  });
}

/** The strand's soft shadow from a to b, on its own canvas under the yarn: three strokes, each a little wider and
 *  fainter, offset down and to the right (no canvas filter, which not every browser has). */
export const SHADOW = { dx: 0.8, dy: 1.7, rings: [[2.6, 0.10], [1.4, 0.12], [0.2, 0.16]] as const };
export function plyShadow(ctx: CanvasRenderingContext2D, pts: readonly Pt[], k: number, a: number, b: number, width = PLY.width) {
  const p = new Path2D(); let first = true;
  for (const q of pts) { if (q.s < a - 1 || q.s > b) continue; if (first) p.moveTo((q.x + SHADOW.dx) * k, (q.y + SHADOW.dy) * k); else p.lineTo((q.x + SHADOW.dx) * k, (q.y + SHADOW.dy) * k); first = false; }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [extra, alpha] of SHADOW.rings) { ctx.strokeStyle = `rgba(4,8,20,${alpha})`; ctx.lineWidth = (width + extra) * k; ctx.stroke(p); }
}
/** The longest stretch laid in one go (3.2): the next one starts on top of it. */
export const STRETCH = 10;
/** Lays the word from `a` to `b` in stretches of STRETCH, the shadow first, then the yarn. */
export function layYarn(shadow: CanvasRenderingContext2D, yarn: Ctx, pts: readonly Pt[], k: number, a: number, b: number) {
  for (let s = a; s < b; s += STRETCH) { const e = Math.min(b, s + STRETCH); plyShadow(shadow, pts, k, s, e); plyStrand(yarn, pts, k, s, e); }
}

// ---------------------------------------------------------------------------------------------------------------------
// The yarn ball (Appendix C)
// ---------------------------------------------------------------------------------------------------------------------

interface ArcPt { x: number; y: number; s: number; tx: number; ty: number }
/** Samples along an elliptical arc, in the ball's units, every `step`. */
function arcSamples(cx: number, cy: number, rx: number, ry: number, rot: number, t0: number, t1: number, step = 0.6): ArcPt[] {
  const c = Math.cos(rot), sn = Math.sin(rot), n = Math.max(8, Math.ceil(Math.abs(t1 - t0) * Math.max(rx, ry) / 0.3)), raw: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = rx * Math.cos(t), y = ry * Math.sin(t); raw.push([cx + x * c - y * sn, cy + x * sn + y * c]); }
  let acc = 0; const cum = [0]; for (let i = 1; i < raw.length; i++) { acc += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); cum.push(acc); }
  const out: ArcPt[] = []; let j = 0;
  for (let d = 0; d <= acc; d += step) { while (j < cum.length - 2 && cum[j + 1] < d) j++; const f = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1); out.push({ x: raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, y: raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f, s: d, tx: 0, ty: 0 }); }
  for (let i = 0; i < out.length; i++) { const A = out[Math.max(0, i - 1)], B = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(B.x - A.x, B.y - A.y) || 1; out[i].tx = (B.x - A.x) / l; out[i].ty = (B.y - A.y) / l; }
  return out;
}
/** One wound wrap: a smooth round strand (at this size a ball's twist is not seen), a darker rim where it meets the
 *  next wrap, and a lighter core on the side toward the light. */
function wrap(ctx: CanvasRenderingContext2D, pts: ArcPt[], k: number, sw: number) {
  const path = new Path2D(); pts.forEach((p, i) => (i ? path.lineTo(p.x * k, p.y * k) : path.moveTo(p.x * k, p.y * k)));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = colour(PLY.base, 0.45); ctx.lineWidth = (sw + 1.6) * k; ctx.stroke(path);
  ctx.strokeStyle = colour(PLY.base, 0.95); ctx.lineWidth = sw * k; ctx.stroke(path);
  const core = new Path2D(); pts.forEach((p, i) => { const nx = -p.ty, ny = p.tx, sg = (nx * -1 + ny * -1) > 0 ? 1 : -1, x = (p.x + sg * nx * sw * 0.18) * k, y = (p.y + sg * ny * sw * 0.18) * k; if (i) core.lineTo(x, y); else core.moveTo(x, y); });
  ctx.strokeStyle = colour(PLY.base, 1.16, 0.6); ctx.lineWidth = sw * 0.38 * k; ctx.stroke(core);
}
/** The ball's wraps, which turn as it rolls: wraps one way underneath, a band the other way on top, clipped to the
 *  ball. Drawn at (cx, cy) with radius r px; `spin` in degrees. */
export function drawBallWraps(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spin = 0) {
  const k = r / 50, rot = (-35 + spin) * Math.PI / 180, sw = 9, tip = 28 * Math.PI / 180;
  ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = colour(PLY.base, 0.5); ctx.fillRect(-r, -r, 2 * r, 2 * r);
  for (let phi = -80; phi <= 80; phi += 13) {                 // underneath: wraps across an axis tipped 28 degrees
    const ph = phi * Math.PI / 180, yc = 50 * Math.sin(ph) * Math.cos(tip), rx = 52 * Math.cos(ph), ry = rx * Math.sin(tip);
    wrap(ctx, arcSamples(0, yc, rx, ry, rot, Math.PI, 0), k, sw);
  }
  for (let l = -60; l <= 24; l += 10) {                       // on top: the band, pole to pole
    const rx = Math.max(0.5, Math.abs(50 * Math.sin(l * Math.PI / 180)));
    wrap(ctx, arcSamples(0, 0, 52, rx, rot + Math.PI / 2, l < 0 ? 0 : Math.PI, l < 0 ? Math.PI : 2 * Math.PI), k, sw);
  }
  ctx.restore();
}
/** The baked picture's numbers (3.3): 320 px square, the ball's radius 320 / 2.4, spin 0. */
export const BALL_PX = 320;
export const BALL_R = BALL_PX / 2.4;
