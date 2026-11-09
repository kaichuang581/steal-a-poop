/** Sliding-window limiter: at most `max` events per `windowMs` for each key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private calls = 0;

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Records the event and returns true if it is allowed. A refused event is not recorded. */
  allow(key: string, now: number): boolean {
    // Every so often, forget keys with nothing recent. Limiters keyed by address would otherwise keep one entry for
    // every address that ever called, and a caller rotating addresses could grow the server's memory without end.
    if (++this.calls % 1000 === 0) this.prune(now);
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

  /** Forgets keys with no recent events, so a long-running server does not collect one entry per player ever seen. */
  prune(now: number): void {
    for (const [key, times] of this.hits) if (!times.some((t) => now - t < this.windowMs)) this.hits.delete(key);
  }

  get size(): number {
    return this.hits.size;
  }
}
