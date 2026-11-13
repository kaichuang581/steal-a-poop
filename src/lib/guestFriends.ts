import { load, save } from './storage';

/** A guest's friends are kept in this browser only: a code (how the server finds them) and the last name seen. */
export interface LocalFriend { code: string; name: string }
/** What the server reports back about this guest's list: someone said yes, or ended it. */
export interface FriendEvent { kind: 'accepted' | 'removed'; code: string; name: string }

export const GUEST_FRIENDS_KEY = 'sap:guest-friends';
export const MAX_LOCAL_FRIENDS = 100;

export function loadLocalFriends(): LocalFriend[] {
  const raw = load<unknown>(GUEST_FRIENDS_KEY, []);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LocalFriend[] = [];
  for (const f of raw as Array<Partial<LocalFriend>>) {
    if (!f || typeof f.code !== 'string' || typeof f.name !== 'string' || seen.has(f.code)) continue;
    seen.add(f.code);
    out.push({ code: f.code, name: f.name.slice(0, 12) });
  }
  return out.slice(0, MAX_LOCAL_FRIENDS);
}

export const saveLocalFriends = (list: LocalFriend[]): void => save(GUEST_FRIENDS_KEY, list);

/** Adds a friend, or refreshes the name of one already there. The list is never longer than MAX_LOCAL_FRIENDS. */
export function withFriend(list: LocalFriend[], friend: LocalFriend): LocalFriend[] {
  const name = friend.name.slice(0, 12);
  if (list.some((f) => f.code === friend.code)) return list.map((f) => (f.code === friend.code ? { ...f, name } : f));
  return list.length >= MAX_LOCAL_FRIENDS ? list : [...list, { code: friend.code, name }];
}

export const withoutFriend = (list: LocalFriend[], code: string): LocalFriend[] => list.filter((f) => f.code !== code);

/** Applies what the server said happened since the last look, oldest first. */
export function applyEvents(list: LocalFriend[], events: readonly FriendEvent[]): LocalFriend[] {
  return events.reduce((acc, e) => (e.kind === 'accepted' ? withFriend(acc, { code: e.code, name: e.name }) : withoutFriend(acc, e.code)), list);
}
