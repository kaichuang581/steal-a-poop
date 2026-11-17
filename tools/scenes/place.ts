/**
 * Stage 2 of the scene checker: place (plan file 18, section 4.2 b). Where does each thing the game sets down stand?
 *
 * The things are the entries of `PLACED` in src/skin/scene/placed.ts: the robin, the cat, the door leaves, the lamps,
 * the letter boards, every seat of every table size, the bomb at each seat's hooves, the livestock, the sheepdog, the
 * podium's bales and places. For each one, in each scene it is drawn in and at each detail level:
 *
 *   gap      A ray is cast down from each corner of its footprint and from the middle, starting at its own top,
 *            through the scene's voxels. The gap is the entry's y minus the top of the first voxel under the ray:
 *            0 standing on it, over 0 in the air, under 0 sunk in. Every ray must be within 0.02 m of 0. A thing that
 *            hangs (`hangs`) is asked the same of the voxels over it. No voxel at all under a ray is a failure too.
 *   inside   Its footprint box (the footprint, as tall as the thing, raised 0.02 m off its support) must hold no
 *            voxel of anything else. This is what finds an animal standing in the wheelbarrow.
 *
 * The thing's own voxels (`own`) are never taken for its support or for another prop. Things the game turns about y
 * (a door leaf standing open, a hay bale turned 0.05) are laid out turned, so a bale stacked on a turned bale finds
 * it. A thing tilted off the upright (the farmer in his bed) has no boxes and is left out; the report names it.
 *
 * It also asks, of every scene, which of its things (tools/scenes/build.ts: what a mesh sets down or moves) no entry
 * places: nobody judges where those stand, so each is counted and named (`unplaced`).
 *
 * Nothing found here fails the run by itself. Each failure is named, and counted in a number handed in as a ratchet:
 *
 *   gap.<scene>.<detail>        entries whose gap is not within 0.02 m
 *   inside.<scene>.<detail>     entries whose box holds a voxel of something else
 *   unplaced.<scene>.<detail>   things no entry places
 *   excused.<scene>.<detail>    entries an entry of docs/visual-overhaul/EXEMPT.json excuses (counted there instead)
 *
 * What EXEMPT.json matches against here: `check` "place", `scene` the entry's scene, and `match` the PLACED id,
 * exactly and whole ("farm:livestock 2 (chicken)"). There is none today.
 *
 * What stops the stage (`ok` false, NOT RUN): a line placed.ts copies a number from is gone from the game; an entry
 * names voxels of its own that the scene does not have; a size in placed.ts is no longer the model's.
 *
 *   npm run check:scenes -- --only place                 the report
 *   npm run check:scenes -- --only place --show=seat     every entry whose id has "seat" in it, ray by ray
 */
import { boxes } from './build';
import type { Detail, Failure, Part, Scene, StageOptions, StageResult, World } from './build';
import { BOX_RAISE, Columns, GAP_TOLERANCE, gapPasses, goneLines, rayPoints } from './pure';
import type { Box, V3 } from './pure';

export const id = 'place';
export const needs = { scenes: 'all' as const, models: true };

type Manifest = typeof import('../../src/skin/scene/placed');
type Placed = import('../../src/skin/scene/placed').Placed;

const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2));
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Voxels on the world's axes or turned about y with their thing: one frame each, with what turns a world point into it. */
interface Frame { name: string; thing: string | null; yaw: number; at: V3; scale: number; columns: Columns; parts: Part[] }

/** The cells of the ground, 2 m a side, that some entry will ask about: the rest of a big scene is never sorted. */
function wanted(entries: Placed[]): (x0: number, z0: number, x1: number, z1: number) => boolean {
  const G = 2, cells = new Set<number>(), key = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
  for (const e of entries) {
    const r = Math.hypot(e.footprint[0], e.footprint[1]) / 2 + NEAR;
    for (let cx = Math.floor((e.position[0] - r) / G); cx <= Math.floor((e.position[0] + r) / G); cx++) {
      for (let cz = Math.floor((e.position[2] - r) / G); cz <= Math.floor((e.position[2] + r) / G); cz++) cells.add(key(cx, cz));
    }
  }
  return (x0, z0, x1, z1) => {
    for (let cx = Math.floor(x0 / G); cx <= Math.floor(x1 / G); cx++) for (let cz = Math.floor(z0 / G); cz <= Math.floor(z1 / G); cz++) if (cells.has(key(cx, cz))) return true;
    return false;
  };
}

/** How far round a failing entry the nearest voxel is looked for, to say how far it is from anything. */
const NEAR = 2;

function framesOf(scene: Scene, entries: Placed[]): { frames: Frame[]; unlaid: string[] } {
  const keep = wanted(entries);
  const frames: Frame[] = [], unlaid: string[] = [];
  const world: Frame = { name: 'the world', thing: null, yaw: 0, at: [0, 0, 0], scale: 1, columns: new Columns(0.5), parts: [] };
  for (const part of scene.world) {
    const b = boxes(part);
    if (!b) { unlaid.push(part.mount); continue; }
    world.columns.add(b, keep);
    world.parts.push(part);
  }
  frames.push(world);
  for (const thing of scene.things) {
    const [rx, , rz] = thing.at.rotation, [sx, sy, sz] = thing.at.scale;
    const upright = Math.abs(rx) < 1e-9 && Math.abs(rz) < 1e-9 && Math.abs(sx - sy) < 1e-9 && Math.abs(sx - sz) < 1e-9 && sx > 0;
    const own = thing.parts.map((p) => boxes(p));
    if (!upright || own.some((b) => !b)) { unlaid.push(thing.name); continue; }
    const frame: Frame = { name: `thing "${thing.name}"`, thing: thing.name, yaw: thing.at.rotation[1], at: thing.at.position, scale: sx, columns: new Columns(0.5), parts: [] };
    thing.parts.forEach((part, i) => { frame.columns.add(own[i]!); frame.parts.push(part); });
    frames.push(frame);
  }
  return { frames, unlaid };
}

/** A world point in a frame's own metres. */
function into(f: Frame, x: number, y: number, z: number): [number, number, number] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.at[0], dz = z - f.at[2];
  return [(dx * c - dz * s) / f.scale, (y - f.at[1]) / f.scale, (dx * s + dz * c) / f.scale];
}

/** Whether a part is the entry's own voxels: its thing, its mesh, or a mesh whose name starts with `own` up to a dot or a bracket. */
function ownedBy(entry: Placed, part: Part): boolean {
  const own = entry.own;
  return own !== undefined && (part.body === own || part.mount === own || part.mount.startsWith(`${own}.`) || part.mount.startsWith(`${own}[`));
}

interface Judged {
  entry: Placed;
  /** The gap at each ray: four corners, then the middle. Null where no voxel is under (or over) the ray. */
  gaps: (number | null)[];
  /** What each ray met. */
  met: (string | null)[];
  gapOk: boolean;
  /** Voxels of something else in the footprint box, by what the game calls their mesh. */
  inside: Map<string, number>;
  /** For a thing in the air: how far its place is from the nearest voxel that is not its own, and whose. */
  nearest: { distance: number; mount: string } | null;
  excusedBy: string | null;
}

function judge(entry: Placed, frames: Frame[]): Judged {
  const [x, y, z] = entry.position, [w, d] = entry.footprint, yaw = entry.yaw ?? 0;
  const mine = (part: Part) => ownedBy(entry, part);
  const gaps: (number | null)[] = [], met: (string | null)[] = [];
  for (const [px, pz] of rayPoints({ x, z, w, d, yaw })) {
    let best: { y: number; mount: string } | null = null;
    for (const f of frames) {
      if (f.thing !== null && f.thing === entry.own) continue;
      const skip = (set: number) => mine(f.parts[set]);
      const from = entry.hangs ? y - entry.height : y + entry.height;
      const [lx, ly, lz] = into(f, px, from, pz);
      const hit = entry.hangs ? f.columns.up(lx, lz, ly, skip) : f.columns.down(lx, lz, ly, skip);
      if (!hit) continue;
      const at = hit.y * f.scale + f.at[1];
      if (!best || (entry.hangs ? at < best.y : at > best.y)) best = { y: at, mount: f.parts[hit.set].mount };
    }
    gaps.push(best ? (entry.hangs ? best.y - y : y - best.y) : null);
    met.push(best ? best.mount : null);
  }
  const inside = new Map<string, number>();
  for (const f of frames) {
    if (f.thing !== null && f.thing === entry.own) continue;
    const y0 = entry.hangs ? y - entry.height : y + BOX_RAISE, y1 = entry.hangs ? y - BOX_RAISE : y + entry.height;
    const [lx, ly0, lz] = into(f, x, y0, z), ly1 = (y1 - f.at[1]) / f.scale;
    const box: Box = { x: lx, z: lz, w: w / f.scale, d: d / f.scale, yaw: yaw - f.yaw, y0: ly0, y1: ly1 };
    for (const [set, n] of f.columns.inside(box, (s) => mine(f.parts[s]))) inside.set(f.parts[set].mount, (inside.get(f.parts[set].mount) ?? 0) + n);
  }
  const gapOk = gaps.every((g) => gapPasses(g));
  let nearest: Judged['nearest'] = null;
  if (gaps.some((g) => g === null || g > 0.3)) {
    for (const f of frames) {
      if (f.thing !== null && f.thing === entry.own) continue;
      const hit = f.columns.nearest(into(f, x, y, z), NEAR / f.scale, (s) => mine(f.parts[s]));
      if (hit && (!nearest || hit.distance * f.scale < nearest.distance)) nearest = { distance: hit.distance * f.scale, mount: f.parts[hit.set].mount };
    }
    // Touching something says nothing about how far it is from its support.
    if (nearest && nearest.distance < 0.02) nearest = null;
  }
  return { entry, gaps, met, gapOk, inside, nearest, excusedBy: null };
}

/** The gaps of an entry in words: one number, or the range the five rays span. */
function gapWords(j: Judged): string {
  const known = j.gaps.filter((g): g is number => g !== null), none = j.gaps.length - known.length;
  const side = j.entry.hangs ? 'over' : 'under';
  if (!known.length) return `nothing at all ${side} it`;
  const lo = Math.min(...known), hi = Math.max(...known);
  const one = (g: number) => (j.entry.hangs
    ? (g > 0 ? `${f2(g)} m under what it hangs from` : `${f2(-g)} m up into what it hangs from`)
    : (g > 0 ? `${f2(g)} m in the air` : `${f2(-g)} m sunk in`));
  const range = hi - lo < 0.005 ? (Math.abs(lo) < 0.005 ? 'on its support' : one(lo)) : `gap ${f2(lo)} to ${f2(hi)} m`;
  const met = [...new Set(j.met.filter((name): name is string => name !== null))];
  return `${range}${none ? `, and nothing ${side} ${none} of its ${j.gaps.length} rays` : ''} (its rays meet ${met.slice(0, 3).join(', ')}${met.length > 3 ? ` and ${met.length - 3} more` : ''})`;
}

function insideWords(j: Judged): string {
  const all = [...j.inside].sort((a, b) => b[1] - a[1]);
  return all.slice(0, 4).map(([mount, n]) => `${plural(n, 'voxel')} of ${mount}`).join(', ') + (all.length > 4 ? `, and ${all.length - 4} more meshes` : '');
}

const at = (e: Placed) => `(${e.position.map(f2).join(', ')})`;
/** An id without its numbers: the seats of every table size are one family. */
const family = (name: string) => name.replace(/\d+/g, '*');

/** The sizes placed.ts gives the animals, measured again from the models this run built. */
function sizeProblems(world: World, m: Manifest): string[] {
  const out: string[] = [];
  const reach = (parts: Part[]) => {
    let across = 0, along = 0, tall = -Infinity;
    for (const p of parts) {
      const b = boxes(p)!;
      for (let i = 0; i < b.length; i += 6) {
        across = Math.max(across, Math.abs(b[i]), Math.abs(b[i + 3]));
        along = Math.max(along, Math.abs(b[i + 2]), Math.abs(b[i + 5]));
        tall = Math.max(tall, b[i + 4]);
      }
    }
    return { across: across * 2, along: along * 2, tall };
  };
  const differs = (a: number, b: number) => Math.abs(a - b) > 1e-6;
  for (const [species, said] of Object.entries(m.FEET)) {
    const model = world.models.find((x) => x.id === `animal:${species}`);
    if (!model) { out.push(`the model animal:${species} was not built, so its size in placed.ts could not be checked`); continue; }
    const legs = reach(model.parts.filter((p) => p.mount.startsWith('legs['))), coat = reach(model.parts.filter((p) => p.mount === 'wools.2'));
    if (differs(legs.across, said.across) || differs(legs.along, said.along) || differs(coat.tall, said.tall)) {
      out.push(`placed.ts says the ${species} stands ${said.across} x ${said.along} m and ${said.tall} m tall; its model now measures ${legs.across.toFixed(2)} x ${legs.along.toFixed(2)} and ${coat.tall.toFixed(2)} (FEET in src/skin/scene/placed.ts)`);
    }
    if (species === 'sheep') {
      const three = reach(model.parts.filter((p) => p.mount === 'wools.3')).tall;
      if (differs(three, m.SHEEP_TALL_AT_3)) out.push(`placed.ts says the sheep at coat level 3 is ${m.SHEEP_TALL_AT_3} m tall; its model now measures ${three.toFixed(2)} (SHEEP_TALL_AT_3)`);
    }
  }
  const dog = world.models.find((x) => x.id === 'sheepdog');
  if (!dog) out.push('the model sheepdog was not built, so its size in placed.ts could not be checked');
  else {
    const sits = reach(dog.parts.filter((p) => p.mount === 'body' || p.mount.startsWith('legs['))), body = reach(dog.parts.filter((p) => p.mount === 'body'));
    const said = m.SHEEPDOG_SITS;
    if (differs(sits.across, said.across) || differs(sits.along, said.along) || differs(body.tall, said.tall)) {
      out.push(`placed.ts says the sheepdog sits ${said.across} x ${said.along} m and ${said.tall} m tall; its model now measures ${sits.across.toFixed(2)} x ${sits.along.toFixed(2)} and ${body.tall.toFixed(2)} (SHEEPDOG_SITS)`);
    }
  }
  return out;
}

export async function run(world: World, options: StageOptions): Promise<StageResult> {
  const m = await world.load<Manifest>('src/skin/scene/placed.ts');
  const lines: string[] = [], failures: Failure[] = [], problems: string[] = [];
  const show = typeof options.flags.show === 'string' ? options.flags.show : null;
  const measured = { gap: {} as Record<string, Record<string, number>>, inside: {} as Record<string, Record<string, number>>, unplaced: {} as Record<string, Record<string, number>>, excused: {} as Record<string, Record<string, number>> };
  const data = { tolerance: GAP_TOLERANCE, raise: BOX_RAISE, entries: m.PLACED.length, copied: m.PLACED.filter((e) => e.copied).length, scenes: [] as unknown[] };
  const total = { gap: 0, inside: 0, unplaced: 0, excused: 0, entries: 0, clean: 0 };

  problems.push(...goneLines(options.root, [...m.PLACED.flatMap((e) => (e.copied ? [e.copied] : [])), ...m.ALSO_COPIED]));
  if (world.models.length) problems.push(...sizeProblems(world, m));
  else problems.push('no models were built, so the sizes in placed.ts could not be checked against them');
  const ids = new Set<string>();
  for (const e of m.PLACED) { if (ids.has(e.id)) problems.push(`two entries of PLACED are called "${e.id}"`); ids.add(e.id); }

  for (const scene of world.scenes.filter((s) => options.scenes.includes(s.name))) {
    const detail: Detail = scene.detail;
    const entries = m.PLACED.filter((e) => e.scene === scene.name);
    const { frames, unlaid } = framesOf(scene, entries);
    // An entry that names voxels of its own must find them, or its own voxels would be taken for another prop's.
    for (const e of entries) if (e.own !== undefined && !scene.parts.some((p) => ownedBy(e, p))) problems.push(`${e.id} says its own voxels are "${e.own}", and ${scene.name} (${detail}) has no thing or mesh of that name`);

    const judged = entries.map((e) => {
      const j = judge(e, frames);
      const excuse = options.exempt.find((x) => x.scene === scene.name && x.match === e.id);
      if (excuse && (!j.gapOk || j.inside.size)) j.excusedBy = excuse.match;
      return j;
    });
    const placedThings = new Set(entries.map((e) => e.own).filter((o): o is string => o !== undefined));
    const unplaced = scene.things.filter((t) => !placedThings.has(t.name));
    const why = m.NOT_PLACED[scene.name] ?? {};

    const gapFails = judged.filter((j) => !j.gapOk && !j.excusedBy), insideFails = judged.filter((j) => j.inside.size && !j.excusedBy);
    const excused = judged.filter((j) => j.excusedBy);
    const clean = judged.filter((j) => j.gapOk && !j.inside.size).length;
    lines.push('', `### ${scene.name} (${detail}): ${plural(entries.length, 'entry', 'entries')} of PLACED, ${clean} on ${clean === 1 ? 'its' : 'their'} support within ${GAP_TOLERANCE} m and clear of everything else`);

    // One line for each family of entries that fails (the seats of every table size are one family), by name.
    const by = new Map<string, Judged[]>();
    for (const j of judged) if (!j.gapOk || j.inside.size) { const k = family(j.entry.id); by.set(k, [...(by.get(k) ?? []), j]); }
    const one = (j: Judged) => {
      const bits: string[] = [];
      if (!j.gapOk) bits.push(`${gapWords(j)}${j.nearest ? ` (the nearest voxel is ${f2(j.nearest.distance)} m away: ${j.nearest.mount})` : ''}`);
      if (j.inside.size) bits.push(`its box holds ${insideWords(j)}`);
      return `${j.entry.id} at ${at(j.entry)}, on a ${j.entry.support}: ${bits.join('; ')}${j.excusedBy ? `   [excused by EXEMPT.json: ${j.excusedBy}]` : ''}`;
    };
    for (const [name, all] of [...by].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (all.length <= 3) { for (const j of all) lines.push(`  ${one(j)}`); continue; }
      const gaps = all.flatMap((j) => j.gaps.filter((g): g is number => g !== null));
      const members = judged.filter((j) => family(j.entry.id) === name).length;
      const g = all.filter((j) => !j.gapOk).length, ins = all.filter((j) => j.inside.size).length;
      const meshes = new Map<string, number>();
      for (const j of all) for (const [mount, n] of j.inside) meshes.set(mount, (meshes.get(mount) ?? 0) + n);
      lines.push(`  ${name}: ${all.length} of ${members} fail. ${g} off their support (gaps ${gaps.length ? `${f2(Math.min(...gaps))} to ${f2(Math.max(...gaps))} m` : 'none found'}); ${ins} with something in their box${meshes.size ? ` (${[...meshes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([mount, n]) => `${plural(n, 'voxel')} of ${mount}`).join(', ')})` : ''}   --show=${name.split(':')[1]?.split(' ')[0] ?? name} lists each`);
    }
    if (show !== null) {
      for (const j of judged.filter((x) => x.entry.id.includes(show))) {
        lines.push(`      ${j.entry.id} at ${at(j.entry)} ${f2(j.entry.footprint[0])} x ${f2(j.entry.footprint[1])} m, ${f2(j.entry.height)} tall, on a ${j.entry.support}: rays ${j.gaps.map((g, i) => (g === null ? 'none' : `${f2(g)} (${j.met[i]})`)).join(', ')}; in its box ${j.inside.size ? insideWords(j) : 'nothing'}   [${j.entry.from}${j.entry.copied ? '; copied' : ''}]`);
      }
    }
    for (const t of unplaced) lines.push(`  NOT PLACED: "${t.name}": ${why[t.name] ?? 'no entry of PLACED says where it stands, and NOT_PLACED gives no reason'}`);
    for (const name of Object.keys(why)) if (!scene.things.some((t) => t.name === name)) lines.push(`  note: NOT_PLACED names "${name}", which ${scene.name} (${detail}) does not have`);
    if (unlaid.length) lines.push(`  tilted, so not laid out (nothing is judged against them): ${unlaid.join(', ')}`);
    lines.push(`  = ${plural(gapFails.length, 'entry', 'entries')} off ${gapFails.length === 1 ? 'its' : 'their'} support, ${insideFails.length} with something in the box, ${plural(unplaced.length, 'thing')} not placed${excused.length ? `, ${excused.length} excused by EXEMPT.json` : ''}`);

    (measured.gap[scene.name] ??= {})[detail] = gapFails.length;
    (measured.inside[scene.name] ??= {})[detail] = insideFails.length;
    (measured.unplaced[scene.name] ??= {})[detail] = unplaced.length;
    (measured.excused[scene.name] ??= {})[detail] = excused.length;
    total.gap += gapFails.length; total.inside += insideFails.length; total.unplaced += unplaced.length; total.excused += excused.length;
    total.entries += entries.length; total.clean += clean;

    for (const j of judged) {
      // The source is the entry's family (the seats of every table size are one), so a report that groups failures by
      // source holds a dozen names for a scene and not two hundred; `what` names the entry itself.
      const source = `PLACED ${family(j.entry.id)}: ${j.entry.from.replace(/\[\d+\]/g, '[*]')}`, excusedBy = j.excusedBy ? { excusedBy: j.excusedBy } : {};
      if (!j.gapOk) failures.push({ scene: scene.name, detail, what: `${j.entry.id} is not on its ${j.entry.support}: ${gapWords(j)}${j.nearest ? `; the nearest voxel is ${f2(j.nearest.distance)} m away (${j.nearest.mount})` : ''}`, where: at(j.entry), source, ...excusedBy });
      if (j.inside.size) failures.push({ scene: scene.name, detail, what: `the box of ${j.entry.id} holds ${insideWords(j)}`, where: at(j.entry), source, ...excusedBy });
    }
    for (const t of unplaced) failures.push({ scene: scene.name, detail, what: `no entry of PLACED says where "${t.name}" stands: ${why[t.name] ?? 'no reason given'}`, where: `(${t.at.position.map(f2).join(', ')})`, source: `thing "${t.name}": ${t.parts[0]?.mount ?? ''}` });
    // For the JSON: each family that fails, with how many of it, the range of its gaps and whose voxels are in its boxes.
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const families = [...by].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, all]) => {
      const gaps = all.filter((j) => !j.gapOk).flatMap((j) => j.gaps), known = gaps.filter((g): g is number => g !== null);
      const meshes = new Set<string>();
      for (const j of all) for (const mount of j.inside.keys()) meshes.add(mount);
      return {
        family: name, of: judged.filter((j) => family(j.entry.id) === name).length,
        offSupport: all.filter((j) => !j.gapOk).length, gapFrom: known.length ? round(Math.min(...known)) : null, gapTo: known.length ? round(Math.max(...known)) : null, raysWithNothing: gaps.length - known.length,
        somethingInBox: all.filter((j) => j.inside.size).length, inBox: [...meshes].sort(),
        ...(all.length <= 3 ? { ids: all.map((j) => j.entry.id) } : {}),
      };
    });
    data.scenes.push({ scene: scene.name, detail, entries: entries.length, clean, failing: families, excused: excused.map((j) => j.entry.id), unplaced: unplaced.map((t) => t.name), tilted: unlaid });
  }

  for (const e of options.exempt) {
    if (!ids.has(e.match)) problems.push(`EXEMPT.json excuses "${e.match}" from this check, and no entry of PLACED has that id`);
  }
  const failing = total.gap + total.inside + total.unplaced;
  const summary = problems.length
    ? `NOT RUN: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? `; and ${problems.length - 3} more` : ''}`
    : `${plural(m.PLACED.length, 'entry', 'entries')} of PLACED over ${world.details.join(' and ')}: ${total.gap} off their support, ${total.inside} with something in their box, ${plural(total.unplaced, 'thing')} not placed; ${total.excused} excused by EXEMPT.json`;
  if (problems.length) lines.push('', 'The stage could not do its work:', ...problems.map((p) => `  ${p}`));
  lines.push('', failing || total.excused
    ? `${total.gap} off their support, ${total.inside} with something in their box and ${total.unplaced} not placed, over ${world.details.join(' and ')}. Each is named above; --show=<text> lists any entry ray by ray.`
    : 'Everything placed stands on its support, and every thing is placed.');
  return { ok: problems.length === 0, summary, lines, measured, failures, data };
}
