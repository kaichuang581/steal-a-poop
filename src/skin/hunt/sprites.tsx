import { useEffect, useState } from 'react';
import type { PredatorKind } from '../../hunt/hunt';

/**
 * Battle sprites for the Daily Hunt, in the style of handheld monster battlers: 96 x 96, a 3/4 view, each creature in
 * its own idle pose. Each is drawn as flat vector shapes on a 96-unit grid and then finished as pixel art in the
 * browser (pixelate, below): every pixel snapped to the creature's palette, each colour region shaded with a light rim
 * toward the upper left and shadow toward the lower right, and the silhouette outlined in a darker shade of whatever it
 * touches (selective outlining) rather than flat black. The designs are our own; only the poses take after the genre.
 */
export const SPRITE = 96;
const INK = '#2A2026'; // the selective outline darkens toward this
const WHITE = '#FFFFFF';
/** The lineart colour: every shape is outlined in it, which pixelates to the crisp 1 px lines of a battle sprite. */
const LINE = '#1C1824';

export interface SpriteDef {
  palette: string[];
  svg: string;
  /** Colours left unshaded: lineart, eye glints, irises. */
  flat?: string[];
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" stroke="${LINE}" stroke-width="1.15" stroke-linejoin="round" shape-rendering="crispEdges">${body}</svg>`;
/** A filled, outlined shape: `d` is a path, or "x,y x,y ..." for a polygon. */
const S = (fill: string, d: string) => (/^[\d.,\s-]+$/.test(d) ? `<polygon points="${d}" fill="${fill}"/>` : `<path d="${d}" fill="${fill}"/>`);
/** A line drawn in the lineart colour (fur partings, feather shafts, mouths). */
const L = (d: string, w = 1) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;
/** A narrow, fierce almond eye with a coloured iris, a slit of pupil and a glint. */
const EYE = (pts: string, iris: string, px: number, py: number) =>
  `${S(iris, pts)}<rect x="${px}" y="${py}" width="1.4" height="2.6" fill="${LINE}" stroke="none"/><rect x="${px - 1.2}" y="${py - 0.4}" width="1" height="1" fill="${WHITE}" stroke="none"/>`;

// ---------- Golden Eagle: diving at the sheep, wings flung wide, talons thrust forward, crest swept back ----------
const EAGLE: SpriteDef = (() => {
  const dk = '#3E2412', br = '#6A3E1E', md = '#8A5428', edge = '#B98446', gold = '#DDAE62', cream = '#F3E7C9', beak = '#F0C040', foot = '#F2C64A';
  return {
    palette: [dk, br, md, edge, gold, cream, beak, '#C99A2E', foot, '#B03030', '#F8B830', '#3A3020', LINE, WHITE],
    flat: [LINE, WHITE, '#F8B830'],
    svg: svg(`
      ${S(dk, '20,24 3,3 9,3 27,21')}${S(br, '24,26 11,1 17,2 30,23')}${S(dk, '28,29 20,2 26,4 34,27')}${S(br, '32,33 29,6 34,8 38,32')}
      ${S(md, 'M42 48 L30 36 L18 20 L26 18 L38 30 L48 40 Z')}
      ${S(br, '64,64 91,59 93,65 66,70')}${S(dk, '64,68 91,70 89,76 64,73')}${S(br, '62,70 85,80 81,84 60,75')}
      ${S(cream, '87,59 91,59 93,65 89,65')}${S(cream, '87,70 91,70 89,76 86,75')}${S(cream, '82,78 85,80 81,84 79,82')}
      ${S(br, 'M36 52 Q44 42 58 46 Q72 52 70 66 Q64 78 50 80 Q38 78 34 68 Z')}
      ${S(md, 'M36 58 Q42 50 50 54 Q49 66 43 74 Q36 70 36 58 Z')}
      ${L('M39 59 L42 62 L45 58 M40 65 L43 68 L46 64 M44 56 L46 59')}
      ${S(md, 'M58 72 L62 84 L68 82 L64 70 Z')}${S(md, 'M44 72 Q39 79 37 84 L46 86 L51 77 Z')}
      ${S(foot, '58,82 70,82 72,86 60,86')}${S(foot, '62,85 66,92 63,93 60,86')}${S(foot, '66,85 73,90 71,92 64,86')}
      ${S(foot, '38,84 27,86 29,89 38,87')}${S(foot, '40,86 31,92 34,94 42,88')}${S(foot, '44,86 44,94 47,94 47,86')}${S(foot, '46,84 53,82 53,85')}
      ${S(LINE, '27,86 24,86 26,89')}${S(LINE, '31,92 29,95 33,94')}${S(LINE, '44,94 45,97 47,94')}${S(LINE, '66,92 66,95 63,93')}${S(LINE, '73,90 75,92 71,92')}
      ${S(md, 'M46 50 Q54 36 66 24 L72 20 Q66 34 60 44 Q56 50 52 55 Z')}
      ${S(dk, '58,40 92,2 95,6 62,44')}${S(br, '60,44 94,10 95,15 64,47')}${S(dk, '62,47 94,20 93,25 66,50')}${S(br, '64,50 92,30 90,35 67,53')}${S(dk, '66,53 88,40 85,44 68,56')}
      ${L('M64 43 L90 8 M66 47 L92 19 M68 51 L90 29 M69 54 L86 39')}
      ${S(edge, 'M50 47 Q60 31 74 19 Q84 11 94 4 L95 8 Q84 16 77 23 Q65 35 57 51 Z')}
      ${S(cream, '28,42 36,25 40,27 34,44')}${S(cream, '32,42 44,27 46,31 38,45')}${S(gold, '36,44 51,33 52,38 42,47')}${S(cream, '38,48 53,43 53,48 42,52')}
      ${S(gold, 'M22 50 Q24 40 34 40 Q44 42 46 51 Q46 60 38 64 Q28 66 24 60 Z')}
      ${S(cream, '38,55 50,57 46,64 38,62')}${L('M41 57 L45 61')}
      ${S(beak, 'M27 50 L16 52 Q10 54 10 61 Q12 58 15 58 L25 57 Z')}${S('#3A3020', 'M10 61 Q10 54 14 53 L15 58 Q12 58 10 61 Z')}
      ${S('#B03030', '24,57 16,59 23,60')}${S('#C99A2E', 'M24 58 L16 60 L18 64 L26 61 Z')}
      ${EYE('28,48 32,45.5 37,46.5 33,50', '#F8B830', 31.6, 46.6)}
      ${S(LINE, '25,46 38,42.5 38.5,44.5 27,47.5')}
    `),
  };
})();

// ---------- Grey Wolf: snarling, crouched to spring, hackles up (recoloured with frost and a crown: the Shadow Wolf) ----------
function wolf(c: { fur: string; light: string; dark: string; far: string; eye: string; mark?: string; frost?: string }, boss = false): SpriteDef {
  const mouth = '#8A2030';
  return {
    palette: [c.fur, c.light, c.dark, c.far, c.eye, mouth, LINE, WHITE, ...(c.mark ? [c.mark] : []), ...(c.frost ? [c.frost, '#E9F6FF'] : [])],
    flat: [LINE, WHITE, c.eye],
    svg: svg(`
      ${S(c.fur, 'M70 52 L84 34 L81 41 L92 30 L87 42 L95 40 L84 52 L76 57 Z')}
      ${S(c.far, 'M66 64 L70 80 L66 90 L74 90 L77 80 L74 62 Z')}${S(c.far, 'M30 66 L28 88 L36 89 L37 70 Z')}
      ${S(c.fur, 'M27 56 Q38 46 56 48 Q72 48 77 58 Q79 70 68 72 Q54 74 40 72 Q29 70 27 56 Z')}
      ${S(c.light, 'M36 68 Q50 74 66 70 Q58 77 46 77 Q38 75 36 68 Z')}
      ${S(c.dark, 'M30 53 L33 38 L38 46 L42 33 L46 44 L52 35 L54 46 L61 41 L59 50 Q46 54 30 53 Z')}
      ${S(c.fur, 'M62 56 Q74 54 77 64 L73 74 L75 86 L81 90 L70 90 L66 76 Q60 68 62 56 Z')}
      ${S(c.fur, 'M36 62 L40 88 L47 90 L48 86 L44 84 L43 64 Z')}
      ${L('M70 88 L71 90 M74 88 L75 90 M42 88 L42 90 M45 88 L45 90')}
      ${L('M45 60 Q50 62 54 60 M66 62 Q70 64 72 68')}
      ${c.frost ? `${S(c.frost, '40,48 42,36 46,46')}${S(c.frost, '48,47 52,34 55,46')}${S(c.frost, '57,48 62,38 63,49')}` : ''}
      ${S(c.far, '31,42 41,31 42,44')}
      ${S(c.fur, 'M13 54 Q17 42 30 42 Q40 44 41 54 Q39 62 30 64 Q20 64 13 54 Z')}
      ${S(c.fur, '25,45 35,29 38,44')}${S(c.light, '29,42 34,33 35,42')}
      ${S(c.light, 'M3 56 Q8 51 18 51 Q23 56 20 60 Q14 64 5 62 Z')}
      ${S(mouth, '5,62 18,59.5 16,66 8,66')}${S(WHITE, '9,62 11,62 10,64.5')}${S(WHITE, '14,61 16,61 15,63.5')}${S(WHITE, '10,66 12,66 11,63.5')}
      ${S(LINE, 'M1.5 55.5 Q3 53 6 54 Q6 57 3.5 57.5 Z')}
      ${L('M10 54 Q12 52 14 54 M12 57 Q14 55 16 57')}
      ${S(c.light, 'M23 58 L19 67 L25 63 L27 69 L31 61 Z')}
      ${c.mark ? `${S(c.mark, '30,46 36,44 34,48')}${S(c.mark, '38,72 44,70 42,76')}` : ''}
      ${EYE('19,50 24,47.5 28,49.5 23,52', c.eye, 22.6, 48.6)}
      ${S(LINE, '17,47.5 29,45.5 29,47 18,49')}
      ${boss ? `${S(c.frost!, '24,42 22,30 28,38')}${S(c.frost!, '30,40 32,26 35,38')}${S('#E9F6FF', '36,40 40,28 41,41')}` : ''}
    `),
  };
}

// ---------- Red Fox: stepping forward, head turned to the sheep, an S of a tail held high ----------
const FOX: SpriteDef = (() => {
  const or = '#E07A2C', wh = '#FBEEDC', bk = '#2E1A10', inner = '#F0B898';
  return {
    palette: [or, wh, bk, inner, '#F8B030', LINE, WHITE],
    flat: [LINE, WHITE, '#F8B030'],
    svg: svg(`
      ${S(or, 'M64 62 Q84 64 88 48 Q90 36 80 30 Q90 26 94 36 Q96 54 84 66 Q74 72 62 70 Z')}
      ${S(wh, 'M80 30 Q86 24 94 30 Q93 36 89 36 Q85 32 80 30 Z')}${L('M70 64 Q80 60 84 50 M76 66 Q86 60 88 50')}
      ${S(bk, 'M66 66 L70 90 L76 90 L72 66 Z')}${S(bk, 'M36 70 L34 90 L40 90 L41 72 Z')}
      ${S(or, 'M30 58 Q40 50 56 52 Q70 54 72 64 Q70 72 58 72 L40 72 Q30 70 30 58 Z')}
      ${S(wh, 'M40 70 Q50 74 60 71 Q54 76 46 75 Z')}
      ${S(or, 'M60 56 Q72 56 72 66 L68 74 L66 76 L62 76 Q56 68 60 56 Z')}${S(bk, 'M62 76 L64 90 L71 90 L68 74 Z')}
      ${S(or, 'M38 64 L34 76 L44 76 L44 68 Z')}${S(bk, 'M34 76 L28 88 L25 90 L34 90 L40 80 L44 76 Z')}
      ${S(wh, 'M27 50 Q36 52 40 60 L36 64 L38 70 L32 66 L30 72 L26 64 Q24 56 27 50 Z')}
      ${S(or, '22,32 18,6 34,26')}${S(inner, '24,28 21,12 31,25')}${S(bk, '18,6 20,15 25,11')}
      ${S(or, '36,28 45,7 47,31')}${S(inner, '39,27 44,13 45,29')}${S(bk, '45,7 43,15 46,14')}
      ${S(or, 'M17 40 Q21 28 34 28 Q45 30 46 40 Q44 50 34 52 Q24 52 17 40 Z')}
      ${S(or, 'M5 45 Q10 39 21 39 Q26 44 22 48 Q14 50 7 48 Z')}
      ${S(wh, 'M13 47 Q22 44 30 48 L34 54 L27 52 L23 57 L19 50 Z')}
      ${S(LINE, 'M3 44 Q4 42 7 43 Q7 46 4 46.5 Z')}${L('M8 48.5 Q12 50 16 49')}
      ${EYE('22,39 27,36.5 32,38.5 27,41', '#F8B030', 26.2, 37.4)}
      ${S(LINE, '20,36.5 32,35 32.5,36.6 21,38.2')}${L('M23 42 Q27 43 31 41')}
      ${L('M50 58 Q56 60 60 58 M34 33 L38 35')}
    `),
  };
})();

// ---------- Lynx: stalking low, shoulders up, huge paws forward, tufted ears and a striped ruff ----------
const LYNX: SpriteDef = (() => {
  const tan = '#C9A270', cr = '#F4E8D2', sp = '#7A5A36', far = '#A9844F';
  return {
    palette: [tan, cr, sp, far, '#E7A0A0', '#9BD050', LINE, WHITE],
    flat: [LINE, WHITE, '#9BD050'],
    svg: svg(`
      ${S(tan, '77,50 88,45 91,51 82,56')}${S(LINE, '87,45 91,44 92,50 90,51')}
      ${S(far, 'M64 64 L68 88 L76 88 L72 64 Z')}${S(far, 'M44 66 L44 88 L52 88 L50 68 Z')}
      ${S(tan, 'M28 60 Q34 48 48 50 Q62 52 74 50 Q82 52 80 62 Q76 70 64 70 L40 72 Q30 70 28 60 Z')}
      ${S(cr, 'M38 70 Q52 74 64 70 Q58 76 48 76 Q40 75 38 70 Z')}
      ${S(tan, 'M33 53 Q39 39 51 46 Q46 52 33 53 Z')}
      ${S(sp, 'M46 58 Q49 56 51 59 Q48 61 46 58 Z')}${S(sp, 'M56 55 Q59 53 61 56 Q58 58 56 55 Z')}${S(sp, 'M66 56 Q69 54 71 57 Q68 59 66 56 Z')}
      ${S(sp, 'M52 64 Q55 62 57 65 Q54 67 52 64 Z')}${S(sp, 'M62 62 Q65 60 67 63 Q64 65 62 62 Z')}${S(sp, 'M40 60 Q43 58 45 61 Q42 63 40 60 Z')}
      ${S(tan, 'M65 58 Q78 58 79 68 L75 76 L81 88 L70 88 L68 78 Q62 70 65 58 Z')}${L('M72 86 L72 88 M76 86 L76 88')}
      ${S(tan, 'M36 64 L28 82 L19 87 L19 90 L35 90 L40 80 L44 68 Z')}${S(cr, 'M19 87 L19 90 L35 90 L33 86 Z')}${L('M24 87 L24 90 M28 87 L28 90')}
      ${S(cr, 'M19 60 L12 73 L19 69 L21 77 L27 69 L31 75 L36 64 Z')}${L('M15 70 L20 64 M22 74 L25 66 M30 72 L31 66')}
      ${S(tan, '20,47 20,30 30,42')}${S(cr, '22,43 22,35 27,41')}${S(LINE, '19.5,31 19,19 21,19 21,31')}
      ${S(far, '30,45 37,31 39,47')}${S(LINE, '36.5,32 37,21 38.8,21 38,32')}
      ${S(tan, 'M11 56 Q13 44 26 44 Q37 46 38 56 Q36 64 28 66 Q17 66 11 56 Z')}
      ${L('M24 45 L25 50 M28 45 L28 50 M32 46 L31 50')}
      ${S(cr, 'M9 58 Q12 54 18 55 Q20 59 16 62 Q11 62 9 58 Z')}${S(cr, 'M16 58 Q20 55 25 57 Q25 62 20 63 Q16 62 16 58 Z')}
      ${S('#E7A0A0', '12,55 17,55 14.5,58')}${L('M14.5 58 L14.5 60 M11 62 Q15 64 19 62')}
      ${EYE('17,51 21,48.5 25,50 21,52.5', '#9BD050', 20.4, 49.2)}${EYE('28,50 31,48 34,49.5 31,51.5', '#9BD050', 30.6, 48.6)}
      ${S(LINE, '15,48 25,46.5 25,48 16,49.5')}${L('M11 53 L16 54')}
    `),
  };
})();

// ---------- Polar Bear: reared up on its hind legs, forepaws raised, roaring ----------
const BEAR: SpriteDef = (() => {
  const fur = '#EFEADC', sh = '#D6CDB6', mouth = '#7A2028';
  return {
    palette: [fur, sh, mouth, '#E89A9A', '#3A2E2A', LINE, WHITE],
    flat: [LINE, WHITE, '#3A2E2A'],
    svg: svg(`
      ${S(sh, 'M33 46 L22 30 L15 17 L24 14 L30 25 L41 39 Z')}${S(sh, 'M13 18 Q16 9 25 12 Q27 18 23 21 Q16 22 13 18 Z')}
      ${S(LINE, '13,12 12,7 15,11')}${S(LINE, '17,10 17,5 19,10')}${S(LINE, '21,10 23,6 23,11')}
      ${S(fur, 'M29 72 L24 90 L41 90 L43 76 Z')}${S(fur, 'M55 76 L57 90 L74 90 L68 72 Z')}
      ${L('M29 88 L29 90 M34 88 L34 90 M61 88 L61 90 M66 88 L66 90')}
      ${S(fur, 'M28 48 Q48 36 68 48 Q77 64 68 80 Q48 88 30 80 Q21 64 28 48 Z')}
      ${S(sh, 'M36 52 L40 58 L44 54 L48 60 L52 54 L56 58 L60 52 Q64 66 58 78 Q48 84 38 78 Q32 66 36 52 Z')}
      ${S(fur, '24,62 19,68 26,68')}${S(fur, '71,64 77,70 70,70')}${L('M42 68 L45 71 M50 70 L53 73 M46 76 L48 78')}
      ${S(fur, 'M63 46 L76 30 L82 16 L90 19 L85 34 L72 52 Z')}${S(fur, 'M80 18 Q82 8 91 10 Q94 16 90 21 Q84 23 80 18 Z')}
      ${S(LINE, '82,10 82,5 85,9')}${S(LINE, '86,8 88,4 89,9')}${S(LINE, '91,10 94,7 93,12')}${L('M76 34 Q80 36 82 34')}
      ${S(fur, 'M31 26 Q36 13 48 13 Q60 13 65 26 Q65 38 56 42 Q48 46 40 42 Q31 38 31 26 Z')}
      ${S(fur, 'M33 15 Q34 9 40 10 Q41 15 37 17 Z')}${S(fur, 'M63 15 Q62 9 56 10 Q55 15 59 17 Z')}
      ${S(sh, 'M39 29 Q48 23 57 29 Q59 40 48 45 Q37 40 39 29 Z')}
      ${S(mouth, '41,35 55,35 52,44 44,44')}${S('#E89A9A', '45,41 51,41 50,44 46,44')}
      ${S(WHITE, '42,35 44,35 43,38')}${S(WHITE, '52,35 54,35 53,38')}${S(WHITE, '44,44 45.5,44 44.8,41.5')}${S(WHITE, '50.5,44 52,44 51.2,41.5')}
      ${S(LINE, 'M44 29 Q48 26 52 29 Q50 32 48 32 Q46 32 44 29 Z')}
      ${EYE('36,24 39,22.5 42,23.5 39,25.5', '#3A2E2A', 38.4, 22.6)}${EYE('54,23.5 57,22.5 60,24 57,25.5', '#3A2E2A', 56.4, 22.6)}
      ${S(LINE, '34,21.5 43,22 43,23.5 35,23')}${S(LINE, '62,21.5 53,22 53,23.5 61,23')}
    `),
  };
})();

// ---------- The sheep, a little ram seen from behind at 3/4: curled horns, a cloud of wool, a tuft of a tail ----------
function sheepBack(frozen: boolean): SpriteDef {
  const wool = frozen ? '#DDF0FA' : '#F7F1E4', woolSh = frozen ? '#A9D8F0' : '#E2D6BE', face = frozen ? '#6E9DBF' : '#3E3838',
    hoof = frozen ? '#4E7FA3' : '#262222', horn = frozen ? '#C6E4F4' : '#CDB48C', hornSh = frozen ? '#8FC0DE' : '#9C8460';
  return {
    palette: [wool, woolSh, face, hoof, horn, hornSh, LINE],
    flat: [LINE],
    svg: svg(`
      ${S(face, 'M24 72 L22 90 L30 90 L32 74 Z')}${S(face, 'M60 76 L60 90 L68 90 L68 74 Z')}${S(face, 'M40 76 L38 92 L46 92 L48 78 Z')}${S(face, 'M72 70 L74 88 L82 88 L80 68 Z')}
      ${S(hoof, '22,88 30,88 30,91 22,91')}${S(hoof, '38,90 46,90 46,93 38,93')}${S(hoof, '60,88 68,88 68,91 60,91')}${S(hoof, '74,86 82,86 82,89 74,89')}
      ${S(woolSh, 'M14 62 Q14 40 48 38 Q84 38 86 60 Q84 80 50 84 Q16 82 14 62 Z')}
      ${[[24, 56, 13], [38, 44, 14], [56, 42, 14], [72, 52, 13], [50, 60, 17], [30, 68, 12], [66, 68, 12], [18, 66, 8], [44, 74, 11], [80, 62, 8]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${wool}"/>`).join('')}
      ${L('M30 48 Q34 44 38 48 M50 36 Q54 32 58 36 M60 56 Q64 52 68 56 M24 62 Q28 58 32 62 M44 66 Q48 62 52 66 M70 44 Q74 40 78 44')}
      ${S(wool, 'M12 66 Q9 60 14 58 Q19 59 18 64 Q16 68 12 66 Z')}${L('M13 62 Q15 60 16 63')}
      ${S(face, 'M56 24 Q66 15 77 20 Q83 27 78 34 Q68 39 60 34 Q54 30 56 24 Z')}
      ${S(face, 'M82 30 Q91 29 93 33 Q88 36 81 34 Z')}
      ${S(horn, 'M56 32 Q46 30 46 22 Q48 14 56 16 Q62 19 58 25 Q55 27 54 24')}${S(hornSh, 'M50 22 Q51 18 55 19 Q57 22 54 24 Q51 24 50 22 Z')}
      ${S(horn, 'M76 22 Q84 12 90 18 Q93 26 86 28 Q82 27 83 23')}${S(hornSh, 'M85 18 Q89 18 89 22 Q87 25 85 23 Q84 20 85 18 Z')}
      ${[[62, 20, 5.5], [69, 16, 6], [74, 21, 5], [60, 26, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${wool}"/>`).join('')}
    `),
  };
}

export const PREDATOR_SPRITES: Record<PredatorKind, SpriteDef> = {
  wolf: wolf({ fur: '#8F8C9E', light: '#D6D3DE', dark: '#5E5B70', far: '#6E6B80', eye: '#F8D040' }),
  fox: FOX,
  lynx: LYNX,
  bear: BEAR,
  eagle: EAGLE,
  shadow: wolf({ fur: '#3E3850', light: '#7E7698', dark: '#24202F', far: '#2C283A', eye: '#FF4A3A', mark: '#C83838', frost: '#9ED2EE' }, true),
};

// ---------- vector -> finished pixel art ----------
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const COOL: RGB = [58, 48, 110]; // shadows lean cool and violet, as hand-shaded sprites do
const WARM: RGB = [255, 248, 230];
const shade = (c: RGB, k: number): RGB => mix(c.map((v) => v * (1 - k)) as RGB, COOL, k * 0.5);
const light = (c: RGB, k: number): RGB => mix(c, WARM, k);
const cache = new Map<string, Promise<string>>();

/**
 * Renders a sprite at 96 x 96 and finishes it as pixel art: palette snap, per-region rim light and shadow, and a
 * selective outline. Returns a PNG data URL (cached per sprite).
 */
export function pixelate(def: SpriteDef): Promise<string> {
  const hit = cache.get(def.svg);
  if (hit) return hit;
  const job = (async () => {
    const N = SPRITE;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(def.svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, N, N);
    const data = ctx.getImageData(0, 0, N, N);
    const px = data.data;
    const pal = def.palette.map(hex);
    const flat = new Set((def.flat ?? []).map((h) => def.palette.indexOf(h)));
    // 1. Snap to the palette: idx[i] is the palette index, or -1 for empty.
    const idx = new Int16Array(N * N).fill(-1);
    for (let i = 0; i < N * N; i++) {
      const o = i * 4;
      if (px[o + 3] < 110) continue;
      const a = px[o + 3] / 255;
      const r = px[o] / a, g = px[o + 1] / a, b = px[o + 2] / a;
      let best = 0, d = Infinity;
      pal.forEach((c, k) => {
        const dd = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
        if (dd < d) { d = dd; best = k; }
      });
      idx[i] = best;
    }
    // 2. Regions (4-connected runs of one colour) and their sizes; tiny ones stay flat.
    const region = new Int32Array(N * N).fill(-1);
    const sizes: number[] = [];
    for (let i = 0; i < N * N; i++) {
      if (idx[i] < 0 || region[i] >= 0) continue;
      const id = sizes.length;
      let n = 0;
      const stack = [i];
      region[i] = id;
      while (stack.length) {
        const j = stack.pop()!;
        n++;
        const x = j % N, y = (j / N) | 0;
        for (const k of [x > 0 ? j - 1 : -1, x < N - 1 ? j + 1 : -1, y > 0 ? j - N : -1, y < N - 1 ? j + N : -1]) {
          if (k >= 0 && region[k] < 0 && idx[k] === idx[j]) { region[k] = id; stack.push(k); }
        }
      }
      sizes.push(n);
    }
    const same = (x: number, y: number, r: number) => x >= 0 && y >= 0 && x < N && y < N && region[y * N + x] === r;
    // 3. Shade: light from the upper left. A rim of light where the region meets something above-left, and two steps
    //    of shadow along its lower-right edge.
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x, k = idx[i];
        if (k < 0) continue;
        let c: RGB = pal[k];
        const r = region[i];
        if (!flat.has(k) && sizes[r] >= 36) {
          if (!same(x + 1, y + 1, r) || !same(x + 2, y + 1, r)) c = shade(c, 0.32);
          else if (!same(x + 2, y + 2, r) || !same(x + 3, y + 3, r)) c = shade(c, 0.16);
          else if (!same(x - 1, y - 1, r) || !same(x, y - 1, r)) c = light(c, 0.32);
        }
        out.set([c[0], c[1], c[2], 255], i * 4);
      }
    // 4. Selective outline (only for sprites without their own lineart): each empty pixel touching the sprite takes a
    //    dark shade of the colour it touches.
    const lined = def.palette.includes(LINE);
    for (let y = 0; y < N && !lined; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (idx[i] >= 0) continue;
        let touch = -1;
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < N && yy < N && idx[yy * N + xx] >= 0) { touch = idx[yy * N + xx]; break; }
        }
        if (touch < 0) continue;
        const c = mix(shade(pal[touch], 0.6), hex(INK), 0.45);
        out.set([c[0], c[1], c[2], 255], i * 4);
      }
    data.data.set(out);
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

/** A predator in its battle pose. `size` is in CSS pixels (96 inside the battle screen). */
export function PredatorSprite({ kind, size = SPRITE }: { kind: PredatorKind; size?: number }) {
  return <PixelSprite def={PREDATOR_SPRITES[kind]} size={size} />;
}

export const SHEEP_DEFS = { warm: sheepBack(false), ice: sheepBack(true) };
/** The sheep from behind, the way a battle shows the player's own creature; ice blue once frozen. */
export function SheepBackSprite({ size = SPRITE, frozen = false }: { size?: number; frozen?: boolean }) {
  return <PixelSprite def={frozen ? SHEEP_DEFS.ice : SHEEP_DEFS.warm} size={size} />;
}

const shadows = new Map<string, Promise<string>>();
/**
 * A sprite as a black silhouette, for a bestiary card not yet met (plan v7 Part 5.6). With `eyes`, the bright red
 * pixels (the Shadow Wolf's eyes) show through the dark.
 */
function silhouette(def: SpriteDef, eyes: boolean): Promise<string> {
  const key = `${def.svg}:${eyes}`;
  const hit = shadows.get(key);
  if (hit) return hit;
  const job = (async () => {
    const url = await pixelate(def);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SPRITE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, SPRITE, SPRITE);
    const px = data.data;
    for (let o = 0; o < px.length; o += 4) {
      if (px[o + 3] === 0) continue;
      const eye = eyes && px[o] > 230 && px[o + 1] < 120 && px[o + 2] < 110;
      if (!eye) px.set([24, 22, 34], o);
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  })();
  shadows.set(key, job);
  return job;
}

/** A predator as a silhouette (red eyes optional). */
export function SilhouetteSprite({ kind, size = SPRITE, eyes = false }: { kind: PredatorKind; size?: number; eyes?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    silhouette(PREDATOR_SPRITES[kind], eyes).then((u) => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [kind, eyes]);
  return url
    ? <img src={url} width={size} height={size} alt="" aria-hidden="true" style={{ imageRendering: 'pixelated', display: 'block' }} draggable={false} />
    : <span style={{ display: 'block', width: size, height: size }} aria-hidden="true" />;
}
