import { fenceAt, FIELD, JUMP_MS, jumpHeight, speedAt, takeoffDistance } from '../../dream/dream';
import type { Fence } from '../../dream/dream';
import type { StageLive } from './DreamStage';
import { FIRST_FENCE_AHEAD } from './stage';

/**
 * The run (V4 Part 7.1): the canvas version's `Live` and its `update`, kept exactly. A fence queue of four, spawning at
 * `SPAWN_X`, typing opening at `TYPE_X`, take-off at `takeoffDistance`, the overlap test, a count on pass, a bump on
 * overlap below `FH - 6`. Deterministic for a seed and the same input; the scene only reads `Live`, never writes it.
 */
const W = 320;
const { sheepX: SX, sheepW: SW, fenceW: FW, fenceH: FH } = FIELD;
/** Fences spawn just past the right edge and open for typing a little before they enter the frame. */
export const SPAWN_X = W + 24;
export const TYPE_X = W + 70;
export const MAX_TYPED = 16;

export interface LiveFence { f: Fence; index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; word: string }
export interface Live extends StageLive {
  fences: LiveFence[];
  next: number;
  typed: string;
  wrongUntil: number;
  say: string;
  count: number;
  longest: number;
  used: Set<string>;
}

export function freshLive(seed: string): Live {
  const first = fenceAt(seed, 0);
  return {
    fences: [{ f: first, index: 0, x: SX + FIRST_FENCE_AHEAD, locked: false, passed: false, jumped: false, word: '' }],
    next: 1, typed: '', wrongUntil: 0, say: '', count: 0, longest: 0, used: new Set(), speed: speedAt(0), dist: 0, jumpAt: null, t: 0, crashAt: null,
  };
}

export interface RunEvents { jump?: () => void; count?: (n: number) => void; bump?: () => void }

/** Advances the run by `dt` ms. Returns true on the bump (the run is over). */
export function update(L: Live, dt: number, seed: string, on: RunEvents = {}): boolean {
  if (L.crashAt !== null) return true; // over: the bump fires once
  const target = speedAt(L.count);
  L.speed += (target - L.speed) * Math.min(1, dt / 600);
  const dx = (L.speed * dt) / 1000;
  L.dist += dx;
  for (const fe of L.fences) fe.x -= dx;
  // Keep fences queued ahead: each one its gap in seconds behind the last, at the speed it will be met.
  while (L.fences.length < 4) {
    const prev = L.fences[L.fences.length - 1];
    const f = fenceAt(seed, L.next++);
    L.fences.push({ f, index: f.index, x: Math.max(SPAWN_X, prev.x + f.gap * speedAt(f.index)), locked: false, passed: false, jumped: false, word: '' });
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
    if (overlaps && airNow < FH - 6) {
      L.crashAt = L.t;
      L.jumpAt = null;
      on.bump?.();
      return true;
    }
    if (fe.x + FW < SX) {
      fe.passed = true;
      L.count++;
      on.count?.(L.count);
    }
  }
  L.fences = L.fences.filter((fe) => fe.x > -60);
  return false;
}

/** The fence open for typing: the first unfinished one inside the type window. */
export function activeFence(L: Live): LiveFence | null {
  const a = L.fences.find((x) => !x.locked && !x.passed);
  return a && a.x < TYPE_X ? a : null;
}
