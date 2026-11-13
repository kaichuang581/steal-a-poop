import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guestToken } from '../guest';

/** A plain in-memory localStorage: the suite runs in Node, which has none. */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

describe('guestToken', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('keeps one id per browser and sends the typed name', () => {
    const a = guestToken('Maya');
    const b = guestToken('Maya');
    expect(a).toBe(b);
    expect(a).toMatch(/^guest:[0-9a-f-]{36}:Maya$/);
  });

  it('encodes the name so colons cannot break the token', () => {
    expect(guestToken('a:b')).toMatch(/:a%3Ab$/);
  });

  it('gives a new browser a new id', () => {
    const first = guestToken('Maya');
    vi.stubGlobal('localStorage', memoryStorage());
    expect(guestToken('Maya')).not.toBe(first);
  });
});
