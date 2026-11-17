import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkAllButModels, fileFindings, fileHashOf, firstLine, knownFindings, listening, loadFrom, MANIFEST, modelFinding, modelHashOf, planFor, renderFindings, setOf, webpHeader,
} from '../../../tools/bake/stale';
import type { Baked, Finding, VoxelSet } from '../../../tools/bake/stale';

/**
 * The bake manifest (plan file 18, section 4.5; file 16, section 4.1 h and check 10 of section 4.2): every picture the
 * game ships that is a photograph of one of its own voxel models has an entry in tools/bake/baked.json, and is still
 * the picture its model, its page and its tool make today. A picture that is not says which command bakes it again.
 *
 * Checked here for every picture: its file (changed without a stamp), its size and clearness from its WebP header,
 * and its render hash (the page, the tool, ROUNDED_VOXELS). Checked here for the thumbnails and the sheepdog: the
 * model, built again (each in a few milliseconds). The doors', the stall's and the two play cards' models are built
 * in `npm run check:scenes` (tools/scenes/baked.ts): the stall alone takes longer than this whole file.
 */
const ROOT = process.cwd();

// A third of a second alone; the limit is for a machine busy with other work, where a wait is not a failure.
describe('the bake manifest: every baked picture is listed and fresh', { timeout: 60_000 }, () => {
  /**
   * The whole check, made once, by whichever test asks first (so its time is that test's, where vitest's report shows
   * it): the manifest against the folders, every picture's file, size and render hash, then the models built again.
   */
  let made: Promise<{ listed: number; wanted: number; built: number; said: (kind: Finding['kind']) => string[] }> | null = null;
  const check = () => (made ??= (async () => {
    const load = loadFrom(ROOT);
    const fast = await checkAllButModels(ROOT, load);
    const here = fast.listed.filter(({ plan }) => plan.checked === 'npm test');
    const models: Finding[] = [];
    let built = 0;
    await listening(ROOT, async (setsOf) => {
      for (const { entry, plan } of here) {
        try {
          if (!plan.recipe) throw new Error('tools/bake/stale.ts has no recipe for it');
          models.push(...modelFinding(entry, modelHashOf(setsOf(await plan.recipe(load), plan.file))));
          built++;
        } catch (e) {
          models.push({ file: entry.file, kind: 'broken', text: `${entry.file}: its model could not be built (${firstLine(e)})` });
        }
      }
    });
    // What was found of one kind, as the lines a person reads: an empty list is a pass.
    const said = (kind: Finding['kind']) => [...fast.findings, ...models].filter((f) => f.kind === kind).map((f) => f.text);
    return { listed: fast.listed.length, wanted: here.length, built, said };
  })());

  it('reads its manifest, and could make every check', async () => {
    const { listed, wanted, built, said } = await check();
    expect(said('broken')).toEqual([]);
    expect(listed).toBeGreaterThan(0);
    expect(wanted).toBeGreaterThan(0);
    expect(built).toBe(wanted);
  });

  it('has one entry for every picture in the folders of baked pictures, and no entry without a picture', async () => {
    expect((await check()).said('list')).toEqual([]);
  });

  it('no picture changed without a stamp', async () => {
    expect((await check()).said('changed')).toEqual([]);
  });

  it('every picture is the size its tool bakes, and clear round its subject with no backdrop (check 10)', async () => {
    expect((await check()).said('size')).toEqual([]);
  });

  it('no picture is stale: no page, tool or ROUNDED_VOXELS changed under one, nor a thumbnail\'s or the sheepdog\'s model', async () => {
    expect((await check()).said('stale')).toEqual([]);
  });

  it('a picture known to be stale says how that is known, and there are never more of them than the stored number', async () => {
    // Known failures are named and counted, not hidden and not failed: the gate holds the count (baked.knownStale in
    // RATCHETS.json), which may only fall. Once it is stored, a new mark fails here too.
    const known = (await check()).said('known');
    for (const line of known) expect(line).toMatch(/ is KNOWN to be stale, and was when it was stamped: .+ How it is known: .{20,}/);
    const stored = (JSON.parse(readFileSync('docs/visual-overhaul/RATCHETS.json', 'utf8')) as { baked?: { knownStale?: unknown } }).baked?.knownStale;
    if (typeof stored === 'number') expect(known.length).toBeLessThanOrEqual(stored);
  });
});

describe('the bake manifest: the checks check', () => {
  const voxel = (x: number, y: number, z: number, c: [number, number, number]) => [`${x},${y},${z}`, { x, y, z, c }] as const;
  const red: [number, number, number] = [0.8, 0.1, 0.1], snow: [number, number, number] = [1.5, 1.5, 1.6];
  const body = () => new Map([voxel(0, 0, 0, red), voxel(1, 0, 0, red), voxel(0, 1, 0, snow)]);
  const glow = () => new Map([voxel(0, 2, 0, snow)]);
  const model = (...maps: Map<string, { x: number; y: number; z: number; c: [number, number, number] }>[]): VoxelSet[] => maps.map((m) => setOf(m, 0.04));
  const base = modelHashOf(model(body(), glow()));

  it('a model hashes the same whatever order its voxels and its sets were made in', () => {
    const backwards = new Map([...body()].reverse());
    expect(modelHashOf(model(backwards, glow()))).toBe(base);
    expect(modelHashOf(model(glow(), body()))).toBe(base);
    // Float noise far under a 16-bit step is not a change.
    expect(modelHashOf(model(new Map([voxel(0, 0, 0, [0.8 + 1e-9, 0.1, 0.1]), voxel(1, 0, 0, red), voxel(0, 1, 0, snow)]), glow()))).toBe(base);
  });

  it('one voxel moved, recoloured, added, taken away or put in another set changes the hash', () => {
    const changed = (maps: Map<string, { x: number; y: number; z: number; c: [number, number, number] }>[], size = 0.04) => modelHashOf(maps.map((m) => setOf(m, size)));
    expect(changed([new Map([voxel(0, 0, 0, red), voxel(2, 0, 0, red), voxel(0, 1, 0, snow)]), glow()])).not.toBe(base); // moved
    expect(changed([new Map([voxel(0, 0, 0, [0.8 + 2 / 65535, 0.1, 0.1]), voxel(1, 0, 0, red), voxel(0, 1, 0, snow)]), glow()])).not.toBe(base); // two steps of 65535 redder
    expect(changed([new Map([voxel(0, 0, 0, red), voxel(1, 0, 0, red), voxel(0, 1, 0, [1.5, 1.5, 1.7])]), glow()])).not.toBe(base); // brighter than white, and still told apart
    expect(changed([new Map([...body(), voxel(5, 5, 5, red)]), glow()])).not.toBe(base); // added
    expect(changed([new Map([voxel(0, 0, 0, red), voxel(1, 0, 0, red)]), glow()])).not.toBe(base); // taken away
    expect(changed([new Map([voxel(0, 0, 0, red), voxel(1, 0, 0, red)]), new Map([voxel(0, 2, 0, snow), voxel(0, 1, 0, snow)])])).not.toBe(base); // put in the other set
    expect(changed([body(), glow()], 0.05)).not.toBe(base); // a bigger voxel
    expect(() => modelHashOf([])).toThrow();
    expect(() => modelHashOf(model(new Map()))).toThrow();
  });

  /** A WebP file's first bytes, hand-made: the extended form Chromium writes, the plain lossy form, the lossless form. */
  const riff = (kind: string, data: number[]) => {
    const b = Buffer.alloc(20 + data.length + 12);
    b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(b.length - 8, 4); b.write('WEBP', 8, 'latin1'); b.write(kind, 12, 'latin1'); b.writeUInt32LE(data.length, 16);
    Buffer.from(data).copy(b, 20);
    return b;
  };
  const three = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
  const extended = (w: number, h: number, alpha: boolean) => riff('VP8X', [alpha ? 0x10 : 0, 0, 0, 0, ...three(w - 1), ...three(h - 1)]);

  it('reads the size and the alpha channel from a WebP header', () => {
    expect(webpHeader(extended(256, 256, true))).toEqual({ width: 256, height: 256, alpha: true });
    expect(webpHeader(extended(2048, 1109, false))).toEqual({ width: 2048, height: 1109, alpha: false });
    expect(webpHeader(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 800 & 255, 800 >> 8, 500 & 255, 500 >> 8]))).toEqual({ width: 800, height: 500, alpha: false });
    const lossless = (560 - 1) | ((480 - 1) << 14) | (1 << 28);
    expect(webpHeader(riff('VP8L', [0x2f, lossless & 255, (lossless >> 8) & 255, (lossless >> 16) & 255, (lossless >> 24) & 255]))).toEqual({ width: 560, height: 480, alpha: true });
    expect(webpHeader(Buffer.from('not a picture at all, only some text in a file'))).toBeNull();
  });

  const hex = (c: string) => c.repeat(64);
  const owl = (): Baked => {
    const plan = planFor('public/shop/tick-owl.webp')!;
    return { id: plan.id, file: plan.file, tool: plan.tool, args: plan.args, page: plan.page, model: plan.model, checked: plan.checked, width: 256, height: 256, alpha: true, modelHash: hex('a'), renderHash: hex('b'), fileHash: hex('c') };
  };

  it('a stale picture is named with the command that bakes it again', () => {
    expect(modelFinding(owl(), hex('a'))).toEqual([]);
    const [stale] = modelFinding(owl(), hex('d'));
    expect(stale.kind).toBe('stale');
    expect(stale.text.startsWith('public/shop/tick-owl.webp is stale: run `node tools/renderThumbs.mjs --only tick-owl` with the dev server up')).toBe(true);
    // The page, the tool or ROUNDED_VOXELS: the same sentence, and it says which files.
    const [render] = renderFindings(ROOT, owl(), planFor('public/shop/tick-owl.webp')!);
    expect(render.text.startsWith('public/shop/tick-owl.webp is stale: run `node tools/renderThumbs.mjs --only tick-owl` with the dev server up')).toBe(true);
    expect(render.text).toContain('src/skin/shop/ThumbRender.tsx');
    expect(render.text).toContain('tools/renderThumbs.mjs');
    // The stall's backdrop, the doors and the sheepdog, each by its own tool's real arguments.
    const commandFor = (file: string) => { const plan = planFor(file)!; return modelFinding({ ...owl(), id: plan.id, file, tool: plan.tool, args: plan.args }, hex('d'))[0].text; };
    expect(commandFor('public/shop/stall/wide.webp')).toContain('run `node tools/renderStall.mjs --only wide` with the dev server up');
    expect(commandFor('public/loading/doors-sill.webp')).toContain('run `node tools/renderDoors.mjs` with the dev server up');
    expect(commandFor('public/tour/sheepdog.webp')).toContain('run `node tools/renderGuide.mjs` with the dev server up');
  });

  it('a picture marked as known to be stale is named with how it is known, and the mark lets nothing else off', () => {
    expect(knownFindings(owl())).toEqual([]);
    const marked = { ...owl(), knownStale: 'baked the day before its model changed, by the dates of the two commits' };
    const [known] = knownFindings(marked);
    expect(known.kind).toBe('known');
    expect(known.text).toContain('public/shop/tick-owl.webp is KNOWN to be stale');
    expect(known.text).toContain('run `node tools/renderThumbs.mjs --only tick-owl` with the dev server up');
    expect(known.text).toContain('by the dates of the two commits');
    // Its model changing again is a new failure of the ordinary kind.
    expect(modelFinding(marked, hex('d')).map((f) => f.kind)).toEqual(['stale']);
  });

  it('a play card has no tool: its failure says so and names the capture to redo by hand', () => {
    for (const name of ['casual', 'ranked'] as const) {
      const plan = planFor(`public/play/${name}.webp`)!;
      expect(plan.tool).toBeNull();
      expect(plan.capture).toBeTruthy();
      const [stale] = modelFinding({ ...owl(), id: plan.id, file: plan.file, tool: null, args: [], capture: plan.capture }, hex('d'));
      expect(stale.text).toContain(`public/play/${name}.webp is stale: no tool bakes it: capture it again by hand (${plan.capture})`);
      expect(stale.text).toContain(`--only play/${name}`);
    }
  });

  describe('against a picture on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baked-test-'));
    const file = 'public/tour/sheepdog.webp';
    const put = (bytes: Buffer) => { mkdirSync(join(dir, 'public/tour'), { recursive: true }); writeFileSync(join(dir, file), bytes); };
    const entry = (bytes: Buffer, over: Partial<Baked> = {}): Baked => ({ ...owl(), id: 'tour/sheepdog', file, tool: 'tools/renderGuide.mjs', args: [], fileHash: fileHashOf(bytes), ...over });
    const plan = planFor(file)!;
    const none = (() => { throw new Error('nothing is loaded here'); }) as never;
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('a picture whose bytes are not the stamped ones changed without a stamp', async () => {
      const good = extended(256, 256, true);
      put(good);
      expect(await fileFindings(dir, entry(good), plan, none)).toEqual([]);
      const edited = Buffer.concat([good, Buffer.from([0])]);
      put(edited);
      const found = await fileFindings(dir, entry(good), plan, none);
      expect(found.map((f) => f.kind)).toEqual(['changed']);
      expect(found[0].text).toContain('public/tour/sheepdog.webp: image changed without a stamp');
    });

    it('a picture of another size, or with a backdrop behind it, is refused even when it is stamped', async () => {
      const big = extended(512, 512, true);
      put(big);
      const wrong = await fileFindings(dir, entry(big, { width: 512, height: 512 }), plan, none);
      expect(wrong.map((f) => f.kind)).toEqual(['size']);
      expect(wrong[0].text).toContain('is 512 x 512 by its header, and tools/renderGuide.mjs makes it 256 x 256');
      const backdrop = extended(256, 256, false);
      put(backdrop);
      const filled = await fileFindings(dir, entry(backdrop, { alpha: false }), plan, none);
      expect(filled.map((f) => f.kind)).toEqual(['size']);
      expect(filled[0].text).toContain('has no clear pixel');
    });
  });

  it('knows no tool for a picture nobody planned, so a new one in a baked folder cannot go unlisted', () => {
    expect(planFor('public/shop/something-new.png')).toBeNull();
    expect(planFor('public/shop/stall/wide-extra-part.webp')).toBeNull();
    expect(planFor('public/play/third.webp')).toBeNull();
    expect(planFor('public/loading/doors-knocker.webp')).toBeNull();
    expect(MANIFEST).toBe('tools/bake/baked.json');
  });
});
