import { fenceAt, FIELD, JUMP_MS, jumpHeight, speedAt, STUMBLE_MS, takeoffDistance } from '../../dream/dream';
import type { Fence } from '../../dream/dream';
import type { StageLive } from './DreamStage';
import { FIRST_FENCE_AHEAD } from './stage';

/**
 * The run (V4 Part 7.1): a fence queue of four, spawning at `SPAWN_X`, typing opening at `TYPE_X`, take-off at
 * `takeoffDistance`, the overlap test, a count on pass, a bump on overlap below `FH - 6`. With a `length` (the nightly
 * dream, V4 Part 15) a bump holds the sheep up and knocks the fence flat until the last one wakes the farmer, and
 * reaching the last fence puts him to sleep; without one (practice) the first bump ends it. Deterministic for a seed and the same input; the scene only reads `Live`, never writes it.
 */
const W = 320;
const { sheepX: SX, sheepW: SW, fenceW: FW, fenceH: FH } = FIELD;
/** Fences spawn just past the right edge and open for typing a whole gap ahead, so the speed sets the time to type. */
export const SPAWN_X = W + 24;
export const TYPE_X = W + 520;
export const MAX_TYPED = 16;

export interface LiveFence { f: Fence; index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; word: string; knockedAt: number | null }
export interface Live extends StageLive {
  fences: LiveFence[];
  next: number;
  typed: string;
  wrongUntil: number;
  say: string;
  count: number;
  longest: number;
  used: Set<string>;
  /** Fences reached, cleared or knocked flat. */
  reached: number;
  /** The positions of the bumps so far. */
  bumps: number[];
}

export function freshLive(seed: string): Live {
  const first = fenceAt(seed, 0);
  return {
    fences: [{ f: first, index: 0, x: SX + FIRST_FENCE_AHEAD, locked: false, passed: false, jumped: false, word: '', knockedAt: null }],
    next: 1, typed: '', wrongUntil: 0, say: '', count: 0, longest: 0, used: new Set(), speed: speedAt(0), dist: 0, jumpAt: null, t: 0, crashAt: null,
    reached: 0, bumps: [], stumbleUntil: 0, asleepAt: null,
  };
}

export interface RunEvents { jump?: () => void; count?: (n: number) => void; bump?: () => void; stumble?: (bumps: number) => void; asleep?: () => void }

/** Advances the run by `dt` ms. Returns true when the run is over: the last bump, or the farmer asleep. */
export function update(L: Live, dt: number, seed: string, on: RunEvents = {}, length: { fences: number; bumps: number } | null = null): boolean {
  if (L.crashAt !== null || L.asleepAt !== null) return true; // over: the ending fires once
  if (L.t < L.stumbleUntil) L.speed = 0;
  else L.speed += (speedAt(L.count) - L.speed) * Math.min(1, dt / 600);
  const dx = (L.speed * dt) / 1000;
  L.dist += dx;
  for (const fe of L.fences) fe.x -= dx;
  // Keep fences queued ahead: each one its gap in seconds behind the last, at the speed it will be met.
  while (L.fences.length < 4 && (!length || L.next < length.fences)) {
    const prev = L.fences[L.fences.length - 1];
    const f = fenceAt(seed, L.next++);
    L.fences.push({ f, index: f.index, x: Math.max(SPAWN_X, prev.x + f.gap), locked: false, passed: false, jumped: false, word: '', knockedAt: null });
  }
  // Jump the next finished fence when it reaches the take-off point (or at once if it was finished late).
  const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
  if (ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed)) {
    ahead.jumped = true;
    L.jumpAt = L.t;
    on.jump?.();
  }
  const airNow = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt);
  if (L.jumpAt !== null && L.t - L.jumpAt >= JUMP_MS) L.jumpAt = null;
  for (const fe of L.fences) {
    if (fe.passed) continue;
    const overlaps = fe.x < SX + SW - 3 && fe.x + FW > SX + 3;
    // A fence the sheep has taken off for cannot bump it: at a low frame rate it would otherwise touch before it rises,
    // and a right word would be punished.
    if (overlaps && !fe.jumped && airNow < FH - 6) {
      L.bumps.push(fe.index);
      L.jumpAt = null;
      if (!length || L.bumps.length >= length.bumps) {
        L.crashAt = L.t;
        on.bump?.();
        return true;
      }
      fe.passed = true;
      fe.knockedAt = L.t;
      L.reached++;
      L.stumbleUntil = L.t + STUMBLE_MS;
      on.stumble?.(L.bumps.length);
      continue;
    }
    if (fe.x + FW < SX) {
      fe.passed = true;
      L.reached++;
      L.count++;
      on.count?.(L.count);
    }
  }
  L.fences = L.fences.filter((fe) => fe.x > -60);
  if (length && L.reached >= length.fences) {
    L.asleepAt = L.t;
    on.asleep?.();
    return true;
  }
  return false;
}

/** The fence open for typing: the first unfinished one inside the type window. */
export function activeFence(L: Live): LiveFence | null {
  const a = L.fences.find((x) => !x.locked && !x.passed);
  return a && a.x < TYPE_X ? a : null;
}
