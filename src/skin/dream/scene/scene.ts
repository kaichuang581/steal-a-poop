import { moonAt, paintMoon, paintSky, paintStars, paintStreaks, sheepShadow, skyOf, starsOf } from './common';
import type { Painter } from './painter';
import { STAGE_COLOURS } from './palette';
import { paintObstacles1, paintStage1, STAGE1 } from './stage1';
import type { SceneMemory, SceneState } from './types';

/**
 * The dream's scenery for one frame (docs/dream/03 to 05), back to front: the sky, the stars, your words, the moon,
 * the stage's own world, the lane and what stands on it. `words` draws the star words in their place in that order.
 * Drawn only: it is given the frame's state and changes nothing but its own memory of where the hooves came down.
 */
export function paintScene(p: Painter, st: SceneState, m: SceneMemory, words: () => void): void {
  remember(st, m);
  const sky = skyOf(st.stage);
  paintSky(p, st, sky);
  paintStars(p, st, starsOf(st, st.phone ? 70 : 160));
  p.done();
  words();
  paintMoon(p, st, moonAt(st), STAGE_COLOURS[st.stage].sky[1]);
  paintStage1(p, st, m);
  paintObstacles1(p, st);
  sheepShadow(p, st, STAGE1.shadow);
  p.done();
}
/** What is drawn over the sheep, on the effects' canvas: the speed streaks. */
export function paintFront(p: Painter, st: SceneState): void {
  paintStreaks(p, st, 6);
  p.done();
}

/** Where the hooves come down: a print every stride while the sheep is on the ground and running. At most 24. */
function remember(st: SceneState, m: SceneMemory): void {
  if (st.t < m.lastT) { m.prints = []; m.strideAt = 0; m.squish.clear(); }
  m.lastT = st.t;
  if (st.sheep.running && st.sheep.lift <= 0 && st.scroll - m.strideAt > 62) {
    m.strideAt = st.scroll;
    m.prints.push({ wx: st.scroll + st.sheep.x - st.sheep.w * 0.32, t: st.t }, { wx: st.scroll + st.sheep.x + st.sheep.w * 0.2, t: st.t });
    if (m.prints.length > 24) m.prints.splice(0, m.prints.length - 24);
  }
  if (m.prints.length && st.t - m.prints[0].t > 2000) m.prints = m.prints.filter((h) => st.t - h.t < 2000);
}
