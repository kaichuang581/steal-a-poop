// Quality tiers (plan file 17 change 15, file 02 changes 3 to 5). Every session opens on Medium; High is earned by
// measured frames on Home; Low is fallen to when Medium cannot keep up. A tier changes only in Home's dip or at a
// scene change, and never goes up and down in one session. `?gfx=low|medium|high` pins a tier.
import { useSyncExternalStore } from 'react';
import { PADDOCK_OLD_LIGHT } from '../look';

export type Tier = 'low' | 'medium' | 'high';

export const TIERS: readonly Tier[] = ['low', 'medium', 'high'];

/** localStorage key: the tier this device earned last time. It only lets High's detail start building early. */
export const GFX_KEY = 'sap:gfx';

const isTier = (v: unknown): v is Tier => v === 'low' || v === 'medium' || v === 'high';

/** The `?gfx=` pin, or null. */
export function pinnedTier(): Tier | null {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('gfx');
  return isTier(v) ? v : null;
}

/** The tier this device earned in an earlier session, or null. */
export function rememberedTier(): Tier | null {
  try {
    const v = localStorage.getItem(GFX_KEY);
    return isTier(v) ? v : null;
  } catch {
    return null;
  }
}

let current: Tier = pinnedTier() ?? 'medium';
/** The direction this session has moved, if any: a session never goes both ways. */
let moved: 'up' | 'down' | null = null;
const listeners = new Set<() => void>();

export const getTier = (): Tier => current;

export function subscribeTier(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The tier, re-rendering when it changes. */
export const useTier = (): Tier => useSyncExternalStore(subscribeTier, getTier, getTier);

/**
 * Moves to `next` if the session's rules allow it: never while pinned, never back the other way. The caller is
 * responsible for calling this only in Home's dip or at a scene change. Returns whether the tier changed.
 */
export function setTier(next: Tier): boolean {
  if (next === current || pinnedTier()) return false;
  const dir = TIERS.indexOf(next) > TIERS.indexOf(current) ? 'up' : 'down';
  if (moved && moved !== dir) return false;
  moved = dir;
  current = next;
  if (next === 'high' || next === 'low') {
    try {
      localStorage.setItem(GFX_KEY, next);
    } catch {
      /* private mode: nothing remembered */
    }
  }
  for (const fn of listeners) fn();
  return true;
}

/** Tests only. */
export function resetTierForTests(t: Tier = 'medium'): void {
  current = t;
  moved = null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The rules (milestone 4, the rendering part): measured in the scene's own frame loop (Rendering's TierWatch), told
// here as a proposal, and applied only where a change cannot be seen: Home's dip (Drift in FarmBackdrop) or a scene
// change (a scene canvas mounting).
// ---------------------------------------------------------------------------------------------------------------------

/** High: this long of steady Home frames, with the median frame at most HIGH_MEDIAN_X and the 95th percentile at most
 *  HIGH_P95_X times the governor's target interval, all of it at the canvas's full resolution. */
export const HIGH_STEADY_MS = 10_000;
export const HIGH_MEDIAN_X = 1.1;
export const HIGH_P95_X = 1.5;
/** Low: on Medium, already down to the lowest resolution, the median frame over LOW_MEDIAN_X times the target. */
export const LOW_MEDIAN_X = 1.5;
/** How much of the lowest resolution the Low rule looks at before it judges. */
export const LOW_WINDOW_MS = 5_000;
/** The failure card: on Low, under FAIL_FPS pictures a second for FAIL_MS running. */
export const FAIL_FPS = 10;
export const FAIL_MS = 10_000;
/** A gap longer than this between pictures is a hidden tab or a stall, not the device's pace: the count starts again. */
export const GAP_MS = 2_000;

/** One picture, as the judge sees it: how long since the last, against the governor's target, at which resolution. */
export interface FrameSample { ms: number; targetMs: number; atMax: boolean; atMin: boolean }

/** The value at `q` (0 to 1) of an already sorted list. */
const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

interface Run { ratios: number[]; ms: number[]; sum: number; judgedAt: number }
const run = (): Run => ({ ratios: [], ms: [], sum: 0, judgedAt: 0 });
const clear = (r: Run) => { r.ratios.length = 0; r.ms.length = 0; r.sum = 0; r.judgedAt = 0; };
/** Adds a frame and keeps the newest `span` ms (never less). */
function push(r: Run, s: FrameSample, span: number) {
  r.ratios.push(s.ms / s.targetMs);
  r.ms.push(s.ms);
  r.sum += s.ms;
  while (r.ms.length > 1 && r.sum - r.ms[0] >= span) { const m = r.ms.shift()!; r.sum -= m; r.judgedAt -= m; r.ratios.shift(); }
}
/** The run's ratios sorted, once it spans `span` ms and a second has passed since it was last judged; else null. */
function due(r: Run, span: number): number[] | null {
  if (r.sum < span || r.sum - r.judgedAt < 1000) return null;
  r.judgedAt = r.sum;
  return [...r.ratios].sort((a, b) => a - b);
}

/**
 * The tier rules, pure: fed every picture a scene draws (the frames to leave out, doors shut, a dip, the build, are the
 * caller's to leave out). Returns the tier the frames earn, or null. Only Medium moves: High and Low are kept for the
 * session.
 */
export function createTierJudge() {
  const steady = run(), slow = run();
  return {
    frame(s: FrameSample, tier: Tier): Tier | null {
      if (tier !== 'medium' || !(s.ms > 0) || !(s.targetMs > 0)) return null;
      if (s.ms > GAP_MS) { clear(steady); clear(slow); return null; }
      if (s.atMax) {
        push(steady, s, HIGH_STEADY_MS);
        const sorted = due(steady, HIGH_STEADY_MS);
        if (sorted && quantile(sorted, 0.5) <= HIGH_MEDIAN_X && quantile(sorted, 0.95) <= HIGH_P95_X) return 'high';
      } else clear(steady);
      if (s.atMin) {
        push(slow, s, LOW_WINDOW_MS);
        const sorted = due(slow, LOW_WINDOW_MS);
        if (sorted && quantile(sorted, 0.5) > LOW_MEDIAN_X) return 'low';
      } else clear(slow);
      return null;
    },
    reset() { clear(steady); clear(slow); },
  };
}

/** Counts how long Low has stayed under FAIL_FPS: true once it has for FAIL_MS. Looked at a second at a time. */
export function createSlowWatch() {
  let sum = 0, n = 0, slowFor = 0;
  return {
    frame(ms: number): boolean {
      if (!(ms > 0)) return false;
      if (ms > GAP_MS) { sum = 0; n = 0; slowFor = 0; return false; }
      sum += ms; n++;
      if (sum < 1000) return slowFor >= FAIL_MS;
      if ((n * 1000) / sum < FAIL_FPS) slowFor += sum; else slowFor = 0;
      sum = 0; n = 0;
      return slowFor >= FAIL_MS;
    },
  };
}

/** What the frames earned, waiting for a dip or a scene change. */
let pending: Tier | null = null;
/** The judge proposes; nothing on screen changes yet. */
export function proposeTier(t: Tier): void { if (t !== current) pending = t; }
export const pendingTier = (): Tier | null => pending;
/** In Home's dip or at a scene change: the proposed tier, if any, becomes the tier. Returns whether it changed. */
export function applyPendingTier(): boolean {
  if (!pending) return false;
  const t = pending;
  pending = null;
  return setTier(t);
}

/**
 * The wendigo's shot (the paddock, POV_SHOTS.desktop[2] and phone[2]): on every tier it is drawn with today's light,
 * fog, shadow map, bloom and tilt-shift (plan file 02, change 4). Set in the dip that enters it, cleared in the next.
 */
let exempt = false;
export const exemptShot = (): boolean => exempt;
export function setExemptShot(on: boolean): void { exempt = on; }
/** Whether this shot is drawn in the paddock's old light: the exempt shot, while look.ts's PADDOCK_OLD_LIGHT is on. */
export const oldLightShot = (): boolean => exempt && PADDOCK_OLD_LIGHT;

/** Tests only. */
export function resetTierRulesForTests(): void { pending = null; exempt = false; }
