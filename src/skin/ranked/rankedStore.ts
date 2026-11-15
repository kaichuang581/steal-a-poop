import { create } from 'zustand';
import { api, getAccessToken } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';

/** Your own standing in ranked play, as GET /api/ranked gives it (server/ranked/service.ts). */
export interface RankedMe { rating: number; games: number; wins: number; peak: number }

interface RankedState {
  me: RankedMe | null;
  /** off: no game server, or nobody signed in. */
  status: 'idle' | 'loading' | 'ready' | 'off' | 'error';
  /** Reads your rating from the server. Quiet when there is nobody to read it for. */
  load(): Promise<void>;
  /** A ranked game just changed your rating: show it without asking the server again. */
  rated(after: number, won: boolean): void;
}

/**
 * The login to ask with: the account's token, or, on a development server with no accounts, the dev id the room
 * connection signed in with (the server's own user id for it, which that server accepts as a token).
 */
export async function apiToken(): Promise<string | null> {
  if (authEnabled()) return getAccessToken();
  const id = useRoomStore.getState().user?.userId ?? null;
  return id && id.startsWith('dev:') ? id : null;
}

export const useRanked = create<RankedState>((set, get) => ({
  me: null,
  status: 'idle',
  async load() {
    if (!getServerUrl()) return set({ status: 'off' });
    const t = await apiToken();
    if (!t) return set({ status: 'off', me: null });
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      set({ me: await api<RankedMe>('GET', '/api/ranked', t), status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
  rated(after, won) {
    const was = get().me ?? { rating: 0, games: 0, wins: 0, peak: 0 };
    set({ me: { rating: after, games: was.games + 1, wins: was.wins + (won ? 1 : 0), peak: Math.max(was.peak, after) }, status: 'ready' });
  },
}));
