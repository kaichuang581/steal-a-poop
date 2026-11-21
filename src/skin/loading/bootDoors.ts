import { START, VIEWBOX, guidePath } from './yarnWord.ts'; // with its extension: vite.config.ts reads this file too

/**
 * The loading screen as the page first shows it (docs/landing/LANDING-PLAN.md 3.7): Home's night, a few slow
 * snowflakes, the name "fleeced" as a faint dotted line, and the red yarn ball at the foot of the "f", before any of
 * the game's code has arrived. vite.config.ts writes this markup into index.html, with the rules from skin.css
 * between its `boot-doors` marks. Plain text, no React and no script: the built page's policy allows no inline script.
 *
 * BarnDoors draws the same screen from the same functions here, so when it takes over nothing on screen moves: the
 * first thing anyone sees change is the yarn starting. The names (`boot-doors`, `sk-doors`, `bootDoorsMarkup`) stay
 * from the barn doors this replaced, because Rendering.tsx, the gate tools and the e2e helpers find the screen by them.
 */
export const BOOT_DOORS_ID = 'boot-doors';

export interface Flake { left: string; width: string; opacity: string; animationDuration: string; animationDelay: string; '--drift': string }
/** A few slow flakes, placed by a fixed hash so every load looks the same: 2 to 4 px, 16% to 40% white, 16 to 30 s. */
export const FLAKES: Flake[] = Array.from({ length: 22 }, (_, i) => {
  const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: `${(r(1) * 100).toFixed(1)}%`, width: `${2 + Math.round(r(2) * 2)}px`, opacity: (0.16 + r(6) * 0.24).toFixed(2), animationDuration: `${(16 + r(3) * 14).toFixed(1)}s`, animationDelay: `${(-r(4) * 30).toFixed(1)}s`, '--drift': `${Math.round((r(5) - 0.5) * 80)}px` };
});

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const css = (o: object) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`).join(';');
const pc = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Where the ball's box stands at p = 0, in percent of the word's box: START (4.797%, 94.444%). */
export const BALL_AT = { left: pc((START.x - VIEWBOX.x) / VIEWBOX.w), top: pc((START.y - VIEWBOX.y) / VIEWBOX.h) };

/** The word's dotted guide, in word units. */
export const guideMarkup = (): string =>
  `<svg class="sk-yarn-guide" viewBox="${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}" aria-hidden="true"><path d="${guidePath()}"/></svg>`;

/** The ball's shadow (under) and shade (over), fixed while its wraps turn (3.3, Appendix C), in units of its radius.
 *  `id` prefixes the gradient's id: yb0 in the page's copy, yb1 in the game's, so the two never share one. */
export const ballShadowMarkup = (): string =>
  '<svg class="sk-yarn-ball-shadow" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">' +
  [1.08, 1.04, 1.0].map((r) => `<circle cx="0.1" cy="0.2" r="${r}" fill="rgb(4,8,20)" fill-opacity="0.1"/>`).join('') + '</svg>';
export const ballShadeMarkup = (id: string): string =>
  `<svg class="sk-yarn-ball-shade" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><defs><radialGradient id="${id}-shade" gradientUnits="userSpaceOnUse" cx="-0.32" cy="-0.36" fx="-0.32" fy="-0.36" fr="0.15" r="1.02">` +
  '<stop offset="0" stop-color="rgb(255,220,200)" stop-opacity="0.1"/><stop offset="0.55" stop-color="rgb(255,220,200)" stop-opacity="0"/><stop offset="1" stop-color="rgb(30,8,6)" stop-opacity="0.45"/>' +
  `</radialGradient></defs><circle r="1" fill="url(#${id}-shade)"/></svg>`;

/** The ball's picture, at the path the site is served from (`base` ends in a slash). */
export const ballImage = (base: string) => `${base}loading/yarn-ball.webp`;

/** The screen at p = 0, as text for index.html. */
export function bootDoorsMarkup(base: string): string {
  return `<div id="${BOOT_DOORS_ID}" class="sk-doors sk-yarn" data-phase="shut" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Loading">` +
    `<div class="sk-yarn-snow" aria-hidden="true">${FLAKES.map((f) => `<i style="${attr(css(f))}"></i>`).join('')}</div>` +
    `<div class="sk-yarn-word">${guideMarkup()}<canvas class="sk-yarn-shadow"></canvas><canvas class="sk-yarn-strand"></canvas>` +
    `<div class="sk-yarn-ball" style="left:${BALL_AT.left};top:${BALL_AT.top}"><div class="sk-yarn-ball-body">${ballShadowMarkup()}<img class="sk-yarn-ball-wraps" src="${attr(ballImage(base))}" alt="" draggable="false">${ballShadeMarkup('yb0')}</div></div>` +
    '</div></div>';
}

/** The rules that draw the screen at p = 0, cut out of skin.css (between its `boot-doors:start` and `boot-doors:end`
 *  marks), with comments and spare space taken out. They go into the page beside the markup. */
export function bootDoorsCss(skinCss: string): string {
  const m = /\/\* boot-doors:start[\s\S]*?\*\/([\s\S]*?)\/\* boot-doors:end \*\//.exec(skinCss);
  if (!m) throw new Error('skin.css has lost its boot-doors:start / boot-doors:end marks: the page cannot draw its loading screen');
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}
