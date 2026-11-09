import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../../engine/game';
import { T0, dict } from '../../engine/__tests__/helpers';
import { createLocalClient } from '../gameClient';
import { useStore } from '../store';

// The loading screen's hold on a solo game's clock (PaintedApp holds it while the barn doors are shut over a new game).
let clock = 0;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  const game = createGame({ seed: 'hold', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy' }, dict);
  useStore.setState({ client: createLocalClient(dict), game, mode: 'quick', mySeat: 0, paused: false, held: false, pausedRaw: 0, timeOffset: clock - T0, now: T0 });
});
afterEach(() => vi.restoreAllMocks());

describe('holding the clock behind the loading screen', () => {
  it('stops the game while held and carries on from the same moment after', () => {
    const before = useStore.getState().game;
    useStore.getState().holdClock();
    clock += 5_000;
    useStore.getState().frame(clock);
    expect(useStore.getState().game).toBe(before);
    expect(useStore.getState().now).toBe(T0);
    useStore.getState().releaseClock();
    // The 5 s behind the doors never happened, as far as the game is concerned.
    clock += 100;
    useStore.getState().frame(clock);
    expect(useStore.getState().now).toBe(T0 + 100);
  });

  it('ignores moves while held', () => {
    useStore.getState().holdClock();
    expect(useStore.getState().act({ type: 'play', seat: 0, word: 'cat' })).toBeNull();
  });

  it('counts time once when the tutorial pause overlaps the hold', () => {
    useStore.getState().holdClock();
    clock += 1_000;
    useStore.getState().pause();
    clock += 1_000;
    useStore.getState().releaseClock(); // still paused: the clock stays stopped
    clock += 1_000;
    useStore.getState().resume();
    clock += 250;
    useStore.getState().frame(clock);
    expect(useStore.getState().now).toBe(T0 + 250);
  });

  it('does nothing in a room, where the server keeps time', () => {
    useStore.setState({ mode: 'room' });
    useStore.getState().holdClock();
    expect(useStore.getState().held).toBe(false);
  });

  it('a new game or leaving clears a hold', () => {
    useStore.getState().holdClock();
    useStore.getState().quit();
    expect(useStore.getState().held).toBe(false);
  });
});
