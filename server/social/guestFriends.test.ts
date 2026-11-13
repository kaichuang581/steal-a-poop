import { describe, expect, it } from 'vitest';
import { GuestFriends, KEEP_MS, MAX_PENDING_PER_CODE, normalizeCode } from './guestFriends';

const A = { userId: 'guest:aaaaaaaa-0000-4000-8000-000000000001', name: 'Ann' };
const B = { userId: 'guest:bbbbbbbb-0000-4000-8000-000000000002', name: 'Bo' };

function make() {
  let t = 1_000_000;
  const friends = new GuestFriends({ secret: 's', now: () => t });
  return { friends, advance: (ms: number) => { t += ms; }, a: friends.codeFor(A.userId), b: friends.codeFor(B.userId) };
}

describe('guest friend codes', () => {
  it('are stable, ten characters, and differ per guest and per secret', () => {
    const { friends, a, b } = make();
    expect(a).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(friends.codeFor(A.userId)).toBe(a);
    expect(a).not.toBe(b);
    expect(new GuestFriends({ secret: 'other' }).codeFor(A.userId)).not.toBe(a);
  });
  it('read typed codes without caring about case, spaces or dashes', () => {
    const { a } = make();
    expect(normalizeCode(` ${a.slice(0, 5).toLowerCase()}-${a.slice(5)} `)).toBe(a);
    expect(normalizeCode('too short')).toBeNull();
    expect(normalizeCode('0000000000')).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });
});

describe('guest friend requests', () => {
  it('waits in the other guest\'s inbox with the sender\'s name', () => {
    const { friends, a, b } = make();
    expect(friends.request(A, b)).toEqual({ ok: true, state: 'sent' });
    expect(friends.inbox(B.userId).requests).toEqual([{ code: a, name: 'Ann' }]);
    expect(friends.inbox(A.userId).requests).toEqual([]);
  });
  it('refuses your own code and anything that is not a code', () => {
    const { friends, a } = make();
    expect(friends.request(A, a)).toEqual({ ok: false, reason: 'self' });
    expect(friends.request(A, 'nope')).toEqual({ ok: false, reason: 'bad_code' });
  });
  it('asking again changes nothing, and asking back makes friends at once', () => {
    const { friends, a, b } = make();
    friends.request(A, b);
    friends.request(A, b);
    expect(friends.inbox(B.userId).requests).toHaveLength(1);
    expect(friends.request(B, a)).toEqual({ ok: true, state: 'accepted', friend: { code: a, name: 'Ann' } });
    expect(friends.inbox(B.userId).requests).toEqual([]);
    expect(friends.inbox(A.userId).events).toEqual([expect.objectContaining({ kind: 'accepted', code: b, name: 'Bo' })]);
  });
  it('accepting tells the asker once, and only works for a waiting request', () => {
    const { friends, a, b } = make();
    expect(friends.accept(B, a)).toBeNull();
    friends.request(A, b);
    expect(friends.accept(B, a)).toEqual({ code: a, name: 'Ann' });
    expect(friends.accept(B, a)).toBeNull();
    expect(friends.inbox(A.userId).events).toEqual([expect.objectContaining({ kind: 'accepted', code: b, name: 'Bo' })]);
    expect(friends.inbox(A.userId).events).toEqual([]);
  });
  it('declining says nothing to the asker', () => {
    const { friends, a, b } = make();
    friends.request(A, b);
    friends.decline(B.userId, a);
    expect(friends.inbox(B.userId).requests).toEqual([]);
    expect(friends.inbox(A.userId).events).toEqual([]);
  });
  it('removing a friend tells the other browser, and cancels any waiting request', () => {
    const { friends, a, b } = make();
    friends.request(A, b);
    friends.remove(A, b);
    const inbox = friends.inbox(B.userId);
    expect(inbox.requests).toEqual([]);
    expect(inbox.events).toEqual([expect.objectContaining({ kind: 'removed', code: a })]);
  });
  it('holds only so many requests for one guest', () => {
    const { friends, b } = make();
    for (let i = 0; i < MAX_PENDING_PER_CODE; i++) {
      expect(friends.request({ userId: `guest:${i}`, name: `G${i}` }, b)).toEqual({ ok: true, state: 'sent' });
    }
    expect(friends.request({ userId: 'guest:extra', name: 'X' }, b)).toEqual({ ok: false, reason: 'limit' });
  });
  it('forgets requests and news after two weeks', () => {
    const { friends, advance, b } = make();
    friends.request(A, b);
    advance(KEEP_MS + 120_000);
    expect(friends.inbox(B.userId).requests).toEqual([]);
  });
});

describe('guest friend presence', () => {
  it('says who is connected, and their current name', () => {
    const { friends, a, b } = make();
    expect(friends.status([a, b], [{ userId: B.userId, name: 'Bo2' }])).toEqual([{ code: a, online: false }, { code: b, online: true, name: 'Bo2' }]);
    expect(friends.status('nope', [])).toEqual([]);
  });
});
