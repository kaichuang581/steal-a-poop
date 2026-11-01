/**
 * Fairness for steals when players have different connection speeds.
 *
 * The default ("arrival") is unchanged: whichever steal reaches the server first wins. That favours
 * whoever has the faster connection, not whoever pressed first.
 *
 * The optional "compensated" rule holds steals for a short moment and orders them by when each player
 * probably pressed STEAL: arrival time minus half their round-trip time, using the smallest round trip
 * seen recently (the smallest is the least affected by one-off delays). The correction is capped, so
 * nobody can claim more than `maxCompensationMs` of head start.
 *
 * Cheating risk, in short: a client controls how fast it answers pings, so it can make its round trip
 * look worse than it is and earn up to the cap in head start. The cap bounds the damage; it does not
 * remove it. See docs/SERVER.md before turning this on for anything competitive.
 */

export type StealOrdering = 'arrival' | 'compensated';

export interface StealOptions {
  /** Default 'arrival'. */
  ordering?: StealOrdering;
  /** How long steals are collected before they are ordered. Default 250 ms: it must exceed the cap so slow senders are included. */
  bufferMs?: number;
  /** The most a steal's time can be moved earlier. Default 150 ms. */
  maxCompensationMs?: number;
  /** How many recent round-trip samples the minimum is taken over. Default 8. */
  rttWindow?: number;
  /** For tests: report a fixed round trip for a player instead of the measured one. */
  rttOverride?: (userId: string) => number | undefined;
}

export const DEFAULT_BUFFER_MS = 250;
export const DEFAULT_MAX_COMPENSATION_MS = 150;
export const DEFAULT_RTT_WINDOW = 8;

/** Rolling record of ping round trips per player. */
export class RttTracker {
  private samples = new Map<string, number[]>();
  constructor(private window = DEFAULT_RTT_WINDOW) {}

  record(userId: string, rttMs: number): void {
    if (!Number.isFinite(rttMs) || rttMs < 0) return;
    const list = this.samples.get(userId) ?? [];
    list.push(rttMs);
    if (list.length > this.window) list.shift();
    this.samples.set(userId, list);
  }

  /** The smallest recent round trip, or undefined before any ping has been answered. */
  minRtt(userId: string): number | undefined {
    const list = this.samples.get(userId);
    return list?.length ? Math.min(...list) : undefined;
  }

  forget(userId: string): void {
    this.samples.delete(userId);
  }
}

/** Estimated moment the player pressed the button: arrival minus half the round trip, capped. */
export function estimatedSendTime(arrivalAt: number, minRttMs: number | undefined, maxCompensationMs = DEFAULT_MAX_COMPENSATION_MS): number {
  if (minRttMs === undefined) return arrivalAt;
  const oneWay = Math.max(0, minRttMs) / 2;
  return arrivalAt - Math.min(oneWay, Math.max(0, maxCompensationMs));
}

export interface PendingAction<A = unknown> {
  userId: string;
  action: A;
  arrivalAt: number;
  estSendAt: number;
}

/** Earliest estimated press first; ties go to whoever arrived first. */
export function orderPending<A>(entries: readonly PendingAction<A>[]): PendingAction<A>[] {
  return [...entries].sort((a, b) => a.estSendAt - b.estSendAt || a.arrivalAt - b.arrivalAt);
}
