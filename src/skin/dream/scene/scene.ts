import { blendAt, moonAt, paintMoon, paintSky, paintStars, paintStreaks, sheepShadow, skyBetween, skyOf, starsOf } from './common';
import type { Painter } from './painter';
import { TOKEN } from './palette';
import { paintGate1, paintObstacle1, paintStage1, STAGE1 } from './stage1';
import { alignIsles, paintObstacle2, paintSky2, paintStage2, STAGE2, woolStreaks } from './stage2';
import { paintBack3, paintButtons3, paintGate2, paintLane3, paintMoonSheep, paintObstacle3, STAGE3 } from './stage3';
import { GATE_MS } from './types';
import type { SceneMemory, SceneState } from './types';

/**
 * The dream's scenery for one frame (docs/dream/03 to 05), back to front: the sky, the stars, your words, the moon,
 * the stage's own world, the lane and what stands on it. `words` draws the star words in their place in that order.
 * Across a gate both stages' worlds are drawn, one leaving and one arriving; under reduced motion a gate is one short
 * cross-fade. Drawn only: it is given the frame's state and changes nothing but its own memory.
 */
export function paintScene(p: Painter, st: SceneState, m: SceneMemory, words: () => void): void {
  remember(st, m);
  const g = st.gate;
  if (g && st.reduced) {
    // One 200 ms cross-fade from the stage being left to the one arriving.
    world(p, { ...st, stage: g.from, gate: null }, m, words);
    p.mul = Math.min(1, g.ms / GATE_MS.reduced);
    world(p, { ...st, gate: null }, m, () => {});
    p.mul = 1;
  } else world(p, st, m, words);
  p.done();
}

function world(p: Painter, st: SceneState, m: SceneMemory, words: () => void): void {
  const g = st.gate, sky = g ? skyBetween(g.from, st.stage, blendAt(g.ms)) : skyOf(st.stage), ms = g ? g.ms : 1e6;
  paintSky(p, st, sky);
  // The third stage has small stars only: its bright ones have come down on threads, as buttons.
  if (st.stage === 3) paintStars(p, st, starsOf(st, st.phone ? 40 : 90), false);
  else paintStars(p, st, starsOf(st, st.phone ? 70 : 160));
  p.done();
  words();
  if (st.stage === 2) paintSky2(p, st, ms, 0);
  else if (g?.from === 2) paintSky2(p, st, 1e6, Math.min(1, g.ms / GATE_MS[2]));
  const moon = moonAt(st);
  if (st.stage === 3) paintButtons3(p, st, moon, ms);
  paintMoon(p, st, moon, sky.bands[1]);
  if (st.stage === 3) paintMoonSheep(p, st, moon);
  if (st.stage === 1) paintStage1(p, st, m);
  else if (st.stage === 2) {
    if (m.isles === null) m.isles = alignIsles(st);
    if (g?.from === 1) {
      // Lift-off (04, section 1): the farm's back layers leave as the islands rise, and the field and the wall fall
      // away in front of the lane's island as it grows.
      const out = Math.min(1, g.ms / 900);
      paintStage1(p, st, m, out, 'back');
      paintStage2(p, st, m, g.ms);
      paintStage1(p, st, m, out, 'front');
    } else paintStage2(p, st, m);
  } else if (g?.from === 2) {
    // Tucked in (05, section 1): the islands sink into pillows, the clods fall away, the string of bulbs drifts up,
    // the quilt hills rise, and the quilt rolls out along the lane from where the gate stood.
    if (m.isles === null) m.isles = alignIsles(st);
    if (m.front === null) m.front = st.scroll + (st.arch?.x ?? st.sheep.x);
    paintBack3(p, st, g.ms);
    paintStage2(p, st, m, 1e6, Math.min(1, g.ms / GATE_MS[2]));
    paintLane3(p, st, m, g.ms);
  } else { paintBack3(p, st); paintLane3(p, st, m); }
  // The gate itself, standing on the lane: scenery only.
  const a = st.arch;
  if (a?.to === 2) paintGate1(p, st, a.x, a.since < 0 ? 0 : Math.min(9, 1 + Math.floor(a.since / 40)));
  else if (a) paintGate2(p, st, a.x, a.since >= 0);
  for (const f of st.fences) (f.stage === 1 ? paintObstacle1 : f.stage === 2 ? paintObstacle2 : paintObstacle3)(p, st, f);
  if (st.stage >= 2 && !g) woolStreaks(p, st);
  sheepShadow(p, st, st.stage === 1 ? STAGE1.shadow : st.stage === 2 ? STAGE2.shadow : STAGE3.shadow);
}

/** What is drawn over the sheep, on the effects' canvas: the speed streaks, and a gate's one bright ring. */
export function paintFront(p: Painter, st: SceneState): void {
  paintStreaks(p, st, st.stage * 6);
  const a = st.arch;
  if (a && a.since >= 0 && a.since < 500 && !st.reduced) {
    // One bright ring from the gate across the whole window: a 3 px line at 60%, fading to nothing over 500 ms.
    const k = a.since / 500;
    p.ring(a.x, st.lane - 110, Math.max(6, st.W * 0.9 * k), 3, TOKEN.lanternHi, 0.6 * (1 - k), 3);
  }
  p.done();
}

/** Where the hooves come down: a print every stride while the sheep is on the ground and running. At most 24. */
function remember(st: SceneState, m: SceneMemory): void {
  if (st.t < m.lastT) { m.prints = []; m.strideAt = 0; m.squish.clear(); m.isles = null; m.front = null; }
  m.lastT = st.t;
  if (st.stage === 1 && st.sheep.running && st.sheep.lift <= 0 && st.scroll - m.strideAt > 62) {
    m.strideAt = st.scroll;
    m.prints.push({ wx: st.scroll + st.sheep.x - st.sheep.w * 0.32, t: st.t }, { wx: st.scroll + st.sheep.x + st.sheep.w * 0.2, t: st.t });
    if (m.prints.length > 24) m.prints.splice(0, m.prints.length - 24);
  }
  if (m.prints.length && st.t - m.prints[0].t > 2000) m.prints = m.prints.filter((h) => st.t - h.t < 2000);
}
