import type { AuthUser } from './contracts';
import { isInappropriateName, MAX_NICKNAME } from '../src/lib/nickname';

/**
 * Guest players: no account, no sign-in. The browser keeps a random id (sap:guest-id) and the typed name, and sends
 * `guest:<uuid>:<name>` as its login token. The id is the identity for the whole visit; nothing about a guest is
 * stored on the server. A guest may create and join rooms and chat, but keeps no results, has no friends and no
 * wallet on the server, and is never a moderator.
 */
const GUEST = /^guest:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([^:]{1,60})$/i;

export function guestUser(token: string): AuthUser | null {
  if (token.length > 120) return null;
  const m = GUEST.exec(token);
  if (!m) return null;
  let name: string;
  try { name = decodeURIComponent(m[2]); } catch { return null; }
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NICKNAME);
  if (!name || isInappropriateName(name)) return null;
  return { userId: `guest:${m[1].toLowerCase()}`, name, chatAllowed: true, resultsAllowed: false, isModerator: false };
}

/** True for a guest's server id (`guest:<uuid>`). Account ids never start this way. */
export const isGuestId = (userId: string): boolean => userId.startsWith('guest:');
