/** A shareable result card: a small painted-style image drawn on a canvas, shared as a picture where the browser allows it. */
export interface CardInput {
  title: string;
  headline: string;
  lines: string[];
  footer?: string;
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

export function drawCard(card: CardInput): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 900; c.height = 560;
  const g = c.getContext('2d');
  if (!g) return null;
  const sky = g.createLinearGradient(0, 0, 0, 560);
  sky.addColorStop(0, '#1d2a52'); sky.addColorStop(1, '#4b3a6a');
  g.fillStyle = sky; g.fillRect(0, 0, 900, 560);
  g.fillStyle = '#e9eef7';
  for (let i = 0; i < 40; i++) g.fillRect((i * 193) % 900, (i * 71) % 330, i % 3 === 0 ? 4 : 3, i % 3 === 0 ? 4 : 3);
  g.fillStyle = '#f4efe6'; g.fillRect(0, 470, 900, 90);
  g.fillStyle = '#d8d0c2'; g.fillRect(0, 470, 900, 8);
  g.fillStyle = '#f6efe0'; g.fillRect(50, 50, 800, 380);
  g.strokeStyle = '#7a5230'; g.lineWidth = 10; g.strokeRect(50, 50, 800, 380);
  g.fillStyle = '#2b221d'; g.textAlign = 'center';
  g.font = 'bold 30px system-ui, sans-serif'; g.fillText(card.title, 450, 105);
  g.font = 'bold 56px system-ui, sans-serif';
  wrapText(card.headline, 24).slice(0, 2).forEach((l, i) => g.fillText(l, 450, 190 + i * 62));
  g.font = '28px system-ui, sans-serif';
  card.lines.slice(0, 4).forEach((l, i) => g.fillText(l, 450, 320 + i * 38));
  g.font = 'bold 24px system-ui, sans-serif'; g.fillStyle = '#f4efe6';
  g.fillText(card.footer ?? 'Finish the Word · kaichuang581.github.io/steal-a-poop', 450, 525);
  return c;
}

const blobOf = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));

/** Share as a picture if the browser can; otherwise download the picture and copy the text. Returns what happened. */
export async function shareCard(card: CardInput, text: string): Promise<'shared' | 'saved' | 'copied'> {
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
