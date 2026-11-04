import { useEffect, useState } from 'react';
import type { PredatorKind } from '../../hunt/hunt';

/**
 * Pixel-art sprites for the Daily Hunt. Each animal is drawn as simple vector shapes on a 64 x 64 grid (one unit is one
 * pixel), then turned into real pixel art in the browser: rendered at 64 px, every pixel snapped to that animal's
 * palette (no blurry in-between colours), and a one-pixel dark outline drawn round the silhouette, like a handheld
 * battle sprite. The result is cached as a PNG and scaled up with crisp pixels.
 */
const SIZE = 64;
const OUTLINE = '#2A2026';
const INK = '#2A2026';

export interface SpriteDef { palette: string[]; svg: string }

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>`;

// ---------- Grey Wolf (and, in other colours with a crown and a scar, the Shadow Wolf boss) ----------
function wolf(c: { fur: string; dark: string; light: string; eye: string; inner: string }, boss = false): SpriteDef {
  return {
    palette: [c.fur, c.dark, c.light, c.eye, c.inner, INK, '#FFFFFF', '#9C2F3A', ...(boss ? ['#BFE3F5', '#E9F6FF', '#C9C3D6'] : [])],
    svg: svg(`
      <polygon points="9,30 15,3 30,19" fill="${c.fur}"/><polygon points="55,30 49,3 34,19" fill="${c.fur}"/>
      <polygon points="14,24 16,10 25,20" fill="${c.inner}"/><polygon points="50,24 48,10 39,20" fill="${c.inner}"/>
      <path d="M8 30 Q8 17 22 15 L42 15 Q56 17 56 30 L54 40 Q50 52 40 58 L24 58 Q14 52 10 40 Z" fill="${c.fur}"/>
      <polygon points="8,34 2,46 12,44 9,52 18,48" fill="${c.fur}"/><polygon points="56,34 62,46 52,44 55,52 46,48" fill="${c.fur}"/>
      <path d="M27 15 L37 15 L35 31 L29 31 Z" fill="${c.dark}"/>
      <path d="M11 40 Q18 38 24 44 L26 54 Q16 52 11 40 Z" fill="${c.light}"/><path d="M53 40 Q46 38 40 44 L38 54 Q48 52 53 40 Z" fill="${c.light}"/>
      <path d="M23 35 Q32 30 41 35 L42 47 Q32 57 22 47 Z" fill="${c.light}"/>
      <polygon points="16,29 28,32 26,36 18,35" fill="${c.eye}"/><polygon points="48,29 36,32 38,36 46,35" fill="${c.eye}"/>
      <rect x="22" y="32" width="3" height="3" fill="${INK}"/><rect x="39" y="32" width="3" height="3" fill="${INK}"/>
      <polygon points="14,26 29,30 28,32 15,29" fill="${c.dark}"/><polygon points="50,26 35,30 36,32 49,29" fill="${c.dark}"/>
      <ellipse cx="32" cy="40" rx="5" ry="3.5" fill="${INK}"/><rect x="30" y="38" width="2" height="1" fill="#FFFFFF"/>
      <path d="M24 47 Q32 51 40 47 L38 52 Q32 56 26 52 Z" fill="#9C2F3A"/>
      <polygon points="26,47 29,47 27.5,52" fill="#FFFFFF"/><polygon points="35,47 38,47 36.5,52" fill="#FFFFFF"/>
      ${boss ? `<polygon points="20,15 22,7 25,14 28,4 31,14 33,4 36,14 39,4 42,14 44,7 46,15" fill="#BFE3F5"/><rect x="20" y="14" width="26" height="3" fill="#E9F6FF"/>
        <polygon points="40,24 47,38 45,39 38,25" fill="#C9C3D6"/>` : ''}
    `),
  };
}

// ---------- Red Fox: huge black-tipped ears, a narrow face, a white V of cheeks ----------
const FOX: SpriteDef = {
  palette: ['#D9772B', '#A9561B', '#FBEEDC', '#F2B13E', INK, '#FFFFFF', '#6B3410'],
  svg: svg(`
    <polygon points="6,30 11,1 28,18" fill="#D9772B"/><polygon points="58,30 53,1 36,18" fill="#D9772B"/>
    <polygon points="11,25 12,8 23,19" fill="#FBEEDC"/><polygon points="53,25 52,8 41,19" fill="#FBEEDC"/>
    <polygon points="9,12 11,1 15,10" fill="#6B3410"/><polygon points="55,12 53,1 49,10" fill="#6B3410"/>
    <path d="M6 30 Q8 16 22 15 L42 15 Q56 16 58 30 L52 42 L37 61 L27 61 L12 42 Z" fill="#D9772B"/>
    <path d="M26 15 L38 15 L36 28 L28 28 Z" fill="#A9561B"/>
    <path d="M6 31 L20 37 L30 58 L27 61 L12 42 Z" fill="#FBEEDC"/><path d="M58 31 L44 37 L34 58 L37 61 L52 42 Z" fill="#FBEEDC"/>
    <path d="M26 40 Q32 37 38 40 L35 58 L29 58 Z" fill="#FBEEDC"/>
    <polygon points="16,29 28,31 26,35 19,35" fill="#F2B13E"/><polygon points="48,29 36,31 38,35 45,35" fill="#F2B13E"/>
    <rect x="22" y="30" width="2" height="5" fill="${INK}"/><rect x="40" y="30" width="2" height="5" fill="${INK}"/>
    <polygon points="15,27 29,29 28,31 16,29" fill="#6B3410"/><polygon points="49,27 35,29 36,31 48,29" fill="#6B3410"/>
    <ellipse cx="32" cy="57" rx="4" ry="2.6" fill="${INK}"/><rect x="30" y="55" width="2" height="1" fill="#FFFFFF"/>
  `),
};

// ---------- Lynx: black ear tufts, a round spotted face, a big striped ruff ----------
const LYNX: SpriteDef = {
  palette: ['#C9A57A', '#8E6E4A', '#F6EBD9', '#B9D65A', INK, '#E7A0A0', '#FFFFFF'],
  svg: svg(`
    <polygon points="15,10 15,1 17,1 18,10" fill="${INK}"/><polygon points="49,10 49,1 47,1 46,10" fill="${INK}"/>
    <polygon points="10,26 16,8 28,18" fill="#C9A57A"/><polygon points="54,26 48,8 36,18" fill="#C9A57A"/>
    <polygon points="14,22 16,13 23,19" fill="#F6EBD9"/><polygon points="50,22 48,13 41,19" fill="#F6EBD9"/>
    <polygon points="12,32 1,54 10,51 7,60 18,55 22,62 32,57 42,62 46,55 57,60 54,51 63,54 52,32" fill="#F6EBD9"/>
    <ellipse cx="32" cy="32" rx="21" ry="17" fill="#C9A57A"/>
    <path d="M5 50 L13 44 M9 57 L16 49 M59 50 L51 44 M55 57 L48 49" stroke="${INK}" stroke-width="2"/>
    <path d="M28 16 L29 24 M32 15 L32 24 M36 16 L35 24" stroke="#8E6E4A" stroke-width="2"/>
    <circle cx="16" cy="36" r="1.6" fill="#8E6E4A"/><circle cx="19" cy="41" r="1.6" fill="#8E6E4A"/><circle cx="48" cy="36" r="1.6" fill="#8E6E4A"/><circle cx="45" cy="41" r="1.6" fill="#8E6E4A"/>
    <ellipse cx="23" cy="31" rx="5" ry="4" fill="#B9D65A"/><ellipse cx="41" cy="31" rx="5" ry="4" fill="#B9D65A"/>
    <rect x="22" y="28" width="2" height="7" fill="${INK}"/><rect x="40" y="28" width="2" height="7" fill="${INK}"/>
    <path d="M17 27 L28 29 M47 27 L36 29" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="27.5" cy="43" rx="5" ry="4" fill="#F6EBD9"/><ellipse cx="36.5" cy="43" rx="5" ry="4" fill="#F6EBD9"/>
    <polygon points="28,37 36,37 32,42" fill="#E7A0A0"/>
    <path d="M32 42 L32 45 M27 47 Q32 50 37 47" stroke="${INK}" stroke-width="1.4" fill="none"/>
  `),
};

// ---------- Polar Bear: round ears, a broad head, a long muzzle and a big black nose ----------
const BEAR: SpriteDef = {
  palette: ['#F4F1E8', '#D6CFBE', '#B8AF9C', INK, '#FFFFFF', '#9C2F3A'],
  svg: svg(`
    <circle cx="15" cy="15" r="7" fill="#F4F1E8"/><circle cx="49" cy="15" r="7" fill="#F4F1E8"/>
    <circle cx="15" cy="15" r="3.5" fill="#B8AF9C"/><circle cx="49" cy="15" r="3.5" fill="#B8AF9C"/>
    <ellipse cx="32" cy="33" rx="26" ry="22" fill="#F4F1E8"/>
    <path d="M8 40 Q32 62 56 40 Q52 54 32 57 Q12 54 8 40 Z" fill="#D6CFBE"/>
    <ellipse cx="32" cy="44" rx="12" ry="10" fill="#D6CFBE"/>
    <ellipse cx="32" cy="38.5" rx="6" ry="4" fill="${INK}"/><rect x="29" y="36" width="3" height="1.5" fill="#FFFFFF"/>
    <circle cx="21" cy="29" r="2.6" fill="${INK}"/><circle cx="43" cy="29" r="2.6" fill="${INK}"/>
    <rect x="20" y="28" width="1" height="1" fill="#FFFFFF"/><rect x="42" y="28" width="1" height="1" fill="#FFFFFF"/>
    <polygon points="15,22 26,26 25,28 15,25" fill="${INK}"/><polygon points="49,22 38,26 39,28 49,25" fill="${INK}"/>
    <path d="M32 42 L32 47 M25 48 Q32 54 39 48" stroke="${INK}" stroke-width="1.6" fill="none"/>
    <path d="M27 49 Q32 52 37 49 L35 52 Q32 53 29 52 Z" fill="#9C2F3A"/>
  `),
};

// ---------- Golden Eagle: in profile, golden nape, hooked beak, a fierce brow ----------
const EAGLE: SpriteDef = {
  palette: ['#6B4426', '#8E5B30', '#D9A85A', '#F2C14E', '#3B3A40', '#F5A623', INK, '#FFFFFF'],
  svg: svg(`
    <path d="M22 12 Q38 2 54 12 Q62 24 60 40 Q60 54 52 63 L22 63 Q28 50 26 40 Z" fill="#6B4426"/>
    <path d="M30 8 Q46 2 56 14 Q60 22 58 30 Q46 22 36 20 Z" fill="#D9A85A"/>
    <path d="M26 22 Q36 18 46 24 L44 34 Q34 36 26 32 Z" fill="#8E5B30"/>
    <path d="M40 38 L44 52 M48 36 L52 50 M34 44 L36 58" stroke="#8E5B30" stroke-width="2"/>
    <path d="M30 24 L19 22 Q8 22 5 31 Q4 37 9 41 Q11 35 17 33 L30 32 Z" fill="#F2C14E"/>
    <path d="M5 31 Q4 37 9 41 Q10 37 13 35 L9 30 Z" fill="#3B3A40"/>
    <path d="M17 33 L30 32 L28 36 L18 36 Z" fill="#D9A85A"/>
    <circle cx="35" cy="26" r="4" fill="#F5A623"/><circle cx="34" cy="26" r="2" fill="${INK}"/><rect x="33" y="24" width="1" height="1" fill="#FFFFFF"/>
    <polygon points="28,20 44,20 42,24 30,24" fill="${INK}"/>
  `),
};

function sheepBack(frozen: boolean): SpriteDef {
  const wool = frozen ? '#D9EEF8' : '#FAF6EC', shade = frozen ? '#9ED2EE' : '#DDD3BE', face = frozen ? '#6E9DBF' : '#3F3A3A', hoof = frozen ? '#4E7FA3' : '#2A2626';
  return {
    palette: [wool, shade, face, hoof, INK],
    svg: svg(`
      <rect x="15" y="46" width="6" height="14" fill="${face}"/><rect x="25" y="48" width="6" height="13" fill="${face}"/>
      <rect x="33" y="48" width="6" height="13" fill="${face}"/><rect x="43" y="46" width="6" height="14" fill="${face}"/>
      <rect x="15" y="57" width="6" height="4" fill="${hoof}"/><rect x="25" y="58" width="6" height="4" fill="${hoof}"/>
      <rect x="33" y="58" width="6" height="4" fill="${hoof}"/><rect x="43" y="57" width="6" height="4" fill="${hoof}"/>
      <ellipse cx="32" cy="38" rx="27" ry="16" fill="${shade}"/>
      <circle cx="14" cy="34" r="9" fill="${wool}"/><circle cx="50" cy="34" r="9" fill="${wool}"/><circle cx="24" cy="28" r="10" fill="${wool}"/>
      <circle cx="40" cy="28" r="10" fill="${wool}"/><circle cx="32" cy="36" r="13" fill="${wool}"/><circle cx="20" cy="42" r="8" fill="${wool}"/><circle cx="44" cy="42" r="8" fill="${wool}"/>
      <ellipse cx="32" cy="16" rx="9" ry="8" fill="${face}"/>
      <ellipse cx="18" cy="17" rx="7" ry="3" fill="${face}" transform="rotate(-15 18 17)"/><ellipse cx="46" cy="17" rx="7" ry="3" fill="${face}" transform="rotate(15 46 17)"/>
      <circle cx="27" cy="12" r="4" fill="${wool}"/><circle cx="33" cy="10" r="4.5" fill="${wool}"/><circle cx="38" cy="13" r="3.5" fill="${wool}"/>
      <path d="M12 44 Q32 56 52 44" stroke="${shade}" stroke-width="3" fill="none"/>
    `),
  };
}

export const PREDATOR_SPRITES: Record<PredatorKind, SpriteDef> = {
  wolf: wolf({ fur: '#8A8794', dark: '#5E5B68', light: '#DCD9E3', eye: '#FFE066', inner: '#C9A6A6' }),
  fox: FOX,
  lynx: LYNX,
  bear: BEAR,
  eagle: EAGLE,
  shadow: wolf({ fur: '#3E3A4A', dark: '#25222E', light: '#7E7890', eye: '#FF5A4E', inner: '#5E3A48' }, true),
};

// ---------- SVG -> crisp pixel art ----------
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cache = new Map<string, Promise<string>>();

/** Renders a sprite at SIZE x SIZE, snaps every pixel to its palette and outlines the silhouette; a PNG data URL. */
export function pixelate(def: SpriteDef): Promise<string> {
  const hit = cache.get(def.svg);
  if (hit) return hit;
  const job = (async () => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE);
    const px = data.data;
    const pal = def.palette.map(hex);
    const solid = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      const o = i * 4;
      if (px[o + 3] < 110) { px[o + 3] = 0; continue; }
      // Undo the edge blend against transparency, then take the nearest palette colour.
      const a = px[o + 3] / 255;
      const r = px[o] / a, g = px[o + 1] / a, b = px[o + 2] / a;
      let best = pal[0], d = Infinity;
      for (const c of pal) {
        const dd = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
        if (dd < d) { d = dd; best = c; }
      }
      px[o] = best[0]; px[o + 1] = best[1]; px[o + 2] = best[2]; px[o + 3] = 255;
      solid[i] = 1;
    }
    const [or, og, ob] = hex(OUTLINE);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        if (solid[i]) continue;
        const edge = (x > 0 && solid[i - 1]) || (x < SIZE - 1 && solid[i + 1]) || (y > 0 && solid[i - SIZE]) || (y < SIZE - 1 && solid[i + SIZE]);
        if (!edge) continue;
        const o = i * 4;
        px[o] = or; px[o + 1] = og; px[o + 2] = ob; px[o + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  })();
  cache.set(def.svg, job);
  return job;
}

function PixelSprite({ def, size }: { def: SpriteDef; size: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    pixelate(def).then((u) => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [def]);
  return url
    ? <img src={url} width={size} height={size} alt="" aria-hidden="true" style={{ imageRendering: 'pixelated', display: 'block' }} draggable={false} />
    : <span style={{ display: 'block', width: size, height: size }} aria-hidden="true" />;
}

/** A predator's portrait. `size` is the rendered width in CSS pixels; multiples of 64 keep every pixel square. */
export function PredatorSprite({ kind, size = 192 }: { kind: PredatorKind; size?: number }) {
  return <PixelSprite def={PREDATOR_SPRITES[kind]} size={size} />;
}

const SHEEP_DEFS = { warm: sheepBack(false), ice: sheepBack(true) };
/** The sheep, from behind, the way a battle shows the player's own creature; ice blue once frozen. */
export function SheepBackSprite({ size = 192, frozen = false }: { size?: number; frozen?: boolean }) {
  return <PixelSprite def={frozen ? SHEEP_DEFS.ice : SHEEP_DEFS.warm} size={size} />;
}
