/**
 * Face sliders for the two newest admin avatars (requested by Brian, 2026-11-24: "forehead size, glare, more orange, more
 * red, his eyes bigger or smaller, his jaw either fatter or more chiseled"). Pure pixel maths on the 512 x 1339 picture, so
 * a canvas can draw it and the tests can check it. `eyes` and `jaw` run from -1 to 1: negative is smaller eyes and a more
 * chiselled (narrower) jaw, positive bigger eyes and a fatter jaw. 0 is the photo.
 */
import { skinWeight } from './orange';

export const RED = { min: 0, max: 1, step: 0.05, def: 0 } as const;
export const EYES = { min: -1, max: 1, step: 0.1, def: 0 } as const;
export const JAW = { min: -1, max: 1, step: 0.1, def: 0 } as const;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** One skin pixel pushed toward red by `amount` (0 to 1): more red, much less green, a little less blue. */
export function redden(r: number, g: number, b: number, amount: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, amount)) * skinWeight(r, g, b);
  if (t <= 0) return [r, g, b];
  const tr = clamp255(r * 1.05 + 55), tg = clamp255(g * 0.45), tb = clamp255(b * 0.42);
  return [r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t];
}

/** Reddens the colour pixels of RGBA data in place (alpha is left alone). */
export function redData(data: Uint8ClampedArray, amount: number): void {
  if (amount <= 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = redden(data[i], data[i + 1], data[i + 2], amount);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}

/** Where a face sits in its picture (in the 512 x 1339 tall picture's own pixels). */
export interface FaceSpec {
  /** The eyes' centres and the radius the eye warp reaches. */
  eyes: [number, number][];
  eyeR: number;
  /** The jaw: its centre line, where the cheeks start to narrow, the chin's row, and the row the neck takes over. */
  jaw: { cx: number; from: number; chin: number; end: number };
}

/** The face slice starts at row 1041, which is row 214 of the flat 512 x 512 picture each was cut from (so tall y = flat y + 827). */
export const FACES: Record<string, FaceSpec> = {
  admin5: { eyes: [[197, 1089], [270, 1089]], eyeR: 40, jaw: { cx: 245, from: 1127, chin: 1212, end: 1240 } },
  admin6: { eyes: [[215, 1082], [303, 1082]], eyeR: 42, jaw: { cx: 263, from: 1127, chin: 1219, end: 1247 } },
};

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A copy of RGBA `src` (`w` x `h`) with the eyes scaled about their centres and the jaw widened or narrowed. Each output
 * pixel is read from where the stretched face would have put it (inverse mapping, bilinear), so nothing tears.
 */
export function warpFace(src: Uint8ClampedArray, w: number, h: number, spec: FaceSpec, eyes: number, jaw: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  if (eyes === 0 && jaw === 0) return out;
  const top = Math.max(0, Math.floor(Math.min(...spec.eyes.map((e) => e[1])) - spec.eyeR));
  const bottom = Math.min(h - 1, Math.ceil(spec.jaw.end));
  const sample = (x: number, y: number, o: number) => {
    const xf = Math.min(w - 1, Math.max(0, x)), yf = Math.min(h - 1, Math.max(0, y));
    const x0 = Math.floor(xf), y0 = Math.floor(yf), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const fx = xf - x0, fy = yf - y0;
    for (let c = 0; c < 4; c++) {
      const a = src[(y0 * w + x0) * 4 + c], b = src[(y0 * w + x1) * 4 + c], d = src[(y1 * w + x0) * 4 + c], e = src[(y1 * w + x1) * 4 + c];
      out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    }
  };
  for (let y = top; y <= bottom; y++) {
    const wj = jaw === 0 ? 0 : smooth(spec.jaw.from, spec.jaw.chin, y) * (1 - smooth(spec.jaw.chin, spec.jaw.end, y));
    const sj = 1 + jaw * 0.35 * wj;
    for (let x = 0; x < w; x++) {
      let sx = x, sy = y, moved = false;
      if (eyes !== 0) {
        for (const [ex, ey] of spec.eyes) {
          const d = Math.hypot(x - ex, y - ey);
          if (d < spec.eyeR) {
            const f = 1 + eyes * 0.8 * (1 - (d / spec.eyeR) ** 2);
            sx = ex + (x - ex) / f; sy = ey + (y - ey) / f; moved = true;
            break;
          }
        }
      }
      if (!moved && wj > 0) { sx = spec.jaw.cx + (x - spec.jaw.cx) / sj; moved = true; }
      if (moved) sample(sx, sy, (y * w + x) * 4);
    }
  }
  return out;
}
