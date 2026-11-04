// Regenerates arrow.svg and hand.svg from the pixel grids below: node src/skin/assets/cursors/make.mjs src/skin/assets/cursors
// It also writes arrow@2x-src.svg and hand@2x-src.svg; rasterise those to arrow.png and hand.png (the fallbacks for
// browsers that refuse SVG cursors), then delete them. The CSS that uses these is at the end of src/skin/styles/skin.css.
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2];
const PAL = { O: '#5B3A1E', F: '#FBF4E4', H: '#FFFFFF', S: '#E7D9B8', C: '#B57F4A', D: '#8C5A2E' };
const arrow = [
  'O...........',
  'OO..........',
  'OHO.........',
  'OHFO........',
  'OHFFO.......',
  'OHFFFO......',
  'OHFFFFO.....',
  'OHFFFFFO....',
  'OHFFFFFSO...',
  'OHFFFFFFSO..',
  'OHFFFFFFFSO.',
  'OHFFFSOOOOOO',
  'OHFOOFSO....',
  'OFO.OFSO....',
  'OO...OFSO...',
  'O....OFSO...',
  '......OFSO..',
  '.......OO...',
];
const hand = [
  '....OO........',
  '...OHFO.......',
  '...OHFO.......',
  '...OHFO.......',
  '...OHFOOO.....',
  '...OHFOHFOOO..',
  '...OHFOHFOHFOO',
  '.OOOHFSFFSFFSO',
  'OHFOFFSFFSFFSO',
  'OHFFFFFFFFFFSO',
  '.OFFFFFFFFFFSO',
  '.OFFFFFFFFFFSO',
  '..OFFFFFFFFSO.',
  '..OFFFFFFFFSO.',
  '...OCCCCCCDO..',
  '...OOOOOOOOO..',
];
function svg(rows, scale) {
  // Room for the shadow, rounded up to even sizes so 1.5x lands on whole CSS pixels.
  const w = rows[0].length + 1 + ((rows[0].length + 1) % 2), h = rows.length + 1 + ((rows.length + 1) % 2);
  const rects = [];
  // Soft voxel-style shadow: the silhouette offset one pixel down and right.
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') rects.push(`<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="#3B3028" fill-opacity="0.28"/>`); }));
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[c]}"/>`); }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}
for (const r of [...arrow, ...hand]) if (![12, 14].includes(r.length)) throw new Error('bad row ' + r);
for (const [n, rows] of [['arrow', arrow], ['hand', hand]]) {
  writeFileSync(`${OUT}/${n}.svg`, svg(rows, 1.5));
  writeFileSync(`${OUT}/${n}@2x-src.svg`, svg(rows, 2)); // rasterised to the PNG fallback
  console.log(n, svg(rows, 1.5).match(/width="([\d.]+)" height="([\d.]+)"/).slice(1).join('x'));
}
