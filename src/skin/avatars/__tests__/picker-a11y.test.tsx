import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarPicker } from '../AvatarPicker';

const hooks = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
}));

// The test environment is node, with no renderer or DOM. This stand-in keeps the hook calls working, lets the test
// supply a small fake dialog, and runs the effect so the picker's focus and listener setup can be checked.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: ((initial: unknown) => {
      const ref = { current: initial };
      hooks.refs.push(ref);
      return ref;
    }) as typeof actual.useRef,
    useEffect: ((effect: () => void | (() => void)) => {
      hooks.effects.push(effect);
    }) as typeof actual.useEffect,
    useSyncExternalStore: ((_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()) as typeof actual.useSyncExternalStore,
  };
});

type FakeElement = HTMLElement & {
  focus: ReturnType<typeof vi.fn>;
  contains: (node: unknown) => boolean;
  querySelectorAll: ReturnType<typeof vi.fn>;
};

function fakeElement(children: FakeElement[] = []): FakeElement {
  const element = {
    focus: vi.fn(),
    isConnected: true,
    contains: (node: unknown) => node === element || children.includes(node as FakeElement),
    querySelectorAll: vi.fn(() => children),
  };
  return element as unknown as FakeElement;
}

const keyListeners = new Map<string, (event: KeyboardEvent) => void>();

function stubDom(active: HTMLElement | null, avatarButton: HTMLElement | null = null) {
  vi.stubGlobal('document', {
    activeElement: active,
    body: {},
    querySelector: vi.fn(() => avatarButton),
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn((type: string, listener: (event: KeyboardEvent) => void) => keyListeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => keyListeners.delete(type)),
  });
}

function mount(onClose = vi.fn()) {
  hooks.refs.length = 0;
  hooks.effects.length = 0;
  keyListeners.clear();
  const tree = AvatarPicker({ onClose });
  const dialog = fakeElement();
  hooks.refs[0].current = dialog;
  const cleanups = hooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  return { tree, dialog, cleanups, onClose };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  stubDom(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AvatarPicker keyboard and focus', () => {
  it('moves focus into the dialog on open and returns it to the opener on close', () => {
    const opener = fakeElement();
    stubDom(opener);
    const { dialog, cleanups, onClose } = mount();

    expect(dialog.focus).toHaveBeenCalledWith({ preventScroll: true });

    keyListeners.get('keydown')?.({ key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanups.forEach((cleanup) => cleanup());
    expect(opener.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('returns focus to the Avatar button when the original opener is gone', () => {
    const opener = fakeElement();
    (opener as unknown as { isConnected: boolean }).isConnected = false;
    const avatarButton = fakeElement();
    stubDom(opener, avatarButton);
    const { cleanups } = mount();

    cleanups.forEach((cleanup) => cleanup());
    expect(avatarButton.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    const first = fakeElement();
    const last = fakeElement();
    const outside = fakeElement();
    const opener = fakeElement();
    stubDom(opener);
    const { tree, dialog } = mount();
    dialog.querySelectorAll.mockReturnValue([first, last]);

    const tab = (shiftKey: boolean) => {
      const preventDefault = vi.fn();
      tree.props.onKeyDown({ key: 'Tab', shiftKey, preventDefault });
      return preventDefault;
    };

    (document as unknown as { activeElement: unknown }).activeElement = last;
    expect(tab(false)).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });

    (document as unknown as { activeElement: unknown }).activeElement = first;
    expect(tab(true)).toHaveBeenCalled();
    expect(last.focus).toHaveBeenCalledWith({ preventScroll: true });

    (document as unknown as { activeElement: unknown }).activeElement = outside;
    expect(tab(false)).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalledTimes(2);
  });
});
