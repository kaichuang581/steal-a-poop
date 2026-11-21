/**
 * The bake manifest's working parts (plan file 18, section 4.5; file 16, section 4.1 h and check 10 of section 4.2).
 *
 * Some pictures the game ships are photographs of its own voxel models, taken once by a tool and committed: the
 * Trading Post's thumbnails, the market stall, the loading screen's yarn ball, the tutorial's sheepdog, and the two
 * cards of the Queue chooser. When a model changes and its picture is not taken again, the picture is stale, and nothing could tell.
 * tools/bake/baked.json holds, for every such picture, three hashes; this file works them out again and says what no
 * longer matches:
 *
 *   modelHash    the voxels of the picture's model, as the mesher was given them (`__voxelHook` in
 *                src/skin/voxel/mesher.ts): every cell (x, y, z) with its colour at 16 bits, sorted; for a picture drawn
 *                on a 2D canvas rather than built of voxels (the yarn ball), the text of the code that draws it;
 *   renderHash   the text of the page that draws the picture, of the tool that photographs it, and the value of
 *                ROUNDED_VOXELS;
 *   fileHash     the picture's own bytes.
 *
 * A model or render hash that differs: "<file> is stale: run `<the tool>` with the dev server up". A file hash that
 * differs: "image changed without a stamp". The width, the height and whether the picture is clear round its subject
 * are read from its WebP header and held to what its tool bakes.
 *
 * Three things use this file, and nothing else works a hash out:
 *   tools/bakeStamp.ts                  writes the manifest (the four bake tools run it at their end), and checks it;
 *   src/skin/__tests__/baked.test.ts    in `npm test`: every picture's file, size and render hash, and the model of
 *                                       each thumbnail and of the sheepdog;
 *   tools/scenes/baked.ts               in `npm run check:scenes`: the stall and the two play cards.
 *
 * It imports nothing from src/: a model is built through a `load` it is handed, so the scene checker can build it in
 * the graph its world was built in, and a test in its own.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BufferGeometry } from 'three';

export const MANIFEST = 'tools/bake/baked.json';
/** How the stamp is run by hand. */
export const STAMP = 'npx vite-node tools/bakeStamp.ts --';
/** The folders whose pictures all come from models: a picture in one of them with no plan below fails. */
export const FOLDERS = ['public/shop', 'public/shop/stall', 'public/loading', 'public/tour', 'public/play'] as const;
const PICTURE = /\.(webp|png|jpe?g|avif|gif)$/i;

/** Imports a file of the game by its path from the repo's root. */
export type Load = <T = Record<string, unknown>>(path: string) => Promise<T>;
/** Where a picture's model hash is worked out again. Its file, size and render hash are checked in `npm test` whichever it is. */
export type Checked = 'npm test' | 'check:scenes';

/** One voxel set: what one call of the mesher was given. `at` says where it stands, for a set that is part of a scene. */
export interface VoxelSet { size: number; count: number; cells: ArrayLike<number>; colors: ArrayLike<number>; at: string }

/** One entry of tools/bake/baked.json. */
export interface Baked {
  /** The picture's path under public/, without its ending: "shop/tick-owl". */
  id: string;
  file: string;
  /** The tool that bakes it, or null when it is captured by hand. */
  tool: string | null;
  /** The arguments that bake this picture again. */
  args: string[];
  /** The page the tool photographs, or null. */
  page: string | null;
  /** What its model is, in words. */
  model: string;
  /** Where its model hash is worked out again. */
  checked: Checked;
  /** For a picture no tool bakes: the capture to redo by hand. */
  capture?: string;
  /**
   * Set when the picture is KNOWN to be older than what makes it today, with how that is known. Such a picture is a
   * known failure: every check names it and counts it, the count is a ratchet that may only fall, and nothing else
   * about the picture is let off. Only a bake that changes the file takes the mark away.
   */
  knownStale?: string;
  width: number;
  height: number;
  /** True when the picture is clear round its subject (its WebP header says it has an alpha channel). */
  alpha: boolean;
  modelHash: string;
  renderHash: string;
  fileHash: string;
}

/** What this file knows about one picture: how it is baked, and how its model is built. */
export interface Plan {
  id: string;
  file: string;
  tool: string | null;
  /** The arguments that bake this picture and no more than the tool must (`--only`), before any the tool was run with. */
  args: string[];
  page: string | null;
  /** The files whose text is in the render hash, in this order. */
  sources: string[];
  model: string;
  checked: Checked;
  capture?: string;
  alpha: boolean;
  /** The size its tool bakes, from the tool's and the model's own numbers. */
  size(load: Load, args: string[]): Promise<[number, number]>;
  /** Lines of the page and the tool that the recipe below copies: one that is gone stops the check. */
  mirrors: [file: string, lines: string[]][];
  /** A baked picture: the geometries its page draws, built as the page builds them. */
  recipe?(load: Load): Promise<BufferGeometry[]>;
  /** A picture drawn on a 2D canvas, not built of voxels: the files of the code that draws it, whose text is its model. */
  drawn?: string[];
  /** A captured picture: the scene of the scene checker it shows, and the models that stand in it. */
  scene?: { name: 'farm' | 'duel'; models: string[] };
}

// ---------------------------------------------------------------------------------------------------------------------
// The hashes
// ---------------------------------------------------------------------------------------------------------------------

const sha = (...parts: (string | Uint8Array)[]): string => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

/** A colour channel at 16 bits: 0 to 1 is 0 to 65535. A channel brighter than 1 (snow, glints) keeps its own number past 65535. */
const q16 = (c: number): number => {
  const v = Math.round(Math.fround(c) * 65535);
  if (!Number.isFinite(v)) throw new Error('a voxel has a colour that is not a number');
  return v;
};

/** Kept by the cells' own array: a set drawn twice (one hay bale, twelve times) is sorted once. */
const cellDigests = new WeakMap<object, { colors: unknown; digest: string }>();
/** The sorted cells of one set: x, y, z and the colour at 16 bits, 24 bytes a voxel, in the order of x, then y, then z. */
function cellsDigest(set: VoxelSet): string {
  const kept = typeof set.cells === 'object' ? cellDigests.get(set.cells) : undefined;
  if (kept && kept.colors === set.colors) return kept.digest;
  const n = set.count, { cells, colors } = set;
  const key = new Float64Array(n), order = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const x = cells[i * 3], y = cells[i * 3 + 1], z = cells[i * 3 + 2];
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || Math.abs(x) >= 32768 || Math.abs(y) >= 32768 || Math.abs(z) >= 32768) throw new Error(`a voxel is at (${x}, ${y}, ${z}), which is not a cell this hash can sort`);
    key[i] = ((x + 32768) * 65536 + (y + 32768)) * 65536 + (z + 32768);
    order[i] = i;
  }
  order.sort((a, b) => key[a] - key[b]);
  const out = Buffer.allocUnsafe(n * 24);
  for (let k = 0; k < n; k++) {
    const i = order[k] * 3;
    out.writeInt32LE(cells[i], k * 24);
    out.writeInt32LE(cells[i + 1], k * 24 + 4);
    out.writeInt32LE(cells[i + 2], k * 24 + 8);
    out.writeInt32LE(q16(colors[i]), k * 24 + 12);
    out.writeInt32LE(q16(colors[i + 1]), k * 24 + 16);
    out.writeInt32LE(q16(colors[i + 2]), k * 24 + 20);
  }
  const digest = sha(out);
  if (typeof set.cells === 'object') cellDigests.set(set.cells, { colors: set.colors, digest });
  return digest;
}

/**
 * The hash of a model: of each voxel set its cell size, its place (for a set that is part of a scene) and its sorted
 * cells; then the sets' own hashes, sorted. So neither the order the voxels were set in nor the order the sets were
 * built in changes it, and one voxel moved, recoloured, added, taken away or put in another set does.
 */
export function modelHashOf(sets: VoxelSet[]): string {
  if (!sets.length) throw new Error('a model with no voxels cannot be hashed');
  const each = sets.map((s) => {
    if (!s.count) throw new Error('a model holds a voxel set with nothing in it');
    return sha(`${s.size} m, ${s.count} voxels, ${s.at}\n`, cellsDigest(s));
  });
  return sha(each.sort().join('\n'));
}

/** A voxel set from the mesher's own map. */
export function setOf(vox: Map<string, { x: number; y: number; z: number; c: ArrayLike<number> }>, size: number, at = ''): VoxelSet {
  const count = vox.size, cells = new Int32Array(count * 3), colors = new Float32Array(count * 3);
  let i = 0;
  for (const v of vox.values()) {
    cells[i] = v.x; cells[i + 1] = v.y; cells[i + 2] = v.z;
    colors[i] = v.c[0]; colors[i + 1] = v.c[1]; colors[i + 2] = v.c[2];
    i += 3;
  }
  return { size, count, cells, colors, at };
}

const text = (root: string, file: string): string => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The value of ROUNDED_VOXELS, read from the line that sets it (src/skin/voxel/rounded.ts). */
export function roundedVoxels(root: string): boolean {
  const found = /^export const ROUNDED_VOXELS = (true|false);$/m.exec(text(root, 'src/skin/voxel/rounded.ts'));
  if (!found) throw new Error('src/skin/voxel/rounded.ts no longer sets ROUNDED_VOXELS on a line of its own (export const ROUNDED_VOXELS = true;): tools/bake/stale.ts cannot read its value');
  return found[1] === 'true';
}

/** The render hash: the page's and the tool's text (line ends as \n), each under its name, then ROUNDED_VOXELS. */
export function renderHashOf(root: string, plan: Plan): string {
  const parts: string[] = [];
  for (const file of plan.sources) {
    if (!existsSync(join(root, file))) throw new Error(`${file} is gone: it draws or bakes ${plan.file}`);
    parts.push(`${file}\n`, text(root, file), '\n');
  }
  parts.push(`ROUNDED_VOXELS = ${roundedVoxels(root)}\n`);
  return sha(...parts);
}

export const fileHashOf = (bytes: Uint8Array): string => sha(bytes);

/** The model hash of a picture drawn on a 2D canvas: the text of the code that draws it (line ends as \n), each under its name. */
export function drawnHashOf(root: string, plan: Plan): string {
  if (!plan.drawn?.length) throw new Error(`${plan.file}: tools/bake/stale.ts says no code draws it`);
  const parts: string[] = [];
  for (const file of plan.drawn) {
    if (!existsSync(join(root, file))) throw new Error(`${file} is gone: it draws ${plan.file}`);
    parts.push(`${file}\n`, text(root, file), '\n');
  }
  return sha(...parts);
}

/** What a WebP file's header says: its size, and whether it has an alpha channel. Null when it is not a WebP file. */
export function webpHeader(bytes: Uint8Array): { width: number; height: number; alpha: boolean } | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('latin1', 12, 16), d = 20;
  // The extended form: a flags byte (0x10 is alpha), then the canvas, each side less one, in three bytes.
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(d + 4, 3), height: 1 + b.readUIntLE(d + 7, 3), alpha: (b[d] & 0x10) !== 0 };
  // The plain lossy form: a frame tag, the start code 9d 01 2a, then each side in 14 bits. It has no alpha.
  if (kind === 'VP8 ') return b[d + 3] === 0x9d && b[d + 4] === 0x01 && b[d + 5] === 0x2a ? { width: b.readUInt16LE(d + 6) & 0x3fff, height: b.readUInt16LE(d + 8) & 0x3fff, alpha: false } : null;
  // The lossless form: the byte 2f, then each side less one in 14 bits, then one bit that says alpha is used.
  if (kind === 'VP8L' && b[d] === 0x2f) {
    const n = b.readUInt32LE(d + 1);
    return { width: 1 + (n & 0x3fff), height: 1 + ((n >>> 14) & 0x3fff), alpha: ((n >>> 28) & 1) === 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The plans: how each picture is baked, and what its model is
// ---------------------------------------------------------------------------------------------------------------------

type Grid = { map: Map<string, { x: number; y: number; z: number; c: [number, number, number] }>; size: number };
type Mesher = typeof import('../../src/skin/voxel/mesher');
const mesh = async (load: Load, ...grids: Grid[]): Promise<BufferGeometry[]> => {
  const { buildGeometry } = await load<Mesher>('src/skin/voxel/mesher.ts');
  return grids.map((g) => buildGeometry(g.map, g.size));
};

const THUMBS = 'tools/renderThumbs.mjs', STALL = 'tools/renderStall.mjs', YARN = 'tools/renderYarnBall.mjs', GUIDE = 'tools/renderGuide.mjs', PLAY = 'tools/renderPlayArt.mjs';
const THUMB_PAGE = 'src/skin/shop/ThumbRender.tsx', MODELS_3D = 'src/skin/shop/models3d.tsx', STALL_PAGE = 'src/skin/shop/StallRender.tsx';
const YARN_PAGE = 'src/skin/loading/YarnBallRender.tsx', GUIDE_PAGE = 'src/skin/tour/GuideRender.tsx';
const SACK_IDS = ['bomb', 'blast', 'tick'] as const;
const STALL_SIZES = ['wide', 'low', 'mid', 'narrow'] as const;
type Sack = (typeof SACK_IDS)[number];
type StallSize = (typeof STALL_SIZES)[number];
const isSack = (v: string): v is Sack => (SACK_IDS as readonly string[]).includes(v);
const isStallSize = (v: string): v is StallSize => (STALL_SIZES as readonly string[]).includes(v);

/** A Trading Post thumbnail: one catalogue item through ?preview=thumb. */
function thumbPlan(name: string): Plan {
  // Every id of the catalogue starts with its kind. The recipe goes by the catalogue, as the page does, and holds the two to each other.
  const named = (['bomb', 'blast', 'tick'] as const).find((k) => name.startsWith(`${k}-`)) ?? null;
  return {
    id: `shop/${name}`, file: `public/shop/${name}.webp`, tool: THUMBS, args: ['--only', name], page: THUMB_PAGE,
    // ThumbRender draws nothing itself: BombModel3d and GridModel3d in models3d.tsx do, so that file is the page's too.
    sources: [THUMB_PAGE, MODELS_3D, THUMBS],
    model: named === 'bomb' ? `the bomb skin ${name} as ?preview=thumb draws it: its body, its glowing parts, its fuse and spark (bombLook in src/skin/voxel/bombSkins.ts), and the glint of a skin that glints all the time (glintGeometry)`
      : named === 'blast' ? `the burst ${name}'s picture (burstGrid in src/skin/shop/thumbModels.ts)`
        : named === 'tick' ? `the fuse sound ${name}'s object (soundGrid in src/skin/shop/thumbModels.ts)`
          : `the Trading Post item ${name} as ?preview=thumb draws it (BombModel3d or GridModel3d in src/skin/shop/models3d.tsx)`,
    checked: 'npm test', alpha: true,
    size: async () => [256, 256],
    mirrors: [
      [THUMBS, [
        "const ids = [...catalog.matchAll(/\\{ id: '([a-z0-9-]+)'/g)].map((m) => m[1]);",
        'const page = await browser.newPage({ viewport: { width: 256, height: 256 } });',
        'await page.goto(`${base}?preview=thumb&id=${id}`);',
        'writeFileSync(`public/shop/${id}.webp`, bytes);',
      ]],
      [THUMB_PAGE, [
        "<div style={{ position: 'fixed', left: 0, top: 0, width: 256, height: 256 }}>",
        "const kind = itemById(id)?.kind ?? 'bomb';",
        "return <group ref={group} rotation={turn}>{kind === 'bomb' ? <BombModel3d id={id} sparkles={turn} /> : <GridModel3d id={id} kind={kind as 'blast' | 'tick'} />}</group>;",
      ]],
      [MODELS_3D, [
        'const look = useMemo(() => bombLook(id), [id]);',
        'const aura = auraOf(id);',
        'const own = useMemo(() => (aura.glow ? voxelMaterial({ emissive: aura.glow.colors[0], emissiveIntensity: aura.glow.base + aura.glow.pulse * 0.5 }) : null), [aura]);',
        'const glowMat = glow ?? own;',
        '<mesh geometry={look.body} material={body} />',
        '{look.glow && glowMat && <mesh geometry={look.glow} material={glowMat} />}',
        '<mesh geometry={look.fuse} material={fuseMat} />',
        '<mesh geometry={look.spark} material={spark} position={[0.04, 0.4, 0]} scale={[1, 1 / fuse, 1]} />',
        '{facing && aura.glints && aura.glints.rate >= 2 && (',
        '<mesh key={i} geometry={glintGeometry()} material={glint} position={[x, y, z]} scale={k} rotation={[0, 0, 0.3 * i]} />',
        "const g = kind === 'blast' ? burstGrid(id) : soundGrid(id);",
        'return buildGeometry(g.map, g.size);',
      ]],
    ],
    async recipe(load) {
      const { itemById } = await load<typeof import('../../src/skin/shop/catalog')>('src/skin/shop/catalog.ts');
      const item = itemById(name);
      if (!item) throw new Error(`${name} is not an item of the catalogue (src/skin/shop/catalog.ts): ${THUMBS} would never bake public/shop/${name}.webp`);
      if (named && item.kind !== named) throw new Error(`the catalogue says ${name} is a ${item.kind}, and its name says ${named}: the plan for its picture in tools/bake/stale.ts goes by the name`);
      if (item.kind === 'bomb') {
        const { bombLook, glintGeometry } = await load<typeof import('../../src/skin/voxel/bombSkins')>('src/skin/voxel/bombSkins.ts');
        const { auraOf } = await load<typeof import('../../src/skin/shop/bombAura')>('src/skin/shop/bombAura.ts');
        const look = bombLook(name), aura = auraOf(name);
        return [look.body, ...(look.glow && aura.glow ? [look.glow] : []), look.fuse, look.spark, ...(aura.glints && aura.glints.rate >= 2 ? [glintGeometry()] : [])];
      }
      const { burstGrid, soundGrid } = await load<typeof import('../../src/skin/shop/thumbModels')>('src/skin/shop/thumbModels.ts');
      return mesh(load, item.kind === 'blast' ? burstGrid(name) : soundGrid(name));
    },
  };
}

/** One of the market stall's pictures: one layer through ?preview=stall. */
function stallPlan(name: string): Plan | null {
  const [head, tail] = name.split('-');
  const layer: { query: string; width: number; model: string } | null =
    isStallSize(name) ? { query: `size=${name}&layer=back`, width: 0, model: `the ${name} stall, everything that stands still (stallGrid)` }
      : isStallSize(head) && tail === 'valance' ? { query: `size=${head}&layer=valance`, width: 0, model: `the ${head} stall's awning edge (valanceGrid)` }
        : head === 'crate' && isSack(tail ?? '') ? { query: `layer=${name}`, width: 560, model: `the ${tail} sack's crate with its grain (crateGrid)` }
          : head === 'sack' && isSack(tail ?? '') ? { query: `layer=${name}`, width: 560, model: `the ${tail} sack as it stands in its crate, and the crate that stands in front of it (sackInCrate, crateGrid)` }
            : name === 'lantern' ? { query: 'layer=lantern', width: 160, model: "the stall's lantern (stallLanternGrid)" } : null;
  if (!layer || name.split('-').length > 2) return null;
  const WIDTHS: Record<StallSize, number> = { wide: 2176, low: 2176, mid: 1480, narrow: 920 };
  const size = isStallSize(head) ? head : null;
  return {
    id: `shop/stall/${name}`, file: `public/shop/stall/${name}.webp`, tool: STALL, args: ['--only', name], page: STALL_PAGE,
    sources: [STALL_PAGE, STALL], model: layer.model, checked: 'check:scenes', alpha: true,
    async size(load) {
      const plan = await load<typeof import('../../src/skin/shop/stallPlan')>('src/skin/shop/stallPlan.ts');
      const width = size ? WIDTHS[size] : layer.width;
      const box = size ? { w: plan.STALLS[size].w, h: tail === 'valance' ? plan.valanceBox(plan.STALLS[size]).h : plan.frame(plan.STALLS[size]).h } : name === 'lantern' ? plan.LANTERN_BOX : plan.CRATE_BOX;
      return [width, Math.round((width * box.h) / box.w)];
    },
    mirrors: [
      [STALL, [
        'const WIDTHS = { wide: 2176, low: 2176, mid: 1480, narrow: 920 };',
        'shots.push({ name: size, query: `size=${size}&layer=back`, width });',
        'shots.push({ name: `${size}-valance`, query: `size=${size}&layer=valance`, width });',
        "for (const sack of ['bomb', 'blast', 'tick']) {",
        'shots.push({ name: `crate-${sack}`, query: `layer=crate-${sack}`, width: 560 });',
        'shots.push({ name: `sack-${sack}`, query: `layer=sack-${sack}`, width: 560 });',
        "shots.push({ name: 'lantern', query: 'layer=lantern', width: 160 });",
        'if (only.length && !only.some((o) => name === o || name.startsWith(`${o}-`))) continue;',
        'await page.goto(`${base}?preview=stall&${query}`);',
        'const height = Math.round((width * box.h) / box.w);',
        'writeFileSync(`public/shop/stall/${name}.webp`, bytes);',
      ]],
      [STALL_PAGE, [
        'const p = STALLS[size] ?? STALLS.wide;',
        "const sack = layer.includes('-') && isSackId(layer.split('-')[1]) ? (layer.split('-')[1] as SackId) : null;",
        "const box: Box = layer === 'back' ? { x: 0, bottom: frame(p).bottom, w: p.w, h: frame(p).h }",
        ": layer === 'valance' ? { x: 0, bottom: valanceBox(p).bottom, w: p.w, h: valanceBox(p).h }",
        ": layer === 'lantern' ? { x: -LANTERN_BOX.w / 2, bottom: LANTERN_BOX.above - LANTERN_BOX.h, w: LANTERN_BOX.w, h: LANTERN_BOX.h }",
        ': { x: -CRATE_BOX.w / 2, bottom: -CRATE_BOX.below, w: CRATE_BOX.w, h: CRATE_BOX.h };',
        "{layer === 'back' && <Voxels grid={() => stallGrid(p)} />}",
        "{layer === 'valance' && <Voxels grid={() => valanceGrid(p)} />}",
        "{layer === 'lantern' && <Voxels grid={stallLanternGrid} unlit />}",
        "{sack && <Crate sack={sack} part={layer.startsWith('sack') ? 'sack' : 'crate'} />}",
        'const geo = useMemo(() => { const g = grid(); return buildGeometry(g.map, g.size); }, [grid]);',
        'const crate = useMemo(() => () => crateGrid(sack), [sack]);',
        'const inside = useMemo(() => () => sackInCrate(sack), [sack]);',
        "<Voxels grid={crate} hidden={part === 'sack'} />",
        "{part === 'sack' && <Voxels grid={inside} />}",
      ]],
    ],
    async recipe(load) {
      const models = await load<typeof import('../../src/skin/shop/stallModels')>('src/skin/shop/stallModels.ts');
      const { STALLS } = await load<typeof import('../../src/skin/shop/stallPlan')>('src/skin/shop/stallPlan.ts');
      if (size) return mesh(load, tail === 'valance' ? models.valanceGrid(STALLS[size]) : models.stallGrid(STALLS[size]));
      if (name === 'lantern') return mesh(load, models.stallLanternGrid());
      const sack = tail as Sack;
      // The sack's own picture draws the crate too, unseen, so the sack is cut off where the crate stands in front of it.
      return head === 'sack' ? mesh(load, models.crateGrid(sack), models.sackInCrate(sack)) : mesh(load, models.crateGrid(sack));
    },
  };
}

/** The loading screen's yarn ball through ?preview=yarnball: its wraps alone, drawn on a 2D canvas (no voxels). */
const yarnBallPlan = (): Plan => ({
  id: 'loading/yarn-ball', file: 'public/loading/yarn-ball.webp', tool: YARN, args: [], page: YARN_PAGE,
  sources: [YARN_PAGE, YARN], model: "the yarn ball's wraps, drawn on a canvas (drawBallWraps in src/skin/loading/yarn.ts)",
  checked: 'npm test', alpha: true,
  size: async () => [320, 320],
  mirrors: [
    [YARN, [
      'const page = await browser.newPage({ viewport: { width: 320, height: 320 } });',
      'await page.goto(`${base}?preview=yarnball`);',
      "const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/webp', 0.9));",
      "writeFileSync('public/loading/yarn-ball.webp', bytes);",
    ]],
    [YARN_PAGE, [
      'drawBallWraps(ctx, BALL_PX / 2, BALL_PX / 2, BALL_R, 0);',
      'return <canvas ref={cv} width={BALL_PX} height={BALL_PX}',
    ]],
  ],
  drawn: ['src/skin/loading/yarn.ts'],
});

/** The tutorial's sheepdog through ?preview=guide. */
const guidePlan = (): Plan => ({
  id: 'tour/sheepdog', file: 'public/tour/sheepdog.webp', tool: GUIDE, args: [], page: GUIDE_PAGE,
  sources: [GUIDE_PAGE, GUIDE], model: 'the sheepdog, whole and sitting (sheepdogModel in src/skin/voxel/characters.ts): body, head, two ears, tail, four legs',
  checked: 'npm test', alpha: true,
  size: async () => [256, 256],
  mirrors: [
    [GUIDE, [
      'const page = await browser.newPage({ viewport: { width: 256, height: 256 } });',
      'await page.goto(`${base}?preview=guide`);',
      "writeFileSync('public/tour/sheepdog.webp', bytes);",
    ]],
    [GUIDE_PAGE, [
      "<div style={{ position: 'fixed', left: 0, top: 0, width: 256, height: 256 }}>",
      'const m = useMemo(() => sheepdogModel(), []);',
      '<mesh geometry={m.body.geo} position={m.body.pivot} material={mat} />',
      '<mesh geometry={m.head.geo} position={m.head.pivot} material={mat} rotation={[0.08, 0, 0]} />',
      '{m.ears.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} />)}',
      '<mesh geometry={m.tail.geo} position={m.tail.pivot} material={mat} />',
      '{m.legs.map((p, i) => <mesh key={`l${i}`} geometry={p.geo} position={p.pivot} material={mat} />)}',
    ]],
  ],
  async recipe(load) {
    const m = (await load<typeof import('../../src/skin/voxel/characters')>('src/skin/voxel/characters.ts')).sheepdogModel();
    return [m.body.geo, m.head.geo, ...m.ears.map((p) => p.geo), m.tail.geo, ...m.legs.map((p) => p.geo)];
  },
});

/** The Queue chooser's pictures, all drawn by tools/art/playArt.js, the size each is baked at, and whether it is clear round what it holds. */
export const PLAY_LAYERS: Record<string, { size: [number, number]; alpha: boolean; model: string }> = {
  casual: { size: [800, 880], alpha: false, model: 'the snow day, drawn pixel by pixel (drawPlayArt("casual") in tools/art/playArt.js)' },
  'casual-snow': { size: [240, 240], alpha: true, model: 'a tile of falling snow (drawPlayArt("casual-snow") in tools/art/playArt.js)' },
  ranked: { size: [800, 880], alpha: false, model: 'the night rink, drawn pixel by pixel (drawPlayArt("ranked") in tools/art/playArt.js)' },
  'ranked-flash': { size: [800, 880], alpha: true, model: 'the rink\'s second frame of flashes and sparkle (drawPlayArt("ranked-flash") in tools/art/playArt.js)' },
};

/**
 * The Queue chooser's pictures (src/skin/ranked/PlayChooser.tsx), baked by tools/renderPlayArt.mjs (Brian, 2026-11-21:
 * "rehash everything solely with pixel art"). They are pixel art drawn on a 2D canvas, so, as with the yarn ball, their
 * model is the text of the code that draws them.
 */
function playPlan(name: string): Plan | null {
  const layer = PLAY_LAYERS[name];
  if (!layer) return null;
  return {
    id: `play/${name}`, file: `public/play/${name}.webp`, tool: PLAY, args: [], page: null, sources: [PLAY],
    model: layer.model, checked: 'npm test', alpha: layer.alpha,
    size: async () => layer.size,
    mirrors: [
      [PLAY, ["export const LAYERS = ['casual', 'casual-snow', 'ranked', 'ranked-flash'];", "return out.toDataURL('image/webp', 1);"]],
      ['tools/art/playArt.js', ['var PLAY_ART = { SCALE: 5, SCENE: { W: 160, H: 176 }, SNOW: { W: 48, H: 48 } };']],
    ],
    drawn: ['tools/art/playArt.js'],
  };
}

/** The plan for one shipped picture, by its path from the repo's root; null when this file has none for it. */
export function planFor(file: string): Plan | null {
  const at = file.lastIndexOf('/'), dir = file.slice(0, at), base = file.slice(at + 1);
  if (!base.endsWith('.webp')) return null;
  const name = base.slice(0, -'.webp'.length);
  if (dir === 'public/shop') return /^[a-z0-9-]+$/.test(name) ? thumbPlan(name) : null;
  if (dir === 'public/shop/stall') return stallPlan(name);
  if (dir === 'public/loading') return name === 'yarn-ball' ? yarnBallPlan() : null;
  if (dir === 'public/tour') return name === 'sheepdog' ? guidePlan() : null;
  if (dir === 'public/play') return playPlan(name);
  return null;
}

/** Every picture in the folders whose pictures come from models, sorted. */
export function shipped(root: string): string[] {
  const out: string[] = [];
  for (const dir of FOLDERS) {
    if (!existsSync(join(root, dir))) continue;
    for (const name of readdirSync(join(root, dir))) if (PICTURE.test(name)) out.push(`${dir}/${name}`);
  }
  return out.sort();
}

/** The command that bakes a picture again, as a person types it. */
export const commandOf = (entry: { tool: string | null; args: string[] }): string => (entry.tool ? ['node', entry.tool, ...entry.args].join(' ') : '');

// ---------------------------------------------------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------------------------------------------------

/** What tools/bake/baked.json says at its head. The stamp writes it; nothing reads it but people. */
export const ABOUT = [
  'The bake manifest (plan file 18, section 4.5): one entry for every picture the game ships that is a photograph of one of its own voxel models.',
  'Written by tools/bakeStamp.ts, which the four bake tools (tools/renderThumbs.mjs, renderStall.mjs, renderYarnBall.mjs, renderGuide.mjs) run at their end. Never edit it by hand.',
  'modelHash is the SHA-256 of the model\'s voxels as the mesher was given them: each cell (x, y, z) with its colour at 16 bits, sorted (for the yarn ball, drawn on a 2D canvas, the text of the code that draws it). renderHash is the SHA-256 of the page that draws the picture, the tool that photographs it and the value of ROUNDED_VOXELS. fileHash is the SHA-256 of the picture itself. tools/bake/stale.ts works all three out.',
  'A model or render hash that no longer matches means the picture is stale: bake it again with its tool and arguments, the dev server up (npm run dev). A file hash that no longer matches means the picture changed without a stamp.',
  'checked says where a picture\'s model hash is worked out again: "npm test" (src/skin/__tests__/baked.test.ts) or "check:scenes" (tools/scenes/baked.ts). Every picture\'s file, size and render hash are checked in npm test.',
  'A picture with no tool is a capture taken by hand: when it is stale, capture it again as its entry says, then stamp it (npx vite-node tools/bakeStamp.ts -- --only <id>).',
  'The first stamp, in milestone 0 of the visual overhaul (2026-11-16), recorded the models and the files as they were that day. It proves nothing about whether a picture matched its model before then: no picture was baked again to find out.',
  'knownStale marks a picture that is known to be older than what makes it today, and says how that is known. It is a known failure: every check names it, and the number of them is a ratchet in docs/visual-overhaul/RATCHETS.json that may only fall. Only a bake that changes the file takes the mark away.',
];

const HEX = /^[0-9a-f]{64}$/;
const FIELDS = ['id', 'file', 'tool', 'args', 'page', 'model', 'checked', 'capture', 'knownStale', 'width', 'height', 'alpha', 'modelHash', 'renderHash', 'fileHash'];

/** Reads the manifest and holds it to its shape. A file that is missing or broken is one problem, not an exception. */
export function readManifest(root: string): { entries: Baked[]; problems: string[] } {
  const problems: string[] = [];
  if (!existsSync(join(root, MANIFEST))) return { entries: [], problems: [`${MANIFEST} does not exist: write it with \`${STAMP}\``] };
  let json: unknown;
  try { json = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')); } catch (e) { return { entries: [], problems: [`${MANIFEST} is not JSON: ${String((e as Error).message)}`] }; }
  const list = (json as { images?: unknown } | null)?.images;
  if (!Array.isArray(list)) return { entries: [], problems: [`${MANIFEST} has no "images" list`] };
  const entries: Baked[] = [], seen = new Set<string>();
  list.forEach((e: Record<string, unknown> | null, i) => {
    const where = `${MANIFEST}, entry ${i + 1}${e && typeof e.file === 'string' ? ` (${e.file})` : ''}`;
    if (!e || typeof e !== 'object') { problems.push(`${where} is not an object`); return; }
    const bad: string[] = [];
    for (const key of ['id', 'file', 'model'] as const) if (typeof e[key] !== 'string' || !e[key]) bad.push(key);
    for (const key of ['tool', 'page'] as const) if (e[key] !== null && (typeof e[key] !== 'string' || !e[key])) bad.push(key);
    if (!Array.isArray(e.args) || e.args.some((a) => typeof a !== 'string')) bad.push('args');
    if (e.checked !== 'npm test' && e.checked !== 'check:scenes') bad.push('checked');
    for (const key of ['width', 'height'] as const) if (!Number.isInteger(e[key]) || (e[key] as number) <= 0) bad.push(key);
    if (typeof e.alpha !== 'boolean') bad.push('alpha');
    for (const key of ['modelHash', 'renderHash', 'fileHash'] as const) if (typeof e[key] !== 'string' || !HEX.test(e[key] as string)) bad.push(key);
    if (e.capture !== undefined && (typeof e.capture !== 'string' || !e.capture)) bad.push('capture');
    if (e.knownStale !== undefined && (typeof e.knownStale !== 'string' || e.knownStale.trim().length < 20)) bad.push('knownStale (it must say how the staleness is known)');
    const extra = Object.keys(e).filter((k) => !FIELDS.includes(k));
    if (bad.length) problems.push(`${where} is not in shape: ${bad.join(', ')}`);
    if (extra.length) problems.push(`${where} has fields that are not part of an entry: ${extra.join(', ')}`);
    if (bad.length || extra.length) return;
    if (seen.has(e.file as string)) { problems.push(`${where} is listed twice`); return; }
    seen.add(e.file as string);
    entries.push(e as unknown as Baked);
  });
  return { entries, problems };
}

/** The manifest as the stamp writes it: the entries in the order of their files, two spaces, one newline at the end. */
export function manifestText(entries: Baked[]): string {
  const images = [...entries].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)).map((e) => ({
    id: e.id, file: e.file, tool: e.tool, args: e.args, page: e.page, model: e.model, checked: e.checked, ...(e.capture ? { capture: e.capture } : {}),
    ...(e.knownStale ? { knownStale: e.knownStale } : {}),
    width: e.width, height: e.height, alpha: e.alpha, modelHash: e.modelHash, renderHash: e.renderHash, fileHash: e.fileHash,
  }));
  return `${JSON.stringify({ about: ABOUT, images }, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------
// What is wrong with a picture
// ---------------------------------------------------------------------------------------------------------------------

/** One thing wrong, named with its picture and, where there is one, the command that puts it right. */
export interface Finding {
  file: string;
  /**
   * 'stale' the model or the render changed; 'changed' the file changed without a stamp; 'size' it is not the size or
   * clearness its tool bakes; 'list' the manifest and the folders disagree; 'broken' the check itself could not be
   * made. And 'known': the picture was already known to be stale when it was stamped. That one is a known failure,
   * named and counted and failed by nobody; the five others each fail.
   */
  kind: 'stale' | 'changed' | 'size' | 'list' | 'broken' | 'known';
  text: string;
}

const stampOf = (id: string) => `\`${STAMP} --only ${id}\``;

/** What to do about a stale picture: the tool to run, or the capture to redo by hand. */
export function remedy(entry: { id: string; tool: string | null; args: string[]; capture?: string }): string {
  if (entry.tool) return `run \`${commandOf(entry)}\` with the dev server up`;
  return `no tool bakes it: capture it again by hand (${entry.capture ?? 'as it was captured before'}), then stamp it with ${stampOf(entry.id)}`;
}

/** The lines a plan copies from the page and the tool: a finding for each that is gone. */
export function mirrorFindings(root: string, plan: Plan, squashed = new Map<string, string>()): Finding[] {
  const out: Finding[] = [];
  for (const [file, lines] of plan.mirrors) {
    let whole = squashed.get(file);
    if (whole === undefined) {
      if (!existsSync(join(root, file))) { out.push({ file: plan.file, kind: 'broken', text: `${plan.file}: ${file}, which draws or bakes it, is gone` }); continue; }
      squashed.set(file, (whole = squash(text(root, file))));
    }
    for (const line of lines) {
      if (!whole.includes(squash(line))) out.push({ file: plan.file, kind: 'broken', text: `${plan.file}: tools/bake/stale.ts copies what ${file} builds for this picture, and this line of it is gone or changed: "${line}". Read ${file} again and bring the picture's plan in tools/bake/stale.ts up to date with it, then bake the picture again.` });
    }
  }
  return out;
}

/**
 * The manifest against the folders: a picture with no entry, an entry with no picture, a picture this file has no
 * plan for, and an entry that no longer says what its plan says. Hashes nothing.
 */
export function listFindings(root: string, entries: Baked[]): Finding[] {
  const out: Finding[] = [], files = shipped(root), listed = new Map(entries.map((e) => [e.file, e]));
  for (const file of files) {
    const plan = planFor(file);
    if (!plan) { out.push({ file, kind: 'list', text: `${file} is shipped from a folder of baked pictures, and tools/bake/stale.ts has no plan for it: it does not know which tool bakes it or what its model is. Add its plan, or take the picture out.` }); continue; }
    const entry = listed.get(file);
    if (!entry) { out.push({ file, kind: 'list', text: `${file} has no entry in ${MANIFEST}: ${plan.tool ? `bake it with \`${commandOf(plan)}\` (the dev server up), which stamps it` : `stamp it with ${stampOf(plan.id)}`}` }); continue; }
    const differs: string[] = [];
    if (entry.id !== plan.id) differs.push('id');
    if (entry.tool !== plan.tool) differs.push('tool');
    if (entry.page !== plan.page) differs.push('page');
    if (entry.checked !== plan.checked) differs.push('checked');
    if (entry.model !== plan.model) differs.push('model');
    if ((entry.capture ?? '') !== (plan.capture ?? '')) differs.push('capture');
    if (plan.args.some((a, i) => entry.args[i] !== a)) differs.push('args');
    if (differs.length) out.push({ file, kind: 'list', text: `${file}: its entry in ${MANIFEST} no longer says what tools/bake/stale.ts says of it (${differs.join(', ')}): ${remedy(plan)}${plan.tool ? ', which stamps it' : ''}` });
  }
  for (const entry of entries) if (!files.includes(entry.file)) out.push({ file: entry.file, kind: 'list', text: `${MANIFEST} lists ${entry.file}, which is not there: put the picture back, or stamp everything again (\`${STAMP}\`) to take the entry out` });
  return out;
}

/** The picture's own bytes against its entry: changed without a stamp, and the size and clearness in its header. */
export async function fileFindings(root: string, entry: Baked, plan: Plan, load: Load): Promise<Finding[]> {
  const out: Finding[] = [], file = entry.file;
  if (!existsSync(join(root, file))) return out; // said by listFindings
  const bytes = readFileSync(join(root, file));
  if (fileHashOf(bytes) !== entry.fileHash) out.push({ file, kind: 'changed', text: `${file}: image changed without a stamp. A baked picture is never edited by hand: ${remedy(entry)}${entry.tool ? ', which stamps it' : ''}.` });
  const head = webpHeader(bytes);
  if (!head) { out.push({ file, kind: 'size', text: `${file} is not a WebP picture (its header cannot be read)` }); return out; }
  if (head.width !== entry.width || head.height !== entry.height || head.alpha !== entry.alpha) {
    out.push({ file, kind: 'size', text: `${file} is ${head.width} x ${head.height}${head.alpha ? ', clear round its subject' : ', with no clear pixel'} by its header; ${MANIFEST} pins ${entry.width} x ${entry.height}${entry.alpha ? ', clear' : ', not clear'}` });
  }
  let want: [number, number];
  try { want = await plan.size(load, entry.args); } catch (e) { out.push({ file, kind: 'broken', text: `${file}: the size its tool bakes could not be worked out (${firstLine(e)})` }); return out; }
  if (head.width !== want[0] || head.height !== want[1]) out.push({ file, kind: 'size', text: `${file} is ${head.width} x ${head.height} by its header, and ${plan.tool ?? 'its capture'} makes it ${want[0]} x ${want[1]}: ${remedy(entry)}` });
  if (head.alpha !== plan.alpha) {
    out.push({ file, kind: 'size', text: plan.alpha
      ? `${file} has no clear pixel (its header has no alpha channel): a baked picture stands alone on a clear background, with no backdrop behind it. ${remedy(entry)}`
      : `${file} has an alpha channel, and this picture fills its frame: ${remedy(entry)}` });
  }
  return out;
}

/** The render hash against the entry's. */
export function renderFindings(root: string, entry: Baked, plan: Plan): Finding[] {
  let now: string;
  try { now = renderHashOf(root, plan); } catch (e) { return [{ file: entry.file, kind: 'broken', text: `${entry.file}: its render hash could not be worked out (${firstLine(e)})` }]; }
  if (now === entry.renderHash) return [];
  const what = plan.sources.length ? `${plan.sources.join(', ')} or ROUNDED_VOXELS changed since it was stamped` : 'ROUNDED_VOXELS changed since it was stamped';
  return [{ file: entry.file, kind: 'stale', text: `${entry.file} is stale: ${remedy(entry)} (${what})` }];
}

/** The mark of a picture that was known to be stale when it was stamped: named every time, with what to do. */
export function knownFindings(entry: Baked): Finding[] {
  if (!entry.knownStale) return [];
  return [{ file: entry.file, kind: 'known', text: `${entry.file} is KNOWN to be stale, and was when it was stamped: ${remedy(entry)}. How it is known: ${entry.knownStale}` }];
}

/** A model hash worked out now, against the entry's. */
export function modelFinding(entry: Baked, now: string): Finding[] {
  if (now === entry.modelHash) return [];
  return [{ file: entry.file, kind: 'stale', text: `${entry.file} is stale: ${remedy(entry)} (its model changed since it was stamped: ${entry.model})` }];
}

export const firstLine = (e: unknown): string => String((e as Error)?.message ?? e).split('\n')[0];

// ---------------------------------------------------------------------------------------------------------------------
// Building a model outside the scene checker: the stamp and the test
// ---------------------------------------------------------------------------------------------------------------------

/** Imports the game's files straight from the tree, in the graph of whoever calls. */
export const loadFrom = (root: string): Load => ((path: string) => import(/* @vite-ignore */ join(root, path))) as Load;

type Hook = (vox: Map<string, { x: number; y: number; z: number; c: [number, number, number] }>, size: number) => void;

/**
 * Listens to the mesher for as long as `work` runs, and hands it `setsOf`: the voxel sets a list of geometries was
 * made from. The hook hands over the voxels before there is a geometry, so the two are tied together the way
 * tools/scenes/build.ts ties them: the geometry that next finishes (computeBoundingSphere is the mesher's last step)
 * is the one made of the voxels the hook has just been given. A model the game keeps once built (a bomb skin, the
 * sheepdog, the glint) is then found again however often and in whatever order it is asked for. Both are put back
 * when the work is done.
 */
export async function listening<T>(root: string, work: (setsOf: (geometries: BufferGeometry[], what: string) => VoxelSet[]) => Promise<T>): Promise<T> {
  const mesher = squash(text(root, 'src/skin/voxel/mesher.ts'));
  for (const line of ['(globalThis as { __voxelHook?: (vox: VoxelMap, size: number) => void }).__voxelHook?.(vox, size);', 'g.computeBoundingSphere();']) {
    if (!mesher.includes(squash(line))) throw new Error(`src/skin/voxel/mesher.ts no longer has the line "${line}": tools/bake/stale.ts listens to the mesher through it`);
  }
  const G = globalThis as { __voxelHook?: Hook };
  if (G.__voxelHook) throw new Error('something else is listening to the mesher (__voxelHook is set)');
  const { BufferGeometry: Geometry } = await import('three');
  const proto = Geometry.prototype, original = proto.computeBoundingSphere;
  const made = new WeakMap<object, VoxelSet>();
  let pending: VoxelSet | null = null;
  G.__voxelHook = (vox, size) => {
    if (pending) throw new Error('the mesher was given voxels and never finished a geometry for them');
    pending = setOf(vox, size);
  };
  proto.computeBoundingSphere = function (this: BufferGeometry) {
    if (pending) { made.set(this, pending); pending = null; }
    return original.call(this);
  };
  try {
    return await work((geometries, what) => geometries.map((g, i) => {
      const set = made.get(g);
      if (!set) throw new Error(`${what}: mesh ${i + 1} of ${geometries.length} is not made of voxels the mesher was given while this was listening`);
      return set;
    }));
  } finally {
    delete G.__voxelHook;
    proto.computeBoundingSphere = original;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Building a model inside the scene checker's world: the stage, and the stamp for the pictures the stage checks
// ---------------------------------------------------------------------------------------------------------------------

/** As much of a part of tools/scenes/build.ts as a hash needs. */
interface PartLike { body: string; size: number; count: number; cells: Int32Array; colors: Float32Array; offset: number[]; local: number[]; turns: number; scale: number }
/** As much of the scene checker's world (tools/scenes/build.ts) as this file uses. */
export interface WorldLike {
  details: readonly string[];
  scene(name: 'farm' | 'duel', detail: 'fine'): { parts: PartLike[]; things: { name: string; at: { position: number[]; rotation: number[]; scale: number[] } }[] };
  model(id: string): { parts: PartLike[] };
  capture(id: string, kind: string, build: (load: Load) => unknown | Promise<unknown>): Promise<{ built: unknown; partsOf(geometry: BufferGeometry): PartLike[] }>;
}

const six = (v: number[]) => v.map((n) => Math.round(n * 1e6) / 1e6);
/** Where a part of a scene or of a standing model is drawn, written the same way every run. */
const placeOf = (frame: string, p: PartLike, rest?: { position: number[]; rotation: number[]; scale: number[] }) =>
  JSON.stringify([frame, six(p.offset), six(p.local), p.turns, six([p.scale]), rest ? [six(rest.position), six(rest.rotation), six(rest.scale)] : null]);

/**
 * A picture's model hash, built in the scene checker's world. A baked picture's recipe runs through `world.capture`,
 * which catches its voxels as it catches every model's; a captured picture's model is a scene the world has built
 * already, each part where the game draws it, and the standing models named with it.
 */
export async function worldModelHash(world: WorldLike, plan: Plan): Promise<string> {
  if (plan.recipe) {
    const recipe = plan.recipe;
    const model = await world.capture(`baked ${plan.id}`, 'baked', (load) => recipe(load));
    const geometries = model.built as BufferGeometry[];
    return modelHashOf(geometries.flatMap((g, i) => {
      const parts = model.partsOf(g);
      if (!parts.length) throw new Error(`${plan.file}: mesh ${i + 1} of ${geometries.length} is not made of voxels the mesher was given`);
      return parts.map((p): VoxelSet => ({ size: p.size, count: p.count, cells: p.cells, colors: p.colors, at: '' }));
    }));
  }
  if (!plan.scene) throw new Error(`${plan.file}: tools/bake/stale.ts says neither how its model is built nor which scene it shows`);
  if (!world.details.includes('fine')) throw new Error(`${plan.file} shows the ${plan.scene.name} scene as a computer builds it, and this run did not build that level`);
  const scene = world.scene(plan.scene.name, 'fine');
  const sets: VoxelSet[] = scene.parts.map((p) => ({
    size: p.size, count: p.count, cells: p.cells, colors: p.colors,
    at: placeOf(p.body === 'world' ? 'world' : 'thing', p, p.body === 'world' ? undefined : scene.things.find((t) => t.name === p.body)?.at),
  }));
  for (const id of plan.scene.models) for (const p of world.model(id).parts) sets.push({ size: p.size, count: p.count, cells: p.cells, colors: p.colors, at: placeOf(`model ${id}`, p) });
  return modelHashOf(sets);
}

// ---------------------------------------------------------------------------------------------------------------------
// Everything but the models, for every picture: what `npm test` checks of all of them
// ---------------------------------------------------------------------------------------------------------------------

/** A picture that is shipped, planned and listed: the three that a model hash is then checked for. */
export interface Listed { entry: Baked; plan: Plan }

/**
 * The manifest read and held to the folders, and for every listed picture its file, its size, the lines its plan
 * copies and its render hash, and the mark of one known to be stale. No model is built. `listed` is what a model
 * check then goes through. A finding of the kind 'known' is a known failure to name and count; every other fails.
 */
export async function checkAllButModels(root: string, load: Load): Promise<{ entries: Baked[]; listed: Listed[]; findings: Finding[]; problems: string[] }> {
  const { entries, problems } = readManifest(root);
  const findings: Finding[] = problems.map((p) => ({ file: MANIFEST, kind: 'broken' as const, text: p }));
  if (problems.length && !entries.length) return { entries, listed: [], findings, problems };
  findings.push(...listFindings(root, entries));
  const listed: Listed[] = [], squashed = new Map<string, string>();
  for (const entry of entries) {
    const plan = planFor(entry.file);
    if (!plan || !existsSync(join(root, entry.file))) continue; // said by listFindings
    listed.push({ entry, plan });
    findings.push(...mirrorFindings(root, plan, squashed), ...(await fileFindings(root, entry, plan, load)), ...renderFindings(root, entry, plan), ...knownFindings(entry));
  }
  return { entries, listed, findings, problems };
}
