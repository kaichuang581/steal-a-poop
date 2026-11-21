/**
 * What counts as progress on the loading screen (docs/landing/LANDING-PLAN.md 3.6). Pure, no imports.
 *
 *   before the code arrives   0      (the page's own copy)
 *   the code is running       0.10   (the screen has mounted)
 *   the farm builds           0.10 + 0.78 x min(1, steps / expected)
 *   the scene draws           0.88 to 0.97 over 1.2 s, from when the build finished
 *   ready                     1
 *
 * When the target has not risen for 1.5 s it creeps by 0.01 every 1.5 s, never past its stage's end less 0.01. The
 * value shown chases the target at most 0.9 a second (2.5 once ready), never goes backwards and never reaches 1
 * before ready.
 */
export const CODE_IN = 0.10;
export const BUILD_SHARE = 0.78;
export const DRAW_FROM = 0.88;
export const DRAW_TO = 0.97;
export const DRAW_MS = 1200;
export const CREEP_MS = 1500;
export const CREEP_STEP = 0.01;
export const CHASE = 0.9;
export const CHASE_READY = 2.5;

export interface Progress {
  /** Where the value is heading. */
  target: number;
  /** The value shown, p. */
  shown: number;
  /** When the target last rose (ms). */
  rose: number;
  /** When the build finished (ms), or null while it goes on. */
  builtAt: number | null;
}

export const startProgress = (now: number, from = CODE_IN): Progress => ({ target: Math.max(from, CODE_IN), shown: from, rose: now, builtAt: null });

export interface Now {
  now: number;
  /** ms since the last step. */
  dt: number;
  /** Still building: the steps taken over the steps expected, or null for a screen built in one go. */
  building: number | null | false;
  ready: boolean;
}

/** One frame on: the new target and the new p. `building` false means the build is done and the scene is drawing. */
export function stepProgress(p: Progress, n: Now): Progress {
  let { target, rose, builtAt } = p;
  let raw: number, cap: number;
  if (n.ready) { raw = 1; cap = 1; }
  else if (n.building !== false) { raw = CODE_IN + BUILD_SHARE * Math.min(1, Math.max(0, n.building ?? 0)); cap = DRAW_FROM - CREEP_STEP; }
  else { builtAt ??= n.now; raw = DRAW_FROM + (DRAW_TO - DRAW_FROM) * Math.min(1, (n.now - builtAt) / DRAW_MS); cap = DRAW_TO - CREEP_STEP; }
  if (raw > target + 1e-9) { target = raw; rose = n.now; }
  else if (!n.ready && n.now - rose >= CREEP_MS && target < cap) { target = Math.min(cap, target + CREEP_STEP); rose = n.now; }
  const rate = n.ready ? CHASE_READY : CHASE;
  let shown = Math.max(p.shown, Math.min(target, p.shown + (rate * Math.max(0, n.dt)) / 1000));
  if (!n.ready) shown = Math.min(shown, DRAW_TO);
  return { target, shown, rose, builtAt };
}

/** The steps a load is expected to take, from what the device remembers (`sap:boot-steps`, `sap:load-steps`): a
 *  stored number above 0 under `key`, else `fallback`. A broken or missing record is the fallback. */
export function expectedSteps(stored: string | null, key: string, fallback: number | null): number | null {
  try {
    const v = (JSON.parse(stored ?? 'null') as Record<string, unknown> | null)?.[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
  } catch { return fallback; }
}

/** The record with `key` set to `steps`, as text to store. A broken record is started again. */
export function withSteps(stored: string | null, key: string, steps: number): string {
  let o: Record<string, unknown> = {};
  try { const v = JSON.parse(stored ?? '{}') as unknown; if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>; } catch { /* started again */ }
  return JSON.stringify({ ...o, [key]: steps });
}
