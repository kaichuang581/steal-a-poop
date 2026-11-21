/**
 * The word "fleeced" the loading screen's yarn spells (docs/landing/LANDING-PLAN.md 3.1, Appendices A and B): one
 * unbroken stroke in plain rounded print, in its own units (baseline y = 0, y down, small letters 100 tall, the word
 * about 520 wide). The points and the curve are the prototype's own, ported as they are. No imports: vite.config.ts
 * reads this file through bootDoors.ts, so it is imported with its `.ts` extension.
 */

/** The prototype's points, y UP as written there; `wordCubics` slants them (x + 0.1 y) and turns y down. */
export const WORD_PTS: readonly (readonly [number, number])[] = [
  [18, 0], [18, 40], [18, 86],
  [30, 98], [44, 100], [48, 104], [42, 108], [20, 106], [0, 104], [-6, 100], [0, 96], [14, 98], [19, 110],
  [20, 138], [27, 157], [42, 166], [60, 166], [78, 172], [94, 186], [103, 192], [108, 184], [105, 150], [102, 90], [102, 30], [108, 6], [124, 0],
  // e
  [130, 22], [137, 50], [160, 51], [186, 52], [183, 80], [161, 100], [139, 88], [132, 52], [138, 16], [160, 0], [182, 4], [196, 16],
  // e
  [206, 40], [214, 50], [238, 51], [264, 52], [261, 80], [239, 100], [217, 88], [210, 52], [216, 16], [238, 0], [260, 4], [274, 16],
  // c, the join arching over its top
  [282, 46], [292, 80], [310, 101], [332, 104], [350, 94], [356, 84], [348, 96], [330, 100], [310, 94], [298, 64], [300, 26], [316, 3], [340, 0], [358, 12],
  // e
  [368, 40], [376, 50], [400, 51], [426, 52], [423, 80], [401, 100], [379, 88], [372, 52], [378, 16], [400, 0], [424, 2],
  // d: along the baseline into the bowl, round it, up the stem
  [448, 1], [472, 0], [494, 12], [500, 50], [490, 88], [470, 100], [450, 88], [444, 50], [450, 14], [472, 0], [492, 6], [500, 24], [502, 80], [503, 140], [504, 175],
];
export const SLANT = 0.1;
/** The word's frame in its units: every point, the strand's half-width and its shadow, with room to spare. */
export const VIEWBOX = { x: -8, y: -204, w: 542, h: 216 } as const;

type P = [number, number];
export type Cubic = [P, P, P, P];

/** The word as cubic Béziers in word units (y down): Catmull-Rom through the slanted points. */
export function wordCubics(): Cubic[] {
  const P = WORD_PTS.map(([x, y]): P => [x + y * SLANT, -y]);
  const out: Cubic[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);
/** 'M' + the first point, then ' C c1 c2 p2' for each cubic, numbers to one decimal: the dotted guide's path. */
export function guidePath(): string {
  const c = wordCubics();
  return `M${n1(c[0][0][0])} ${n1(c[0][0][1])}` + c.map(([, a, b, p]) => ` C${n1(a[0])} ${n1(a[1])} ${n1(b[0])} ${n1(b[1])} ${n1(p[0])} ${n1(p[1])}`).join('');
}

function bez(c: Cubic, t: number): P { const u = 1 - t; return [u*u*u*c[0][0] + 3*u*u*t*c[1][0] + 3*u*t*t*c[2][0] + t*t*t*c[3][0], u*u*u*c[0][1] + 3*u*u*t*c[1][1] + 3*u*t*t*c[2][1] + t*t*t*c[3][1]]; }

export interface Sample { x: number; y: number; s: number; tx: number; ty: number }

/** Points every `step` units along the word: x, y, s (distance from the start), and the unit direction tx, ty. */
export function sampleWord(step = 1): { pts: Sample[]; total: number } {
  const fine: [number, number, number][] = []; let s = 0, prev: P | null = null;
  for (const c of wordCubics()) for (let k = prev ? 1 : 0; k <= 64; k++) {
    const p = bez(c, k / 64); if (prev) s += Math.hypot(p[0] - prev[0], p[1] - prev[1]); fine.push([p[0], p[1], s]); prev = p;
  }
  const total = s, out: Sample[] = []; let j = 0;
  for (let d = 0; d <= total + 1e-6; d += step) {
    while (j < fine.length - 2 && fine[j + 1][2] < d) j++;
    const a = fine[j], b = fine[j + 1], f = b[2] > a[2] ? (d - a[2]) / (b[2] - a[2]) : 0;
    out.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, s: d, tx: 0, ty: 0 });
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 2)], b = out[Math.min(out.length - 1, i + 2)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    out[i].tx = (b.x - a.x) / l; out[i].ty = (b.y - a.y) / l;
  }
  return { pts: out, total };
}

/** The word, sampled once when this file loads: a point every unit. */
export const WORD = sampleWord(1);
/** The word's length in its units (2,381.9 in the prototype). */
export const TOTAL = WORD.total;
/** Where the strand begins: the slanted first point. */
export const START = { x: WORD_PTS[0][0] + WORD_PTS[0][1] * SLANT, y: -WORD_PTS[0][1] } as const;
/** The sample at distance s along the word. */
export const sampleAt = (s: number): Sample => WORD.pts[Math.max(0, Math.min(WORD.pts.length - 1, Math.round(s)))];
