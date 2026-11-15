import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Array<{ method: string; path: string; body?: unknown }> = [];
let answers: Record<string, unknown | Error> = {};

vi.mock('../../auth/authStore', () => {
  class ApiError extends Error { constructor(public code: string, public status: number) { super(code); } }
  return {
    ApiError,
    api: async (method: string, path: string, _token: string | null, body?: unknown) => {
      calls.push({ method, path, body });
      const a = answers[`${method} ${path}`];
      if (a instanceof Error) throw a;
      return a ?? {};
    },
  };
});
vi.mock('../../auth/guest', () => ({ guestToken: (name: string) => `guest:test:${name}` }));

import { ApiError } from '../../auth/authStore';
import { loadLocalFriends } from '../../lib/guestFriends';
import { guestDisplayName, useGuestSocial } from '../guestSocial';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}
const inbox = (over: object = {}) => ({ code: 'MYCODE2345', requests: [], events: [], ...over });

describe('the guest friends store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    calls.length = 0;
    answers = {};
    useGuestSocial.setState({ friends: null, code: null, error: '', notice: '', name: 'Ann' });
  });

  it('shows your code, who asked, and who is online', async () => {
    localStorage.setItem('sap:guest-friends', JSON.stringify([{ code: 'FRIENDAAAA', name: 'Bo' }]));
    answers['GET /api/guest/friends'] = inbox({ requests: [{ code: 'ASKERBBBBB', name: 'Cy' }] });
    answers['POST /api/guest/friends/status'] = { friends: [{ code: 'FRIENDAAAA', online: true, name: 'Bo' }] };
    await useGuestSocial.getState().loadFriends();
    const s = useGuestSocial.getState();
    expect(s.code).toBe('MYCODE2345');
    expect(s.friends?.friends).toEqual([{ userId: 'FRIENDAAAA', name: 'Bo', online: true }]);
    expect(s.friends?.incoming).toEqual([{ userId: 'ASKERBBBBB', name: 'Cy', online: false }]);
  });

  it('keeps what the server reports in this browser, even if the next call fails', async () => {
    answers['GET /api/guest/friends'] = inbox({ events: [{ kind: 'accepted', code: 'NEWFRIEND2', name: 'Di', at: 1 }] });
    answers['POST /api/guest/friends/status'] = new ApiError('network', 0);
    await useGuestSocial.getState().loadFriends();
    expect(loadLocalFriends()).toEqual([{ code: 'NEWFRIEND2', name: 'Di' }]);
    expect(useGuestSocial.getState().error).toMatch(/Cannot reach/);
  });

  it('adds a friend when the other side had already asked', async () => {
    answers['POST /api/guest/friends/request'] = { state: 'accepted', friend: { code: 'THEYASKED2', name: 'Ed' } };
    answers['GET /api/guest/friends'] = inbox();
    await useGuestSocial.getState().request('theyasked2');
    expect(loadLocalFriends()).toEqual([{ code: 'THEYASKED2', name: 'Ed' }]);
    expect(useGuestSocial.getState().notice).toMatch(/friends now/);
  });

  it('says plainly when a request was sent, or the code is wrong', async () => {
    answers['POST /api/guest/friends/request'] = { state: 'sent' };
    answers['GET /api/guest/friends'] = inbox();
    await useGuestSocial.getState().request('ABCDEFGHJK');
    expect(useGuestSocial.getState().notice).toMatch(/Request sent/);
    answers['POST /api/guest/friends/request'] = new ApiError('bad_code', 400);
    await useGuestSocial.getState().request('nope');
    expect(useGuestSocial.getState().error).toMatch(/ten letters and numbers/);
  });

  it('accepting adds the friend; declining and removing use different calls', async () => {
    answers['POST /api/guest/friends/status'] = { friends: [] };
    answers['GET /api/guest/friends'] = inbox({ requests: [{ code: 'ASKERBBBBB', name: 'Cy' }] });
    await useGuestSocial.getState().loadFriends();
    answers['POST /api/guest/friends/accept'] = { friend: { code: 'ASKERBBBBB', name: 'Cy' } };
    await useGuestSocial.getState().accept('ASKERBBBBB');
    expect(loadLocalFriends()).toEqual([{ code: 'ASKERBBBBB', name: 'Cy' }]);

    answers['GET /api/guest/friends'] = inbox({ requests: [{ code: 'OTHERCCCCC', name: 'Fy' }] });
    await useGuestSocial.getState().loadFriends();
    calls.length = 0;
    await useGuestSocial.getState().remove('OTHERCCCCC');
    expect(calls.map((c) => c.path)).toContain('/api/guest/friends/decline');
    calls.length = 0;
    await useGuestSocial.getState().remove('ASKERBBBBB');
    expect(calls.map((c) => c.path)).toContain('/api/guest/friends/remove');
    expect(loadLocalFriends()).toEqual([]);
  });

  it('goes by the name on the plate, or Guest when it is blank or not allowed', () => {
    expect(guestDisplayName('  Maya ')).toBe('Maya');
    expect(guestDisplayName('')).toBe('Guest');
    expect(guestDisplayName('sh1t')).toBe('Guest');
  });
});
