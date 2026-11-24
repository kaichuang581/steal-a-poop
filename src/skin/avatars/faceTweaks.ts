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
/** The photographic grade (requested by Brian, 2026-11-24: "exposure, vignette and grain adjustable, make him look evil"): exposure in stops (-1 darker to 1 brighter), the edges' darkening, and film grain. */
export const EXPOSURE = { min: -1, max: 1, step: 0.05, def: 0 } as const;
export const VIGNETTE = { min: 0, max: 1, step: 0.05, def: 0 } as const;
export const GRAIN = { min: 0, max: 1, step: 0.05, def: 0 } as const;
/** The look the "Menacing" button sets: dark, closed in at the edges, grainy and flushed. Nothing is drawn on the face. */
export const MENACING = { exposure: -0.55, vignette: 0.85, grain: 0.6, red: 0.3 } as const;

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

/** A repeatable value in [0, 1) for a pixel, so the grain is the same every time the picture is drawn. */
export function hash01(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface Grade { exposure: number; vignette: number; grain: number }

/**
 * Exposure, vignette and grain over RGBA data (`w` wide), in place, alpha left alone. The vignette darkens with the distance
 * from the face's middle (`centre`, `radius` in pixels), so the long forehead above it goes dark too.
 */
export function gradeData(data: Uint8ClampedArray, w: number, g: Grade, centre: [number, number], radius: number): void {
  if (g.exposure === 0 && g.vignette <= 0 && g.grain <= 0) return;
  const gain = 2 ** (g.exposure * 1.5);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const x = p % w, y = (p - x) / w;
    const d = Math.hypot(x - centre[0], y - centre[1]) / radius;
    const dark = 1 - 0.92 * g.vignette * smooth(0.4, 1.3, d);
    const noise = g.grain > 0 ? (hash01(x, y) - 0.5) * 2 * g.grain * 70 : 0;
    data[i] = clamp255(data[i] * gain * dark + noise);
    data[i + 1] = clamp255(data[i + 1] * gain * dark + noise);
    data[i + 2] = clamp255(data[i + 2] * gain * dark + noise);
  }
}

/** Where each face's vignette is centred, and how far it reaches. */
export function vignetteOf(spec: FaceSpec): { centre: [number, number]; radius: number } {
  const eyeY = (spec.eyes[0][1] + spec.eyes[1][1]) / 2;
  return { centre: [spec.jaw.cx, (eyeY + spec.jaw.chin) / 2], radius: 300 };
}

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
