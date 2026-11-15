import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { checkNickname } from '../../lib/nickname';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import type { Intent } from '../../state/roomStore';
import { useStore } from '../../state/store';

/** Whether this build can reach real people at all: it was given a game server's address. */
export const onlinePlay = () => !!getServerUrl();

/** Whether the player has an account signed in. On a development server with no accounts, everyone counts as one. */
export const hasAccount = () => !authEnabled() || useAuth.getState().status === 'ready';

/**
 * Sends the player to real people: the casual queue, the ranked queue, a new lobby or a party code. Signed in, the
 * account's name is used; signed out, a guest plays under the name on the plate. Returns what to tell the player when
 * it cannot be done (no name yet, no server), or null when it is on its way: the room appears when the server answers.
 */
export function enterOnline(intent: Intent): string | null {
  if (!onlinePlay()) return 'Playing with real people needs the game server, and this copy of the game has none.';
  if (authEnabled() && useAuth.getState().status === 'ready') {
    useRoomStore.getState().enter(useAuth.getState().profile?.nickname ?? '', intent);
    return null;
  }
  const nick = checkNickname(useStore.getState().settings.name);
  if (!nick.ok) return nick.message;
  useRoomStore.getState().enter(nick.name, intent);
  return null;
}
