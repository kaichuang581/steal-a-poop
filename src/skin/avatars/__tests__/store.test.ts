import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAvatar, setAvatar, useAvatar } from '../store';

const hook = vi.hoisted(() => ({
  getSnapshot: null as null | (() => unknown),
  subscribe: null as null | ((onChange: () => void) => () => void),
}));

// The test environment is node, with no DOM. Calling the real useSyncExternalStore would require a renderer, so this
// small stand-in records the subscribe/snapshot pair and returns the snapshot the hook would read.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useSyncExternalStore: ((subscribe: (onChange: () => void) => () => void, getSnapshot: () => unknown) => {
      hook.subscribe = subscribe;
      hook.getSnapshot = getSnapshot;
      return getSnapshot();
    }) as typeof actual.useSyncExternalStore,
  };
});

const KEY = 'sap:avatar';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function blockedStorage(): Storage {
  const blocked = () => {
    throw new Error('storage is blocked');
  };
  return {
    get length() {
      return 0;
    },
    clear: blocked,
    getItem: blocked,
    key: blocked,
    removeItem: blocked,
    setItem: blocked,
  };
}

beforeEach(() => {
  hook.getSnapshot = null;
  hook.subscribe = null;
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('avatar choice', () => {
  it('saves a chosen avatar and reads it back', () => {
    setAvatar('sheep');
    expect(localStorage.getItem(KEY)).toBe('sheep');
    expect(getAvatar()).toBe('sheep');
  });

  it('clears the saved avatar when the player goes back to the default sheep', () => {
    setAvatar('pig');
    setAvatar(null);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getAvatar()).toBeNull();
  });

  it('ignores an unknown id saved by something else', () => {
    localStorage.setItem(KEY, 'not-a-real-avatar');
    expect(getAvatar()).toBeNull();
    expect(useAvatar()).toBeNull();
  });

  it('reads the saved avatar through the hook and updates subscribers', () => {
    expect(useAvatar()).toBeNull();
    expect(hook.subscribe).not.toBeNull();

    const onChange = vi.fn();
    const unsubscribe = hook.subscribe!(onChange);
    setAvatar('goat');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hook.getSnapshot!()).toBe('goat');
    expect(useAvatar()).toBe('goat');
    unsubscribe();
  });

  it('survives local storage being blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(() => setAvatar('cow')).not.toThrow();
    expect(getAvatar()).toBeNull();
    expect(useAvatar()).toBeNull();
  });
});
