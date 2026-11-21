/**
 * Stage 8 of the scene checker: baked (plan file 18, section 4.5). No baked picture is stale.
 *
 * Some pictures the game ships are photographs of its own voxel models: tools/bake/baked.json lists them, each with
 * the hash of its model, of the page and tool that made it, and of its own bytes (tools/bake/stale.ts works them
 * out; tools/bakeStamp.ts writes them). `npm test` checks every picture's file, size and render hash, and builds the
 * thumbnails', the sheepdog's and the yarn ball's models again (src/skin/__tests__/baked.test.ts). This stage does the rest, the
 * pictures whose models are too slow for `npm test` or need a whole scene:
 *
 *   the market stall      fifteen          built through `world.capture`, as tools/renderStall.mjs's page builds each layer;
 *   the two play cards    two              no tool bakes them: each is a capture, by hand, of a scene this world has
 *                                          built already (Home's farm; the practice ice), with the models in the shot.
 *
 * For each: the model hash worked out again, and with it everything `npm test` checks of the same picture (its file,
 * its size and clearness, its render hash, the lines of its page that the recipe copies), so this stage alone says
 * all there is to say about these pictures.
 *
 * A picture that fails is named with what to do: "<file> is stale: run `node tools/renderStall.mjs --only wide` with
 * the dev server up", "image changed without a stamp", or, for a play card, the capture to redo by hand. Nothing here
 * is a known failure on today's code, so a finding fails the stage outright (`ok` is false): no stored number can
 * allow a stale picture. Only an entry of docs/visual-overhaul/EXEMPT.json can, with Brian's words: its `check` is
 * "baked", its `scene` the scene the picture shows ("farm" for the casual card, "duel" for the ranked one) and its
 * `match` text that is in "<file>: <its model, in words>". An excused finding is still listed, and counted in
 * `measured.excused`, which may only fall. There is no such entry today.
 *
 * One kind of finding is a known failure and is treated as the scene checker treats those: a picture whose entry
 * says it was KNOWN to be stale when it was stamped (`knownStale`, with how it is known). It is named in the report
 * and in `failures`, counted in `measured.knownStale`, which may only fall, and `ok` stays true. Today there is none
 * (the three door pictures that were went with the doors, 2026-11-21). The mark lets nothing else off.
 *
 * A part run judges what it is about: the casual card when the run holds the farm scene at the level a computer
 * builds, the ranked card when it holds the duel; the stall always (its models are not scenes).
 */
import { checkAllButModels, firstLine, MANIFEST, modelFinding, planFor, remedy, worldModelHash } from '../bake/stale';
import type { Finding, Load } from '../bake/stale';
import type { Failure, SceneName, StageOptions, StageResult, World } from './build';

export const id = 'baked';
export const needs = { scenes: ['farm', 'duel'] as SceneName[], models: true };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const lines: string[] = [], failures: Failure[] = [];
  const load: Load = (path) => world.load(path);

  // Everything but the models, for the whole manifest; this stage speaks only for the pictures it checks.
  const fast = await checkAllButModels(options.root, load);
  if (fast.problems.length && !fast.entries.length) {
    return { ok: false, summary: `NOT RUN: ${fast.problems[0]}`, lines: fast.problems, measured: {}, failures: [], data: null };
  }
  const mine = fast.listed.filter(({ plan }) => plan.checked === 'check:scenes');
  const files = new Set(mine.map(({ entry }) => entry.file));
  // Its own pictures' findings, the manifest's, and those of a picture nobody planned (which has no place of its own).
  const findings: Finding[] = fast.findings.filter((f) => f.file === MANIFEST || files.has(f.file) || (planFor(f.file)?.checked ?? 'check:scenes') === 'check:scenes');

  // The models. A play card is judged only in a run that holds its scene at the level a computer builds.
  const leftOut: string[] = [], pictures: { id: string; file: string; state: string }[] = [];
  let built = 0;
  for (const { entry, plan } of mine) {
    if (plan.scene && (!options.scenes.includes(plan.scene.name) || !options.details.includes('fine') || !world.details.includes('fine'))) {
      leftOut.push(entry.file);
      pictures.push({ id: entry.id, file: entry.file, state: 'left out of this part run' });
      continue;
    }
    try {
      findings.push(...modelFinding(entry, await worldModelHash(world, plan)));
      built++;
    } catch (e) {
      findings.push({ file: entry.file, kind: 'broken', text: `${entry.file}: its model could not be built (${firstLine(e)})` });
    }
  }

  // Each finding by name. A picture known to be stale is a known failure: named, counted, and `ok` stays true.
  // Of the rest, only EXEMPT.json excuses one, and an excused one is still listed and counted.
  const sceneOf = new Map(mine.map(({ entry, plan }) => [entry.file, plan.scene?.name ?? 'pictures']));
  const modelOf = new Map(mine.map(({ entry }) => [entry.file, entry.model]));
  let excused = 0, known = 0;
  const open: Finding[] = [];
  for (const f of findings) {
    const scene = sceneOf.get(f.file) ?? 'pictures', source = `${f.file}: ${modelOf.get(f.file) ?? 'the manifest itself'}`;
    const entry = f.kind === 'known' ? undefined : options.exempt.find((e) => e.scene === scene && source.includes(e.match));
    failures.push({ scene, detail: 'fine', what: f.text, where: f.file, source, ...(entry ? { excusedBy: entry.match } : {}) });
    if (f.kind === 'known') known++; else if (entry) excused++; else open.push(f);
  }

  const kinds: [Finding['kind'], string][] = [['stale', 'stale'], ['changed', 'changed without a stamp'], ['size', 'of the wrong size or clearness'], ['list', 'not listed as planned'], ['broken', 'that could not be checked']];
  for (const { entry } of mine) {
    if (leftOut.includes(entry.file)) continue;
    const own = findings.filter((f) => f.file === entry.file);
    pictures.push({ id: entry.id, file: entry.file, state: own.length ? [...new Set(own.map((f) => (f.kind === 'known' ? 'known to be stale' : f.kind)))].join(', ') : 'fresh' });
  }
  const fresh = pictures.filter((p) => p.state === 'fresh').length;
  lines.push('', `### baked pictures: ${plural(mine.length, 'picture')} of ${fast.entries.length} in ${MANIFEST} have their model checked here (the others in npm test)`);
  for (const [tool, name] of [['tools/renderStall.mjs', 'the market stall'], [null, 'the play cards, captured by hand']] as const) {
    const group = mine.filter(({ entry }) => entry.tool === tool), stateOf = (file: string) => pictures.find((p) => p.file === file)?.state;
    const ok = group.filter(({ entry }) => stateOf(entry.file) === 'fresh').length, old = group.filter(({ entry }) => stateOf(entry.file) === 'known to be stale').length;
    const out = group.filter(({ entry }) => leftOut.includes(entry.file)).length;
    lines.push(`  ${name}: ${group.length} pictures, ${ok} fresh${old ? `, ${old} KNOWN to be stale (counted)` : ''}${out ? `, ${out} left out of this part run` : ''}${group.length - ok - old - out ? `, ${group.length - ok - old - out} NOT FRESH` : ''}`);
  }
  for (const f of findings.filter((x) => x.kind !== 'known')) lines.push(`  ${f.text}${failures.find((x) => x.what === f.text)?.excusedBy ? '   [excused by EXEMPT.json]' : ''}`);
  // The pictures known to be stale, by how it is known: three doors baked on one day are one line, each still named.
  const reasons = new Map<string, typeof mine>();
  for (const m of mine) if (m.entry.knownStale) reasons.set(m.entry.knownStale, [...(reasons.get(m.entry.knownStale) ?? []), m]);
  for (const [why, group] of reasons) lines.push(`  KNOWN to be stale, and ${group.length === 1 ? 'was when it was' : 'were when they were'} stamped: ${group.map((m) => m.entry.file).join(', ')}: ${remedy(group[0].entry)}. How it is known: ${why}`);
  for (const file of leftOut) lines.push(`  ${file}: not checked in this run (it shows a scene, at the level a computer builds, that this part run left out)`);
  for (const e of options.exempt) lines.push(`  EXEMPT.json, ${e.scene}, match ${e.match}${e.status === 'pending' ? ' (PENDING: Brian has not answered)' : ''}: excuses ${plural(failures.filter((f) => f.excusedBy === e.match && f.scene === e.scene).length, 'finding')}`);
  lines.push('', open.length || excused
    ? `${plural(open.length, 'finding')} over ${plural(new Set(open.map((f) => f.file)).size, 'picture')}${excused ? `, and ${excused} more that EXEMPT.json excuses` : ''}${known ? `, and ${known} known to be stale` : ''}. Each is named above with what to do about it.`
    : known ? `${fresh} of the ${mine.length - leftOut.length} baked pictures checked here are fresh, and ${known} ${known === 1 ? 'is' : 'are'} KNOWN to be stale: named above, and counted in a number that may only fall.`
      : `Every baked picture checked here is fresh: ${fresh} of ${mine.length - leftOut.length}.`);

  const counts = kinds.map(([kind, words]) => [open.filter((f) => f.kind === kind).length, words] as const).filter(([n]) => n > 0);
  return {
    ok: open.length === 0,
    summary: open.length
      ? `${counts.map(([n, words]) => `${n} ${words}`).join(', ')}: ${[...new Set(open.map((f) => f.file))].slice(0, 4).join(', ')}${new Set(open.map((f) => f.file)).size > 4 ? ', and more' : ''}`
      : `${fresh} baked pictures fresh${known ? `, ${known} KNOWN to be stale (${[...new Set(findings.filter((f) => f.kind === 'known').map((f) => f.file))].join(', ')})` : ''}, of the stall${leftOut.length === 2 ? '' : ' and the play cards'}; ${built} models built again${leftOut.length ? `; ${leftOut.length} left out of this part run` : ''}${excused ? `; ${excused} excused by EXEMPT.json` : ''}`,
    lines,
    measured: { excused, knownStale: known },
    failures,
    data: { manifest: MANIFEST, entries: fast.entries.length, checkedHere: mine.length, built, fresh, knownStale: known, leftOut, pictures },
  };
}
