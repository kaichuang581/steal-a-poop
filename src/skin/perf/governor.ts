import { useEffect, useState, useSyncExternalStore } from 'react';

/*
 * The frame governor (docs/visual-overhaul/17-performance-and-stability.md, change 9): the same motion in fewer
 * pictures. A friend's laptop lost "35% of his battery in 5 min" to a game that drew as often as the screen could
 * refresh (134 pictures a second at 144 Hz), under panels that hid it, and in two canvases where one was seen.
 *
 * Every scene canvas (Rendering's AdaptiveCanvas) draws on demand, and one loop a canvas, timed by the screen, asks for
 * each picture: at most 60 a second (72 on a 144 Hz screen, which is every second refresh), fewer where a scene asks
 * for fewer, and none where nobody can see it. Each picture is still given the true time since the last, so nothing
 * moves faster or slower; only how often it is looked at changes.
 *
 * This file is the arithmetic (the pacer) and the page-side hooks that pick a scene's rate. The loop itself, which needs
 * the canvas, is Rendering's Governor.
 */

/** The most pictures a second on any screen (question 17): a screen at 100 Hz or more shows every Nth refresh. */
export const CAP_FPS = 60;
/** The farmer's bubble in Counting Sheep: a small picture of a man asleep. */
export const BUBBLE_FPS = 15;
/**
 * Home's farm at rest (question 18, not yet answered by Brian; the plan's default is yes): after HOME_IDLE_MS without a
 * touch, a key or the pointer, and behind an open dialog, the farm is drawn this many times a second. `null` turns the
 * rest off: the farm then always draws at the full rate.
 */
export const HOME_REST_FPS: number | null = 30;
export const HOME_IDLE_MS = 20_000;
/**
 * How long a cover has had its picture before what it covers stops drawing. The podium fades in over 600 ms and the
 * bedroom over 400 ms; until then the scene underneath still shows through.
 */
export const COVER_SETTLE_MS = 700;

// ---------------------------------------------------------------------------------------------------------------------
// The pacer (pure: the unit test steps it by hand)
// ---------------------------------------------------------------------------------------------------------------------

/** Every how many refreshes a picture is drawn at the full rate: 1 under 100 Hz, else round(Hz / 60). */
export const capStride = (hz: number): number => (hz < 100 ? 1 : Math.max(1, Math.round(hz / CAP_FPS)));
/** The same for a scene that asks for `fps` pictures a second (none asked: the full rate). Never under the cap's. */
export const strideFor = (hz: number, fps?: number): number => {
  const cap = capStride(hz);
  return fps === undefined || !(fps > 0) ? cap : Math.max(cap, Math.round(hz / fps));
};

/** How many gaps between refreshes one reading of the screen's rate takes: their middle one is the screen's. */
export const DISPLAY_SAMPLE = 30;
/**
 * No screen is believed slower than this. Refreshes arrive late when the page is busy (a scene going up, a slow
 * device), never early, so a middle gap longer than this is the load and not the screen: the rate known so far stands.
 * Without this a device drawing 10 pictures a second would be taken for a 10 Hz screen that is keeping up.
 */
const SLOWEST_SCREEN_HZ = 45;
const DEFAULT_MS = 1000 / 60;
/** A gap longer than this is a stall or a hidden tab, and says nothing about the screen. */
const STALL_MS = 250;
/** The last rate any canvas read: the next canvas starts from it instead of from 60 Hz. */
let knownMs = DEFAULT_MS;

export interface Pacer {
  /**
   * One refresh of the screen at `now` (requestAnimationFrame's time, ms). True when a picture is due. `fps` is what the
   * scene asks for: undefined is the full rate, 0 is none.
   */
  step(now: number, fps?: number): boolean;
  /** The next step is due whatever the count says (a scene coming out from under its cover). */
  wake(): void;
  /** Milliseconds between the screen's refreshes, as read so far. */
  readonly displayMs: number;
  /** Milliseconds between pictures at the rate last asked for, and at the full rate. */
  readonly targetMs: number;
  readonly capMs: number;
}

/**
 * Counts the screen's refreshes and says which ones get a picture. It counts by the clock, so a refresh the page missed
 * (a picture that took too long) still counts: a scene that cannot keep up is asked again at once, not a stride later.
 * The screen's rate is the middle of DISPLAY_SAMPLE gaps: read first at mount, and corrected only toward a faster
 * screen, which is the only way a reading can be wrong (see SLOWEST_SCREEN_HZ).
 */
export function createPacer(seedMs: number = knownMs): Pacer {
  let displayMs = seedMs, own = false;
  let last = 0, acc = 0, due = true;
  let targetMs = capStride(1000 / displayMs) * displayMs, capMs = targetMs;
  const gaps: number[] = [];
  const read = (gap: number) => {
    if (!(gap > 0) || gap > STALL_MS) return;
    gaps.push(gap);
    if (gaps.length < DISPLAY_SAMPLE) return;
    const mid = gaps.sort((a, b) => a - b)[DISPLAY_SAMPLE >> 1];
    gaps.length = 0;
    if (mid > 1000 / SLOWEST_SCREEN_HZ) return;
    // This canvas's first reading replaces what an earlier canvas left (the window may be on another screen now);
    // after that only a clearly faster one does, so a reading's own jitter never moves the target.
    if (own && mid > displayMs * 0.95) return;
    own = true;
    displayMs = knownMs = mid;
  };
  return {
    step(now, fps) {
      const gap = last ? now - last : 0;
      last = now;
      read(gap);
      const hz = 1000 / displayMs;
      capMs = capStride(hz) * displayMs;
      if (fps === 0) { acc = 0; due = true; return false; }
      targetMs = strideFor(hz, fps) * displayMs;
      if (due) { due = false; acc = 0; return true; }
      acc += gap;
      // Half a refresh of slack: a gap that arrives a little early still counts as the refresh it is.
      if (acc < targetMs - displayMs / 2) return false;
      // What is left over carries, up to one stride less a refresh, so a missed refresh is made up and never doubled.
      acc = Math.max(0, Math.min(acc - targetMs, targetMs - displayMs));
      return true;
    },
    wake() { due = true; },
    get displayMs() { return displayMs; },
    get targetMs() { return targetMs; },
    get capMs() { return capMs; },
  };
}

/** For tests: forget the screen's rate read by earlier pacers. */
export function forgetDisplay(): void { knownMs = DEFAULT_MS; }

/**
 * What a canvas and its governor share: the page side writes the rate the scene asks for, the loop writes back what
 * that comes to on this screen (the resolution judge reads it), and `wake` draws a picture at once when a rate of 0
 * ends, so a scene never shows a stale picture as its cover lifts.
 */
export interface Pace {
  fps: number | undefined;
  targetMs: number;
  capMs: number;
  wake: (() => void) | null;
}
export const newPace = (fps?: number): Pace => ({ fps, targetMs: DEFAULT_MS, capMs: DEFAULT_MS, wake: null });

// ---------------------------------------------------------------------------------------------------------------------
// Which scenes have drawn (a cover may only stop what it covers once its own picture is up)
// ---------------------------------------------------------------------------------------------------------------------

const drawn = new Set<string>();
const watchers = new Set<() => void>();
/** A scene's canvas got, or lost, its `data-drawn` mark. Told by the canvas's governor; `scene` is its memory name. */
export function noteSceneDrawn(scene: string | undefined, on: boolean): void {
  if (!scene || drawn.has(scene) === on) return;
  if (on) drawn.add(scene); else drawn.delete(scene);
  for (const w of [...watchers]) w();
}
const watch = (fn: () => void) => { watchers.add(fn); return () => { watchers.delete(fn); }; };
/** Whether the named scene has drawn its first pictures and is still on the page. */
export function useSceneDrawn(scene: string): boolean {
  return useSyncExternalStore(watch, () => drawn.has(scene), () => false);
}

// ---------------------------------------------------------------------------------------------------------------------
// The rates the screens ask for
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The rate for a scene that another scene covers whole (the table under the podium, the dream under the bedroom): 0
 * once `covered` is so, the cover `by` has drawn, and its fade-in is over; undefined (the full rate) otherwise, and at
 * once when the cover goes.
 */
export function useCoveredFps(covered: boolean, by: string): 0 | undefined {
  const up = useSceneDrawn(by) && covered;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!up) { setSettled(false); return; }
    const id = setTimeout(() => setSettled(true), COVER_SETTLE_MS);
    return () => clearTimeout(id);
  }, [up]);
  return up && settled ? 0 : undefined;
}

/** True once the page has gone `ms` without a touch, a key, the wheel or the pointer; false again at the first one. */
function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!(ms > 0)) return;
    let last = performance.now(), timer = 0, resting = false;
    // One timer, set again only when it runs out: a moving pointer costs a time stamp, not a timer a move.
    const check = () => {
      const left = ms - (performance.now() - last);
      if (left > 0) { timer = window.setTimeout(check, left); return; }
      resting = true;
      setIdle(true);
    };
    const stir = () => {
      last = performance.now();
      if (!resting) return;
      resting = false;
      setIdle(false);
      timer = window.setTimeout(check, ms);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, stir, { passive: true, capture: true });
    timer = window.setTimeout(check, ms);
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, stir, { capture: true });
    };
  }, [ms]);
  return idle;
}

/** Home's farm: HOME_REST_FPS behind an open dialog and after HOME_IDLE_MS left alone; the full rate otherwise. */
export function useHomeFps(behindDialog: boolean): number | undefined {
  const idle = useIdle(HOME_REST_FPS === null ? 0 : HOME_IDLE_MS);
  return HOME_REST_FPS !== null && (behindDialog || idle) ? HOME_REST_FPS : undefined;
}
