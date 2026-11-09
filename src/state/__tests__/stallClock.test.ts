import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../../engine/game';
import { T0, dict } from '../../engine/__tests__/helpers';
import { createLocalClient } from '../gameClient';
import { STALL_MS, useStore } from '../store';

// Brian, 2026-11-09: "sometimes it skips my turn". A hidden tab, a covered window or a frozen page stops the frames;
// the clock must not run through that and spend the player's turn unseen.
let clock = 0;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(Date, 'now').mockImplementation(() => clock); // stalls are read on the wall clock
  const game = createGame({ seed: 'stall', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy' }, dict);
  useStore.setState({ client: createLocalClient(dict), game, mode: 'quick', mySeat: 0, paused: false, held: false, pausedRaw: 0, timeOffset: clock - T0, now: T0 });
  useStore.getState().quit(); // forget any earlier test's last frame
  useStore.setState({ game, mode: 'quick', timeOffset: clock - T0, now: T0 });
});
afterEach(() => vi.restoreAllMocks());

const step = (ms: number) => { clock += ms; useStore.getState().frame(clock); };

describe('a stall between frames', () => {
  it('runs on as normal from frame to frame', () => {
    step(0);
    for (let i = 0; i < 60; i++) step(16);
    expect(useStore.getState().now).toBe(T0 + 960);
  });

  it('does not run through a hidden tab or a frozen page', () => {
    step(0);
    step(16);
    step(20_000); // 20 s with no frames: the tab was hidden
    expect(useStore.getState().now).toBeLessThan(T0 + 16 + STALL_MS);
    // Nothing timed out unseen: no turn was charged.
    expect(useStore.getState().game!.history).toHaveLength(0);
    step(16);
    expect(useStore.getState().now).toBeLessThan(T0 + 16 + STALL_MS + 16);
  });

  it('lets an ordinary slow frame count', () => {
    step(0);
    step(STALL_MS - 50);
    expect(useStore.getState().now).toBe(T0 + STALL_MS - 50);
  });

  it('places a word typed straight after the stall after it, not at its end', () => {
    step(0);
    clock += 60_000;
    useStore.getState().act({ type: 'play', seat: 0, word: 'zzzz' });
    expect(useStore.getState().now).toBeLessThan(T0 + STALL_MS);
  });

  it('runs a sped-up game clock on, as the end-to-end test does (performance.now 20x, the wall clock real)', () => {
    let wall = 5_000;
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    step(0);
    for (let i = 0; i < 30; i++) { wall += 25; step(500); } // 25 ms frames read as 500 ms on the fast clock
    expect(useStore.getState().now).toBe(T0 + 15_000);
  });

  it('leaves a room on the server clock', () => {
    useStore.setState({ mode: 'room' });
    const before = useStore.getState().timeOffset;
    step(0);
    step(20_000);
    expect(useStore.getState().timeOffset).toBe(before);
  });
});
