import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Mesh, ShaderMaterial as SM, Uint32BufferAttribute } from 'three';
import type { Material, ShaderMaterial } from 'three';
import { Gather, isGlow, meshModel, toGeometry, tokenColour } from '../models';
import type { Arrays, ModelMesh } from '../models';
import { COLOURS, GLOW, MODELS, PARTS, ROWS, STRIP_M, WORLDS } from '../models.gen';
import { animGlow, animLit, animUniforms, glowSprites, restAttributes } from './anim';
import type { AnimUniforms } from './anim';

/**
 * One world of the dream built from the pack (docs/dream/v3/02, section 6; 04 to 06): every model and plain box of
 * its 96 m strip, merged into one mesh for each part of the picture that moves or changes on its own, each in strip
 * coordinates. The dream lays copies of each part end to end as the lane runs (`Strip.copies`).
 */
export type Tag =
  | 'track' | 'ground' | 'fence' | 'string' | 'farm' | 'sails' | 'far' // world 1
  | 'lane' | 'islands' | 'aurora' // world 2 (with string, sails)
  | 'lining' | 'quilt' | 'things' | 'candle' | 'buttons' | 'yarn'; // world 3

export interface Strip {
  tag: Tag;
  /** The strip's meshes, strip coordinates. */
  group: Group;
  /** How deep it stands: the nearest z of what it holds, for how many copies a view needs. */
  z: number;
  /** Near the lane, in 12 m pieces, so what is out of view is not drawn. */
  chunked: boolean;
  /** The windmill's sails and the yarn balls: what turns, and about where. */
  pivots?: { tag: 'sails' | 'yarn'; mesh: Mesh; x: number; y: number; z: number; phase: number; lift: number }[];
}
export interface WorldBuild {
  n: 1 | 2 | 3;
  strips: Strip[];
  /** Each part's uniforms; `beat` is shared by all. */
  uniforms: Map<Tag, AnimUniforms>;
  beat: { value: number };
  chase: { value: number };
  /** Every material, to dispose of. */
  materials: Material[];
}

const ISLANDS = new Set(['islandBarn', 'islandHouse', 'islandMill', 'islandYard', 'clodSmall', 'clodWide']);
const FARM = new Set(['barn', 'silo', 'farmhouse', 'windmill', 'coop', 'scarecrow', 'baleStack', 'pineSpire', 'pineCone', 'pineRound']);
const partIndex = (name: string) => PARTS.indexOf(name);
const mask = (...names: string[]) => names.reduce((s, n) => s | (1 << partIndex(n)), 0);
const ROW_LIST = Object.values(ROWS).map((r) => ({ z: r.z, tint: r.tint })).sort((a, b) => b.z - a.z);
/** A row's tint, straight between the rows either side of z (v3/02, section 4). */
export function tintAt(z: number): number {
  if (z >= ROW_LIST[0].z) return ROW_LIST[0].tint;
  for (let i = 1; i < ROW_LIST.length; i++) {
    const a = ROW_LIST[i - 1], b = ROW_LIST[i];
    if (z >= b.z) return a.tint + ((b.tint - a.tint) * (a.z - z)) / (a.z - b.z);
  }
  return ROW_LIST[ROW_LIST.length - 1].tint;
}
/** Corner shade near the lane only; far back it cannot be seen and only splits faces apart. */
const aoAt = (id: string, z: number, parts = 0) => (ISLANDS.has(id) ? z >= -4 : z >= -12) && !id.startsWith('quilt') && !(id.startsWith('laneBayBed') && parts === mask('hang'));
const CHUNK_M = 24;
const CHUNKED = new Set<Tag>(['quilt', 'islands', 'farm', 'things']);

/** Gathers one tag's lit boxes, glowing boxes and glows, with per-vertex motion. */
class Part {
  lit = new Gather(); glow = new Gather(); halo: Arrays = { pos: [], nor: [], col: [], idx: [] };
  litAnim: number[] = []; glowAnim: number[] = []; haloAnim: number[] = [];
  litSpin: number[] = []; glowSpin: number[] = []; haloSpin: number[] = [];
  glowBulb: number[] = []; haloBulb: number[] = []; haloCorner: number[] = [];
  zMax = -Infinity; zMin = Infinity;
  constructor(readonly tag: Tag) {}
  private push(target: number[], n: number, v: readonly number[]) { for (let i = 0; i < n; i++) target.push(...v); }
  model(id: string, mm: ModelMesh, x: number, y: number, z: number, tint: number, anim: readonly number[], spin: readonly number[] = [0, 0, -1], bulbBase = -1, scale: readonly [number, number, number] = [1, 1, 1]) {
    this.zMax = Math.max(this.zMax, z); this.zMin = Math.min(this.zMin, z);
    const nl = mm.lit.pos.length / 3, ng = mm.glow.pos.length / 3;
    this.lit.add(mm.lit, x, y, z, tint, scale);
    this.push(this.litAnim, nl, anim); this.push(this.litSpin, nl, spin);
    this.glow.add(mm.glow, x, y, z, 1, scale);
    this.push(this.glowAnim, ng, anim); this.push(this.glowSpin, ng, spin);
    // Bulbs, in order along the strip: each glowing box of a string is one bulb.
    for (let i = 0; i < ng; i++) this.glowBulb.push(bulbBase < 0 ? -1 : bulbBase + Math.floor(mm.glow.pos[i * 3] / 0.8));
    const m = MODELS[id];
    // A glow only where this placement draws the part that gives it (a fence's body has no bulbs).
    if (!mm.glow.idx.length) return;
    m.lights.forEach(([lx, ly, lz, c, r, s], li) => {
      const rgb = tokenColour(COLOURS[c], GLOW, true).map((v) => v * s);
      const cx = x + lx * m.cell * scale[0], cy = y + ly * m.cell * scale[1], cz = z + lz * m.cell + 0.02;
      const base = this.halo.pos.length / 3;
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        this.halo.pos.push(cx + u * r, cy + w * r, cz);
        this.halo.col.push(...rgb);
        this.haloCorner.push(u, w);
      }
      this.halo.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.push(this.haloAnim, 4, anim); this.push(this.haloSpin, 4, spin);
      this.push(this.haloBulb, 4, [bulbBase < 0 ? -1 : bulbBase + li]);
    });
  }
  box(b: readonly number[], token: string, tint: number, anim: readonly number[] = REST) {
    this.zMax = Math.max(this.zMax, b[5]); this.zMin = Math.min(this.zMin, b[2]);
    const g = isGlow(token);
    const target = g ? this.glow : this.lit;
    const before = target.a.pos.length / 3;
    target.box(b, tokenColour(token, GLOW, true), g ? 1 : tint, g);
    const n = target.a.pos.length / 3 - before;
    this.push(g ? this.glowAnim : this.litAnim, n, anim);
    this.push(g ? this.glowSpin : this.litSpin, n, [0, 0, -1]);
    if (g) this.push(this.glowBulb, n, [-1]);
  }
}
const REST = [-1000, 0, -1, -1] as const;

function finish(p: Part, mats: { lit: Material; glow: ShaderMaterial; halo: ShaderMaterial }): Group {
  const group = new Group();
  const add = (geo: BufferGeometry, mat: Material, order = 0) => { const m = new Mesh(geo, mat); m.renderOrder = order; m.matrixAutoUpdate = true; group.add(m); return m; };
  if (!p.lit.empty) {
    const g = p.lit.geometry();
    g.setAttribute('anim', new Float32BufferAttribute(p.litAnim, 4));
    g.setAttribute('spin', new Float32BufferAttribute(p.litSpin, 3));
    add(restAttributes(g), mats.lit);
  }
  if (!p.glow.empty) {
    const g = p.glow.geometry();
    g.setAttribute('anim', new Float32BufferAttribute(p.glowAnim, 4));
    g.setAttribute('spin', new Float32BufferAttribute(p.glowSpin, 3));
    g.setAttribute('bulb', new Float32BufferAttribute(p.glowBulb, 1));
    add(g, mats.glow);
  }
  if (p.halo.idx.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p.halo.pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(p.halo.col, 3));
    g.setAttribute('corner', new Float32BufferAttribute(p.haloCorner, 2));
    g.setAttribute('anim', new Float32BufferAttribute(p.haloAnim, 4));
    g.setAttribute('spin', new Float32BufferAttribute(p.haloSpin, 3));
    g.setAttribute('bulb', new Float32BufferAttribute(p.haloBulb, 1));
    g.setIndex(new Uint32BufferAttribute(p.halo.idx, 1));
    g.computeBoundingSphere();
    add(g, mats.halo, 2);
  }
  return group;
}

/** Which tag a placed model belongs to in its world. */
function tagOf(n: 1 | 2 | 3, id: string, parts: number): Tag {
  if (n === 1) {
    if (id === 'fenceBay') return parts === mask('string') ? 'string' : 'fence';
    if (id === 'windmill') return parts === mask('sails') ? 'sails' : 'farm';
    if (FARM.has(id)) return 'farm';
    return 'ground';
  }
  if (n === 2) {
    if (id === 'laneBayFloat') return 'lane';
    if (id === 'fenceBay' && parts === mask('string')) return 'string';
    if (id === 'windmill' && parts === mask('sails')) return 'sails';
    return 'islands';
  }
  if (id.startsWith('laneBayBed')) return 'lane';
  if (id.startsWith('quiltPatch')) return 'quilt';
  if (id.startsWith('button')) return 'buttons';
  if (id === 'candle') return 'candle';
  if (id === 'yarnBall') return 'yarn';
  return 'things';
}
function boxTag(n: 1 | 2 | 3, note: string): Tag {
  if (n === 1) return note === 'the track' ? 'track' : /far |mill hill/.test(note) ? 'far' : 'ground';
  if (note === 'thread') return 'buttons';
  if (/lining|roll|stitch/.test(note)) return 'lining';
  if (note === 'under a raised square') return 'quilt';
  return 'far';
}

/**
 * Builds world `n`. `festive`: the season's boxes and coloured bulbs; `low`: the Low tier's cuts (v3/04 to 06,
 * section 9: no far rows, no ripples; world 2 no far islands or near clods and every second sheet of light; world 3
 * the quilt's rows 3 to 10 only, no far folds).
 */
export function buildWorld(n: 1 | 2 | 3, festive: boolean, low: boolean): WorldBuild {
  const w = WORLDS[n], beat = { value: 0 }, chase = { value: 1 }, gain = { value: 1 };
  const extra = { uChase: chase, uGain: gain };
  const materials: Material[] = [];
  // Each part of the picture has its own uniforms (one wave reveals the track but not the far folds), all on one beat.
  const uniforms = new Map<Tag, AnimUniforms>();
  const matsFor = (tag: Tag) => {
    let u = uniforms.get(tag);
    if (!u) uniforms.set(tag, (u = { ...animUniforms(), uBeat: beat }));
    const set = { lit: animLit(u, { fog: tag !== 'buttons' }), glow: animGlow(u, extra), halo: glowSprites(u, extra) };
    materials.push(set.lit, set.glow, set.halo);
    return set;
  };
  const matCache = new Map<Tag, ReturnType<typeof matsFor>>();
  const mats = (tag: Tag) => { let m = matCache.get(tag); if (!m) matCache.set(tag, (m = matsFor(tag))); return m; };
  const parts = new Map<string, Part>();
  const part = (tag: Tag, key: string = tag) => { let p = parts.get(key); if (!p) parts.set(key, (p = new Part(tag))); return p; };
  const near = (tag: Tag, x: number) => `${tag}@${Math.floor(x / CHUNK_M)}`;
  const pivots: Strip['pivots'] = [];
  // World 2's islands: where each rides, and its bob group (first, second, third, first, ... in the list).
  const islands: { x: number; y: number; z: number; hx: number; hz: number; phase: number }[] = [];
  let k = 0;
  for (const p of w.placed) {
    const id = p[0] as string;
    if (n !== 2 || !ISLANDS.has(id)) continue;
    const m = MODELS[id], [bx0, , bz0, bx1, , bz1] = m.bounds;
    islands.push({ x: (p[1] as number) + ((bx0 + bx1) / 2) * m.cell, y: p[2] as number, z: p[3] as number, hx: ((bx1 - bx0) / 2) * m.cell, hz: ((bz1 - bz0) / 2) * m.cell, phase: [0, 2.1, 4.2][k++ % 3] });
  }
  const rideOn = (id: string, x: number, y: number, z: number) => {
    const m = MODELS[id], cx = x + ((m.bounds[0] + m.bounds[3]) / 2) * m.cell;
    let best = null as (typeof islands)[number] | null;
    for (const s of islands) if (Math.abs(s.y - y) < 0.05 && Math.abs(s.x - cx) <= s.hx + 1.6 && Math.abs(s.z - z) <= s.hz + 0.6 && (!best || Math.abs(s.x - cx) < Math.abs(best.x - cx))) best = s;
    return best;
  };
  let bulbs = 0;
  // The quilt's squares by place: a square's sides are hidden wherever the square beside it lies as high or higher.
  const quiltLevel = new Map<string, number>();
  if (n === 3) for (const p of w.placed) if ((p[0] as string).startsWith('quiltPatch')) quiltLevel.set(`${Math.round(p[1] as number)},${Math.round(p[3] as number)}`, p[2] as number);
  // The fence's string of bulbs and the windmill's sails are their own parts, whatever the placement asks for.
  const placed = w.placed.flatMap((p) => {
    const [id, , , , , pm] = p as [string, number, number, number, number, number];
    if (id === 'fenceBay' && pm === 0) return [[...p.slice(0, 5), mask('body', 'lanterns')], [...p.slice(0, 5), mask('string')]];
    if (id === 'windmill' && (pm === 0 || pm === mask('body', 'sails'))) return [[...p.slice(0, 5), mask('body')], [...p.slice(0, 5), mask('sails')]];
    return [p];
  });
  for (const p of placed) {
    const [id, x, y, z, t, pm] = p as [string, number, number, number, number, number];
    if (id.startsWith('button')) continue;
    if (low && (z < -45 || (n === 2 && (z > 2 || (ISLANDS.has(id) && z < -90))))) continue;
    if (low && n === 3 && id.startsWith('quiltPatch')) { const iz = Math.round((-0.2 - z) / 2); if (iz > 10) continue; }
    const tag = tagOf(n, id, pm);
    const opts = { parts: pm, festive, ao: aoAt(id, z, pm) };
    const mm = meshModel(id, MODELS[id], COLOURS, GLOW, opts);
    const tint = t >= 0 ? t : tintAt(z);
    let anim: readonly number[] = REST;
    if (n === 2 && tag !== 'lane') {
      if (ISLANDS.has(id)) { const s = rideOn(id, x, y, z) ?? { phase: 0 }; anim = [y, y - 0.1, -1, s.phase]; }
      else if (tag === 'string') anim = [-1000, y - 0.1, -1, 1000 + x];
      else { const s = rideOn(id, x, y, z); anim = s ? [-1000, y - 0.1, -1, s.phase] : REST; }
    } else if (n === 2 && tag === 'lane') anim = [0, 0, -1, -1];
    else if (n === 3 && tag === 'quilt') anim = [y, 0, Math.round((-0.2 - z) / 2), -1];
    if (tag === 'sails' || tag === 'yarn') {
      // Its own mesh, turning about its axle (the windmill: x 0, y 48 cells) or its middle (the yarn: y 8 cells).
      const m = MODELS[id], g = toGeometry(mm.lit), ax = 0, ay = (id === 'windmill' ? 48 : 8) * m.cell;
      g.translate(-ax, -ay, 0);
      const mesh = new Mesh(restAttributes(g), mats(tag).lit);
      const gg = mm.glow.idx.length ? toGeometry(mm.glow) : null;
      if (gg) gg.translate(-ax, -ay, 0);
      const glowLights = gg ? new Mesh(restAttributes(gg), mats(tag).glow) : null;
      if (glowLights) mesh.add(glowLights);
      const s = n === 2 ? rideOn(id, x, y, z) : null;
      pivots.push({ tag, mesh, x: x + ax, y: y + ay, z, phase: s?.phase ?? -1, lift: n === 2 ? y - 0.1 : 0 });
      continue;
    }
    // In 24 m pieces where a row sees less than a strip at once, so the pieces out of view are not drawn.
    const key = z >= -4 || (z >= -36 && CHUNKED.has(tag)) ? near(tag, x) : tag;
    const bulbBase = tag === 'string' ? (bulbs += 3) - 3 : -1;
    part(tag, key).model(id, n === 3 && tag === 'quilt' ? hideSides(mm, quiltLevel, x, y, z) : mm, x, y, z, tint, anim, [0, 0, -1], bulbBase);
  }
  for (const b of w.boxes) {
    const [x0, y0, z0, x1, y1, z1, c, t] = b;
    const note = boxNote(n, b);
    if (low && (z1 < -45 || note === 'wind ripple')) continue;
    if (low && n === 3 && note === 'under a raised square' && z1 < -21) continue;
    const tag = boxTag(n, note);
    const tint = t >= 0 ? t : tintAt(z1);
    const anim = n === 3 && tag === 'quilt' ? [y0, 0, Math.round((-0.2 - (z0 + z1) / 2) / 2), -1] : REST;
    const key = (z1 >= -4 || (z1 >= -36 && CHUNKED.has(tag))) && tag !== 'track' ? near(tag, x0) : tag;
    part(tag, key).box([x0, y0, z0, x1, y1, z1], COLOURS[c], tint, anim);
  }
  // Buttons on threads (v3/06, section 5): never tinted or hazed; each turns about its thread in its turn.
  let bi = 0;
  const buttons = part('buttons');
  for (const p of w.placed) {
    const [id, x, y, z] = p as [string, number, number, number];
    if (!id.startsWith('button')) continue;
    const mm = meshModel(id, MODELS[id], COLOURS, GLOW, { festive, ao: false, back: true });
    buttons.model(id, mm, x, y, z, 1, REST, [x, z, bi++]);
  }
  // The northern light (v3/05, section 4): flat sheets added to what is behind, no haze.
  const sheets = w.sheets.filter((_, i) => !low || Math.floor(i / 4) % 2 === 0);
  const strips: Strip[] = [];
  for (const [key, p] of parts) {
    if (p.tag === 'buttons' && key !== 'buttons') continue;
    const group = finish(p, mats(p.tag));
    group.name = key;
    strips.push({ tag: p.tag, group, z: p.zMin, chunked: key.includes('@') });
  }
  if (sheets.length) { const a = auroraGroup(sheets, beat); materials.push(...a.children.map((c) => (c as Mesh).material as Material)); strips.push({ tag: 'aurora', group: a, z: -180, chunked: false }); }
  if (pivots.length) {
    const sails = pivots.filter((q) => q.tag === 'sails'), yarn = pivots.filter((q) => q.tag === 'yarn');
    for (const [tag, list] of [['sails', sails], ['yarn', yarn]] as const) {
      if (!list.length) continue;
      const group = new Group();
      for (const q of list) { q.mesh.position.set(q.x, q.y, q.z); group.add(q.mesh); }
      group.name = tag;
      strips.push({ tag, group, z: Math.min(...list.map((q) => q.z)), chunked: false, pivots: list });
    }
  }
  return { n, strips, uniforms, beat, chase, materials };
}

/** The notes of plain boxes are not packed; they are known by colour and place. */
function boxNote(n: 1 | 2 | 3, b: readonly number[]): string {
  const [x0, y0, z0, x1, y1, z1, c] = b;
  const tok = COLOURS[c];
  if (n === 1) {
    if (tok === 'snow:2' && z0 === -1.2 && z1 === 1.2) return 'the track';
    if (y0 === 0.1 && y1 === 0.2 && x1 - x0 < 0.5) return 'wind ripple';
    if (z1 <= -50) return 'far hill';
    return 'ground';
  }
  if (n === 3) {
    if (tok === 'trimWhite:-2' && x1 - x0 <= 0.11 && y1 > 20) return 'thread';
    if (z0 >= -5.3 && z1 <= -1.1) return 'lining';
    if (y0 === -1 && x1 - x0 <= 2.01 && z1 > -34) return 'under a raised square';
    return 'far';
  }
  void y0;
  return 'far';
}

function auroraGroup(sheets: readonly (readonly number[])[], beat: { value: number }): Group {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], amt: number[] = [], foot: number[] = [];
  sheets.forEach(([x0, y0, x1, y1, z, c, a], i) => {
    const rgb = tokenColour(COLOURS[c], GLOW, true), base = pos.length / 3;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { pos.push(x, y, z); col.push(...rgb); amt.push(a); foot.push(Math.floor(i / 4)); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('amount', new Float32BufferAttribute(amt, 1));
  g.setAttribute('sheet', new Float32BufferAttribute(foot, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const group = new Group();
  group.add(new Mesh(g, auroraMaterial(beat)));
  group.name = 'aurora';
  return group;
}

/**
 * The northern light's sheets: their colour times their amount, added to what is behind; the swell on the beat
 * travels along them (height x (1 + 0.12 pulse(beats - x / 24))); `uRise` 0 to 1 raises them one after another at
 * lift-off (16 ms apart, 300 ms each) and `uFade` shrinks them upward and fades them at the second gate.
 */
export const AURORA = { rise: { value: 1e4 }, fade: { value: 0 } };
function auroraMaterial(beat: { value: number }): ShaderMaterial {
  return new SM({
    uniforms: { uBeat: beat, uRiseT: AURORA.rise, uFade: AURORA.fade },
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float amount, sheet;
      uniform float uBeat, uRiseT, uFade;
      varying vec3 vCol;
      void main() {
        vec3 p = position;
        float ph = fract( uBeat - p.x / 24.0 ), pulse = pow( max( 0.0, 1.0 - ph / 0.35 ), 2.0 );
        float foot = 9.0 + 5.0 * sin( 2.0 * 6.2831853 * mod( sheet, 60.0 ) / 60.0 ) + 2.0 * sin( 5.0 * 6.2831853 * mod( sheet, 60.0 ) / 60.0 + 1.0 );
        float k = clamp( ( uRiseT - mod( sheet, 60.0 ) * 0.016 ) / 0.3, 0.0, 1.0 );
        float grow = ( 1.0 + 0.12 * pulse ) * k;
        p.y = foot + ( p.y - foot ) * grow + uFade * 8.0;
        vCol = color * amount * k * ( 1.0 - uFade );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main() { gl_FragColor = vec4( vCol, 1.0 ); }`,
  });
}

/** How many copies of a strip at depth z a view `viewW` metres wide (on the lane) needs to stay covered. */
export const copiesFor = (z: number, viewW: number, CAM: number): number => Math.ceil((viewW * (CAM - z)) / CAM / STRIP_M) + 1;

/**
 * A quilt square without the sides its neighbours hide (v3/02, section 8: the triangle limit). Squares are 2 m, placed
 * by their middle; a side lies on the square's edge plane, 1 m out.
 */
function hideSides(mm: ModelMesh, level: Map<string, number>, x: number, y: number, z: number): ModelMesh {
  const near = (dx: number, dz: number) => level.get(`${Math.round(x + dx)},${Math.round(z + dz)}`);
  const hidden = (nx: number, nz: number) => { const l = near(nx * 2, nz * 2); return l !== undefined && l >= y - 1e-6; };
  const { pos, nor, idx } = mm.lit;
  const keep: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], nx = nor[a * 3], nz = nor[a * 3 + 2];
    if (nx !== 0 || nz > 0) {
      const xs = [idx[t], idx[t + 1], idx[t + 2]].map((i) => pos[i * 3]), zs = [idx[t], idx[t + 1], idx[t + 2]].map((i) => pos[i * 3 + 2]);
      const onEdge = nx !== 0 ? xs.every((v) => Math.abs(v - (nx > 0 ? 1 : -1)) < 1e-6) : zs.every((v) => Math.abs(v - 1) < 1e-6);
      if (onEdge && hidden(nx, nz)) continue;
    }
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return { ...mm, lit: { ...mm.lit, idx: keep } };
}
