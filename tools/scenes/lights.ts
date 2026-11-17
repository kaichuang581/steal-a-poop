/**
 * Stage 3 of the scene checker: lights (plan file 18, section 4.2 e). Is every lamp's light at its lamp?
 *
 * The lights are the entries of `LIGHTS` in src/skin/scene/placed.ts, one for each point or spot light the game
 * mounts. Each is one of three things, and says which:
 *
 *   lamp     It belongs to a lamp built of voxels. Its place must be within 0.35 m of the nearest voxel of the meshes
 *            the entry names (`mounts`), in the scene it is drawn in, at each detail level. A light further off is
 *            `far`: counted and named.
 *   fill     It has no lamp and is not meant to have one: passed as marked, and counted, so the mark cannot spread.
 *   unseen   It has a lamp this checker cannot lay out (three.js boxes, a model that moves, a scene that is not
 *            built). NOT CHECKED: counted and named, never passed.
 *
 * It also reads every .tsx file under src/skin (test folders aside) for `<pointLight` and `<spotLight`, and wants an
 * entry of LIGHTS on each one, by the element's own words. A light with no entry is `unlisted`.
 *
 * The numbers handed in, each a ratchet that may only fall:
 *
 *   far.<scene>.<detail>       lamp lights further than 0.35 m from their lamp
 *   excused.<scene>.<detail>   of those, the ones an entry of EXEMPT.json excuses (counted there instead)
 *   unlisted                   light elements in the game with no entry
 *   fill                       entries marked fill
 *   unseen                     entries whose lamp cannot be measured here
 *
 * What EXEMPT.json matches against here: `check` "lights", `scene` the lamp's scene, `match` the LIGHTS id, exactly.
 * There is none today.
 *
 * What stops the stage (`ok` false, NOT RUN): an element or a line an entry was read from is gone from the game; a
 * lamp names a mesh or a thing its scene does not have; an entry is not exactly one of the three kinds.
 */
import { boxes } from './build';
import type { Failure, StageOptions, StageResult, World } from './build';
import { distanceToBoxes, goneLines, LAMP_REACH, lightElements, unlistedLights } from './pure';

export const id = 'lights';
export const needs = { scenes: 'all' as const, models: false };

type Manifest = typeof import('../../src/skin/scene/placed');

const f2 = (v: number) => v.toFixed(2);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const m = await world.load<Manifest>('src/skin/scene/placed.ts');
  const lines: string[] = [], failures: Failure[] = [], problems: string[] = [];
  const measured = { far: {} as Record<string, Record<string, number>>, excused: {} as Record<string, Record<string, number>>, unlisted: 0, fill: 0, unseen: 0 };
  const data = { reach: LAMP_REACH, lights: m.LIGHTS.length, elements: 0, scenes: [] as unknown[], fill: [] as string[], unseen: [] as string[], unlisted: [] as string[] };

  // The entries themselves: each exactly one kind, each on an element that is still there.
  const ids = new Set<string>();
  for (const l of m.LIGHTS) {
    if (ids.has(l.id)) problems.push(`two entries of LIGHTS are called "${l.id}"`);
    ids.add(l.id);
    const kinds = [l.lamp ? 'lamp' : '', l.fill ? 'fill' : '', l.unseen ? 'unseen' : ''].filter(Boolean);
    if (kinds.length !== 1) problems.push(`${l.id} must be exactly one of lamp, fill and unseen, and is ${kinds.length ? kinds.join(' and ') : 'none'}`);
  }
  problems.push(...goneLines(options.root, m.LIGHTS.flatMap((l) => [l.element, ...(l.copied ? [l.copied] : [])])));
  const elements = lightElements(options.root);
  const { unlisted, orphans, wrongKind } = unlistedLights(elements, m.LIGHTS);
  for (const bad of wrongKind) problems.push(`${bad} says it is another kind of light than its element`);
  for (const bad of orphans) problems.push(`${bad} is on no light element of ${m.LIGHTS.find((l) => l.id === bad)!.element.file}`);
  data.elements = elements.length;
  measured.unlisted = unlisted.length;
  data.unlisted = unlisted.map((e) => `${e.file}:${e.line}`);

  let far = 0, excusedAll = 0, lamps = 0;
  for (const scene of world.scenes.filter((s) => options.scenes.includes(s.name))) {
    const mine = m.LIGHTS.filter((l) => l.lamp?.scene === scene.name);
    lines.push('', `### ${scene.name} (${scene.detail}): ${plural(mine.length, 'lamp light')}`);
    let sceneFar = 0, sceneExcused = 0;
    const rows: unknown[] = [];
    for (const l of mine) {
      const lamp = l.lamp!;
      const at = scene.detail === 'coarse' && lamp.coarse ? lamp.coarse : lamp.position;
      const thing = lamp.thing ? scene.things.find((t) => t.name === lamp.thing) : null;
      if (lamp.thing && !thing) { problems.push(`${l.id}: ${scene.name} (${scene.detail}) has no thing called "${lamp.thing}"`); continue; }
      const parts = (thing ? thing.parts : scene.world).filter((p) => lamp.mounts.includes(p.mount));
      const missing = lamp.mounts.filter((name) => !parts.some((p) => p.mount === name));
      if (missing.length) { problems.push(`${l.id}: ${scene.name} (${scene.detail}) has no mesh called ${missing.join(', ')}${thing ? ` in "${thing.name}"` : ''}`); continue; }
      let distance = Infinity, nearest = '';
      for (const p of parts) {
        const b = boxes(p);
        if (!b) { problems.push(`${l.id}: the mesh ${p.mount} is turned off the axes and has no boxes`); continue; }
        const d = distanceToBoxes(at, b) * (thing ? thing.at.scale[0] : 1);
        if (d < distance) { distance = d; nearest = p.mount; }
      }
      lamps++;
      const ok = distance <= LAMP_REACH + 1e-9;
      const excuse = ok ? undefined : options.exempt.find((x) => x.scene === scene.name && x.match === l.id);
      const where = `(${at.map(f2).join(', ')})${thing ? ` in "${thing.name}"` : ''}`;
      lines.push(`  ${ok ? 'at its lamp' : 'FAR        '}  ${l.id} at ${where}: ${f2(distance)} m from ${nearest}${ok ? '' : ` (more than ${LAMP_REACH} m)`}${excuse ? `   [excused by EXEMPT.json: ${excuse.match}]` : ''}`);
      rows.push({ id: l.id, distance: Math.round(distance * 1000) / 1000, from: nearest, far: !ok });
      if (ok) continue;
      if (excuse) sceneExcused++; else sceneFar++;
      failures.push({
        scene: scene.name, detail: scene.detail, what: `the light ${l.id} is ${f2(distance)} m from its lamp (${nearest}), more than ${LAMP_REACH} m`, where,
        source: `${l.id}: ${l.element.file}: ${l.element.text}`, ...(excuse ? { excusedBy: excuse.match } : {}),
      });
    }
    lines.push(`  = ${sceneFar} far from ${sceneFar === 1 ? 'its' : 'their'} lamp${sceneExcused ? `, ${sceneExcused} excused by EXEMPT.json` : ''}`);
    (measured.far[scene.name] ??= {})[scene.detail] = sceneFar;
    (measured.excused[scene.name] ??= {})[scene.detail] = sceneExcused;
    far += sceneFar; excusedAll += sceneExcused;
    data.scenes.push({ scene: scene.name, detail: scene.detail, lamps: rows });
  }

  const fill = m.LIGHTS.filter((l) => l.fill), unseen = m.LIGHTS.filter((l) => l.unseen);
  measured.fill = fill.length;
  measured.unseen = unseen.length;
  data.fill = fill.map((l) => l.id);
  data.unseen = unseen.map((l) => l.id);
  lines.push('', `### marked fill: ${plural(fill.length, 'light')} with no lamp, passed as marked`);
  for (const l of fill) lines.push(`  ${l.id} (${l.element.file}): ${l.fill}`);
  lines.push('', `### NOT CHECKED: ${plural(unseen.length, 'light')} whose lamp this checker cannot measure`);
  for (const l of unseen) {
    lines.push(`  ${l.id} (${l.element.file}): ${l.unseen}`);
    failures.push({ scene: 'none', detail: 'both', what: `the light ${l.id} was not checked: ${l.unseen}`, where: l.element.file, source: `${l.id}: ${l.element.file}: ${l.element.text}` });
  }
  lines.push('', `### the game's light elements: ${elements.length} in src/skin/**/*.tsx, ${unlisted.length} with no entry of LIGHTS`);
  for (const e of unlisted) {
    lines.push(`  NOT LISTED  ${e.file}:${e.line}  ${e.text.split('\n')[0].slice(0, 120)}`);
    failures.push({ scene: 'none', detail: 'both', what: 'a light of the game has no entry of LIGHTS in src/skin/scene/placed.ts', where: `${e.file}:${e.line}`, source: e.text.split('\n')[0].slice(0, 160) });
  }
  for (const e of options.exempt) if (!ids.has(e.match)) problems.push(`EXEMPT.json excuses "${e.match}" from this check, and no entry of LIGHTS has that id`);

  if (problems.length) lines.push('', 'The stage could not do its work:', ...problems.map((p) => `  ${p}`));
  const summary = problems.length
    ? `NOT RUN: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? `; and ${problems.length - 3} more` : ''}`
    : `${plural(m.LIGHTS.length, 'light')} on ${elements.length} elements: ${far} far from their lamp over ${world.details.join(' and ')} (${lamps} measured), ${fill.length} marked fill, ${unseen.length} NOT CHECKED, ${unlisted.length} not listed; ${excusedAll} excused by EXEMPT.json`;
  return { ok: problems.length === 0, summary, lines, measured, failures, data };
}
