import { PIXEL_ART } from '../models.gen';
import { LADDER } from '../../voxel/paint';
import type { Mat } from '../../voxel/paint';

/**
 * The chalkboard's face (docs/trading-post-practice P2 section 1, P4 section 2), drawn on a canvas laid over the model's
 * green face: 2.4 x 1.2 m at 500 px a metre. Places are the plan's cells (0.05 m, x -24 to 24, y 30 to 54). The letter
 * and clock cards are drawn here too, so they can flip and lift off; the model's own cards are left out.
 */
export const BOARD_W = 1200, BOARD_H = 600;
const C = 25; // px per cell
const px = (cx: number) => (cx + 24) * C, py = (cy: number) => (54 - cy) * C;
export const CHALK = '#F3EEE6', CHALK_DIM = '#DCE8E0', INK = '#2B2230', RED = LADDER.scarfRed[0], LANTERN_HI = '#FFD98A';
const CARD = '#DCD6CC', CARD_EDGE = '#B9B1A4', HOOK = LADDER.brass[1];
const DISPLAY = 'Fraunces, Georgia, serif', SMALL = 'Nunito, system-ui, sans-serif';

export interface RunBoard {
  kind: 'run';
  count: number;
  /** Tally marks drawn (words since the last speed-up), or -1 at the shortest clock. */
  marks: number;
  /** "−1 s at 5" or "fastest". */
  next: string;
  best: number;
  letter: string;
  clock: number;
  phone: boolean;
  /** performance.now() of the last change of each, for the redraw, the new mark, the flips and the red clock. */
  countAt: number; markAt: number; wipeAt: number; letterAt: number; clockAt: number;
  prevLetter: string; prevClock: number;
}
export interface ReportBoard {
  kind: 'report';
  title: string; titleBest: boolean;
  count: number;
  facts: [string, string][];
  rosette: boolean;
  /** When the cards began to lift, and when the chalk began to write. */
  at: number;
}
export type BoardState = RunBoard | ReportBoard;

/** Draws the board for `now`; says whether anything is still moving (so the caller draws again next frame). */
export function drawBoard(ctx: CanvasRenderingContext2D, s: BoardState, now: number, reduced: boolean): boolean {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  return s.kind === 'run' ? drawRun(ctx, s, now, reduced) : drawReport(ctx, s, now, reduced);
}

const prog = (now: number, at: number, ms: number, reduced: boolean) => (reduced ? 1 : Math.min(1, Math.max(0, (now - at) / ms)));

function tally(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, h: number, last: number, gap = 0.22) {
  const step = h * gap, group = step * 5.2;
  ctx.lineCap = 'square';
  for (let i = 0; i < n; i++) {
    const g = Math.floor(i / 5), k = i % 5, x0 = x + g * group;
    const part = i === n - 1 ? last : 1;
    ctx.beginPath();
    if (k < 4) { ctx.moveTo(x0 + k * step, y); ctx.lineTo(x0 + k * step, y + h * part); }
    else { ctx.moveTo(x0 - step * 0.4, y + h * 0.8); ctx.lineTo(x0 - step * 0.4 + (step * 3.8) * part, y + h * (0.8 - 0.6 * part)); }
    ctx.stroke();
  }
}

/** A card: paper on two brass hooks, with a hinge across its middle; `fold` 0..1 flips the top half from `from` to the value. */
function card(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, text: (c: CanvasRenderingContext2D) => void, from: ((c: CanvasRenderingContext2D) => void) | null, fold: number, hooks: [number, number]) {
  ctx.fillStyle = HOOK;
  for (const hx of hooks) ctx.fillRect(hx, py(54), C, y0 - py(54));
  const mid = (y0 + y1) / 2;
  const face = (c: CanvasRenderingContext2D, paint: (c: CanvasRenderingContext2D) => void, top: boolean, scale: number) => {
    c.save();
    c.beginPath();
    if (top) c.rect(x0, mid - (mid - y0) * scale, x1 - x0, (mid - y0) * scale); else c.rect(x0, mid, x1 - x0, y1 - mid);
    c.clip();
    c.translate(0, mid); c.scale(1, top ? scale : 1); c.translate(0, -mid);
    c.fillStyle = CARD; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    paint(c);
    c.restore();
  };
  if (!from || fold >= 1) { face(ctx, text, true, 1); face(ctx, text, false, 1); }
  else {
    // The top half folds down over 100 ms showing the old value, then the new top half unfolds over 100 ms.
    face(ctx, from, false, 1);
    if (fold < 0.5) { face(ctx, text, true, 1); face(ctx, from, true, 1 - fold * 2); }
    else { face(ctx, text, true, (fold - 0.5) * 2); face(ctx, text, false, 1); }
  }
  ctx.fillStyle = CARD_EDGE;
  ctx.fillRect(x0, mid - 2, x1 - x0, 4);
  ctx.fillRect(x0, y1 - 6, x1 - x0, 6);
}

function drawRun(ctx: CanvasRenderingContext2D, s: RunBoard, now: number, reduced: boolean): boolean {
  let moving = false;
  // The count, rubbed out and rewritten in 160 ms.
  const cx = (px(-23) + px(-8)) / 2;
  const a = prog(now, s.countAt, 160, reduced);
  moving ||= a < 1;
  ctx.fillStyle = CHALK; ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(BOARD_H * 0.36)}px ${DISPLAY}`;
  ctx.fillText(String(s.count), cx, py(30) - BOARD_H * 0.6);
  ctx.globalAlpha = 1;
  // Tally marks toward the next speed-up: the newest drawn top to bottom in 180 ms, all wiped left to right in 250 ms.
  ctx.strokeStyle = CHALK; ctx.lineWidth = 9;
  const markH = BOARD_H * 0.18, mx = px(-23) + 40, my = py(30) - BOARD_H * 0.55;
  const wipe = prog(now, s.wipeAt, 250, reduced);
  if (s.marks > 0) {
    const last = prog(now, s.markAt, 180, reduced);
    moving ||= last < 1;
    tally(ctx, s.marks, mx, my, markH, last);
  } else if (wipe < 1 && s.marks === 0) {
    // The five marks of the last step, wiped away from the left.
    ctx.save(); ctx.beginPath(); ctx.rect(mx - 30 + wipe * 300, my - 10, 400, markH + 20); ctx.clip();
    tally(ctx, 5, mx, my, markH, 1); ctx.restore();
    moving = true;
  }
  if (!s.phone) {
    ctx.font = `800 ${Math.round(BOARD_H * 0.085)}px ${DISPLAY}`;
    ctx.fillText(s.next, cx, py(30) - BOARD_H * 0.21);
    ctx.fillStyle = CHALK_DIM;
    ctx.font = `800 ${Math.round(BOARD_H * 0.075)}px ${SMALL}`;
    ctx.fillText(`best ${s.best}`, cx, py(30) - BOARD_H * 0.08);
  }
  // The letter card.
  const lf = prog(now, s.letterAt, 200, reduced);
  moving ||= lf < 1;
  const letterIn = (txt: string, red = false) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = red ? RED : INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    const size = txt.length > 2 ? 0.34 : txt.length > 1 ? 0.5 : 0.72;
    c.font = `800 ${Math.round((py(34) - py(50)) * size)}px ${DISPLAY}`;
    c.fillText(txt.toUpperCase(), (px(-6) + px(6)) / 2, (py(50) + py(34)) / 2 + 10);
  };
  const isOut = s.letter === 'OUT';
  card(ctx, px(-6), py(50), px(6), py(34), letterIn(s.letter, isOut), s.prevLetter && s.prevLetter !== s.letter ? letterIn(s.prevLetter) : null, lf, [px(-4), px(3)]);
  // The clock card: red for 1.2 s after it changes.
  const cf = prog(now, s.clockAt, 200, reduced);
  const red = !reduced ? now - s.clockAt < 1200 : now - s.clockAt < 1200;
  moving ||= cf < 1 || red;
  const clockIn = (n: number, r: boolean) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = r ? RED : INK; c.textBaseline = 'alphabetic'; c.textAlign = 'right';
    const midX = (px(12) + px(22)) / 2, base = (py(47) + py(37)) / 2 + 42;
    c.font = `800 ${Math.round((py(37) - py(47)) * 0.5)}px ${DISPLAY}`;
    c.fillText(String(n), midX + 22, base);
    c.textAlign = 'left';
    c.font = `800 ${Math.round((py(37) - py(47)) * 0.2)}px ${DISPLAY}`;
    c.fillText('s', midX + 30, base);
  };
  card(ctx, px(12), py(47), px(22), py(37), clockIn(s.clock, red && s.clockAt > 0), s.prevClock && s.prevClock !== s.clock ? clockIn(s.prevClock, false) : null, cf, [px(13), px(20)]);
  return moving;
}

function drawReport(ctx: CanvasRenderingContext2D, s: ReportBoard, now: number, reduced: boolean): boolean {
  const W = BOARD_W, H = BOARD_H;
  // The cards lift off their hooks (200 ms), then the chalk writes left to right (600 ms).
  const lift = prog(now, s.at, 200, reduced);
  if (lift < 1) {
    ctx.globalAlpha = 1 - lift;
    ctx.fillStyle = CARD;
    ctx.fillRect(px(-6), py(50) - lift * 80, px(6) - px(-6), py(34) - py(50));
    ctx.fillRect(px(12), py(47) - lift * 80, px(22) - px(12), py(37) - py(47));
    ctx.globalAlpha = 1;
    return true;
  }
  const write = prog(now, s.at + 200, 600, reduced);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W * write, H); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = s.titleBest ? LANTERN_HI : CHALK;
  ctx.font = `800 ${Math.round(H * 0.15)}px ${DISPLAY}`;
  ctx.fillText(s.title, W * 0.05, H * 0.07 + H * 0.13);
  ctx.fillStyle = CHALK;
  ctx.fillRect(W * 0.05, H * 0.27, W * 0.9, 4);
  ctx.font = `800 ${Math.round(H * 0.4)}px ${DISPLAY}`;
  ctx.fillText(String(s.count), W * 0.05, H * 0.27 + H * 0.4);
  const countW = ctx.measureText(String(s.count)).width;
  ctx.font = `800 ${Math.round(H * 0.11)}px ${DISPLAY}`;
  ctx.fillText(s.count === 1 ? 'word' : 'words', W * 0.05 + countW + 24, H * 0.27 + H * 0.38);
  ctx.strokeStyle = CHALK; ctx.lineWidth = 7;
  tally(ctx, s.count, W * 0.05 + 10, H * 0.8 - H * 0.07, H * 0.13, 1, 0.24);
  s.facts.forEach(([k, v], i) => {
    const y = H * (0.33 + 0.105 * i) + H * 0.06;
    ctx.textAlign = 'left'; ctx.fillStyle = CHALK_DIM; ctx.font = `800 ${Math.round(H * 0.06)}px ${SMALL}`;
    ctx.fillText(k, W * 0.6, y);
    ctx.textAlign = 'right'; ctx.fillStyle = CHALK; ctx.font = `800 ${Math.round(H * 0.07)}px ${DISPLAY}`;
    ctx.fillText(v, W * 0.95, y);
  });
  ctx.restore();
  // The rosette drops in from 40 px above with a small bounce (350 ms), pinned to the top right corner.
  if (s.rosette && write >= 1) {
    const d = prog(now, s.at + 800, 350, reduced), bounce = d < 1 ? (1 - d) * -40 + Math.sin(d * Math.PI) * 6 : 0;
    pixels(ctx, 'rosette', W * 0.95 - 60, H * 0.05 + bounce, 6);
    if (d < 1) return true;
  }
  return write < 1;
}

/** Pixel art from the pack (X1) onto the board. */
export function pixels(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, size: number): void {
  const a = PIXEL_ART[key];
  if (!a) return;
  a.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = artColour(a.colours[ch]);
    if (!c) return;
    ctx.fillStyle = c; ctx.fillRect(x + i * size, y + j * size, size, size);
  }));
}

/** A pixel-art colour name ("ink", "lantern", "giftGreen -1", "#C98A1E") as a hex. */
export function artColour(name: string | undefined): string | null {
  if (!name) return null;
  if (name.startsWith('#')) return name;
  if (name === 'ink') return INK;
  if (name === 'lantern') return '#F2A444';
  if (name === 'lanternHi') return LANTERN_HI;
  const [mat, step] = name.split(' ');
  const ladder = LADDER[mat as Mat];
  return ladder ? ladder[2 + Number(step ?? 0)] : null;
}
