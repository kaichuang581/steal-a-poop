/**
 * Stage 1 of the scene checker: connect (plan file 18, section 4.2 a). Nothing floats.
 *
 * The method is tools/floatingVoxels.ts's own: every voxel is a box in metres, two boxes touch when they share a face
 * or an edge, touching boxes are joined (union-find), and what is left apart is a piece. What changed:
 *
 *   - No pass for a piece whose lowest voxel is at y <= 0. A piece is grounded only if it joins the ground piece, the
 *     piece with the most voxels. The old tool let anything with its foot at or under y = 0 through, ground or no
 *     ground under it.
 *   - Every scene, at both detail levels: the pen, the dream and the podium too, and what a touch device builds.
 *   - Each voxel set lies where the game draws it (tools/scenes/build.ts), not where it was built. The old tool laid
 *     every set at the coordinates it was built in, so anything built round its own origin (the cat, a door leaf, the
 *     clock) landed in the middle of the barn floor and joined it by accident.
 *
 * What this stage judges, and what it leaves:
 *
 *   world     Parts whose `body` is 'world': the game draws them with a transform that never changes and keeps their
 *             voxels on the world's axes. Every piece of them must join the ground piece. A piece that does not is
 *             loose.
 *   things    Parts whose `body` is anything else: set down or moved by a mesh transform. WHERE a thing stands (on
 *             its beam, in the wheelbarrow, 4 m up in the air) is the place stage's business, not this one's: this
 *             stage never asks whether a thing touches the world. It asks one thing of each: is it whole? A thing in
 *             more pieces than one has loose pieces of its own (a clock face standing off its drum).
 *   props     The eight models the old tool checked with --props, each alone: one piece, or its other pieces are
 *             loose. There is no floor under a model, so there is no y <= 0 pass here either.
 *
 * Nothing found here fails the run by itself. Every loose piece is one entry of `failures`, named with the code that
 * built it, and one in a count that is handed in as a ratchet: the count may only fall, and a new loose piece raises
 * it. Only an entry of docs/visual-overhaul/EXEMPT.json takes a piece out of the loose count, and then it is counted
 * as excused instead, which may only fall too.
 */
import { boxes } from './build';
import type { Detail, Exemption, Failure, Part, StageOptions, StageResult, Thing, World } from './build';

export const id = 'connect';
export const needs = { scenes: 'all' as const, models: true };

/** The models the old tool checked with --props, under the names it gave them. */
// The dream's fences, bale and sign post were voxel props until its redesign (docs/dream, 2026-11-24): they are drawn on a flat canvas now.
export const PROPS = ['bomb', 'trophy'] as const;

const EPS = 1e-4;
/** The side of the sorting cells, in metres: the old tool's. */
const CELL = 0.5;

export interface Piece {
  voxels: number;
  /** How many of its voxels each part gave, most first. */
  from: { part: Part; voxels: number }[];
  /** The corner of its first voxel, as the old tool printed it. */
  first: [number, number, number];
  /** x0, y0, z0, x1, y1, z1 round the whole piece. */
  box: [number, number, number, number, number, number];
  /** The cell size of its first voxel. */
  size: number;
  /** How far its underside is above the highest thing under its footprint that is not itself; null when nothing is. */
  gapBelow: number | null;
}

/**
 * Joins the voxels of `parts` by face and edge and hands back the pieces, biggest first. `boxOf` says where each
 * part's voxels are (by default `boxes`: the part's own frame); a part it gives null for is left out and named in
 * `skipped`. Two boxes touch when they overlap on at least one axis and meet or overlap on the others: a shared corner
 * alone is not touching.
 */
export function pieces(parts: Part[], boxOf: (part: Part) => Float64Array | null = boxes, gaps = true): { pieces: Piece[]; voxels: number; skipped: Part[] } {
  const used: { part: Part; at: number; box: Float64Array }[] = [], skipped: Part[] = [];
  let n = 0;
  for (const part of parts) {
    const box = boxOf(part);
    if (!box) { skipped.push(part); continue; }
    used.push({ part, at: n, box });
    n += part.count;
  }
  if (n === 0) return { pieces: [], voxels: 0, skipped };
  const B = new Float64Array(n * 6);
  for (const u of used) B.set(u.box, u.at * 6);

  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const touch = (a: number, b: number): boolean => {
    const ox = Math.min(B[a + 3], B[b + 3]) - Math.max(B[a], B[b]);
    const oy = Math.min(B[a + 4], B[b + 4]) - Math.max(B[a + 1], B[b + 1]);
    const oz = Math.min(B[a + 5], B[b + 5]) - Math.max(B[a + 2], B[b + 2]);
    if (ox < -EPS || oy < -EPS || oz < -EPS) return false;
    return (ox > EPS ? 1 : 0) + (oy > EPS ? 1 : 0) + (oz > EPS ? 1 : 0) >= 1;
  };
  // Each box goes into every sorting cell it reaches and is tried against what is there already. Two sets of cells:
  // voxels of 0.75 m and up (the far hills at 1 m, the mountains at 3 and 4 m) are sorted into 4 m cells, or each of
  // them would sit in hundreds of the small ones; every smaller voxel is sorted into the old tool's 0.5 m cells and
  // also tried against the big voxels round it. Which pairs are tried changes; which pairs touch does not.
  const OFF = 1 << 15, SPAN = 1 << 16;
  const sorter = (side: number) => {
    const cells = new Map<number, number[]>();
    return (i: number, keep: boolean) => {
      const b = i * 6;
      const x0 = Math.floor((B[b] - EPS) / side), x1 = Math.floor((B[b + 3] + EPS) / side);
      const y0 = Math.floor((B[b + 1] - EPS) / side), y1 = Math.floor((B[b + 4] + EPS) / side);
      const z0 = Math.floor((B[b + 2] - EPS) / side), z1 = Math.floor((B[b + 5] + EPS) / side);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const key = ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF);
        let cell = cells.get(key);
        if (!cell) { if (!keep) continue; cells.set(key, (cell = [])); }
        let root = find(i);
        for (let k = 0; k < cell.length; k++) {
          const j = cell[k], other = find(j);
          if (other !== root && touch(b, j * 6)) { parent[root] = other; root = other; }
        }
        if (keep) cell.push(i);
      }
    };
  };
  const BIG = 0.75;
  const big = sorter(4), small = sorter(CELL);
  const isBig = (i: number) => B[i * 6 + 3] - B[i * 6] >= BIG;
  for (let i = 0; i < n; i++) if (isBig(i)) big(i, true);
  for (let i = 0; i < n; i++) if (!isBig(i)) { small(i, true); big(i, false); }

  // The pieces, biggest first; among equals the one met first.
  const sizeOf = new Map<number, number>();
  for (let i = 0; i < n; i++) { const r = find(i); sizeOf.set(r, (sizeOf.get(r) ?? 0) + 1); }
  const firstOf = new Map<number, number>();
  for (let i = n - 1; i >= 0; i--) firstOf.set(parent[i] === i ? i : find(i), i);
  const roots = [...sizeOf.keys()].sort((a, b) => sizeOf.get(b)! - sizeOf.get(a)! || firstOf.get(a)! - firstOf.get(b)!);
  const rank = new Map(roots.map((r, k) => [r, k]));
  const out: Piece[] = roots.map((r) => {
    const f = firstOf.get(r)! * 6;
    return { voxels: sizeOf.get(r)!, from: [], first: [B[f], B[f + 1], B[f + 2]], box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], size: B[f + 3] - B[f], gapBelow: null };
  });
  const pieceOf = new Int32Array(n);
  for (const u of used) {
    const counts = new Map<number, number>();
    for (let i = u.at; i < u.at + u.part.count; i++) {
      const k = rank.get(find(i))!;
      pieceOf[i] = k;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (k === 0) continue; // the ground piece's box is never asked for
      const p = out[k].box, b = i * 6;
      if (B[b] < p[0]) p[0] = B[b]; if (B[b + 1] < p[1]) p[1] = B[b + 1]; if (B[b + 2] < p[2]) p[2] = B[b + 2];
      if (B[b + 3] > p[3]) p[3] = B[b + 3]; if (B[b + 4] > p[4]) p[4] = B[b + 4]; if (B[b + 5] > p[5]) p[5] = B[b + 5];
    }
    for (const [k, voxels] of counts) out[k].from.push({ part: u.part, voxels });
  }
  for (const p of out) p.from.sort((a, b) => b.voxels - a.voxels);

  // The gap under each loose piece: the highest top of anything else under its footprint, below its underside.
  if (gaps && out.length > 1 && out.length <= 4000) {
    const below = new Float64Array(out.length).fill(-Infinity);
    // Loose pieces sorted into columns of the same cells, so each box is tried only against the pieces over it.
    const over = new Map<number, number[]>();
    for (let k = 1; k < out.length; k++) {
      const p = out[k].box;
      for (let x = Math.floor(p[0] / CELL); x <= Math.floor(p[3] / CELL); x++) for (let z = Math.floor(p[2] / CELL); z <= Math.floor(p[5] / CELL); z++) {
        const key = (x + OFF) * SPAN + (z + OFF);
        let list = over.get(key);
        if (!list) over.set(key, (list = []));
        list.push(k);
      }
    }
    for (let i = 0; i < n; i++) {
      const b = i * 6, mine = pieceOf[i];
      for (let x = Math.floor(B[b] / CELL); x <= Math.floor(B[b + 3] / CELL); x++) for (let z = Math.floor(B[b + 2] / CELL); z <= Math.floor(B[b + 5] / CELL); z++) {
        const list = over.get((x + OFF) * SPAN + (z + OFF));
        if (!list) continue;
        for (const k of list) {
          if (k === mine) continue;
          const p = out[k].box;
          if (B[b + 3] <= p[0] || B[b] >= p[3] || B[b + 5] <= p[2] || B[b + 2] >= p[5] || B[b + 4] > p[1] + EPS) continue;
          if (B[b + 4] > below[k]) below[k] = B[b + 4];
        }
      }
    }
    for (let k = 1; k < out.length; k++) if (below[k] > -Infinity) out[k].gapBelow = out[k].box[1] - below[k];
  }
  return { pieces: out, voxels: n, skipped };
}

const f2 = (v: number) => v.toFixed(2);
const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;
/** A part's name in a report: what the game calls it, then the code that built it. */
export const sourceOf = (part: Part) => `${part.mount}: ${part.label}`;

/** The average colour of a piece's biggest part, as the old tool printed it for --detail. */
function hexOf(part: Part): string {
  const sum = [0, 0, 0];
  for (let i = 0; i < part.colors.length; i += 3) for (let k = 0; k < 3; k++) sum[k] += part.colors[i + k];
  return '#' + sum.map((v) => Math.round(Math.min(1, Math.max(0, v / part.count)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('');
}

interface Loose { piece: Piece; source: string; part: Part; excusedBy: string | null; within: string | null }

/** What one body (a scene's world, a thing, a prop) came to. */
interface Judged { voxels: number; pieces: number; ground: number; loose: Loose[]; skipped: Part[] }

function judge(parts: Part[], scene: string, exempt: Exemption[], within: string | null): Judged {
  const found = pieces(parts);
  const loose: Loose[] = found.pieces.slice(1).map((piece) => {
    const part = piece.from[0].part;
    const source = `${within ? `${within}: ` : ''}${sourceOf(part)}`;
    const entry = exempt.find((e) => e.scene === scene && source.includes(e.match));
    return { piece, source, part, excusedBy: entry ? entry.match : null, within };
  });
  return { voxels: found.voxels, pieces: found.pieces.length, ground: found.pieces[0]?.voxels ?? 0, loose, skipped: found.skipped };
}

/** A mount without its numbers: the chunks of one builder (countryside.scrub[36], [39]...) are one line of a report. */
const family = (source: string) => source.replace(/\[\d+\]/g, '[*]');

/** How far the pieces of one line hang over what is under them. */
function gapNote(all: Loose[]): string {
  const gaps = all.map((l) => l.piece.gapBelow);
  const known = gaps.filter((g): g is number => g !== null);
  const none = gaps.length - known.length;
  if (!known.length) return 'nothing under';
  const lo = Math.min(...known), hi = Math.max(...known);
  return `gap below ${f2(lo)}${hi - lo > 0.005 ? ` to ${f2(hi)}` : ''} m${none ? `, nothing under ${count(none)}` : ''}`;
}

/** The old tool's lines for one body: each source of loose pieces, how many, how many voxels, and where four of them are. */
function sourceLines(loose: Loose[], show: string | null): string[] {
  const by = new Map<string, { pieces: number; voxels: number; at: string[]; excusedBy: string | null; all: Loose[] }>();
  for (const l of loose) {
    const key = `${l.excusedBy ?? ''}\n${family(l.source)}`;
    const e = by.get(key) ?? { pieces: 0, voxels: 0, at: [], excusedBy: l.excusedBy, all: [] };
    e.pieces++; e.voxels += l.piece.voxels; e.all.push(l);
    if (e.at.length < 4) e.at.push(`(${l.piece.first.map(f2).join(', ')})\u00d7${l.piece.voxels}`);
    by.set(key, e);
  }
  const lines: string[] = [];
  for (const [key, e] of [...by].sort((a, b) => b[1].pieces - a[1].pieces || (a[0] < b[0] ? -1 : 1))) {
    const source = key.split('\n')[1];
    lines.push(`  ${String(e.pieces).padStart(5)} ${e.pieces === 1 ? 'piece ' : 'pieces'} ${String(e.voxels).padStart(6)} vox  ${source}   e.g. ${e.at.join(' ')}   ${gapNote(e.all)}${e.excusedBy ? `   [excused by EXEMPT.json: ${e.excusedBy}]` : ''}`);
    if (show !== null && source.includes(show)) {
      for (const l of e.all) {
        const b = l.piece.box;
        lines.push(`          ${l.piece.voxels} vox @${f2(l.piece.size)}  x ${f2(b[0])}..${f2(b[3])}  y ${f2(b[1])}..${f2(b[4])}  z ${f2(b[2])}..${f2(b[5])}  gap below ${l.piece.gapBelow === null ? 'nothing under it' : f2(l.piece.gapBelow)}  ${hexOf(l.part)}  ${l.source}`);
      }
    }
  }
  return lines;
}

function failureOf(l: Loose, scene: string, detail: Detail): Failure {
  const b = l.piece.box, gap = l.piece.gapBelow;
  const hangs = gap === null ? 'nothing is under it' : gap > EPS ? `${f2(gap)} m above what is under it` : 'it rests on something it does not join (a corner, or a gap too small to see)';
  return {
    scene, detail,
    what: l.within
      ? `${plural(l.piece.voxels, 'voxel')} of ${l.within} that touch the rest of it nowhere (${hangs})`
      : `a piece of ${plural(l.piece.voxels, 'voxel')} that does not join the ground piece (${hangs})`,
    where: `x ${f2(b[0])}..${f2(b[3])} y ${f2(b[1])}..${f2(b[4])} z ${f2(b[2])}..${f2(b[5])}${l.within ? ' (in its own frame)' : ''}`,
    source: l.source,
    ...(l.excusedBy ? { excusedBy: l.excusedBy } : {}),
  };
}

export function run(world: World, options: StageOptions): StageResult {
  const lines: string[] = [], failures: Failure[] = [];
  const show = typeof options.flags.detail === 'string' ? options.flags.detail : typeof options.flags.show === 'string' ? options.flags.show : null;
  const measured = { loose: {} as Record<string, Record<string, number>>, excused: {} as Record<string, Record<string, number>>, things: {} as Record<string, Record<string, number>>, props: {} as Record<string, number> };
  const data = { scenes: [] as unknown[], props: [] as unknown[], exemptions: [] as unknown[] };
  const used = new Map<Exemption, number>();
  const problems: string[] = [];
  const total = { loose: 0, things: 0, props: 0, excused: 0 };

  for (const scene of world.scenes.filter((s) => options.scenes.includes(s.name))) {
    const exempt = options.exempt;
    const w = judge(scene.world, scene.name, exempt, null);
    const looseWorld = w.loose.filter((l) => !l.excusedBy), excused = w.loose.filter((l) => l.excusedBy);
    lines.push('', `### ${scene.name} (${scene.detail}): ${count(w.voxels)} voxels in the world, ${plural(w.pieces, 'piece')}; the ground piece has ${count(w.ground)}`);
    if (scene.world.length === 0) lines.push('  nothing here is built in world space: every mesh is moved by its group (see the things below)');
    lines.push(...sourceLines(w.loose, show));
    if (w.skipped.length) problems.push(`${scene.name} (${scene.detail}): ${w.skipped.length} world parts have no boxes`);

    // The things: each is judged alone, in its own frame. Where it stands is the place stage's.
    const thingLoose: Loose[] = [], unjudged: Thing[] = [];
    for (const thing of scene.things) {
      const t = judge(thing.parts, scene.name, exempt, `thing "${thing.name}"`);
      if (t.skipped.length) { unjudged.push(thing); continue; }
      thingLoose.push(...t.loose);
    }
    const looseThings = thingLoose.filter((l) => !l.excusedBy);
    excused.push(...thingLoose.filter((l) => l.excusedBy));
    if (scene.things.length) {
      const names = scene.things.map((t) => t.name);
      lines.push(`  ${plural(scene.things.length, 'thing')} set down or moved by a mesh (where each stands is the place stage's to judge): ${names.slice(0, 14).join(', ')}${names.length > 14 ? `, and ${names.length - 14} more` : ''}`);
      if (thingLoose.length) lines.push('  inside those things, pieces that touch the rest of their thing nowhere:', ...sourceLines(thingLoose, show));
      if (unjudged.length) lines.push(`  NOT JUDGED, a part is turned inside its thing: ${unjudged.map((t) => t.name).join(', ')}`);
    }
    for (const l of excused) { const e = exempt.find((x) => x.scene === scene.name && x.match === l.excusedBy)!; used.set(e, (used.get(e) ?? 0) + 1); }
    lines.push(`  = ${plural(looseWorld.length, 'loose piece')} in the world${scene.things.length ? `, ${count(looseThings.length)} inside things` : ''}${excused.length ? `, and ${count(excused.length)} more excused by EXEMPT.json` : ''}`);

    (measured.loose[scene.name] ??= {})[scene.detail] = looseWorld.length;
    (measured.things[scene.name] ??= {})[scene.detail] = looseThings.length;
    (measured.excused[scene.name] ??= {})[scene.detail] = excused.length;
    total.loose += looseWorld.length; total.things += looseThings.length; total.excused += excused.length;
    for (const l of [...w.loose, ...thingLoose]) failures.push(failureOf(l, scene.name, scene.detail));
    data.scenes.push({
      scene: scene.name, detail: scene.detail, voxels: w.voxels, pieces: w.pieces, ground: w.ground, loose: looseWorld.length, looseInThings: looseThings.length, excused: excused.length,
      things: scene.things.map((t) => ({ name: t.name, moves: t.moves, parts: t.parts.map((p) => p.mount), judged: !unjudged.includes(t) })),
      notes: scene.notes,
    });
  }

  // The props, each alone. They are models, so they are there only in a run that built the models.
  if (world.models.length) {
    lines.push('', '### props, each alone (the old tool\'s --props): a prop in more pieces than one has loose pieces');
    for (const name of PROPS) {
      const model = world.models.find((m) => m.id === name);
      if (!model) { problems.push(`the prop "${name}" was not built`); continue; }
      const p = judge(model.parts, 'props', [], `prop "${name}"`);
      lines.push(`  ${name}: ${count(p.voxels)} voxels, ${plural(p.pieces, 'piece')}`);
      lines.push(...sourceLines(p.loose, show).map((l) => `  ${l}`));
      measured.props[name] = p.loose.length;
      total.props += p.loose.length;
      for (const l of p.loose) failures.push(failureOf(l, 'props', 'fine'));
      data.props.push({ prop: name, voxels: p.voxels, pieces: p.pieces, loose: p.loose.length });
    }
  } else {
    lines.push('', '### props: not checked in this run (no models were built)');
  }

  // An exemption that excuses nothing is an entry to take out: said, not failed (the count may only fall anyway).
  for (const e of options.exempt) {
    const n = used.get(e) ?? 0;
    data.exemptions.push({ scene: e.scene, match: e.match, status: e.status ?? 'answered', excuses: n });
    if (options.scenes.includes(e.scene as never)) lines.push('', `EXEMPT.json, ${e.scene}, match ${e.match}${e.status === 'pending' ? ' (PENDING: Brian has not answered)' : ''}: excuses ${plural(n, 'piece')} over ${plural(world.details.length, 'detail level')}${n === 0 ? ': it excuses nothing and can be taken out' : ''}`);
  }

  const floating = total.loose + total.things + total.props;
  const summary = problems.length
    ? `NOT RUN: ${problems.join('; ')}`
    : `${plural(floating, 'piece')} float${floating === 1 ? 's' : ''} (${count(total.loose)} in the scenes' worlds, ${count(total.things)} inside things, ${count(total.props)} in props, over ${world.details.join(' and ')}); ${count(total.excused)} more excused by EXEMPT.json`;
  lines.push('', floating || total.excused
    ? `${plural(floating, 'floating piece')}${total.excused ? `, and ${count(total.excused)} more that EXEMPT.json excuses` : ''}. Every one is named above with the code that built it.`
    : 'Nothing floats.');
  return { ok: problems.length === 0, summary, lines, measured, failures, data };
}
