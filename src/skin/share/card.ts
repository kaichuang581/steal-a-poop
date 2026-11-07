/**
 * A shareable result card, drawn on a canvas in the farm kit's materials (V6 Part 6.4.7): a plank wall, a light board
 * with nails and the title carved on it, the count in chalk on a framed slate, the lines on a strip of paper, the week as
 * knitted stitches and the spoiler-free glyph row as small painted squares. Type is the skin's own three faces, read
 * from the font tokens and loaded before drawing. Shared as a picture where the browser allows it.
 */
export interface CardInput {
  title: string;
  headline: string;
  lines: string[];
  footer?: string;
  /** A number to chalk on the slate, and what it counts. */
  count?: number;
  unit?: string;
  /** The week's nights, oldest first (the dream's streak). */
  stitches?: readonly string[];
  /** The dream's glyph row (dreamGlyphs), drawn as squares rather than as characters. */
  glyphs?: string;
}

/** Splits a long line to fit a width; used for the card text. Pure, so it is tested. */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + w).length > maxChars) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** The three font tokens, as the page has them (with the stack's own fallbacks). */
function faces() {
  const css = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
  const token = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  return { display: token('--skin-font-display', 'Georgia, serif'), hand: token('--skin-font-hand', 'cursive'), body: token('--skin-font-body', 'sans-serif') };
}

/** The glyph row's squares by code point: 1, 2 and 3 letters, the two rarer, and a bump. */
const GLYPH_COLOURS: Record<number, string> = { 0x1f7e9: '#5E9E5A', 0x1f7e6: '#4E7FC0', 0x1f7ea: '#8A62B8', 0x1f7e7: '#E08A3C', 0x1f7e5: '#C24E45', 0x2b1b: '#3A3236' };
const STITCH: Record<string, string> = { played: '#F2A444', today: '#F2A444', repair: '#F3E7CC', blanket: '#C98BA6' };

export function drawCard(card: CardInput): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 900; c.height = 560;
  const g = c.getContext('2d');
  if (!g) return null;
  const f = faces();
  const plank = (x: number, y: number, w: number, h: number, face: string, seed: number) => {
    g.fillStyle = face; g.fillRect(x, y, w, h);
    // Grain: thin light and dark lines along the board, spaced by a seed so neighbours differ.
    for (let i = 0, gy = y + 5 + (seed % 7); gy < y + h - 4; i++, gy += 7 + ((seed + i * 5) % 9)) {
      g.fillStyle = i % 2 ? 'rgba(40, 24, 10, 0.14)' : 'rgba(255, 230, 190, 0.10)';
      g.fillRect(x + 6, gy, w - 12, 1);
    }
    g.fillStyle = 'rgba(255, 220, 170, 0.30)'; g.fillRect(x, y, w, 3);
    g.fillStyle = 'rgba(40, 24, 10, 0.50)'; g.fillRect(x, y + h - 4, w, 4);
    g.fillStyle = 'rgba(40, 24, 10, 0.22)'; g.fillRect(x, y, 6, h); g.fillRect(x + w - 6, y, 6, h);
  };
  const nail = (x: number, y: number) => { g.fillStyle = '#4A4038'; g.fillRect(x - 4, y - 4, 8, 8); g.fillStyle = '#B8AC9C'; g.fillRect(x - 2, y - 3, 3, 3); };
  // The wall behind: dark boards, edge to edge.
  for (let y = 0, i = 0; y < 560; y += 70, i++) plank(0, y, 900, 70, i % 2 ? '#5A3C25' : '#4A311E', i * 3);
  // The board, light wood, nailed at its corners; the title carved along its top.
  g.fillStyle = 'rgba(40, 24, 10, 0.35)'; g.fillRect(46, 48, 808, 440);
  plank(40, 40, 820, 440, '#E9C48E', 11);
  for (const [x, y] of [[58, 58], [842, 58], [58, 462], [842, 462]]) nail(x, y);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `800 30px ${f.display}`; g.fillStyle = 'rgba(255, 240, 210, 0.6)'; g.fillText(card.title, 450, 99);
  g.fillStyle = '#5B3A1E'; g.fillText(card.title, 450, 97);
  // The slate: a wooden frame round chalk on dark stone.
  const sx = 80, sy = 130, sw = 300, sh = 200;
  g.fillStyle = '#7A5230'; g.fillRect(sx - 10, sy - 10, sw + 20, sh + 20);
  g.fillStyle = '#2F3236'; g.fillRect(sx, sy, sw, sh);
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(243, 240, 230, ${0.03 + ((i * 37) % 7) / 100})`; g.fillRect(sx + ((i * 97) % sw), sy + ((i * 53) % sh), 2, 1); }
  g.fillStyle = '#F3F0E6';
  if (card.count !== undefined) {
    g.font = `800 110px ${f.display}`; g.fillText(String(card.count), sx + sw / 2, sy + 130);
    g.font = `400 34px ${f.hand}`; g.fillText(card.unit ?? '', sx + sw / 2, sy + 178);
  } else {
    g.font = `800 34px ${f.display}`;
    wrapText(card.headline, 14).slice(0, 4).forEach((l, i) => g.fillText(l, sx + sw / 2, sy + 60 + i * 42));
  }
  // The paper beside it: the headline and the lines in the farmer's hand.
  const px = 420, py = 130, pw = 400, ph = 230;
  g.fillStyle = 'rgba(59, 48, 40, 0.22)'; g.fillRect(px + 3, py + 4, pw, ph);
  g.fillStyle = '#FBF4E4'; g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(59, 48, 40, 0.12)';
  for (let y = py + 44; y < py + ph; y += 34) g.fillRect(px + 10, y, pw - 20, 1);
  g.fillStyle = '#C99A38'; g.fillRect(px + pw / 2 - 6, py - 6, 12, 12);
  g.textAlign = 'left'; g.fillStyle = '#3B3028';
  const text = card.count !== undefined ? [card.headline, ...card.lines] : card.lines;
  g.font = `400 28px ${f.hand}`;
  text.flatMap((l) => wrapText(l, 29)).slice(0, 6).forEach((l, i) => g.fillText(l, px + 18, py + 38 + i * 34));
  // The week as V stitches, and the glyph row as painted squares.
  let row = 395;
  if (card.stitches?.length) {
    card.stitches.forEach((s, i) => {
      const x = 100 + i * 34;
      g.fillStyle = STITCH[s] ?? 'rgba(122, 106, 88, 0.35)';
      for (let k = 0; k < 10; k++) { g.fillRect(x + k, row + k * 2, 4, 3); g.fillRect(x + 20 - k, row + k * 2, 4, 3); }
    });
  }
  const squares = [...(card.glyphs ?? '')].map((ch) => ch.codePointAt(0) ?? 0);
  let gx = card.stitches?.length ? 380 : 100;
  for (const cp of squares) {
    if (cp === 10) { row += 22; gx = card.stitches?.length ? 380 : 100; continue; }
    if (cp === 32) { gx += 8; continue; }
    const col = GLYPH_COLOURS[cp];
    if (!col || gx > 820) continue;
    g.fillStyle = col; g.fillRect(gx, row, 16, 16);
    g.fillStyle = 'rgba(255, 255, 255, 0.25)'; g.fillRect(gx, row, 16, 3);
    gx += 19;
  }
  // The footer on its own small plank along the bottom.
  plank(220, 500, 460, 46, '#6B4A32', 5);
  g.textAlign = 'center'; g.font = `800 20px ${f.body}`; g.fillStyle = '#FFF4DC';
  g.fillText(card.footer ?? 'Finish the Word · kaichuang581.github.io/steal-a-poop', 450, 530);
  return c;
}

const blobOf = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));

/** Loads the skin's faces before drawing, so the card is never drawn in a fallback by accident. */
async function loadFaces() {
  try {
    const f = faces();
    await Promise.all([`800 30px ${f.display}`, `400 28px ${f.hand}`, `800 20px ${f.body}`].map((spec) => document.fonts?.load(spec)));
  } catch { /* drawn in the fallbacks */ }
}

/** Share as a picture if the browser can; otherwise download the picture and copy the text. Returns what happened. */
export async function shareCard(card: CardInput, text: string): Promise<'shared' | 'saved' | 'copied'> {
  await loadFaces();
  const canvas = drawCard(card);
  const blob = canvas ? await blobOf(canvas) : null;
  if (blob && typeof File !== 'undefined') {
    const file = new File([blob], 'finish-the-word.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
    } catch { /* cancelled or refused: fall through */ }
  }
  try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); return 'copied'; }
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'finish-the-word.png';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'saved';
  }
  return 'copied';
}
