import { PIXEL_ART } from './models.gen';

/**
 * The coach's report in chalk (docs/trading-post-practice/P4, section 2), drawn on a transparent canvas laid over the
 * chalkboard's green face. Places are shares of the face from its top left. `write` (0 to 1) is how far the chalk has
 * written, left to right; `rosette` (0 to 1) is the rosette's drop.
 */
export interface ReportData {
  words: number;
  /** Best after this run, for this bot and clock. */
  best: number;
  newBest: boolean;
  clockFrom: number;
  clockTo: number;
  bot: string;
  rating: number;
}
export const CHALK = '#F3EEE6', CHALK_DIM = '#DCE8E0', LANTERN_HI = '#FFD98A';

export const reportTitle = (d: ReportData): string => (d.newBest ? 'New best!' : d.words >= 10 ? 'Good session' : 'Warm-up done');

/** Upright strokes in fives, the fifth across the four (P2 and P4). */
export function drawTally(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, count: number, colour = CHALK): void {
  const gap = h * 0.22, group = gap * 4 + h * 0.45;
  ctx.strokeStyle = colour; ctx.lineWidth = Math.max(2, h * 0.09); ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const g = Math.floor(i / 5), k = i % 5, gx = x + g * group;
    ctx.beginPath();
    if (k < 4) { ctx.moveTo(gx + k * gap, y); ctx.lineTo(gx + k * gap, y + h); }
    else { ctx.moveTo(gx - gap * 0.4, y + h * 0.8); ctx.lineTo(gx + gap * 3.4, y + h * 0.2); }
    ctx.stroke();
  }
}

/** A pixel-art icon from the pack at `px` screen pixels per art pixel. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, px: number, colours: Record<string, string> = {}): void {
  const art = PIXEL_ART[name];
  if (!art) return;
  const tone: Record<string, string> = { ink: '#2B2230', lantern: '#F2A444', lanternHi: LANTERN_HI, 'scarfRed 0': '#BF6055', ...colours };
  art.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    const c = art.colours[ch];
    ctx.fillStyle = tone[c] ?? c;
    ctx.fillRect(Math.round(x + i * px), Math.round(y + j * px), Math.ceil(px), Math.ceil(px));
  }));
}

export function drawReport(ctx: CanvasRenderingContext2D, w: number, h: number, d: ReportData, write = 1, rosette = 1): void {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w * write, h); ctx.clip();
  ctx.textBaseline = 'top';
  // Title
  ctx.fillStyle = d.newBest ? LANTERN_HI : CHALK;
  ctx.font = `800 ${Math.round(h * 0.15)}px Fraunces, Georgia, serif`;
  ctx.fillText(reportTitle(d), w * 0.05, h * 0.07);
  // A chalk line under it
  ctx.strokeStyle = CHALK; ctx.lineWidth = Math.max(1.5, h * 0.008);
  ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.27); ctx.lineTo(w * 0.95, h * 0.27); ctx.stroke();
  // The count, and "words" beside its foot
  ctx.fillStyle = CHALK;
  ctx.font = `800 ${Math.round(h * 0.4)}px Fraunces, Georgia, serif`;
  ctx.fillText(String(d.words), w * 0.05, h * 0.29);
  const cw = ctx.measureText(String(d.words)).width;
  ctx.font = `800 ${Math.round(h * 0.11)}px Fraunces, Georgia, serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(d.words === 1 ? 'word' : 'words', w * 0.05 + cw + w * 0.015, h * 0.29 + h * 0.37);
  // The whole run in tally marks
  drawTally(ctx, w * 0.05, h * 0.8, h * 0.13, d.words);
  // Four facts on the right
  const facts: [string, string][] = [['Best', String(d.best)], ['Clock', d.clockFrom === d.clockTo ? `${d.clockFrom} s` : `${d.clockFrom} to ${d.clockTo} s`], ['Bot', d.bot], ['Rating', String(d.rating)]];
  facts.forEach(([k, v], i) => {
    const y = h * (0.33 + i * 0.105) + h * 0.075;
    ctx.textAlign = 'left'; ctx.fillStyle = CHALK_DIM; ctx.font = `800 ${Math.round(h * 0.065)}px Nunito, sans-serif`;
    ctx.fillText(k, w * 0.6, y);
    ctx.textAlign = 'right'; ctx.fillStyle = CHALK; ctx.font = `800 ${Math.round(h * 0.08)}px Fraunces, Georgia, serif`;
    ctx.fillText(v, w * 0.95, y);
  });
  ctx.textAlign = 'left';
  ctx.restore();
  // The rosette, pinned to the top right corner on a new best, dropping in with a small bounce.
  if (d.newBest && rosette > 0) {
    const px = Math.max(2, Math.round(h * 0.012)), t = Math.min(1, rosette);
    const drop = t < 0.7 ? (1 - t / 0.7) * 40 : -Math.sin(((t - 0.7) / 0.3) * Math.PI) * 6;
    drawIcon(ctx, 'rosette', w * 0.95 - 10 * px, h * 0.04 - drop, px);
  }
}
