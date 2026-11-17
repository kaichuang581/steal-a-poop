import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLEAR_SIGHT_LINES, groundAt, isClear, WENDIGO_AT } from '../countryside';
import { POV_DIP, POV_HOLD, POV_SHOTS, povAt } from '../homePov';

/**
 * The fence round the wendigo (plan file 04, section 4.1, steps 1 to 3; file 16, section 4.1 c). Brian settled that the
 * wendigo is not touched: its model, its three source files, where it stands, the paddock shot that catches it, the
 * camera's drift on that shot, the pines placed round it by hand and the corridor kept clear through to the camera.
 * This file holds each of those to what it was on 2026-11-16 (commit 6edc7fe) with hashes and numbers only: it builds
 * no scene, so it runs with every `npm test`. The voxels themselves (the 12 m stand, the view cone, the sight rays)
 * are `npm run check:scenes`, and the magenta mask is the gate's.
 *
 * Nothing here follows the code: every number is written out, so a change to the code can never move what it is
 * held to. This file is not one a milestone may edit.
 */

const RULE = 'The wendigo zone is frozen (CLAUDE.md, "The visual overhaul", Wendigo zone; plan file 04, section 4.1). '
  + 'Put this back as it was. If it truly has to change, stop and ask Brian first.';

/** Fails naming everything that changed, then the rule. */
function frozen(changes: string[]): void {
  if (changes.length) expect.fail(`${changes.join('\n')}\n${RULE}`);
}

const ROOT = new URL('../../../../', import.meta.url);
const bytes = (path: string) => readFileSync(new URL(path, ROOT));
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Code on one line, to compare how something is written whatever its line breaks: comments out, white space single. */
const squash = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
  .replace(/\s+/g, ' ')
  .replace(/([([{]) /g, '$1')
  .replace(/ ([)\]},;])/g, '$1')
  .replace(/,([)\]}])/g, '$1')
  .trim();
const code = (path: string) => squash(bytes(path).toString('utf8'));

/** One function's text out of squashed code, from `function name(` to its closing brace; '' if it is gone. */
function functionOf(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return '';
  let i = source.indexOf('(', start), depth = 0;
  for (; i < source.length; i++) { if (source[i] === '(') depth++; else if (source[i] === ')' && --depth === 0) break; }
  for (i = source.indexOf('{', i), depth = 0; i >= 0 && i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
  return i < 0 ? '' : source.slice(start, i + 1);
}

/** What stands in `source` now where `lead` begins, up to the end of that statement; all of `source` for no lead. */
function nowReads(source: string, lead: string): string {
  if (!lead) return source || 'nothing: the function is gone or renamed';
  const at = source.indexOf(squash(lead));
  return at < 0 ? 'nothing that begins that way' : source.slice(at, source.indexOf(';', at) + 1);
}

/** Each statement must stand in `source`, once, in this order. `lead` is how the statement begins, to say what is there now. */
function written(source: string, where: string, pins: readonly (readonly [what: string, statement: string, lead: string])[]): string[] {
  const changes: string[] = [];
  let last = -1;
  for (const [what, statement, lead] of pins) {
    const want = squash(statement), at = source.indexOf(want);
    if (at < 0) changes.push(`${where}: ${what} changed.\n  was: ${want}\n  now: ${nowReads(source, lead)}`);
    else if (source.indexOf(want, at + 1) >= 0) changes.push(`${where}: ${what} is written twice now.\n  the line: ${want}`);
    else if (at < last) changes.push(`${where}: ${what} moved out of its place.\n  the line: ${want}`);
    else last = at;
  }
  return changes;
}

const COUNTRYSIDE = 'src/skin/scene/countryside.ts';
const BACKDROP = 'src/skin/table/FarmBackdrop.tsx';

describe('the wendigo zone is frozen', () => {
  it('the model and its three source files are byte for byte what they were at 6edc7fe', () => {
    const FILES: Record<string, string> = {
      'public/models/wendigo.glb': '1ff575d17e299f2053d217d7f0fb703d1e6ca75f76c7226c9be8d3845cbfa00c',
      'src/skin/table/Wendigo.tsx': '30d0c50847de5f3142df344ec9f241933d087fba9f7b834b530f425ce098ef86',
      'src/skin/table/wendigoPose.ts': '48703d5dd1cc383a7d1efa3b38b1882df83b81096c10d125e59dce372de5b89a',
      'src/skin/table/WendigoPreview.tsx': '7fe7a685a2235dda853a744e33cbe39cb2060bb8d21349a65b9027213a591a60',
    };
    const changes: string[] = [];
    for (const [path, was] of Object.entries(FILES)) {
      let now: string;
      try { now = sha256(bytes(path)); } catch { now = 'the file is gone'; }
      if (now !== was) changes.push(`${path} changed: there may never be a diff in it.\n  SHA-256 was: ${was}\n  SHA-256 now: ${now}`);
    }
    frozen(changes);
  });

  it('the wendigo stands where it stood, on the same ground', () => {
    expect(WENDIGO_AT, `WENDIGO_AT in ${COUNTRYSIDE} moved from [-9.6, -36.1]. ${RULE}`).toStrictEqual([-9.6, -36.1]);
    expect(groundAt(-9.6, -36.1), `The ground under the wendigo, groundAt(-9.6, -36.1) in ${COUNTRYSIDE}, is no longer 9 m: its feet are set on it. ${RULE}`).toBe(9);
  });

  it('the paddock shot is the same camera, to the number, on a computer and on a phone', () => {
    expect(POV_SHOTS.desktop[2], `POV_SHOTS.desktop[2] in src/skin/scene/homePov.ts, the paddock shot the wendigo is seen from, changed. ${RULE}`)
      .toStrictEqual({ position: [21.2, 2.3, 6.2], target: [12.5, 0.9, -2.5], fov: 38, push: [-1.8, -0.2, 0.5], spill: 0.4 });
    expect(POV_SHOTS.phone[2], `POV_SHOTS.phone[2] in src/skin/scene/homePov.ts, the phone's paddock shot, changed. ${RULE}`)
      .toStrictEqual({ position: [21.2, 3.4, 7.8], target: [15, -3, -1.5], fov: 52, push: [-1, -0.1, 0.3], spill: 0.4 });
  });

  it('the tour holds each shot 5 s with a 0.4 s dip, and the paddock is its third stop of eight, or of six on a phone', () => {
    expect(POV_HOLD, `POV_HOLD in src/skin/scene/homePov.ts is no longer 5 s: it sets how long the paddock shot shows and how far its camera travels. ${RULE}`).toBe(5);
    expect(POV_DIP, `POV_DIP in src/skin/scene/homePov.ts is no longer 0.4 s. ${RULE}`).toBe(0.4);
    // How often the paddock comes round, and so how often the wendigo can be there, hangs on how many shots the tour has.
    expect([POV_SHOTS.desktop.length, POV_SHOTS.phone.length], `The tour no longer has 8 computer shots and 6 phone shots (src/skin/scene/homePov.ts): that changes how often the paddock shot comes round. ${RULE}`).toStrictEqual([8, 6]);
    for (const count of [8, 6]) {
      expect(povAt(12.5, count), `povAt in src/skin/scene/homePov.ts no longer shows shot 2, the paddock, half way through its hold and clear of the dip, 12.5 s into a tour of ${count}. ${RULE}`)
        .toStrictEqual({ index: 2, progress: 0.5, veil: 0 });
    }
  });

  it('the Home camera still drifts 0.25 m by 0.12 m over 40 s on top of each shot\'s own travel', () => {
    const drift = functionOf(code(BACKDROP), 'Drift');
    if (!drift) frozen([`${BACKDROP}: the Drift function, which moves the Home camera, is gone or renamed.`]);
    frozen(written(drift, `${BACKDROP}, Drift`, [
      ['the drift\'s period (once round every 40 s)', 'const t = (clock.elapsedTime / 40) * Math.PI * 2;', 'const t ='],
      ['the drift from side to side (0.25 m, none under reduced motion)', 'const dx = reduced ? 0 : Math.cos(t) * 0.25;', 'const dx ='],
      ['the drift up and down (0.12 m, none under reduced motion)', 'const dy = reduced ? 0 : Math.sin(t) * 0.12;', 'const dy ='],
      ['how far along its travel the camera is', 'const k = pov.progress;', 'const k ='],
      ['where the camera stands (the shot, plus the drift, plus its travel)',
        'camera.position.set(shot.position[0] + dx + shot.push[0] * k, shot.position[1] + dy + shot.push[1] * k, shot.position[2] + shot.push[2] * k);', 'camera.position.set('],
      ['what the camera looks at', 'camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);', 'camera.lookAt('],
    ]));
  });

  it('the ten pines round the wendigo are the ones placed by hand, and the corridor to the paddock camera is kept clear', () => {
    const forest = functionOf(code(COUNTRYSIDE), 'forest');
    if (!forest) frozen([`${COUNTRYSIDE}: the forest function, which plants the pines round the wendigo, is gone or renamed.`]);
    const where = `${COUNTRYSIDE}, forest`;
    const changes = written(forest, where, [
      ['what the pines are placed round (the wendigo)', 'const [wx, wz] = WENDIGO_AT;', 'const [wx, wz] ='],
      ['the two directions the pines are placed by (toward the paddock camera, and that camera\'s right)', 'const tc = [0.58, 0.82], rt = [0.82, -0.58];', 'const tc ='],
      ['how a hand-placed pine\'s place is worked out',
        'const at = (side: number, toward: number, h: number): [number, number, number] => [wx + rt[0] * side + tc[0] * toward, wz + rt[1] * side + tc[1] * toward, h];', 'const at ='],
      ['how far ahead of the wendigo and how far aside a tree stands',
        'const ahead = (x - wx) * tc[0] + (z - wz) * tc[1], aside = Math.abs((x - wx) * rt[0] + (z - wz) * rt[1]);', 'const ahead ='],
      ['the corridor (no tree within 2.6 m of the wendigo, none up to 14 m ahead of it within 1.2 m of the line to the camera)',
        'if (r() > keep || !isClear(x, z) || Math.hypot(x - wx, z - wz) < 2.6 || (ahead > 0 && ahead < 14 && aside < 1.2)) continue;', 'if (r() > keep'],
    ]);
    // The ten, as [to the camera's right, toward the camera, height], in the order they are planted (the order seeds each one).
    const PINES = [[3.6, -0.6, 9.5], [-3.5, 0.1, 7], [2.8, 0.9, 4.2], [0.2, -4.3, 9], [-1.6, -6, 10.5], [3.4, -4.8, 8], [-4.4, 1.4, 6], [-2.7, 3.6, 8.6], [2.9, 3.9, 7.6], [0.2, 6.6, 4.4]];
    const list = /const placed: \[number, number, number\]\[\] = \[(.*?)\];/.exec(forest)?.[1];
    if (list === undefined) changes.push(`${where}: the list of hand-placed pines (const placed: [number, number, number][] = [...]) is gone or written another way.`);
    else {
      const now = [...list.matchAll(/\bat\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
      const other = list.replace(/\bat\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)/g, '').replace(/[,\s]/g, '');
      if (JSON.stringify(now) !== JSON.stringify(PINES)) changes.push(`${where}: the ten hand-placed pines changed.\n  were: ${JSON.stringify(PINES)}\n  now:  ${JSON.stringify(now)}`);
      if (other) changes.push(`${where}: the list of hand-placed pines holds something that is not one of the ten: ${other}`);
    }
    frozen(changes);
  });

  it('the wendigo is still mounted on the Home farm, once, with nothing deciding whether it is', () => {
    const backdrop = code(BACKDROP);
    const mounts = backdrop.match(/<Wendigo(?![\w$])[^>]*>/g) ?? [];
    const changes: string[] = [];
    if (!backdrop.includes(squash("import { Wendigo } from './Wendigo';"))) changes.push(`${BACKDROP} no longer imports Wendigo from './Wendigo'.`);
    if (mounts.length !== 1 || mounts[0] !== '<Wendigo reduced={reduced} />') changes.push(`${BACKDROP} no longer mounts the wendigo exactly once as <Wendigo reduced={reduced} />.\n  now: ${mounts.length ? mounts.join(' ') : 'not mounted'}`);
    // It stands among the scene's other children: straight after another element, never behind a condition.
    else if (!/[>}] <Wendigo reduced=\{reduced\} \/>/.test(backdrop)) changes.push(`${BACKDROP}: <Wendigo reduced={reduced} /> is now behind a condition or wrapped; it was a plain child of the Home canvas.`);
    frozen(changes);
  });

  it('isClear reads the fourteen frozen sight lines, and answers as it did at the freeze', () => {
    // Literal on purpose, never compared with POV_SHOTS: the tour's cameras may move in a later milestone, these may not.
    expect(CLEAR_SIGHT_LINES, `CLEAR_SIGHT_LINES in ${COUNTRYSIDE} is no longer the fourteen camera positions and targets of 2026-11-16 (8 computer, then 6 phone). `
      + `The land is planted through isClear, so a changed line plants the woods round the wendigo again. ${RULE}`).toStrictEqual([
      [[-12.5, 7, 23], [0.6, 1.6, 4.5]],
      [[-40, 21, 40], [-8, 1, 1]],
      [[21.2, 2.3, 6.2], [12.5, 0.9, -2.5]],
      [[0.2, 1.1, 2.6], [1.5, 1.7, 8.2]],
      [[-6.2, 2.9, 12.2], [-15.4, 0.7, 3.2]],
      [[6, 1.2, 14.4], [7.4, 1.7, 7.4]],
      [[-1.6, 0.95, 15], [-1.5, 1.25, 8.2]],
      [[14.8, 3.4, 31], [3.6, 2.2, 10]],
      [[-6.5, 4.6, 21], [0, -0.9, 8.2]],
      [[-38, 26, 42], [-4, -9, 9]],
      [[21.2, 3.4, 7.8], [15, -3, -1.5]],
      [[0.2, 1.6, -3.2], [0, -1.1, 8.2]],
      [[-6.5, 4.2, 13], [-12.2, -2.6, 3.8]],
      [[0.3, 1.1, 22], [0, -1, 8.2]],
    ]);
    const land = code(COUNTRYSIDE);
    const changes = written(functionOf(land, 'isClear'), `${COUNTRYSIDE}, isClear`, [
      ['what isClear reads its sight lines from (the frozen copy)', 'return CLEAR_SIGHT_LINES.every(([position, target]) => fromSightLine(x, z, position, target) > 3);', ''],
    ]);
    if (/POV_SHOTS|homePov/.test(land)) changes.push(`${COUNTRYSIDE} reads the live tour again (POV_SHOTS or homePov is back in its code): a camera moved in homePov.ts would plant the land again.`);
    // Asked every metre over the land the builders plant: 161 by 121 points.
    const answers: number[] = [];
    for (let x = -80; x <= 80; x++) for (let z = -70; z <= 50; z++) answers.push(isClear(x, z) ? 1 : 0);
    const clear = answers.reduce((n, a) => n + a, 0), digest = sha256(Uint8Array.from(answers));
    if (answers.length !== 19481 || clear !== 16235 || digest !== 'f0b09ad581d5b690a516dc0e9d59bfff17b0f847337cbc2a41d81db7e649db47') {
      changes.push(`isClear in ${COUNTRYSIDE} answers differently than at the freeze: ${clear} of ${answers.length} points clear (were 16235 of 19481), SHA-256 ${digest}. `
        + 'Every wood, drift and bush is planted through it from shared random streams, so the land round the wendigo is planted again.');
    }
    frozen(changes);
  });
});
