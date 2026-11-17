import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  anchorsOf, boxesOverlap, Columns, coplanarArea, distanceToBoxes, GAP_TOLERANCE, gapAbove, gapBelow, gapPasses, goneLines, LAMP_REACH, lightElements,
  rayPoints, rectsOverlap, tailShown, topBelow, triangleCount, undersideAbove, unlistedLights, visibleWithTriangles,
} from '../../../tools/scenes/pure';
import type { Box, Quad } from '../../../tools/scenes/pure';
import { ALSO_COPIED, KNOWN_OVERLAPS, LIGHTS, NOT_PLACED, PLACED, together } from '../scene/placed';
import type { Placed } from '../scene/placed';
import { LIVESTOCK } from '../table/Farmstead';

// The integrity rules every `npm test` run holds (docs/visual-overhaul/18-asset-integrity.md, section 4.1): arithmetic
// and a few files read, nothing built. No scene and no animal is built here: that is `npm run check:scenes`, whose
// place and lights stages (tools/scenes/place.ts, lights.ts) cast the rays these rules only describe. What is here:
//
//   - docs/visual-overhaul/EXEMPT.json keeps its shape, and holds no more entries than the stored number allows;
//   - the placement manifest (src/skin/scene/placed.ts) is whole: every entry has a support, every number it copies
//     from the game is still on the line it was copied from, and no two footprint boxes run into each other, but for
//     the pairs that do today (KNOWN_OVERLAPS in placed.ts), which may only be taken off that list;
//   - every point and spot light the game mounts has an entry of LIGHTS;
//   - the checker's own arithmetic (tools/scenes/pure.ts) gives the right answers on hand-made data.

// The tests run from the repo's root, as every test here that reads a file expects.
const root = process.cwd();
const json = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** The stages and the scenes of the scene checker (tools/scenes/build.ts, which a test must not import: it builds). */
const STAGES = ['connect', 'place', 'lights', 'coplanar', 'lens', 'models', 'wendigo', 'baked'];
const SCENES = ['table', 'farm', 'duel', 'pen', 'bedroom', 'dream', 'podium'];

describe('the exemption file (plan file 18, section 4.6)', () => {
  interface Entry { check?: unknown; scene?: unknown; match?: unknown; reason?: unknown; status?: unknown; brian?: { date?: unknown; words?: unknown } }
  const file = json('docs/visual-overhaul/EXEMPT.json') as { exemptions?: Entry[] };
  const entries = file.exemptions ?? [];
  const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
  /** The old tool's two exemptions, moved here in milestone 0 without Brian's words yet. No other entry may be pending. */
  const PENDING = ['connect / table / buildDistance', 'connect / bedroom / thing "clock"'];

  it('is a list of entries, each naming one check, one scene, one match and a reason, with Brian\'s dated words', () => {
    expect(Array.isArray(file.exemptions), 'EXEMPT.json has no "exemptions" list').toBe(true);
    const problems: string[] = [];
    entries.forEach((e, i) => {
      const where = `entry ${i + 1}`;
      for (const key of ['check', 'scene', 'match', 'reason'] as const) if (!text(e[key])) problems.push(`${where} has no ${key}`);
      const extra = Object.keys(e).filter((k) => !['check', 'scene', 'match', 'reason', 'status', 'brian'].includes(k));
      if (extra.length) problems.push(`${where} has fields that are not part of an entry: ${extra.join(', ')}`);
      if (text(e.check) && !STAGES.includes(e.check)) problems.push(`${where} names the check "${e.check}", which is not a stage`);
      if (text(e.scene) && !SCENES.includes(e.scene)) problems.push(`${where} names the scene "${e.scene}", which is not one scene`);
      if (!e.brian || typeof e.brian !== 'object' || !('date' in e.brian) || !('words' in e.brian)) { problems.push(`${where} has no brian: { date, words }`); return; }
      if (e.status === 'pending') {
        if (e.brian.date !== null || e.brian.words !== null) problems.push(`${where} is marked pending and has a date or words`);
        if (!PENDING.includes(`${String(e.check)} / ${String(e.scene)} / ${String(e.match)}`)) problems.push(`${where} is a new pending entry: no pending entry may be added after milestone 0 (a new entry needs Brian's words)`);
      } else if (e.status !== undefined) problems.push(`${where} has status "${String(e.status)}": the only status is "pending"`);
      else if (!text(e.brian.words) || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.brian.date))) problems.push(`${where} is not pending and has no dated words from Brian (date as YYYY-MM-DD)`);
    });
    const keys = entries.map((e) => `${String(e.check)} / ${String(e.scene)} / ${String(e.match)}`);
    for (const k of new Set(keys)) if (keys.filter((x) => x === k).length > 1) problems.push(`two entries excuse the same thing: ${k}`);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('holds no more entries than the number stored in RATCHETS.json, once one is stored', () => {
    const stored = (json('docs/visual-overhaul/RATCHETS.json') as { scenes?: { exemptions?: unknown } }).scenes?.exemptions;
    // Until the gate has stored the number (npm run gate -- --seed) there is nothing to hold the count to but the two pending entries.
    const most = typeof stored === 'number' ? stored : PENDING.length;
    expect(entries.length, `EXEMPT.json holds ${entries.length} entries and at most ${most} are allowed: the count may only fall, and a new entry needs Brian's words and the stored number raised by him`).toBeLessThanOrEqual(most);
  });
});

/** An entry's footprint box: its footprint, from its y up to its height (down from its y, for a thing that hangs). */
const boxOf = (e: Placed): Box => ({
  x: e.position[0], z: e.position[2], w: e.footprint[0], d: e.footprint[1], yaw: e.yaw ?? 0,
  y0: e.hangs ? e.position[1] - e.height : e.position[1], y1: e.hangs ? e.position[1] : e.position[1] + e.height,
});

/**
 * The pairs of placed things whose footprint boxes ran into each other on 2026-11-16 (commit 6edc7fe): the wheelbarrow
 * corner of the barn, which plan file 18 (section 4.7, fix 3) moves apart in milestone 3. FROZEN: this copy is never
 * edited. The living list is KNOWN_OVERLAPS in src/skin/scene/placed.ts, which may hold only pairs that are here, so
 * it can shrink and never grow; a fix takes its pair off that list, and this file is left as it is.
 */
const OVERLAPS_ON_2026_11_16: [string, string][] = [
  ['table:wheelbarrow', 'table:barn present 1'],
  ['table:wheelbarrow', 'table:sheepdog'],
  ['table:barn tree', 'table:barn present 1'],
  ['table:barn tree', 'table:barn present 2'],
  ['farm:wheelbarrow', 'farm:barn present 1'],
  ['farm:wheelbarrow', 'farm:doorway sheep'],
  ['farm:barn tree', 'farm:barn present 1'],
  ['farm:barn tree', 'farm:barn present 2'],
];

describe('the placement manifest (plan file 18, section 4.3)', () => {
  it('gives every entry an id of its scene, a place, a footprint, a height and one of the four supports', () => {
    const problems: string[] = [], seen = new Set<string>();
    for (const e of PLACED) {
      if (seen.has(e.id)) problems.push(`two entries are called "${e.id}"`);
      seen.add(e.id);
      if (!SCENES.includes(e.scene)) problems.push(`${e.id}: "${e.scene}" is not a scene`);
      if (!e.id.startsWith(`${e.scene}:`)) problems.push(`${e.id}: an id starts with its scene`);
      if (!['floor', 'beam', 'bedding', 'post'].includes(e.support)) problems.push(`${e.id} has no support (floor, beam, bedding or post)`);
      if (e.position.length !== 3 || !e.position.every(Number.isFinite)) problems.push(`${e.id} has no place`);
      if (!(e.footprint[0] > 0 && e.footprint[1] > 0)) problems.push(`${e.id} has no footprint`);
      if (!(e.height > 0)) problems.push(`${e.id} has no height`);
      if (e.yaw !== undefined && !Number.isFinite(e.yaw)) problems.push(`${e.id} has a turn that is not a number`);
      if (!e.from) problems.push(`${e.id} does not say which constant of the game it was read from`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
    // The entries the plan names are all there (a manifest that lost its seats would pass everything above).
    for (const id of ['table:robin', 'table:cat', 'farm:hero', 'farm:doorway sheep', 'table:sheepdog', 'table:letter board', 'duel:letter board', 'table:lantern 0', 'duel:lamp 0', 'pen:tall lantern', 'podium:bale 0', 'podium:bale 11', 'table:bomb at seat 0 of 2', 'duel:bomb at seat 1']) {
      expect(seen.has(id), `PLACED has lost "${id}"`).toBe(true);
    }
    expect(PLACED.filter((e) => /^table:seat \d+ of \d+$/.test(e.id)).length, 'one seat for each sheep of every table of 2 to 10').toBe(54);
    expect(PLACED.filter((e) => e.id.startsWith('farm:livestock ')).length, 'one entry for each of the farm\'s livestock').toBe(LIVESTOCK.length);
    for (const scene of Object.keys(NOT_PLACED)) expect(SCENES, `NOT_PLACED names "${scene}", which is not a scene`).toContain(scene);
  });

  it('copies no number from a line the game no longer has', () => {
    const gone = goneLines(root, [...PLACED.flatMap((e) => (e.copied ? [e.copied] : [])), ...ALSO_COPIED]);
    expect(gone, `placed.ts works these numbers out from lines of the game that have changed. Read each line's file again and bring the entry up to date:\n${gone.join('\n')}`).toEqual([]);
  });

  it('has no two footprint boxes that run into each other, but for the pairs that do today', () => {
    const found: string[] = [];
    for (let i = 0; i < PLACED.length; i++) {
      for (let j = i + 1; j < PLACED.length; j++) {
        if (together(PLACED[i], PLACED[j]) && boxesOverlap(boxOf(PLACED[i]), boxOf(PLACED[j]))) found.push(`${PLACED[i].id} + ${PLACED[j].id}`);
      }
    }
    const known = KNOWN_OVERLAPS.map(([a, b]) => `${a} + ${b}`), frozen = OVERLAPS_ON_2026_11_16.map(([a, b]) => `${a} + ${b}`);
    const added = known.filter((p) => !frozen.includes(p));
    expect(added, `KNOWN_OVERLAPS in src/skin/scene/placed.ts may only shrink, and these pairs were not on it on 2026-11-16:\n${added.join('\n')}`).toEqual([]);
    const fresh = found.filter((p) => !known.includes(p)), mended = known.filter((p) => !found.includes(p));
    expect(fresh, `these placed things now stand inside each other, and did not before:\n${fresh.join('\n')}`).toEqual([]);
    expect(mended, `these pairs no longer run into each other: take them off KNOWN_OVERLAPS in src/skin/scene/placed.ts, which may only shrink:\n${mended.join('\n')}`).toEqual([]);
  });

  it('keeps things of different arrangements and turns apart, and things of one together', () => {
    const at = (id: string) => PLACED.find((e) => e.id === id)!;
    expect(together(at('table:seat 0 of 4'), at('table:seat 1 of 4'))).toBe(true);
    expect(together(at('table:seat 0 of 4'), at('table:seat 0 of 5'))).toBe(false); // two table sizes
    expect(together(at('table:seat 1 of 4'), at('table:seat 1 of 4, stepped in'))).toBe(false); // the same sheep twice
    expect(together(at('table:seat 2 of 4'), at('table:seat 1 of 4, stepped in'))).toBe(true);
    expect(together(at('table:seat 1 of 4, stepped in'), at('table:bomb at seat 1 of 4'))).toBe(true);
    expect(together(at('table:seat 1 of 4, stepped in'), at('table:bomb at seat 2 of 4'))).toBe(false); // two turns
    expect(together(at('table:sheepdog'), at('table:seat 0 of 4'))).toBe(true); // no arrangement: with everything
    expect(together(at('table:sheepdog'), at('farm:doorway sheep'))).toBe(false); // two scenes
  });

  it('is imported by nothing in the game, so it never ships', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(path); continue; }
        if (!/\.tsx?$/.test(entry.name) || path === 'src/skin/scene/placed.ts') continue;
        if (/['"][^'"\n]*\/placed(\.ts)?['"]/.test(readFileSync(join(root, path), 'utf8'))) importers.push(path);
      }
    };
    walk('src');
    expect(importers, `placed.ts is for the checks only; these files of the game import it: ${importers.join(', ')}`).toEqual([]);
  });
});

describe('the lights (plan file 18, section 4.2 e)', () => {
  const elements = lightElements(root);

  it('has an entry of LIGHTS on every point and spot light the game mounts', () => {
    expect(elements.length, 'no light elements were found under src/skin: the search is broken').toBeGreaterThan(0);
    const { unlisted, orphans, wrongKind } = unlistedLights(elements, LIGHTS);
    expect(unlisted.map((e) => `${e.file}:${e.line}  ${e.text.split('\n')[0].slice(0, 100)}`), 'these lights have no entry of LIGHTS in src/skin/scene/placed.ts: say for each whether it is a lamp\'s, a fill, or unseen').toEqual([]);
    expect(orphans, 'these entries of LIGHTS are on no light element any more').toEqual([]);
    expect(wrongKind, 'these entries of LIGHTS say they are another kind of light than their element').toEqual([]);
  });

  it('says of every light which of three things it is: a lamp\'s, a fill, or one the checker cannot see', () => {
    const problems: string[] = [], seen = new Set<string>();
    for (const l of LIGHTS) {
      if (seen.has(l.id)) problems.push(`two entries are called "${l.id}"`);
      seen.add(l.id);
      const kinds = [l.lamp ? 'lamp' : '', l.fill ? 'fill' : '', l.unseen ? 'unseen' : ''].filter(Boolean);
      if (kinds.length !== 1) problems.push(`${l.id} must be exactly one of lamp, fill and unseen, and is ${kinds.join(' and ') || 'none'}`);
      if (l.lamp && (!SCENES.includes(l.lamp.scene) || !l.lamp.mounts.length || !l.lamp.position.every(Number.isFinite))) problems.push(`${l.id} is a lamp's light with no scene, no place or no lamp`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
    const gone = goneLines(root, LIGHTS.flatMap((l) => [l.element, ...(l.copied ? [l.copied] : [])]));
    expect(gone, gone.join('\n')).toEqual([]);
  });
});

describe('the scene checker\'s arithmetic (tools/scenes/pure.ts), on hand-made data', () => {
  /** A floor of four 1 m slabs with their tops at y = 0, a 0.1 m bed of straw on one of them, and a beam 4.3 m up over another. */
  const scene = [
    0, -0.1, 0, 1, 0, 1, 1, -0.1, 0, 2, 0, 1, 0, -0.1, 1, 1, 0, 2, 1, -0.1, 1, 2, 0, 2,
    1, 0, 1, 2, 0.1, 2,
    0, 4.3, 0, 1, 4.6, 0.3,
  ];

  it('the ray-down gap: 0 standing, over 0 in the air, under 0 sunk in, and none with nothing below', () => {
    expect(topBelow(scene, 0.5, 0.5, 1)).toBe(0);
    expect(gapBelow(scene, 0.5, 0.5, 0, 0.8)).toBe(0); // a sheep on the boards
    expect(gapBelow(scene, 1.5, 1.5, 0, 0.8)).toBeCloseTo(-0.1, 9); // a hen at y 0 in 0.10 m of straw
    expect(gapBelow(scene, 1.5, 1.5, 0.1, 0.8)).toBeCloseTo(0, 9); // the same hen lifted onto the straw
    expect(gapBelow(scene, 0.5, 1.5, 4.1, 0.12)).toBeCloseTo(4.1, 9); // a robin with only the floor under it
    expect(gapBelow(scene, 0.5, 0.2, 4.6, 0.12)).toBeCloseTo(0, 9); // the same robin on its beam
    expect(gapBelow(scene, 5, 5, 0, 1)).toBeNull(); // off the edge of everything
    // A ray that starts inside a voxel has met it: something buried deeper than it is tall still reads as sunk.
    expect(gapBelow(scene, 0.5, 0.2, 4.3, 0.1)).toBeCloseTo(-0.3, 9);
    // Hung things are asked the same of what is over them.
    expect(undersideAbove(scene, 0.5, 0.2, 3)).toBe(4.3);
    expect(gapAbove(scene, 0.5, 0.2, 4.3, 0.6)).toBeCloseTo(0, 9); // a lantern's hook at the beam's underside
    expect(gapAbove(scene, 0.5, 0.2, 4.25, 0.6)).toBeCloseTo(0.05, 9); // a board hung 0.05 m under it
    expect(gapAbove(scene, 1.5, 0.5, 4.25, 0.6)).toBeNull();
    // 0.02 m either way passes, and nothing under a ray never does.
    expect(GAP_TOLERANCE).toBe(0.02);
    expect([0, 0.02, -0.02, 0.0201, -0.05, null].map((g) => gapPasses(g))).toEqual([true, true, true, false, false, false]);
  });

  it('a ray on the seam between two cells meets them, though one starts at 6.1000000000000005 and the other ends at 6.1', () => {
    const cells = [60, 61].flatMap((i) => [i * 0.1, -0.1, 0, i * 0.1 + 0.1, 0, 1]);
    expect(61 * 0.1).not.toBe(60 * 0.1 + 0.1); // the crack this guards against
    expect(topBelow(cells, 6.1, 0.5, 1)).toBe(0);
    const sorted = new Columns(0.5);
    sorted.add(cells);
    expect(sorted.down(6.1, 0.5, 1)?.y).toBe(0);
  });

  it('sorted columns answer exactly as the plain helpers do, and say whose voxel it was', () => {
    const floor = scene.slice(0, 24), straw = scene.slice(24, 30), beam = scene.slice(30);
    const sorted = new Columns(0.5);
    const sets = [sorted.add(floor), sorted.add(straw), sorted.add(beam)];
    expect(sets).toEqual([0, 1, 2]);
    expect(sorted.count).toBe(6);
    for (const [x, z, from] of [[0.5, 0.5, 1], [1.5, 1.5, 1], [0.5, 0.2, 5], [0.5, 0.2, 4.4], [5, 5, 1], [1.999, 1.001, 0.05]]) {
      expect(sorted.down(x, z, from)?.y ?? null).toBe(topBelow(scene, x, z, from));
      expect(sorted.up(x, z, from)?.y ?? null).toBe(undersideAbove(scene, x, z, from));
    }
    expect(sorted.down(1.5, 1.5, 1)).toEqual({ y: 0.1, set: 1 });
    expect(sorted.down(1.5, 1.5, 1, (set) => set === 1)).toEqual({ y: 0, set: 0 }); // its own voxels left out
    // The footprint box of a hen at y 0, raised 0.02: the straw is in it, the boards under it are not.
    const hen: Box = { x: 1.5, z: 1.5, w: 0.4, d: 0.4, yaw: 0.5, y0: 0.02, y1: 0.7 };
    expect([...sorted.inside(hen)]).toEqual([[1, 1]]);
    expect([...sorted.inside({ ...hen, y0: 0.12 })]).toEqual([]);
    expect(sorted.inside(hen, (set) => set === 1).size).toBe(0);
    expect(sorted.nearest([0.5, 4.1, 1.3], 2)?.distance).toBeCloseTo(distanceToBoxes([0.5, 4.1, 1.3], scene), 9);
    expect(sorted.nearest([0.5, 4.1, 1.3], 2)?.set).toBe(2);
    expect(sorted.nearest([0.5, 2, 0.5], 0.5)).toBeNull();
    // A sorter may be told to keep only what somebody will ask about.
    const few = new Columns(0.5);
    few.add(scene, (x0, z0) => x0 < 1 && z0 < 1);
    expect(few.count).toBe(2);
  });

  it('the five rays of a footprint: its corners, pulled a millimetre in, and its middle, turned with it', () => {
    const straight = rayPoints({ x: 2, z: 3, w: 1, d: 0.5, yaw: 0 });
    expect(straight).toHaveLength(5);
    expect(straight[4]).toEqual([2, 3]);
    expect(straight[0][0]).toBeCloseTo(1.501, 9);
    expect(straight[0][1]).toBeCloseTo(2.751, 9);
    // A quarter turn, three.js's sense: what reached along x now reaches along -z.
    const quarter = rayPoints({ x: 0, z: 0, w: 1, d: 0.5, yaw: Math.PI / 2 }, 0);
    expect(Math.max(...quarter.map((p) => Math.abs(p[0])))).toBeCloseTo(0.25, 9);
    expect(Math.max(...quarter.map((p) => Math.abs(p[1])))).toBeCloseTo(0.5, 9);
    expect(quarter[1][0]).toBeCloseTo(-0.25, 9);
    expect(quarter[1][1]).toBeCloseTo(-0.5, 9);
  });

  it('two footprint boxes overlap only when they reach into each other, on the ground and in height', () => {
    const a: Box = { x: 0, z: 0, w: 1, d: 1, yaw: 0, y0: 0, y1: 1 };
    expect(boxesOverlap(a, { ...a, x: 0.9 })).toBe(true);
    expect(boxesOverlap(a, { ...a, x: 1 })).toBe(false); // side by side, touching
    expect(boxesOverlap(a, { ...a, y0: 1, y1: 2 })).toBe(false); // one stacked on the other
    expect(boxesOverlap(a, { ...a, y0: 0.5, y1: 2 })).toBe(true);
    // Turned 45 degrees, a square's corner reaches 0.707 from its middle: it reaches a neighbour 1.2 m off, and not one 1.3 m off.
    expect(rectsOverlap(a, { ...a, x: 1.2, yaw: Math.PI / 4 })).toBe(true);
    expect(rectsOverlap(a, { ...a, x: 1.3, yaw: Math.PI / 4 })).toBe(false);
    // Corner to corner, where the boxes round both overlap and the rectangles do not.
    expect(rectsOverlap({ ...a, yaw: Math.PI / 4 }, { ...a, x: 1.1, z: 1.1, yaw: Math.PI / 4 })).toBe(false);
  });

  it('how far a light is from its lamp: 0 inside the glass, else the distance to the nearest face or corner', () => {
    const glass = [0, 2, 0, 0.2, 2.5, 0.2];
    expect(distanceToBoxes([0.1, 2.2, 0.1], glass)).toBe(0);
    expect(distanceToBoxes([0.1, 1.6, 0.1], glass)).toBeCloseTo(0.4, 9); // 0.4 m under it: further than a lamp's light may be
    expect(distanceToBoxes([0.5, 2.9, 0.1], glass)).toBeCloseTo(0.5, 9); // 0.3 across and 0.4 up from its top edge
    expect(distanceToBoxes([0, 0, 0], [])).toBe(Infinity);
    expect(LAMP_REACH).toBe(0.35);
  });

  it('the coplanar area of two quads: what they share, only in the same plane and facing the same way', () => {
    const p: Quad = { axis: 1, at: 0.5, facing: 1, a0: 0, a1: 2, b0: 0, b1: 1 };
    expect(coplanarArea(p, { ...p, a0: 1, a1: 3 })).toBeCloseTo(1, 9); // 1 m of 2 shared, 1 m deep
    expect(coplanarArea(p, p)).toBeCloseTo(2, 9);
    expect(coplanarArea(p, { ...p, a0: 0.5, a1: 1, b0: 0.25, b1: 0.75 })).toBeCloseTo(0.25, 9); // one inside the other
    expect(coplanarArea(p, { ...p, facing: -1 })).toBe(0); // back to back: one of them is never seen
    expect(coplanarArea(p, { ...p, at: 0.55 })).toBe(0); // one cell apart
    expect(coplanarArea(p, { ...p, axis: 0 })).toBe(0);
    expect(coplanarArea(p, { ...p, a0: 2, a1: 3 })).toBe(0); // sharing an edge only
  });

  it('anchorsOf on a 3 x 3 x 3 set of cells: its box, its crown, its feet and where a plate hangs', () => {
    const cube: [number, number, number][] = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) cube.push([x, y, z]);
    const a = anchorsOf(cube, 0.04);
    const near = (got: readonly number[], want: number[]) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
    near(a.bounds.min, [0, 0, 0]);
    near(a.bounds.max, [0.12, 0.12, 0.12]);
    near(a.crown, [0.06, 0.12, 0.06]);
    near(a.feet, [0.06, 0, 0.06]);
    near(a.centre, [0.06, 0.06, 0.06]);
    near(a.plate, [0.06, 0.19, 0.06]); // 0.07 m over the highest voxel: inside the plan's 0.02 to 0.12
    expect([a.crownCells, a.feetCells]).toEqual([9, 9]);
    // One more cell on a corner of the top: the crown is over that cell, not over the middle of the box.
    const horned = anchorsOf([...cube, [2, 3, 0]], 0.04);
    near(horned.crown, [0.1, 0.16, 0.02]);
    near(horned.feet, [0.06, 0, 0.06]);
    expect(horned.crownCells).toBe(1);
    // Cells below zero and a plate gap of one's own.
    near(anchorsOf([[-2, -1, -2]], 0.5, 0.02).plate, [-0.75, 0.02, -0.75]);
    expect(() => anchorsOf([], 0.04)).toThrow();
  });

  it('the tail rule: only a shorn sheep has no tail', () => {
    for (const species of ['pig', 'cow', 'horse', 'goat', 'chicken']) for (let level = 0; level <= 4; level++) expect(tailShown(level, species)).toBe(true);
    expect(tailShown(0, 'sheep')).toBe(false);
    expect([1, 2, 3, 4].map((level) => tailShown(level, 'sheep'))).toEqual([true, true, true, true]);
  });

  it('visible only if it has triangles: a mesh with none is not drawn, whatever it is told', () => {
    const empty = { index: { count: 0 }, attributes: { position: { count: 0 } } };
    const some = { index: { count: 36 }, attributes: { position: { count: 24 } } };
    expect(triangleCount(some)).toBe(12);
    expect(triangleCount({ attributes: { position: { count: 9 } } })).toBe(3); // no index: three corners a triangle
    expect(triangleCount(empty)).toBe(0);
    expect(triangleCount(null)).toBe(0);
    expect(visibleWithTriangles(true, some)).toBe(true);
    expect(visibleWithTriangles(true, empty)).toBe(false);
    expect(visibleWithTriangles(false, some)).toBe(false);
    expect(visibleWithTriangles(true, undefined)).toBe(false);
  });
});
