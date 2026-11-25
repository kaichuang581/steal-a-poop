#!/usr/bin/env node
/**
 * Packs the Trading Post and Practice pack (docs/trading-post-practice/data) into src/skin/tp/models.gen.ts
 * (X2 step S1). The generated file is never edited by hand: change the pack's data and run
 * `node tools/tp/packModels.mjs` again. src/skin/tp/__tests__/models.test.ts fails when the two differ.
 *
 * Models keep their exact cells, in the dream's row form (src/skin/dream/models.gen.ts): [x0, y0, z0, x1, y1, z1,
 * colour, part, season], with one shared list of colour tokens ("material:step" of LADDER, "glow:<name>", "#hex", or
 * "lit:#hex" for a colour that gives light) and one of part names. The scenes, skins, bursts, timings and icons are
 * carried over as the pack has them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const data = join(root, 'docs/trading-post-practice/data');
export const OUT = join(root, 'src/skin/tp/models.gen.ts');
/** The scenes' own models go in their own files, loaded with their screens: only the bombs ship with the game. */
export const OUT_MARKET = join(root, 'src/skin/tp/market.gen.ts');
export const OUT_RINK = join(root, 'src/skin/tp/rink.gen.ts');
const RINK_IDS = /^(rinkBoards|rinkBoardsFront|tileRack|snowBank|tallyBoard|coachChair|whistle|practiceCrate|broom|lightPost|iceBlock|bib[A-Z].*)$/;
/**
 * Form for the props (Brian, 2026-11-25: "a lot of the assets, wood poles, tables, etc, are very flat shapes"). The
 * camera looks straight on, so a post or a table top that is one box reads as a flat rectangle. Every post, pole and
 * leg gets a plinth at its foot, a cap (or, under whatever it carries, a collar), a band a third of the way up when it
 * is tall, and its corners cut when it is three cells or more across; the front plank of a table, bench or counter
 * gets a lip under its front edge. Each added part is one colour step from the part it sits on (VOXEL_GRAIN.md rule 3)
 * and one cell (0.05 m) or more (rule 1). The pack's JSON is untouched; this runs as it is packed.
 */
const step = (c, d) => {
  const m = /^([a-zA-Z]+):(-?\d)$/.exec(c);
  if (!m || m[1] === 'glow' || m[1] === 'lit') return c;
  let n = Number(m[2]) + d;
  if (n > 2 || n < -2) n = Number(m[2]) - d;
  return `${m[1]}:${n}`;
};
const POST = /\b(post|leg|handle)\b/, NOT_POST = /lantern|snow|foot|slat|board|frame|wall|beam/;
const TOP = /plank|counter top|cap rail|rack shelf/;
export function formModel(m) {
  if (/^(bomb_|sound_|bib|whistle|sack_)/.test(m.id)) return m;
  const out = [], boxes = m.boxes;
  const hits = (b, q) => q !== b && boxes.some((o) => o !== b && o.b[0] < q[3] && q[0] < o.b[3] && o.b[1] < q[4] && q[1] < o.b[4] && o.b[2] < q[5] && q[2] < o.b[5]);
  // The front plank of each run of planks at one height gets the lip.
  const fronts = new Set();
  const runs = new Map();
  for (const b of boxes) if (TOP.test(b.n)) { const k = `${b.n.replace(/,.*$/, '')}|${b.b[1]}`; const f = runs.get(k); if (!f || b.b[5] > f.b[5]) runs.set(k, b); }
  for (const b of runs.values()) fronts.add(b);
  for (const b of boxes) {
    let [x0, y0, z0, x1, y1, z1] = b.b, w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (POST.test(b.n) && !NOT_POST.test(b.n) && h >= 6 && h >= 3 * Math.max(w, d)) {
      // A tall pole two cells square is a stick on screen: it is made four across (the miniature plan's 0.2 m structure
      // block), corners cut below, so it reads as a solid rounded post.
      if (w === 2 && d === 2 && h >= 20 && !/handle/.test(b.n)) { x0 -= 1; x1 += 1; z0 -= 1; z1 += 1; w = 4; d = 4; }
      const add = (n, bb, c) => out.push({ n: `${b.n}, ${n}`, part: b.part, c, season: false, b: bb });
      if (w >= 3 && d >= 3) {
        // Corners cut: a cross of two boxes instead of one square column.
        add('core', [x0 + 1, y0, z0, x1 - 1, y1, z1], b.c);
        add('core', [x0, y0, z0 + 1, x1, y1, z1 - 1], b.c);
      } else out.push({ ...b, b: [x0, y0, z0, x1, y1, z1] });
      add('plinth', [x0 - 1, y0, z0 - 1, x1 + 1, y0 + 2, z1 + 1], step(b.c, -1));
      if (h >= 30) { const yb = y0 + Math.round(h / 3); add('band', [x0 - 1, yb, z0 - 1, x1 + 1, yb + 1, z1 + 1], step(b.c, -1)); }
      const above = [x0, y1, z0, x1, y1 + 1, z1];
      if (hits(b, above)) add('collar', [x0 - 1, y1 - 2, z0 - 1, x1 + 1, y1 - 1, z1 + 1], step(b.c, 1));
      else add('cap', [x0 - 1, y1 - 1, z0 - 1, x1 + 1, y1, z1 + 1], step(b.c, 1));
      continue;
    }
    out.push(b);
    if (fronts.has(b) && x1 - x0 >= 16 && y0 >= 2) {
      const lip = [x0 + 1, y0 - 1, z1 - 1, x1 - 1, y0, z1];
      if (!hits(b, lip)) out.push({ n: `${b.n}, lip`, part: b.part, c: step(b.c, -2), season: false, b: lip });
    }
  }
  const lo = [0, 1, 2].map((k) => Math.min(m.bounds_cells[k], ...out.map((b) => b.b[k])));
  const hi = [3, 4, 5].map((k) => Math.max(m.bounds_cells[k], ...out.map((b) => b.b[k])));
  return { ...m, boxes: out, bounds_cells: [...lo, ...hi], size_m: [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * m.cell_m * 1e4) / 1e4) };
}

const where = (id) => (id.startsWith('bomb_') ? 'core' : RINK_IDS.test(id) ? 'rink' : 'market');

const num = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e4) / 1e4));
const row = (a) => `[${a.map((v) => (typeof v === 'number' ? num(v) : JSON.stringify(v))).join(',')}]`;
const read = (f) => JSON.parse(readFileSync(join(data, f), 'utf8'));
const drop = (o, ...keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/** The three generated modules' texts: { core, market, rink }. They share one colour list and one part list (in core). */
export function renderAll() {
  const index = read('models/index.json').models;
  const colours = [], parts = [];
  const ci = (c) => { let i = colours.indexOf(c); if (i < 0) { i = colours.length; colours.push(c); } return i; };
  const pi = (p) => { let i = parts.indexOf(p); if (i < 0) { i = parts.length; parts.push(p); } return i; };
  const rows = { core: [], market: [], rink: [] };
  for (const entry of [...index].sort((a, b) => a.id.localeCompare(b.id))) {
    const m = formModel(read(entry.file));
    // Where two boxes overlap the later one wins (VOXEL_GRAIN.md rule 9); the mesher keeps the first box to claim a
    // cell, so the boxes are written last first.
    const boxes = [...m.boxes].reverse().map((b) => row([...b.b, ci(b.c), pi(b.part), b.season ? 1 : 0])).join(',');
    const lights = (m.lights ?? []).map((l) => row([...l.at, ci(l.c), l.radius_m, l.strength])).join(',');
    rows[where(m.id)].push(`  ${JSON.stringify(m.id)}: { cell: ${num(m.cell_m)}, size: ${row(m.size_m)}, bounds: ${row(m.bounds_cells)}, lights: [${lights}], boxes: [${boxes}] },`);
  }
  const head = (what) => [`// Generated by tools/tp/packModels.mjs from docs/trading-post-practice/data (${what}). Do not edit: change the data and run it again.`, '/* eslint-disable */'];
  const skins = read('skins.json'), bursts = read('bursts.json');
  const glow = JSON.parse(readFileSync(join(root, 'docs/dream/v3/data/palette.json'), 'utf8')).glow;
  const core = [
    ...head('the bombs, skins, bursts, timings and icons; the colour and part lists every model file shares'),
    `export const COLOURS: readonly string[] = ${JSON.stringify(colours)};`,
    `export const PARTS: readonly string[] = ${JSON.stringify(parts)};`,
    `/** The named glows (the dream's palette), so the bombs need nothing of the dream's. */`,
    `export const GLOW: Record<string, string> = ${JSON.stringify(glow)};`,
    '/** A model: its cell and size in metres, its bounds in cells, its glows [x, y, z, colour, radius_m, strength], its boxes [x0, y0, z0, x1, y1, z1, colour, part, season]. */',
    'export interface ModelData { cell: number; size: readonly number[]; bounds: readonly number[]; lights: readonly (readonly number[])[]; boxes: readonly (readonly number[])[] }',
    '/** A bomb skin (T2, VOXEL_GRAIN.md): its face (middle in cells, size in metres), digit, danger and face colours, its fuse (first piece\'s corner in cells, the 12 pieces in 2-cell steps) and spark. */',
    'export interface SkinData { key: string; name: string; source: string; line: string; face: { centre_cells: readonly number[]; size_m: number; disc_cells?: string }; digit: string; danger_digit: string; face_colour: string; fuse: readonly string[]; spark: readonly string[]; fuse_start_cells: readonly number[]; fuse_pieces: readonly (readonly number[])[]; fuse_piece_cells: number }',
    '/** A burst (T3) at its fullest: boxes [x, y, z, w, h, d, colour key, lit] in metres from the bomb\'s spot. */',
    'export interface BurstData { name: string; colours: Record<string, string>; pieces: number; move: string; sound?: string; boxes_at_fullest: readonly (readonly [number, number, number, number, number, number, string, boolean])[] }',
    'export const MODELS: Record<string, ModelData> = {', ...rows.core, '};',
    `export const SKINS: Record<string, SkinData> = ${JSON.stringify(skins.skins)};`,
    `export const BURST_COLOURS: Record<string, string> = ${JSON.stringify(bursts.all_colours)};`,
    `export const BURSTS: Record<string, BurstData> = ${JSON.stringify(bursts.bursts)};`,
    `export const TIMINGS = ${JSON.stringify(drop(read('timings.json'), 'about'))} as const;`,
    `export const PIXEL_ART: Record<string, { colours: Record<string, string>; rows: readonly string[] }> = ${JSON.stringify(normaliseArt(read('pixel-art.json')))};`,
  ];
  const market = [...head('the market row'), "import type { ModelData } from './models.gen';", 'export const MARKET_MODELS: Record<string, ModelData> = {', ...rows.market, '};',
    `export const MARKET = ${JSON.stringify(drop(read('market.json'), 'about', 'shown', 'inside_in_the_pictures'))} as const;`];
  const rink = [...head('the rink'), "import type { ModelData } from './models.gen';", 'export const RINK_MODELS: Record<string, ModelData> = {', ...rows.rink, '};',
    `export const RINK = ${JSON.stringify(drop(read('rink.json'), 'about'))} as const;`];
  return { core: core.join('\n') + '\n', market: market.join('\n') + '\n', rink: rink.join('\n') + '\n' };
}
/** The core module's text (kept for the test that compares it). */
export const render = () => renderAll().core;

/** The pixel-art file as { colours, rows } per icon, whatever shape the pack wrote it in. */
function normaliseArt(art) {
  const icons = art.grids ?? art.icons ?? art;
  const out = {};
  for (const [k, v] of Object.entries(icons)) if (v && typeof v === 'object' && (v.rows || v.grid)) out[k] = { colours: v.colours ?? v.colors ?? {}, rows: v.rows ?? v.grid };
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = renderAll();
  writeFileSync(OUT, all.core); writeFileSync(OUT_MARKET, all.market); writeFileSync(OUT_RINK, all.rink);
  console.log(`wrote ${OUT}, ${OUT_MARKET}, ${OUT_RINK}`);
}
