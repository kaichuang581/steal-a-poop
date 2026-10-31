/** Sliding-window limiter: at most `max` events per `windowMs` for each key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Records the event and returns true if it is allowed. A refused event is not recorded. */
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Milliseconds until the next event would be allowed (0 if allowed now). */
  retryAfter(key: string, now: number): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length < this.max) return 0;
    return Math.max(0, recent[0] + this.windowMs - now);
  }
}
