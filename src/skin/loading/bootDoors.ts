import { DOOR_BOXES, LINTEL_BEAM, LINTEL_SNOW } from './doorBoxes.ts'; // with its extension: vite.config.ts reads this file too

/**
 * The barn doors as the page first shows them: shut, under the snowy beam, snow falling in front, before any of the
 * game's code has arrived. The game's code is a few megabytes, and until it was in there was nothing on screen at all
 * (Brian, 2026-11-13: "why is the loading screen not what pops up when the game is loading?"). So vite.config.ts writes
 * this markup into index.html, with the handful of rules from skin.css that draw shut doors (the block marked
 * `boot-doors` there). Plain text, no React and no script: the built page's policy allows no inline script.
 *
 * It is the same picture BarnDoors draws, from the same numbers, classes and snowflakes, so when BarnDoors takes over
 * (its first pair of doors is already shut) nothing on screen moves: the sign drops in on its ropes, and that is all
 * anyone sees of the handover.
 */
export const BOOT_DOORS_ID = 'boot-doors';

/** The pictures and voxel counts the doors' rules lay out from, as the custom properties skin.css reads. `base` is the
 *  path the site is served at, with its closing slash. */
export function doorArt(base: string): Record<string, string | number> {
  const art = (part: string) => `url("${base}loading/doors-${part}.webp")`;
  return {
    '--doors-leaves': art('leaves'), '--doors-lintel': art('lintel'), '--doors-sill': art('sill'),
    '--vox-cols': DOOR_BOXES.leaves.w, '--leaf-rows': DOOR_BOXES.leaves.h,
    '--lintel-rows': DOOR_BOXES.lintel.h, '--lintel-above': LINTEL_BEAM + LINTEL_SNOW, '--sill-rows': DOOR_BOXES.sill.h,
  };
}

export interface Flake { left: string; width: string; animationDuration: string; animationDelay: string; '--drift': string }
/** A few flakes drifting down in front of the doors: placed by a fixed hash, so every load looks the same. */
export const FLAKES: Flake[] = Array.from({ length: 22 }, (_, i) => {
  const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: `${(r(1) * 100).toFixed(1)}%`, width: `${4 + Math.round(r(2) * 4)}px`, animationDuration: `${7 + r(3) * 7}s`, animationDelay: `${-r(4) * 14}s`, '--drift': `${Math.round((r(5) - 0.5) * 80)}px` };
});

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const css = (o: object) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`).join(';');

/** The shut doors, as text for index.html. Parts and classes are BarnDoors' own, less the sign and the lantern light. */
export function bootDoorsMarkup(base: string): string {
  return `<div id="${BOOT_DOORS_ID}" class="sk-doors" data-phase="shut" role="status" aria-label="Loading" style="${attr(css(doorArt(base)))}">` +
    '<div class="sk-doors-frame"><div class="sk-door sk-door-l"><span class="sk-door-art"></span></div><div class="sk-door sk-door-r"><span class="sk-door-art"></span></div></div>' +
    '<div class="sk-doors-sky"></div><div class="sk-doors-lintel"></div><div class="sk-doors-sill"></div>' +
    `<div class="sk-doors-snow" aria-hidden="true">${FLAKES.map((f) => `<i style="${attr(css(f))}"></i>`).join('')}</div>` +
    '</div>';
}

/** The rules that draw shut doors, cut out of skin.css (between its `boot-doors:start` and `boot-doors:end` marks), with
 *  comments and spare space taken out. They go into the page beside the markup. */
export function bootDoorsCss(skinCss: string): string {
  const m = /\/\* boot-doors:start[\s\S]*?\*\/([\s\S]*?)\/\* boot-doors:end \*\//.exec(skinCss);
  if (!m) throw new Error('skin.css has lost its boot-doors:start / boot-doors:end marks: the page cannot draw its doors');
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}
