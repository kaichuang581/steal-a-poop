import { create } from 'zustand';
import { ApiError, api } from '../auth/authStore';
import { guestToken } from '../auth/guest';
import { applyEvents, loadLocalFriends, saveLocalFriends, withFriend, withoutFriend } from '../lib/guestFriends';
import type { FriendEvent, LocalFriend } from '../lib/guestFriends';
import { checkNickname } from '../lib/nickname';
import type { FriendsView } from './socialStore';

/** What the Friends tab needs from a store: the account store and this guest one both fit. */
export interface FriendsStore {
  friends: FriendsView | null;
  code: string | null;
  error: string;
  notice: string;
  loadFriends(): Promise<void>;
  loadCode(): Promise<void>;
  /** Accounts can swap their code for a new one; a guest's code comes from their id and stays. */
  resetCode?(): Promise<void>;
  request(code: string): Promise<void>;
  accept(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

interface GuestSocialState extends FriendsStore {
  reload(): Promise<void>;
  /** The name friends will see, taken from the name plate. */
  name: string;
  setName(raw: string): void;
}

interface Inbox { code: string; requests: Array<{ code: string; name: string }>; events: FriendEvent[] }
interface Presence { friends: Array<{ code: string; online: boolean; name?: string }> }

/** The name a guest goes by: what is on the name plate if it passes the name check, otherwise "Guest". */
export function guestDisplayName(raw: string): string {
  const n = checkNickname(raw);
  return n.ok && n.name ? n.name : 'Guest';
}

export function describeGuestError(code: string): string {
  switch (code) {
    case 'bad_code': return 'That is not a friend code. Codes are ten letters and numbers.';
    case 'self': return 'That is your own code.';
    case 'limit': return 'That player has too many requests waiting. Try again later.';
    case 'rate_limited': return 'Too many tries. Wait a moment.';
    case 'not_found': return 'That request is gone.';
    case 'network': case 'no_server': return 'Cannot reach the game server.';
    default: return 'Something went wrong. Please try again.';
  }
}

const view = (list: LocalFriend[], online: ReadonlySet<string>, incoming: Array<{ code: string; name: string }>): FriendsView => ({
  friends: list.map((f) => ({ userId: f.code, name: f.name, online: online.has(f.code) })),
  incoming: incoming.filter((q) => !list.some((f) => f.code === q.code)).map((q) => ({ userId: q.code, name: q.name, online: false })),
  outgoing: [],
});

export const useGuestSocial = create<GuestSocialState>((set, get) => {
  let inflight: Promise<void> | null = null;
  const call = <T,>(method: 'GET' | 'POST', path: string, body?: unknown) => api<T>(method, path, guestToken(get().name), body);
  /** Runs a request; shows plain words instead of throwing into the screen. */
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    set({ error: '' });
    try {
      return await fn();
    } catch (e) {
      set({ error: describeGuestError(e instanceof ApiError ? e.code : 'other') });
      return undefined;
    }
  }

  async function load(): Promise<void> {
    const r = await run(async () => {
      const inbox = await call<Inbox>('GET', '/api/guest/friends');
      // Apply and keep what the server just told us before anything else can fail: it says each thing once.
      let list = applyEvents(loadLocalFriends(), inbox.events);
      saveLocalFriends(list);
      const online = new Set<string>();
      if (list.length) {
        const presence = await call<Presence>('POST', '/api/guest/friends/status', { codes: list.map((f) => f.code) });
        list = loadLocalFriends(); // the list may have changed while we waited
        for (const p of presence.friends) {
          if (!p.online) continue;
          online.add(p.code);
          if (p.name) list = list.map((f) => (f.code === p.code ? { ...f, name: p.name!.slice(0, 12) } : f));
        }
        saveLocalFriends(list);
      }
      return { inbox, list, online };
    });
    if (r) set({ code: r.inbox.code, friends: view(r.list, r.online, r.inbox.requests) });
  }

  return {
    name: 'Guest', friends: null, code: null, error: '', notice: '',
    setName: (raw) => set({ name: guestDisplayName(raw) }),

    loadFriends() {
      inflight ??= load().finally(() => { inflight = null; });
      return inflight;
    },
    /** After a change: wait out a refresh already running (its answer may predate the change), then look again. */
    async reload() {
      await inflight;
      await get().loadFriends();
    },
    async loadCode() {
      if (!get().code) await get().loadFriends();
    },
    async request(code) {
      set({ notice: '' });
      const r = await run(() => call<{ state: 'sent' | 'accepted'; friend?: LocalFriend }>('POST', '/api/guest/friends/request', { code }));
      if (!r) return;
      if (r.state === 'accepted' && r.friend) {
        saveLocalFriends(withFriend(loadLocalFriends(), r.friend));
        set({ notice: 'You are friends now.' });
      } else {
        set({ notice: 'Request sent. They will see it in their Friends tab the next time they open it.' });
      }
      await get().reload();
    },
    async accept(id) {
      const r = await run(() => call<{ friend: LocalFriend }>('POST', '/api/guest/friends/accept', { code: id }));
      if (r) saveLocalFriends(withFriend(loadLocalFriends(), r.friend));
      await get().reload();
    },
    async remove(id) {
      if (get().friends?.incoming.some((f) => f.userId === id)) {
        await run(() => call('POST', '/api/guest/friends/decline', { code: id }));
      } else {
        saveLocalFriends(withoutFriend(loadLocalFriends(), id)); // gone from this browser at once, even if the server is far away
        await run(() => call('POST', '/api/guest/friends/remove', { code: id }));
      }
      await get().reload();
    },
  };
});
