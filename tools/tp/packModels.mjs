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
 * gets a lip under its front edge. Each added part is one colour step from the part it sits on (pack v2's grain rule 3, kept for scenery)
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
/** Long wooden runs, split into boards (pack v2's grain rule 4, kept for scenery: at most 0.4 m, two tones taking turns). */
const RUN = /board|rail|plank|beam|kick|footing|rung|edge|shelf/, RUN_MAT = /^(wood|darkWood|barnRed):/, BOARD = 8;
/**
 * The market's look, where the pack's own read as shapes with words put on them (Brian, 2026-11-25: signs "poorly
 * made, looks like u copy and pasted a bunch of random shapes and then just slapped some text on it", "weird blank
 * cards"). Done here so the pack's data stays the pack's.
 * - A stall's sign was a cream plate with a border, set across the middle of the awning. It is the stall's fascia now:
 *   one board from post to post in the awning's own colour, cream rails over and under it and a cream block at each end.
 *   The name is lettered on its middle (the `sign` part, which the screen reads for where the words go).
 * - A sack's label was a white square. It is a paler patch of the sack's own burlap, with the stencil on it.
 * - The notice board's slips have no pins (his rule of 2026-11-13: no fake fasteners).
 */
const FASCIA = { feedStall: 'scarfRed:-1', bellStand: 'giftGreen:-1' };
function restyle(m) {
  if (FASCIA[m.id]) {
    const sign = m.boxes.filter((b) => b.part === 'sign'), face = sign.find((b) => /board/.test(b.n)).b;
    const post = Math.max(...m.boxes.filter((b) => /front post/.test(b.n)).map((b) => b.b[3]));
    const [, y0, , , y1, z1] = face, z0 = z1 - 3, c = FASCIA[m.id], trim = 'trimWhite:1';
    const box = (n, b, col, part = 'body') => ({ n, part, c: col, season: false, b });
    return { ...m, boxes: [...m.boxes.filter((b) => b.part !== 'sign'),
      box('fascia', [-post, y0 - 1, z0, post, y1 + 1, z1 - 1], c),
      box('fascia face', [-post + 2, y0, z1 - 1, post - 2, y1, z1], c),
      box('fascia trim', [-post, y1, z0, post, y1 + 1, z1], trim), box('fascia trim', [-post, y0 - 1, z0, post, y0, z1], trim),
      box('fascia end', [-post, y0 - 1, z0, -post + 2, y1 + 1, z1], trim), box('fascia end', [post - 2, y0 - 1, z0, post, y1 + 1, z1], trim),
      box('fascia name', [face[0], y0, z1 - 1, face[3], y1, z1], c, 'sign')] };
  }
  // The odds board's face is a night board too, so its words are the kit's (wool, with the odds in the lantern's light).
  if (m.id === 'oddsBoard') return { ...m, boxes: m.boxes.map((b) => (b.part === 'face' ? { ...b, c: '#131D3B' } : b)) };
  if (m.id.startsWith('sack_')) return { ...m, boxes: m.boxes.map((b) => (b.part === 'patch' ? { ...b, c: 'hay:2' } : b)) };
  // The notice board's face is a night board and its slips raised tiles (Midnight's own tones), so its words are the
  // kit's wool on dark, like every other board in the game, not ink on cream paper.
  if (m.id === 'noticeBoard') return { ...m, boxes: m.boxes.filter((b) => b.n !== 'pin').map((b) => (b.n === 'cork' ? { ...b, c: '#131D3B' } : b.part === 'slip' ? { ...b, c: '#1B2A52' } : b)) };
  return m;
}

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
    // A lantern: an iron frame round its light (a bar up each corner), so it reads as panes, not a glowing block; a
    // two-cell light is made four across first, like its base.
    if (/glass/.test(b.n) && /^glow:/.test(b.c)) {
      if (w === 2 && d === 2) { x0 -= 1; x1 += 1; z0 -= 1; z1 += 1; }
      out.push({ ...b, b: [x0, y0, z0, x1, y1, z1] });
      const iron = boxes.find((o) => /base|roof/.test(o.n))?.c ?? 'iron:0';
      // Under four across there is no room for bars and panes both: the stall's lanterns read as two dark strokes.
      if (x1 - x0 >= 4) for (const [cx, cz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) out.push({ n: `${b.n}, frame bar`, part: b.part, c: iron, season: false, b: [cx, y0, cz, cx + 1, y1, cz + 1] });
      continue;
    }
    // A long wooden run is boards, not one strip: BOARD cells each, two tones taking turns, the joints of one row
    // staggered from the row below.
    if (RUN.test(b.n) && RUN_MAT.test(b.c) && !/snow/.test(b.n) && w > BOARD + 2 && w >= h && !fronts.has(b)) {
      const off = (Math.floor(y0 / 2) % 2) * (BOARD / 2);
      let k = 0;
      for (let a = x0; a < x1; k++) {
        const e = Math.min(x1, a === x0 ? x0 + BOARD - off : a + BOARD);
        const end = x1 - e < 3 ? x1 : e; // no sliver of a board at the end
        out.push({ ...b, n: `${b.n}, board ${k}`, c: k % 2 ? step(b.c, 1) : b.c, b: [a, y0, z0, end, y1, z1] });
        a = end;
      }
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

/**
 * The bombs at 16 cubes across, not the pack's 20 (Brian, 2026-11-25: "the bombs are a tad bit too high voxelrate").
 * One row in five is merged into its neighbour, the same rows on both sides of the middle, so the shape keeps its
 * symmetry and every feature stays whole cubes: nothing is blurred or resampled. Where two cubes merge, the one that
 * matters more is kept (the face's rim, then the face, a named motif, a raised or painted detail, the cap, the shell),
 * then the outer one, which is the one seen. The fuse is laid again as twelve 2 x 2 x 2 pieces of the new cube, and the
 * spark and its glow move with its tip. The cube is 0.03125 m, so a bomb is the size it was.
 */
export const BOMB_CELL = 0.03125;
const T = (s) => (s >= 0 ? s - Math.floor((s + 2) / 5) : -T(-s - 1) - 1);   // a cell along x or z: 20 across become 16
const TY = (s) => T(s - 10) + 8;                                              // a cell's height: the ball's middle (10) stays its middle (8)
const B = (b) => T(b - 1) + 1, BY = (b) => TY(b - 1) + 1;                    // a plane between two cells
export function coarsenBomb(m, skin) {
  const key = (x, y, z) => `${x},${y},${z}`;
  const src = new Map();
  m.boxes.forEach((b, i) => { for (let x = b.b[0]; x < b.b[3]; x++) for (let y = b.b[1]; y < b.b[4]; y++) for (let z = b.b[2]; z < b.b[5]; z++) src.set(key(x, y, z), { x, y, z, b, i }); });
  const rank = (b) => (b.part === 'face' ? (b.c === skin.face_colour ? 5 : 6) : b.part === 'detail' ? (b.n !== 'detail' ? 4 : 3) : b.part === 'cap' ? (b.n !== 'cap' ? 2 : 1) : 0);
  const out2 = (c) => c.x * c.x + (c.y - 10) * (c.y - 10) + c.z * c.z;
  const dst = new Map();
  for (const c of src.values()) {
    if (c.b.part === 'fuse' || c.b.part === 'spark') continue;
    const k = key(T(c.x), TY(c.y), T(c.z)), was = dst.get(k), r = rank(c.b);
    if (!was || r > was.r || (r === was.r && (out2(c) > out2(was.c) || (out2(c) === out2(was.c) && c.i > was.c.i)))) dst.set(k, { r, c, x: T(c.x), y: TY(c.y), z: T(c.z) });
  }
  // The fuse: twelve pieces of two cubes, from the first piece's place, standing on whatever is under it.
  const n = skin.fuse_piece_cells, [sx, sy, sz] = skin.fuse_start_cells;
  let fy = TY(sy);
  if (TY(sy - 1) === fy) fy += 1;
  const start = [T(sx), fy, T(sz)];
  const pieceOf = (k) => { const [dx, dy] = skin.fuse_pieces[k]; return [sx + dx * n, sy + dy * n, sz]; };
  const cells = [];
  skin.fuse_pieces.forEach(([dx, dy], k) => {
    const [ox, oy, oz] = pieceOf(k), from = src.get(key(ox, oy, oz)) ?? [...src.values()].find((c) => c.b.part === 'fuse');
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) cells.push({ x: start[0] + dx * n + x, y: start[1] + dy * n + y, z: start[2] + z, b: from.b });
  });
  // The spark and the glow keep their place beside the last piece.
  const last = skin.fuse_pieces.length - 1, [lx, ly, lz] = pieceOf(last), [ldx, ldy] = skin.fuse_pieces[last];
  const shift = [start[0] + ldx * n - lx, start[1] + ldy * n - ly, start[2] - lz];
  for (const c of src.values()) if (c.b.part === 'spark') cells.push({ x: c.x + shift[0], y: c.y + shift[1], z: c.z + shift[2], b: c.b });
  for (const d of dst.values()) cells.push({ x: d.x, y: d.y, z: d.z, b: d.c.b });
  // Cells back into boxes: runs along x, then equal runs joined up y, then z. No two overlap, so their order is free.
  const at = new Map();
  for (const c of cells) at.set(key(c.x, c.y, c.z), c);
  const same = (a, b) => a && b && a.b.c === b.b.c && a.b.part === b.b.part && a.b.n === b.b.n;
  const done = new Set(), boxes = [];
  const sorted = [...at.values()].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  for (const c of sorted) {
    if (done.has(key(c.x, c.y, c.z))) continue;
    let x1 = c.x + 1;
    while (same(c, at.get(key(x1, c.y, c.z))) && !done.has(key(x1, c.y, c.z))) x1++;
    const rowOk = (y, z) => { for (let x = c.x; x < x1; x++) { const o = at.get(key(x, y, z)); if (!same(c, o) || done.has(key(x, y, z))) return false; } return true; };
    let y1 = c.y + 1;
    while (rowOk(y1, c.z)) y1++;
    const slabOk = (z) => { for (let y = c.y; y < y1; y++) if (!rowOk(y, z)) return false; return true; };
    let z1 = c.z + 1;
    while (slabOk(z1)) z1++;
    for (let x = c.x; x < x1; x++) for (let y = c.y; y < y1; y++) for (let z = c.z; z < z1; z++) done.add(key(x, y, z));
    boxes.push({ n: c.b.n, part: c.b.part, c: c.b.c, season: false, b: [c.x, c.y, c.z, x1, y1, z1] });
  }
  const lo = [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.b[k]))), hi = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.b[k + 3])));
  const lights = (m.lights ?? []).map((l) => ({ ...l, at: [l.at[0] + shift[0], l.at[1] + shift[1], l.at[2] + shift[2]] }));
  const [fx, fyc, fz] = skin.face.centre_cells;
  const disc = [...dst.values()].filter((d) => d.c.b.part === 'face' && d.c.b.c === skin.face_colour);
  const discW = disc.length ? Math.max(...disc.map((d) => d.x)) - Math.min(...disc.map((d) => d.x)) + 1 : 6;
  const newSkin = { ...skin, face: { ...skin.face, centre_cells: [B(fx), BY(fyc), B(fz)], size_m: discW * BOMB_CELL, disc_cells: `${discW} across` }, fuse_start_cells: start };
  return { model: { ...m, cell_m: BOMB_CELL, boxes, lights, bounds_cells: [...lo, ...hi], size_m: [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * BOMB_CELL * 1e4) / 1e4) }, skin: newSkin };
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
  const skinsData = read('skins.json');
  for (const entry of [...index].sort((a, b) => a.id.localeCompare(b.id))) {
    let m = formModel(restyle(read(entry.file)));
    if (m.id.startsWith('bomb_')) { const k = m.id.slice(5), r = coarsenBomb(m, skinsData.skins[k]); m = r.model; skinsData.skins[k] = r.skin; }
    // Where two boxes overlap the later one wins (ITEMS_REMODEL.md rule 8); the mesher keeps the first box to claim a
    // cell, so the boxes are written last first.
    const boxes = [...m.boxes].reverse().map((b) => row([...b.b, ci(b.c), pi(b.part), b.season ? 1 : 0])).join(',');
    const lights = (m.lights ?? []).map((l) => row([...l.at, ci(l.c), l.radius_m, l.strength])).join(',');
    rows[where(m.id)].push(`  ${JSON.stringify(m.id)}: { cell: ${m.cell_m}, size: ${row(m.size_m)}, bounds: ${row(m.bounds_cells)}, lights: [${lights}], boxes: [${boxes}] },`);
  }
  // Home's fence bay, from the dream's pack, given the same form (posts with plinths, rails in boards) and without its
  // bulb string: both scenes place it with its bulbs off (T1 section 3, P1 section 3).
  const fence = JSON.parse(readFileSync(join(root, 'docs/dream/v3/data/models/fenceBay.json'), 'utf8'));
  const fenceFormed = formModel({ ...fence, boxes: fence.boxes.filter((b) => b.part === 'body') });
  const fenceBoxes = [...fenceFormed.boxes].reverse().map((b) => row([...b.b, ci(b.c), pi(b.part), b.season ? 1 : 0])).join(',');
  const fenceRow = `  "fenceBay": { cell: ${num(fenceFormed.cell_m)}, size: ${row(fenceFormed.size_m)}, bounds: ${row(fenceFormed.bounds_cells)}, lights: [], boxes: [${fenceBoxes}] },`;
  rows.market.push(fenceRow); rows.rink.push(fenceRow);
  const head = (what) => [`// Generated by tools/tp/packModels.mjs from docs/trading-post-practice/data (${what}). Do not edit: change the data and run it again.`, '/* eslint-disable */'];
  const skins = skinsData, bursts = read('bursts.json');
  const glow = JSON.parse(readFileSync(join(root, 'docs/dream/v3/data/palette.json'), 'utf8')).glow;
  const core = [
    ...head('the bombs, skins, bursts, timings and icons; the colour and part lists every model file shares'),
    `export const COLOURS: readonly string[] = ${JSON.stringify(colours)};`,
    `export const PARTS: readonly string[] = ${JSON.stringify(parts)};`,
    `/** The named glows (the dream's palette), so the bombs need nothing of the dream's. */`,
    `export const GLOW: Record<string, string> = ${JSON.stringify(glow)};`,
    '/** A model: its cell and size in metres, its bounds in cells, its glows [x, y, z, colour, radius_m, strength], its boxes [x0, y0, z0, x1, y1, z1, colour, part, season]. */',
    'export interface ModelData { cell: number; size: readonly number[]; bounds: readonly number[]; lights: readonly (readonly number[])[]; boxes: readonly (readonly number[])[] }',
    '/** A bomb skin (T2, ITEMS_REMODEL.md): its face (middle in cells, size in metres), digit, danger and face colours, its fuse (first piece\'s corner in cells, the 12 pieces in 2-cell steps) and spark. */',
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
