import { load } from '../lib/storage';

/**
 * Where the game server is. Set VITE_SERVER_URL at build time (for example ws://localhost:8787).
 * For local testing you can also store a URL under the localStorage key "sap:server".
 * With neither, multiplayer is hidden, so the public site is not offered a feature that cannot work.
 */
export function getServerUrl(): string | null {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  const url = fromEnv || load<string>('sap:server', '');
  return url ? url : null;
}
