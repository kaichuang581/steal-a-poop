import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_FRIENDS_KEY, MAX_LOCAL_FRIENDS, applyEvents, loadLocalFriends, saveLocalFriends, withFriend, withoutFriend } from '../guestFriends';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('the guest friend list', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('survives a reload', () => {
    saveLocalFriends([{ code: 'AAAAAAAAAA', name: 'Ann' }]);
    expect(loadLocalFriends()).toEqual([{ code: 'AAAAAAAAAA', name: 'Ann' }]);
  });
  it('ignores a damaged list', () => {
    localStorage.setItem(GUEST_FRIENDS_KEY, '{"nope":1}');
    expect(loadLocalFriends()).toEqual([]);
    localStorage.setItem(GUEST_FRIENDS_KEY, JSON.stringify([{ code: 1 }, null, { code: 'B', name: 'Bo' }, { code: 'B', name: 'Dup' }]));
    expect(loadLocalFriends()).toEqual([{ code: 'B', name: 'Bo' }]);
  });
  it('adds a friend once and refreshes their name', () => {
    const one = withFriend([], { code: 'A', name: 'Ann' });
    expect(withFriend(one, { code: 'A', name: 'Annie' })).toEqual([{ code: 'A', name: 'Annie' }]);
    expect(withoutFriend(one, 'A')).toEqual([]);
  });
  it('stops growing at the limit', () => {
    const full = Array.from({ length: MAX_LOCAL_FRIENDS }, (_, i) => ({ code: `C${i}`, name: 'x' }));
    expect(withFriend(full, { code: 'NEW', name: 'y' })).toHaveLength(MAX_LOCAL_FRIENDS);
  });
  it('follows what the server reports, in order', () => {
    const list = applyEvents([{ code: 'A', name: 'Ann' }], [
      { kind: 'accepted', code: 'B', name: 'Bo' },
      { kind: 'removed', code: 'A', name: 'Ann' },
    ]);
    expect(list).toEqual([{ code: 'B', name: 'Bo' }]);
  });
});
