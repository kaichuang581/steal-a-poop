import { useEffect, useState } from 'react';
import type { PredatorKind } from '../../hunt/hunt';

/**
 * Pixel-art sprites for the Daily Hunt, cute chibi battlers like a handheld's 64 x 64 sprites: a big head, big shiny eyes,
 * a small round body. Each is drawn as simple vector shapes on a 64 x 64 grid (one unit is one pixel), then turned into real pixel art in the browser: rendered at 64 px, every pixel snapped to that animal's
 * palette (no blurry in-between colours), and a one-pixel dark outline drawn round the silhouette, like a handheld
 * battle sprite. The result is cached as a PNG and scaled up with crisp pixels.
 */
const SIZE = 64;
const OUTLINE = '#2A2026';
const INK = '#2A2026';

export interface SpriteDef { palette: string[]; svg: string }

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>`;

const BLUSH = '#EFA3A3';
/** Big shiny cartoon eyes: a dark oval, a white highlight, and a mischievous brow above. */
const eyes = (iris: string, y = 27, dx = 7, angry = true) => `
  <ellipse cx="${32 - dx}" cy="${y}" rx="2.7" ry="3.3" fill="${iris}"/><ellipse cx="${32 + dx}" cy="${y}" rx="2.7" ry="3.3" fill="${iris}"/>
  <rect x="${31 - dx - 1}" y="${y - 2}" width="1.6" height="1.6" fill="#FFFFFF"/><rect x="${31 + dx - 1}" y="${y - 2}" width="1.6" height="1.6" fill="#FFFFFF"/>
  ${angry ? `<polygon points="${32 - dx - 4},${y - 6} ${32 - dx + 3},${y - 4} ${32 - dx + 3},${y - 3} ${32 - dx - 4},${y - 5}" fill="${INK}"/>
  <polygon points="${32 + dx + 4},${y - 6} ${32 + dx - 3},${y - 4} ${32 + dx - 3},${y - 3} ${32 + dx + 4},${y - 5}" fill="${INK}"/>` : ''}`;
const blush = (y = 33) => `<ellipse cx="19" cy="${y}" rx="2.6" ry="1.3" fill="${BLUSH}"/><ellipse cx="45" cy="${y}" rx="2.6" ry="1.3" fill="${BLUSH}"/>`;

// ---------- Grey Wolf (and, darker with a crown and a scar, the Shadow Wolf boss) ----------
function wolf(c: { fur: string; dark: string; light: string; eye: string; inner: string }, boss = false): SpriteDef {
  return {
    palette: [c.fur, c.dark, c.light, c.eye, c.inner, INK, '#FFFFFF', BLUSH, ...(boss ? ['#BFE3F5', '#E9F6FF', '#C9C3D6'] : [])],
    svg: svg(`
      <path d="M43 52 Q60 50 58 33 Q57 27 53 29 Q55 42 43 45 Z" fill="${c.fur}"/><path d="M53 29 Q57 27 58 33 Q56 32 54 33 Z" fill="${c.light}"/>
      <ellipse cx="32" cy="50" rx="12" ry="9" fill="${c.fur}"/>
      <ellipse cx="32" cy="47" rx="6" ry="6" fill="${c.light}"/><polygon points="26,42 32,50 38,42" fill="${c.light}"/>
      <ellipse cx="26" cy="58" rx="4.5" ry="3" fill="${c.light}"/><ellipse cx="38" cy="58" rx="4.5" ry="3" fill="${c.light}"/>
      <polygon points="16,22 17,3 29,14" fill="${c.fur}"/><polygon points="48,22 47,3 35,14" fill="${c.fur}"/>
      <polygon points="19,18 19,8 26,14" fill="${c.inner}"/><polygon points="45,18 45,8 38,14" fill="${c.inner}"/>
      <ellipse cx="32" cy="28" rx="17" ry="14" fill="${c.fur}"/>
      <polygon points="16,28 9,36 18,37" fill="${c.fur}"/><polygon points="48,28 55,36 46,37" fill="${c.fur}"/>
      <path d="M27 15 L37 15 L35 22 L29 22 Z" fill="${c.dark}"/>
      <ellipse cx="32" cy="35" rx="8.5" ry="6" fill="${c.light}"/>
      ${eyes(c.eye)}
      ${blush(33)}
      <ellipse cx="32" cy="31.5" rx="2.8" ry="2" fill="${INK}"/>
      <path d="M28.5 36 Q32 39 35.5 36" stroke="${INK}" stroke-width="1.2" fill="none"/>
      <polygon points="33,37 35.5,36.5 34.5,40" fill="#FFFFFF"/>
      ${boss ? `<polygon points="22,15 23,8 26,13 29,5 32,12 35,5 38,13 41,8 42,15" fill="#BFE3F5"/><rect x="22" y="14" width="20" height="2.5" fill="#E9F6FF"/>
        <polygon points="40,20 46,30 44.5,31 38.5,21" fill="#C9C3D6"/>` : ''}
    `),
  };
}

// ---------- Red Fox: huge black-tipped ears, a white-tipped brush of a tail, dark stockings ----------
const FOX: SpriteDef = {
  palette: ['#E07B2E', '#A9561B', '#FBEEDC', '#6B3410', INK, '#FFFFFF', BLUSH],
  svg: svg(`
    <path d="M41 54 Q63 52 59 30 Q57 21 50 25 Q55 41 41 46 Z" fill="#E07B2E"/><ellipse cx="56" cy="27" rx="4.5" ry="4" fill="#FBEEDC"/>
    <ellipse cx="32" cy="50" rx="11" ry="9" fill="#E07B2E"/><ellipse cx="32" cy="48" rx="6" ry="6.5" fill="#FBEEDC"/>
    <rect x="24" y="53" width="5" height="8" rx="2" fill="#6B3410"/><rect x="35" y="53" width="5" height="8" rx="2" fill="#6B3410"/>
    <polygon points="15,24 12,1 29,13" fill="#E07B2E"/><polygon points="49,24 52,1 35,13" fill="#E07B2E"/>
    <polygon points="18,19 16,7 25,13" fill="#FBEEDC"/><polygon points="46,19 48,7 39,13" fill="#FBEEDC"/>
    <polygon points="12,1 13.5,8 16,5" fill="#6B3410"/><polygon points="52,1 50.5,8 48,5" fill="#6B3410"/>
    <ellipse cx="32" cy="27" rx="16" ry="13" fill="#E07B2E"/>
    <path d="M27 14 L37 14 L35 21 L29 21 Z" fill="#A9561B"/>
    <path d="M16 28 Q24 33 32 42 Q40 33 48 28 Q48 38 32 43 Q16 38 16 28 Z" fill="#FBEEDC"/>
    ${eyes(INK, 26)}
    ${blush(32)}
    <ellipse cx="32" cy="34" rx="2.4" ry="1.8" fill="${INK}"/>
    <path d="M29 37 Q32 39.5 35 37" stroke="${INK}" stroke-width="1.2" fill="none"/>
  `),
};

// ---------- Lynx: black ear tufts, a spotted coat, a big striped ruff, a stubby tail ----------
const LYNX: SpriteDef = {
  palette: ['#C9A57A', '#8E6E4A', '#F6EBD9', '#8CC63F', INK, '#E7A0A0', '#FFFFFF'],
  svg: svg(`
    <ellipse cx="45" cy="47" rx="4" ry="2.5" fill="#C9A57A"/><ellipse cx="48" cy="46" rx="1.8" ry="1.8" fill="${INK}"/>
    <ellipse cx="32" cy="50" rx="12" ry="9" fill="#C9A57A"/><ellipse cx="32" cy="49" rx="6" ry="6" fill="#F6EBD9"/>
    <circle cx="24" cy="50" r="1.3" fill="#8E6E4A"/><circle cx="40" cy="51" r="1.3" fill="#8E6E4A"/><circle cx="27" cy="55" r="1.2" fill="#8E6E4A"/>
    <ellipse cx="26" cy="58" rx="5" ry="3" fill="#F6EBD9"/><ellipse cx="38" cy="58" rx="5" ry="3" fill="#F6EBD9"/>
    <polygon points="18.5,10 18,1 19.5,1 20.5,10" fill="${INK}"/><polygon points="45.5,10 46,1 44.5,1 43.5,10" fill="${INK}"/>
    <polygon points="16,21 19,7 28,14" fill="#C9A57A"/><polygon points="48,21 45,7 36,14" fill="#C9A57A"/>
    <polygon points="18.5,17 19.5,10 25,14" fill="#F6EBD9"/><polygon points="45.5,17 44.5,10 39,14" fill="#F6EBD9"/>
    <polygon points="15,27 7,40 14,38 11,45 20,42 24,46 32,43 40,46 44,42 53,45 50,38 57,40 49,27" fill="#F6EBD9"/>
    <path d="M10 41 L15 36 M13 45 L18 39 M54 41 L49 36 M51 45 L46 39" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="32" cy="27" rx="16" ry="13" fill="#C9A57A"/>
    <path d="M29 15 L29.5 20 M32 14 L32 20 M35 15 L34.5 20" stroke="#8E6E4A" stroke-width="1.5"/>
    <ellipse cx="25" cy="27" rx="3.3" ry="3.3" fill="#8CC63F"/><ellipse cx="39" cy="27" rx="3.3" ry="3.3" fill="#8CC63F"/>
    <rect x="24.2" y="24.5" width="1.6" height="5" fill="${INK}"/><rect x="38.2" y="24.5" width="1.6" height="5" fill="${INK}"/>
    <rect x="23" y="25" width="1.2" height="1.2" fill="#FFFFFF"/><rect x="37" y="25" width="1.2" height="1.2" fill="#FFFFFF"/>
    <polygon points="20,21 27,23 27,24 20,22" fill="${INK}"/><polygon points="44,21 37,23 37,24 44,22" fill="${INK}"/>
    <ellipse cx="29" cy="35" rx="3.5" ry="2.8" fill="#F6EBD9"/><ellipse cx="35" cy="35" rx="3.5" ry="2.8" fill="#F6EBD9"/>
    <polygon points="30,31 34,31 32,33.5" fill="#E7A0A0"/>
    <path d="M32 33.5 L32 35.5 M29.5 37 Q32 38.5 34.5 37" stroke="${INK}" stroke-width="1.1" fill="none"/>
  `),
};

// ---------- Polar Bear: round and chunky, small eyes, a big black nose ----------
const BEAR: SpriteDef = {
  palette: ['#F4F1E8', '#D6CFBE', '#B8AF9C', INK, '#FFFFFF', BLUSH],
  svg: svg(`
    <ellipse cx="32" cy="49" rx="16" ry="11.5" fill="#F4F1E8"/><ellipse cx="32" cy="51" rx="9" ry="7" fill="#D6CFBE"/>
    <ellipse cx="22" cy="59" rx="6" ry="3.2" fill="#F4F1E8"/><ellipse cx="42" cy="59" rx="6" ry="3.2" fill="#F4F1E8"/>
    <ellipse cx="22" cy="60" rx="2.5" ry="1.4" fill="#B8AF9C"/><ellipse cx="42" cy="60" rx="2.5" ry="1.4" fill="#B8AF9C"/>
    <circle cx="19" cy="15" r="5.5" fill="#F4F1E8"/><circle cx="45" cy="15" r="5.5" fill="#F4F1E8"/>
    <circle cx="19" cy="15" r="2.6" fill="#B8AF9C"/><circle cx="45" cy="15" r="2.6" fill="#B8AF9C"/>
    <ellipse cx="32" cy="27" rx="16" ry="13.5" fill="#F4F1E8"/>
    <ellipse cx="32" cy="34" rx="7.5" ry="5.5" fill="#D6CFBE"/>
    <ellipse cx="24.5" cy="26" rx="2.2" ry="2.6" fill="${INK}"/><ellipse cx="39.5" cy="26" rx="2.2" ry="2.6" fill="${INK}"/>
    <rect x="23.5" y="24.5" width="1.2" height="1.2" fill="#FFFFFF"/><rect x="38.5" y="24.5" width="1.2" height="1.2" fill="#FFFFFF"/>
    <polygon points="20,20 27,22 27,23 20,21.5" fill="${INK}"/><polygon points="44,20 37,22 37,23 44,21.5" fill="${INK}"/>
    ${blush(31)}
    <ellipse cx="32" cy="31.5" rx="3.4" ry="2.3" fill="${INK}"/><rect x="30.5" y="30.3" width="1.4" height="0.9" fill="#FFFFFF"/>
    <path d="M32 33.5 L32 35.5 M29 36.5 Q32 38.5 35 36.5" stroke="${INK}" stroke-width="1.1" fill="none"/>
  `),
};

// ---------- Golden Eagle: a round little bird, golden head, hooked beak, wings ready ----------
const EAGLE: SpriteDef = {
  palette: ['#6B4426', '#8E5B30', '#D9A85A', '#F2C14E', '#C8902A', INK, '#FFFFFF', BLUSH],
  svg: svg(`
    <ellipse cx="15" cy="42" rx="7" ry="12" fill="#6B4426" transform="rotate(25 15 42)"/><ellipse cx="49" cy="42" rx="7" ry="12" fill="#6B4426" transform="rotate(-25 49 42)"/>
    <path d="M11 40 L9 50 M14 42 L13 52 M53 40 L55 50 M50 42 L51 52" stroke="#8E5B30" stroke-width="1.5"/>
    <ellipse cx="32" cy="46" rx="12" ry="13" fill="#6B4426"/>
    <path d="M27 44 L29 47 L31 44 M33 48 L35 51 L37 48 M27 51 L29 54 L31 51" stroke="#8E5B30" stroke-width="1.4" fill="none"/>
    <path d="M25 57 L23 62 M27 57 L27 62 M29 57 L31 62 M35 57 L33 62 M37 57 L37 62 M39 57 L41 62" stroke="#F2C14E" stroke-width="1.6"/>
    <polygon points="26,14 29,6 31,12 34,5 36,12 39,7 38,15" fill="#D9A85A"/>
    <ellipse cx="32" cy="24" rx="14" ry="12" fill="#D9A85A"/>
    <ellipse cx="25" cy="23" rx="2.5" ry="3" fill="${INK}"/><ellipse cx="39" cy="23" rx="2.5" ry="3" fill="${INK}"/>
    <rect x="24" y="21.5" width="1.2" height="1.2" fill="#FFFFFF"/><rect x="38" y="21.5" width="1.2" height="1.2" fill="#FFFFFF"/>
    <polygon points="19,16 28,19 28,20.5 19,18" fill="#6B4426"/><polygon points="45,16 36,19 36,20.5 45,18" fill="#6B4426"/>
    ${blush(29)}
    <path d="M27 27 Q32 24.5 37 27 Q37 33 32 36 Q31 33 29 33 Q27 31 27 27 Z" fill="#F2C14E"/>
    <path d="M31 33 Q32 36 32 36 Q34 34 33 32 Z" fill="#C8902A"/>
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
  wolf: wolf({ fur: '#9A97A6', dark: '#6E6B78', light: '#E6E3EC', eye: INK, inner: '#E2B4B4' }),
  fox: FOX,
  lynx: LYNX,
  bear: BEAR,
  eagle: EAGLE,
  shadow: wolf({ fur: '#4A4458', dark: '#2E2A38', light: '#8E88A0', eye: '#E2403A', inner: '#7A4A5A' }, true),
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
