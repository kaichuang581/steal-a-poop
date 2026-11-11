import { useEffect } from 'react';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';
import { authEnabled } from '../../auth/config';
import { getServerUrl } from '../../net/config';

/** The address that puts a friend straight into your room (they still sign in first, as for any room). */
export function inviteLink(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('join', code);
  return u.toString();
}

/** The code in a ?join=CODE address, upper-cased, or null if it is missing or not a plausible room code. */
export function codeFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('join');
  return v && /^[A-Za-z0-9]{3,8}$/.test(v) ? v.toUpperCase() : null;
}

/** Joins the room named in the address once the player is online, then tidies the address. Renders nothing. */
export function JoinLink() {
  const status = useRoomStore((s) => s.status);
  const inRoom = useRoomStore((s) => s.room !== null);
  useEffect(() => {
    const code = codeFromSearch(location.search);
    if (!code || inRoom) return;
    // Without accounts the link connects by itself, under the name on the plate (or a guest name). With accounts it
    // waits for the sign-in.
    if (authEnabled() && status !== 'online') return;
    if (!getServerUrl()) return;
    useRoomStore.getState().enter(useStore.getState().settings.name ?? '', { t: 'join', code });
    const u = new URL(location.href);
    u.searchParams.delete('join');
    history.replaceState(null, '', u.toString());
  }, [status, inRoom]);
  return null;
}
