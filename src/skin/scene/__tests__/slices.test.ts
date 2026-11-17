import { describe, expect, it, vi } from 'vitest';
import { each, finish, queueBuild, rush, SLICE_MS } from '../slices';
import type { Steps } from '../slices';

function* count(n: number, log: number[], part?: string): Steps<number, string> {
  for (let i = 0; i < n; i++) {
    log.push(i);
    if (part && i === 1) yield part;
    else yield;
  }
  return n;
}

describe('the build in slices', () => {
  it('finish runs a builder straight through, as the tools do', () => {
    const log: number[] = [];
    expect(finish(count(4, log))).toBe(4);
    expect(log).toEqual([0, 1, 2, 3]);
    expect(finish(each([1, 2, 3], (x) => x * 2))).toEqual([2, 4, 6]);
  });

  it('builds in timer tasks, one builder after another, hands parts over and gives the page back', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const order: string[] = [];
      const around = vi.fn();
      const parts: string[] = [];
      queueBuild(count(3, []), (v) => order.push(`a${v}`), { around });
      queueBuild(count(2, [], 'half'), (v) => order.push(`b${v}`), { part: (p) => parts.push(p) });
      expect(order).toEqual([]); // nothing in the task that asked
      await vi.runAllTimersAsync();
      expect(order).toEqual(['a3', 'b2']);
      expect(parts).toEqual(['half']);
      expect(around).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('a slice stops once SLICE_MS have gone', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let steps = 0;
      function* slow(): Steps<void> { for (let i = 0; i < 10; i++) { const t = performance.now(); while (performance.now() - t < SLICE_MS / 2) { /* work */ } steps++; yield; } }
      queueBuild(slow(), () => {});
      vi.advanceTimersToNextTimer();
      expect(steps).toBeGreaterThan(0);
      expect(steps).toBeLessThan(10);
    } finally { vi.runAllTimers(); vi.useRealTimers(); }
  });

  it('rush finishes a queued build at once, with what was queued before it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const order: string[] = [];
      queueBuild(count(2, []), () => order.push('first'));
      const second = count(5, []);
      queueBuild(second, () => order.push('second'));
      rush(second);
      expect(order).toEqual(['first', 'second']);
      rush(second); // already built: nothing happens
      expect(order).toEqual(['first', 'second']);
    } finally { vi.runAllTimers(); vi.useRealTimers(); }
  });
});
